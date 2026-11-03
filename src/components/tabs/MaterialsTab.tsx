import { useMemo } from 'react';
import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { COST_RATES, PLATE_STOCK } from '../../data/materials';
import { fmt, money, round, type Strategy, type VesselCalc } from '../../lib/engine';

export default function MaterialsTab({ calc, strategy, setStrategy, fleet, baseline, optimized }: {
  calc: VesselCalc; strategy: Strategy; setStrategy: (s: Strategy) => void;
  fleet: VesselCalc[];
  baseline: { scrap: number; plates: number; cost: number; weight: number };
  optimized: { scrap: number; plates: number; cost: number; weight: number };
}) {
  const v = calc.vessel;
  const plan = calc.shell;

  const gaugePlan = useMemo(() => {
    const map = new Map<number, { area: number; weight: number; count: number; vessels: string[] }>();
    fleet.forEach((c) => {
      const t = c.thk.tShell;
      const row = map.get(t) ?? { area: 0, weight: 0, count: 0, vessels: [] };
      row.area += c.shell.plateArea;
      row.weight += (c.shell.plateArea * t * 7.85) / 1000 + c.weight.heads;
      row.count += c.shell.plateCount;
      row.vessels.push(c.vessel.id);
      map.set(t, row);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [fleet]);

  const purchaseWeight = (calc.weight.shell + calc.weight.heads + calc.weight.support * 0.85 + calc.weight.stiffeners) * 1.12;
  const savings = baseline.cost - optimized.cost;

  const exportBoq = () => {
    const rows: (string | number)[][] = [
      ['BOQ — optimized material plan', v.id, v.service],
      ['Strategy', strategy, 'Plate stock', plan.label],
      [],
      ['Course', 'Height mm', 'Pieces', 'Plate W mm', 'Plate L mm', 'Thk mm', 'Weight kg', 'Long seam m'],
      ...plan.courses.map((c) => [c.idx, c.height, c.pieces, c.plateW, c.plateL, c.thk, c.weight, c.seamM]),
      [],
      ['Plate area m2', plan.plateArea], ['Net area m2', plan.netArea], ['Scrap %', plan.scrapPct],
      ['Plates', plan.plateCount], ['Purchase weight kg', round(purchaseWeight, 0)],
      [],
      ['Part', 'Description', 'Qty', 'Material', 'Size', 'Thk', 'Unit kg', 'Total kg'],
      ...calc.parts.map((p) => [p.no, p.description, p.qty, p.material, p.size, p.thk, p.unitWt, p.totalWt]),
    ];
    downloadCsv(`BOQ-${v.id}.csv`, rows);
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Plate order weight" value={fmt(purchaseWeight / 1000, 2)} unit="t" hint="shell + heads + support × 1.12 mill surplus" tone="amber" />
        <Stat label="Net / plate area" value={`${plan.netArea} / ${plan.plateArea}`} unit="m²" hint={`${plan.plateCount} plates from ${plan.label}`} />
        <Stat label="Scrap" value={plan.scrapPct} unit="%" hint={`fleet baseline ${baseline.scrap}% · optimized ${optimized.scrap}%`} tone={plan.scrapPct > 18 ? 'amber' : 'green'} />
        <Stat label="Plate + weld cost" value={money(plan.cost + calc.weld.totalMetalKg * 6)} hint="rolling, cutting, seam welding" />
      </div>

      <Card
        title="Plate nesting strategy"
        sub="select the stock envelope; optimized searches every envelope"
        right={<button className="btn sm" onClick={exportBoq}>↓ Export BOQ CSV</button>}
      >
        <div className="row" style={{ marginBottom: 10 }}>
          <div className="seg">
            {(['standard', 'wide', 'optimized'] as const).map((s) => (
              <button key={s} className={strategy === s ? 'on' : ''} onClick={() => setStrategy(s)}>
                {s === 'standard' ? 'Standard 2000×6000' : s === 'wide' ? 'Wide 2500×12000' : 'Optimized (min cost)'}
              </button>
            ))}
          </div>
          <span className="small muted">Stock envelopes evaluated: {PLATE_STOCK.map((p) => p.label).join(' · ')}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Envelope</th><th className="num">Courses</th><th className="num">Plates</th>
                <th className="num">Long. seam</th><th className="num">Scrap</th><th className="num">Cost index</th><th>Selection</th>
              </tr>
            </thead>
            <tbody>
              {calc.shellAlts.map((a) => (
                <tr key={a.label}>
                  <td className="mono">{a.label}</td>
                  <td className="num">{a.courses}</td>
                  <td className="num">{a.plateCount}</td>
                  <td className="num">{a.seamM} m</td>
                  <td className="num" style={{ color: a.scrapPct > 20 ? 'var(--amber)' : 'var(--green)' }}>{a.scrapPct}%</td>
                  <td className="num">{money(a.cost)}</td>
                  <td>{a.selected ? <Pill tone="ok">selected</Pill> : <span className="muted small">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-note">
          Cost index combines plate mass at {money(COST_RATES.plateKg)}/kg, longitudinal seam welding at $46/m and
          handling per plate. Selecting “optimized” adopts the lowest-cost envelope for every vessel; the fleet
          comparison below shows the procurement effect.
        </div>
      </Card>

      <div className="grid g23">
        <Card title="Shell course breakdown" sub={`Ø${v.di} mm · ${fmt(v.tt)} mm T/T · t = ${calc.thk.tShell} mm`} flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th><th className="num">Height</th><th className="num">Pieces</th>
                  <th>Plate (W×L)</th><th className="num">Thk</th><th className="num">Weight</th><th className="num">Long. seam</th>
                </tr>
              </thead>
              <tbody>
                {plan.courses.map((c) => (
                  <tr key={c.idx}>
                    <td className="mono">C{c.idx}</td>
                    <td className="num">{fmt(c.height)}</td>
                    <td className="num">{c.pieces}</td>
                    <td className="mono small">{c.plateW} × {c.plateL}</td>
                    <td className="num">{c.thk}</td>
                    <td className="num">{fmt(c.weight)}</td>
                    <td className="num">{c.seamM}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Circumference {fmt(plan.circumference)} mm · girth seams {plan.girthSeamM} m</td>
                  <td className="num">{fmt(plan.courses.reduce((a, c) => a + c.weight, 0))}</td>
                  <td className="num">{plan.longSeamM}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {calc.shellTop && (
            <div className="tbl-note">
              Upper section Ø{v.diTop}: {calc.shellTop.courses.length} courses, {calc.shellTop.plateCount} plates,
              scrap {calc.shellTop.scrapPct}%, girth seams {calc.shellTop.girthSeamM} m.
            </div>
          )}
        </Card>

        <Card title="Weight take-off" sub="fabricated, before paint">
          <table>
            <tbody>
              {[
                ['Shell courses', calc.weight.shell],
                ['Heads', calc.weight.heads],
                ['Nozzles (necks, flanges, pads)', calc.weight.nozzles],
                ['Manways (flange, cover, neck)', calc.weight.manways],
                ['Internals', calc.weight.internals],
                ['Support (skirt / legs)', calc.weight.support],
                ['Attachments (rings, clips, lugs)', calc.weight.attachments],
                ...(calc.weight.lining ? [['316L lining', calc.weight.lining] as [string, number]] : []),
              ].map(([label, w]) => (
                <tr key={label as string}>
                  <td>{label}</td>
                  <td className="num">{fmt(w as number)} kg</td>
                  <td className="num muted" style={{ width: 46 }}>{round(((w as number) / calc.weight.total) * 100, 1)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Total</td><td className="num">{fmt(calc.weight.total)} kg</td><td /></tr>
            </tfoot>
          </table>
          <Note tone="cyan">
            Purchase list adds 12% mill surplus and rounds to full plates. Skirt weight is included
            in the support line and purchased from the same gauge family as the shell.
          </Note>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Fleet procurement plan by gauge" sub={`${fleet.length} vessels in scope`} flush>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th className="num">Gauge</th><th className="num">Shell area</th><th className="num">Order weight</th><th className="num">Plates</th><th>Vessels</th></tr>
              </thead>
              <tbody>
                {gaugePlan.map(([g, r]) => (
                  <tr key={g}>
                    <td className="num">{g} mm</td>
                    <td className="num">{round(r.area, 1)} m²</td>
                    <td className="num">{round(r.weight * 1.12 / 1000, 1)} t</td>
                    <td className="num">{Math.ceil((r.area * 1.12) / 15)}</td>
                    <td className="small muted" style={{ maxWidth: 220 }}>{r.vessels.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-note">Standard 2500 × 6000 sheet = 15 m². Plate count is indicative; nesting drawings to be issued by the plate shop.</div>
        </Card>

        <Card title="BOQ optimisation — baseline vs optimized" sub="all three units">
          <table>
            <thead><tr><th>Metric</th><th className="num">Baseline 2000×6000</th><th className="num">Optimized</th><th className="num">Δ</th></tr></thead>
            <tbody>
              <tr><td>Plate count</td><td className="num">{baseline.plates}</td><td className="num">{optimized.plates}</td><td className="num" style={{ color: 'var(--green)' }}>{optimized.plates - baseline.plates}</td></tr>
              <tr><td>Average scrap</td><td className="num">{baseline.scrap}%</td><td className="num">{optimized.scrap}%</td><td className="num" style={{ color: 'var(--green)' }}>{round(optimized.scrap - baseline.scrap, 1)}%</td></tr>
              <tr><td>Fabricated weight</td><td className="num">{round(baseline.weight / 1000, 0)} t</td><td className="num">{round(optimized.weight / 1000, 0)} t</td><td className="num">0</td></tr>
              <tr><td>Estimated cost</td><td className="num">{money(baseline.cost)}</td><td className="num">{money(optimized.cost)}</td><td className="num" style={{ color: 'var(--green)' }}>{money(optimized.cost - baseline.cost)}</td></tr>
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div className="small muted" style={{ marginBottom: 4 }}>Saving identified</div>
              <div className="mono" style={{ fontSize: 22, color: 'var(--green)' }}>
                {savings > 0 ? money(savings) : money(0)}
              </div>
              <div className="small muted">across {fleet.length} vessels, from fewer seams and lower scrap</div>
            </div>
            <button className="btn primary" onClick={() => setStrategy(strategy === 'optimized' ? 'standard' : 'optimized')}>
              {strategy === 'optimized' ? 'Revert to baseline' : 'Apply optimized BOQ'}
            </button>
          </div>
          <Note tone="amber">
            Optimization only changes how the plate is bought and how many seams are welded — it never reduces
            the calculated thickness, corrosion allowance or code-required NDT.
          </Note>
        </Card>
      </div>
    </div>
  );
}
