# Conversation Exporter

A Chrome extension that:

- accepts pasted conversation JSON
- extracts `user` and `assistant` turns
- formats each message as:

```md
**Assistant:**
assistant message

***

**User:**
user message
```

- exports the result as `.txt` or `.md`

## Load the extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select `/Users/evigalar/convo_exporter`

## Notes

The parser currently supports a few common JSON shapes, including:

- top-level arrays of messages
- `{ "messages": [...] }`
- `{ "conversation": { "messages": [...] } }`
- mappings where messages live under `mapping`

If your source JSON uses a different structure, provide one sample and the parser can be tightened around it.
