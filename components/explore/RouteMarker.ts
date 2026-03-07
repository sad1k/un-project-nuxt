import type { RoutePoint } from '~/composables/useRouteGenerator'

export const TYPE_COLORS: Record<string, string> = {
  culture: '#3B82F6',
  food: '#F59E0B',
  nature: '#10B981',
  adventure: '#EF4444',
  art: '#8B5CF6',
  nightlife: '#EC4899',
}

let styleInjected = false

function injectMarkerStyles() {
  if (styleInjected) return
  const style = document.createElement('style')
  style.textContent = `
    @keyframes markerDrop {
      0% { transform: translateY(-30px) scale(0.5); opacity: 0; }
      60% { transform: translateY(4px) scale(1.05); opacity: 1; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }
  `
  document.head.appendChild(style)
  styleInjected = true
}

export function createMarkerElement(index: number, delayMs: number): HTMLDivElement {
  injectMarkerStyles()

  const el = document.createElement('div')
  Object.assign(el.style, {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #f87171, #f59e0b)',
    borderRadius: '50%',
    color: 'white',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    border: '2px solid white',
    cursor: 'pointer',
    animation: 'markerDrop 0.5s ease-out',
    animationDelay: `${delayMs}ms`,
    animationFillMode: 'both',
  })
  el.textContent = (index + 1).toString()
  return el
}

export function createPopupHTML(point: RoutePoint): string {
  const color = TYPE_COLORS[point.type] || '#6B7280'
  return `
    <div style="padding:8px;min-width:150px;font-family:system-ui,sans-serif">
      <div style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color}20;color:${color};font-size:11px;font-weight:600;margin-bottom:4px">
        Day ${point.day}
      </div>
      <div style="font-weight:600;font-size:14px;margin-top:4px">${point.name}</div>
      <div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:12px;color:#6B7280">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
        ${point.type}
      </div>
    </div>
  `
}
