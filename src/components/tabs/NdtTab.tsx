import { Card, Note, Pill, Stat, downloadCsv } from '../ui';
import { fmt, round, type VesselCalc } from '../../lib/engine';

export default function NdtTab({ calc }: { calc: VesselCalc }) {
  const v = calc.vessel;
  const e = calc.thk.e;
  const rtPct = e >= 1 ? 100 : e >= 0.85 ? 20 : 0;
  const buttM = calc.weld.rows.filter((r) => r.category === 'A' || r.category === 'B').reduce((a, r) => a + r.lengthM, 0);
  const nozM = calc.weld.rows.find((r) => r.category === 'D')?.lengthM ?? 0;
  const attachmentM = calc.weld.rows.filter((r) => r.category === 'Att.').reduce((a, r) => a + r.lengthM, 0);
  const rtM = round((buttM * rtPct) / 100, 1);

  const exportNdt = () => downloadCsv(`NDT-${v.id}.csv`, [
    ['NDT PLAN', v.id, v.service, `E=${e}`],
    ['No', 'Method', 'Item', 'Extent', 'Stage', 'Standard', 'Acceptance', 'Hold point'],
    ...calc.ndt.map((r) => [r.no, r.method, r.item, r.extent, r.stage, r.standard, r.acceptance, r.hold ? 'YES' : '']),
  ]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Radiography basis" value={rtPct === 100 ? 'Full' : rtPct === 20 ? 'Spot 20%' : 'None'} hint={`joint efficiency E = ${e.toFixed(2)} (UW-12)`} tone={rtPct === 100 ? 'green' : 'amber'} />
        <Stat label="Butt weld RT" value={fmt(rtM)} unit="m" hint={`of ${fmt(buttM)} m Category A/B`} />
        <Stat label="UT nozzle welds" value={`${calc.thk.reinf.filter((r) => r.nps >= 4).length} marks`} hint="full-pen nozzle-to-shell, 100%" />
        <Stat label="Hold points" value={calc.ndt.filter((r) => r.hold).length} hint="client / TPI witness required" tone="amber" />
      </div>

      <Card title="NDT plan" sub={`extent follows UW-11 / UW-51 / UW-52 for E = ${e.toFixed(2)}`}
        right={<button className="btn sm" onClick={exportNdt}>↓ Export NDT plan CSV</button>} flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th><th>Method</th><th style={{ minWidth: 250 }}>Item</th><th style={{ minWidth: 180 }}>Extent</th>
                <th style={{ minWidth: 150 }}>Stage</th><th>Standard</th><th style={{ minWidth: 200 }}>Acceptance</th><th>Hold</th>
              </tr>
            </thead>
            <tbody>
              {calc.ndt.map((r) => (
                <tr key={r.no}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{r.no}</td>
                  <td><Pill tone={r.method === 'RT' ? 'info' : r.method === 'UT' ? 'warn' : undefined}>{r.method}</Pill></td>
                  <td>{r.item}</td>
                  <td className="small">{r.extent}</td>
                  <td className="small muted">{r.stage}</td>
                  <td className="mono small">{r.standard}</td>
                  <td className="small muted">{r.acceptance}</td>
                  <td>{r.hold ? <Pill tone="warn">HOLD</Pill> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-note">
          Method mix: RT {fmt(rtM)} m · UT {fmt(nozM)} m · MT {fmt(round(attachmentM + nozM, 1))} m ·
          PT on alloy / lining. NDT is performed by an ASNT Level II/III or ISO 9712 certified subcontractor with
          procedures approved before the first weld.
        </div>
      </Card>

      <div className="grid g23">
        <Card title="Extent matrix — joint category vs radiography" sub="UW-11 / UW-12">
          <table>
            <thead>
              <tr><th>Category</th><th>Joint description</th><th className="num">Length</th><th className="num">RT</th><th>MT / PT</th><th>After PWHT</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><Pill tone="info">A</Pill></td>
                <td>Longitudinal seams, head seams, head-to-shell</td>
                <td className="num">{round(calc.weld.rows.filter((r) => r.category === 'A').reduce((a, r) => a + r.lengthM, 0), 1)} m</td>
                <td className="num">{rtPct}%</td>
                <td>MT on request</td>
                <td>{calc.pwht.active ? 'Yes — 10% RT + MT' : '—'}</td>
              </tr>
              <tr>
                <td><Pill tone="info">B</Pill></td>
                <td>Circumferential shell seams</td>
                <td className="num">{round(calc.weld.rows.filter((r) => r.category === 'B').reduce((a, r) => a + r.lengthM, 0), 1)} m</td>
                <td className="num">{rtPct}%</td>
                <td>MT on request</td>
                <td>{calc.pwht.active ? 'Yes — MT' : '—'}</td>
              </tr>
              <tr>
                <td><Pill tone="warn">D</Pill></td>
                <td>Nozzle neck to shell / head, full pen</td>
                <td className="num">{round(nozM, 1)} m</td>
                <td className="num">UT 100%</td>
                <td>MT root + final</td>
                <td>Yes — MT</td>
              </tr>
              <tr>
                <td><Pill>C</Pill></td>
                <td>Flange to neck butt welds</td>
                <td className="num">{round(calc.weld.rows.filter((r) => r.category === 'C').reduce((a, r) => a + r.lengthM, 0), 1)} m</td>
                <td className="num">—</td>
                <td>PT 100%</td>
                <td>—</td>
              </tr>
              <tr>
                <td><Pill>Att.</Pill></td>
                <td>Tray rings, clips, skirt closure, stiffeners</td>
                <td className="num">{round(attachmentM, 1)} m</td>
                <td className="num">—</td>
                <td>MT 100%</td>
                <td>{calc.pwht.active ? 'Yes — MT 100%' : '—'}</td>
              </tr>
            </tbody>
          </table>
          <Note tone="cyan">
            {rtPct === 100
              ? 'Full radiography of all Category A and B butt welds is required to justify E = 1.00. Any repair weld is re-radiographed over its full length plus 100 mm each side.'
              : rtPct === 20
                ? 'Spot radiography is applied at 20% of each weld length with a minimum 150 mm; spot RT does not qualify E = 1.00. If a spot indicates a defect, both the defect and an additional 300 mm each side are examined.'
                : 'No radiography on butt welds — E = 0.70 applies; visual and MT coverage is increased accordingly.'}
          </Note>
        </Card>

        <Card title="Inspection & test plan notes">
          <div className="small" style={{ display: 'grid', gap: 9, color: 'var(--txt-2)' }}>
            <div><b style={{ color: 'var(--txt)' }}>Hydrotest.</b> 1.3 × design ({round(v.p * 1.3, 2)} kg/cm²(g)) with
              water at ambient; hold 30 min; no leakage or permanent set. Test pressure to be corrected for
              temperature per UG-99(h).</div>
            <div><b style={{ color: 'var(--txt)' }}>Dimensions.</b> Check T/T {fmt(v.tt)} mm, ID {v.di} mm,
              out-of-roundness ≤ 1% D, plumbness ≤ H/1000, nozzle orientation ±0.5°.</div>
            <div><b style={{ color: 'var(--txt)' }}>Hardness.</b> {v.h2s
              ? 'Wet H2S service — 10% survey, ≤ 200 HB, 100% for nozzle and attachment welds.'
              : 'Hardness survey on request after PWHT, ≤ 200 HB for P-No.1.'}</div>
            <div><b style={{ color: 'var(--txt)' }}>PMI.</b> {v.liner
              ? '316L lining and Alloy 400 internals — 100% PMI on receiving and on each heat.'
              : 'Alloy components only; carbon steel verified by MTC.'}</div>
            <div><b style={{ color: 'var(--txt)' }}>MDR.</b> Manufacturing data report to include mill certificates,
              WPS/PQR/WPQ, NDT reports, PWHT chart, hydro certificate, dimensional record, calibration certificates.</div>
          </div>
          <Note tone="amber">
            {v.h2s
              ? 'Wet H2S service: NACE MR0103 compliance, hardness control and PWHT are mandatory hold points. Do not release the vessel before the hardness survey report is accepted.'
              : 'Any deviation on NDT extent must be raised as a concession with the client before welding, not after.'}
          </Note>
        </Card>
      </div>
    </div>
  );
}
