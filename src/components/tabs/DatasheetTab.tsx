import { useMemo, useState } from 'react';
import { Pill, downloadCsv } from '../ui';
import { fmt, money, round, type VesselCalc } from '../../lib/engine';
import { datasheetFor, type Vessel, type HeadKind, type Orientation } from '../../data/vessels';

type RowKind = 'text' | 'number' | 'select' | 'yesno' | 'static';

interface Row {
  label: string;
  kind: RowKind;
  field?: keyof Vessel;
  options?: { v: string | number; l: string }[];
  value?: (v: Vessel, c: VesselCalc) => string;
  unit?: string;
  note?: string;
  /** field does not exist on the original UOP datasheet — added for the calculation basis */
  isNew?: boolean;
  step?: number;
  wide?: boolean;
}

interface Section {
  no: number;
  title: string;
  sub: string;
  rows: Row[];
  table?: boolean;
}

const SELECTS: Record<string, { v: string | number; l: string }[]> = {
  kind: [
    { v: 'Column', l: 'Column' },
    { v: 'Drum', l: 'Drum' },
    { v: 'Receiver', l: 'Receiver' },
    { v: 'Treater', l: 'Treater' },
    { v: 'Separator', l: 'Separator' },
  ],
  orientation: [
    { v: 'V', l: 'Vertical' },
    { v: 'H', l: 'Horizontal' },
  ],
  head: [
    { v: 'SE', l: '2:1 Elliptical' },
    { v: 'FLAT', l: 'Flat' },
    { v: 'CONE', l: 'Conical' },
  ],
  support: [
    { v: 'Skirt', l: 'Skirt' },
    { v: 'Legs', l: 'Legs' },
    { v: 'Saddles', l: 'Saddles' },
  ],
  rt: [
    { v: 'Full', l: 'Full RT' },
    { v: 'Spot', l: 'Spot RT' },
  ],
  class: [150, 300, 600, 900, 1500, 2500].map((n) => ({ v: n, l: `CL${n}` })),
  yesno: [
    { v: 'true', l: 'Yes' },
    { v: 'false', l: 'No' },
  ],
};

const headLabel = (h: HeadKind) => (h === 'FLAT' ? 'Flat' : h === 'CONE' ? 'Conical' : '2:1 Elliptical');

export default function DatasheetTab({ vessel, calc, onPatch, onReset, isOverridden }: {
  vessel: Vessel;
  calc: VesselCalc;
  onPatch: (patch: Partial<Vessel>) => void;
  onReset: () => void;
  isOverridden: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const set = (field: keyof Vessel, raw: string, kind: RowKind) => {
    setDraft((d) => ({ ...d, [field]: raw }));
    if (kind === 'number') {
      if (raw === '' || raw === '-') return;
      const n = Number(raw);
      if (Number.isFinite(n)) onPatch({ [field]: n } as Partial<Vessel>);
      return;
    }
    if (kind === 'yesno') {
      onPatch({ [field]: raw === 'true' } as Partial<Vessel>);
      return;
    }
    if (field === 'orientation') {
      onPatch({ orientation: raw as Orientation, support: raw === 'H' ? 'Saddles' : vessel.support } as Partial<Vessel>);
      return;
    }
    onPatch({ [field]: raw } as Partial<Vessel>);
  };

  const ds = useMemo(() => datasheetFor(vessel.id), [vessel.id]);
  const nozzleCount = vessel.nozzles.reduce((a, n) => a + n.qty, 0);
  const manways = vessel.nozzles.filter((n) => n.nps >= 18);
  const padRows = calc.thk.reinf.filter((r) => r.padArea > 0);
  const overrideCount = Object.keys(draft).length;

  const sections: Section[] = useMemo(() => [
    {
      no: 0,
      title: 'Datasheet — Excel sequence',
      sub: 'Issued client datasheet (Book3), same columns and order. Design pressure, temperature and orientation stay live and editable; the other columns are the values as issued.',
      rows: [
        { label: 'S. No.', kind: 'static', value: () => (ds ? String(ds.sno) : '—') },
        { label: 'Unit', kind: 'static', value: () => ds?.unit ?? '—' },
        { label: 'Tag no.', kind: 'static', value: () => vessel.id },
        { label: 'Service', kind: 'static', value: () => ds?.service ?? vessel.service },
        { label: 'Orientation', kind: 'select', field: 'orientation', options: SELECTS.orientation },
        { label: 'Design pressure', kind: 'number', field: 'p', unit: 'kg/cm²(g)', step: 0.5 },
        { label: 'Design temperature', kind: 'number', field: 'designTempC', unit: '°C', step: 5 },
        { label: 'MOC', kind: 'static', value: () => ds?.moc ?? '—' },
        { label: 'Size', kind: 'static', value: () => ds?.size ?? '—' },
        { label: 'Special service', kind: 'static', value: () => ds?.specialService ?? '—' },
        { label: 'Shell thickness', kind: 'static', value: () => ds?.shellThk ?? '—' },
        { label: 'Top head thickness', kind: 'static', value: () => ds?.headTopThk ?? '—' },
        { label: 'Bottom head thickness', kind: 'static', value: () => ds?.headBotThk ?? '—' },
        { label: 'Design pressure (as issued)', kind: 'static', value: () => ds?.p ?? '—' },
      ],
    },
    {
      no: 1,
      title: 'Identification',
      sub: 'Equipment identification and basic design data',
      rows: [
        { label: 'Equipment item no.', kind: 'text', field: 'id' },
        { label: 'Service', kind: 'text', field: 'service', wide: true },
        { label: 'Equipment type', kind: 'select', field: 'kind', options: SELECTS.kind },
        { label: 'Construction', kind: 'static', value: (v) => v.kind },
        { label: 'Orientation', kind: 'select', field: 'orientation', options: SELECTS.orientation },
        { label: 'Project unit', kind: 'static', value: (v) => v.unit },
        { label: 'Spec / datasheet', kind: 'static', value: (v) => v.spec },
        { label: 'Design pressure', kind: 'number', field: 'p', unit: 'kg/cm²(g)', step: 0.5 },
        { label: 'Design temperature', kind: 'number', field: 'designTempC', unit: '°C', step: 5 },
        { label: 'MDMT', kind: 'number', field: 'mdmtC', unit: '°C', step: 1 },
        { label: 'Corrosion allowance', kind: 'number', field: 'ca', unit: 'mm', step: 0.5 },
        { label: 'Flange / nozzle class', kind: 'select', field: 'asmeClass', options: SELECTS.class, isNew: true },
        { label: 'Radiography', kind: 'select', field: 'rtPolicy', options: SELECTS.rt, isNew: true },
        { label: 'PWHT required', kind: 'yesno', field: 'pwhtRequired', isNew: true },
        { label: 'Full vacuum design', kind: 'yesno', field: 'vacuum', isNew: true },
        { label: 'Wet H₂S service', kind: 'yesno', field: 'h2s', isNew: true },
      ],
    },
    {
      no: 2,
      title: 'Shell segment 1',
      sub: 'Governing (lower) shell — thickness from UG-27(c)(1)',
      rows: [
        { label: 'Inside diameter', kind: 'number', field: 'di', unit: 'mm', step: 50 },
        { label: 'Upper inside diameter', kind: 'number', field: 'diTop', unit: 'mm', step: 50, isNew: true },
        { label: 'T/T length', kind: 'number', field: 'tt', unit: 'mm', step: 50 },
        { label: 'Shell material', kind: 'static', value: () => 'SA-516 Gr.70', isNew: true },
        { label: 'Shell thickness (calculated)', kind: 'static', value: (_v, c) => `${thick(c, 'shell-circ')} mm`, isNew: true },
        { label: 'Upper shell thickness', kind: 'static', value: (_v, c) => (c.vessel.diTop ? `${thick(c, 'shell-top')} mm` : '—'), isNew: true },
        { label: 'Stiffener rings', kind: 'static', value: (_v, c) => (c.thk.external.ringsRequired ? `${c.thk.external.ringsRequired} off · spacing ${c.thk.external.ringSpacingMm} mm` : 'not required'), isNew: true },
        { label: 'Total length (incl. heads & skirt)', kind: 'static', value: (_v, c) => `${fmt(c.calc.totalLengthM / 1000, 1)} m`, isNew: true },
      ],
    },
    {
      no: 3,
      title: 'Vessel head 1',
      sub: 'Top and bottom dished ends — UG-32 / UG-34',
      rows: [
        { label: 'Top head type', kind: 'select', field: 'headTop', options: SELECTS.head },
        { label: 'Bottom head type', kind: 'select', field: 'headBot', options: SELECTS.head },
        { label: 'Top head thickness', kind: 'static', value: (_v, c) => `${thick(c, c.vessel.headTop === 'FLAT' ? 'head-top-flat' : 'head-top')} mm`, isNew: true },
        { label: 'Bottom head thickness', kind: 'static', value: (_v, c) => `${thick(c, c.vessel.headBot === 'FLAT' ? 'head-bot-flat' : 'head-bot')} mm`, isNew: true },
        { label: 'Cone transition', kind: 'static', value: (_v, c) => (c.vessel.diTop ? `${thick(c, 'cone')} mm` : 'not applicable'), isNew: true },
        { label: 'Governing thickness', kind: 'static', value: (_v, c) => `${c.thk.govern}`, isNew: true },
        { label: 'Dishend material', kind: 'static', value: () => 'SA-516 Gr.70', isNew: true },
      ],
    },
    {
      no: 4,
      title: 'Nozzles',
      sub: `${vessel.nozzles.length} unique marks · ${nozzleCount} off total · flange CL${vessel.asmeClass} RF`,
      rows: [
        { label: 'Nozzle schedule', kind: 'static', value: () => '10 / 20 / 40 / 80 / 80S / STD / XS / XXS', isNew: true },
        { label: 'Flange face', kind: 'static', value: () => 'RF (BLRF / WNRF)', isNew: true },
        { label: 'Reinforcement pads required', kind: 'static', value: () => (padRows.length ? `${padRows.length} off · ${padRows.map((p) => `${p.mark} ${p.padWidth}×${p.padThk}`).join(', ')}` : 'none — all self-reinforced'), isNew: true },
        { label: 'Nozzle pipe material', kind: 'static', value: () => 'SA-106 Gr.B', isNew: true },
        { label: 'Flange material', kind: 'static', value: () => 'SA-105', isNew: true },
        { label: 'Gasket / fasteners', kind: 'static', value: () => 'Spiral wound 304/304L + graphite · A193 B7 / A194 2H', isNew: true },
      ],
      table: true,
    },
    {
      no: 5,
      title: 'Manways',
      sub: manways.length ? `${manways.reduce((a, n) => a + n.qty, 0)} off · ${manways.map((m) => `NPS ${m.nps}`).join(', ')}` : 'No manway-sized opening on this datasheet',
      rows: [
        { label: 'Manway size', kind: 'static', value: () => (manways.length ? manways.map((m) => `NPS ${m.nps}`).join(' / ') : '—') },
        { label: 'Covers', kind: 'static', value: () => (manways.length ? `${manways.reduce((a, n) => a + n.qty, 0)} off with davit'` : '—') },
        { label: 'Gasket', kind: 'static', value: () => (manways.length ? 'Spiral wound, 6 mm, 304/304L + graphite' : '—') },
        { label: 'Fasteners', kind: 'static', value: () => (manways.length ? `${manways.reduce((a, n) => a + n.qty, 0) * 8} sets M20 × 80 · ${Math.round(manways.reduce((a, n) => a + n.qty, 0) * 0.8)} spares` : '—') },
        { label: 'Davit arm', kind: 'static', value: () => (manways.length ? 'Yes' : 'No') },
      ],
    },
    {
      no: 6,
      title: 'External support',
      sub: 'Permanent support and transportation arrangement',
      rows: [
        { label: 'Permanent support', kind: 'select', field: 'support', options: SELECTS.support },
        { label: 'Support quantity', kind: 'static', value: (v) => (v.support === 'Saddles' ? '2 off (1 fixed + 1 sliding)' : v.support === 'Legs' ? '4 off' : '1 off skirt') },
        { label: 'Saddle bearing width', kind: 'static', value: (v) => `${saddleW(v)} mm`, isNew: true },
        { label: 'Saddle height', kind: 'static', value: (v) => `${saddleH(v)} mm`, isNew: true },
        { label: 'Transportation saddles', kind: 'static', value: (v) => (v.orientation === 'H' ? 'not applicable — travels on permanent saddles' : '2 off shipping cradles at 0.3 L from each tangent line'), isNew: true },
        { label: 'Transportation saddle spacing', kind: 'static', value: (v) => (v.orientation === 'H' ? '—' : `${fmt((v.tt * 0.6) / 1000, 2)} m`), isNew: true },
        { label: 'Lifting lugs / trunnions', kind: 'static', value: () => lugsFor(calc), isNew: true },
        { label: 'Shipping weight', kind: 'static', value: (_v, c) => `${fmt(c.weight.total / 1000, 2)} t`, isNew: true },
      ],
    },
    {
      no: 7,
      title: 'Ladders',
      sub: 'Access equipment',
      rows: [
        { label: 'Caged ladder', kind: 'static', value: (v) => (v.orientation === 'V' && v.tt > 2500 ? `1 set · ${fmt(v.tt / 1000, 1)} m` : 'not required') },
        { label: 'Rest platforms', kind: 'static', value: (v) => (v.orientation === 'V' && v.tt > 6000 ? `${Math.ceil(v.tt / 6000)} off` : 'not required') },
        { label: 'Stairs', kind: 'static', value: () => 'by others' },
      ],
    },
    {
      no: 8,
      title: 'Platforms',
      sub: 'Walkways and standing areas',
      rows: [
        { label: 'Platform area', kind: 'static', value: (v) => (v.orientation === 'V' && v.tt > 6000 ? `${round((Math.PI * ((v.di + 300) / 1000)) * 1.2 * Math.ceil(v.tt / 6000), 1)} m²` : 'by others') },
        { label: 'Grating', kind: 'static', value: () => 'SA-36 galvanised' },
      ],
    },
    {
      no: 9,
      title: 'Internal rungs / rings',
      sub: 'Tray support rings and vacuum stiffeners',
      rows: [
        { label: 'Tray support rings', kind: 'static', value: (v) => (v.trays ? `${v.trays} off · 50 × 8 flats` : 'not required') },
        { label: 'Vacuum stiffener rings', kind: 'static', value: (_v, c) => (c.thk.external.ringsRequired ? `${c.thk.external.ringsRequired} off` : 'not required') },
        { label: 'Material', kind: 'static', value: () => 'SA-516 Gr.70' },
      ],
    },
    {
      no: 10,
      title: 'Baffles / trays',
      sub: 'Internals that set the process duty',
      rows: [
        { label: 'Trays', kind: 'static', value: (v) => (v.trays ? `${v.trays} off` : '—') },
        { label: 'Tray type', kind: 'static', value: (v) => v.trayType ?? '—' },
        { label: 'Bed depth', kind: 'static', value: (v) => (v.bedDepth ? `${v.bedDepth} mm` : '—') },
        { label: 'Packing', kind: 'static', value: (v) => v.packing ?? '—' },
      ],
    },
    {
      no: 11,
      title: 'Demisters',
      sub: 'Mist eliminator',
      rows: [
        { label: 'Mist eliminator', kind: 'static', value: (v) => (has(v, 'mist eliminator') ? '1 off — by others, support by fabricator' : 'not required') },
        { label: 'Material', kind: 'static', value: () => 'Alloy 400 / 304' },
      ],
    },
    {
      no: 12,
      title: 'Coalescers',
      sub: 'Coalescing equipment',
      rows: [
        { label: 'Coalescer', kind: 'static', value: (v) => (has(v, 'coalescer') ? '1 off · 300 mm — by others' : 'not required') },
        { label: 'Material', kind: 'static', value: () => 'Type 316' },
      ],
    },
    {
      no: 13,
      title: 'Vortex breaker',
      sub: 'Outlet protection',
      rows: [
        { label: 'Vortex breaker', kind: 'static', value: (v) => (has(v, 'vortex') || ['Drum', 'Receiver'].includes(v.kind) ? '1 off' : 'not required') },
        { label: 'Plate thickness', kind: 'static', value: () => '10 mm' },
      ],
    },
    {
      no: 14,
      title: 'Boot / drop leg',
      sub: 'Outlet configuration',
      rows: [
        { label: 'Boot provided', kind: 'static', value: (v) => (v.dropLeg ? 'Yes' : 'No') },
        { label: 'Boot OD', kind: 'static', value: (v) => (v.dropLeg ? `${v.dropLeg.od} mm` : '—') },
        { label: 'Boot thickness', kind: 'static', value: (v) => (v.dropLeg ? `${fmt(v.dropLeg.tt)} mm` : '—') },
        { label: 'Boot corrosion allowance', kind: 'static', value: (v) => (v.dropLeg ? `${v.caLeg ?? v.ca} mm` : '—') },
      ],
    },
  ], [vessel, calc, padRows, ds]);

  const exportCsv = () => downloadCsv(`Datasheet-${vessel.id}.csv`, [
    ['UOP DATASHEET', vessel.id, vessel.service],
    ['Section', 'Field', 'Value', 'Source'],
    ...sections.flatMap((s) => s.rows.map((r) => [
      `${s.no + 1}. ${s.title}`,
      r.label,
      r.kind === 'static' ? (r.value?.(vessel, calc) ?? '') : display(vessel, r, draft),
      r.isNew ? 'added for calculation basis' : 'datasheet',
    ])),
  ]);

  return (
    <div className="ds">
      <div className="ds-bar">
        <div className="ds-bar-id">
          <span className="ds-tag">{vessel.id}</span>
          <div>
            <b>{vessel.service}</b>
            <span>
              {vessel.kind} · {vessel.orientation === 'V' ? 'vertical' : 'horizontal'} · Ø{vessel.di}
              {vessel.diTop ? `/${vessel.diTop}` : ''} mm · {fmt(vessel.tt)} mm T/T
            </span>
          </div>
        </div>
        <div className="ds-bar-actions">
          {isOverridden && <Pill tone="warn">{overrideCount || 'edited'} field{overrideCount === 1 ? '' : 's'} overridden</Pill>}
          <button className="btn sm" onClick={exportCsv}>↓ Export CSV</button>
          {isOverridden && <button className="btn sm" onClick={() => { setDraft({}); onReset(); }}>Reset to datasheet</button>}
          <button className={editing ? 'btn sm on' : 'btn sm'} onClick={() => setEditing((e) => !e)}>
            {editing ? '✓ Done editing' : '✎ Edit values'}
          </button>
        </div>
      </div>

      <div className="ds-basis">
        <div><span>Shell (calc)</span><b>{calc.thk.tShell} mm</b></div>
        <div><span>Head (calc)</span><b>{calc.thk.tHeadTop} / {calc.thk.tHeadBot} mm</b></div>
        <div><span>Total length</span><b>{fmt(calc.calc.totalLengthM / 1000, 2)} m</b></div>
        <div><span>Fabricated weight</span><b>{fmt(calc.weight.total / 1000, 2)} t</b></div>
        <div><span>Weld length</span><b>{fmt(calc.weld.totalLengthM)} m</b></div>
        <div><span>Man-hours</span><b>{fmt(calc.manhours)}</b></div>
        <div><span>Estimated value</span><b>{money(calc.cost.total)}</b></div>
      </div>

      <div className="ds-legend">
        <span className="ds-new-chip">NEW</span>
        <span>fields added for the calculation basis — not present on the original UOP datasheet.</span>
      </div>

      {sections.map((s) => (
        <section className="ds-sec" key={s.no}>
          <header className="ds-sec-head">
            <span className="ds-sec-no">{String(s.no + 1).padStart(2, '0')}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.sub}</p>
            </div>
          </header>

          <div className="ds-grid">
            {s.rows.map((r) => (
              <div className={r.isNew ? 'ds-row ds-row-new' : 'ds-row'} key={r.label}>
                <span className="ds-label">
                  {r.label}
                  {r.isNew && <span className="ds-new-chip">NEW</span>}
                </span>
                <span className="ds-value">
                  {editing && r.kind !== 'static' && r.field ? (
                    <Control vessel={vessel} row={r} draft={draft} onChange={set} />
                  ) : r.kind === 'static' ? (
                    <>{r.value?.(vessel, calc) ?? '—'}</>
                  ) : (
                    <>
                      {display(vessel, r, draft)}
                      {r.unit && <span className="ds-unit"> {r.unit}</span>}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>

          {s.table && (
            <div className="ds-nozzles">
              <table>
                <thead>
                  <tr><th>Mark</th><th>Service</th><th>NPS</th><th>Qty</th><th>Class</th><th>OD mm</th><th>Wall mm</th><th>Reinforcement</th></tr>
                </thead>
                <tbody>
                  {vessel.nozzles.map((n) => {
                    const rf = calc.thk.reinf.find((x) => x.mark === n.mark);
                    return (
                      <tr key={n.mark}>
                        <td className="mono">{n.mark}</td>
                        <td>{n.service}</td>
                        <td>{n.nps}</td>
                        <td>{n.qty}</td>
                        <td>CL{n.cls ?? vessel.asmeClass}</td>
                        <td>{rf ? rf.od.toFixed(0) : '—'}</td>
                        <td>{rf ? rf.wall.toFixed(1) : '—'}</td>
                        <td>{rf?.status === 'Pad required' ? `Pad ${rf.padWidth}×${rf.padThk}` : 'Self-reinforced'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <p className="ds-foot">
        Every value here is the input to the suite's calculations: change a field and shell/head thickness,
        weights, weld lengths, BOQ take-off and cost are recomputed for all tabs. Fields tagged
        <span className="ds-new-chip">NEW</span> were added by this suite and are not on the original UOP sheet.
      </p>
    </div>
  );
}

function Control({ vessel, row, draft, onChange }: {
  vessel: Vessel;
  row: Row;
  draft: Record<string, string>;
  onChange: (field: keyof Vessel, raw: string, kind: RowKind) => void;
}) {
  const field = row.field!;
  const current = draft[field] ?? String(vessel[field] ?? '');

  if (row.kind === 'select') {
    return (
      <select className="ds-input" value={current} onChange={(e) => onChange(field, e.target.value, 'select')}>
        {row.options?.map((o) => <option key={String(o.v)} value={String(o.v)}>{o.l}</option>)}
      </select>
    );
  }
  if (row.kind === 'yesno') {
    return (
      <select className="ds-input" value={String(Boolean(vessel[field]))} onChange={(e) => onChange(field, e.target.value, 'yesno')}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (row.kind === 'number') {
    return (
      <input
        className="ds-input"
        type="number"
        step={row.step ?? 1}
        value={current}
        onChange={(e) => onChange(field, e.target.value, 'number')}
      />
    );
  }
  return (
    <input className="ds-input" value={current} onChange={(e) => onChange(field, e.target.value, 'text')} />
  );
}

function display(vessel: Vessel, row: Row, draft: Record<string, string>): string {
  if (!row.field) return '';
  const raw = draft[row.field] ?? String(vessel[row.field] ?? '');
  if (row.field === 'orientation') return raw === 'H' ? 'Horizontal' : 'Vertical';
  if (row.field === 'headTop' || row.field === 'headBot') return headLabel(raw as HeadKind);
  if (row.field === 'pwhtRequired') return vessel.pwhtRequired ? 'Yes' : 'No';
  if (row.field === 'vacuum') return vessel.vacuum ? 'Yes' : 'No';
  if (row.field === 'h2s') return vessel.h2s ? 'Yes' : 'No';
  if (row.field === 'rtPolicy') return raw === 'Full' ? 'Full RT' : 'Spot RT';
  if (row.field === 'asmeClass') return `CL${raw}`;
  return raw || '—';
}

function thick(c: VesselCalc, key: string): string {
  const r = c.thk.rows.find((x) => x.key === key);
  return r ? `${r.tReq.toFixed(1)} → ${r.tSel}` : '—';
}

function has(v: Vessel, s: string) {
  return v.notes.join(' ').toLowerCase().includes(s);
}

function lugsFor(c: VesselCalc): string {
  const t = c.weight.total;
  const qty = t > 40000 ? 4 : 2;
  const swl = Math.max(2, Math.ceil(t / 1000 / qty));
  const boltSize = t > 40000 ? 'M24 × 100' : 'M20 × 80';
  const spareQty = Math.max(1, Math.ceil(qty / 4));
  return `${qty} off trunnions · SWL ${swl} t each · pad ${qty} off · bolt ${boltSize} · spare ${spareQty} off`;
}

function saddleW(v: Vessel): number {
  const R = (v.di + 2 * v.ca) / 2;
  return Math.max(v.orientation === 'H' ? 300 : 450, Math.round((R * (v.orientation === 'H' ? 0.7 : 0.85)) / 10) * 10);
}

function saddleH(v: Vessel): number {
  const R = (v.di + 2 * v.ca) / 2;
  return Math.max(400, Math.round((R * 0.45) / 50) * 50);
}
