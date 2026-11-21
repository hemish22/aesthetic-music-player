import { useEffect, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, type Settings, type UpdateSettings } from '../settings'
import { Icon } from './icons'

interface Props {
  settings: Settings
  update: UpdateSettings
  reset: () => void
  onClose: () => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  )
}

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const { label, value, min, max, step, format, onChange, disabled } = props
  const pct = ((value - min) / (max - min)) * 100
  return (
    <label className={`slider-row ${disabled ? 'disabled' : ''}`}>
      <span className="slider-head">
        <span>{label}</span>
        <span className="slider-value">{format(value)}</span>
      </span>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ '--p': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const px = (v: number) => `${v}px`

/** Everything customizable, grouped. Changes apply live and are saved. */
export function SettingsPanel({ settings: s, update, reset, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="glass panel settings" role="dialog" aria-label="Settings">
      <div className="panel-head">
        <div className="panel-meta">
          <div className="player-title">Settings</div>
          <div className="player-artist">Changes apply instantly and are saved</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close settings">
          <Icon name="close" size={15} />
        </button>
      </div>

      <Section title="Lyrics">
        <Slider label="Word size" value={s.wordSize} min={12} max={48} step={1} format={px} onChange={(v) => update({ wordSize: v })} />
        <Slider label="Sung word size" value={s.activeSize} min={20} max={90} step={1} format={px} onChange={(v) => update({ activeSize: v })} />
        <Slider label="Glow" value={s.lyricGlow} min={0} max={1.5} step={0.05} format={pct} onChange={(v) => update({ lyricGlow: v })} />
        <Choice
          label="Colour"
          value={s.lyricColor}
          options={[
            { value: 'match', label: 'Match' },
            { value: 'contrast', label: 'Contrast' },
          ]}
          onChange={(v) => update({ lyricColor: v })}
        />
        <Choice
          label="Font"
          value={s.lyricFont}
          options={[
            { value: 'sans', label: 'Sans' },
            { value: 'serif', label: 'Serif' },
          ]}
          onChange={(v) => update({ lyricFont: v })}
        />
        <Choice
          label="Lines per constellation"
          value={s.linesPerGroup}
          options={[
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          onChange={(v) => update({ linesPerGroup: v })}
        />
      </Section>

      <Section title="Background">
        <Slider label="Album art" value={s.coverOpacity} min={0} max={1} step={0.05} format={pct} onChange={(v) => update({ coverOpacity: v })} />
        <Slider label="Dotted effect" value={s.specks} min={0} max={1.5} step={0.05} format={(v) => (v === 0 ? 'Off' : pct(v))} onChange={(v) => update({ specks: v })} />
        <Toggle label="Soft focus" checked={s.coverSoftFocus} onChange={(v) => update({ coverSoftFocus: v })} />
        <Toggle label="Film scratches" checked={s.scratches} onChange={(v) => update({ scratches: v })} />
        <Toggle label="Glow behind clock" checked={s.coverGlow} onChange={(v) => update({ coverGlow: v })} />
      </Section>

      <Section title="Clock">
        <Toggle label="Show time" checked={s.showTime} onChange={(v) => update({ showTime: v })} />
        <Toggle label="Show date" checked={s.showDate} onChange={(v) => update({ showDate: v })} />
        <Choice
          label="Format"
          value={s.hour12 ? '12' : '24'}
          options={[
            { value: '24', label: '24h' },
            { value: '12', label: '12h' },
          ]}
          onChange={(v) => update({ hour12: v === '12' })}
        />
        <Slider label="Size" value={s.clockSize} min={0.6} max={1.4} step={0.05} format={pct} disabled={!s.showTime && !s.showDate} onChange={(v) => update({ clockSize: v })} />
      </Section>

      <Section title="Effects">
        <Toggle label="Edge glow" checked={s.edgeGlow} onChange={(v) => update({ edgeGlow: v })} />
        <Slider
          label="Edge glow lap"
          value={s.edgeSpeed}
          min={3}
          max={20}
          step={0.5}
          format={(v) => `${v}s`}
          disabled={!s.edgeGlow}
          onChange={(v) => update({ edgeSpeed: v })}
        />
        <Slider
          label="Edge glow length"
          value={s.edgeLength}
          min={0.03}
          max={0.6}
          step={0.01}
          format={pct}
          disabled={!s.edgeGlow}
          onChange={(v) => update({ edgeLength: v })}
        />
        <Toggle label="Cursor glow" checked={s.cursorGlow} onChange={(v) => update({ cursorGlow: v })} />
        <Toggle label="Mini controls on screen" checked={s.miniControls} onChange={(v) => update({ miniControls: v })} />
      </Section>

      <button
        className="pill small reset"
        onClick={reset}
        disabled={JSON.stringify(s) === JSON.stringify(DEFAULT_SETTINGS)}
      >
        Reset to defaults
      </button>
    </div>
  )
}
