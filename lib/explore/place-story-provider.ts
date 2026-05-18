import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Buffer } from "node:buffer";

import type { RoutePlaceStoryRoutePoint } from "~/lib/db/queries/route-place-story";
import type { PlaceIntelligence } from "~/lib/explore/place-intelligence";
import type { PlaceStoryRequest, PlaceStorySourceSupport } from "~/lib/explore/place-story";

import { findCommunityPlaceSignal } from "~/lib/db/queries/place-intelligence";
import env from "~/lib/env";
import { buildPlaceIntelligence } from "~/lib/explore/place-intelligence";
import { fetchGooglePlaceIntelligence } from "~/lib/explore/place-intelligence-providers";
import { createPlaceStoryAudioUrl, createPlaceStoryCacheKey } from "~/lib/explore/place-story";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const PLACE_STORY_AUDIO_PREFIX = "place-stories";
const PROVIDER_USER_AGENT = "WanderLog/1.0";

export type GeneratedPlaceStoryAudio = {
  audioBytes: Buffer;
  contentType: string;
  sourceSupport: PlaceStorySourceSupport;
};

export class PlaceStoryProviderError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = "PlaceStoryProviderError";
    this.code = code;
  }
}

export async function buildPlaceIntelligenceForStory(point: RoutePlaceStoryRoutePoint): Promise<PlaceIntelligence> {
  const [providerResult, community] = await Promise.all([
    fetchGooglePlaceIntelligence({
      lat: point.lat,
      long: point.long,
      name: point.name,
    }),
    findCommunityPlaceSignal({
      lat: point.lat,
      long: point.long,
      name: point.name,
    }),
  ]);

  return buildPlaceIntelligence({
    community,
    coordinates: {
      lat: point.lat,
      long: point.long,
    },
    day: point.day,
    id: point.routePointId,
    name: point.name,
    provider: providerResult.data ?? null,
    route: {
      estimatedPriceLevel: parseRoutePriceLevel(point.estimatedPriceLevel),
      priceConfidence: parseConfidence(point.priceConfidence),
      priceSource: point.priceSource ?? undefined,
      rationale: point.rationale,
    },
  });
}

export function evaluatePlaceStorySupport(place: PlaceIntelligence): PlaceStorySourceSupport {
  const signals = [
    place.aiSummary
      ? {
          key: "ai_summary",
          label: "Provider place summary",
          source: place.aiSummary.summarySource,
        }
      : null,
    place.rating
      ? {
          key: "rating",
          label: "Provider rating",
          source: place.rating.source,
        }
      : null,
    ...place.reviews.slice(0, 2).map(review => ({
      key: "review",
      label: "Sourced review snippet",
      source: review.source,
    })),
    place.routeRationale
      ? {
          key: "route_context",
          label: "Route rationale",
          source: {
            confidence: "medium" as const,
            kind: "route" as const,
            label: "AI route context",
          },
        }
      : null,
  ].filter((signal): signal is NonNullable<typeof signal> => Boolean(signal));

  const hasProviderFacts = Boolean(place.aiSummary || place.rating || place.reviews.length > 0);
  const supported = hasProviderFacts && Boolean(place.routeRationale);

  return {
    confidence: supported && signals.length >= 3 ? "medium" : "low",
    signals,
    supported,
    unavailableReason: supported ? undefined : "insufficient_place_facts",
  };
}

export async function generatePlaceStoryAudio(place: PlaceIntelligence): Promise<GeneratedPlaceStoryAudio> {
  const sourceSupport = evaluatePlaceStorySupport(place);
  if (!sourceSupport.supported)
    throw new PlaceStoryProviderError("insufficient_place_facts");

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    throw new PlaceStoryProviderError("missing_tts_api_key");

  const response = await fetch(`${getOpenAiBaseUrl()}/audio/speech`, {
    body: JSON.stringify({
      input: createPlaceStoryNarrationInput(place),
      model: env.OPENAI_TTS_MODEL,
      response_format: "mp3",
      voice: env.OPENAI_TTS_VOICE,
    }),
    headers: {
      "Accept": "audio/mpeg",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": PROVIDER_USER_AGENT,
    },
    method: "POST",
  });

  if (!response.ok)
    throw new PlaceStoryProviderError("tts_provider_failed");

  return {
    audioBytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    sourceSupport,
  };
}

export async function savePlaceStoryAudioObject(input: {
  audioBytes: Buffer;
  contentType: string;
  key: string;
  routePointId: string;
  sessionId: number;
  userId: number;
  variantId: number;
}) {
  const client = createPlaceStoryS3Client();
  await client.send(new PutObjectCommand({
    Body: input.audioBytes,
    Bucket: env.S3_BUCKET,
    ContentLength: input.audioBytes.byteLength,
    ContentType: input.contentType,
    Key: input.key,
    Metadata: {
      "route-point-id": input.routePointId,
      "session-id": String(input.sessionId),
      "user-id": String(input.userId),
      "variant-id": String(input.variantId),
    },
  }));
}

export async function readPlaceStoryAudioObject(key: string) {
  const client = createPlaceStoryS3Client();
  const response = await client.send(new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  }));

  if (!response.Body)
    throw new PlaceStoryProviderError("audio_not_found");

  return {
    audioBytes: await readS3Body(response.Body),
    contentType: response.ContentType || "audio/mpeg",
  };
}

export function createPlaceStoryAudioObjectKey(userId: number, input: PlaceStoryRequest) {
  return [
    PLACE_STORY_AUDIO_PREFIX,
    userId,
    input.sessionId,
    input.variantId,
    `${sanitizeKeyPart(input.routePointId)}.mp3`,
  ].join("/");
}

export function createAvailableAudioMetadata(input: {
  byteLength: number;
  contentType: string;
  generatedAt?: number | null;
  request: PlaceStoryRequest;
}) {
  return {
    byteLength: input.byteLength,
    cacheKey: createPlaceStoryCacheKey(input.request),
    contentType: input.contentType,
    durationSeconds: null,
    generatedAt: input.generatedAt ?? Date.now(),
    url: createPlaceStoryAudioUrl(input.request),
  };
}

function createPlaceStoryNarrationInput(place: PlaceIntelligence) {
  return [
    `Create a concise warm audio guide for ${place.name}.`,
    "Length target: 60 to 120 seconds.",
    "Use only the sourced place facts and route context below.",
    "Do not invent history, quotes, opening hours, or claims not supported by the facts.",
    `Route day: ${place.day ?? "unknown"}.`,
    place.routeRationale ? `Route context: ${place.routeRationale}` : "",
    place.aiSummary ? `Provider summary: ${place.aiSummary.text}` : "",
    place.rating ? `Rating signal: ${place.rating.value}/${place.rating.scale}` : "",
    ...place.reviews.map(review => `Review signal: ${review.text}`),
    place.cost ? `Cost signal: ${place.cost.label}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getOpenAiBaseUrl() {
  return (env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

function createPlaceStoryS3Client() {
  return new S3Client({
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: true,
    region: env.S3_REGION,
    signingRegion: env.S3_REGION,
  });
}

async function readS3Body(body: unknown): Promise<Buffer> {
  if (typeof body === "object" && body && "transformToByteArray" in body) {
    const byteArray = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(byteArray);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function sanitizeKeyPart(input: string) {
  return input.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "place";
}

function parseConfidence(value: string | null | undefined) {
  if (value === "low" || value === "medium" || value === "high")
    return value;

  return undefined;
}

function parseRoutePriceLevel(value: string | null | undefined) {
  if (value === "free" || value === "low" || value === "medium" || value === "high" || value === "unknown")
    return value;

  return undefined;
}
