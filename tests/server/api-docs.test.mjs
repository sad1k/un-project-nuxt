/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const openApiSource = await readFile("lib/api-docs/openapi.ts", "utf8");
const docsEndpointSource = await readFile("server/api/docs/index.get.ts", "utf8");
const openApiEndpointSource = await readFile("server/api/docs/openapi.get.ts", "utf8");

test("OpenAPI spec documents the main API groups", () => {
  for (const tag of [
    "Auth",
    "Explore",
    "AI Routes",
    "Locations",
    "Feed",
    "Place Photos",
    "Notifications",
    "Admin",
  ]) {
    assert.match(openApiSource, new RegExp(`name: "${tag}"`));
  }

  for (const path of [
    "/api/auth/profile",
    "/api/explore/city-suggest",
    "/api/explore/place-story/generate",
    "/api/ai/route",
    "/api/ai/route/{sessionId}/diary",
    "/api/locations/{slug}/{id}/images/{imageId}/visibility",
    "/api/feed",
    "/api/public/feed-globe",
    "/api/public/feed-globe/stream",
    "/api/posts/{id}/comments/{commentId}",
    "/api/place-photos/create-private",
    "/api/public/place-photos",
    "/api/notifications/route-generation-subscription",
    "/api/admin/route-generations/{sessionId}",
  ]) {
    assert.match(openApiSource, new RegExp(path.replace(/[{}]/g, "\\$&")));
  }
});

test("OpenAPI spec describes auth and public endpoints explicitly", () => {
  assert.match(openApiSource, /cookieAuth/);
  assert.match(openApiSource, /better-auth\.session_token/);
  assert.match(openApiSource, /const publicEndpoint: \[\] = \[\]/);
  assert.match(openApiSource, /"\/api\/feed"/);
  assert.match(openApiSource, /security: publicEndpoint/);
});

test("OpenAPI spec documents real place photo source and cache boundaries", () => {
  assert.match(openApiSource, /real provider\/app place media/);
  assert.match(openApiSource, /missing-photo fallback/);
  assert.match(openApiSource, /no AI-generated or illustrative photo fallback/);
  assert.match(openApiSource, /fresh server-side provider references/);
  assert.match(openApiSource, /short-lived cache/);
});

test("OpenAPI spec documents public feed globe and live stream privacy boundaries", () => {
  assert.match(openApiSource, /PublicFeedGlobePost/);
  assert.match(openApiSource, /List public feed photo posts for the Mapbox globe/);
  assert.match(openApiSource, /Stream live public feed globe posts/);
  assert.match(openApiSource, /text\/event-stream/);
  assert.match(openApiSource, /same safe public serializer as `\/api\/public\/feed-globe`/);
  assert.match(openApiSource, /Private diary text, raw storage keys, emails, provider internals, and route context are excluded/);
});

test("Swagger UI endpoint loads the generated OpenAPI document", () => {
  assert.match(openApiEndpointSource, /openApiSpec/);
  assert.match(openApiEndpointSource, /Cache-Control/);
  assert.match(docsEndpointSource, /swagger-ui-dist@5/);
  assert.match(docsEndpointSource, /url: "\/api\/docs\/openapi"/);
  assert.match(docsEndpointSource, /persistAuthorization: true/);
});
