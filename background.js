function enableActionSidePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onInstalled.addListener(enableActionSidePanel);
chrome.runtime.onStartup.addListener(enableActionSidePanel);
enableActionSidePanel();
