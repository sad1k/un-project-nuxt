import type { PlaceIntelligence, PlaceMissingDataSlot } from "~/lib/explore/place-intelligence";

type PlacePopupOptions = {
  includeStoryCta?: boolean;
};

export function createPlacePopupHTML(place: PlaceIntelligence, options: PlacePopupOptions = {}): string {
  return `
    <article class="place-popup" style="width:min(280px,calc(100vw - 48px));max-height:max(300px,min(440px,calc(100svh - 176px)));box-sizing:border-box;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;overflow-wrap:anywhere;border-radius:12px;background:#fff;font-family:system-ui,sans-serif;color:#111827">
      ${renderPhotoSection(place)}
      <div class="place-popup__body" style="padding:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="min-width:0">
            <div style="font-size:15px;font-weight:700;line-height:1.2;overflow-wrap:anywhere">${escapeHtml(place.name)}</div>
            ${place.day ? `<div style="margin-top:3px;font-size:11px;font-weight:600;color:#b45309">Day ${escapeHtml(place.day)}</div>` : ""}
          </div>
          <div style="flex:0 0 auto;white-space:nowrap;border-radius:999px;background:#fef3c7;padding:3px 7px;font-size:11px;font-weight:700;color:#92400e">Route stop</div>
        </div>
        ${renderSummary(place)}
        ${renderRatingAndCost(place)}
        ${renderReviews(place)}
        ${renderCommunity(place)}
        ${renderMissingSlots(place.missingSlots)}
        <div style="position:sticky;bottom:0;z-index:1;margin:10px -12px -12px;display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 12px;background:linear-gradient(rgba(255,255,255,.88),#fff 42%)">
          ${options.includeStoryCta ? renderStoryAction(place) : ""}
          <button type="button" data-place-save-cta="${escapeHtml(place.id)}" style="flex:1 1 54px;min-width:0;max-width:100%;border:0;border-radius:8px;background:#111827;color:white;padding:7px 9px;font-size:12px;font-weight:700;line-height:1.2;text-align:center">Save</button>
          <button type="button" data-place-directions-cta="${escapeHtml(place.id)}" style="flex:1 1 82px;min-width:0;max-width:100%;border:1px solid #e5e7eb;border-radius:8px;background:white;color:#374151;padding:7px 9px;font-size:12px;font-weight:700;line-height:1.2;text-align:center">Directions</button>
        </div>
      </div>
    </article>
  `;
}

export function createPlacePopupLoadingHTML(input: { name: string; day?: number }): string {
  return `
    <div style="width:min(240px,calc(100vw - 48px));box-sizing:border-box;padding:12px;font-family:system-ui,sans-serif">
      <div style="font-size:11px;font-weight:700;color:#b45309">${input.day ? `Day ${input.day}` : "Route stop"}</div>
      <div style="margin-top:4px;font-size:14px;font-weight:700;color:#111827;overflow-wrap:anywhere">${escapeHtml(input.name)}</div>
      <div style="margin-top:8px;font-size:12px;color:#6b7280">Loading place details...</div>
    </div>
  `;
}

export function escapeHtml(input: string | number | null | undefined): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPhotoSection(place: PlaceIntelligence): string {
  if (!place.photo) {
    const photoMissing = place.missingSlots.find(slot => slot.key === "photo");
    return `
      <div class="place-popup__photo place-popup__photo--missing" style="display:flex;height:128px;box-sizing:border-box;align-items:center;justify-content:center;padding:10px;text-align:center;background:#f3f4f6;color:#6b7280;font-size:12px;font-weight:600">
        ${escapeHtml(photoMissing?.label || "Photo missing")}
      </div>
    `;
  }

  return `
    <figure class="place-popup__photo" style="margin:0;height:128px;background:#f3f4f6">
      <img src="${escapeHtml(place.photo.url)}" alt="${escapeHtml(place.photo.alt)}" style="height:128px;width:100%;object-fit:cover" loading="lazy" />
      ${place.photo.attribution ? `<figcaption style="margin-top:-22px;padding:4px 8px;background:rgba(17,24,39,.62);color:white;font-size:10px">${escapeHtml(place.photo.attribution)}</figcaption>` : ""}
    </figure>
  `;
}

function renderSummary(place: PlaceIntelligence): string {
  const summary = place.aiSummary?.text
    ? escapeHtml(place.aiSummary.text)
    : escapeHtml(place.routeRationale);
  if (!summary)
    return "";

  const source = place.aiSummary?.summarySource;
  return `
    <section style="margin-top:8px">
      <p style="margin:0;font-size:12px;line-height:1.45;color:#4b5563;overflow-wrap:anywhere">${summary}</p>
      ${source ? renderSource(source.label, source.confidence) : ""}
    </section>
  `;
}

function renderRatingAndCost(place: PlaceIntelligence): string {
  const rating = place.rating
    ? `<div style="flex:1 1 112px;min-width:0;border-radius:8px;background:#f9fafb;padding:8px">
        <div style="font-size:11px;color:#6b7280">Rating</div>
        <div style="font-size:13px;font-weight:700;color:#111827;overflow-wrap:anywhere">${escapeHtml(place.rating.value.toFixed(1))}/${place.rating.scale}</div>
        <div style="font-size:10px;color:#6b7280">${escapeHtml(place.rating.reviewCount ?? 0)} reviews</div>
        ${renderSource(place.rating.source.label, place.rating.source.confidence)}
      </div>`
    : "";
  const cost = place.cost
    ? `<div style="flex:1 1 112px;min-width:0;border-radius:8px;background:#f9fafb;padding:8px">
        <div style="font-size:11px;color:#6b7280">Cost</div>
        <div style="font-size:13px;font-weight:700;color:#111827;overflow-wrap:anywhere">${escapeHtml(place.cost.label)}</div>
        ${renderSource(place.cost.source.label, place.cost.source.confidence)}
      </div>`
    : "";

  return rating || cost ? `<section style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">${rating}${cost}</section>` : "";
}

function renderReviews(place: PlaceIntelligence): string {
  if (!place.reviews.length)
    return "";

  const reviews = place.reviews.map(review => `
    <li style="border-top:1px solid #f3f4f6;padding-top:7px">
      <div style="font-size:12px;line-height:1.35;color:#374151;overflow-wrap:anywhere">${escapeHtml(review.text)}</div>
      <div style="margin-top:3px;font-size:10px;color:#6b7280">${escapeHtml(review.authorLabel || "Sourced review")} ${review.rating ? `- ${escapeHtml(review.rating)}/5` : ""}</div>
      ${renderSource(review.source.label, review.source.confidence)}
    </li>
  `).join("");

  return `<section style="margin-top:10px"><ul style="margin:0;display:grid;gap:7px;padding:0;list-style:none">${reviews}</ul></section>`;
}

function renderCommunity(place: PlaceIntelligence): string {
  if (!place.community)
    return "";

  const likelyLabel = place.community.likelyCurrentlyThere === true
    ? "Likely active recently"
    : place.community.likelyCurrentlyThere === false
      ? "No recent aggregate activity"
      : "Recent activity uncertain";

  return `
    <section style="margin-top:10px;border-radius:8px;background:#ecfdf5;padding:8px">
      <div style="font-size:11px;font-weight:700;color:#047857">Community signal</div>
      <div style="margin-top:2px;font-size:12px;color:#065f46;overflow-wrap:anywhere">${escapeHtml(place.community.label)}</div>
      <div style="margin-top:2px;font-size:10px;color:#047857">${escapeHtml(likelyLabel)} · ${place.community.recentVisitCount} recent / ${place.community.visitCount} total</div>
      ${renderSource(place.community.source.label, place.community.source.confidence)}
    </section>
  `;
}

function renderMissingSlots(slots: PlaceMissingDataSlot[]): string {
  if (!slots.length)
    return "";

  return `
    <section style="margin-top:10px;display:grid;gap:5px">
      ${slots.map(slot => `
        <div data-missing-slot="${escapeHtml(slot.key)}" style="border-radius:7px;background:#f9fafb;padding:6px 7px">
          <div style="font-size:10px;font-weight:700;color:#6b7280">${escapeHtml(slot.label)}</div>
          <div style="font-size:10px;line-height:1.35;color:#9ca3af;overflow-wrap:anywhere">${escapeHtml(slot.message)}</div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderStoryAction(place: PlaceIntelligence): string {
  return `<button type="button" data-place-story-cta="${escapeHtml(place.id)}" style="flex:1 1 106px;min-width:0;max-width:100%;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#92400e;padding:7px 9px;font-size:12px;font-weight:700;line-height:1.2;text-align:center">Listen to story</button>`;
}

function renderSource(label: string, confidence: string): string {
  return `<div style="margin-top:3px;font-size:9px;color:#9ca3af">${escapeHtml(label)} · ${escapeHtml(confidence)} confidence</div>`;
}
