const jsonInput = document.getElementById("jsonInput");
const fileInput = document.getElementById("fileInput");
const loadCurrentChatButton = document.getElementById("loadCurrentChatButton");
const exportCurrentChatButton = document.getElementById("exportCurrentChatButton");
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

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").trim();
}

function extractTextParts(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractTextParts);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  if (value.content_type === "image_asset_pointer") {
    return [];
  }

  const directTextKeys = ["text", "value", "body"];
  const parts = [];

  for (const key of directTextKeys) {
    if (typeof value[key] === "string") {
      parts.push(value[key]);
    }
  }

  if (Array.isArray(value.parts)) {
    parts.push(...value.parts.flatMap(extractTextParts));
  }

  if (typeof value.content === "string") {
    parts.push(value.content);
  }

  if (Array.isArray(value.content)) {
    parts.push(...value.content.flatMap(extractTextParts));
  }

  if (Array.isArray(value.messages)) {
    parts.push(...value.messages.flatMap(extractTextParts));
  }

  if (typeof value.message === "object") {
    parts.push(...extractTextParts(value.message));
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (typeof value.input_text === "string") {
    parts.push(value.input_text);
  }

  if (typeof value.transcript === "string") {
    parts.push(value.transcript);
  }

  return parts;
}

function getRole(candidate) {
  const rawRole =
    candidate?.role ??
    candidate?.author?.role ??
    candidate?.message?.author?.role ??
    candidate?.speaker ??
    candidate?.type ??
    "";

  if (typeof rawRole !== "string") {
    return "";
  }

  return rawRole.toLowerCase();
}

function getMessageText(candidate) {
  const sources = [
    candidate?.text,
    candidate?.content,
    candidate?.message?.content,
    candidate?.message,
    candidate?.parts,
    candidate?.body
  ];

  const text = sources
    .flatMap(extractTextParts)
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");

  return normalizeText(text);
}

function flattenConversation(input) {
  if (input?.mapping && typeof input.mapping === "object") {
    const path = [];
    let currentNodeId = input.current_node;

    while (currentNodeId && input.mapping[currentNodeId]) {
      path.push(input.mapping[currentNodeId]);
      currentNodeId = input.mapping[currentNodeId].parent;
    }

    return path.reverse();
  }

  if (Array.isArray(input)) {
    return input;
  }

  const candidateArrays = [
    input?.messages,
    input?.conversation,
    input?.conversation?.messages,
    input?.data?.messages,
    input?.data?.conversation?.messages
  ];

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (input?.mapping && typeof input.mapping === "object") {
    return Object.values(input.mapping);
  }

  return [];
}

function extractTurns(parsedJson) {
  const rawMessages = flattenConversation(parsedJson);
  const turns = [];

  for (const rawMessage of rawMessages) {
    const role = getRole(rawMessage);
    const contentType =
      rawMessage?.content?.content_type ??
      rawMessage?.message?.content?.content_type ??
      "";
    const text = getMessageText(rawMessage);

    if (!text) {
      continue;
    }

    if (
      contentType &&
      !["text", "multimodal_text"].includes(String(contentType).toLowerCase())
    ) {
      continue;
    }

    if (role.includes("assistant")) {
      turns.push({ role: "assistant", text });
      continue;
    }

    if (role.includes("user") || role.includes("human")) {
      turns.push({ role: "user", text });
    }
  }

  return turns;
}

function formatTurns(turns, assistantName, userName) {
  return turns
    .map((turn) => {
      const speaker = turn.role === "assistant" ? assistantName : userName;
      return `**${speaker}:**\n${turn.text}`;
    })
    .join("\n\n***\n\n");
}

function parseConversationJson(rawJson) {
  const assistantName = assistantNameInput.value.trim() || "Kai";
  const userName = userNameInput.value.trim() || "Val";

  if (!rawJson) {
    throw new Error("Load a conversation JSON first.");
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch (error) {
    throw new Error("The JSON is invalid.");
  }

  const turns = extractTurns(parsedJson);
  if (!turns.length) {
    throw new Error("No user or assistant messages were found in this JSON shape.");
  }

  return {
    formattedText: formatTurns(turns, assistantName, userName),
    parsedJson
  };
}

function buildExport() {
  return parseConversationJson(jsonInput.value.trim()).formattedText;
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

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}

async function fetchConversationFromPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
      if (!match) {
        throw new Error("Open a specific ChatGPT conversation first.");
      }

      const response = await fetch(
        `${window.location.origin}/backend-api/conversation/${match[1]}`,
        {
          credentials: "include",
          headers: {
            accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Chat fetch failed (${response.status}).`);
      }

      return response.json();
    }
  });

  return result;
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

function exportConversation() {
  try {
    const rawJson = jsonInput.value.trim();
    const { formattedText, parsedJson } = parseConversationJson(rawJson);
    downloadExport(
      formattedText,
      parsedJson?.title || "conversation-export"
    );
  } catch (error) {
    setStatus(error.message, true);
  }
}

function sanitizeFilenamePart(value, fallback) {
  const safeValue = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeValue || fallback;
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

function loadJsonFromFile() {
  fileInput.click();
}

async function loadCurrentChat() {
  try {
    setStatus("Loading conversation from current tab...");
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

    const conversationJson = await fetchConversationFromPage(activeTab.id);
    jsonInput.value = JSON.stringify(conversationJson, null, 2);
    previewOutput.value = "";
    setStatus("Current chat loaded.");
  } catch (error) {
    const message =
      error?.message || "Failed to load the conversation from the current tab.";
    setStatus(message, true);
  }
}

async function exportCurrentChat() {
  try {
    setStatus("Exporting current chat...");
    const activeTab = await getActiveTab();

    if (!activeTab?.id || !activeTab.url) {
      throw new Error("No active tab is available.");
    }

    const url = new URL(activeTab.url);
    if (!["chatgpt.com", "chat.openai.com"].includes(url.hostname)) {
      throw new Error("Open the target conversation on ChatGPT first.");
    }

    const conversationJson = await fetchConversationFromPage(activeTab.id);
    const rawJson = JSON.stringify(conversationJson, null, 2);
    const { formattedText, parsedJson } = parseConversationJson(rawJson);

    jsonInput.value = rawJson;
    previewOutput.value = formattedText;
    downloadExport(
      formattedText,
      parsedJson?.title || `conversation-${getConversationIdFromUrl(activeTab.url)}`
    );
  } catch (error) {
    const message =
      error?.message || "Failed to export the conversation from the current tab.";
    setStatus(message, true);
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

exportCurrentChatButton.addEventListener("click", exportCurrentChat);
loadCurrentChatButton.addEventListener("click", loadCurrentChat);
loadFileButton.addEventListener("click", loadJsonFromFile);
fileInput.addEventListener("change", handleFileSelection);
previewButton.addEventListener("click", previewExport);
exportButton.addEventListener("click", exportConversation);
