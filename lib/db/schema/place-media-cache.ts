import { int, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const placeMediaSourceValues = ["app", "google", "wikimedia", "foursquare"] as const;
export const placeMediaFailureCodeValues = [
  "app_photo_no_match",
  "provider_not_configured",
  "provider_no_match",
  "provider_unavailable",
  "open_provider_unavailable",
  "cache_unavailable",
] as const;

export const placeMediaCache = sqliteTable("placeMediaCache", {
  id: int().primaryKey({ autoIncrement: true }),
  placeKey: text().notNull(),
  source: text({ enum: placeMediaSourceValues }),
  providerPlaceId: text(),
  providerPhotoReference: text(),
  photoUrl: text(),
  alt: text(),
  attribution: text(),
  licenseHint: text(),
  termsHint: text(),
  expiresAt: int(),
  failedAt: int(),
  failureCode: text({ enum: placeMediaFailureCodeValues }),
  matchConfidence: text({ enum: ["low", "medium", "high"] }).notNull().default("low"),
  lat: real(),
  long: real(),
  createdAt: int().notNull().$default(() => Date.now()),
  updateAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
}, table => ({
  placeKeyIdx: uniqueIndex("place_media_cache_place_key_idx").on(table.placeKey),
}));

export type SelectPlaceMediaCache = typeof placeMediaCache.$inferSelect;
