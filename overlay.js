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
    #${overlayId} .row.top-row { align-items: start; }
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
      flex: 0 0 auto;
      padding: 9px 16px;
      min-width: 88px;
      max-width: 96px;
      align-self: start;
    }
    #${overlayId} .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    #${overlayId} .stack { display: flex; flex-direction: column; gap: 8px; }
    #${overlayId} .toggle-group {
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 4px;
      border: 1px solid rgba(150, 190, 235, 0.4);
      border-radius: 999px;
      background: rgba(237, 246, 255, 0.1);
    }
    #${overlayId} .toggle-group input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    #${overlayId} .toggle-group label {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 72px;
      padding: 8px 16px;
      border-radius: 999px;
      cursor: pointer;
      color: #dcecff;
      transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
    }
    #${overlayId} .toggle-group input:checked + label {
      background: linear-gradient(135deg, #4d8cf1 0%, #79bcff 100%);
      color: #ffffff;
      box-shadow: 0 10px 20px rgba(58, 123, 214, 0.28);
    }
    #${overlayId} .status { min-height: 18px; color: #cfe6ff; }
    #${overlayId} .muted { color: #b8d1eb; font-size: 12px; }
  `;
  document.documentElement.appendChild(style);

  const root = document.createElement("section");
  root.id = overlayId;
  root.innerHTML = `
    <div class="row top-row">
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
        <div class="toggle-group">
          <input id="ce-format-md" type="radio" name="ce-format" value="md" checked>
          <label for="ce-format-md">MD</label>
          <input id="ce-format-txt" type="radio" name="ce-format" value="txt">
          <label for="ce-format-txt">TXT</label>
        </div>
      </label>
      <div class="stack" style="justify-content:end">
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
  const previewOutput = root.querySelector("#ce-preview-output");
  const statusOutput = root.querySelector("#ce-status");

  function setStatus(message, isError = false) {
    statusOutput.textContent = message;
    statusOutput.style.color = isError ? "#ffb5b5" : "#cfe6ff";
  }

  function getSelectedFormat() {
    return root.querySelector('input[name="ce-format"]:checked')?.value || "md";
  }

  function getConversationId() {
    const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
    return match ? match[1] : "";
  }

  function looksLikeConversation(candidate, conversationId) {
    return Boolean(
      candidate &&
        typeof candidate === "object" &&
        typeof candidate.current_node === "string" &&
        candidate.mapping &&
        typeof candidate.mapping === "object" &&
        (!conversationId ||
          candidate.conversation_id === conversationId ||
          candidate.id === conversationId ||
          candidate.conversationId === conversationId)
    );
  }

  function walkForConversation(rootValue, conversationId, maxNodes = 25000) {
    const seen = new WeakSet();
    const stack = [rootValue];
    let visited = 0;

    while (stack.length && visited < maxNodes) {
      const current = stack.pop();
      if (!current || typeof current !== "object") {
        continue;
      }

      if (seen.has(current)) {
        continue;
      }

      seen.add(current);
      visited += 1;

      if (looksLikeConversation(current, conversationId)) {
        return current;
      }

      if (Array.isArray(current)) {
        for (let index = current.length - 1; index >= 0; index -= 1) {
          stack.push(current[index]);
        }
        continue;
      }

      for (const key of Object.keys(current)) {
        let value;
        try {
          value = current[key];
        } catch (_error) {
          continue;
        }

        if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }

    return null;
  }

  function getInlineScriptCandidates() {
    const candidates = [];

    for (const script of document.scripts) {
      const text = script.textContent?.trim();
      if (!text || text.length < 20) {
        continue;
      }

      if (
        text.includes("\"mapping\"") ||
        text.includes("\"current_node\"") ||
        text.includes("\"conversation_id\"")
      ) {
        candidates.push(text);
      }
    }

    return candidates;
  }

  function tryParseCandidateText(text, conversationId) {
    try {
      const parsed = JSON.parse(text);
      return walkForConversation(parsed, conversationId, 12000);
    } catch (_error) {
      return null;
    }
  }

  function findConversationInScripts(conversationId) {
    for (const text of getInlineScriptCandidates()) {
      const match = tryParseCandidateText(text, conversationId);
      if (match) {
        return match;
      }
    }

    return null;
  }

  function findConversationInStorage(storage, conversationId) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      const value = storage.getItem(key);
      if (!value || value.length < 20) {
        continue;
      }

      if (
        !value.includes(conversationId) &&
        !value.includes("\"mapping\"") &&
        !value.includes("\"current_node\"")
      ) {
        continue;
      }

      const match = tryParseCandidateText(value, conversationId);
      if (match) {
        return match;
      }
    }

    return null;
  }

  function findConversationInWindow(conversationId) {
    const priorityProps = [
      "__NEXT_DATA__",
      "__NEXT_ROUTER_STATE_TREE__",
      "__INITIAL_STATE__",
      "__APOLLO_STATE__",
      "__REACT_QUERY_STATE__",
      "__remixContext",
      "next",
      "__next_f"
    ];

    for (const prop of priorityProps) {
      let value;
      try {
        value = window[prop];
      } catch (_error) {
        continue;
      }

      const match = walkForConversation(value, conversationId, 15000);
      if (match) {
        return match;
      }
    }

    const windowProps = Object.getOwnPropertyNames(window);
    for (const prop of windowProps) {
      if (!/^(__|webpack|next|_)/i.test(prop)) {
        continue;
      }

      let value;
      try {
        value = window[prop];
      } catch (_error) {
        continue;
      }

      const match = walkForConversation(value, conversationId, 8000);
      if (match) {
        return match;
      }
    }

    return null;
  }

  async function fetchConversationFromApi(conversationId) {
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

  async function resolveConversationJson() {
    const conversationId = getConversationId();
    if (!conversationId) {
      throw new Error("Open a specific ChatGPT conversation first.");
    }

    const pageStateMatch =
      findConversationInWindow(conversationId) ||
      findConversationInScripts(conversationId) ||
      findConversationInStorage(window.sessionStorage, conversationId) ||
      findConversationInStorage(window.localStorage, conversationId);

    if (pageStateMatch) {
      return {
        conversationJson: pageStateMatch,
        source: "page-state"
      };
    }

    return {
      conversationJson: await fetchConversationFromApi(conversationId),
      source: "backend-api"
    };
  }

  function downloadText(text, filename) {
    const extension = getSelectedFormat();
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
    const { conversationJson, source } = await resolveConversationJson();
    const parsed = parseConversationJson(
      JSON.stringify(conversationJson),
      assistantInput.value.trim() || "Kai",
      userInput.value.trim() || "Val"
    );
    return {
      ...parsed,
      source
    };
  }

  root.querySelector("#ce-close").addEventListener("click", () => {
    root.style.display = "none";
  });

  root.querySelector("#ce-preview").addEventListener("click", async () => {
    try {
      setStatus("Loading preview...");
      const { formattedText, source } = await buildFromCurrentChat();
      previewOutput.value = formattedText;
      setStatus(`Preview updated from ${source}.`);
    } catch (error) {
      setStatus(error.message || "Failed to preview the current chat.", true);
    }
  });

  root.querySelector("#ce-export").addEventListener("click", async () => {
    try {
      setStatus("Exporting current chat...");
      const { formattedText, parsedJson, source } = await buildFromCurrentChat();
      previewOutput.value = formattedText;
      downloadText(formattedText, parsedJson?.title || getConversationId());
      setStatus(`Export started from ${source}.`);
    } catch (error) {
      setStatus(error.message || "Failed to export the current chat.", true);
    }
  });
})();
