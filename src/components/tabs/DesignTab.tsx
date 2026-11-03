import VesselViewer from '../VesselViewer';
import { Bar, Card, Note, Pill, Stat } from '../ui';
import { fmt, round, type VesselCalc, type VesselGeo } from '../../lib/engine';

export default function DesignTab({ calc, geo, rtMode, setRtMode, setOrientation }: {
  calc: VesselCalc; geo: VesselGeo; rtMode: 'auto' | 'full' | 'spot' | 'none';
  setRtMode: (v: 'auto' | 'full' | 'spot' | 'none') => void;
  setOrientation: (o: 'V' | 'H') => void;
}) {
  const v = calc.vessel;
  const t = calc.thk;
  const ext = t.external;
  const externalGoverns = v.vacuum && !ext.acceptable;
  const governRow = [...t.rows].sort((a, b) => b.tSel - a.tSel)[0];

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g23">
        <Card
          title="3D equipment model"
          sub={`${v.id} · ${v.service}`}
          right={<div className="seg">
            {(['auto', 'full', 'spot', 'none'] as const).map((m) => (
              <button key={m} className={rtMode === m ? 'on' : ''} onClick={() => setRtMode(m)}
                title={`Radiography basis used for joint efficiency — ${m}`}>
                RT·{m === 'auto' ? 'sheet' : m}
              </button>
            ))}
          </div>}
          flush
        >
          <VesselViewer geo={geo} label={{ id: v.id }} />
        </Card>

        <div className="grid" style={{ gap: 12 }}>
          <Card title="Design basis" sub="UOP 301 / ASME VIII Div.1">
            <dl className="kv">
              <dt>Item / service</dt><dd>{v.id} · {v.service}</dd>
              <dt>Specification</dt><dd>{v.spec}</dd>
              <dt>Design pressure (int.)</dt><dd>{v.p} kg/cm²(g) · {round(t.pMpa, 3)} MPa</dd>
              <dt>External</dt><dd>{v.vacuum ? 'FULL VACUUM' : '—'}</dd>
              <dt>Design temperature</dt><dd>{v.designTempC} °C</dd>
              <dt>MDMT</dt><dd>{v.mdmtC} °C</dd>
              <dt>Inside diameter</dt><dd>{v.di}{v.diTop ? ` / ${v.diTop}` : ''} mm</dd>
              <dt>Tangent-to-tangent</dt><dd>{fmt(v.tt)} mm</dd>
              <dt>Corrosion allowance</dt><dd>{v.ca} mm{v.caLeg ? ` (leg ${v.caLeg})` : ''}</dd>
              <dt>Material</dt><dd>{calc.steelGrade}</dd>
              <dt>Heads</dt><dd>{v.headTop === 'SE' ? '2:1 ellip.' : 'Flat flanged'} / {v.headBot === 'SE' ? '2:1 ellip.' : 'Flat'}</dd>
              <dt>Nozzle class</dt><dd>ASME CL{v.asmeClass} RF</dd>
              <dt>Radiography</dt><dd>{v.rtPolicy} · E = {t.e.toFixed(2)}</dd>
              <dt>Orientation</dt>
              <dd style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="seg">
                  {(['V', 'H'] as const).map((o) => (
                    <button key={o} className={v.orientation === o ? 'on' : ''} onClick={() => setOrientation(o)}
                      title={o === 'V' ? 'Vertical — skirt or legs' : 'Horizontal — two saddles'}>{
                        o === 'V' ? 'Vertical' : 'Horizontal'}</button>
                  ))}
                </span>
              </dd>
              <dt>Support</dt>
              <dd>
                {v.support}
                {v.support === 'Saddles' && geo.saddle
                  ? ` — 2 off, ${geo.saddle.w} × ${geo.saddle.h} mm, one fixed + one sliding`
                  : v.support === 'Skirt' ? ' — skirt with base ring' : ' — 4 legs with base plates'}
              </dd>
              {geo.shipping && (
                <><dt>Shipping</dt><dd>lies on 2 transportation saddles {geo.shipping.w} × {geo.shipping.h} mm (temporary)</dd></>
              )}
              {v.trays ? <><dt>Internals</dt><dd>{v.trays} valve trays</dd></> : null}
              {v.packing ? <><dt>Internals</dt><dd>{v.packing}</dd></> : null}
              {v.bedDepth ? <><dt>Bed depth</dt><dd>{fmt(v.bedDepth)} mm</dd></> : null}
              {v.nll ? <><dt>NLL / SG</dt><dd>{v.nll} mm · {v.sg}</dd></> : null}
            </dl>
          </Card>

          <Card title="Code check summary">
            <div className="grid g2" style={{ gap: 8 }}>
              <Stat label="Governing thickness" value={governRow.tSel} unit="mm" hint={governRow.item} tone="amber" />
              <Stat label="Selected shell" value={t.tShell} unit="mm" hint={`corroded + CA ${v.ca} mm`} />
            </div>
            <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
              <div className="spread small">
                <span>External pressure (vacuum)</span>
                {v.vacuum
                  ? <Pill tone={ext.acceptable ? 'ok' : 'bad'}>
                    {ext.acceptable ? 'adequate' : `${ext.ringsRequired} stiffener rings`}
                  </Pill>
                  : <Pill>n/a</Pill>}
              </div>
              <div className="spread small">
                <span>PWHT status</span>
                {calc.pwht.active ? <Pill tone="warn">ON — furnace</Pill>
                  : calc.pwht.required ? <Pill tone="bad">required, not pushed</Pill> : <Pill tone="ok">not required</Pill>}
              </div>
              <div className="spread small">
                <span>UG-16 min. thickness</span>
                <Pill tone="ok">t ≥ {v.di > 900 ? 6 : 5} mm</Pill>
              </div>
              <div className="spread small">
                <span>MDMT / impact test</span>
                <Pill tone={v.mdmtC < -29 ? 'warn' : 'ok'}>Curve D · {v.mdmtC} °C</Pill>
              </div>
            </div>
            {externalGoverns && (
              <Note tone="amber">
                Full vacuum governs over internal pressure at this D/t. Shell {t.tShell} mm allows a maximum
                unstiffened span of <b>{fmt(ext.maxSpanMm)} mm</b>; provide <b>{ext.ringsRequired}</b> external
                stiffener rings at ≤ {fmt(ext.ringSpacingMm)} mm centres (UG-29/UG-30). Rings are already carried
                in the part plan and weld plan.
              </Note>
            )}
            {calc.pwht.required && !calc.pwht.active && (
              <Note tone="red">This vessel requires PWHT. Push it to the furnace from the PWHT tab before releasing welding.</Note>
            )}
          </Card>
        </div>
      </div>

      <div className="grid g3">
        <Stat label="Shell weight" value={fmt(calc.weight.shell / 1000, 2)} unit="t" hint={`${calc.shell.plateCount} plates · scrap ${calc.shell.scrapPct}%`} />
        <Stat label="Total fabricated" value={fmt(calc.weight.total / 1000, 2)} unit="t" hint={`incl. nozzles, internals, support`} tone="amber" />
        <Stat label="Weld length / metal" value={`${fmt(calc.weld.totalLengthM)} m`} unit="" hint={`${fmt(calc.weld.totalMetalKg)} kg deposited · ${fmt(calc.manhours)} man-h`} />
      </div>

      <Card title="Thickness calculation — ASME VIII Div.1 (UG-27 / UG-32 / UG-34)" sub={`S = ${round(t.s, 0)} MPa @ ${v.designTempC} °C · E = ${t.e.toFixed(2)}`} flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 250 }}>Component</th>
                <th>Clause / formula</th>
                <th className="num">Inputs</th>
                <th className="num">t calc</th>
                <th className="num">CA</th>
                <th className="num">t required</th>
                <th className="num">t selected</th>
                <th style={{ minWidth: 90 }}>Utilisation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.key}>
                  <td className="wrap">{r.item}</td>
                  <td>
                    <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{r.clause}</div>
                    <div className="formula" style={{ marginTop: 3 }}>{r.formula}</div>
                  </td>
                  <td className="num" style={{ fontSize: 10, color: 'var(--txt-2)' }}>{r.inputs}</td>
                  <td className="num">{r.tCalc.toFixed(2)}</td>
                  <td className="num">{r.ca}</td>
                  <td className="num" style={{ color: 'var(--txt)' }}>{r.tReq.toFixed(2)}</td>
                  <td className="num" style={{ color: 'var(--amber)', fontWeight: 600 }}>{r.tSel}</td>
                  <td>
                    <Bar pct={r.util} tone={r.util > 95 ? 'warn' : 'ok'} />
                    <span className="mono" style={{ fontSize: 9, color: 'var(--txt-3)' }}>{r.util.toFixed(0)}%</span>
                  </td>
                  <td><Pill tone={r.status === 'OK' ? 'ok' : 'bad'}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-note">
          Selected thickness is the next standard plate gauge above t<sub>required</sub>; minimum fabrication
          thickness {v.di > 900 ? 6 : 5} mm applies for handling and roundness. S values are indicative SA-516 Gr.70
          allowables at temperature — confirm against ASME II-D Table 1A for the purchased heat and the
          final design temperature. UG-37 reinforcement uses t<sub>r</sub> = {round(t.rows[0].tCalc, 2)} mm
          (uncorroded).
        </div>
      </Card>

      <div className="grid g2">
        <Card title="External pressure / vacuum screening (UG-28)" sub={v.vacuum ? 'design = full vacuum' : 'no vacuum case'}>
          <dl className="kv">
            <dt>Required external pressure</dt><dd>{ext.requiredKpa.toFixed(1)} kPa</dd>
            <dt>Outside diameter D<sub>o</sub></dt><dd>{round(ext.doM * 1000, 1)} mm</dd>
            <dt>Assumed thickness</dt><dd>{ext.t} mm</dd>
            <dt>Allowable pressure (elastic)</dt>
            <dd style={{ color: ext.acceptable ? 'var(--green)' : 'var(--red)' }}>{ext.allowableKpa.toFixed(1)} kPa</dd>
            <dt>Max unstiffened span</dt><dd>{fmt(ext.maxSpanMm)} mm</dd>
            <dt>Stiffener rings required</dt><dd>{ext.ringsRequired} @ {fmt(ext.ringSpacingMm)} mm</dd>
          </dl>
          <Note tone={ext.acceptable ? 'cyan' : 'amber'}>
            Screening based on elastic buckling of a cylinder, capped by 2/3 yield. Where rings are required they
            are included with 12 × 120 mm flats, continuous/intermittent fillet welds, and appear in the BOQ.
            Final UG-28 check must use Fig. G with the actual L/D<sub>o</sub> between rings.
          </Note>
        </Card>

        <Card title="Nozzle reinforcement — UG-37 / UG-45" sub={`${t.reinf.length} unique marks`} flush>
          <div className="table-wrap" style={{ maxHeight: 300 }}>
            <table>
              <thead>
                <tr><th>Mark</th><th>NPS</th><th className="num">d</th><th className="num">A<sub>r</sub></th><th className="num">A avail.</th><th>Result</th></tr>
              </thead>
              <tbody>
                {t.reinf.map((r) => (
                  <tr key={r.mark}>
                    <td className="mono">{r.mark}</td>
                    <td className="num">{r.nps}</td>
                    <td className="num">{r.d}</td>
                    <td className="num">{fmt(r.ar)}</td>
                    <td className="num">{fmt(r.available)}</td>
                    <td>
                      <Pill tone={r.status === 'Self-reinforced' ? 'ok' : 'warn'}>
                        {r.status === 'Self-reinforced' ? 'self' : `pad ${r.padWidth}×${r.padThk}`}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-note">Areas in mm². F = 1.0, f<sub>r1</sub> = f<sub>r2</sub> = 1.0 (matching material). Pads sized at 75/100/150 mm width with next standard gauge.</div>
        </Card>
      </div>

      <Card title="Datasheet nozzle schedule" sub={`${v.nozzles.reduce((a, n) => a + n.qty, 0)} nozzles / manways`} flush>
        <div className="table-wrap" style={{ maxHeight: 330 }}>
          <table>
            <thead>
              <tr><th>Mark</th><th>Size (in)</th><th>NPS</th><th>Service</th><th className="num">Qty</th><th>Class</th><th>Type</th><th>Reinforcement</th></tr>
            </thead>
            <tbody>
              {v.nozzles.map((nz, i) => {
                const r = t.reinf.find((x) => x.mark === nz.mark);
                return (
                  <tr key={`${nz.mark}-${i}`}>
                    <td className="mono" style={{ color: 'var(--amber)' }}>{nz.mark}</td>
                    <td className="num">{nz.nps}</td>
                    <td className="num">{Math.round(nz.nps * 25.4)}</td>
                    <td>{nz.service}</td>
                    <td className="num">{nz.qty}</td>
                    <td className="mono">CL{nz.cls ?? v.asmeClass}</td>
                    <td>{nz.nps >= 18 ? 'Manway' : 'Nozzle'}</td>
                    <td className="small">{r ? (r.padArea > 0 ? `pad ${r.padWidth} × ${r.padThk} mm` : 'self-reinforced') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Sheet notes carried into fabrication" sub={`${v.notes.length} notes`}>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, color: 'var(--txt-2)' }}>
          {v.notes.map((n) => <li key={n} style={{ marginBottom: 4 }}>{n}</li>)}
          <li>Nozzles must not be located in downcomers; TI thermowells clear of internals (UOP 307 note F).</li>
          <li>All dimensions in mm; level nozzle elevations to be confirmed against UOP DWG 8-121.</li>
        </ul>
      </Card>
    </div>
  );
}
