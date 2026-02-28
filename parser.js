function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").trim();
}

function extractTextParts(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractTextParts);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  if (value.content_type === "image_asset_pointer") {
    return [];
  }

  const directTextKeys = ["text", "value", "body"];
  const parts = [];

  for (const key of directTextKeys) {
    if (typeof value[key] === "string") {
      parts.push(value[key]);
    }
  }

  if (Array.isArray(value.parts)) {
    parts.push(...value.parts.flatMap(extractTextParts));
  }

  if (typeof value.content === "string") {
    parts.push(value.content);
  }

  if (Array.isArray(value.content)) {
    parts.push(...value.content.flatMap(extractTextParts));
  }

  if (Array.isArray(value.messages)) {
    parts.push(...value.messages.flatMap(extractTextParts));
  }

  if (typeof value.message === "object") {
    parts.push(...extractTextParts(value.message));
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (typeof value.input_text === "string") {
    parts.push(value.input_text);
  }

  if (typeof value.transcript === "string") {
    parts.push(value.transcript);
  }

  return parts;
}

function getRole(candidate) {
  const rawRole =
    candidate?.role ??
    candidate?.author?.role ??
    candidate?.message?.author?.role ??
    candidate?.speaker ??
    candidate?.type ??
    "";

  if (typeof rawRole !== "string") {
    return "";
  }

  return rawRole.toLowerCase();
}

function getMessageText(candidate) {
  const sources = [
    candidate?.text,
    candidate?.content,
    candidate?.message?.content,
    candidate?.message,
    candidate?.parts,
    candidate?.body
  ];

  const text = sources
    .flatMap(extractTextParts)
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");

  return normalizeText(text);
}

function flattenConversation(input) {
  if (input?.mapping && typeof input.mapping === "object") {
    const path = [];
    let currentNodeId = input.current_node;

    while (currentNodeId && input.mapping[currentNodeId]) {
      path.push(input.mapping[currentNodeId]);
      currentNodeId = input.mapping[currentNodeId].parent;
    }

    return path.reverse();
  }

  if (Array.isArray(input)) {
    return input;
  }

  const candidateArrays = [
    input?.messages,
    input?.conversation,
    input?.conversation?.messages,
    input?.data?.messages,
    input?.data?.conversation?.messages
  ];

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (input?.mapping && typeof input.mapping === "object") {
    return Object.values(input.mapping);
  }

  return [];
}

function extractTurns(parsedJson) {
  const rawMessages = flattenConversation(parsedJson);
  const turns = [];

  for (const rawMessage of rawMessages) {
    const role = getRole(rawMessage);
    const contentType =
      rawMessage?.content?.content_type ??
      rawMessage?.message?.content?.content_type ??
      "";
    const text = getMessageText(rawMessage);

    if (!text) {
      continue;
    }

    if (
      contentType &&
      !["text", "multimodal_text"].includes(String(contentType).toLowerCase())
    ) {
      continue;
    }

    if (role.includes("assistant")) {
      turns.push({ role: "assistant", text });
      continue;
    }

    if (role.includes("user") || role.includes("human")) {
      turns.push({ role: "user", text });
    }
  }

  return turns;
}

function formatTurns(turns, assistantName, userName) {
  return turns
    .map((turn) => {
      const speaker = turn.role === "assistant" ? assistantName : userName;
      return `**${speaker}:**\n${turn.text}`;
    })
    .join("\n\n***\n\n");
}

function parseConversationJson(rawJson, assistantName = "Kai", userName = "Val") {
  if (!rawJson) {
    throw new Error("Load a conversation JSON first.");
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch (_error) {
    throw new Error("The JSON is invalid.");
  }

  const turns = extractTurns(parsedJson);
  if (!turns.length) {
    throw new Error("No user or assistant messages were found in this JSON shape.");
  }

  return {
    formattedText: formatTurns(turns, assistantName, userName),
    parsedJson
  };
}

function sanitizeFilenamePart(value, fallback) {
  const safeValue = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeValue || fallback;
}
