/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const feedPageSource = await readFile("pages/feed.vue", "utf8");
const globeComponentSource = await readFile("components/feed/feed-globe.client.vue", "utf8");
const globeComposableSource = await readFile("composables/use-feed-globe.ts", "utf8");
const postCardSource = await readFile("components/feed/post-card.vue", "utf8");
const feedStoreSource = await readFile("stores/feed.ts", "utf8");

test("feed page has a real globe tab while preserving the feed list", () => {
  assert.match(feedPageSource, /route\.query\.tab === "globe" \? "globe" : "feed"/);
  assert.match(feedPageSource, /watch\(\(\) => route\.query\.tab/);
  assert.match(feedPageSource, /activeTab === 'feed'/);
  assert.match(feedPageSource, /activeTab === 'globe'/);
  assert.match(feedPageSource, /import FeedGlobe from "~\/components\/feed\/feed-globe\.client\.vue"/);
  assert.match(feedPageSource, /<FeedGlobe \/>/);
  assert.match(feedPageSource, /publishTarget/);
  assert.match(feedPageSource, /path:\s*"\/dashboard\/publish"/);
});

test("feed page removes search and uses an expanding icon tab switcher", () => {
  assert.doesNotMatch(feedPageSource, /tabler:search|placeholder="Поиск/);
  assert.match(feedPageSource, /feed-tab-switcher/);
  assert.match(feedPageSource, /feed-tab-button/);
  assert.match(feedPageSource, /feed-tab-label/);
  assert.match(feedPageSource, /tabler:list-details/);
  assert.match(feedPageSource, /tabler:world/);
  assert.match(feedPageSource, /Лайф глобус/);
  assert.match(feedPageSource, /\.feed-tab-button:hover \.feed-tab-label/);
});

test("feed globe tab uses the globe as a background behind the post composer", () => {
  assert.match(feedPageSource, /feed-globe-background absolute inset-0/);
  assert.match(feedPageSource, /feed-composer--floating/);
  assert.match(feedPageSource, /<textarea/);
  assert.match(feedPageSource, /Расскажите историю к фото/);
  assert.match(feedPageSource, /feed-globe-background :deep\(section\)/);
});

test("feed globe component owns a dedicated Mapbox globe lifecycle", () => {
  assert.match(globeComponentSource, /await import\("mapbox-gl"\)/);
  assert.match(globeComponentSource, /projection:\s*"globe"/);
  assert.match(globeComponentSource, /map\.setFog/);
  assert.match(globeComponentSource, /new mb\.Map/);
  assert.match(globeComponentSource, /map\.on\("error"/);
  assert.match(globeComponentSource, /ResizeObserver/);
  assert.match(globeComponentSource, /map\.resize\(\)/);
  assert.match(globeComponentSource, /focusMapOnPoints/);
  assert.doesNotMatch(globeComponentSource, /useMapbox\(/);
  assert.match(globeComponentSource, /map\?\.remove\(\)/);
});

test("feed globe follows the active color theme", () => {
  assert.match(globeComponentSource, /useColorMode\(\)/);
  assert.match(globeComponentSource, /mapbox:\/\/styles\/mapbox\/dark-v11/);
  assert.match(globeComponentSource, /mapbox:\/\/styles\/mapbox\/light-v11/);
  assert.match(globeComponentSource, /watch\(mapStyle/);
  assert.match(globeComponentSource, /map\.setStyle\(mapStyle\.value\)/);
  assert.match(globeComponentSource, /applyThemeFog/);
  assert.match(globeComponentSource, /feed-globe--light/);
  assert.match(globeComponentSource, /feed-globe--dark/);
  assert.match(globeComponentSource, /feed-globe-photo-card--light/);
  assert.match(globeComponentSource, /feed-globe-photo-card--dark/);
});

test("feed globe marker animation does not override Mapbox coordinate transforms", () => {
  assert.match(globeComponentSource, /:global\(\.feed-globe-point\)/);
  assert.match(globeComponentSource, /@keyframes feed-globe-arrive/);
  assert.doesNotMatch(globeComponentSource, /@keyframes feed-globe-arrive[\s\S]*transform:/);
});

test("feed globe renders a visible fallback globe while Mapbox is unavailable or loading", () => {
  assert.match(globeComponentSource, /showFallbackGlobe/);
  assert.match(globeComponentSource, /feed-globe-fallback__sphere/);
  assert.match(globeComponentSource, /fallbackPoints/);
  assert.match(globeComponentSource, /fallbackOverflow/);
  assert.match(globeComponentSource, /Showing live fallback globe/);
  assert.match(globeComponentSource, /Mapbox не загрузился/);
});

test("feed globe component renders safe popup fields only", () => {
  assert.match(globeComponentSource, /createPopupHTML\(post: PublicFeedGlobePost\)/);
  assert.match(globeComponentSource, /post\.image\.url/);
  assert.match(globeComponentSource, /post\.place\.name/);
  assert.match(globeComponentSource, /post\.author\.name/);
  assert.match(globeComponentSource, /new Date\(post\.createdAt\)/);
  assert.doesNotMatch(globeComponentSource, /locationLogId|email|provider|routeContext/);
});

test("feed globe popups are closable and hover points show author avatars", () => {
  assert.match(globeComponentSource, /let hoverPopup/);
  assert.match(globeComponentSource, /closeSelectedPhotoPopup/);
  assert.match(globeComponentSource, /closeHoverPopup/);
  assert.match(globeComponentSource, /closeButton:\s*true/);
  assert.match(globeComponentSource, /map\.on\("click", closeSelectedPhotoPopup\)/);
  assert.match(globeComponentSource, /mouseenter/);
  assert.match(globeComponentSource, /mouseleave/);
  assert.match(globeComponentSource, /createAvatarPopupHTML\(point\.post\)/);
  assert.match(globeComponentSource, /feed-globe-avatar-popup__ring/);
  assert.doesNotMatch(globeComponentSource, /class="absolute bottom-12 right-4/);
});

test("feed globe data composable fetches public endpoint and applies density", () => {
  assert.match(globeComposableSource, /\/api\/public\/feed-globe/);
  assert.match(globeComposableSource, /limitFeedGlobeDensity/);
  assert.match(globeComposableSource, /mergePosts/);
  assert.match(globeComposableSource, /Deduplicate|byId|new Map<number, PublicFeedGlobePost>/);
  assert.doesNotMatch(globeComposableSource, /defineAuthenticatedHandler|event\.context\.user/);
});

test("feed cards use safe public place labels when present", () => {
  assert.match(feedStoreSource, /publicPlaceName:\s*string \| null/);
  assert.match(feedStoreSource, /publicLat:\s*number \| null/);
  assert.match(feedStoreSource, /publicLong:\s*number \| null/);
  assert.match(postCardSource, /placeLabel = computed\(\(\) => post\.publicPlaceName/);
  assert.match(postCardSource, /\{\{ placeLabel \}\}/);
});
