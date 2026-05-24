import type { PlaceIntelligence, PlaceMissingDataSlot } from "~/lib/explore/place-intelligence";

type PlacePopupOptions = {
  includeStoryCta?: boolean;
};

export function createPlacePopupHTML(place: PlaceIntelligence, options: PlacePopupOptions = {}): string {
  return `
    <article class="place-popup explore-place-popup">
      ${renderPhotoSection(place)}
      <div class="place-popup__body" style="padding:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="min-width:0">
            <div style="font-size:15px;font-weight:700;line-height:1.2;overflow-wrap:anywhere">${escapeHtml(place.name)}</div>
            ${place.day ? `<div style="margin-top:3px;font-size:11px;font-weight:600;color:var(--explore-warning-text)">День ${escapeHtml(place.day)}</div>` : ""}
          </div>
          <div style="flex:0 0 auto;white-space:nowrap;border-radius:999px;background:var(--explore-warning-bg);padding:3px 7px;font-size:11px;font-weight:700;color:var(--explore-warning-text)">Точка маршрута</div>
        </div>
        ${renderSummary(place)}
        ${renderRatingAndCost(place)}
        ${renderReviews(place)}
        ${renderCommunity(place)}
        ${renderMissingSlots(place.missingSlots)}
        <div style="position:sticky;bottom:0;z-index:1;margin:10px -12px -12px;display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px 12px;background:var(--explore-popup-backdrop)">
          ${options.includeStoryCta ? renderStoryAction(place) : ""}
          <button type="button" data-place-save-cta="${escapeHtml(place.id)}" style="flex:1 1 54px;min-width:0;max-width:100%;border:0;border-radius:8px;background:var(--explore-text-strong);color:var(--explore-surface-strong);padding:7px 9px;font-size:12px;font-weight:700;line-height:1.2;text-align:center">Сохранить</button>
          <button type="button" data-place-directions-cta="${escapeHtml(place.id)}" style="flex:1 1 82px;min-width:0;max-width:100%;border:1px solid var(--explore-border);border-radius:8px;background:var(--explore-surface-strong);color:var(--explore-text-muted);padding:7px 9px;font-size:12px;font-weight:700;line-height:1.2;text-align:center">Маршрут</button>
        </div>
      </div>
    </article>
  `;
}

export function createPlacePopupLoadingHTML(input: { name: string; day?: number }): string {
  return `
    <div class="explore-place-popup-loading">
      <div style="font-size:11px;font-weight:700;color:var(--explore-warning-text)">${input.day ? `День ${input.day}` : "Точка маршрута"}</div>
      <div style="margin-top:4px;font-size:14px;font-weight:700;color:var(--explore-text);overflow-wrap:anywhere">${escapeHtml(input.name)}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--explore-text-soft)">Загружаем детали места...</div>
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
      <div class="place-popup__photo place-popup__photo--missing" style="display:flex;height:128px;box-sizing:border-box;align-items:center;justify-content:center;padding:10px;text-align:center;background:var(--explore-popup-photo-bg);color:var(--explore-text-soft);font-size:12px;font-weight:600">
        ${escapeHtml(photoMissing?.label || "Фото недоступно")}
      </div>
    `;
  }

  const caption = place.photo.attribution || place.photo.source.label;

  return `
    <figure class="place-popup__photo" style="margin:0;height:128px;background:var(--explore-popup-photo-bg)">
      <img src="${escapeHtml(place.photo.url)}" alt="${escapeHtml(place.photo.alt)}" style="height:128px;width:100%;object-fit:cover" loading="lazy" />
      <figcaption style="margin-top:-22px;padding:4px 8px;background:var(--explore-photo-caption-bg);color:var(--explore-primary-text);font-size:10px">${escapeHtml(caption)}</figcaption>
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
      <p style="margin:0;font-size:12px;line-height:1.45;color:var(--explore-text-muted);overflow-wrap:anywhere">${summary}</p>
      ${source ? renderSource(source.label, source.confidence) : ""}
    </section>
  `;
}

function renderRatingAndCost(place: PlaceIntelligence): string {
  const rating = place.rating
    ? `<div style="flex:1 1 112px;min-width:0;border-radius:8px;background:var(--explore-surface-soft);padding:8px">
        <div style="font-size:11px;color:var(--explore-text-soft)">Рейтинг</div>
        <div style="font-size:13px;font-weight:700;color:var(--explore-text);overflow-wrap:anywhere">${escapeHtml(place.rating.value.toFixed(1))}/${place.rating.scale}</div>
        <div style="font-size:10px;color:var(--explore-text-soft)">${escapeHtml(place.rating.reviewCount ?? 0)} отзывов</div>
        ${renderSource(place.rating.source.label, place.rating.source.confidence)}
      </div>`
    : "";
  const cost = place.cost
    ? `<div style="flex:1 1 112px;min-width:0;border-radius:8px;background:var(--explore-surface-soft);padding:8px">
        <div style="font-size:11px;color:var(--explore-text-soft)">Стоимость</div>
        <div style="font-size:13px;font-weight:700;color:var(--explore-text);overflow-wrap:anywhere">${escapeHtml(place.cost.label)}</div>
        ${renderSource(place.cost.source.label, place.cost.source.confidence)}
      </div>`
    : "";

  return rating || cost ? `<section style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">${rating}${cost}</section>` : "";
}

function renderReviews(place: PlaceIntelligence): string {
  if (!place.reviews.length)
    return "";

  const reviews = place.reviews.map(review => `
    <li style="border-top:1px solid var(--explore-border);padding-top:7px">
      <div style="font-size:12px;line-height:1.35;color:var(--explore-text-muted);overflow-wrap:anywhere">${escapeHtml(review.text)}</div>
      <div style="margin-top:3px;font-size:10px;color:var(--explore-text-soft)">${escapeHtml(review.authorLabel || "Отзыв из источника")} ${review.rating ? `- ${escapeHtml(review.rating)}/5` : ""}</div>
      ${renderSource(review.source.label, review.source.confidence)}
    </li>
  `).join("");

  return `<section style="margin-top:10px"><ul style="margin:0;display:grid;gap:7px;padding:0;list-style:none">${reviews}</ul></section>`;
}

function renderCommunity(place: PlaceIntelligence): string {
  if (!place.community)
    return "";

  const likelyLabel = place.community.likelyCurrentlyThere === true
    ? "Недавно была активность"
    : place.community.likelyCurrentlyThere === false
      ? "Недавней активности нет"
      : "Недавняя активность неясна";

  return `
    <section style="margin-top:10px;border-radius:8px;background:var(--explore-success-bg);padding:8px">
      <div style="font-size:11px;font-weight:700;color:var(--explore-success-text)">Сигнал сообщества</div>
      <div style="margin-top:2px;font-size:12px;color:var(--explore-success-text);overflow-wrap:anywhere">${escapeHtml(place.community.label)}</div>
      <div style="margin-top:2px;font-size:10px;color:var(--explore-success-text)">${escapeHtml(likelyLabel)} · ${place.community.recentVisitCount} недавних / ${place.community.visitCount} всего</div>
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
        <div data-missing-slot="${escapeHtml(slot.key)}" style="border-radius:7px;background:var(--explore-surface-soft);padding:6px 7px">
          <div style="font-size:10px;font-weight:700;color:var(--explore-text-soft)">${escapeHtml(slot.label)}</div>
          <div style="font-size:10px;line-height:1.35;color:var(--explore-text-faint);overflow-wrap:anywhere">${escapeHtml(slot.message)}</div>
        </div>
      `).join("")}
    </section>
  `;
}

function renderStoryAction(place: PlaceIntelligence): string {
  return `<button type="button" data-place-story-cta="${escapeHtml(place.id)}" style="flex:1 1 106px;min-width:0;max-width:100%;border:1px solid var(--explore-warning-border);border-radius:8px;background:var(--explore-warning-bg);color:var(--explore-warning-text);padding:7px 9px;font-size:12px;font-weight:700;line-height:1.2;text-align:center">Слушать историю</button>`;
}

function renderSource(label: string, confidence: string): string {
  return `<div style="margin-top:3px;font-size:9px;color:var(--explore-text-faint)">${escapeHtml(label)} · уверенность: ${escapeHtml(formatConfidence(confidence))}</div>`;
}

function formatConfidence(confidence: string): string {
  const labels: Record<string, string> = {
    high: "высокая",
    low: "низкая",
    medium: "средняя",
  };

  return labels[confidence] || confidence;
}
