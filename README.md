# Conversation Exporter

A Chrome extension that:

- opens an in-page exporter on ChatGPT conversations
- extracts `user` and `assistant` turns from the current conversation
- formats each message as:

```md
**Assistant:**
assistant message

***

**User:**
user message
```

- exports the result as `.txt` or `.md`

## Usage

1. Open a ChatGPT conversation.
2. Click the extension button.
3. Click `Open Exporter On Current Page`.
4. Use the in-page exporter to preview or export the conversation.

## Load the extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the extracted or cloned extension folder

## Notes

The parser currently supports a few common JSON shapes, including:

- top-level arrays of messages
- `{ "messages": [...] }`
- `{ "conversation": { "messages": [...] } }`
- mappings where messages live under `mapping`

If your source JSON uses a different structure, provide one sample and the parser can be tightened around it.
