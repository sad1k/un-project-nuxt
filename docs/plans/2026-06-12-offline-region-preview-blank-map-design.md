# Офлайн-превью региона: пустая серая карта — диагноз и фикс

**Дата:** 2026-06-12
**Статус:** дизайн утверждён
**Симптом:** после успешного скачивания региона (например, 494 тайла / 24.8 МБ) модал «Офлайн-просмотр» показывает однотонный серый прямоугольник вместо карты; в центре — размытое пятно (застрявший loading-скрим «Рендер из IndexedDB»).

## Диагноз

### Что проверено и работает

- **Данные тайлов валидны.** Репро с нуля: регион 26 тайлов / 3.8 МБ скачивается через реальный пайплайн (`addRegion` → `downloadRegion` → PMTiles-прокси `/offline/pmtiles`), тайлы лежат в IndexedDB.
- **Тайлы хранятся распакованными.** `pmtiles`-клиент (`getZxy`) сам разжимает gzip (`defaultDecompress` по `header.tileCompression`); первые байты тайла — не gzip-magic.
- **Схема слоёв совпадает.** Ежедневный билд `build.protomaps.com` — Protomaps Basemap **v4** (4.14.9), слои `boundaries, buildings, earth, landcover, landuse, places, pois, roads, water` — `source-layer` в `lib/offline/offline-style.ts` (`earth`, `water`, `roads`, `buildings`) им соответствуют.
- **Протокол `idb-offline://` регистрируется** (`maplibre-gl` 4.7.1 экспортирует `addProtocol`; тихий guard в `ensureOfflineProtocol` не срабатывает).

### Корневая причина

В `components/offline/region-preview.vue` контейнер карты объявлен как:

```html
<div ref="mapContainer" class="absolute inset-0" />
```

1. MapLibre при создании `Map` добавляет на этот же элемент класс `maplibregl-map`.
2. `maplibre-gl/dist/maplibre-gl.css` содержит `.maplibregl-map { …; position: relative; … }` и подключается динамически (`await import("maplibre-gl/dist/maplibre-gl.css")` в `initMap`) — **после** Tailwind-стилей.
3. При равной специфичности (один класс против одного класса) побеждает более позднее правило → computed `position` элемента становится `relative` вместо `absolute`.
4. Для `relative`-элемента `inset-0` (top/right/bottom/left: 0) не задаёт габариты → высота блока схлопывается до **0px** (замерено вживую: rect `w=920, h=0` при корректной раскладке всех родителей: панель 645px, map-зона 548px).
5. Карта рендерится в нулевую высоту: пользователь видит только фон родителя (`bg-[var(--explore-surface-hover)]` — тот самый серый), `fitBounds` работает с вырожденным viewport, событие `load` не доходит до конца → скрим «Рендер из IndexedDB» остаётся висеть (размытое пятно на скриншоте).

Почему основная карта на `/explore` не страдает: в `components/explore/map-view.client.vue` контейнер задан как `h-full w-full` — явные размеры не зависят от того, какой `position` навяжет библиотечный CSS.

## Фикс (вариант A — утверждён)

В `components/offline/region-preview.vue` заменить у `mapContainer` класс `absolute inset-0` на `h-full w-full`. Родитель (`relative min-h-0 flex-1`) уже имеет реальную высоту; `height/width: 100%` корректны при любом `position`. Паттерн идентичен рабочей Mapbox-карте на `/explore`.

Отвергнутые варианты:
- **B. `!important`/повышение специфичности** — борьба с библиотечным CSS, хрупко, маскирует причину.
- **C. Изменение порядка загрузки CSS** (maplibre-css раньше Tailwind) — глобальный side-effect на всё приложение ради одного компонента.

## Тестирование

- **Регрессионный тест** `tests/server/offline-region-preview.test.mjs` (стиль существующих `pwa-*.test.mjs`, source-level): контейнер карты в `region-preview.vue` задаёт явный размер (`h-full w-full`) и не полагается на `absolute`-позиционирование, которое молча перебивает класс `maplibregl-map`.
- **Живая проверка:** открыть превью скачанного региона — высота `.maplibregl-map` > 0, скрим исчезает после `load`, тайлы (дороги/вода/здания) отрисованы.
- `pnpm lint:source` — блокер перед коммитом.

## Вне скоупа / риски

- **`components/feed/feed-globe.client.vue:487`** использует тот же паттерн (`absolute inset-0` + динамический `mapbox-gl.css`, где `.mapboxgl-map { position: relative }`). Потенциально та же проблема — требует отдельной проверки на живом `/feed` (в чистом окружении глобус не инициализируется, эмпирически не подтверждено).
- Архив PMTiles имеет maxZoom 15, загрузчик качает z0–14 — не связано с багом, поведение overzoom корректно.
