import env from "~/lib/env";

export type OpenAiCompatibleRouteStreamInput = {
  instructions: string;
  input: unknown;
  temperature?: number;
};

export type ProviderStreamEvent = Record<string, unknown>;

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const DEFAULT_CEREBRAS_ROUTE_MODEL = "llama3.1-8b";
const DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_MISTRAL_ROUTE_MODEL = "mistral-medium-latest";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_ROUTE_MODEL = "qwen/qwen3.5-flash-02-23";
const MISTRAL_ROUTE_MAX_TOKENS = 8192;
const MISTRAL_ROUTE_TIMEOUT_MS = 120_000;
const PROVIDER_USER_AGENT = "WanderLog/1.0";
const OPENROUTER_APP_TITLE = "WanderLog";

export class ProviderRequestError extends Error {
  providerBodyPreview: string;
  providerContentType: string | null;
  providerStatus: number;
  providerStatusText: string;

  constructor(code: string, response: Response, bodyPreview: string) {
    super(code);
    this.name = "ProviderRequestError";
    this.providerBodyPreview = bodyPreview;
    this.providerContentType = response.headers.get("content-type");
    this.providerStatus = response.status;
    this.providerStatusText = response.statusText;
  }
}

export async function* fetchOpenAiCompatibleRouteStream(
  input: OpenAiCompatibleRouteStreamInput,
): AsyncGenerator<ProviderStreamEvent> {
  const apiKey = getProviderApiKey();
  if (!apiKey)
    throw new Error(getMissingApiKeyCode());

  if (env.AI_ROUTE_PROVIDER === "mistral") {
    const providerEvent = await fetchMistralConversationRoute(input, apiKey);
    if (providerEvent)
      yield providerEvent;
    return;
  }

  const response = await fetch(`${getOpenAiBaseUrl()}/${getOpenAiRoutePath()}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": PROVIDER_USER_AGENT,
      ...getProviderRequestHeaders(),
    },
    body: JSON.stringify(createProviderRequestBody(input, shouldStreamProviderResponse())),
  });

  if (!response.ok || !response.body) {
    const bodyPreview = await readProviderErrorBody(response);
    if (shouldRetryCerebrasWithPowerShell(response, bodyPreview)) {
      const providerEvent = await fetchCerebrasWithPowerShell(input, apiKey);
      if (providerEvent)
        yield providerEvent;
      return;
    }

    throw new ProviderRequestError(
      sanitizeProviderError(response.status),
      response,
      bodyPreview,
    );
  }

  if (!isEventStreamResponse(response)) {
    const providerEvent = await parseProviderJsonResponse(response);
    if (providerEvent)
      yield providerEvent;
    return;
  }

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
  if (typeof status === "string" && isProviderRateLimitMessage(status))
    return "provider_rate_limited";

  if (typeof status === "string" && isProviderTimeoutMessage(status))
    return "provider_unavailable";

  if (
    status === 401
    || status === "missing_openai_api_key"
    || status === "missing_cerebras_api_key"
    || status === "missing_mistral_api_key"
    || status === "missing_openrouter_api_key"
    || status === "provider_auth_failed"
  ) {
    return "provider_auth_failed";
  }

  if (status === 403 || status === "provider_access_denied")
    return "provider_access_denied";

  if (status === 429)
    return "provider_rate_limited";

  if (typeof status === "number" && status >= 500)
    return "provider_unavailable";

  return "provider_request_failed";
}

function isProviderRateLimitMessage(input: string) {
  const normalized = input.toLowerCase();
  return normalized.includes("queue_exceeded")
    || normalized.includes("too_many_requests")
    || normalized.includes("too many requests")
    || normalized.includes("high traffic")
    || normalized.includes("rate_limited");
}

function isProviderTimeoutMessage(input: string) {
  const normalized = input.toLowerCase();
  return normalized.includes("timeout")
    || normalized.includes("timed out")
    || normalized.includes("operation was aborted due to timeout")
    || normalized.includes("requesttimeouterror");
}

export function extractProviderTextDelta(input: Record<string, unknown>) {
  if (typeof input.delta === "string")
    return input.delta;

  if (typeof input.text === "string")
    return input.text;

  if (typeof input.output_text === "string")
    return input.output_text;

  return extractMistralConversationText(input) || extractChatCompletionText(input);
}

export function getRouteProviderDiagnostics() {
  return {
    providerBaseUrl: getOpenAiBaseUrl(),
    providerModel: getOpenAiRouteModel(),
    providerRouteApi: getOpenAiRouteApi(),
  };
}

function createProviderRequestBody(input: OpenAiCompatibleRouteStreamInput, stream: boolean) {
  if (getOpenAiRouteApi() === "chat_completions") {
    return {
      model: getOpenAiRouteModel(),
      messages: [
        { role: "system", content: input.instructions },
        { role: "user", content: JSON.stringify(input.input) },
      ],
      stream,
      temperature: input.temperature ?? 0.3,
      ...getChatCompletionProviderOptions(),
    };
  }

  return {
    model: getOpenAiRouteModel(),
    instructions: input.instructions,
    input: input.input,
    stream,
    temperature: input.temperature ?? 0.3,
  };
}

function shouldStreamProviderResponse() {
  return env.AI_ROUTE_PROVIDER !== "mistral";
}

function getOpenAiBaseUrl() {
  if (env.AI_ROUTE_PROVIDER === "cerebras")
    return DEFAULT_CEREBRAS_BASE_URL;

  if (env.AI_ROUTE_PROVIDER === "mistral")
    return DEFAULT_MISTRAL_BASE_URL;

  if (env.AI_ROUTE_PROVIDER === "openrouter")
    return DEFAULT_OPENROUTER_BASE_URL;

  return (env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

function getOpenAiRoutePath() {
  return getOpenAiRouteApi() === "chat_completions"
    ? "chat/completions"
    : "responses";
}

function getOpenAiRouteApi() {
  if (env.AI_ROUTE_PROVIDER === "mistral")
    return "conversations";

  return env.AI_ROUTE_PROVIDER === "cerebras" || env.AI_ROUTE_PROVIDER === "openrouter"
    ? "chat_completions"
    : env.OPENAI_ROUTE_API;
}

function getOpenAiRouteModel() {
  if (env.AI_ROUTE_PROVIDER === "cerebras" && env.OPENAI_ROUTE_MODEL === "gpt-5.1")
    return DEFAULT_CEREBRAS_ROUTE_MODEL;

  if (env.AI_ROUTE_PROVIDER === "mistral")
    return env.MISTRAL_ROUTE_MODEL?.trim() || DEFAULT_MISTRAL_ROUTE_MODEL;

  if (env.AI_ROUTE_PROVIDER === "openrouter")
    return env.OPENROUTER_ROUTE_MODEL?.trim() || DEFAULT_OPENROUTER_ROUTE_MODEL;

  return env.OPENAI_ROUTE_MODEL;
}

function getProviderRequestHeaders() {
  if (env.AI_ROUTE_PROVIDER === "openrouter") {
    return {
      "X-OpenRouter-Title": OPENROUTER_APP_TITLE,
    };
  }

  return {};
}

function getChatCompletionProviderOptions() {
  const model = getOpenAiRouteModel().toLowerCase();

  if (isQwenHybridThinkingModel(model)) {
    return {
      enable_thinking: false,
    };
  }

  return {};
}

function isQwenHybridThinkingModel(model: string) {
  return model.startsWith("qwen3.5-") || model.startsWith("qwen/qwen3.5-");
}

function getProviderApiKey() {
  const apiKey = getRouteProviderApiKey();

  return apiKey?.trim();
}

function getRouteProviderApiKey() {
  if (env.AI_ROUTE_PROVIDER === "cerebras")
    return env.CEREBRAS_API_KEY;

  if (env.AI_ROUTE_PROVIDER === "mistral")
    return env.MISTRAL_API_KEY;

  if (env.AI_ROUTE_PROVIDER === "openrouter")
    return env.OPENROUTER_API_KEY;

  return env.OPENAI_API_KEY;
}

function getMissingApiKeyCode() {
  if (env.AI_ROUTE_PROVIDER === "mistral")
    return "missing_mistral_api_key";

  if (env.AI_ROUTE_PROVIDER === "openrouter")
    return "missing_openrouter_api_key";

  return env.AI_ROUTE_PROVIDER === "cerebras"
    ? "missing_cerebras_api_key"
    : "missing_openai_api_key";
}

async function readProviderErrorBody(response: Response) {
  try {
    return sanitizeProviderBodyPreview(await response.clone().text());
  }
  catch (error) {
    return `Could not read provider error body: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function sanitizeProviderBodyPreview(input: string) {
  return input
    .replace(/csk-[\w-]+/g, "csk-***")
    .replace(/sk-[\w-]+/g, "sk-***")
    .slice(0, 1500);
}

function shouldRetryCerebrasWithPowerShell(response: Response, bodyPreview: string) {
  return env.AI_ROUTE_PROVIDER === "cerebras"
    && response.status === 403
    && bodyPreview.includes("Attention Required! | Cloudflare");
}

async function fetchCerebrasWithPowerShell(
  input: OpenAiCompatibleRouteStreamInput,
  apiKey: string,
) {
  const requestBody = JSON.stringify(createProviderRequestBody(input, false));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$headers = @{",
    "  Authorization = \"Bearer $env:CEREBRAS_API_KEY\"",
    "  Accept = 'application/json'",
    "  'Content-Type' = 'application/json'",
    `  'User-Agent' = '${PROVIDER_USER_AGENT}'`,
    "}",
    "$body = [Console]::In.ReadToEnd()",
    "$response = Invoke-RestMethod -Uri 'https://api.cerebras.ai/v1/chat/completions' -Method Post -Headers $headers -Body $body",
    "$response | ConvertTo-Json -Depth 50 -Compress",
  ].join("\n");

  const output = await runPowerShell(script, requestBody, apiKey);
  const parsed = parseJson(output);
  return isRecord(parsed) ? parsed : null;
}

async function fetchMistralConversationRoute(
  input: OpenAiCompatibleRouteStreamInput,
  apiKey: string,
) {
  const { Mistral } = await import("@mistralai/mistralai");
  const client = new Mistral({ apiKey });
  const response = await client.beta.conversations.start(
    {
      inputs: [
        {
          role: "user",
          content: JSON.stringify(input.input),
        },
      ],
      model: getOpenAiRouteModel(),
      instructions: input.instructions,
      completionArgs: {
        temperature: input.temperature ?? 0.3,
        maxTokens: MISTRAL_ROUTE_MAX_TOKENS,
        topP: 1,
        responseFormat: {
          type: "json_object",
        },
      },
      tools: [],
    },
    { timeoutMs: MISTRAL_ROUTE_TIMEOUT_MS },
  );

  return response as unknown as ProviderStreamEvent;
}

async function runPowerShell(script: string, input: string, cerebrasApiKey: string) {
  const { spawn } = await import("node:child_process");

  return new Promise<string>((resolve, reject) => {
    // eslint-disable-next-line node/no-process-env
    const envVars = { ...process.env, CEREBRAS_API_KEY: cerebrasApiKey };
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: envVars,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("cerebras_powershell_timeout"));
    }, 120_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => stdout += chunk);
    child.stderr.on("data", chunk => stderr += chunk);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`cerebras_powershell_failed:${sanitizeProviderBodyPreview(stderr || stdout)}`));
    });
    child.stdin.end(input);
  });
}

function parseJson(input: string) {
  try {
    return JSON.parse(input) as unknown;
  }
  catch {
    return null;
  }
}

function isEventStreamResponse(response: Response) {
  return response.headers.get("content-type")?.includes("text/event-stream") ?? false;
}

async function parseProviderJsonResponse(response: Response) {
  try {
    const parsed = await response.json();
    return isRecord(parsed) ? parsed : null;
  }
  catch {
    return null;
  }
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

function extractChatCompletionText(input: Record<string, unknown>) {
  if (!Array.isArray(input.choices))
    return "";

  return input.choices
    .map(extractChoiceText)
    .filter(Boolean)
    .join("");
}

function extractMistralConversationText(input: Record<string, unknown>) {
  if (!Array.isArray(input.outputs))
    return "";

  return input.outputs
    .map(extractMistralOutputText)
    .filter(Boolean)
    .join("");
}

function extractMistralOutputText(input: unknown) {
  if (!isRecord(input))
    return "";

  return extractContent(input);
}

function extractChoiceText(input: unknown) {
  if (!isRecord(input))
    return "";

  const deltaText = extractContent(input.delta);
  if (deltaText)
    return deltaText;

  return extractContent(input.message);
}

function extractContent(input: unknown) {
  if (!isRecord(input))
    return "";

  if (typeof input.content === "string")
    return input.content;

  if (!Array.isArray(input.content))
    return "";

  return input.content
    .map(extractContentChunkText)
    .filter(Boolean)
    .join("");
}

function extractContentChunkText(input: unknown) {
  if (!isRecord(input) || typeof input.text !== "string")
    return "";

  return input.text;
}
