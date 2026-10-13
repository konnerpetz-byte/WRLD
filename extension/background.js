// WRLD: live award search and "Send to WRLD".
//
// 1. Send to WRLD: when you click the toolbar button on an airline's results,
//    it reads that page's address and visible text and opens
//    wrldtrips.com/points/share with them in the URL fragment for you to check.
//
// 2. Live search: when you click "Search live" in the WRLD points explorer, it
//    looks up Alaska Airlines (Atmos Rewards) award prices on alaskaair.com in
//    your own browser, the same calendar alaskaair.com shows anyone (no sign-in),
//    one request at a time, and returns them to the explorer. It never runs on
//    its own, stops at any bot check, and doesn't try to get around one.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https:\/\//.test(tab.url || "")) return;
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ u: location.href, t: document.body.innerText.slice(0, 100000) }),
  });
  if (!result || !result.result) return;
  const payload = encodeURIComponent(JSON.stringify(result.result));
  await chrome.tabs.create({ url: `https://wrldtrips.com/points/share#${payload}`, index: tab.index + 1 });
});

const IATA = /^[A-Z]{3}$/;
const MONTH = /^\d{4}-\d{2}$/;
const MAX_REQUESTS = 30;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.type !== "live-search" || !sender.tab || !/^https:\/\/(www\.)?wrldtrips\.com\//.test(sender.url || "")) return;
  const r = msg.request || {};
  const routes = (Array.isArray(r.routes) ? r.routes : []).filter((x) => x && IATA.test(x.origin) && IATA.test(x.destination));
  const months = (Array.isArray(r.months) ? r.months : []).filter((m) => MONTH.test(m));
  const jobs = [];
  for (const route of routes) for (const month of months) jobs.push({ ...route, month });
  if (!jobs.length) {
    reply({ error: "Nothing to search." });
    return;
  }
  searchAlaska(jobs.slice(0, MAX_REQUESTS)).then(reply, (e) => reply({ error: String(e && e.message ? e.message : e) }));
  return true; // reply comes later
});

async function alaskaTab() {
  const [open] = await chrome.tabs.query({ url: "https://www.alaskaair.com/*" });
  if (open && open.id) return { id: open.id, created: false };
  const tab = await chrome.tabs.create({ url: "https://www.alaskaair.com/", active: false });
  await new Promise((resolve) => {
    const done = (id, info) => {
      if (id === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(done);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(done);
    setTimeout(resolve, 20000);
  });
  return { id: tab.id, created: true };
}

async function searchAlaska(jobs) {
  const tab = await alaskaTab();
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [jobs],
      func: async (jobs) => {
        // Alaska's award calendar data (the same data its calendar page shows).
        // Parser adapted from Award Buddy (MIT, github.com/kevchentw/awardbuddy).
        const parse = (body) => {
          for (const line of body.split("\n")) {
            if (!line.startsWith("{")) continue;
            let chunk;
            try { chunk = JSON.parse(line); } catch { continue; }
            if (chunk.type !== "chunk" || !Array.isArray(chunk.data)) continue;
            const data = chunk.data;
            const resolver = data.find((i) => i && typeof i === "object" && "calendarDates" in i);
            if (!resolver) continue;
            const list = data[resolver.calendarDates];
            if (!Array.isArray(list)) continue;
            return list.flatMap((idx) => {
              if (typeof idx !== "number") return [];
              const e = data[idx];
              const date = typeof e?.date === "number" ? data[e.date] : e?.date;
              const raw = e?.awardPoints;
              const ap = typeof raw === "number" ? (Number.isInteger(raw) && raw < data.length && typeof data[raw] === "number" ? data[raw] : raw) : null;
              return typeof date === "string" && typeof ap === "number" && ap >= 1000 ? [{ date, miles: ap }] : [];
            });
          }
          return [];
        };
        const rows = [];
        let stopped = null;
        for (const job of jobs) {
          const params = new URLSearchParams({
            O: job.origin, D: job.destination, OD: `${job.month}-01`, A: "1", RT: "false",
            RequestType: "Calendar", ShoppingMethod: "onlineaward", locale: "en-us", FareType: "Main",
            "x-sveltekit-invalidated": "11",
          });
          try {
            const res = await fetch(`/search/calendar/__data.json?${params}`, { headers: { adrum: "isAjax:true" }, credentials: "include" });
            if (res.status === 403 || res.status === 429) { stopped = "alaskaair.com asked to slow down. Try again later."; break; }
            if (res.ok) for (const r of parse(await res.text())) rows.push({ origin: job.origin, destination: job.destination, date: r.date, miles: r.miles });
          } catch { /* skip this one */ }
          await new Promise((r) => setTimeout(r, 1000)); // one request a second
        }
        return { rows, stopped };
      },
    });
    const out = result && result.result ? result.result : { rows: [], stopped: "No answer from alaskaair.com." };
    return { program: "alaska", cabin: "economy", rows: out.rows, error: out.stopped || undefined };
  } finally {
    if (tab.created) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch {
        // Already closed.
      }
    }
  }
}
