import type { ReactNode } from 'react';
import { I } from '../icons';

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      <div className="card rows">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  children,
  stack,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  stack?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className={'row' + (stack ? ' stack' : '')}>
      <div className="row-label">
        {htmlFor ? (
          <label htmlFor={htmlFor}>
            <strong>{label}</strong>
          </label>
        ) : (
          <strong>{label}</strong>
        )}
        {hint && <span>{hint}</span>}
      </div>
      <div className="row-ctl">{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  tip,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tip?: string;
}) {
  return (
    <span className="toggle" data-tip={tip ?? `${label}: ${checked ? 'on. Click to turn off' : 'off. Click to turn on'}`}>
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </span>
  );
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  id,
  tip,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  id?: string;
  tip?: string;
}) {
  return (
    <span className="select" data-tip={tip}>
      <select
        id={id}
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const hit = options.find((o) => String(o.value) === e.target.value);
          if (hit) onChange(hit.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <I.chevron />
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; tip?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          data-tip={value === o.value ? `${o.tip ?? o.label} (selected)` : o.tip ?? `Use ${o.label}`}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="slider">
      <input
        type="range"
        aria-label={label}
        data-tip={`Drag to change ${label.toLowerCase()}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>{format(value)}</output>
      <button
        type="button"
        className="icon-btn"
        data-tip={`Back to the default ${label.toLowerCase()}`}
        aria-label={`Reset ${label.toLowerCase()}`}
        onClick={() => onChange(1)}
      >
        <I.refresh />
      </button>
    </div>
  );
}
