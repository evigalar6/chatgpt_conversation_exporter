const assert = require("node:assert/strict");
const test = require("node:test");

const api = require("../api.js");

function message(id, createTime, role = "user") {
  return {
    id,
    create_time: createTime,
    author: { role },
    content: { content_type: "text", parts: [id] }
  };
}

test("walks backward through every conversation page", async () => {
  const initialConversation = {
    current_node: "m6",
    mapping: {
      m5: { id: "m5", parent: "m4", message: message("m5", 5) },
      m6: { id: "m6", parent: "m5", message: message("m6", 6, "assistant") }
    }
  };
  const requestedCursors = [];
  const pages = {
    m5: { messages: [message("m3", 3), message("m4", 4, "assistant")] },
    m3: { messages: [message("m1", 1), message("m2", 2, "assistant")] },
    m1: { messages: [] }
  };

  const result = await api.collectConversationPages({
    initialConversation,
    fetchPage: async (cursor) => {
      requestedCursors.push(cursor);
      return pages[cursor];
    }
  });

  assert.deepEqual(requestedCursors, ["m5", "m3", "m1"]);
  assert.equal(result.pagesFetched, 3);
  assert.deepEqual(result.conversationJson.messages.map(({ id }) => id), [
    "m1",
    "m2",
    "m3",
    "m4",
    "m5",
    "m6"
  ]);
});

test("deduplicates overlapping paging boundaries", async () => {
  const result = await api.collectConversationPages({
    initialConversation: { messages: [message("m3", 3), message("m4", 4)] },
    fetchPage: async (cursor) =>
      cursor === "m3"
        ? { messages: [message("m1", 1), message("m2", 2), message("m3", 3)] }
        : { messages: [] }
  });

  assert.deepEqual(result.conversationJson.messages.map(({ id }) => id), [
    "m1",
    "m2",
    "m3",
    "m4"
  ]);
});

test("rejects a paging loop instead of exporting a silent partial result", async () => {
  await assert.rejects(
    api.collectConversationPages({
      initialConversation: { messages: [message("m2", 2)] },
      fetchPage: async () => ({ messages: [message("m1", 1)] }),
      maxPages: 1
    }),
    /safety limit/
  );
});
