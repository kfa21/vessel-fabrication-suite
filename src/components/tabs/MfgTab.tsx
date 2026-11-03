import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { fmt, round, type VesselCalc } from '../../lib/engine';

export default function MfgTab({ calc }: { calc: VesselCalc }) {
  const v = calc.vessel;
  const sched = calc.schedule;
  const total = Math.max(...sched.map((s) => s.end), 1);
  const weldDays = sched.find((s) => s.id === 'weld')?.days ?? 0;
  const heaviest = Math.max(
    ...calc.parts.map((p) => (p.group === 'Heads' ? p.totalWt : p.totalWt / Math.max(1, p.qty))),
    0,
  );

  const exportPlan = () => downloadCsv(`ManufacturingPlan-${v.id}.csv`, [
    ['MANUFACTURING PLAN', v.id, v.service, `${v.spec}`],
    ['Stage', 'Description', 'Days', 'Start (day)', 'Finish (day)', 'Resource', 'Quality gate'],
    ...sched.map((s) => [s.id, s.name, s.days, s.start, s.end, s.resource, s.gate]),
    [],
    ['Total duration (days)', total],
    ['Man-hours', calc.manhours],
    ['PWHT', calc.pwht.active ? 'YES' : 'NO'],
  ]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Fabrication duration" value={round(total, 0)} unit="days" hint="sequential shop route, excludes plate mill lead time" tone="amber" />
        <Stat label="Welding duration" value={round(weldDays, 1)} unit="days" hint={`${fmt(calc.manhours)} total man-hours`} />
        <Stat label="Heaviest lift" value={round(heaviest / 1000, 2)} unit="t" hint="head / largest single part" />
        <Stat label="Quality gates" value={sched.length} hint={`${sched.filter((s) => s.id === 'pwht').length && calc.pwht.active ? 'incl. PWHT hold' : 'PWHT not in route'}`} />
      </div>

      <Card title="Manufacturing plan — shop route & Gantt" sub={`${v.id} · ${v.kind} · ${fmt(calc.weight.total / 1000, 2)} t`}
        right={<button className="btn sm" onClick={exportPlan}>↓ Export plan CSV</button>}>
        <div className="gantt">
          <div className="axis-row" style={{ marginBottom: 2 }}>
            <span />
            <div className="axis-track">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f}>{round(total * f, 0)} d</span>)}
            </div>
            <span />
          </div>
          {sched.map((s) => (
            <div className="gantt-row" key={s.id}>
              <div className="gantt-label" title={s.name}>
                <span style={{ color: 'var(--txt-3)' }}>{s.id.toUpperCase()}</span> {s.name.split('—')[0].trim()}
              </div>
              <div className="gantt-track">
                <div
                  className={`gantt-bar ${s.id === 'pwht' ? 'pwht' : s.id === 'ndt' ? 'ndt' : ['fit', 'weld', 'cut'].includes(s.id) ? '' : 'gate'}`}
                  style={{ left: `${(s.start / total) * 100}%`, width: `${Math.max((s.days / total) * 100, 1.2)}%` }}
                  title={`${s.name} · ${s.days} days`}
                />
              </div>
              <div className="gantt-days">{round(s.days, 1)} d</div>
            </div>
          ))}
        </div>
        <div className="tbl-note">
          Bars are sequential with planned overlap absorbed inside each stage. PWHT appears only when it is pushed
          to the furnace; pushing or removing it shifts hydrotest, painting and dispatch by 3 days.
        </div>
      </Card>

      <Card title="Stage plan, resources and hold points" sub="released by QA after each gate" flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Stage</th><th style={{ minWidth: 280 }}>Scope</th><th className="num">Days</th>
                <th className="num">Start</th><th className="num">Finish</th><th>Resource</th><th>Hold / gate</th></tr>
            </thead>
            <tbody>
              {sched.map((s) => (
                <tr key={s.id}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{s.id.toUpperCase()}</td>
                  <td>{s.name}</td>
                  <td className="num">{round(s.days, 1)}</td>
                  <td className="num">{round(s.start, 1)}</td>
                  <td className="num">{round(s.end, 1)}</td>
                  <td className="small">{s.resource}</td>
                  <td>{s.id === 'pwht' && !calc.pwht.active
                    ? <Pill>not required</Pill>
                    : <Pill tone={s.id === 'pwht' ? 'warn' : 'info'}>{s.gate}</Pill>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>Total shop duration</td><td className="num">{round(total, 1)}</td><td colSpan={4}>calendar days from drawing release (excl. mill lead time)</td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Manufacturing sequence — critical path">
          <ol className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--txt-2)', lineHeight: 1.8 }}>
            <li>Drawing release, WPS/PQR review, material requisition.</li>
            <li>Plate receipt, PMI, marking and traceability; establish heat numbers.</li>
            <li>Nesting and CNC cutting; bevel edges; roll shell courses; form heads.</li>
            <li>Fit and weld longitudinal seams; roundness check; fit courses and girth seams.</li>
            <li>Fit bottom head → shell; install internals (tray rings, baffles, distributors).</li>
            <li>Nozzle layout, cutting, fit-up with reinforcement pads, weld-out.</li>
            <li>NDT of all pressure welds; repair cycle if required.</li>
            <li>{calc.pwht.active ? 'PWHT charge and controlled cycle → post-PWHT NDT + hardness.' : 'No PWHT — proceed directly to hydrotest.'}</li>
            <li>Hydrostatic test, dimensional survey, drying.</li>
            <li>Surface preparation and painting, insulation clips, nameplate, preservation and packing.</li>
          </ol>
          <Note tone="cyan">
            Critical path runs through plate procurement and the weld → NDT → {calc.pwht.active ? 'PWHT → ' : ''}hydro
            chain. Internals fabrication is done in parallel and is not on the critical path.
          </Note>
        </Card>

        <Card title="Shop loading & logistics">
          <dl className="kv">
            <dt>Fabricated weight</dt><dd>{fmt(calc.weight.total)} kg</dd>
            <dt>Plate demand</dt><dd>{fmt(calc.shell.plateArea)} m² · {calc.shell.plateCount} plates</dd>
            <dt>Weld length</dt><dd>{fmt(calc.weld.totalLengthM)} m</dd>
            <dt>NDT length</dt><dd>{fmt(calc.weld.totalLengthM * (calc.thk.e >= 1 ? 1.14 : 0.52))} m</dd>
            <dt>PWHT</dt><dd>{calc.pwht.active ? `${fmt(calc.pwht.chargeKg)} kg charge` : 'not in route'}</dd>
            <dt>Paint area</dt><dd>{calc.paintM2} m²</dd>
            <dt>Transport sections</dt><dd>{v.tt > 20000 ? `${Math.ceil(v.tt / 12000)} sections (shop splice)` : '1 section'}</dd>
            <dt>Transportation saddles</dt>
            <dd>{v.orientation === 'H'
              ? 'permanent saddles (fixed + sliding)'
              : '2 temporary cradles + 4 tie-down lugs'}</dd>
            <dt>Erection weight</dt><dd>{fmt(round(calc.weight.total * 1.03, 0))} kg (incl. rigging)</dd>
          </dl>
          <Note tone="amber">
            {v.orientation === 'H'
              ? `Horizontal drum ${fmt(v.tt)} mm long ships on its own two saddles, fixed saddle forward with the sliding saddle free to move. Lifting trunnions designed for ${fmt(round(calc.weight.total * 1.5, 0))} kg (1.5 × WLL).`
              : v.tt > 20000
                ? `Vertical column ${fmt(v.tt)} mm long travels lying down on two temporary transportation saddles in ${Math.ceil(v.tt / 12000)} shop sections with pre-marked field splice locations; trial-assemble, match-mark, then dispatch. Cradles removed after erection and weld areas ground + MT. Field welds are excluded from this plan.`
                : `Vertical vessel ${fmt(v.tt)} mm long is laid down on two temporary transportation saddles for road transport; cradles removed after erection. Lifting trunnions are designed for ${fmt(round(calc.weight.total * 1.5, 0))} kg (1.5 × WLL).`}
          </Note>
        </Card>
      </div>

      <Card title="Inspection & test plan summary" sub="gate sign-off block">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Gate</th><th>Activity</th><th>Responsible</th><th>Record</th><th>Client witness</th></tr></thead>
            <tbody>
              {[
                ['H1', 'Material identification & certificates', 'QC / Stores', 'MTC + PMI report', 'On request'],
                ['H2', 'Cutting, bevel and rolling dimensional check', 'Production', 'Dimensional sheet', 'No'],
                ['H3', 'Fit-up and root pass inspection', 'QC', 'Fit-up record', 'Yes (hold)'],
                ['H4', 'Weld completion and visual', 'QC', 'Weld log', 'No'],
                ['H5', 'NDT (RT/UT/MT/PT) acceptance', 'NDT subcontractor', 'NDT reports', 'Yes (hold)'],
                ['H6', calc.pwht.active ? 'PWHT cycle and hardness survey' : 'PWHT — not applicable', 'Heat treater / QC', 'Chart + hardness report', calc.pwht.active ? 'Yes (hold)' : '—'],
                ['H7', 'Hydrostatic test', 'QC / Test bay', 'Hydro certificate', 'Yes (hold)'],
                ['H8', 'Painting, DFT and final visual', 'Paint shop / QC', 'DFT record', 'No'],
                ['H9', 'MDR compilation and dispatch', 'QA', 'Manufacturing data report', 'Yes'],
              ].map((r) => (
                <tr key={r[0]}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="small">{r[2]}</td>
                  <td className="small muted">{r[3]}</td>
                  <td>{r[4] === 'No' || r[4] === '—' ? <span className="muted">—</span> : <Pill tone="warn">{r[4]}</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
