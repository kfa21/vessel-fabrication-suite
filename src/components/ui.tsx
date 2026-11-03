import type { ReactNode } from 'react';

export function Card({ title, sub, right, children, flush }: {
  title?: string; sub?: string; right?: ReactNode; children: ReactNode; flush?: boolean;
}) {
  return (
    <section className="card">
      {title && (
        <div className="card-head">
          <h3>{title}</h3>
          {sub && <span className="sub">{sub}</span>}
          {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
        </div>
      )}
      <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, unit, hint, tone }: {
  label: string; value: ReactNode; unit?: string; hint?: string; tone?: 'amber' | 'cyan' | 'green';
}) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="lbl">{label}</div>
      <div className="val">{value}{unit && <small>{unit}</small>}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Pill({ tone, children }: { tone?: 'ok' | 'warn' | 'bad' | 'info'; children: ReactNode }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

export function Bar({ pct, tone }: { pct: number; tone?: 'ok' | 'warn' | 'bad' }) {
  const w = Math.max(1.5, Math.min(100, pct));
  const bg = tone === 'bad' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : 'var(--green)';
  return (
    <div style={{ height: 5, background: '#1d2531', borderRadius: 3, minWidth: 60, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: bg, borderRadius: 3 }} />
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Note({ tone, children }: { tone?: 'amber' | 'red' | 'cyan'; children: ReactNode }) {
  return <div className={`note ${tone ?? ''}`}>{children}</div>;
}
