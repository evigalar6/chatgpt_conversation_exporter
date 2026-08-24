(function () {
  const overlayId = "convo-exporter-overlay";
  const existing = document.getElementById(overlayId);
  if (existing) {
    existing.style.display = "flex";
    existing.querySelector("#ce-close")?.focus();
    return;
  }

  const parser = globalThis.__conversationExporterParser;
  if (!parser) {
    throw new Error("Conversation Exporter parser failed to load.");
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
    #${overlayId} fieldset { margin: 0; padding: 0; border: 0; }
    #${overlayId} legend { margin-bottom: 6px; }
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
    #${overlayId} button:disabled { opacity: 0.6; cursor: wait; }
    #${overlayId} button:focus-visible,
    #${overlayId} input:focus-visible,
    #${overlayId} textarea:focus-visible {
      outline: 3px solid rgba(121, 188, 255, 0.75);
      outline-offset: 2px;
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
    #${overlayId} .toggle-group input:focus-visible + label {
      outline: 3px solid rgba(121, 188, 255, 0.75);
      outline-offset: 2px;
    }
    #${overlayId} .status { min-height: 18px; color: #cfe6ff; }
    #${overlayId} .muted { color: #b8d1eb; font-size: 12px; }
    #${overlayId} .debug {
      min-height: 34px;
      padding: 8px 10px;
      border-radius: 12px;
      background: rgba(237, 246, 255, 0.08);
      border: 1px solid rgba(150, 190, 235, 0.2);
      white-space: pre-wrap;
      word-break: break-word;
    }
    #${overlayId} .diagnostics summary { cursor: pointer; color: #b8d1eb; }
    #${overlayId} .diagnostics[open] summary { margin-bottom: 6px; }
  `;
  document.documentElement.appendChild(style);

  const root = document.createElement("section");
  root.id = overlayId;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "false");
  root.setAttribute("aria-labelledby", "ce-title");
  root.innerHTML = `
    <div class="row top-row">
      <div>
        <h2 id="ce-title">Conversation Exporter</h2>
        <p class="muted">Export this ChatGPT conversation without copy-paste.</p>
      </div>
      <button id="ce-close" class="secondary" type="button">Close</button>
    </div>
    <div class="row">
      <label>
        Assistant name
        <input id="ce-assistant" type="text" placeholder="Assistant">
      </label>
      <label>
        User name
        <input id="ce-user" type="text" placeholder="User">
      </label>
    </div>
    <div class="row">
      <fieldset>
        <legend>Format</legend>
        <div class="toggle-group">
          <input id="ce-format-md" type="radio" name="ce-format" value="md" checked>
          <label for="ce-format-md">MD</label>
          <input id="ce-format-txt" type="radio" name="ce-format" value="txt">
          <label for="ce-format-txt">TXT</label>
        </div>
      </fieldset>
      <div class="stack" style="justify-content:end">
        <button id="ce-preview" type="button">Preview Current Chat</button>
        <button id="ce-export" type="button">Export Current Chat</button>
      </div>
    </div>
    <label>
      Preview
      <textarea id="ce-preview-output" aria-label="Export preview" readonly></textarea>
    </label>
    <div id="ce-status" class="status" aria-live="polite"></div>
    <details class="diagnostics">
      <summary>Diagnostics</summary>
      <div id="ce-debug" class="muted debug">Waiting for preview.</div>
    </details>
  `;
  document.documentElement.appendChild(root);

  const assistantInput = root.querySelector("#ce-assistant");
  const userInput = root.querySelector("#ce-user");
  const previewOutput = root.querySelector("#ce-preview-output");
  const statusOutput = root.querySelector("#ce-status");
  const debugOutput = root.querySelector("#ce-debug");
  let activeConversationId = window.location.pathname;

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

  function resetOverlayState(message = "Conversation changed. Preview cleared.") {
    previewOutput.value = "";
    setStatus(message);
    debugOutput.textContent = "Waiting for preview.";
  }

  function setDebugInfo(lines) {
    debugOutput.textContent = lines.join("\n");
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

  function normalizeInlineWhitespace(text) {
    return text.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  }

  function escapeMarkdownText(text) {
    return text.replace(/\u00a0/g, " ");
  }

  function serializeChildren(node) {
    return Array.from(node.childNodes)
      .map((child) => serializeNodeToMarkdown(child))
      .join("");
  }

  function serializeList(listElement, depth = 0) {
    const items = Array.from(listElement.children).filter((child) => child.tagName === "LI");
    return items
      .map((item, index) => {
        const marker = listElement.tagName === "OL" ? `${index + 1}. ` : "- ";
        const content = serializeChildren(item)
          .trim()
          .replace(/\n/g, `\n${"  ".repeat(depth + 1)}`);
        return `${"  ".repeat(depth)}${marker}${content}`;
      })
      .join("\n");
  }

  function serializeTable(tableElement) {
    const rows = Array.from(tableElement.querySelectorAll("tr"));
    if (!rows.length) {
      return "";
    }

    const markdownRows = rows.map((row) =>
      `| ${Array.from(row.children)
        .map((cell) => serializeChildren(cell).replace(/\n+/g, " ").trim())
        .join(" | ")} |`
    );

    if (rows[0].children.length) {
      markdownRows.splice(
        1,
        0,
        `| ${Array.from(rows[0].children)
          .map(() => "---")
          .join(" | ")} |`
      );
    }

    return markdownRows.join("\n");
  }

  function serializeNodeToMarkdown(node) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return escapeMarkdownText(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    if (
      node.getAttribute("aria-hidden") === "true" ||
      ["BUTTON", "NAV", "SVG", "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(node.tagName)
    ) {
      return "";
    }

    const content = serializeChildren(node);

    switch (node.tagName) {
      case "BR":
        return "\n";
      case "P":
        return `${content.trim()}\n\n`;
      case "DIV":
      case "SECTION":
      case "ARTICLE":
        return content;
      case "EM":
      case "I":
        return `*${content.trim()}*`;
      case "STRONG":
      case "B":
        return `**${content.trim()}**`;
      case "CODE":
        if (node.parentElement?.tagName === "PRE") {
          return content;
        }
        return `\`${content.trim()}\``;
      case "PRE": {
        const code = node.textContent?.replace(/\n$/, "") || "";
        return `\n\`\`\`\n${code}\n\`\`\`\n`;
      }
      case "A": {
        const href = node.getAttribute("href") || "";
        const label = content.trim() || href;
        return href ? `[${label}](${href})` : label;
      }
      case "UL":
      case "OL":
        return `${serializeList(node)}\n\n`;
      case "LI":
        return content;
      case "BLOCKQUOTE":
        return `${content
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}\n\n`;
      case "TABLE":
        return `${serializeTable(node)}\n\n`;
      case "HR":
        return "\n---\n";
      default:
        return content;
    }
  }

  function extractTextFromElement(rootElement) {
    return normalizeInlineWhitespace(
      serializeNodeToMarkdown(rootElement)
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }

  function getConversationTitle() {
    const rawTitle = document.title || "conversation-export";
    return rawTitle.replace(/\s*[-|]\s*ChatGPT\s*$/i, "").trim() || "conversation-export";
  }

  function extractConversationFromDom() {
    const articleSelectors = [
      "[data-testid^='conversation-turn-']",
      "article[data-testid]",
      "article",
      "[data-message-author-role]"
    ];

    const candidates = [];
    for (const selector of articleSelectors) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length) {
        candidates.push(...found);
      }
      if (candidates.length >= 2) {
        break;
      }
    }

    const uniqueCandidates = Array.from(new Set(candidates)).filter((element) => {
      const role =
        element.getAttribute("data-message-author-role") ||
        element.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role") ||
        "";
      return /^(user|assistant)$/i.test(role) || element.matches("[data-testid^='conversation-turn-']");
    });

    const turns = [];
    for (const element of uniqueCandidates) {
      const role =
        element.getAttribute("data-message-author-role") ||
        element.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role") ||
        "";
      const normalizedRole = role.toLowerCase();
      if (!["user", "assistant"].includes(normalizedRole)) {
        continue;
      }

      const contentRoot =
        element.querySelector(".markdown") ||
        element.querySelector("[class*='markdown']") ||
        element.querySelector("[data-message-author-role]") ||
        element;
      const text = extractTextFromElement(contentRoot);
      if (!text) {
        continue;
      }

      turns.push({ role: normalizedRole, text });
    }

    if (!turns.length) {
      return null;
    }

    const mapping = {};
    let previousId = null;
    turns.forEach((turn, index) => {
      const id = `dom-turn-${index}`;
      mapping[id] = {
        id,
        parent: previousId,
        children: [],
        message: {
          id,
          author: { role: turn.role },
          content: {
            content_type: "text",
            parts: [turn.text]
          }
        }
      };
      if (previousId && mapping[previousId]) {
        mapping[previousId].children.push(id);
      }
      previousId = id;
    });

    return {
      title: getConversationTitle(),
      conversation_id: getConversationId(),
      current_node: previousId,
      mapping
    };
  }

  function handlePossibleNavigation() {
    const nextConversationId = window.location.pathname;
    if (nextConversationId === activeConversationId) {
      return;
    }

    activeConversationId = nextConversationId;
    resetOverlayState("Conversation changed. Preview cleared.");
  }

  function installNavigationTracking() {
    if (!window.__convoExporterNavPatched) {
      window.__convoExporterNavPatched = true;

      const wrapHistoryMethod = (methodName) => {
        const original = history[methodName];
        history[methodName] = function wrappedHistoryMethod(...args) {
          const result = original.apply(this, args);
          window.dispatchEvent(new Event("convo-exporter:navigation"));
          return result;
        };
      };

      wrapHistoryMethod("pushState");
      wrapHistoryMethod("replaceState");
      window.addEventListener("popstate", () => {
        window.dispatchEvent(new Event("convo-exporter:navigation"));
      });
    }

    window.addEventListener("convo-exporter:navigation", handlePossibleNavigation);
  }

  function getCookieValue(name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function getAuthContext() {
    const response = await fetch(`${window.location.origin}/api/auth/session`, {
      credentials: "include",
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Session fetch failed (${response.status}): ${errorText}`);
    }

    const session = await response.json();
    const accessToken =
      session?.accessToken ??
      session?.access_token ??
      session?.user?.accessToken ??
      session?.user?.access_token ??
      "";

    if (!accessToken) {
      throw new Error("Session access token not found.");
    }

    const accountId =
      session?.account?.id ||
      session?.accountId ||
      session?.account_id ||
      getCookieValue("_account") ||
      "";

    return { accessToken, accountId };
  }

  async function fetchConversationFromApi(conversationId) {
    if (!conversationId) {
      throw new Error("Open a specific ChatGPT conversation first.");
    }

    const { accessToken, accountId } = await getAuthContext();
    const deviceId = getCookieValue("oai-did");
    const language = getCookieValue("oai-locale") || navigator.language || "en-US";
    const targetPath = `/backend-api/conversation/${conversationId}`;

    const headers = {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "oai-device-id": deviceId,
      "oai-language": language,
      "x-openai-target-path": targetPath,
      "x-openai-target-route": "/backend-api/conversation/{conversation_id}"
    };

    if (accountId) {
      headers["chatgpt-account-id"] = accountId;
    }

    const response = await fetch(
      `${window.location.origin}${targetPath}`,
      {
        credentials: "include",
        headers
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

    const sources = [
      async () => ({
        conversationJson: await fetchConversationFromApi(conversationId),
        source: "backend-api"
      }),
      async () => {
        const pageStateMatch =
          findConversationInWindow(conversationId) ||
          findConversationInScripts(conversationId) ||
          findConversationInStorage(window.sessionStorage, conversationId) ||
          findConversationInStorage(window.localStorage, conversationId);

        if (!pageStateMatch) {
          throw new Error("Conversation not found in page state.");
        }

        return {
          conversationJson: pageStateMatch,
          source: "page-state"
        };
      },
      async () => {
        const domMatch = extractConversationFromDom();
        if (!domMatch) {
          throw new Error("Conversation not found in DOM.");
        }

        return {
          conversationJson: domMatch,
          source: "dom"
        };
      }
    ];

    const errors = [];
    const candidates = [];
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const loadSource = sources[sourceIndex];
      try {
        const result = await loadSource();
        const parsed = parser.parseConversationJson(JSON.stringify(result.conversationJson));
        candidates.push({
          ...result,
          sourceIndex,
          turnsCount: parsed.turns.length
        });
      } catch (error) {
        errors.push(error?.message || String(error));
      }
    }

    if (!candidates.length) {
      throw new Error(`Unable to load the conversation. ${errors.join(" ")}`.trim());
    }

    candidates.sort(
      (left, right) => right.turnsCount - left.turnsCount || left.sourceIndex - right.sourceIndex
    );
    const bestCandidate = candidates[0];

    return {
      conversationJson: bestCandidate.conversationJson,
      source: bestCandidate.source,
      sourceErrors: errors,
      sourceCandidates: candidates.map(({ source, turnsCount }) => ({ source, turnsCount }))
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
    link.download = `${parser.sanitizeFilenamePart(filename, "conversation-export")}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function buildFromCurrentChat() {
    const { conversationJson, source, sourceErrors, sourceCandidates } =
      await resolveConversationJson();
    const parsed = parser.parseConversationJson(
      JSON.stringify(conversationJson),
      assistantInput.value.trim() || "Assistant",
      userInput.value.trim() || "User",
      getSelectedFormat()
    );

    const mappingCount =
      conversationJson?.mapping && typeof conversationJson.mapping === "object"
        ? Object.keys(conversationJson.mapping).length
        : 0;
    const messageCount = Array.isArray(conversationJson?.messages) ? conversationJson.messages.length : 0;

    return {
      ...parsed,
      source,
      debug: {
        source,
        mappingCount,
        messageCount,
        turnsCount: parsed.turns.length,
        currentNode: conversationJson?.current_node || "n/a",
        sourceErrors,
        sourceCandidates
      }
    };
  }

  root.querySelector("#ce-close").addEventListener("click", () => {
    root.style.display = "none";
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      root.style.display = "none";
    }
  });

  installNavigationTracking();

  root.querySelector("#ce-preview").addEventListener("click", async () => {
    try {
      setStatus("Loading preview...");
      const { formattedText, source, debug } = await buildFromCurrentChat();
      previewOutput.value = formattedText;
      setDebugInfo([
        `Debug source: ${debug.source}`,
        `Turns exported: ${debug.turnsCount}`,
        `Mapping nodes: ${debug.mappingCount}`,
        `Messages array length: ${debug.messageCount}`,
        `Current node: ${debug.currentNode}`,
        `Candidates: ${debug.sourceCandidates
          .map((candidate) => `${candidate.source}=${candidate.turnsCount}`)
          .join(" | ")}`,
        `Fallbacks: ${debug.sourceErrors.length ? debug.sourceErrors.join(" | ") : "none"}`
      ]);
      setStatus(`Preview updated from ${source}.`);
    } catch (error) {
      setDebugInfo([`Debug error: ${error.message || "Unknown error"}`]);
      setStatus(error.message || "Failed to preview the current chat.", true);
    }
  });

  root.querySelector("#ce-export").addEventListener("click", async () => {
    try {
      setStatus("Exporting current chat...");
      const { formattedText, parsedJson, source, debug } = await buildFromCurrentChat();
      previewOutput.value = formattedText;
      setDebugInfo([
        `Debug source: ${debug.source}`,
        `Turns exported: ${debug.turnsCount}`,
        `Mapping nodes: ${debug.mappingCount}`,
        `Messages array length: ${debug.messageCount}`,
        `Current node: ${debug.currentNode}`,
        `Candidates: ${debug.sourceCandidates
          .map((candidate) => `${candidate.source}=${candidate.turnsCount}`)
          .join(" | ")}`,
        `Fallbacks: ${debug.sourceErrors.length ? debug.sourceErrors.join(" | ") : "none"}`
      ]);
      downloadText(formattedText, parsedJson?.title || getConversationTitle());
      setStatus(`Export started from ${source}.`);
    } catch (error) {
      setDebugInfo([`Debug error: ${error.message || "Unknown error"}`]);
      setStatus(error.message || "Failed to export the current chat.", true);
    }
  });
})();
