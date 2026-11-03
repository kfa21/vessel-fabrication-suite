import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { fleetBoq, fmt, money, type VesselCalc } from '../../lib/engine';
import { equipClass } from '../../data/vessels';

/** small part areas need decimals — 0.3 m² must not print as 0 */
const area = (v: number) => (v < 10 ? `${v.toFixed(2)} m²` : `${fmt(v)} m²`);

export default function BoqTab({ fleet }: { fleet: VesselCalc[] }) {
  const plan = fleetBoq(fleet);
  const columns = fleet.filter((c) => equipClass(c.vessel) === 'Column').length;
  const vessels = fleet.length - columns;

  const exportBoq = () => downloadCsv('OptimizedBOQ.csv', [
    ['OPTIMISED RAW MATERIAL BOQ', `${fleet.length} equipment`, `${columns} columns / ${vessels} vessels`],
    ['Plate gauge', 'Equipment', 'Net area m2', 'Envelope', 'Plates', 'Purchase m2', 'Purchase kg', 'Cost', 'Scrap %', 'If bought separately', 'Saving'],
    ...plan.lines.map((l) => [
      l.gauge, l.vessels.length, l.netArea, l.envelope, l.plates, l.purchaseArea, l.weight,
      l.cost, l.scrapPct, l.soloCost, l.soloCost - l.cost,
    ]),
    [],
    ['TOTAL', fleet.length, plan.netArea, '', plan.plates, plan.purchaseArea, plan.weight, plan.cost, plan.scrapPct, plan.soloCost, plan.saving],
    [],
    ['Equipment', 'Service', 'Class', 'Gauge', 'Net area m2', 'Weight kg'],
    ...plan.demand.map((d) => [d.id, d.service, d.cls, d.gauge, d.area, d.weight]),
  ]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Plate purchased" value={plan.plates} unit="plates" hint={`${fmt(plan.purchaseArea)} m² · ${plan.lines.length} gauges`} tone="amber" />
        <Stat label="Raw material weight" value={fmt(plan.weight / 1000, 1)} unit="t" hint={`${fmt(plan.netArea)} m² net part area`} />
        <Stat label="Plate cost" value={money(plan.cost)} hint="consolidated purchase, delivered + cutting" />
        <Stat label="Saving vs separate orders" value={money(plan.saving)} hint={`${plan.soloSavingPct}% · ${plan.soloCost > 0 ? 'fewer part-plates' : '—'}`} tone="green" />
      </div>

      <Card
        title="Optimised BOQ — one plate purchase for the whole scope"
        sub={`${fleet.length} equipment · ${columns} columns · ${vessels} vessels · nesting efficiency 85%`}
        right={<button className="btn sm" onClick={exportBoq}>↓ Export BOQ CSV</button>}
      >
        <div className="row" style={{ marginBottom: 10 }}>
          <Pill tone="ok">Consolidated</Pill>
          <Pill>{plan.scrapPct}% scrap</Pill>
          <Pill>{fmt(plan.soloCost)} if every vessel bought separately</Pill>
          <Pill tone="warn">−{money(plan.saving)}</Pill>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">Gauge</th>
                <th className="num">Equip.</th>
                <th className="num">Net area</th>
                <th>Stock envelope</th>
                <th className="num">Plates</th>
                <th className="num">Purchase</th>
                <th className="num">Weight</th>
                <th className="num">Cost</th>
                <th className="num">Scrap</th>
                <th className="num">Separately</th>
                <th className="num">Saving</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((l) => (
                <tr key={l.gauge}>
                  <td className="num" style={{ color: 'var(--amber)', fontWeight: 600 }}>{l.gauge} mm</td>
                  <td className="num">{l.vessels.length}</td>
                  <td className="num">{area(l.netArea)}</td>
                  <td className="mono">{l.envelope}</td>
                  <td className="num">{l.plates}</td>
                  <td className="num">{area(l.purchaseArea)}</td>
                  <td className="num">{fmt(l.weight / 1000, 2)} t</td>
                  <td className="num">{money(l.cost)}</td>
                  <td className="num"><Pill tone={l.scrapPct > 40 ? 'bad' : l.scrapPct > 25 ? 'warn' : 'ok'}>{l.scrapPct}%</Pill></td>
                  <td className="num muted">{money(l.soloCost)}</td>
                  <td className="num" style={{ color: l.soloCost > l.cost ? 'var(--green)' : 'var(--txt-3)' }}>
                    {l.soloCost > l.cost ? `−${money(l.soloCost - l.cost)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total procurement</td>
                <td className="num">{plan.plates}</td>
                <td className="num">{area(plan.purchaseArea)}</td>
                <td className="num">{fmt(plan.weight / 1000, 1)} t</td>
                <td className="num">{money(plan.cost)}</td>
                <td className="num">{plan.scrapPct}%</td>
                <td className="num muted">{money(plan.soloCost)}</td>
                <td className="num" style={{ color: 'var(--green)' }}>−{money(plan.saving)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="tbl-note">
          For each plate gauge the optimiser tests every stock envelope (2000 × 6000 … 3200 × 12000), divides the
          total net area of all equipment at that gauge by the usable plate area, and keeps the envelope with the
          lowest delivered cost. Net area is the mid-surface shell area plus the dished-end blanks; plate is priced
          at {money(1350)}/t delivered plus 6% for cutting and handling. “Separately” is the same calculation done
          per vessel, i.e. each item rounding its own plates up.
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Where the saving comes from" sub="consolidation vs per-equipment plate orders">
          <div className="small" style={{ display: 'grid', gap: 8, color: 'var(--txt-2)' }}>
            <div>
              <b style={{ color: 'var(--txt)' }}>Plate count.</b> Separate orders need{' '}
              <b>{plan.lines.reduce((a, l) => a + l.soloPlates, 0)}</b> plates; buying together needs{' '}
              <b>{plan.plates}</b> — {plan.lines.reduce((a, l) => a + l.soloPlates, 0) - plan.plates} fewer sheets of
              the same steel.
            </div>
            <div>
              <b style={{ color: 'var(--txt)' }}>Gauge pooling.</b> Vessels at 8, 10, 12 and 14 mm share one
              purchase line per thickness instead of a line per vessel, so the nesting leftover on one item is
              consumed by the next.
            </div>
            <div>
              <b style={{ color: 'var(--txt)' }}>A/B pairs.</b> {fleet.filter((c) => c.vessel.id.endsWith('A')).length} A/B
              pairs are costed as separate equipment, so the pair doubles its plate, weld and PWHT demand instead of
              being counted once.
            </div>
            <div>
              <b style={{ color: 'var(--txt)' }}>What is not pooled.</b> Heads are ordered as blanks within the
              same gauge line; pipe, forgings, flanges, internals and insulation are excluded — they are procured
              per item in the part plan.
            </div>
          </div>
          <Note tone="cyan">
            Scrap is calculated on purchased plate area, not on net part area, so it includes the mill surplus and
            the nesting loss. A gauge line above 40% scrap usually means the envelope is being driven by one very
            large course.
          </Note>
        </Card>

        <Card title="Raw material demand by equipment" sub={`${plan.demand.length} gauge lines`} flush>
          <div className="table-wrap" style={{ maxHeight: 420 }}>
            <table>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Class</th>
                  <th className="num">Gauge</th>
                  <th className="num">Net area</th>
                  <th className="num">Weight</th>
                </tr>
              </thead>
              <tbody>
                {plan.demand.map((d, i) => (
                  <tr key={`${d.id}-${d.gauge}-${i}`}>
                    <td className="mono" style={{ color: 'var(--amber)' }}>{d.id}</td>
                    <td className="small muted">{d.cls}</td>
                    <td className="num">{d.gauge} mm</td>
                    <td className="num">{area(d.area)}</td>
                    <td className="num">{fmt(d.weight / 1000, 2)} t</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-note">
            Demand is per equipment, so an A/B pair appears twice. Sum of the surface areas equals the net area in
            the procurement plan above.
          </div>
        </Card>
      </div>
    </div>
  );
}
