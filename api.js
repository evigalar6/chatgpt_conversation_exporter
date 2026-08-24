(function (globalScope) {
  function getMessageId(message) {
    return String(message?.id ?? message?.message?.id ?? "").trim();
  }

  function getMessageTime(message) {
    const value = Number(message?.create_time ?? message?.message?.create_time);
    return Number.isFinite(value) ? value : null;
  }

  function getActiveMappingMessages(conversation) {
    const mapping = conversation?.mapping;
    if (!mapping || typeof mapping !== "object") {
      return [];
    }

    const nodes = [];
    const seen = new Set();
    let nodeId = conversation.current_node;

    while (nodeId && mapping[nodeId] && !seen.has(nodeId)) {
      seen.add(nodeId);
      nodes.push(mapping[nodeId]);
      nodeId = mapping[nodeId].parent;
    }

    return nodes
      .reverse()
      .map((node) => node?.message)
      .filter(Boolean);
  }

  function getInitialMessages(conversation) {
    const candidates = [
      conversation?.messages,
      conversation?.linear_conversation,
      getActiveMappingMessages(conversation)
    ].filter(Array.isArray);

    return candidates.sort((left, right) => right.length - left.length)[0] || [];
  }

  function getOldestMessageId(messages) {
    let oldestId = "";
    let oldestTime = Infinity;

    for (const message of messages) {
      const id = getMessageId(message);
      if (!id) {
        continue;
      }

      const time = getMessageTime(message);
      if (time !== null && time < oldestTime) {
        oldestId = id;
        oldestTime = time;
      } else if (!oldestId) {
        oldestId = id;
      }
    }

    return oldestId;
  }

  function mergeMessages(messageArrays) {
    const uniqueMessages = [];
    const seenIds = new Set();

    for (const messages of messageArrays) {
      for (const message of messages) {
        const id = getMessageId(message);
        if (id && seenIds.has(id)) {
          continue;
        }
        if (id) {
          seenIds.add(id);
        }
        uniqueMessages.push({ message, position: uniqueMessages.length });
      }
    }

    uniqueMessages.sort((left, right) => {
      const leftTime = getMessageTime(left.message);
      const rightTime = getMessageTime(right.message);

      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (leftTime !== null && rightTime === null) {
        return -1;
      }
      if (leftTime === null && rightTime !== null) {
        return 1;
      }
      return left.position - right.position;
    });

    return uniqueMessages.map(({ message }) => message);
  }

  function getPageMessages(page) {
    if (Array.isArray(page?.messages)) {
      return page.messages;
    }
    if (Array.isArray(page?.data?.messages)) {
      return page.data.messages;
    }
    return [];
  }

  async function collectConversationPages({
    initialConversation,
    fetchPage,
    maxPages = 2000,
    onProgress
  }) {
    const initialMessages = getInitialMessages(initialConversation);
    const messageArrays = [initialMessages];
    const knownIds = new Set(initialMessages.map(getMessageId).filter(Boolean));
    const seenCursors = new Set();
    let cursor = getOldestMessageId(initialMessages);
    let pagesFetched = 0;
    let complete = !cursor;

    while (cursor && pagesFetched < maxPages && !seenCursors.has(cursor)) {
      seenCursors.add(cursor);
      const page = await fetchPage(cursor);
      pagesFetched += 1;
      const pageMessages = getPageMessages(page);

      if (!pageMessages.length) {
        complete = true;
        break;
      }

      const newMessages = pageMessages.filter((message) => {
        const id = getMessageId(message);
        if (id && knownIds.has(id)) {
          return false;
        }
        if (id) {
          knownIds.add(id);
        }
        return true;
      });

      if (!newMessages.length) {
        complete = true;
        break;
      }

      messageArrays.push(newMessages);
      onProgress?.({ pagesFetched, messagesFetched: knownIds.size });

      const nextCursor = getOldestMessageId(pageMessages);
      if (!nextCursor || seenCursors.has(nextCursor)) {
        complete = true;
        break;
      }
      cursor = nextCursor;
    }

    if (!complete) {
      throw new Error(`Conversation pagination exceeded the ${maxPages}-page safety limit.`);
    }

    return {
      conversationJson: {
        ...initialConversation,
        messages: mergeMessages(messageArrays)
      },
      pagesFetched
    };
  }

  const api = {
    collectConversationPages,
    getActiveMappingMessages,
    getInitialMessages,
    getOldestMessageId,
    mergeMessages
  };

  globalScope.__conversationExporterApi = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
