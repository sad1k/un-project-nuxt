/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const providerSource = await readFile("lib/ai/openai-compatible.ts", "utf8");
const mockSource = await readFile("lib/ai/mock-route-stream.ts", "utf8");
const endpointSource = await readFile("server/api/ai/route.post.ts", "utf8");
const runnerSource = await readFile("lib/ai/route-generation-runner.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("OpenAI-compatible client exposes streaming parser and response fetch", () => {
  assert.match(providerSource, /fetchOpenAiCompatibleRouteStream/);
  assert.match(providerSource, /parseOpenAiSseLines/);
  assert.match(providerSource, /responses/);
  assert.match(providerSource, /stream: true/);
});

test("OpenAI-compatible client can target chat completions providers", () => {
  assert.match(envSource, /OPENAI_ROUTE_API/);
  assert.match(providerSource, /chat_completions/);
  assert.match(providerSource, /chat\/completions/);
  assert.match(providerSource, /messages:/);
  assert.match(providerSource, /getChatCompletionProviderOptions/);
  assert.match(providerSource, /isQwenHybridThinkingModel/);
  assert.match(providerSource, /enable_thinking: false/);
  assert.match(providerSource, /qwen3\.5-/);
  assert.match(providerSource, /choices/);
  assert.match(providerSource, /delta/);
  assert.match(providerSource, /message/);
});

test("OpenAI-compatible client can use OpenRouter Qwen route defaults", () => {
  assert.match(envSource, /"openrouter"/);
  assert.match(envSource, /OPENROUTER_API_KEY/);
  assert.match(envSource, /OPENROUTER_ROUTE_MODEL/);
  assert.match(providerSource, /https:\/\/openrouter\.ai\/api\/v1/);
  assert.match(providerSource, /qwen\/qwen3\.5-flash-02-23/);
  assert.match(providerSource, /missing_openrouter_api_key/);
  assert.match(providerSource, /OPENROUTER_API_KEY/);
  assert.match(providerSource, /OPENROUTER_ROUTE_MODEL/);
  assert.match(providerSource, /X-OpenRouter-Title/);
  assert.match(providerSource, /OPENROUTER_APP_TITLE/);
  assert.match(providerSource, /response_format/);
  assert.match(providerSource, /json_object/);
  assert.match(providerSource, /require_parameters/);
  assert.match(providerSource, /model\.startsWith\("qwen\/qwen3\.5-"\)/);
});

test("OpenAI-compatible client can use Cerebras provider defaults", () => {
  assert.match(envSource, /AI_ROUTE_PROVIDER/);
  assert.match(envSource, /CEREBRAS_API_KEY/);
  assert.match(envSource, /MISTRAL_API_KEY/);
  assert.match(envSource, /MISTRAL_ROUTE_MODEL/);
  assert.match(providerSource, /https:\/\/api\.cerebras\.ai\/v1/);
  assert.match(providerSource, /llama3\.1-8b/);
  assert.match(providerSource, /getProviderApiKey/);
  assert.match(providerSource, /missing_cerebras_api_key/);
  assert.match(providerSource, /provider_access_denied/);
  assert.match(providerSource, /return DEFAULT_CEREBRAS_BASE_URL/);
  assert.match(providerSource, /ProviderRequestError/);
  assert.match(providerSource, /providerBodyPreview/);
  assert.match(providerSource, /getRouteProviderDiagnostics/);
  assert.match(providerSource, /User-Agent/);
  assert.match(providerSource, /Accept/);
  assert.match(providerSource, /queue_exceeded/);
  assert.match(providerSource, /high traffic/);
  assert.match(providerSource, /provider_rate_limited/);
});

test("OpenAI-compatible client can use Mistral conversations defaults", () => {
  assert.match(envSource, /"mistral"/);
  assert.match(providerSource, /https:\/\/api\.mistral\.ai\/v1/);
  assert.match(providerSource, /mistral-medium-latest/);
  assert.match(providerSource, /MISTRAL_API_KEY/);
  assert.match(providerSource, /MISTRAL_ROUTE_MODEL/);
  assert.match(providerSource, /missing_mistral_api_key/);
  assert.match(providerSource, /env\.AI_ROUTE_PROVIDER === "mistral"/);
  assert.match(providerSource, /fetchMistralConversationRoute/);
  assert.match(providerSource, /beta\.conversations\.start/);
  assert.match(providerSource, /MISTRAL_ROUTE_MAX_TOKENS/);
  assert.match(providerSource, /maxTokens: MISTRAL_ROUTE_MAX_TOKENS/);
  assert.match(providerSource, /MISTRAL_ROUTE_TIMEOUT_MS/);
  assert.match(providerSource, /timeoutMs/);
  assert.match(providerSource, /responseFormat/);
  assert.match(providerSource, /json_object/);
  assert.match(providerSource, /extractMistralConversationText/);
  assert.match(providerSource, /shouldStreamProviderResponse/);
  assert.match(providerSource, /env\.AI_ROUTE_PROVIDER !== "mistral"/);
  assert.match(providerSource, /conversations/);
  assert.match(providerSource, /isProviderTimeoutMessage/);
  assert.match(providerSource, /provider_unavailable/);
});

test("provider parser handles multiple data events and done markers in source", () => {
  assert.match(providerSource, /split\(\/\\r\?\\n\\r\?\\n\/\)/);
  assert.match(providerSource, /\[DONE\]/);
  assert.match(providerSource, /JSON\.parse\(line\)/);
});

test("stream endpoint authenticates, validates, persists, and emits app route events", () => {
  assert.match(endpointSource, /defineAuthenticatedHandler/);
  assert.match(endpointSource, /event\.context\.user\.id/);
  assert.match(endpointSource, /RouteGenerationRequestSchema/);
  assert.match(endpointSource, /runRouteGeneration/);
  assert.match(runnerSource, /RouteEventEnvelopeSchema\.safeParse/);
  assert.match(runnerSource, /normalizeProviderRouteEvent/);
  assert.match(runnerSource, /normalizeProviderRouteCandidate/);
  assert.match(runnerSource, /extractProviderJsonText/);
  assert.match(runnerSource, /routePoints/);
  assert.match(runnerSource, /getProviderNestedPointArray/);
  assert.match(runnerSource, /getProviderDayArray/);
  assert.match(runnerSource, /dailyPlans/);
  assert.match(runnerSource, /extractEmbeddedProviderRouteCandidates/);
  assert.match(runnerSource, /extractJsonObjectLiterals/);
  assert.match(runnerSource, /isProviderRouteEventLike/);
  assert.match(runnerSource, /createPointAddedCandidate/);
  assert.match(runnerSource, /isFlatProviderRoutePointEvent/);
  assert.match(runnerSource, /stripProviderEventFields/);
  assert.match(runnerSource, /normalizeProviderPriceLevel/);
  assert.match(runnerSource, /normalizeProviderCoordinates/);
  assert.match(runnerSource, /getProviderPointName/);
  assert.match(runnerSource, /normalizeProviderRationale/);
  assert.match(runnerSource, /normalizeProviderAlternativeForPointId/);
  assert.match(runnerSource, /alternativeForPointId: normalizeProviderAlternativeForPointId\(point\.alternativeForPointId\)/);
  assert.match(runnerSource, /const estimatedPriceLevel = normalizeProviderPriceLevel/);
  assert.match(runnerSource, /estimatedPriceLevel,/);
  assert.match(runnerSource, /persistAiRouteEvent/);
  assert.match(runnerSource, /persistAiRoutePoint/);
  assert.match(runnerSource, /getRouteFailureMessage/);
  assert.match(runnerSource, /invalidProviderEventCount/);
  assert.match(runnerSource, /ai\.route_generation\.no_valid_route_points/);
  assert.match(runnerSource, /The route AI is busy right now/);
  assert.match(endpointSource, /text\/event-stream/);
});

test("stream endpoint supports server-side mock route events", () => {
  assert.match(envSource, /AI_ROUTE_MOCK_ENABLED/);
  assert.match(envSource, /toLowerCase\(\)/);
  assert.match(envSource, /trim\(\)/);
  assert.match(runnerSource, /AI_ROUTE_MOCK_ENABLED/);
  assert.match(runnerSource, /mockEnabled/);
  assert.match(runnerSource, /createMockAiRouteEventStream/);
  assert.match(mockSource, /route\.point\.added/);
  assert.match(mockSource, /route\.variant\.completed/);
  assert.match(mockSource, /MOCK_STREAM_DELAY_MS/);
});

test("OpenAI provider config stays server-only and diagnostic logs stay sanitized", () => {
  assert.doesNotMatch(providerSource, /runtimeConfig\.public/);
  assert.doesNotMatch(providerSource, /console\./);
  assert.doesNotMatch(endpointSource, /OPENAI_API_KEY/);
  assert.doesNotMatch(endpointSource, /CEREBRAS_API_KEY/);
  assert.doesNotMatch(endpointSource, /OPENAI_ROUTE_MODEL/);
  assert.match(runnerSource, /ai\.route_generation\.failed/);
  assert.match(runnerSource, /getRouteProviderDiagnostics/);
  assert.doesNotMatch(runnerSource, /providerBodyPreview/);
  assert.doesNotMatch(runnerSource, /Authorization/);
});
