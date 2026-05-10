import env from "~/lib/env";

export type OpenAiCompatibleRouteStreamInput = {
  instructions: string;
  input: unknown;
  temperature?: number;
};

export type ProviderStreamEvent = Record<string, unknown>;

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export async function* fetchOpenAiCompatibleRouteStream(
  input: OpenAiCompatibleRouteStreamInput,
): AsyncGenerator<ProviderStreamEvent> {
  if (!env.OPENAI_API_KEY)
    throw new Error("missing_openai_api_key");

  const response = await fetch(`${getOpenAiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_ROUTE_MODEL,
      instructions: input.instructions,
      input: input.input,
      stream: true,
      temperature: input.temperature ?? 0.3,
    }),
  });

  if (!response.ok || !response.body)
    throw new Error(sanitizeProviderError(response.status));

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;

    buffer += decoder.decode(value, { stream: true });
    const [ready, rest] = splitReadySseBlocks(buffer);
    buffer = rest;

    for (const event of parseOpenAiSseLines(ready))
      yield event;
  }

  const finalText = decoder.decode();
  if (finalText)
    buffer += finalText;

  for (const event of parseOpenAiSseLines(buffer))
    yield event;
}

export function parseOpenAiSseLines(input: string): ProviderStreamEvent[] {
  return input
    .split(/\r?\n\r?\n/)
    .flatMap(parseSseBlock)
    .filter((event): event is ProviderStreamEvent => Boolean(event));
}

export function sanitizeProviderError(status: number | string) {
  if (status === 401 || status === "missing_openai_api_key")
    return "provider_auth_failed";

  if (status === 429)
    return "provider_rate_limited";

  if (typeof status === "number" && status >= 500)
    return "provider_unavailable";

  return "provider_request_failed";
}

function getOpenAiBaseUrl() {
  return (env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

function splitReadySseBlocks(buffer: string): [string, string] {
  const separatorMatch = /\r?\n\r?\n/g;
  let lastSeparatorEnd = -1;
  let match = separatorMatch.exec(buffer);

  while (match) {
    lastSeparatorEnd = match.index + match[0].length;
    match = separatorMatch.exec(buffer);
  }

  if (lastSeparatorEnd === -1)
    return ["", buffer];

  return [buffer.slice(0, lastSeparatorEnd), buffer.slice(lastSeparatorEnd)];
}

function parseSseBlock(block: string): ProviderStreamEvent[] {
  const dataLines = block
    .split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice("data:".length).trim())
    .filter(Boolean);

  return dataLines.flatMap((line) => {
    if (line === "[DONE]")
      return [];

    try {
      const parsed = JSON.parse(line);
      return isRecord(parsed) ? [parsed] : [];
    }
    catch {
      return [];
    }
  });
}

function isRecord(input: unknown): input is ProviderStreamEvent {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
