import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import db from "~/lib/db";
import { aiRouteSession, aiRouteVariant, location, locationLog, user } from "~/lib/db/schema";

type GlobalSearchItemKind = "place" | "route" | "user";

type GlobalSearchItem = {
  description: string | null;
  icon: string;
  id: string;
  kind: GlobalSearchItemKind;
  meta: string;
  title: string;
  to: string;
};

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).default(4),
  q: z.string().trim().max(80).default(""),
});

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event));

  if (!parsed.success) {
    return sendError(event, createError({
      statusCode: 400,
      statusMessage: "Invalid search query",
    }));
  }

  const normalizedQuery = parsed.data.q.trim().toLowerCase();
  const limit = parsed.data.limit;

  if (!normalizedQuery) {
    return createSearchResponse("", {
      places: [],
      routes: [],
      users: [],
    });
  }

  const searchableQuery = normalizedQuery.replace(/[%_]/g, "").trim();

  if (!searchableQuery) {
    return createSearchResponse(normalizedQuery, {
      places: [],
      routes: [],
      users: [],
    });
  }

  const pattern = `%${searchableQuery}%`;
  const currentUserId = event.context.user?.id;
  const [places, routes, users] = await Promise.all([
    currentUserId ? searchPlaces(currentUserId, pattern, limit) : [],
    currentUserId ? searchRoutes(currentUserId, pattern, limit) : [],
    searchUsers(pattern, limit),
  ]);

  return createSearchResponse(normalizedQuery, {
    places,
    routes,
    users,
  });
});

function createSearchResponse(
  query: string,
  input: {
    places: GlobalSearchItem[];
    routes: GlobalSearchItem[];
    users: GlobalSearchItem[];
  },
) {
  return {
    cta: {
      description: "Откройте Explore и соберите персональный план поездки",
      icon: "tabler:sparkles",
      title: "Сгенерировать маршрут",
      to: "/explore",
    },
    groups: [
      { key: "places", label: "Места", items: input.places },
      { key: "users", label: "Пользователи", items: input.users },
      { key: "routes", label: "Маршруты", items: input.routes },
    ],
    query,
  };
}

async function searchPlaces(userId: number, pattern: string, limit: number): Promise<GlobalSearchItem[]> {
  const savedPlaces = await db
    .select({
      description: location.description,
      id: location.id,
      name: location.name,
      slug: location.slug,
      updateAt: location.updateAt,
    })
    .from(location)
    .where(and(
      eq(location.userId, userId),
      or(
        sql`lower(${location.name}) like ${pattern}`,
        sql`lower(coalesce(${location.description}, '')) like ${pattern}`,
      ),
    ))
    .orderBy(desc(location.updateAt))
    .limit(limit);

  const diaryStops = await db
    .select({
      description: locationLog.description,
      id: locationLog.id,
      locationName: location.name,
      name: locationLog.name,
      slug: location.slug,
      startedAt: locationLog.startedAt,
    })
    .from(locationLog)
    .innerJoin(location, eq(locationLog.locationId, location.id))
    .where(and(
      eq(locationLog.userId, userId),
      or(
        sql`lower(${locationLog.name}) like ${pattern}`,
        sql`lower(coalesce(${locationLog.description}, '')) like ${pattern}`,
      ),
    ))
    .orderBy(desc(locationLog.startedAt))
    .limit(limit);

  return [
    ...savedPlaces.map(place => ({
      description: place.description,
      icon: "tabler:map-pin",
      id: `place:${place.id}`,
      kind: "place" as const,
      meta: "Место в дневнике",
      title: place.name,
      to: `/dashboard/location/${place.slug}`,
    })),
    ...diaryStops.map(stop => ({
      description: stop.description,
      icon: "tabler:flag",
      id: `stop:${stop.id}`,
      kind: "place" as const,
      meta: stop.locationName,
      title: stop.name,
      to: `/dashboard/location/${stop.slug}/${stop.id}`,
    })),
  ].slice(0, limit);
}

async function searchRoutes(userId: number, pattern: string, limit: number): Promise<GlobalSearchItem[]> {
  const rows = await db
    .select({
      cityName: aiRouteSession.cityName,
      sessionId: aiRouteSession.id,
      status: aiRouteSession.status,
      summary: aiRouteVariant.summary,
      title: aiRouteVariant.title,
      updateAt: aiRouteSession.updateAt,
    })
    .from(aiRouteSession)
    .leftJoin(aiRouteVariant, eq(aiRouteSession.activeVariantId, aiRouteVariant.id))
    .where(and(
      eq(aiRouteSession.userId, userId),
      or(
        sql`lower(coalesce(${aiRouteSession.cityName}, '')) like ${pattern}`,
        sql`lower(coalesce(${aiRouteVariant.title}, '')) like ${pattern}`,
        sql`lower(coalesce(${aiRouteVariant.summary}, '')) like ${pattern}`,
      ),
    ))
    .orderBy(desc(aiRouteSession.updateAt))
    .limit(limit);

  return rows.map(route => ({
    description: route.summary,
    icon: "tabler:route",
    id: `route:${route.sessionId}`,
    kind: "route" as const,
    meta: route.cityName ? `${route.cityName} · ${route.status}` : route.status,
    title: route.title || (route.cityName ? `Маршрут по ${route.cityName}` : `Маршрут #${route.sessionId}`),
    to: `/explore?sessionId=${route.sessionId}`,
  }));
}

async function searchUsers(pattern: string, limit: number): Promise<GlobalSearchItem[]> {
  const rows = await db
    .select({
      id: user.id,
      image: user.image,
      name: user.name,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(sql`lower(${user.name}) like ${pattern}`)
    .orderBy(desc(user.updatedAt))
    .limit(limit);

  return rows.map(foundUser => ({
    description: null,
    icon: foundUser.image || "tabler:user-circle",
    id: `user:${foundUser.id}`,
    kind: "user" as const,
    meta: "Путешественник",
    title: foundUser.name,
    to: `/feed?author=${foundUser.id}`,
  }));
}
