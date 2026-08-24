<div align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Conversation Exporter icon">
  <h1>ChatGPT Conversation Exporter</h1>
  <p>Export the conversation you are viewing as clean Markdown or plain text.</p>
</div>

## What it does

- Exports the active path of the current ChatGPT conversation (alternate branches are excluded).
- Keeps user and assistant messages in their on-screen order.
- Preserves common formatting such as paragraphs, lists, links, code blocks, quotes, and tables.
- Lets you rename the `User` and `Assistant` speakers before exporting.
- Adds the per-message `model_slug` to the assistant name when ChatGPT provides it.
- Provides a preview before saving an `.md` or `.txt` file.
- Runs locally in your browser and sends nothing to a third-party server.

## Install

This repository contains an unpacked Chrome extension. There is no build step.

### Option A: download the ZIP

1. On this GitHub page, select **Code → Download ZIP**.
2. Extract the downloaded archive to a permanent folder. Chrome needs that folder to remain available.
3. Open `chrome://extensions` in Chrome.
4. Turn on **Developer mode** in the top-right corner.
5. Select **Load unpacked**.
6. Choose the extracted folder containing `manifest.json`.
7. Optional: pin **ChatGPT Conversation Exporter** from Chrome's Extensions menu.

### Option B: clone with Git

```bash
git clone https://github.com/evigalar6/chatgpt_conversation_exporter.git
```

Then open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the cloned `chatgpt_conversation_exporter` folder.

The same unpacked-extension flow also works in Chromium-based Microsoft Edge at `edge://extensions`.

## Use

1. Sign in to [ChatGPT](https://chatgpt.com/) and open a saved conversation. Its address should contain `/c/` followed by the conversation ID.
2. Select the extension icon, then **Open Exporter On Current Page**.
3. In the panel that appears:
   - optionally change the assistant and user names;
   - choose **MD** or **TXT**;
   - select **Preview Current Chat** to inspect the result;
   - select **Export Current Chat** to download it.
4. Close the panel with **Close** or the <kbd>Esc</kbd> key.

### Markdown output

```md
**User:**
Hello!

***

**Assistant:**
Hi — how can I help?
```

### Plain-text output

```text
User:
Hello!

--------------------

Assistant:
Hi — how can I help?
```

## Permissions and privacy

The extension requests only:

- `activeTab` — temporary access to the tab where you explicitly open the extension;
- `scripting` — permission to open the exporter panel on that tab.

It does not request permanent access to your browsing history or every website. Conversation data is read from the current ChatGPT page, formatted in the browser, and downloaded directly to your device. No analytics or external data service is included.

## How extraction works

The extension checks three available sources:

1. the paginated conversation responses available to the signed-in ChatGPT page;
2. conversation data already present in the page state;
3. visible message content in the page as a fallback.

The primary source is loaded page by page until ChatGPT returns no older messages. The exporter deduplicates overlapping page boundaries, compares the number of usable turns from every available source, and exports the most complete result instead of trusting the first successful response. The **Diagnostics** section shows the turn count for each candidate and the number of API pages loaded.

For branched chats, the `current_node` chain is followed so only the branch currently selected in ChatGPT is exported. Image-only message parts and internal or visually hidden messages are omitted.

## Troubleshooting

**“Open a specific ChatGPT conversation first.”**

Open a saved chat whose URL looks like `https://chatgpt.com/c/...`; the home page and temporary/new-chat pages do not have a conversation ID to export.

**The extension panel does not open.**

Refresh the ChatGPT tab, confirm the extension is enabled at `chrome://extensions`, and try again. Chrome blocks extensions on browser-owned pages such as `chrome://...`.

**Some messages are missing.**

Wait for the conversation to finish loading, reopen the exporter, and inspect **Diagnostics** in the panel. ChatGPT is a frequently changing web app, so its internal response or page structure may occasionally require an extension update.

**Changes from a new pull are not visible.**

Go to `chrome://extensions`, select **Reload** on the extension card, then refresh the ChatGPT tab.

## Development

The extension uses plain JavaScript, HTML, and CSS. Node.js 20 or newer is needed only for the automated checks; there are no npm dependencies.

```bash
npm test
npm run check
```

`npm test` runs parser regression tests. `npm run check` additionally syntax-checks every JavaScript entry point.

Key files:

- `manifest.json` — Manifest V3 metadata and permissions
- `popup.html`, `popup.css`, `popup.js` — extension popup
- `overlay.js` — in-page exporter and ChatGPT extraction fallbacks
- `api.js` — authenticated conversation pagination and page merging
- `parser.js` — conversation-shape parsing and output formatting
- `tests/` — dependency-free Node.js regression tests

## Current limitations

- Only user and assistant text turns are exported; images and other binary attachments are not embedded.
- Rich formatting recovered from the visible page is best-effort.
- The extension relies on ChatGPT's current page behavior, which can change without notice.

This is an independent utility and is not affiliated with or endorsed by OpenAI.
