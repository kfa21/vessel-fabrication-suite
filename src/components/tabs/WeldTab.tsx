import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { fmt, moneyBhd, round, type VesselCalc } from '../../lib/engine';
import type { WeldProcess } from '../../data/rates';

export default function WeldTab({ calc }: { calc: VesselCalc }) {
  const v = calc.vessel;
  const w = calc.weld;
  const rules = calc.rates.weld;

  const byProcess = Object.entries(
    w.rows.reduce<Record<string, { kg: number; m: number; h: number }>>((acc, r) => {
      const add = (p: WeldProcess | '—', kg: number, h: number) => {
        if (p === '—' || kg <= 0) return;
        const a = acc[p] ?? { kg: 0, m: 0, h: 0 };
        a.kg += kg; a.m += r.lengthM; a.h += h;
        acc[p] = a;
      };
      add(r.rootProcess, r.rootMetalKg, r.rootHours);
      add(r.fillProcess, r.fillMetalKg, r.fillHours);
      return acc;
    }, {}),
  );

  const tMax = Math.max(calc.thk.tShell, calc.thk.tHeadBot);
  const preheat = tMax > 38 ? 120 : tMax > 25 ? 100 : 20;
  const singleV = w.rows.filter((r) => r.jointDetail.startsWith('Single')).length;

  const exportWeld = () => downloadCsv(`WeldPlan-${v.id}.csv`, [
    ['WELD PLAN', v.id, v.service],
    ['Root process', rules.rootProcess, 'Fill ≤ threshold', rules.fillLow, 'Fill > threshold', rules.fillHigh],
    ['Double-V from mm', rules.doubleVMin, 'Fill threshold mm', rules.fillThreshold, 'Back-gouge threshold mm', rules.gougeDia],
    [],
    ['No', 'Joint', 'Cat', 'Joint detail', 'Qty', 'Length m', 'Thk mm', 'Root', 'Fill', 'E', 'RT %',
      'Root kg', 'Fill kg', 'Metal kg', 'Root h', 'Fill h', 'Back-gouge', 'Gouge h', 'Fit h', 'Hours'],
    ...w.rows.map((r) => [
      r.no, r.joint, r.category, r.jointDetail, r.qty, r.lengthM, r.thk, r.rootProcess, r.fillProcess,
      r.e, r.rtPct, r.rootMetalKg, r.fillMetalKg, r.metalKg, r.rootHours, r.fillHours,
      r.backGouge ? r.gougeMethod : '—', r.gougeHours, r.fitHours, r.hours,
    ]),
    [],
    ['TOTAL', '', '', '', '', w.totalLengthM, '', '', '', '', '', '', '', w.totalMetalKg,
      w.rootHours, w.fillHours, '', w.gougeHours, w.fitHours, w.hours],
  ]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Total weld length" value={fmt(w.totalLengthM)} unit="m" hint={`${w.rows.length} joint categories · ${singleV} single-V`} />
        <Stat label="Deposited metal" value={fmt(w.totalMetalKg)} unit="kg" hint={`${round(w.totalMetalKg * 1.08, 0)} kg consumable incl. 8% loss`} tone="amber" />
        <Stat label="Weld man-hours" value={fmt(w.hours)} unit="h" hint={`${fmt(w.arcHours)} arc + ${fmt(w.fitHours)} fit + ${fmt(w.gougeHours)} gouge`} />
        <Stat label="Weld labour" value={moneyBhd(w.hours * calc.rates.shopRateBhd)} hint={`${w.hours} h × ${calc.rates.shopRateBhd.toFixed(2)} BHD/h`} tone="cyan" />
      </div>

      <Card
        title="Weld plan — layer-by-layer joint register"
        sub={`${v.id} · ${rules.rootProcess} root · ${rules.fillLow} ≤ ${rules.fillThreshold} mm · ${rules.fillHigh} > ${rules.fillThreshold} mm`}
        right={<button className="btn sm" onClick={exportWeld}>↓ Export weld plan CSV</button>} flush
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th><th style={{ minWidth: 280 }}>Joint</th><th>Cat.</th><th>Joint detail</th>
                <th className="num">Qty</th><th className="num">Length</th><th className="num">Thk</th>
                <th>Root</th><th>Fill</th><th className="num">Metal kg</th>
                <th className="num">Root h</th><th className="num">Fill h</th>
                <th>Back-gouge</th><th className="num">Gouge h</th><th className="num">Fit h</th><th className="num">Hours</th>
              </tr>
            </thead>
            <tbody>
              {w.rows.map((r) => (
                <tr key={r.no}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{r.no}</td>
                  <td>{r.joint}</td>
                  <td><Pill tone={r.category === 'A' ? 'info' : r.category === 'D' ? 'warn' : undefined}>{r.category}</Pill></td>
                  <td className="small muted">{r.jointDetail}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{r.lengthM} m</td>
                  <td className="num">{round(r.thk, 0)}</td>
                  <td><Pill>{r.rootProcess}</Pill></td>
                  <td><Pill tone={r.fillProcess === 'SAW' ? 'info' : undefined}>{r.fillProcess}</Pill></td>
                  <td className="num">{r.metalKg}</td>
                  <td className="num">{r.rootHours || '—'}</td>
                  <td className="num">{r.fillHours || '—'}</td>
                  <td className="small">
                    {r.backGouge ? <span style={{ color: 'var(--amber)' }}>{r.gougeMethod}</span> : <span className="muted">not required</span>}
                  </td>
                  <td className="num">{r.gougeHours || '—'}</td>
                  <td className="num">{r.fitHours}</td>
                  <td className="num"><b>{r.hours}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total</td>
                <td className="num">{w.totalLengthM} m</td>
                <td colSpan={2} />
                <td className="num">{w.totalMetalKg}</td>
                <td className="num">{w.rootHours}</td>
                <td className="num">{w.fillHours}</td>
                <td />
                <td className="num">{w.gougeHours}</td>
                <td className="num">{w.fitHours}</td>
                <td className="num">{w.hours}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="tbl-note">
          Joint categories per UW-3: <b>A</b> longitudinal shell seams, head seams and head-to-shell closures;
          <b> B</b> circumferential shell seams; <b>C</b> flange-to-neck; <b>D</b> nozzle-to-shell/head. Butt joints
          below {rules.doubleVMin} mm are single-V with back-gouging, thicker joints are double-V. Back-gouging is
          manual below {fmt(rules.gougeDia)} mm bore and machine grinding at or above it.
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Welding process mix" sub="root and fill layers priced separately">
          <table>
            <thead><tr><th>Process</th><th className="num">Length</th><th className="num">Metal</th><th className="num">Hours</th><th className="num">Rate</th><th>Application</th></tr></thead>
            <tbody>
              {byProcess.map(([p, r]) => (
                <tr key={p}>
                  <td><Pill>{p}</Pill></td>
                  <td className="num">{round(r.m, 1)} m</td>
                  <td className="num">{fmt(r.kg)} kg</td>
                  <td className="num">{round(r.h, 0)}</td>
                  <td className="num">{rules.rates[p as WeldProcess] ?? '—'} kg/h</td>
                  <td className="small muted">
                    {p === 'SAW' ? 'Double-V fill above the thickness threshold'
                      : p === 'SMAW' ? 'Fill up to the thickness threshold'
                        : p === 'GTAW' ? 'Root pass on butt and full-pen joints'
                          : 'Fillets, attachments and nozzle details'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Note tone="amber">
            Preheat {preheat} °C minimum, interpass ≤ 250 °C, heat input 0.8–2.5 kJ/mm for P-No.1.
            Root {rules.rootProcess} on all butt joints; fill changes at {rules.fillThreshold} mm.
            Arc hours are multiplied by {rules.arcFactor}; fit-up is {rules.fitPerM} h/m plus {rules.jointSetup} h/joint.
          </Note>
        </Card>

        <Card title="Weld quality controls" sub="shop-floor requirements">
          <dl className="kv">
            <dt>Joint efficiency used</dt><dd>E = {calc.thk.e.toFixed(2)}</dd>
            <dt>Weld reinforcement limit</dt><dd>3 mm max (UW-35)</dd>
            <dt>Mismatch (girth seams)</dt><dd>≤ 3 mm or t/10</dd>
            <dt>Peaking / banding</dt><dd>≤ 3 mm over 300 mm</dd>
            <dt>Cleaning</dt><dd>Slag-free, brushed, dry</dd>
            <dt>Consumables</dt><dd>Low-hydrogen, controlled store</dd>
            <dt>Repair rate allowance</dt><dd>8% of weld metal</dd>
            <dt>Single-V back-gouging</dt><dd>{rules.gougeManual} h/m manual · {rules.gougeMachine} h/m machine</dd>
            <dt>Back-gouge method</dt><dd>Machine ≥ {fmt(rules.gougeDia)} mm bore, manual below</dd>
            <dt>Weld metal / shell weight</dt><dd>{round((w.totalMetalKg / calc.weight.total) * 100, 2)}%</dd>
          </dl>
          <Note>
            No weld shall be made over a temporary attachment without removal and MPI of the area. Arc strikes
            outside the joint are to be ground out and inspected by MT. Attachment welds on P-No.1 with
            t &gt; 32 mm require the same PWHT as the shell.
          </Note>
        </Card>
      </div>

      <Card title="Fit-up and welding sequence" sub="to control distortion and residual stress">
        <ol className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--txt-2)', lineHeight: 1.85 }}>
          <li>Lay out and mark courses; stagger longitudinal seams by ≥ 180°, minimum 100 mm from any course girth seam.</li>
          <li>Fit and weld longitudinal seams first (inside root, outside back-gouge, {rules.fillHigh} fill/cap).</li>
          <li>Fit courses in vertical position, align using strongbacks; weld girth seams with two operators balanced 180° apart.</li>
          <li>Fit bottom head, then top head; verify overall tangent-to-tangent {fmt(v.tt)} mm before final closure.</li>
          <li>Locate and cut all nozzle openings from the approved orientation drawing; fit nozzles with reinforcement pads and weld per WPS.</li>
          <li>Weld internal attachments (tray rings, baffles, vortex breaker) before final closure and before PWHT.</li>
          <li>Fit skirt / legs; complete all attachment welding, then NDT and — if required — PWHT before hydrotest.</li>
          <li>Final closure and nameplate bracket; dimensional survey and documentation.</li>
        </ol>
      </Card>
    </div>
  );
}
