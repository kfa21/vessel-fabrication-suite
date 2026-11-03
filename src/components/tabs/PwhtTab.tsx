import { Card, Note, Pill, Stat } from '../ui';
import { fmt, money, round, type VesselCalc } from '../../lib/engine';

function CycleChart({ curve, tMin, tMax }: { curve: { t: number; temp: number }[]; tMin: number; tMax: number }) {
  const W = 620, H = 190;
  const pad = { l: 42, r: 14, t: 14, b: 26 };
  const maxT = Math.max(...curve.map((p) => p.t), 1);
  const maxTemp = 700;
  const x = (t: number) => pad.l + (t / maxT) * (W - pad.l - pad.r);
  const y = (temp: number) => H - pad.b - (temp / maxTemp) * (H - pad.t - pad.b);
  const d = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {[0, 100, 200, 300, 400, 500, 600, 700].map((tp) => (
        <g key={tp}>
          <line className="grid-l" x1={pad.l} x2={W - pad.r} y1={y(tp)} y2={y(tp)} />
          <text x={pad.l - 6} y={y(tp) + 3} textAnchor="end">{tp}</text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line className="grid-l" x1={x(maxT * f)} x2={x(maxT * f)} y1={pad.t} y2={H - pad.b} />
          <text x={x(maxT * f)} y={H - 10} textAnchor="middle">{round(maxT * f, 1)} h</text>
        </g>
      ))}
      <rect x={pad.l} y={y(tMax)} width={W - pad.l - pad.r} height={Math.max(1, y(tMin) - y(tMax))} fill="rgba(240,166,56,.08)" />
      <line x1={pad.l} x2={W - pad.r} y1={y(tMin)} y2={y(tMin)} stroke="#f0a638" strokeWidth="0.7" strokeDasharray="3 3" opacity=".55" />
      <line x1={pad.l} x2={W - pad.r} y1={y(tMax)} y2={y(tMax)} stroke="#f0a638" strokeWidth="0.7" strokeDasharray="3 3" opacity=".55" />
      <line className="axis" x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} />
      <line className="axis" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      <path d={d} fill="none" stroke="#48c9d9" strokeWidth="1.8" strokeLinejoin="round" />
      <text x={pad.l + 5} y={pad.t + 9} fill="#66748a">°C</text>
    </svg>
  );
}

export default function PwhtTab({ calc, fleet, onToggle }: {
  calc: VesselCalc; fleet: VesselCalc[]; onToggle: (id: string) => void;
}) {
  const v = calc.vessel;
  const p = calc.pwht;
  const active = fleet.filter((c) => c.pwht.active);
  const charges = active.reduce<Record<string, { ids: string[]; kg: number; hours: number; temp: number }>>((acc, c) => {
    const key = `F-${c.pwht.tempMax}/${c.pwht.holdHours}`;
    const row = acc[key] ?? { ids: [], kg: 0, hours: 0, temp: c.pwht.tempMax };
    row.ids.push(c.vessel.id);
    row.kg += c.pwht.chargeKg;
    row.hours = Math.max(row.hours, c.pwht.furnaceHours);
    acc[key] = row;
    return acc;
  }, {});
  const totalFurnaceHours = Object.values(charges).reduce((a, r) => a + r.hours, 0);
  const totalCost = active.reduce((a, c) => a + c.pwht.cost, 0);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className={`pwht-hero ${p.active ? 'on' : ''}`}>
        <div
          className={`switch ${p.active ? 'on' : ''}`}
          style={{ width: 52, height: 28, cursor: 'pointer', flex: '0 0 auto' }}
          onClick={() => onToggle(v.id)}
          role="switch" aria-checked={p.active} tabIndex={0}
          onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') onToggle(v.id); }}
        />
        <div>
          <h4>Post-weld heat treatment — {p.active ? 'queued to furnace' : 'not scheduled'}</h4>
          <p>{p.reason}</p>
          <div className="row" style={{ marginTop: 6 }}>
            {p.required && <Pill tone="warn">required by specification</Pill>}
            {!p.required && <Pill tone="ok">not mandatory</Pill>}
            <Pill>{p.tempMin}–{p.tempMax} °C hold</Pill>
            <Pill>{p.holdHours} h hold</Pill>
          </div>
        </div>
        <button className={`furnace-btn ${p.active ? 'on' : ''}`} onClick={() => onToggle(v.id)}>
          {p.active ? '✓ PWHT pushed — remove from charge' : '🔥 Push to PWHT furnace'}
        </button>
      </div>

      {p.required && !p.active && (
        <Note tone="red">
          <b>Specification hold.</b> This vessel is marked PWHT in the datasheet ({v.id}). Welding and NDT may
          proceed, but hydrotest, final NDT and dispatch cannot be released until the furnace cycle and hardness
          survey are complete. The toggle is manual so the planner decides the charge window.
        </Note>
      )}
      {!p.required && p.active && (
        <Note tone="amber">
          PWHT is not mandatory for this vessel. It has been added voluntarily — confirm with the client that the
          extra cycle is worth the cost ({money(p.cost)}) and the {p.holdHours} h hold at {p.tempMin}–{p.tempMax} °C.
          Note that PWHT of P-No.1 above 32 mm also triggers post-PWHT NDT and a hardness survey.
        </Note>
      )}

      <div className="grid g23">
        <Card title="Heat treatment cycle" sub={`furnace chart — ${v.id}`}>
          <CycleChart curve={p.curve} tMin={p.tempMin} tMax={p.tempMax} />
          <div className="legend-row" style={{ marginTop: 4 }}>
            <span><i style={{ background: '#48c9d9' }} />programmed furnace temperature</span>
            <span><i style={{ background: '#f0a638' }} />hold band {p.tempMin}–{p.tempMax} °C</span>
            <span>total furnace time {p.furnaceHours} h</span>
          </div>
        </Card>

        <Card title="Cycle parameters" sub="UCS-56 for P-No.1">
          <dl className="kv">
            <dt>Charge weight</dt><dd>{fmt(p.chargeKg)} kg</dd>
            <dt>Max thickness</dt><dd>{Math.max(calc.thk.tShell, calc.thk.tHeadBot)} mm</dd>
            <dt>Hold temperature</dt><dd>{p.tempMin} – {p.tempMax} °C</dd>
            <dt>Hold time</dt><dd>{p.holdHours} h (1 h / 25 mm, min 1 h)</dd>
            <dt>Heating rate &gt; 425 °C</dt><dd>≤ {p.heatRate} °C/h</dd>
            <dt>Cooling rate &gt; 425 °C</dt><dd>≤ {p.coolRate} °C/h</dd>
            <dt>Furnace atmosphere</dt><dd>air, oxidising, no sulphur</dd>
            <dt>Thermocouples</dt><dd>{p.thermocouples} (attached, calibrated)</dd>
            <dt>Hardness after PWHT</dt><dd>≤ {p.hardnessMax} HB</dd>
            <dt>Cost</dt><dd>{p.active ? money(p.cost) : '—'}</dd>
          </dl>
          <Note tone="amber">
            Heat-up and cool-down rates are controlled above 425 °C. The vessel is supported on temporary
            saddles to allow thermal expansion; all internal water and loose parts removed. Charging and
            discharge temperatures &lt; 120 °C.
          </Note>
        </Card>
      </div>

      <div className="grid g3">
        <Stat label="PWHT vessels in scope" value={active.length} unit={`of ${fleet.length}`} hint="pushed to furnace" tone="amber" />
        <Stat label="Furnace charges" value={Object.keys(charges).length} hint={`${round(totalFurnaceHours, 1)} cumulative furnace hours`} />
        <Stat label="Heat-treatment cost" value={money(totalCost)} hint="setup + charge weight + furnace hours" />
      </div>

      <Card title="Furnace charge schedule" sub="grouped by hold temperature / cycle" flush>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Charge</th><th>Vessels</th><th className="num">Charge kg</th><th className="num">Hold °C</th><th className="num">Furnace h</th><th>Status</th></tr></thead>
            <tbody>
              {Object.entries(charges).map(([key, c]) => (
                <tr key={key}>
                  <td className="mono">{key}</td>
                  <td className="small">{c.ids.join(', ')}</td>
                  <td className="num">{fmt(c.kg)}</td>
                  <td className="num">{c.temp}</td>
                  <td className="num">{c.hours}</td>
                  <td><Pill tone="warn">planned</Pill></td>
                </tr>
              ))}
              {!Object.keys(charges).length && (
                <tr><td colSpan={6} className="muted small">No vessel is currently pushed to PWHT. Use the toggle above or the furnace switch in the vessel header.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Post-PWHT inspection" sub="mandatory after the cycle">
          <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--txt-2)', lineHeight: 1.85 }}>
            <li>Furnace chart review — all thermocouples within band, hold time achieved (record retained in MDR).</li>
            <li>MT 100% of attachment welds, nozzle welds, skirt closure and temporary attachment areas.</li>
            <li>UT/RT 10% of butt welds after PWHT (or full RT where E = 1.00 was used and specified).</li>
            <li>Hardness survey: 10% of welds, minimum 3 per vessel, ≤ 200 HB {v.h2s ? '— 100% for wet H2S service' : ''}.</li>
            <li>Dimensional check after cooling — distortion due to PWHT to be within drawing tolerance.</li>
            <li>Hydrotest after PWHT and final NDT (never before PWHT when PWHT is required).</li>
          </ul>
        </Card>

        <Card title="Furnace loading rules">
          <div className="small" style={{ display: 'grid', gap: 8, color: 'var(--txt-2)' }}>
            <div><b style={{ color: 'var(--txt)' }}>Thermocouples.</b> Minimum {p.thermocouples} on this vessel:
              2 at the top head, 2 at the shell mid-height, 2 at the bottom head, 1 on the skirt, plus 1 furnace
              control couple. All attached with capacitive discharge or tack welds that are later ground and MT'd.</div>
            <div><b style={{ color: 'var(--txt)' }}>Supports.</b> Vessel on 2 temporary saddles at 0.2 L from each
              tangent, free to expand; no restraint from pipes or clamps.</div>
            <div><b style={{ color: 'var(--txt)' }}>Atmosphere.</b> Clean, low-sulphur fuel; no direct flame
              impingement. Purge if the vessel contained hydrocarbons.</div>
            <div><b style={{ color: 'var(--txt)' }}>Records.</b> Chart recorder plus digital log at 5-minute
              intervals; signed by QC and client inspector if a hold point.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
