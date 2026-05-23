---
phase: 10
slug: traveler-place-photo-uploads-and-public-map-sharing
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-20
---

# Phase 10 - UI Design Contract Addendum: Global Request Error Notifications

## Objective

Add a global, client-visible Vue Sonner notification for failed app requests so users are not left with silent failures. Each notification must include a direct "Сообщить об ошибке" action that sends sanitized request context to Sentry.

## Layout Contract

- Mount one global Vue Sonner `Toaster` from the default layout.
- Position notifications fixed near the top-right below the app nav on desktop, full-width inset on small screens.
- Show at most three active failed-request notifications at once.
- Group repeated failures by method, URL label, and status; repeated failures update the same toast even when the request passed through both `fetch` and `$fetch`.
- Notifications must not block PWA install/status controls or route-generation status controls.

## Visual Contract

- Use the existing dark app shell language: black/red destructive surface, white text, subtle border, and compact 8px radius.
- Use `vue-sonner` dark rich-color styling with close controls and compact action buttons.
- Avoid nested cards and oversized hero-scale typography.
- Keep request metadata truncated to one line so long URLs cannot stretch the toast.

## Interaction Contract

- Failed `$fetch`, `$csrfFetch`, and same-origin app `fetch` failures surface the notification globally.
- External GET requests that silently degrade visual helpers, such as map route geometry, should not notify users.
- Mutating external requests, such as signed upload POSTs, should notify users if they fail.
- Duplicate failures for the same method, URL, and status update the existing toast with a repeat count.
- The report button sends sanitized context only: source, method, request label, status code, and status text.
- Users can dismiss each notification without changing the underlying feature state.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Heading | Запрос не выполнен |
| Network/body | Сеть недоступна или запрос был прерван. |
| Auth/body | Сессия или доступ к действию недействительны. |
| Not found/body | Запрошенные данные не найдены. |
| Server/body | Сервер не смог обработать запрос. |
| Generic/body | Запрос завершился с ошибкой. |
| Report CTA | Сообщить об ошибке |
| Reported state | Ошибка отправлена |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-20
