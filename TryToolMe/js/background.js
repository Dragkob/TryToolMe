chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLocalStorage") {
    chrome.storage.local.get(request.keys, (result) => {
      sendResponse(result);
    });
    return true;
  }
  if (request.action === "setLocalStorage") {
    chrome.storage.local.set(request.data, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
