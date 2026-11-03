import { Fragment, useMemo, useState } from 'react';
import { Card, Note, Pill, downloadCsv } from '../ui';
import { equipmentPartSchedule, fmt, money, round, type VesselCalc } from '../../lib/engine';
import { datasheetFor, equipClass } from '../../data/vessels';

type Opt = 'All' | string;

const rowGroups: { group: string; rows: { label: string; sub?: string; get: (c: VesselCalc) => string | number }[] }[] = [
  {
    group: 'Identification',
    rows: [
      { label: 'Service', get: (c) => c.vessel.service },
      { label: 'Unit', get: (c) => c.vessel.unit },
      { label: 'Equipment type', get: (c) => equipClass(c.vessel) },
      { label: 'Construction', get: (c) => c.vessel.kind },
      { label: 'Orientation', get: (c) => (c.vessel.orientation === 'H' ? 'Horizontal' : 'Vertical') },
      { label: 'Support', get: (c) => c.vessel.support },
      { label: 'Datasheet', get: (c) => c.vessel.spec },
    ],
  },
  {
    group: 'Design conditions',
    rows: [
      { label: 'Design pressure', sub: 'kg/cm²(g)', get: (c) => `${c.vessel.p}` },
      { label: 'Design temperature', sub: '°C', get: (c) => `${c.vessel.designTempC}` },
      { label: 'MDMT', sub: '°C', get: (c) => `${c.vessel.mdmtC}` },
      { label: 'Corrosion allowance', sub: 'mm', get: (c) => `${c.vessel.ca}` },
      { label: 'Nozzle class', get: (c) => `CL${c.vessel.asmeClass}` },
      { label: 'Radiography / E', get: (c) => `${c.vessel.rtPolicy} · ${c.thk.e.toFixed(2)}` },
      { label: 'Vacuum', get: (c) => (c.vessel.vacuum ? 'full' : '—') },
    ],
  },
  {
    group: 'Size and internals',
    rows: [
      { label: 'Inside diameter', sub: 'mm', get: (c) => `${c.vessel.di}${c.vessel.diTop ? ` / ${c.vessel.diTop}` : ''}` },
      { label: 'T/T length', sub: 'mm', get: (c) => `${c.vessel.tt}` },
      { label: 'Top head', get: (c) => (c.vessel.headTop === 'FLAT' ? 'flat' : '2:1 ellip.') },
      { label: 'Bottom head', get: (c) => (c.vessel.headBot === 'FLAT' ? 'flat' : '2:1 ellip.') },
      { label: 'Internals', get: (c) => (c.vessel.trays ? `${c.vessel.trays} trays` : c.vessel.bedDepth ? `bed ${c.vessel.bedDepth} mm` : c.vessel.packing ? 'packing' : '—') },
    ],
  },
  {
    group: 'Issued datasheet (Book3)',
    rows: [
      { label: 'Datasheet S. no.', get: (c) => datasheetFor(c.vessel.id)?.sno ?? '—' },
      { label: 'MOC', get: (c) => datasheetFor(c.vessel.id)?.moc ?? '—' },
      { label: 'Size', get: (c) => datasheetFor(c.vessel.id)?.size ?? '—' },
      { label: 'Special service', get: (c) => datasheetFor(c.vessel.id)?.specialService ?? '—' },
      { label: 'Shell thickness', sub: 'datasheet', get: (c) => datasheetFor(c.vessel.id)?.shellThk ?? '—' },
      { label: 'Top head thickness', sub: 'datasheet', get: (c) => datasheetFor(c.vessel.id)?.headTopThk ?? '—' },
      { label: 'Bottom head thickness', sub: 'datasheet', get: (c) => datasheetFor(c.vessel.id)?.headBotThk ?? '—' },
    ],
  },
  {
    group: 'Thickness — calculated → next market plate',
    rows: [
      { label: 'Shell', sub: 'mm', get: (c) => thick(c, 'shell-circ') },
      { label: 'Upper shell', sub: 'mm', get: (c) => (c.vessel.diTop ? thick(c, 'shell-top') : '—') },
      { label: 'Top dish end', sub: 'mm', get: (c) => thick(c, c.vessel.headTop === 'FLAT' ? 'head-top-flat' : 'head-top') },
      { label: 'Bottom dish end', sub: 'mm', get: (c) => thick(c, c.vessel.headBot === 'FLAT' ? 'head-bot-flat' : 'head-bot') },
      { label: 'Cone transition', sub: 'mm', get: (c) => (c.vessel.diTop ? thick(c, 'cone') : '—') },
      { label: 'Drop leg', sub: 'mm', get: (c) => (c.vessel.dropLeg ? thick(c, 'dropleg') : '—') },
    ],
  },
  {
    group: 'Fabrication',
    rows: [
      { label: 'Weld length', sub: 'm', get: (c) => fmt(c.weld.totalLengthM) },
      { label: 'Man-hours', get: (c) => fmt(c.manhours) },
      { label: 'Fabricated weight', sub: 't', get: (c) => fmt(c.weight.total / 1000, 2) },
      { label: 'Total length', sub: 'm', get: (c) => fmt(c.calc.totalLengthM / 1000, 1) },
      { label: 'PWHT', get: (c) => (c.pwht.active ? 'in furnace' : c.pwht.required ? 'required' : 'no') },
      { label: 'Shop duration', sub: 'days', get: (c) => round(Math.max(...c.schedule.map((s) => s.end)), 0) },
      { label: 'Est. value', get: (c) => money(c.cost.total) },
    ],
  },
];

function thick(c: VesselCalc, key: string): string {
  const r = c.thk.rows.find((x) => x.key === key);
  if (!r) return '—';
  return `${r.tReq.toFixed(1)} → ${r.tSel}`;
}

export default function SummaryTab({ fleet }: { fleet: VesselCalc[] }) {
  const [type, setType] = useState<Opt>('All');
  const [orient, setOrient] = useState<Opt>('All');
  const [support, setSupport] = useState<Opt>('All');
  const [pwht, setPwht] = useState<Opt>('All');
  const [q, setQ] = useState('');

  const supports = useMemo(() => ['All', ...Array.from(new Set(fleet.map((c) => c.vessel.support)))], [fleet]);
  const colCount = fleet.filter((c) => equipClass(c.vessel) === 'Column').length;
  const typeOptions = [
    { v: 'All', l: `All (${fleet.length})` },
    { v: 'Columns', l: `Columns (${String(colCount).padStart(2, '0')} Nos)` },
    { v: 'Vessels', l: `Vessels (${String(fleet.length - colCount).padStart(2, '0')} Nos)` },
  ];

  const list = useMemo(() => fleet.filter((c) => {
    const v = c.vessel;
    if (type === 'Columns' && equipClass(v) !== 'Column') return false;
    if (type === 'Vessels' && equipClass(v) !== 'Vessel') return false;
    if (orient !== 'All' && (orient === 'Vertical' ? v.orientation !== 'V' : v.orientation !== 'H')) return false;
    if (support !== 'All' && v.support !== support) return false;
    if (pwht === 'Required' && !c.pwht.required) return false;
    if (pwht === 'Pushed' && !c.pwht.active) return false;
    if (pwht === 'Not required' && c.pwht.required) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      if (!`${v.id} ${v.service} ${v.kind}`.toLowerCase().includes(needle)) return false;
    }
    return true;
  }), [fleet, type, orient, support, pwht, q]);

  const resetFilters = () => { setType('All'); setOrient('All'); setSupport('All'); setPwht('All'); setQ(''); };

  const exportMatrix = () => downloadCsv('EquipmentSummary.csv', [
    ['EQUIPMENT SUMMARY', `${list.length} items`, new Date().toISOString().slice(0, 10)],
    ['Attribute', ...list.map((c) => c.vessel.id)],
    ...rowGroups.flatMap((g) => [
      [g.group.toUpperCase(), ...list.map(() => '')],
      ...g.rows.map((r) => [r.label, ...list.map((c) => String(r.get(c)))]),
    ]),
  ]);

  const exportSheets = () => downloadCsv('EquipmentPartSchedule.csv', [
    ['EQUIPMENT PART SCHEDULE', `${list.length} items`],
    ['Equipment', 'Service', 'Part', 'Qty', 'Unit', 'Material', 'Note'],
    ...list.flatMap((c) => equipmentPartSchedule(c).map((p) => [
      c.vessel.id, c.vessel.service, p.part, p.qty, p.unit, p.material, p.note,
    ])),
  ]);

  // show message if filtered to nothing but don't block view entirely
  const showEmpty = list.length === 0;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <Card
        title="Filters"
        sub={`${list.length} of ${fleet.length} equipment`}
        right={<button className="btn sm" onClick={exportMatrix}>↓ Export summary CSV</button>}
      >
        <div className="filter-row">
          <label>
            <span>Equipment type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <label>
            <span>Orientation</span>
            <select value={orient} onChange={(e) => setOrient(e.target.value)}>
              {['All', 'Vertical', 'Horizontal'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span>Support</span>
            <select value={support} onChange={(e) => setSupport(e.target.value)}>
              {supports.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span>PWHT</span>
            <select value={pwht} onChange={(e) => setPwht(e.target.value)}>
              {['All', 'Required', 'Pushed', 'Not required'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="grow">
            <span>Tag / service</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. 10-D or splitter" />
          </label>
          <button className="btn sm" onClick={resetFilters}>Reset</button>
        </div>
      </Card>

      <Card
        title="Equipment summary — tags across, details down"
        sub={`thickness shown as calculated (pressure + CA) → next market plate gauge • ${list.length} shown`}
        flush
      >
        {showEmpty && (
          <div style={{ padding: 16, background: '#0f1218', borderBottom: '1px solid #1d2531' }}>
            <strong>No equipment matches filters.</strong> Showing {fleet.length} total equipment. <button className="btn sm" onClick={resetFilters} style={{ marginLeft: 8 }}>Reset filters</button>
          </div>
        )}
        <div className="table-wrap matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="sticky-col">Attribute</th>
                {list.map((c) => (
                  <th key={c.vessel.id}>
                    <div className="tag">{c.vessel.id}</div>
                    <div className="tag-sub">{c.vessel.service}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowGroups.map((g) => (
                <Fragment key={g.group}>
                  <tr className="rowgroup">
                    <td className="sticky-col">{g.group}</td>
                    <td colSpan={Math.max(1, list.length)} />
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={`${g.group}-${r.label}`}>
                      <td className="sticky-col">
                        {r.label}{r.sub ? <span className="muted"> ({r.sub})</span> : null}
                      </td>
                      {list.map((c) => (
                        <td key={c.vessel.id} className={g.group.startsWith('Thickness') ? 'num thick' : ''}>
                          {r.get(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-note">
          Codes are the datasheet item numbers. Thickness values are the ASME VIII Div.1 required thickness
          including corrosion allowance, followed by the standard plate gauge actually ordered (6, 8, 10, 12, 14,
          16, 18, 20, 22, 25, 28, 32, 36, 40 …). Top and bottom dished ends are sized on their own diameter, so a
          two-diameter column gets a thinner top head.
        </div>
      </Card>

      <Card
        title="Equipment part schedule — one sheet per equipment"
        sub={`${list.length} sheets · shop quantity take-off`}
        right={<button className="btn sm" onClick={exportSheets}>↓ Export part sheets CSV</button>}
      >
        <Note tone="cyan">
          Quantities are per equipment. Rows marked “not required” are kept so every sheet has the same shape as
          the shop's equipment table. Internal supply items shown as “by others” are priced in the vessel only
          where the datasheet leaves them with the fabricator.
        </Note>
      </Card>

      {list.map((c) => {
        const rows = equipmentPartSchedule(c);
        return (
          <details className="eqsheet" key={c.vessel.id} open>
            <summary>
              <span className="eq-tag">{c.vessel.id}</span>
              <span className="eq-name">{c.vessel.service}</span>
              <span className="eq-meta">
                {c.vessel.kind} · {c.vessel.orientation === 'H' ? 'horizontal' : 'vertical'} ·{' '}
                {c.vessel.di}{c.vessel.diTop ? `/${c.vessel.diTop}` : ''} mm · {fmt(c.vessel.tt)} mm T/T ·{' '}
                {fmt(c.weight.total / 1000, 1)} t
              </span>
              <Pill>{rows.reduce((a, r) => a + r.qty, 0)} parts</Pill>
            </summary>
            <div className="table-wrap">
              <table className="eqparts">
                <thead>
                  <tr>
                    <th style={{ width: 26 }} />
                    <th style={{ minWidth: 220 }}>Equipment Part</th>
                    <th className="num" style={{ width: 70 }}>Qty</th>
                    <th style={{ width: 60 }}>Unit</th>
                    <th style={{ minWidth: 180 }}>Material</th>
                    <th style={{ minWidth: 240 }}>Specification / note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="eqgroup">
                    <td>
                      <span className="tree">▾</span>
                    </td>
                    <td colSpan={5}><b>Pressure Vessel</b></td>
                  </tr>
                  <tr className="eqtagrow">
                    <td><span className="tree">└</span></td>
                    <td colSpan={5}><b>{c.vessel.id} — {c.vessel.service}</b></td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.part} className={r.qty === 0 ? 'zero' : ''}>
                      <td><span className="tree">├</span></td>
                      <td>{r.part}</td>
                      <td className="num">{r.qty || '—'}</td>
                      <td className="small muted">{r.qty ? r.unit : ''}</td>
                      <td className="small">{r.material}</td>
                      <td className="small muted">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td colSpan={2}>Total positions</td>
                    <td className="num">{rows.filter((r) => r.qty > 0).length}</td>
                    <td colSpan={2} className="small muted">
                      {rows.filter((r) => r.qty > 0).reduce((a, r) => a + r.qty, 0)} pieces incl. repetition
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
