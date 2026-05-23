# Phase 10: Traveler Place Photo Uploads and Public Map Sharing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 10-Traveler Place Photo Uploads and Public Map Sharing
**Areas discussed:** Photo source and place attachment, Map placement experience, Public sharing surface, Visibility and removal model, Moderation and safety boundary

---

## Photo Source And Place Attachment

| Option | Description | Selected |
|--------|-------------|----------|
| Existing diary image only | User selects an already uploaded `locationLogImage` from an existing diary location/log. | |
| New place + photo flow | User chooses or creates a place, marks it by GPS/map, and uploads a new photo in the same flow. | yes |
| Both paths | Support new capture and older diary images. | |

**User's choice:** New quick flow: the user can take a photo and add the place through a GPS marker.
**Notes:** User specifically wants a traveler to quickly take a photo and add the place through a GPS tag.

| Option | Description | Selected |
|--------|-------------|----------|
| Full diary entry | Create `location`, `locationLog`, and image records. | yes |
| Only place photo | Store a lightweight public/place photo without diary records. | |
| Minimal automatic log | Create diary records with minimal defaults. | |

**User's choice:** Create full diary records.
**Notes:** The quick flow should still preserve WanderLog's diary model.

| Option | Description | Selected |
|--------|-------------|----------|
| Nearest-place search + manual confirmation | Search nearby places from GPS, then let the user confirm or rename. | yes |
| Manual name entry | User types the attraction name. | |
| Automatic generic place name | Save with a generic nearby-place label. | |

**User's choice:** Nearest-place search plus confirmation/rename.
**Notes:** This keeps the flow quick without sacrificing place quality.

| Option | Description | Selected |
|--------|-------------|----------|
| Camera first + gallery fallback | Mobile camera is primary, file/gallery picker remains available. | yes |
| File/gallery only | Reuse existing upload style only. | |
| Camera, gallery, and existing diary photos | Add all entry points in one phase. | |

**User's choice:** Camera-first on mobile with gallery fallback.
**Notes:** Existing diary image publishing can be deferred unless planning finds a cheap reuse path.

---

## Map Placement Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Current geolocation after photo | Place marker from current browser geolocation after capture. | yes |
| Map first, then photo | User places marker before capture. | |
| EXIF when available, otherwise current geolocation | Use image metadata when possible. | |

**User's choice:** Use current geolocation immediately after photo capture.
**Notes:** This matches the desired on-the-ground traveler flow.

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory confirm step | Show a map with draggable marker before saving. | yes |
| Autosave with undo/edit | Save immediately, allow correction later. | |
| Confirm only before public sharing | Private diary save is immediate; confirmation only gates public visibility. | |

**User's choice:** Mandatory confirmation step with draggable marker.
**Notes:** Confirmation reduces bad public/private coordinates.

| Option | Description | Selected |
|--------|-------------|----------|
| Manual map placement fallback | Use map/search placement when GPS is missing or inaccurate. | yes |
| Allow saving without coordinates | Save image without map coordinates. | |
| Block until GPS permission is granted | Require GPS permission before continuing. | |

**User's choice:** Manual map/search placement fallback.
**Notes:** Saving without coordinates conflicts with current `location` and `locationLog` schema.

| Option | Description | Selected |
|--------|-------------|----------|
| Show accuracy state | Show precise/approximate/manual and radius/text when available. | yes |
| Do not show accuracy | Keep UI simpler. | |
| Store accuracy only | Save accuracy in data but do not show it. | |

**User's choice:** Show accuracy state to the user.
**Notes:** Accuracy feedback helps users trust and correct public map markers.

---

## Public Sharing Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Place/map surfaces first | Public photos show on map/place surfaces. | yes |
| Feed first | Public photos become feed posts first. | |
| Both map and feed | Public photos appear on map and feed. | |

**User's choice:** Place/map surfaces first.
**Notes:** This directly supports the request that public photos display for everyone on the map.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate public photos layer | Distinct photo markers/clusters separate from diary markers. | yes |
| Inside normal place markers | Add public photos inside existing place markers. | |
| Only inside place popup | No visible map layer change. | |

**User's choice:** Separate public photos layer.
**Notes:** This keeps personal diary markers and community photos visually distinct.

| Option | Description | Selected |
|--------|-------------|----------|
| All users including unauthenticated on public pages | Public reads can power public map/page views. | yes |
| Authenticated users only | Only logged-in users see public photos. | |
| Authenticated now, public web gallery later | Defer anonymous visibility. | |

**User's choice:** Visible to all users, including unauthenticated visitors where the page/map is public.
**Notes:** This increases the importance of privacy-safe payloads and moderation fields.

| Option | Description | Selected |
|--------|-------------|----------|
| Photo + place + author display name + date | Lean community metadata without private diary text. | yes |
| Photo + place only | More private but less community feel. | |
| Photo + place + caption/story | Richer but higher moderation/privacy risk. | |

**User's choice:** Photo, place, author display name, and date.
**Notes:** No private diary description should leak into public views.

---

## Visibility And Removal Model

| Option | Description | Selected |
|--------|-------------|----------|
| Visibility fields on image | Extend `locationLogImage` with public metadata. | yes |
| Separate public photo table | Store a separate public publication row. | |
| Reuse existing post | Treat public map visibility as feed publishing. | |

**User's choice:** Visibility/public fields on `locationLogImage`.
**Notes:** Public sharing is a visibility layer on diary images.

| Option | Description | Selected |
|--------|-------------|----------|
| Save private first, then Make public | Public sharing is a later explicit action. | yes |
| Checkbox on confirm screen | Let user publish during first save. | |
| Separate Save private / Publish public actions | Two primary actions during save. | |

**User's choice:** Save privately first, then separate "Make public" action.
**Notes:** This minimizes accidental publishing.

| Option | Description | Selected |
|--------|-------------|----------|
| Diary image remains, public layer disappears | Unpublish only removes public visibility. | yes |
| Delete the photo entirely | Unpublish is destructive. | |
| Hide from everyone including owner | Hide the photo globally. | |

**User's choice:** Keep the diary image, remove it from the public layer.
**Notes:** Personal diary ownership remains intact.

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot public fields | Store public place/coordinate/status fields separate from private diary fields. | yes |
| Use location/log fields directly | Public map reads live from private records. | |
| Only visibility flag | Minimal public model. | |

**User's choice:** Store snapshot-safe public fields.
**Notes:** Public fields should include `publicPlaceName`, public coordinates, `publishedAt`, visibility, and moderation status.

---

## Moderation And Safety Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Owner controls + hidden moderation fields | Owner can unpublish/delete; schema stores moderation status for future use. | yes |
| Owner controls + admin hide UI | Add admin hide controls now. | |
| Full report/moderation flow | Add reports, queue, reasons, and audit trail. | |

**User's choice:** Owner controls plus hidden moderation fields.
**Notes:** Full moderation UI is deferred.

| Option | Description | Selected |
|--------|-------------|----------|
| No public caption | Public cards show only photo, place, author, and date. | yes |
| Short caption after separate confirm | Add user text with extra confirmation. | |
| Use diary description as caption | Reuse private diary description publicly. | |

**User's choice:** No public caption.
**Notes:** This avoids text moderation and private diary leakage in Phase 10.

| Option | Description | Selected |
|--------|-------------|----------|
| Cascade removes public visibility | Deleting private image/log/location removes public map visibility. | yes |
| Keep public snapshot independently | Public photo survives diary deletion. | |
| Ask during deletion | User chooses at delete time. | |

**User's choice:** Cascade removes public visibility.
**Notes:** Public data should respect owner deletion expectations.

| Option | Description | Selected |
|--------|-------------|----------|
| Public read, authenticated write | Public reads may be anonymous; mutations require auth/owner checks. | yes |
| Everything authenticated | Public photos visible only to logged-in users. | |
| No public read/write | No public API boundary. | |

**User's choice:** Public read, authenticated write.
**Notes:** Upload, publish, unpublish, and delete require authentication and owner checks.

---

## the agent's Discretion

- Exact schema field names and enum values for visibility, moderation, and accuracy are left to the planner.
- Exact page/component/API route names are left to the planner.
- Exact provider endpoint for nearest-place lookup is left to the planner, subject to existing Mapbox/Nominatim/provider safety constraints.

## Deferred Ideas

- Publishing already existing diary images as a first-class entry point.
- Feed-first publishing or automatic feed post creation.
- Public captions or diary description reuse.
- Full admin moderation UI, reporting, queues, reason codes, and audit trail.
- Standalone public web gallery beyond place/map surfaces.
