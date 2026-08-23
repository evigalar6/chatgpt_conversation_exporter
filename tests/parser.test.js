const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const parserSource = fs.readFileSync(
  path.join(__dirname, "..", "parser.js"),
  "utf8"
);
const context = {};
vm.createContext(context);
vm.runInContext(parserSource, context, { filename: "parser.js" });
const parser = context.__conversationExporterParser;

function parse(input, assistantName = "Assistant", userName = "User", format = "md") {
  return parser.parseConversationJson(
    JSON.stringify(input),
    assistantName,
    userName,
    format
  );
}

test("extracts a basic messages array", () => {
  const result = parse({
    messages: [
      { role: "system", content: "internal prompt" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" }
    ]
  });

  assert.deepEqual(
    Array.from(result.turns, ({ role, text }) => ({ role, text })),
    [
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hi there" }
    ]
  );
});

test("follows current_node and excludes alternate mapping branches", () => {
  const result = parse({
    current_node: "assistant-active",
    mapping: {
      root: { id: "root", parent: null, message: null },
      user: {
        id: "user",
        parent: "root",
        message: {
          author: { role: "user" },
          content: { content_type: "text", parts: ["Question"] }
        }
      },
      "assistant-active": {
        id: "assistant-active",
        parent: "user",
        message: {
          author: { role: "assistant" },
          content: { content_type: "text", parts: ["Selected answer"] }
        }
      },
      "assistant-alternate": {
        id: "assistant-alternate",
        parent: "user",
        message: {
          author: { role: "assistant" },
          content: { content_type: "text", parts: ["Old alternate answer"] }
        }
      }
    }
  });

  assert.deepEqual(
    Array.from(result.turns, ({ role, text }) => ({ role, text })),
    [
      { role: "user", text: "Question" },
      { role: "assistant", text: "Selected answer" }
    ]
  );
});

test("omits visually hidden messages and image-only parts", () => {
  const result = parse({
    messages: [
      {
        role: "user",
        metadata: { is_visually_hidden_from_conversation: true },
        content: "hidden"
      },
      {
        role: "user",
        content: {
          content_type: "multimodal_text",
          parts: [
            { content_type: "image_asset_pointer", asset_pointer: "file-service://example" },
            "Describe this image"
          ]
        }
      },
      { role: "assistant", content: "A description" }
    ]
  });

  assert.deepEqual(
    Array.from(result.turns, ({ role, text }) => ({ role, text })),
    [
      { role: "user", text: "Describe this image" },
      { role: "assistant", text: "A description" }
    ]
  );
});

test("formats Markdown and plain text differently", () => {
  const input = {
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" }
    ]
  };

  assert.equal(
    parse(input, "Bot", "Val", "md").formattedText,
    "**Val:**\nHello\n\n***\n\n**Bot:**\nHi"
  );
  assert.equal(
    parse(input, "Bot", "Val", "txt").formattedText,
    "Val:\nHello\n\n--------------------\n\nBot:\nHi"
  );
});

test("sanitizes filenames and rejects invalid input", () => {
  assert.equal(parser.sanitizeFilenamePart('  A/B: C*?  ', "fallback"), "A B C");
  assert.equal(parser.sanitizeFilenamePart("", "fallback"), "fallback");
  assert.throws(() => parser.parseConversationJson("{"), /JSON is invalid/);
  assert.throws(
    () => parser.parseConversationJson('{"messages":[]}'),
    /No user or assistant messages/
  );
});
