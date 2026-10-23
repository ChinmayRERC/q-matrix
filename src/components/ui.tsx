/**
 * Small presentational primitives shared by every screen.
 * Kept dependency-free (no component library) so the visual language stays
 * consistent with the design tokens in app.css.
 */
import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import {
  Bot,
  Crown,
  Flame,
  GitFork,
  Globe,
  Moon,
  Radio,
  Search,
  Sparkles,
  Swords,
  Target,
  X,
} from 'lucide-react'

const BADGE_ICONS = {
  sparkles: Sparkles,
  'git-fork': GitFork,
  search: Search,
  flame: Flame,
  target: Target,
  swords: Swords,
  globe: Globe,
  radio: Radio,
  bot: Bot,
  crown: Crown,
  moon: Moon,
} as const

/** Badge definitions store an icon *name*; this maps it to a lucide glyph. */
export function BadgeGlyph({ name, size = 18 }: { name: string; size?: number }) {
  const Glyph = BADGE_ICONS[name as keyof typeof BADGE_ICONS] ?? Sparkles
  return <Glyph size={size} />
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function Panel({
  title,
  sub,
  actions,
  children,
  className = '',
  pad = false,
  tight = false,
  glow = false,
  sunken = false,
}: {
  title?: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  pad?: boolean
  tight?: boolean
  glow?: boolean
  sunken?: boolean
}) {
  return (
    <section className={`panel ${pad ? 'pad' : ''} ${glow ? 'glow' : ''} ${sunken ? 'sunken' : ''} ${className}`}>
      {title !== undefined && (
        <header className={`panel-head ${tight ? 'tight' : ''}`}>
          <div className="grow">
            <h2>{title}</h2>
            {sub !== undefined && <p>{sub}</p>}
          </div>
          {actions && <div className="row gap-6 wrap">{actions}</div>}
        </header>
      )}
      {title !== undefined ? <div className={`panel-body ${tight ? 'tight' : ''}`}>{children}</div> : children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'cyan'

export function Btn({
  variant = 'default',
  size,
  icon,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'lg'
  icon?: ReactNode
}) {
  const v = variant === 'default' ? '' : variant
  const s = size ? size : ''
  return (
    <button className={`btn ${v} ${s} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Pills / chips / stats
// ---------------------------------------------------------------------------

export type Tone = 'violet' | 'cyan' | 'amber' | 'green' | 'pink' | 'rose' | 'lime' | 'slate'

export function Pill({ tone, children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`pill ${tone ?? ''}`} title={title}>
      {children}
    </span>
  )
}

export function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on?: boolean
  onClick?: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button type="button" className={`chip ${on ? 'on' : ''}`} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

export function Meter({
  value,
  tone,
  className = '',
}: {
  /** 0..1 */
  value: number
  tone?: 'cyan' | 'green' | 'amber'
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100
  return (
    <div className={`meter ${tone ?? ''} ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  accent,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: boolean
  tone?: string
}) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <div className="k">{label}</div>
      <div className="v" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {hint !== undefined && <div className="h">{hint}</div>}
    </div>
  )
}

export function Ring({
  value,
  size = 64,
  thickness = 6,
  label,
  sub,
  color = 'var(--violet)',
}: {
  value: number
  size?: number
  thickness?: number
  label?: ReactNode
  sub?: ReactNode
  color?: string
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,.61,.36,1)' }}
        />
      </svg>
      <div className="label" style={sub ? { lineHeight: 1.15 } : undefined}>
        <b>{label ?? `${Math.round(clamped * 100)}%`}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="grow">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="modal-body scroll-thin">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="glyph">{icon}</div>}
      <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>{title}</div>
      {hint && <div style={{ maxWidth: 340, lineHeight: 1.5 }}>{hint}</div>}
      {action}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: Array<{ id: T; label: ReactNode }>
  value: T
  onChange: (id: T) => void
  style?: CSSProperties
}) {
  return (
    <div className="tabs" style={style} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Tiny inline bar sparkline used in stat rows. */
export function Spark({ values, tone = 'var(--violet)' }: { values: number[]; tone?: string }) {
  const max = Math.max(1e-6, ...values)
  return (
    <div className="row gap-4" style={{ alignItems: 'flex-end', height: 26 }}>
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: `${Math.max(8, (v / max) * 100)}%`,
            borderRadius: 2,
            background: tone,
            opacity: 0.35 + 0.65 * (v / max),
          }}
        />
      ))}
    </div>
  )
}
