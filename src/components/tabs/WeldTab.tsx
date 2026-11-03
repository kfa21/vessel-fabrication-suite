import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { PROCESS_RATE } from '../../data/materials';
import { fmt, round, type VesselCalc } from '../../lib/engine';

export default function WeldTab({ calc }: { calc: VesselCalc }) {
  const v = calc.vessel;
  const w = calc.weld;
  const byProcess = Object.entries(
    w.rows.reduce<Record<string, { kg: number; m: number; h: number }>>((acc, r) => {
      const a = acc[r.process] ?? { kg: 0, m: 0, h: 0 };
      a.kg += r.metalKg; a.m += r.lengthM; a.h += r.hours;
      acc[r.process] = a;
      return acc;
    }, {}),
  );
  const tMax = Math.max(calc.thk.tShell, calc.thk.tHeadBot);
  const preheat = tMax > 38 ? 120 : tMax > 25 ? 100 : 20;

  const exportWeld = () => downloadCsv(`WeldPlan-${v.id}.csv`, [
    ['WELD PLAN', v.id, v.service],
    ['No', 'Joint', 'Cat', 'Joint type', 'Qty', 'Length m', 'Thk mm', 'Process', 'E', 'RT %', 'Metal kg', 'Hours'],
    ...w.rows.map((r) => [r.no, r.joint, r.category, r.type, r.qty, r.lengthM, r.thk, r.process, r.e, r.rtPct, r.metalKg, r.hours]),
    [],
    ['TOTAL', '', '', '', '', w.totalLengthM, '', '', '', '', w.totalMetalKg, w.hours],
  ]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Total weld length" value={fmt(w.totalLengthM)} unit="m" hint={`${w.rows.length} joint categories`} />
        <Stat label="Deposited metal" value={fmt(w.totalMetalKg)} unit="kg" hint={`${round(w.totalMetalKg * 1.08, 0)} kg consumable incl. 8% loss`} tone="amber" />
        <Stat label="Arc hours" value={fmt(w.arcHours)} unit="h" hint={`${fmt(w.hours)} total weld man-hours`} />
        <Stat label="Preheat" value={preheat} unit="°C" hint={tMax > 25 ? `t = ${tMax} mm > 25 mm — minimum preheat` : 'ambient, no preheat'} />
      </div>

      <Card title="Weld plan — joint register" sub={`${v.id} · ASME IX qualified WPS required`}
        right={<button className="btn sm" onClick={exportWeld}>↓ Export weld plan CSV</button>} flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th><th style={{ minWidth: 300 }}>Joint</th><th>Cat.</th><th>Joint detail</th>
                <th className="num">Qty</th><th className="num">Length</th><th className="num">Thk</th>
                <th>Process</th><th className="num">E</th><th className="num">RT %</th>
                <th className="num">Metal kg</th><th className="num">Hours</th>
              </tr>
            </thead>
            <tbody>
              {w.rows.map((r) => (
                <tr key={r.no}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{r.no}</td>
                  <td>{r.joint}</td>
                  <td><Pill tone={r.category === 'A' ? 'info' : r.category === 'D' ? 'warn' : undefined}>{r.category}</Pill></td>
                  <td className="small muted">{r.type}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{r.lengthM} m</td>
                  <td className="num">{round(r.thk, 0)}</td>
                  <td><Pill>{r.process}</Pill></td>
                  <td className="num">{r.e.toFixed(2)}</td>
                  <td className="num">{r.rtPct || '—'}</td>
                  <td className="num">{r.metalKg}</td>
                  <td className="num">{r.hours}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total</td>
                <td className="num">{w.totalLengthM} m</td>
                <td colSpan={3} />
                <td className="num">—</td>
                <td className="num">{w.totalMetalKg}</td>
                <td className="num">{w.hours}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="tbl-note">
          Joint categories per UW-3: <b>A</b> longitudinal shell seams, head seams and head-to-shell closures;
          <b> B</b> circumferential shell seams; <b>C</b> flange-to-neck; <b>D</b> nozzle-to-shell/head.
          RT extent follows UW-11 for the joint efficiency used in the thickness calculation.
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Welding process mix" sub="deposited metal and man-hours">
          <table>
            <thead><tr><th>Process</th><th className="num">Length</th><th className="num">Metal</th><th className="num">Arc h</th><th className="num">Rate</th><th>Application</th></tr></thead>
            <tbody>
              {byProcess.map(([p, r]) => (
                <tr key={p}>
                  <td><Pill>{p}</Pill></td>
                  <td className="num">{round(r.m, 1)} m</td>
                  <td className="num">{fmt(r.kg)} kg</td>
                  <td className="num">{round(r.h, 0)}</td>
                  <td className="num">{PROCESS_RATE[p]} kg/h</td>
                  <td className="small muted">
                    {p === 'SAW' ? 'Shell/head long seams, girths' : p === 'FCAW' ? 'Nozzles, attachments, fillets'
                      : p === 'GTAW' ? 'Root passes, stainless / lining' : 'Repair and small fillets'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Note tone="amber">
            Preheat {preheat} °C minimum, interpass ≤ 250 °C, heat input 0.8–2.5 kJ/mm for P-No.1. Root pass
            GTAW/FCAW, fill SAW on shell seams. All welders and operators qualified to ASME IX with WPS/PQR
            on project file before production welding.
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
            <dt>Back-gouging</dt><dd>Air-carbon arc + grind to sound metal</dd>
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
          <li>Fit and weld longitudinal seams first (inside root, outside back-gouge, SAW fill/cap).</li>
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
