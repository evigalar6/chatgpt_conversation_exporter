const openOverlayButton = document.getElementById("openOverlayButton");
const statusOutput = document.getElementById("status");

function setStatus(message, isError = false) {
  statusOutput.textContent = message;
  statusOutput.style.color = isError ? "#8b1e1e" : "#48607d";
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}

function getConversationIdFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/c\/([a-z0-9-]+)/i);
    return match ? match[1] : "";
  } catch (_error) {
    return "";
  }
}

async function openOverlay() {
  try {
    openOverlayButton.disabled = true;
    setStatus("Opening exporter on current tab...");
    const activeTab = await getActiveTab();

    if (!activeTab?.id || !activeTab.url) {
      throw new Error("No active tab is available.");
    }

    const url = new URL(activeTab.url);
    if (!["chatgpt.com", "chat.openai.com"].includes(url.hostname)) {
      throw new Error("Open the target conversation on ChatGPT first.");
    }

    const conversationId = getConversationIdFromUrl(activeTab.url);
    if (!conversationId) {
      throw new Error("Open a specific ChatGPT conversation first.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      world: "MAIN",
      files: ["parser.js", "overlay.js"]
    });

    setStatus("Exporter opened on the current page.");
    window.close();
  } catch (error) {
    setStatus(error?.message || "Failed to open the exporter.", true);
  } finally {
    openOverlayButton.disabled = false;
  }
}

openOverlayButton.addEventListener("click", openOverlay);
