/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaSource = await readFile("lib/db/schema/route-notification.ts", "utf8");
const querySource = await readFile("lib/db/queries/route-notification.ts", "utf8");
const statusEndpointSource = await readFile("server/api/notifications/route-generation-status.post.ts", "utf8");
const subscriptionEndpointSource = await readFile("server/api/notifications/route-generation-subscription.post.ts", "utf8");
const notificationSource = await readFile("composables/use-route-generation-notifications.ts", "utf8");
const indicatorSource = await readFile("components/app/route-generation-indicator.vue", "utf8");
const serviceWorkerSource = await readFile("public/route-generation-sw.js", "utf8");
const configSource = await readFile("nuxt.config.ts", "utf8");
const envSource = await readFile("lib/env.ts", "utf8");

test("route notification subscriptions are persisted by authenticated endpoints", () => {
  assert.match(schemaSource, /routeNotificationSubscription/);
  assert.match(querySource, /upsertRouteNotificationSubscription/);
  assert.match(querySource, /disableRouteNotificationSubscription/);
  assert.match(querySource, /findActiveRouteNotificationSubscriptionsByUserId/);
  assert.match(subscriptionEndpointSource, /defineAuthenticatedHandler/);
  assert.match(subscriptionEndpointSource, /event\.context\.user\.id/);
  assert.match(subscriptionEndpointSource, /keys/);
});

test("completion notification status is marked per user-owned route variant", () => {
  assert.match(statusEndpointSource, /markAiRouteNotificationStatus/);
  assert.match(statusEndpointSource, /event\.context\.user\.id/);
  assert.match(statusEndpointSource, /"delivered"/);
  assert.match(statusEndpointSource, /"dismissed"/);
});

test("client emits in-app and browser notifications for completed route generations", () => {
  assert.match(notificationSource, /wanderlog:route-generation-notification/);
  assert.match(notificationSource, /new Notification/);
  assert.match(notificationSource, /Notification\.requestPermission/);
  assert.match(notificationSource, /markRouteGenerationNotificationStatus/);
  assert.match(notificationSource, /route-generation-status/);
  assert.match(indicatorSource, /lastNotification/);
  assert.match(indicatorSource, /Enable browser notifications/);
});

test("browser push groundwork is gated by public VAPID key without adding a sender dependency", () => {
  assert.match(envSource, /ROUTE_NOTIFICATION_VAPID_PUBLIC_KEY/);
  assert.match(configSource, /routeNotificationVapidPublicKey/);
  assert.match(notificationSource, /PushManager/);
  assert.match(notificationSource, /route-generation-sw\.js/);
  assert.match(serviceWorkerSource, /showNotification/);
  assert.match(serviceWorkerSource, /notificationclick/);
});
