/* global parseConversationJson, sanitizeFilenamePart */

const jsonInput = document.getElementById("jsonInput");
const fileInput = document.getElementById("fileInput");
const openOverlayButton = document.getElementById("openOverlayButton");
const loadFileButton = document.getElementById("loadFileButton");
const assistantNameInput = document.getElementById("assistantName");
const userNameInput = document.getElementById("userName");
const previewButton = document.getElementById("previewButton");
const exportButton = document.getElementById("exportButton");
const previewOutput = document.getElementById("previewOutput");
const statusOutput = document.getElementById("status");

function setStatus(message, isError = false) {
  statusOutput.textContent = message;
  statusOutput.style.color = isError ? "#8b1e1e" : "#64554b";
}

function getSelectedFormat() {
  return document.querySelector('input[name="format"]:checked').value;
}

function parseManualJson(rawJson) {
  return parseConversationJson(
    rawJson,
    assistantNameInput.value.trim() || "Assistant",
    userNameInput.value.trim() || "User"
  );
}

function buildExport() {
  return parseManualJson(jsonInput.value.trim()).formattedText;
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

function previewExport() {
  try {
    const formattedText = buildExport();
    previewOutput.value = formattedText;
    setStatus("Preview updated.");
  } catch (error) {
    previewOutput.value = "";
    setStatus(error.message, true);
  }
}

function downloadExport(formattedText, suggestedName = "conversation-export") {
  const format = getSelectedFormat();
  const blob = new Blob([formattedText], {
    type: format === "md" ? "text/markdown" : "text/plain"
  });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    {
      url,
      filename: `${sanitizeFilenamePart(suggestedName, "conversation-export")}.${format}`,
      saveAs: true
    },
    () => {
      if (chrome.runtime.lastError) {
        setStatus(chrome.runtime.lastError.message, true);
      } else {
        previewOutput.value = formattedText;
        setStatus(`Exported as .${format}.`);
      }

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  );
}

function exportConversation() {
  try {
    const { formattedText, parsedJson } = parseManualJson(jsonInput.value.trim());
    downloadExport(formattedText, parsedJson?.title || "conversation-export");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function loadJsonFromFile() {
  fileInput.click();
}

async function openOverlay() {
  try {
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
  } catch (error) {
    setStatus(error?.message || "Failed to open the exporter.", true);
  }
}

async function handleFileSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    jsonInput.value = await file.text();
    previewOutput.value = "";
    setStatus(`Loaded ${file.name}.`);
  } catch (_error) {
    setStatus("Failed to read the selected file.", true);
  } finally {
    fileInput.value = "";
  }
}

openOverlayButton.addEventListener("click", openOverlay);
loadFileButton.addEventListener("click", loadJsonFromFile);
fileInput.addEventListener("change", handleFileSelection);
previewButton.addEventListener("click", previewExport);
exportButton.addEventListener("click", exportConversation);
