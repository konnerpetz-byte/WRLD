// WRLD relay: lets the WRLD points explorer ask this extension for a live award
// search. Runs only on wrldtrips.com/points. It passes messages between the page
// and the extension; it reads nothing else on the page.
document.documentElement.dataset.wrldExtension = "2";
window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || msg.type !== "wrld:live-search" || typeof msg.id !== "string") return;
  chrome.runtime.sendMessage({ type: "live-search", request: msg.request }, (reply) => {
    window.postMessage({ type: "wrld:live-results", id: msg.id, reply: reply || { error: "The WRLD extension didn't answer." } }, location.origin);
  });
});
