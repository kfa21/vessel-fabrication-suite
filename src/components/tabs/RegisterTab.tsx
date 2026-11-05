import { Card, Note, Pill, Stat } from '../ui';
import { fleetRollup, fmt, money, round, type VesselCalc } from '../../lib/engine';
import { equipClass, type Vessel } from '../../data/vessels';

export default function RegisterTab({ fleet, all, onSelect, selectedId }: {
  fleet: VesselCalc[]; all: VesselCalc[]; onSelect: (id: string) => void; selectedId: string;
}) {
  const r = fleetRollup(fleet);
  const allR = fleetRollup(all);
  const byUnit = ['Platforming', 'NHT', 'Par-Isom'].map((u) => {
    const subset = fleet.filter((c) => c.vessel.unit === u);
    const rr = fleetRollup(subset);
    return { u, count: subset.length, weight: rr.weight, cost: rr.cost, pwht: rr.pwhtCount };
  });

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Vessels in scope" value={fleet.length} unit={`of ${all.length}`} hint="columns, drums, receivers, treaters" />
        <Stat label="Fabricated steel" value={fmt(r.weight / 1000, 1)} unit="t" hint={`${fmt(r.nozzles)} nozzles & manways`} tone="amber" />
        <Stat label="Welding" value={fmt(r.weldM)} unit="m" hint={`${fmt(r.hours)} man-hours · ${r.pwhtCount} PWHT`} />
        <Stat label="Delivered value" value={money(r.cost)} hint="landed material + labour + NDT + PWHT + paint + export logistics" tone="green" />
      </div>

      <div className="grid g3">
        {byUnit.map((u) => (
          <Card key={u.u} title={u.u} sub={`${u.count} vessels`}>
            <div className="spread" style={{ marginBottom: 7 }}>
              <span className="muted small">Fabricated weight</span>
              <span className="mono">{fmt(u.weight / 1000, 1)} t</span>
            </div>
            <div className="spread" style={{ marginBottom: 7 }}>
              <span className="muted small">Delivered value</span>
              <span className="mono">{money(u.cost)}</span>
            </div>
            <div className="spread">
              <span className="muted small">PWHT vessels</span>
              <span className="mono">{u.pwht}</span>
            </div>
            <div style={{ height: 4, background: '#1d2531', borderRadius: 3, marginTop: 9 }}>
              <div style={{ width: `${(u.weight / Math.max(1, allR.weight)) * 100}%`, height: '100%', background: 'var(--amber)', borderRadius: 3 }} />
            </div>
          </Card>
        ))}
      </div>

      <Card
        title={`Equipment register — ${fleet.length} items`}
        sub={`${fleet.length} shown · click a row to open its design & fabrication package`}
        flush
      >
        <div className="table-wrap" style={{ maxHeight: 560 }}>
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Unit</th><th style={{ minWidth: 170 }}>Service</th><th>Type</th>
                <th className="num">ID</th><th className="num">T/T</th><th className="num">P kg/cm²</th>
                <th className="num">t shell</th><th className="num">Weight</th><th className="num">Weld</th>
                <th className="num">Man-h</th><th>PWHT</th><th className="num">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((c) => {
                const v = c.vessel;
                return (
                  <tr key={v.id} onClick={() => onSelect(v.id)} style={{ cursor: 'pointer', background: v.id === selectedId ? 'rgba(240,166,56,.05)' : undefined }}>
                    <td className="mono" style={{ color: v.id === selectedId ? 'var(--amber)' : undefined, fontWeight: 600 }}>{v.id}</td>
                    <td className="small muted">{v.unit}</td>
                    <td>{v.service}</td>
                    <td className="small">{v.kind} <span className="muted">· {v.orientation === 'H' ? 'horiz.' : 'vert.'}</span></td>
                    <td className="num">{v.di}{v.diTop ? `/${v.diTop}` : ''}</td>
                    <td className="num">{fmt(v.tt)}</td>
                    <td className="num">{v.p}{v.vacuum ? '*' : ''}</td>
                    <td className="num" style={{ color: 'var(--amber)' }}>{c.thk.tShell}</td>
                    <td className="num">{fmt(c.weight.total / 1000, 1)} t</td>
                    <td className="num">{fmt(c.weld.totalLengthM)} m</td>
                    <td className="num">{fmt(c.manhours)}</td>
                    <td className="num">{fmt(c.manhours)}</td>
                    <td>{c.pwht.active ? <Pill tone="warn">PWHT</Pill> : c.pwht.required ? <Pill tone="bad">req.</Pill> : <span className="muted">—</span>}</td>
                    <td className="num">{money(c.cost.total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8}>Total scope</td>    
                <td className="num">{fmt(r.weldM)} m</td>
                <td className="num">{fmt(r.hours)}</td>
                <td>{r.pwhtCount}</td>
                <td className="num">{money(r.cost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="tbl-note">
          * indicates full vacuum design. t shell is the selected pressure thickness after corrosion allowance,
          based on the radiography basis stated on each sheet. Values are preliminary sizing for fabrication
          planning; the stamped U-1A calculation governs.
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Roll-up by equipment type" sub="two classes only">
          {(['Column', 'Vessel'] as const).map((k) => {
            const subset = fleet.filter((c) => equipClass(c.vessel) === k);
            if (!subset.length) return null;
            const w = subset.reduce((a, c) => a + c.weight.total, 0);
            const nozzles = subset.reduce((a, c) => a + c.vessel.nozzles.reduce((x, n) => x + n.qty, 0), 0);
            return (
              <div key={k} style={{ marginBottom: 9 }}>
                <div className="spread small" style={{ marginBottom: 3 }}>
                  <span>
                    {k === 'Column' ? 'Columns' : 'Vessels'}{' '}
                    <span className="muted">({String(subset.length).padStart(2, '0')} Nos · {nozzles} nozzles)</span>
                  </span>
                  <span className="mono">{fmt(w / 1000, 1)} t</span>
                </div>
                <div style={{ height: 5, background: '#1d2531', borderRadius: 3 }}>
                  <div style={{ width: `${(w / Math.max(1, r.weight)) * 100}%`, height: '100%', borderRadius: 3, background: k === 'Column' ? 'var(--amber)' : 'var(--cyan)' }} />
                </div>
              </div>
            );
          })}
          <Note tone="cyan">
            Columns dominate the tonnage; vessels dominate the part count, the nozzle count and therefore the NDT
            and fit-up hours. A/B pairs are split into separate equipment, so each twin carries its own plate,
            weld and PWHT demand. Plan bay allocation accordingly.
          </Note>
        </Card>

        <Card title="Scope control">
          <div className="small" style={{ display: 'grid', gap: 8, color: 'var(--txt-2)' }}>
            <div><b style={{ color: 'var(--txt)' }}>Basis of estimate.</b> Thickness from ASME VIII Div.1 using
              UOP 301 design data, SA-516 Gr.70 at the sheet design temperature, corrosion allowance per sheet.
              Heads, nozzles and manways weighted from the part plan.</div>
            <div><b style={{ color: 'var(--txt)' }}>Exclusions.</b> Internals supply (trays/packing by others where
              noted), refractory, external insulation, heat tracing, transport, field erection, spare parts.</div>
            <div><b style={{ color: 'var(--txt)' }}>Assumptions.</b> Radiography basis as shown per sheet; PWHT
              default follows the sheet (MR resolved to “not required” unless service or thickness demands it) and
              is overridable manually in the PWHT tab.</div>
            <div><b style={{ color: 'var(--txt)' }}>Traceability.</b> Every number in this register links to the
              per-vessel calculation, part, weld, NDT, PWHT and manufacturing tabs.</div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <Pill tone="ok">Rev 0 · issued for planning</Pill>
            <Pill>{fleet.length} equipment</Pill>
            <Pill>{fleet.filter((c) => equipClass(c.vessel) === 'Column').length} columns</Pill>
            <Pill>3 units</Pill>
            <Pill>{round(r.scrapAvg, 1)}% avg scrap</Pill>
          </div>
        </Card>
      </div>
    </div>
  );
}
