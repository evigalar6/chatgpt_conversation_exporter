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

test("prefers a complete linear payload over a paged mapping path", () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    id: `message-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Turn ${index + 1}`
  }));
  const mapping = {};

  for (let index = 25; index < messages.length; index += 1) {
    const message = messages[index];
    mapping[message.id] = {
      id: message.id,
      parent: index === 25 ? "message-24" : `message-${index - 1}`,
      message: {
        author: { role: message.role },
        content: { content_type: "text", parts: [message.content] }
      }
    };
  }

  const result = parse({
    messages,
    current_node: "message-39",
    mapping
  });

  assert.equal(result.turns.length, 40);
  assert.equal(result.turns[0].text, "Turn 1");
  assert.equal(result.turns.at(-1).text, "Turn 40");
});

test("recovers older mapping nodes when the active path has a paging gap", () => {
  const mapping = {};

  for (let index = 0; index < 40; index += 1) {
    const id = `message-${index}`;
    mapping[id] = {
      id,
      parent:
        index === 0 ? null : index === 25 ? "unloaded-page-boundary" : `message-${index - 1}`,
      message: {
        create_time: index,
        author: { role: index % 2 === 0 ? "user" : "assistant" },
        content: { content_type: "text", parts: [`Turn ${index + 1}`] }
      }
    };
  }

  const result = parse({
    current_node: "message-39",
    mapping
  });

  assert.equal(result.turns.length, 40);
  assert.equal(result.turns[0].text, "Turn 1");
  assert.equal(result.turns.at(-1).text, "Turn 40");
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

test("appends the per-message model slug to assistant names when available", () => {
  const result = parse({
    messages: [
      { role: "user", content: "Hello" },
      {
        author: { role: "assistant" },
        content: { content_type: "text", parts: ["Hi"] },
        metadata: { model_slug: "gpt-5-6-thinking" }
      },
      {
        author: { role: "assistant" },
        content: { content_type: "text", parts: ["No model metadata"] }
      }
    ]
  }, "Kai", "Val");

  assert.equal(
    result.formattedText,
    "**Val:**\nHello\n\n***\n\n**Kai (gpt-5-6-thinking):**\nHi\n\n***\n\n**Kai:**\nNo model metadata"
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
