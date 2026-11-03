import { useMemo, useState } from 'react';
import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { fmt, type PartGroup, type VesselCalc } from '../../lib/engine';

const GROUPS: PartGroup[] = ['Shell', 'Heads', 'Nozzles', 'Manways', 'Internals', 'Support', 'Attachments', 'Lining'];

export default function PartsTab({ calc }: { calc: VesselCalc }) {
  const v = calc.vessel;
  const [group, setGroup] = useState<PartGroup | 'All'>('All');
  const [q, setQ] = useState('');

  const filtered = useMemo(
    () => calc.parts.filter((p) =>
      (group === 'All' || p.group === group) &&
      (q === '' || `${p.no} ${p.description} ${p.material} ${p.size}`.toLowerCase().includes(q.toLowerCase()))),
    [calc.parts, group, q],
  );

  const groupTotals = GROUPS.map((g) => {
    const parts = calc.parts.filter((p) => p.group === g);
    return { g, count: parts.length, weight: parts.reduce((a, p) => a + p.totalWt, 0) };
  }).filter((x) => x.count > 0);

  const exportParts = () => {
    downloadCsv(`PartPlan-${v.id}.csv`, [
      ['PART PLAN', v.id, v.service, `${v.spec}`],
      ['Part no', 'Group', 'Description', 'Qty', 'Material', 'Size', 'Thickness', 'Unit kg', 'Total kg', 'Remark'],
      ...calc.parts.map((p) => [p.no, p.group, p.description, p.qty, p.material, p.size, p.thk, p.unitWt, p.totalWt, p.remark]),
      [],
      ['TOTAL', '', '', '', '', '', '', '', calc.parts.reduce((a, p) => a + p.totalWt, 0), ''],
    ]);
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Part positions" value={calc.parts.length} hint={`${calc.parts.reduce((a, p) => a + p.qty, 0)} pieces including repetition`} />
        <Stat label="Part plan weight" value={fmt(calc.parts.reduce((a, p) => a + p.totalWt, 0) / 1000, 2)} unit="t" hint="matches fabrication take-off" tone="amber" />
        <Stat label="Heads" value={2} unit="off" hint={`2:1 ellipsoidal ${calc.thk.tHeadBot} mm, crown 0.9 D`} />
        <Stat label="Nozzle / manway marks" value={new Set(v.nozzles.map((n) => n.mark)).size} unit="marks" hint={`${v.nozzles.reduce((a, n) => a + n.qty, 0)} pieces`} />
      </div>

      <Card title="Part plan — bill of materials by individual part" sub={`${v.id} · revision 0`}
        right={<button className="btn sm" onClick={exportParts}>↓ Export part plan CSV</button>}>
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            <button className={group === 'All' ? 'on' : ''} onClick={() => setGroup('All')}>All ({calc.parts.length})</button>
            {GROUPS.map((g) => {
              const n = calc.parts.filter((p) => p.group === g).length;
              if (!n) return null;
              return <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g} ({n})</button>;
            })}
          </div>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="filter parts…"
            style={{
              marginLeft: 'auto', background: '#0b0f15', border: '1px solid var(--line)',
              borderRadius: 7, padding: '6px 9px', color: 'var(--txt)', fontSize: 11, width: 180,
            }}
          />
        </div>

        <div className="table-wrap" style={{ maxHeight: 560 }}>
          <table>
            <thead>
              <tr>
                <th>Part no.</th><th>Group</th><th style={{ minWidth: 260 }}>Description</th>
                <th className="num">Qty</th><th>Material</th><th>Size</th><th>Thk</th>
                <th className="num">Unit kg</th><th className="num">Total kg</th><th style={{ minWidth: 150 }}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.no}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{p.no}</td>
                  <td><Pill>{p.group}</Pill></td>
                  <td>{p.description}</td>
                  <td className="num">{p.qty}</td>
                  <td className="small muted">{p.material}</td>
                  <td className="mono small">{p.size}</td>
                  <td className="mono small">{p.thk}</td>
                  <td className="num">{p.unitWt ? fmt(p.unitWt) : '—'}</td>
                  <td className="num">{fmt(p.totalWt)}</td>
                  <td className="small muted">{p.remark}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8}>Shown {filtered.length} part positions</td>
                <td className="num">{fmt(filtered.reduce((a, p) => a + p.totalWt, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Part plan roll-up by discipline" sub="weight and count">
          <table>
            <thead><tr><th>Group</th><th className="num">Positions</th><th className="num">Weight kg</th><th className="num">Share</th><th>Routing</th></tr></thead>
            <tbody>
              {groupTotals.map(({ g, count, weight }) => (
                <tr key={g}>
                  <td>{g}</td>
                  <td className="num">{count}</td>
                  <td className="num">{fmt(weight)}</td>
                  <td className="num">{((weight / calc.weight.total) * 100).toFixed(1)}%</td>
                  <td className="small muted">
                    {g === 'Shell' ? 'CNC cut → bevel → roll → fit'
                      : g === 'Heads' ? 'Cut blank → hot form → trim → PWHT check'
                        : g === 'Nozzles' ? 'Pipe cut → bevel → fit + weld'
                          : g === 'Manways' ? 'Neck + flange + cover, machine face'
                            : g === 'Internals' ? 'Laser/plasma cut → fit after shell'
                              : g === 'Support' ? 'Cut → fit → weld → machine base'
                                : g === 'Attachments' ? 'Cut → fit → weld'
                                  : 'Strip cut → fit → PT'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Note tone="cyan">
            Purchase items (plate, pipe, forgings, standard flanges) are shown at part level so the shop can issue
            a single material requisition per vessel. Weights exclude weld metal, paint and packing.
          </Note>
        </Card>

        <Card title="Individual part plan — forming & preparation notes">
          <div className="small" style={{ display: 'grid', gap: 8, color: 'var(--txt-2)' }}>
            <div><b style={{ color: 'var(--txt)' }}>Shell courses.</b> Roll to the calculated inside diameter using
              {v.di > 2000 ? ' a 3-roll pyramid' : ' a 4-roll plate bender'}; check roundness to 1% of D and
              circumference within ±6 mm. Longitudinal seams staggered 180° between courses.</div>
            <div><b style={{ color: 'var(--txt)' }}>Heads.</b> 2:1 ellipsoidal, crown radius 0.9 D, knuckle 0.17 D;
              {calc.thk.tHeadBot} mm formed with 25 mm straight flange. Check thinning at knuckle after forming;
              minimum remaining thickness must not fall below the calculated value.</div>
            <div><b style={{ color: 'var(--txt)' }}>Nozzles.</b> {v.nozzles.length} marks cut by CNC pipe profiler,
              bevel 37.5° ±2.5°, bore edges deburred. Manway flange faces machined to Ra 3.2–6.3 µm, RF finish
              (ASME B16.5).</div>
            <div><b style={{ color: 'var(--txt)' }}>Internals.</b> {v.trays ? `${v.trays} tray support rings located
              from the top tangent with ±3 mm elevation.` : 'Support rings and distributor brackets located from the bottom tangent.'}{' '}
              Nozzles shall not fall in downcomer zones.</div>
            <div><b style={{ color: 'var(--txt)' }}>Support.</b> {v.support === 'Skirt'
              ? 'Skirt rolled in 2 or 3 segments, closure weld offset from shell seams; base ring flatness 1 mm.'
              : v.support === 'Saddles'
                ? 'Two saddles rolled to the shell radius with a 2 mm gap check against the shell; wear plate welded and ground flush before MT, fixed saddle at the anchored end, sliding saddle with slotted base plate and PTFE pad, slot length set from thermal growth at design temperature.'
                : 'Legs set on a bolt circle, base plates drilled to template.'}</div>
            {v.orientation === 'V' && (
              <div><b style={{ color: 'var(--txt)' }}>Transportation saddles.</b> Two temporary shipping cradles are
                bolted on for road transport (the vessel travels lying down), together with four tie-down lugs sized
                for 1.5 × shipping weight. They are removed after erection; the weld areas are ground flush, 100% MT
                and re-painted. Cradles are reusable and stay with the shop.</div>
            )}
            {v.dropLeg && <div><b style={{ color: 'var(--txt)' }}>Drop leg.</b> {v.dropLeg.od} mm OD × {fmt(v.dropLeg.tt)} mm,
              CA {v.caLeg ?? v.ca} mm, winterizing insulation and heat tracing by others.</div>}
            {v.liner && <div><b style={{ color: 'var(--txt)' }}>Lining.</b> {v.liner}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
