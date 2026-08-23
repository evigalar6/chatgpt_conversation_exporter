(() => {
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

function isHiddenMessage(candidate) {
  const metadata = candidate?.metadata ?? candidate?.message?.metadata;

  return Boolean(
    metadata?.is_visually_hidden_from_conversation ||
      metadata?.is_user_system_message ||
      metadata?.is_contextual_answers_system_message
  );
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

function getConversationPathFromMapping(input) {
  if (!input?.mapping || typeof input.mapping !== "object") {
    return [];
  }

  const path = [];
  const seen = new Set();
  let currentNodeId = input.current_node;

  while (currentNodeId && input.mapping[currentNodeId] && !seen.has(currentNodeId)) {
    seen.add(currentNodeId);
    path.push(input.mapping[currentNodeId]);
    currentNodeId = input.mapping[currentNodeId].parent;
  }

  return path.reverse();
}

function getSortedMappingMessages(input) {
  if (!input?.mapping || typeof input.mapping !== "object") {
    return [];
  }

  return Object.values(input.mapping).sort((left, right) => {
    const leftTime = Number(left?.message?.create_time ?? left?.create_time ?? 0);
    const rightTime = Number(right?.message?.create_time ?? right?.create_time ?? 0);

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
  });
}

function getCandidateMessageArrays(input) {
  const candidates = [];

  if (Array.isArray(input)) {
    candidates.push(input);
  }

  const candidateArrays = [
    input?.messages,
    input?.conversation,
    input?.conversation?.messages,
    input?.data?.messages,
    input?.data?.conversation?.messages,
    input?.linear_conversation,
    input?.conversation?.linear_conversation,
    input?.data?.linear_conversation
  ];

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      candidates.push(candidate);
    }
  }

  const mappingPath = getConversationPathFromMapping(input);
  if (mappingPath.length) {
    candidates.push(mappingPath);
  }

  const mappingMessages = getSortedMappingMessages(input);
  if (mappingMessages.length) {
    candidates.push(mappingMessages);
  }

  return candidates;
}

function scoreTurns(turns) {
  return turns.reduce((total, turn) => total + turn.text.length, 0) + turns.length * 1000;
}

function extractTurnsFromMessages(rawMessages) {
  const turns = [];

  for (const rawMessage of rawMessages) {
    if (isHiddenMessage(rawMessage)) {
      continue;
    }

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

function extractTurns(parsedJson) {
  const currentPath = getConversationPathFromMapping(parsedJson);
  if (currentPath.length) {
    const currentPathTurns = extractTurnsFromMessages(currentPath);
    if (currentPathTurns.length) {
      return currentPathTurns;
    }
  }

  const candidateArrays = getCandidateMessageArrays(parsedJson);
  let bestTurns = [];
  let bestScore = -1;

  for (const candidate of candidateArrays) {
    const turns = extractTurnsFromMessages(candidate);
    const score = scoreTurns(turns);

    if (score > bestScore) {
      bestTurns = turns;
      bestScore = score;
    }
  }

  return bestTurns;
}

function formatTurns(turns, assistantName, userName, format = "md") {
  const isPlainText = String(format).toLowerCase() === "txt";
  const separator = isPlainText ? "--------------------" : "***";

  return turns
    .map((turn) => {
      const speaker = turn.role === "assistant" ? assistantName : userName;
      const heading = isPlainText ? `${speaker}:` : `**${speaker}:**`;
      return `${heading}\n${turn.text}`;
    })
    .join(`\n\n${separator}\n\n`);
}

function parseConversationJson(
  rawJson,
  assistantName = "Assistant",
  userName = "User",
  format = "md"
) {
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
    formattedText: formatTurns(turns, assistantName, userName, format),
    parsedJson,
    turns
  };
}

function sanitizeFilenamePart(value, fallback) {
  const safeValue = String(value || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeValue || fallback;
}

globalThis.__conversationExporterParser = Object.freeze({
  parseConversationJson,
  sanitizeFilenamePart
});
})();
