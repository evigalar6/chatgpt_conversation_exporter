(function () {
  const overlayId = "convo-exporter-overlay";
  const existing = document.getElementById(overlayId);
  if (existing) {
    existing.style.display = "flex";
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    #${overlayId} {
      position: fixed;
      top: 16px;
      right: 16px;
      width: min(420px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      border: 1px solid rgba(144, 180, 230, 0.65);
      border-radius: 18px;
      background:
        radial-gradient(circle at 18px 20px, rgba(255,255,255,0.78) 0 1.2px, transparent 1.4px),
        radial-gradient(circle at 88px 44px, rgba(232,244,255,0.82) 0 1.6px, transparent 1.8px),
        linear-gradient(180deg, rgba(13, 29, 60, 0.96) 0%, rgba(26, 52, 96, 0.96) 100%);
      color: #ecf6ff;
      box-shadow: 0 20px 60px rgba(5, 13, 30, 0.45);
      font: 14px/1.4 Georgia, "Times New Roman", serif;
      backdrop-filter: blur(12px);
    }
    #${overlayId} * { box-sizing: border-box; }
    #${overlayId} h2 { margin: 0; font-size: 20px; }
    #${overlayId} p, #${overlayId} label { margin: 0; }
    #${overlayId} .row { display: flex; gap: 8px; }
    #${overlayId} .row > * { flex: 1; }
    #${overlayId} input[type="text"], #${overlayId} textarea, #${overlayId} select {
      width: 100%;
      border: 1px solid rgba(150, 190, 235, 0.4);
      border-radius: 12px;
      padding: 10px 12px;
      background: rgba(237, 246, 255, 0.1);
      color: #f3faff;
    }
    #${overlayId} textarea {
      min-height: 220px;
      resize: vertical;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    #${overlayId} button {
      border: 0;
      border-radius: 999px;
      padding: 11px 14px;
      background: linear-gradient(135deg, #4d8cf1 0%, #79bcff 100%);
      color: white;
      cursor: pointer;
      font: 600 13px/1 Georgia, "Times New Roman", serif;
    }
    #${overlayId} button.secondary {
      background: rgba(234, 244, 255, 0.14);
      border: 1px solid rgba(180, 208, 242, 0.35);
    }
    #${overlayId} .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    #${overlayId} .status { min-height: 18px; color: #cfe6ff; }
    #${overlayId} .muted { color: #b8d1eb; font-size: 12px; }
  `;
  document.documentElement.appendChild(style);

  const root = document.createElement("section");
  root.id = overlayId;
  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Conversation Exporter</h2>
        <p class="muted">Export this ChatGPT conversation without copy-paste.</p>
      </div>
      <button id="ce-close" class="secondary" type="button">Close</button>
    </div>
    <div class="row">
      <label>
        Assistant name
        <input id="ce-assistant" type="text" value="Kai">
      </label>
      <label>
        User name
        <input id="ce-user" type="text" value="Val">
      </label>
    </div>
    <div class="row">
      <label>
        Format
        <select id="ce-format">
          <option value="md">MD</option>
          <option value="txt">TXT</option>
        </select>
      </label>
      <div class="actions" style="align-items:end">
        <button id="ce-preview" type="button">Preview Current Chat</button>
        <button id="ce-export" type="button">Export Current Chat</button>
      </div>
    </div>
    <label>
      Preview
      <textarea id="ce-preview-output" readonly></textarea>
    </label>
    <div id="ce-status" class="status"></div>
  `;
  document.documentElement.appendChild(root);

  const assistantInput = root.querySelector("#ce-assistant");
  const userInput = root.querySelector("#ce-user");
  const formatSelect = root.querySelector("#ce-format");
  const previewOutput = root.querySelector("#ce-preview-output");
  const statusOutput = root.querySelector("#ce-status");

  function setStatus(message, isError = false) {
    statusOutput.textContent = message;
    statusOutput.style.color = isError ? "#ffb5b5" : "#cfe6ff";
  }

  function getConversationId() {
    const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
    return match ? match[1] : "";
  }

  async function fetchConversation() {
    const conversationId = getConversationId();
    if (!conversationId) {
      throw new Error("Open a specific ChatGPT conversation first.");
    }

    const response = await fetch(
      `${window.location.origin}/backend-api/conversation/${conversationId}`,
      {
        credentials: "include",
        headers: {
          accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat fetch failed (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  function downloadText(text, filename) {
    const extension = formatSelect.value;
    const blob = new Blob([text], {
      type: extension === "md" ? "text/markdown" : "text/plain"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilenamePart(filename, "conversation-export")}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function buildFromCurrentChat() {
    const conversationJson = await fetchConversation();
    return parseConversationJson(
      JSON.stringify(conversationJson),
      assistantInput.value.trim() || "Kai",
      userInput.value.trim() || "Val"
    );
  }

  root.querySelector("#ce-close").addEventListener("click", () => {
    root.style.display = "none";
  });

  root.querySelector("#ce-preview").addEventListener("click", async () => {
    try {
      setStatus("Loading preview...");
      const { formattedText } = await buildFromCurrentChat();
      previewOutput.value = formattedText;
      setStatus("Preview updated.");
    } catch (error) {
      setStatus(error.message || "Failed to preview the current chat.", true);
    }
  });

  root.querySelector("#ce-export").addEventListener("click", async () => {
    try {
      setStatus("Exporting current chat...");
      const { formattedText, parsedJson } = await buildFromCurrentChat();
      previewOutput.value = formattedText;
      downloadText(formattedText, parsedJson?.title || getConversationId());
      setStatus("Export started.");
    } catch (error) {
      setStatus(error.message || "Failed to export the current chat.", true);
    }
  });
})();
