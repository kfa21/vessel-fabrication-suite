import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { bestSourceMap, fleetBoq, fmt, money, moneyBhd, type VesselCalc } from '../../lib/engine';
import type { Rates } from '../../data/rates';
import { equipClass } from '../../data/vessels';

/** small part areas need decimals — 0.3 m² must not print as 0 */
const area = (v: number) => (v < 10 ? `${v.toFixed(2)} m²` : `${fmt(v)} m²`);

export default function BoqTab({ fleet, calc, rates, onSources }: {
  fleet: VesselCalc[]; calc: VesselCalc; rates: Rates;
  onSources: (patch: Record<string, string>) => void;
}) {
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
    [],
    ['PER-PART SOURCING', calc.vessel.id, calc.vessel.service],
    ['Part', 'Description', 'Group', 'Weight kg', 'Source', 'Mill USD', 'Freight USD', 'Duty USD', 'Insurance USD', 'Clearance USD', 'Landed USD', 'Landed BHD', 'USD/kg', 'Lead days'],
    ...calc.material.map((m) => [
      m.no, m.description, m.group, m.weight, m.source, m.millUsd, m.freightUsd, m.dutyUsd,
      m.insuranceUsd, m.clearanceUsd, m.landedUsd, m.landedBhd, m.usdPerKg, m.leadDays,
    ]),
    [],
    ['IMPORT LANDED BY COUNTRY'],
    ['Country', 'Weight kg', 'Mill USD', 'Freight USD', 'Duty USD', 'Insurance USD', 'Clearance USD', 'Landed USD', 'Landed BHD', 'Share %', 'Lead days'],
    ...calc.importSummary.map((r) => [
      r.country, r.weight, r.millUsd, r.freightUsd, r.dutyUsd, r.insuranceUsd,
      r.clearanceUsd, r.landedUsd, r.landedBhd, r.sharePct, r.leadDays,
    ]),
  ]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Plate purchased" value={plan.plates} unit="plates" hint={`${fmt(plan.purchaseArea)} m² · ${plan.lines.length} gauges`} tone="amber" />
        <Stat label="Raw material weight" value={fmt(plan.weight / 1000, 1)} unit="t" hint={`${fmt(plan.netArea)} m² net part area`} />
        <Stat label="Plate cost" value={money(plan.cost)} hint="consolidated purchase, delivered + cutting" />
        <Stat label="Saving vs separate orders" value={money(plan.saving)} hint={`${plan.soloSavingPct}% · ${plan.soloCost > 0 ? 'fewer part-plates' : '—'}`} tone="green" />
      </div>

      <div className="grid g4">
        <Stat label="Landed material" value={moneyBhd(calc.cost.materialBhd)} hint={`${money(calc.cost.materialUsd)} · ${calc.material.length} parts`} tone="amber" />
        <Stat label="Labour" value={moneyBhd(calc.cost.labourBhd)} hint={`${fmt(calc.manhours)} h × ${rates.shopRateBhd.toFixed(2)} BHD/h`} />
        <Stat label="Export logistics" value={moneyBhd(calc.cost.exportBhd)} hint={`${money(calc.cost.exportUsd)} to ${calc.shipment.destination.country}`} tone="cyan" />
        <Stat label="Delivered cost" value={moneyBhd(calc.cost.deliveredBhd)} hint={`${money(calc.cost.deliveredUsd)} · ${calc.rates.fxBhdPerUsd.toFixed(3)} BHD/USD`} tone="green" />
      </div>

      <Card
        title={`Per-part sourcing — ${calc.vessel.id}`}
        sub="choose the procurement country on each line; landed cost follows immediately"
        right={<button className="btn sm" onClick={() => onSources(bestSourceMap(calc.parts, rates))}>Use cheapest source for every part</button>}
      >
        <div className="table-wrap" style={{ maxHeight: 520 }}>
          <table>
            <thead>
              <tr>
                <th>Part</th><th style={{ minWidth: 230 }}>Description</th><th>Group</th>
                <th className="num">Weight</th><th>Source country</th>
                <th className="num">Mill</th><th className="num">Freight</th><th className="num">Duty</th>
                <th className="num">Insurance</th><th className="num">Clearance</th>
                <th className="num">Landed</th><th className="num">BHD</th><th className="num">$/kg</th><th className="num">Lead</th>
              </tr>
            </thead>
            <tbody>
              {calc.material.map((m) => (
                <tr key={m.no}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{m.no}</td>
                  <td className="small">{m.description}</td>
                  <td><Pill>{m.group}</Pill></td>
                  <td className="num">{fmt(m.weight, 0)} kg</td>
                  <td>
                    <select
                      value={m.source}
                      onChange={(e) => onSources({ [m.no]: e.target.value })}
                      style={{ background: '#0e131a', border: '1px solid var(--line-2)', color: 'var(--txt)', borderRadius: 5, padding: '4px 6px', fontSize: 10.5 }}
                    >
                      {rates.countries.map((c) => <option key={c.country} value={c.country}>{c.country}</option>)}
                    </select>
                  </td>
                  <td className="num">{money(m.millUsd)}</td>
                  <td className="num">{money(m.freightUsd)}</td>
                  <td className="num">{money(m.dutyUsd)}</td>
                  <td className="num">{money(m.insuranceUsd)}</td>
                  <td className="num">{money(m.clearanceUsd)}</td>
                  <td className="num"><b>{money(m.landedUsd)}</b></td>
                  <td className="num">{moneyBhd(m.landedBhd)}</td>
                  <td className="num">{m.usdPerKg.toFixed(2)}</td>
                  <td className="num">{m.leadDays} d</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total landed material</td>
                <td className="num">{fmt(calc.material.reduce((a, m) => a + m.weight, 0), 0)} kg</td>
                <td colSpan={6} />
                <td className="num">{money(calc.cost.materialUsd)}</td>
                <td className="num">{moneyBhd(calc.cost.materialBhd)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="tbl-note">
          Landed cost = weight × mill rate × cost-group factor + freight + duty + insurance + allocated clearance and
          documents. The selected source drives the country summary below and the import table on Logistics.
        </div>
      </Card>

      <Card title={`Import landed by country — ${calc.vessel.id}`} sub={`${calc.importSummary.length} countries supplying this vessel`}>
        <table>
          <thead>
            <tr><th>Country</th><th className="num">Weight</th><th className="num">Mill</th><th className="num">Freight</th><th className="num">Duty</th><th className="num">Insurance</th><th className="num">Clearance</th><th className="num">Landed</th><th className="num">BHD</th><th className="num">Share</th><th className="num">Lead</th></tr>
          </thead>
          <tbody>
            {calc.importSummary.map((r) => (
              <tr key={r.country}>
                <td><b>{r.country}</b> <span className="small muted">{r.region}</span></td>
                <td className="num">{fmt(r.weight, 0)} kg</td>
                <td className="num">{money(r.millUsd)}</td>
                <td className="num">{money(r.freightUsd)}</td>
                <td className="num">{money(r.dutyUsd)}</td>
                <td className="num">{money(r.insuranceUsd)}</td>
                <td className="num">{money(r.clearanceUsd)}</td>
                <td className="num"><b>{money(r.landedUsd)}</b></td>
                <td className="num">{moneyBhd(r.landedBhd)}</td>
                <td className="num">{r.sharePct}%</td>
                <td className="num">{r.leadDays} d</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td className="num">{fmt(calc.importSummary.reduce((a, r) => a + r.weight, 0), 0)} kg</td>
              <td className="num">{money(calc.importSummary.reduce((a, r) => a + r.millUsd, 0))}</td>
              <td className="num">{money(calc.importSummary.reduce((a, r) => a + r.freightUsd, 0))}</td>
              <td className="num">{money(calc.importSummary.reduce((a, r) => a + r.dutyUsd, 0))}</td>
              <td className="num">{money(calc.importSummary.reduce((a, r) => a + r.insuranceUsd, 0))}</td>
              <td className="num">{money(calc.importSummary.reduce((a, r) => a + r.clearanceUsd, 0))}</td>
              <td className="num">{money(calc.cost.materialUsd)}</td>
              <td className="num">{moneyBhd(calc.cost.materialBhd)}</td>
              <td className="num">100%</td><td />
            </tr>
          </tfoot>
        </table>
      </Card>

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
