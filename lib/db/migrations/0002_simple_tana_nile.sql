CREATE TABLE `aiRouteEvent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`sessionId` integer NOT NULL,
	`variantId` integer,
	`sequence` integer NOT NULL,
	`type` text NOT NULL,
	`payloadJson` text NOT NULL,
	`validationStatus` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `aiRouteSession`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `aiRouteMessage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`sessionId` integer NOT NULL,
	`role` text NOT NULL,
	`summary` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `aiRouteSession`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `aiRoutePoint` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`variantId` integer NOT NULL,
	`sequence` integer NOT NULL,
	`routePointId` text NOT NULL,
	`day` integer NOT NULL,
	`name` text NOT NULL,
	`lat` real NOT NULL,
	`long` real NOT NULL,
	`estimatedStart` text,
	`estimatedDurationMinutes` integer,
	`rationale` text NOT NULL,
	`confidence` text NOT NULL,
	`alternativeForPointId` text,
	`approximateDistanceMeters` integer,
	`estimatedPriceLevel` text,
	`priceConfidence` text,
	`priceSource` text,
	`sourceMetadataJson` text,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variantId`) REFERENCES `aiRouteVariant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `aiRouteSession` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`status` text DEFAULT 'generating' NOT NULL,
	`cityName` text,
	`cityProviderId` text,
	`requestContextJson` text NOT NULL,
	`activeVariantId` integer,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `aiRouteVariant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`sessionId` integer NOT NULL,
	`parentVariantId` integer,
	`status` text DEFAULT 'generating' NOT NULL,
	`title` text,
	`summary` text,
	`failureStage` text,
	`failureCode` text,
	`generationStartedAt` integer,
	`generationHeartbeatAt` integer,
	`generationCompletedAt` integer,
	`runnerId` text,
	`notificationStatus` text DEFAULT 'pending' NOT NULL,
	`retryCount` integer DEFAULT 0,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `aiRouteSession`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `placeMediaCache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`placeKey` text NOT NULL,
	`source` text,
	`providerPlaceId` text,
	`providerPhotoReference` text,
	`photoUrl` text,
	`alt` text,
	`attribution` text,
	`licenseHint` text,
	`termsHint` text,
	`expiresAt` integer,
	`failedAt` integer,
	`failureCode` text,
	`matchConfidence` text DEFAULT 'low' NOT NULL,
	`lat` real,
	`long` real,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `place_media_cache_place_key_idx` ON `placeMediaCache` (`placeKey`);--> statement-breakpoint
CREATE TABLE `routeDiarySave` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`sessionId` integer NOT NULL,
	`variantId` integer NOT NULL,
	`routePointId` text NOT NULL,
	`locationId` integer,
	`locationLogId` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`failureCode` text,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `aiRouteSession`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variantId`) REFERENCES `aiRouteVariant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locationId`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`locationLogId`) REFERENCES `locationLog`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routeDiarySave_userId_sessionId_variantId_routePointId_unique` ON `routeDiarySave` (`userId`,`sessionId`,`variantId`,`routePointId`);--> statement-breakpoint
CREATE TABLE `routeNotificationSubscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` text,
	`disabledAt` integer,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `routePlaceStory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`sessionId` integer NOT NULL,
	`variantId` integer NOT NULL,
	`routePointId` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`failureCode` text,
	`title` text NOT NULL,
	`sourceNote` text NOT NULL,
	`sourceSupportJson` text NOT NULL,
	`voiceId` text NOT NULL,
	`audioObjectKey` text,
	`audioContentType` text,
	`audioByteLength` integer,
	`audioDurationSeconds` integer,
	`generatedAt` integer,
	`createdAt` integer NOT NULL,
	`updateAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessionId`) REFERENCES `aiRouteSession`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variantId`) REFERENCES `aiRouteVariant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routePlaceStory_userId_sessionId_variantId_routePointId_unique` ON `routePlaceStory` (`userId`,`sessionId`,`variantId`,`routePointId`);--> statement-breakpoint
ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `publicPlaceName` text;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `publicLat` real;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `publicLong` real;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `publishedAt` integer;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `moderationStatus` text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `locationAccuracy` real;--> statement-breakpoint
ALTER TABLE `locationLogImage` ADD `locationSource` text;