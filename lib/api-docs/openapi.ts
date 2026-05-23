type OpenApiMethod = "get" | "post" | "put" | "patch" | "delete";

type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema: Record<string, unknown>;
};

type OpenApiOperation = {
  tags: string[];
  summary: string;
  description?: string;
  operationId: string;
  security?: Array<Record<string, string[]>>;
  parameters?: OpenApiParameter[];
  requestBody?: Record<string, unknown>;
  responses: Record<string, Record<string, unknown>>;
};

type OpenApiDocument = {
  openapi: "3.0.3";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  security: Array<Record<string, string[]>>;
  tags: Array<{
    name: string;
    description: string;
  }>;
  components: Record<string, unknown>;
  paths: Record<string, Partial<Record<OpenApiMethod, OpenApiOperation>>>;
};

const publicEndpoint: [] = [];

function pathParam(name: string, description: string): OpenApiParameter {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string" },
  };
}

function intPathParam(name: string, description: string): OpenApiParameter {
  return {
    ...pathParam(name, description),
    schema: { type: "integer", minimum: 1 },
  };
}

function queryParam(name: string, description: string, schema: Record<string, unknown> = { type: "string" }, required = false): OpenApiParameter {
  return {
    name,
    in: "query",
    required,
    description,
    schema,
  };
}

function jsonContent(schema: Record<string, unknown>) {
  return {
    "application/json": {
      schema,
    },
  };
}

function jsonBody(description: string, schema: Record<string, unknown>, required = true) {
  return {
    required,
    description,
    content: jsonContent(schema),
  };
}

function response(description: string, content?: Record<string, unknown>) {
  return {
    description,
    ...(content ? { content } : {}),
  };
}

function ok(schema: Record<string, unknown>, description = "Successful response") {
  return response(description, jsonContent(schema));
}

function created(schema: Record<string, unknown>, description = "Created") {
  return response(description, jsonContent(schema));
}

const noContent = () => response("No content");

function arrayOf(schema: Record<string, unknown>) {
  return {
    type: "array",
    items: schema,
  };
}

function objectSchema(description = "JSON object") {
  return {
    type: "object",
    description,
    additionalProperties: true,
  };
}

const problemResponses = {
  400: response("Invalid request", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
  401: response("Authentication required", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
  403: response("Forbidden", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
  404: response("Resource not found", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
  422: response("Validation failed", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
  500: response("Unexpected server error", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
};

export const openApiSpec: OpenApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "WanderLog API",
    version: "1.0.0",
    description: "HTTP API для дневника путешествий WanderLog, ленты, AI-генерации маршрутов, режима Explore, фото мест, уведомлений и админского мониторинга.",
  },
  servers: [
    {
      url: "/",
      description: "Текущий сервер Nuxt",
    },
  ],
  security: [
    {
      cookieAuth: [],
    },
  ],
  tags: [
    { name: "Auth", description: "Эндпоинты сессии и профиля." },
    { name: "Explore", description: "Поиск городов, контекст маршрута, кандидаты мест, погодные советы и истории мест." },
    { name: "AI Routes", description: "Потоковая генерация маршрутов и сохранённые сессии маршрутов." },
    { name: "Locations", description: "Личные места путешествий, записи дневника и изображения записей." },
    { name: "Feed", description: "Публичные посты ленты, комментарии, лайки и публикация изображений пользователя." },
    { name: "Place Photos", description: "Съёмка фото мест путешественником и публичный слой на карте." },
    { name: "Notifications", description: "Web push-подписки генерации маршрутов и события статуса." },
    { name: "Admin", description: "Админский мониторинг генерации маршрутов." },
    { name: "Diagnostics", description: "Вспомогательные эндпоинты разработки и мониторинга." },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: "Cookie сессии Better Auth. Браузер автоматически добавляет её после входа.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 401 },
          statusMessage: { type: "string", example: "Unauthorized" },
          message: { type: "string" },
        },
      },
      Coordinates: {
        type: "object",
        required: ["lat", "long"],
        properties: {
          lat: { type: "number", minimum: -90, maximum: 90 },
          long: { type: "number", minimum: -180, maximum: 180 },
        },
      },
      Location: {
        type: "object",
        properties: {
          id: { type: "integer" },
          userId: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          lat: { type: "number" },
          long: { type: "number" },
        },
      },
      LocationLog: {
        type: "object",
        properties: {
          id: { type: "integer" },
          locationId: { type: "integer" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          startedAt: { type: "integer" },
          endedAt: { type: "integer" },
        },
      },
      FeedPost: {
        type: "object",
        properties: {
          id: { type: "integer" },
          caption: { type: "string", nullable: true },
          createdAt: { type: "integer" },
          likedByCurrentUser: { type: "boolean" },
          user: { $ref: "#/components/schemas/PublicUser" },
          image: { $ref: "#/components/schemas/PublicImage" },
        },
      },
      PublicUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", nullable: true },
          image: { type: "string", nullable: true },
        },
      },
      PublicImage: {
        type: "object",
        properties: {
          id: { type: "integer" },
          url: { type: "string" },
          alt: { type: "string", nullable: true },
        },
      },
      PublicFeedGlobePost: {
        type: "object",
        description: "Public feed photo post for the Mapbox globe. Contains only safe public photo, place, author display, date, and exact public coordinates; no private diary text, raw storage keys, email, provider internals, or route context.",
        required: ["id", "createdAt", "image", "place", "author"],
        properties: {
          id: { type: "integer" },
          caption: { type: "string", nullable: true },
          createdAt: { type: "integer" },
          image: {
            type: "object",
            required: ["url", "alt"],
            properties: {
              url: { type: "string" },
              alt: { type: "string" },
            },
          },
          place: {
            type: "object",
            required: ["name", "lat", "long"],
            properties: {
              name: { type: "string" },
              lat: { type: "number", minimum: -90, maximum: 90 },
              long: { type: "number", minimum: -180, maximum: 180 },
            },
          },
          author: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              image: { type: "string", nullable: true },
            },
          },
        },
      },
      ExploreInterest: {
        type: "string",
        enum: ["culture", "food", "nature", "adventure", "art", "nightlife", "shopping", "family", "hidden-gems"],
      },
      ExploreCitySuggestion: {
        type: "object",
        properties: {
          id: { type: "string" },
          provider: { type: "string", enum: ["mapbox", "nominatim"] },
          providerId: { type: "string" },
          label: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          coordinates: { $ref: "#/components/schemas/Coordinates" },
        },
      },
      ExploreRequestContext: {
        type: "object",
        required: ["city", "selectedDays", "interests", "filters", "currentLocation", "selectedSavedPlaceIds", "selectedDiaryLogIds", "candidatePlaces"],
        properties: {
          city: { oneOf: [{ $ref: "#/components/schemas/ExploreCitySuggestion" }, { type: "null" }] },
          selectedDays: { type: "integer", minimum: 1, maximum: 14 },
          interests: { type: "array", items: { $ref: "#/components/schemas/ExploreInterest" }, maxItems: 12 },
          filters: {
            type: "object",
            required: ["query", "interests", "includeSavedPlaces", "includeCandidatePlaces"],
            properties: {
              query: { type: "string", maxLength: 200 },
              interests: { type: "array", items: { $ref: "#/components/schemas/ExploreInterest" }, maxItems: 12 },
              includeSavedPlaces: { type: "boolean" },
              includeCandidatePlaces: { type: "boolean" },
            },
          },
          currentLocation: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              coordinates: { $ref: "#/components/schemas/Coordinates" },
            },
          },
          selectedSavedPlaceIds: { type: "array", items: { type: "integer" }, maxItems: 50 },
          selectedDiaryLogIds: { type: "array", items: { type: "integer" }, maxItems: 50 },
          candidatePlaces: { type: "array", items: { $ref: "#/components/schemas/CandidatePlace" }, maxItems: 50 },
        },
      },
      CandidatePlace: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          coordinates: { $ref: "#/components/schemas/Coordinates" },
          categories: { type: "array", items: { $ref: "#/components/schemas/ExploreInterest" } },
          source: { type: "string", enum: ["provider", "saved", "diary", "fallback"] },
          selected: { type: "boolean" },
        },
      },
      RouteGenerationRequest: {
        type: "object",
        required: ["context"],
        properties: {
          context: { $ref: "#/components/schemas/ExploreRequestContext" },
          sessionId: { type: "integer", minimum: 1 },
          activeVariantId: { type: "integer", minimum: 1 },
          followUpMessage: { type: "string", minLength: 1, maxLength: 1000 },
        },
      },
      RouteEvent: {
        type: "object",
        description: "Payload Server-Sent Events, сериализованный строками `data: <json>`.",
        properties: {
          type: {
            type: "string",
            enum: ["route.session.created", "route.variant.started", "route.point.added", "route.point.updated", "route.variant.completed", "route.warning", "route.failed"],
          },
          sequence: { type: "integer", minimum: 0 },
          sessionId: { type: "integer" },
          variantId: { type: "integer" },
        },
      },
      RouteSession: objectSchema("Saved AI route generation session with variants, messages, and generated points."),
      RouteWeatherTips: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["available", "unavailable"] },
          summary: { type: "string" },
          tips: { type: "array", items: { $ref: "#/components/schemas/RouteWeatherTip" } },
        },
      },
      RouteWeatherTip: {
        type: "object",
        properties: {
          id: { type: "string" },
          severity: { type: "string", enum: ["info", "caution", "high"] },
          day: { type: "integer", minimum: 1, maximum: 14 },
          title: { type: "string" },
          body: { type: "string" },
          whatToTake: { type: "array", items: { type: "string" } },
        },
      },
      PlaceStory: {
        type: "object",
        properties: {
          routePointId: { type: "string" },
          status: { type: "string", enum: ["ready", "available", "unavailable", "generating", "failed"] },
          title: { type: "string" },
          sourceNote: { type: "string" },
          disclosure: { type: "string" },
          audio: { type: "object", nullable: true },
          failureCode: { type: "string", nullable: true },
        },
      },
      PlaceIntelligence: objectSchema("Aggregated place facts, source signals, real provider/app place media, missing-photo fallback, and confidence metadata."),
      PlacePhoto: objectSchema("Real place photo metadata from WanderLog public photos or configured providers; no AI-generated or illustrative photo fallback."),
      PushSubscriptionRequest: {
        type: "object",
        required: ["endpoint", "keys"],
        properties: {
          endpoint: { type: "string" },
          keys: {
            type: "object",
            required: ["p256dh", "auth"],
            properties: {
              p256dh: { type: "string" },
              auth: { type: "string" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/api/auth/profile": {
      get: {
        tags: ["Auth"],
        summary: "Get the current authenticated profile",
        operationId: "getAuthProfile",
        responses: {
          200: ok({ $ref: "#/components/schemas/PublicUser" }),
          401: problemResponses[401],
        },
      },
    },
    "/api/search-locations": {
      get: {
        tags: ["Locations"],
        summary: "Search saved locations",
        operationId: "searchLocations",
        parameters: [
          queryParam("q", "Search text", { type: "string", minLength: 1 }),
        ],
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/Location" })),
          401: problemResponses[401],
        },
      },
    },
    "/api/locations": {
      get: {
        tags: ["Locations"],
        summary: "List the current user's locations",
        operationId: "listLocations",
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/Location" })),
          401: problemResponses[401],
        },
      },
      post: {
        tags: ["Locations"],
        summary: "Create a location",
        operationId: "createLocation",
        requestBody: jsonBody("Location fields", objectSchema("Create location payload")),
        responses: {
          201: created({ $ref: "#/components/schemas/Location" }),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/locations/{slug}": {
      get: {
        tags: ["Locations"],
        summary: "Get a saved location with its diary logs",
        operationId: "getLocation",
        parameters: [pathParam("slug", "Location slug")],
        responses: {
          200: ok({ $ref: "#/components/schemas/Location" }),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
      put: {
        tags: ["Locations"],
        summary: "Update a saved location",
        operationId: "updateLocation",
        parameters: [pathParam("slug", "Location slug")],
        requestBody: jsonBody("Location update fields", objectSchema("Update location payload")),
        responses: {
          200: ok({ $ref: "#/components/schemas/Location" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
      delete: {
        tags: ["Locations"],
        summary: "Delete a saved location",
        operationId: "deleteLocation",
        parameters: [pathParam("slug", "Location slug")],
        responses: {
          204: noContent(),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/locations/{slug}/add": {
      post: {
        tags: ["Locations"],
        summary: "Add a diary log to a location",
        operationId: "addLocationLog",
        parameters: [pathParam("slug", "Location slug")],
        requestBody: jsonBody("Diary log fields", objectSchema("Create diary log payload")),
        responses: {
          201: created({ $ref: "#/components/schemas/LocationLog" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/locations/{slug}/{id}": {
      get: {
        tags: ["Locations"],
        summary: "Get a diary log",
        operationId: "getLocationLog",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id")],
        responses: {
          200: ok({ $ref: "#/components/schemas/LocationLog" }),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
      put: {
        tags: ["Locations"],
        summary: "Update a diary log",
        operationId: "updateLocationLog",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id")],
        requestBody: jsonBody("Diary log update fields", objectSchema("Update diary log payload")),
        responses: {
          200: ok({ $ref: "#/components/schemas/LocationLog" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
      delete: {
        tags: ["Locations"],
        summary: "Delete a diary log",
        operationId: "deleteLocationLog",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id")],
        responses: {
          204: noContent(),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/locations/{slug}/{id}/image": {
      post: {
        tags: ["Locations"],
        summary: "Attach an uploaded image to a diary log",
        operationId: "createLocationLogImage",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id")],
        requestBody: jsonBody("Image metadata", objectSchema("Uploaded image payload")),
        responses: {
          201: created({ $ref: "#/components/schemas/PublicImage" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/locations/{slug}/{id}/sign-images": {
      post: {
        tags: ["Locations"],
        summary: "Create signed upload targets for diary log images",
        operationId: "signLocationLogImages",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id")],
        requestBody: jsonBody("Files to sign", objectSchema("Image signing payload")),
        responses: {
          200: ok(objectSchema("Signed upload fields")),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/locations/{slug}/{id}/images/{imageId}": {
      delete: {
        tags: ["Locations"],
        summary: "Delete a diary log image",
        operationId: "deleteLocationLogImage",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id"), intPathParam("imageId", "Image id")],
        responses: {
          204: noContent(),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/locations/{slug}/{id}/images/{imageId}/visibility": {
      patch: {
        tags: ["Locations"],
        summary: "Update diary log image public visibility",
        operationId: "updateLocationLogImageVisibility",
        parameters: [pathParam("slug", "Location slug"), intPathParam("id", "Diary log id"), intPathParam("imageId", "Image id")],
        requestBody: jsonBody("Visibility setting", {
          type: "object",
          required: ["isPublic"],
          properties: {
            isPublic: { type: "boolean" },
          },
        }),
        responses: {
          200: ok({ $ref: "#/components/schemas/PublicImage" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/feed": {
      get: {
        tags: ["Feed"],
        summary: "List public feed posts",
        operationId: "listFeedPosts",
        security: publicEndpoint,
        parameters: [
          queryParam("cursor", "Cursor id for pagination", { type: "integer" }),
          queryParam("limit", "Page size", { type: "integer", minimum: 1, maximum: 50, default: 20 }),
        ],
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/FeedPost" })),
          400: problemResponses[400],
        },
      },
    },
    "/api/public/feed-globe": {
      get: {
        tags: ["Feed"],
        summary: "List public feed photo posts for the Mapbox globe",
        description: "Public read for the feed globe. Returns only intentionally public photo posts with exact public coordinates and popup-safe metadata. Private diary text, raw storage keys, emails, provider internals, and route context are excluded.",
        operationId: "listPublicFeedGlobePosts",
        security: publicEndpoint,
        parameters: [
          queryParam("limit", "Maximum number of public globe posts", { type: "integer", minimum: 1, maximum: 100, default: 100 }),
          queryParam("since", "Only return posts created after this timestamp", { type: "integer", minimum: 1 }),
        ],
        responses: {
          200: ok({
            type: "object",
            properties: {
              posts: arrayOf({ $ref: "#/components/schemas/PublicFeedGlobePost" }),
              nextSince: { type: "integer" },
            },
          }),
          422: problemResponses[422],
        },
      },
    },
    "/api/public/feed-globe/stream": {
      get: {
        tags: ["Feed"],
        summary: "Stream live public feed globe posts",
        description: "Server-Sent Events stream for live/near-live globe arrivals. Events contain the same safe public serializer as `/api/public/feed-globe`; clients should fall back to polling that endpoint when SSE is unavailable.",
        operationId: "streamPublicFeedGlobePosts",
        security: publicEndpoint,
        parameters: [
          queryParam("since", "Start streaming posts created after this timestamp", { type: "integer", minimum: 0, default: 0 }),
        ],
        responses: {
          200: response("Server-Sent Events stream of public feed globe batches", {
            "text/event-stream": {
              schema: {
                type: "string",
                description: "Each `data:` frame is JSON with `posts: PublicFeedGlobePost[]` and `nextSince`.",
              },
            },
          }),
          422: problemResponses[422],
        },
      },
    },
    "/api/posts": {
      post: {
        tags: ["Feed"],
        summary: "Publish an uploaded diary image to the feed",
        operationId: "createPost",
        requestBody: jsonBody("Post payload", {
          type: "object",
          required: ["locationLogImageId"],
          properties: {
            locationLogImageId: { type: "integer", minimum: 1 },
            caption: { type: "string", maxLength: 500 },
          },
        }),
        responses: {
          200: ok({ $ref: "#/components/schemas/FeedPost" }),
          401: problemResponses[401],
          409: response("Image already published", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
          422: problemResponses[422],
        },
      },
    },
    "/api/posts/my-images": {
      get: {
        tags: ["Feed"],
        summary: "List current user's images available for publishing",
        operationId: "listMyPostImages",
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/PublicImage" })),
          401: problemResponses[401],
        },
      },
    },
    "/api/posts/{id}": {
      delete: {
        tags: ["Feed"],
        summary: "Delete a feed post",
        operationId: "deletePost",
        parameters: [intPathParam("id", "Post id")],
        responses: {
          204: noContent(),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/posts/{id}/comments": {
      get: {
        tags: ["Feed"],
        summary: "List post comments",
        operationId: "listPostComments",
        security: publicEndpoint,
        parameters: [intPathParam("id", "Post id")],
        responses: {
          200: ok(arrayOf(objectSchema("Comment"))),
          404: problemResponses[404],
        },
      },
      post: {
        tags: ["Feed"],
        summary: "Create a post comment",
        operationId: "createPostComment",
        parameters: [intPathParam("id", "Post id")],
        requestBody: jsonBody("Comment payload", {
          type: "object",
          required: ["body"],
          properties: {
            body: { type: "string", minLength: 1, maxLength: 500 },
          },
        }),
        responses: {
          201: created(objectSchema("Comment")),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/posts/{id}/comments/{commentId}": {
      delete: {
        tags: ["Feed"],
        summary: "Delete a post comment",
        operationId: "deletePostComment",
        parameters: [intPathParam("id", "Post id"), intPathParam("commentId", "Comment id")],
        responses: {
          204: noContent(),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/posts/{id}/like": {
      post: {
        tags: ["Feed"],
        summary: "Like a post",
        operationId: "likePost",
        parameters: [intPathParam("id", "Post id")],
        responses: {
          200: ok(objectSchema("Like state")),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
      delete: {
        tags: ["Feed"],
        summary: "Remove a post like",
        operationId: "unlikePost",
        parameters: [intPathParam("id", "Post id")],
        responses: {
          200: ok(objectSchema("Like state")),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/explore/city-suggest": {
      get: {
        tags: ["Explore"],
        summary: "Suggest cities for Explore mode",
        operationId: "suggestExploreCities",
        parameters: [
          queryParam("q", "City search text", { type: "string", minLength: 2, maxLength: 120 }, true),
          queryParam("sessionToken", "Optional Mapbox search session token", { type: "string", minLength: 8, maxLength: 128 }),
        ],
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/ExploreCitySuggestion" })),
          401: problemResponses[401],
          504: response("Location provider unavailable", jsonContent({ $ref: "#/components/schemas/ErrorResponse" })),
        },
      },
    },
    "/api/explore/city-retrieve": {
      get: {
        tags: ["Explore"],
        summary: "Retrieve a selected city suggestion",
        operationId: "retrieveExploreCity",
        parameters: [
          queryParam("id", "Suggestion id", { type: "string" }, true),
          queryParam("sessionToken", "Optional search session token", { type: "string" }),
        ],
        responses: {
          200: ok({ $ref: "#/components/schemas/ExploreCitySuggestion" }),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/explore/context": {
      get: {
        tags: ["Explore"],
        summary: "Get saved place and diary context for Explore mode",
        operationId: "getExploreContext",
        responses: {
          200: ok(objectSchema("Saved place and diary context")),
          401: problemResponses[401],
        },
      },
    },
    "/api/explore/candidate-places": {
      get: {
        tags: ["Explore"],
        summary: "Find candidate places for a selected city and interests",
        operationId: "listExploreCandidatePlaces",
        parameters: [
          queryParam("city", "Selected city label or id", { type: "string" }),
          queryParam("interests", "Comma-separated Explore interests", { type: "string" }),
        ],
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/CandidatePlace" })),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/explore/weather-tips": {
      get: {
        tags: ["Explore"],
        summary: "Get weather-aware tips for a generated route",
        operationId: "getExploreWeatherTips",
        parameters: [
          queryParam("lat", "City latitude", { type: "number", minimum: -90, maximum: 90 }, true),
          queryParam("long", "City longitude", { type: "number", minimum: -180, maximum: 180 }, true),
          queryParam("selectedDays", "Route length in days", { type: "integer", minimum: 1, maximum: 14 }, true),
        ],
        responses: {
          200: ok({ $ref: "#/components/schemas/RouteWeatherTips" }),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/explore/place-intelligence": {
      get: {
        tags: ["Explore"],
        summary: "Get sourced intelligence for a route place",
        operationId: "getPlaceIntelligence",
        parameters: [
          queryParam("name", "Place name", { type: "string" }, true),
          queryParam("lat", "Place latitude", { type: "number" }),
          queryParam("long", "Place longitude", { type: "number" }),
        ],
        responses: {
          200: ok({ $ref: "#/components/schemas/PlaceIntelligence" }),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/explore/place-photo": {
      get: {
        tags: ["Explore"],
        summary: "Proxy a real provider place photo with fresh server-side provider references",
        description: "Streams configured provider media with short-lived cache behavior. Provider keys and references stay server-side, and missing photos are represented by place intelligence as an explicit missing-photo state.",
        operationId: "getExplorePlacePhoto",
        parameters: [
          queryParam("name", "Place name", { type: "string" }, true),
          queryParam("lat", "Place latitude", { type: "number" }),
          queryParam("long", "Place longitude", { type: "number" }),
        ],
        responses: {
          200: ok({ $ref: "#/components/schemas/PlacePhoto" }),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/explore/place-story": {
      get: {
        tags: ["Explore"],
        summary: "Get the current place story status",
        operationId: "getPlaceStory",
        parameters: [
          queryParam("sessionId", "Route session id", { type: "integer", minimum: 1 }, true),
          queryParam("variantId", "Route variant id", { type: "integer", minimum: 1 }, true),
          queryParam("routePointId", "Generated route point id", { type: "string" }, true),
        ],
        responses: {
          200: ok({ $ref: "#/components/schemas/PlaceStory" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/explore/place-story/generate": {
      post: {
        tags: ["Explore"],
        summary: "Generate AI narration for a route place",
        operationId: "generatePlaceStory",
        requestBody: jsonBody("Place story request", {
          type: "object",
          required: ["sessionId", "variantId", "routePointId"],
          properties: {
            sessionId: { type: "integer", minimum: 1 },
            variantId: { type: "integer", minimum: 1 },
            routePointId: { type: "string", minLength: 1, maxLength: 80 },
          },
        }),
        responses: {
          200: ok({ $ref: "#/components/schemas/PlaceStory" }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/explore/place-story/audio": {
      get: {
        tags: ["Explore"],
        summary: "Stream generated place story audio",
        operationId: "getPlaceStoryAudio",
        parameters: [
          queryParam("sessionId", "Route session id", { type: "integer", minimum: 1 }, true),
          queryParam("variantId", "Route variant id", { type: "integer", minimum: 1 }, true),
          queryParam("routePointId", "Generated route point id", { type: "string" }, true),
        ],
        responses: {
          200: response("Audio stream", {
            "audio/mpeg": {
              schema: {
                type: "string",
                format: "binary",
              },
            },
          }),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/ai/route": {
      post: {
        tags: ["AI Routes"],
        summary: "Generate or refine an AI route as a Server-Sent Events stream",
        operationId: "generateAiRoute",
        requestBody: jsonBody("Route generation request", { $ref: "#/components/schemas/RouteGenerationRequest" }),
        responses: {
          200: response("SSE stream of route generation events", {
            "text/event-stream": {
              schema: {
                type: "string",
                example: "event: route.point.added\ndata: {\"type\":\"route.point.added\",\"sequence\":2}\n\n",
              },
            },
          }),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
          500: problemResponses[500],
        },
      },
    },
    "/api/ai/route-sessions": {
      get: {
        tags: ["AI Routes"],
        summary: "List saved AI route sessions",
        operationId: "listAiRouteSessions",
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/RouteSession" })),
          401: problemResponses[401],
        },
      },
    },
    "/api/ai/route/{sessionId}": {
      get: {
        tags: ["AI Routes"],
        summary: "Restore a saved AI route session",
        operationId: "getAiRouteSession",
        parameters: [intPathParam("sessionId", "Route session id")],
        responses: {
          200: ok({ $ref: "#/components/schemas/RouteSession" }),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
      delete: {
        tags: ["AI Routes"],
        summary: "Delete a saved AI route session",
        operationId: "deleteAiRouteSession",
        parameters: [intPathParam("sessionId", "Route session id")],
        responses: {
          204: noContent(),
          401: problemResponses[401],
          404: problemResponses[404],
        },
      },
    },
    "/api/ai/route/{sessionId}/diary": {
      post: {
        tags: ["AI Routes"],
        summary: "Save a generated route variant to the travel diary",
        operationId: "saveAiRouteToDiary",
        parameters: [intPathParam("sessionId", "Route session id")],
        requestBody: jsonBody("Diary save request", objectSchema("Selected route variant and points to save")),
        responses: {
          200: ok(objectSchema("Diary save result")),
          401: problemResponses[401],
          404: problemResponses[404],
          422: problemResponses[422],
        },
      },
    },
    "/api/notifications/route-generation-subscription": {
      post: {
        tags: ["Notifications"],
        summary: "Register route generation push subscription",
        operationId: "createRouteGenerationSubscription",
        requestBody: jsonBody("Push subscription", { $ref: "#/components/schemas/PushSubscriptionRequest" }),
        responses: {
          200: ok(objectSchema("Subscription state")),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
      delete: {
        tags: ["Notifications"],
        summary: "Remove route generation push subscription",
        operationId: "deleteRouteGenerationSubscription",
        responses: {
          204: noContent(),
          401: problemResponses[401],
        },
      },
    },
    "/api/notifications/route-generation-status": {
      post: {
        tags: ["Notifications"],
        summary: "Update route generation notification status",
        operationId: "updateRouteGenerationStatus",
        requestBody: jsonBody("Обновление статуса", objectSchema("Payload статуса генерации маршрута")),
        responses: {
          200: ok(objectSchema("Status result")),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/place-photos/nearby-places": {
      get: {
        tags: ["Place Photos"],
        summary: "Find nearby places for traveler photo capture",
        operationId: "listNearbyPhotoPlaces",
        parameters: [
          queryParam("lat", "Current latitude", { type: "number", minimum: -90, maximum: 90 }, true),
          queryParam("long", "Current longitude", { type: "number", minimum: -180, maximum: 180 }, true),
        ],
        responses: {
          200: ok(arrayOf(objectSchema("Nearby place"))),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/place-photos/create-private": {
      post: {
        tags: ["Place Photos"],
        summary: "Create a private traveler place photo",
        operationId: "createPrivatePlacePhoto",
        requestBody: jsonBody("Private place photo payload", objectSchema("Place photo upload payload")),
        responses: {
          201: created({ $ref: "#/components/schemas/PlacePhoto" }),
          401: problemResponses[401],
          422: problemResponses[422],
        },
      },
    },
    "/api/public/place-photos": {
      get: {
        tags: ["Place Photos"],
        summary: "List public traveler place photos for map display",
        operationId: "listPublicPlacePhotos",
        security: publicEndpoint,
        parameters: [
          queryParam("bbox", "Bounding box as west,south,east,north", { type: "string" }),
          queryParam("limit", "Maximum number of photos", { type: "integer", minimum: 1, maximum: 100 }),
        ],
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/PlacePhoto" })),
          422: problemResponses[422],
        },
      },
    },
    "/api/admin/route-generations": {
      get: {
        tags: ["Admin"],
        summary: "List route generation sessions for admin observability",
        operationId: "adminListRouteGenerations",
        responses: {
          200: ok(arrayOf({ $ref: "#/components/schemas/RouteSession" })),
          401: problemResponses[401],
          403: problemResponses[403],
        },
      },
    },
    "/api/admin/route-generations/{sessionId}": {
      get: {
        tags: ["Admin"],
        summary: "Get route generation details for admin observability",
        operationId: "adminGetRouteGeneration",
        parameters: [intPathParam("sessionId", "Route session id")],
        responses: {
          200: ok({ $ref: "#/components/schemas/RouteSession" }),
          401: problemResponses[401],
          403: problemResponses[403],
          404: problemResponses[404],
        },
      },
    },
    "/api/sentry-example-api": {
      get: {
        tags: ["Diagnostics"],
        summary: "Trigger Sentry example API error",
        operationId: "triggerSentryExampleApi",
        responses: {
          500: problemResponses[500],
        },
      },
    },
  },
};
