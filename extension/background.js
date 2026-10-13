// WRLD: Send seats to WRLD.
// Runs only when you click the button, and only on the tab you're looking at
// ("activeTab"). It reads that page's address and visible text and opens
// wrldtrips.com/points/share with them in the URL fragment, which isn't sent
// to WRLD's server as part of the address. There you check what WRLD read
// and decide what to share. Nothing runs in the background or on other sites.
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
