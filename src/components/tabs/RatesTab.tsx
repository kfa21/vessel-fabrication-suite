import type { ReactNode } from 'react';
import { Card, Note, Pill, Stat } from '../ui';
import {
  COST_GROUPS, type CostGroup, type CountryRate, type Destination,
  type Rates, type ShippingUnit, type WeldProcess,
} from '../../data/rates';
import { fmt, money, moneyBhd, round } from '../../lib/engine';

const processes: WeldProcess[] = ['GTAW', 'SMAW', 'SAW', 'FCAW'];

function Num({ value, onChange, step = 0.01, width = 78 }: {
  value: number; onChange: (v: number) => void; step?: number; width?: number;
}) {
  return (
    <input
      type="number" value={value} step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        width, background: '#0e131a', border: '1px solid var(--line-2)', color: 'var(--txt)',
        borderRadius: 5, padding: '4px 6px', fontFamily: 'var(--mono)', fontSize: 10.5, textAlign: 'right',
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>
      {label}{children}
    </label>
  );
}

export default function RatesTab({ rates, onChange, onReset }: {
  rates: Rates; onChange: (patch: Partial<Rates>) => void; onReset: () => void;
}) {
  const w = rates.weld;
  const patchWeld = <K extends keyof Rates['weld']>(key: K, value: Rates['weld'][K]) =>
    onChange({ weld: { ...w, [key]: value } });
  const patchCountry = (i: number, patch: Partial<CountryRate>) =>
    onChange({ countries: rates.countries.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  const patchDestination = (i: number, patch: Partial<Destination>) =>
    onChange({ destinations: rates.destinations.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const patchUnit = (i: number, patch: Partial<ShippingUnit>) =>
    onChange({ equipment: rates.equipment.map((u, idx) => (idx === i ? { ...u, ...patch } : u)) });

  const lowBand = Math.min(w.doubleVMin, w.fillThreshold);
  const highBand = Math.max(w.doubleVMin, w.fillThreshold);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Shop manhour rate" value={w ? rates.shopRateBhd.toFixed(2) : '—'} unit="BHD/h" hint={`${money(rates.shopRateBhd / rates.fxBhdPerUsd)}/h at the current FX`} tone="amber" />
        <Stat label="Exchange rate" value={rates.fxBhdPerUsd.toFixed(3)} unit="BHD/USD" hint="BHD is pegged; override for another accounting rate" />
        <Stat label="Weld arc factor" value={w.arcFactor.toFixed(2)} unit="×" hint={`fit-up ${w.fitPerM.toFixed(2)} h/m · ${w.jointSetup.toFixed(2)} h/joint`} />
        <Stat label="Sourcing countries" value={rates.countries.length} unit="countries" hint={`${rates.destinations.length} delivery markets · ${rates.equipment.length} transport units`} tone="cyan" />
      </div>

      <Card
        title="Commercial settings"
        sub="the shop rate is in BHD; all material and freight rates are USD"
        right={<button className="btn sm" onClick={onReset}>Reset to workbook defaults</button>}
      >
        <div className="filter-row">
          <Field label="Shop manhour rate (BHD/h)">
            <Num value={rates.shopRateBhd} step={0.05} onChange={(v) => onChange({ shopRateBhd: v })} />
          </Field>
          <Field label="FX — BHD per USD">
            <Num value={rates.fxBhdPerUsd} step={0.001} onChange={(v) => onChange({ fxBhdPerUsd: v })} />
          </Field>
          <Field label="Contingency %">
            <Num value={rates.contingencyPct} step={0.5} onChange={(v) => onChange({ contingencyPct: v })} />
          </Field>
          <Field label="Margin %">
            <Num value={rates.marginPct} step={0.5} onChange={(v) => onChange({ marginPct: v })} />
          </Field>
          <Field label="Plate — carbon $/kg">
            <Num value={rates.plateUsdKg} onChange={(v) => onChange({ plateUsdKg: v })} />
          </Field>
          <Field label="Plate — stainless $/kg">
            <Num value={rates.ssPlateUsdKg} onChange={(v) => onChange({ ssPlateUsdKg: v })} />
          </Field>
          <Field label="Paint $/m²">
            <Num value={rates.paintPerM2} onChange={(v) => onChange({ paintPerM2: v })} />
          </Field>
          <Field label="PWHT $/kg">
            <Num value={rates.pwhtPerKg} onChange={(v) => onChange({ pwhtPerKg: v })} />
          </Field>
          <Field label="PWHT setup $">
            <Num value={rates.pwhtSetup} step={50} onChange={(v) => onChange({ pwhtSetup: v })} />
          </Field>
          <Field label="NDT full RT $/m">
            <Num value={rates.ndtFullPerM} onChange={(v) => onChange({ ndtFullPerM: v })} />
          </Field>
          <Field label="NDT spot $/m">
            <Num value={rates.ndtSpotPerM} onChange={(v) => onChange({ ndtSpotPerM: v })} />
          </Field>
          <Field label="Consumables $/kg">
            <Num value={rates.consumablePerKg} onChange={(v) => onChange({ consumablePerKg: v })} />
          </Field>
          <Field label="Lining $/m²">
            <Num value={rates.liningPerM2} onChange={(v) => onChange({ liningPerM2: v })} />
          </Field>
        </div>
        <Note tone="amber">
          Labour is <b>{rates.shopRateBhd.toFixed(2)} BHD per manhour</b>, converted at {rates.fxBhdPerUsd.toFixed(3)} BHD/USD
          for the USD build-up. A 1,000-hour vessel therefore carries <b>{moneyBhd(1000 * rates.shopRateBhd)}</b> of direct labour.
        </Note>
      </Card>

      <div className="grid g2">
        <Card title="Cost-group factors" sub="applied to the mill price before freight and duty">
          <table>
            <thead><tr><th>Cost group</th><th className="num">Factor</th><th>Basis</th></tr></thead>
            <tbody>
              {COST_GROUPS.map((g) => (
                <tr key={g}>
                  <td>{g}</td>
                  <td className="num">
                    <Num value={rates.factors[g]} onChange={(v) => onChange({ factors: { ...rates.factors, [g]: v } })} />
                  </td>
                  <td className="small muted">
                    {g === 'Shell' ? 'rolled plate, edge prep' : g === 'Heads' ? 'dished blank, trim' : g === 'Lining' ? 'stainless strip' : 'cut, formed, drilled'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Weld procedure — layers and joint selection" sub="rule-driven, editable">
          <div className="row" style={{ marginBottom: 10 }}>
            <Pill tone="info">{w.rootProcess} root</Pill>
            <Pill>{w.fillLow} ≤ {w.fillThreshold} mm</Pill>
            <Pill tone="warn">{w.fillHigh} &gt; {w.fillThreshold} mm</Pill>
            <Pill>double-V ≥ {w.doubleVMin} mm</Pill>
            <Pill tone="ok">machine gouge ≥ {fmt(w.gougeDia)} mm</Pill>
          </div>
          <div className="filter-row">
            <Field label="Root process">
              <select value={w.rootProcess} onChange={(e) => patchWeld('rootProcess', e.target.value as WeldProcess)}
                style={{ background: '#0e131a', border: '1px solid var(--line-2)', color: 'var(--txt)', borderRadius: 6, padding: '6px 8px' }}>
                {processes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Fill ≤ threshold">
              <select value={w.fillLow} onChange={(e) => patchWeld('fillLow', e.target.value as WeldProcess)}
                style={{ background: '#0e131a', border: '1px solid var(--line-2)', color: 'var(--txt)', borderRadius: 6, padding: '6px 8px' }}>
                {processes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Fill > threshold">
              <select value={w.fillHigh} onChange={(e) => patchWeld('fillHigh', e.target.value as WeldProcess)}
                style={{ background: '#0e131a', border: '1px solid var(--line-2)', color: 'var(--txt)', borderRadius: 6, padding: '6px 8px' }}>
                {processes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Fill threshold mm"><Num value={w.fillThreshold} step={1} onChange={(v) => patchWeld('fillThreshold', v)} /></Field>
            <Field label="Double-V from mm"><Num value={w.doubleVMin} step={1} onChange={(v) => patchWeld('doubleVMin', v)} /></Field>
            <Field label="Root area mm²"><Num value={w.rootArea} step={0.5} onChange={(v) => patchWeld('rootArea', v)} /></Field>
            <Field label="Gouge threshold mm"><Num value={w.gougeDia} step={50} onChange={(v) => patchWeld('gougeDia', v)} /></Field>
            <Field label="Manual gouge h/m"><Num value={w.gougeManual} onChange={(v) => patchWeld('gougeManual', v)} /></Field>
            <Field label="Machine gouge h/m"><Num value={w.gougeMachine} onChange={(v) => patchWeld('gougeMachine', v)} /></Field>
            <Field label="Arc factor ×"><Num value={w.arcFactor} onChange={(v) => patchWeld('arcFactor', v)} /></Field>
            <Field label="Fit-up h/m"><Num value={w.fitPerM} onChange={(v) => patchWeld('fitPerM', v)} /></Field>
            <Field label="Handling h/joint"><Num value={w.jointSetup} onChange={(v) => patchWeld('jointSetup', v)} /></Field>
            <Field label="Deposit factor ×"><Num value={w.depositFactor} onChange={(v) => patchWeld('depositFactor', v)} /></Field>
          </div>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Thickness</th><th>Joint</th><th>Root</th><th>Fill</th><th>Back-gouge</th></tr></thead>
            <tbody>
              <tr><td className="num">t &lt; {w.doubleVMin} mm</td><td>Single-V butt</td><td><Pill>{w.rootProcess}</Pill></td><td><Pill>{w.fillLow}</Pill></td><td>manual below {fmt(w.gougeDia)} mm bore · machine at/above</td></tr>
              <tr><td className="num">{w.doubleVMin}–{highBand} mm</td><td>Double-V butt</td><td><Pill>{w.rootProcess}</Pill></td><td><Pill>{w.fillLow}</Pill></td><td>not required (both sides accessible)</td></tr>
              <tr><td className="num">&gt; {w.fillThreshold} mm</td><td>Double-V butt</td><td><Pill>{w.rootProcess}</Pill></td><td><Pill>{w.fillHigh}</Pill></td><td>not required</td></tr>
            </tbody>
          </table>
          <Note tone="cyan">
            Root area {w.rootArea} mm²; deposition {processes.map((p) => `${p} ${w.rates[p]}`).join(' · ')} kg/h.
            Fit-up {w.fitPerM} h/m plus {w.jointSetup} h per joint; arc hours are multiplied by {w.arcFactor}.
            The low band threshold is the smaller of {lowBand} mm; final WPS ranges still require qualification.
          </Note>
        </Card>
      </div>

      <Card title="Raw-material sourcing — country landed-cost basis" sub="USD/kg, duty, clearance, documents, insurance and lead time">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Country</th><th>Region</th><th className="num">CS $/kg</th><th className="num">SS $/kg</th>
                <th className="num">Freight $/kg</th><th className="num">Duty %</th><th className="num">Clearance $</th>
                <th className="num">Docs $</th><th className="num">Insurance %</th><th className="num">Lead days</th>
              </tr>
            </thead>
            <tbody>
              {rates.countries.map((c, i) => (
                <tr key={c.country}>
                  <td><b>{c.country}</b></td>
                  <td className="small muted">{c.region}</td>
                  <td className="num"><Num value={c.csUsdKg} onChange={(v) => patchCountry(i, { csUsdKg: v })} width={64} /></td>
                  <td className="num"><Num value={c.ssUsdKg} onChange={(v) => patchCountry(i, { ssUsdKg: v })} width={64} /></td>
                  <td className="num"><Num value={c.freightUsdKg} onChange={(v) => patchCountry(i, { freightUsdKg: v })} width={64} /></td>
                  <td className="num"><Num value={c.dutyPct} onChange={(v) => patchCountry(i, { dutyPct: v })} width={56} /></td>
                  <td className="num"><Num value={c.clearanceUsd} step={10} onChange={(v) => patchCountry(i, { clearanceUsd: v })} width={68} /></td>
                  <td className="num"><Num value={c.docsUsd} step={10} onChange={(v) => patchCountry(i, { docsUsd: v })} width={64} /></td>
                  <td className="num"><Num value={c.insurancePct} onChange={(v) => patchCountry(i, { insurancePct: v })} width={60} /></td>
                  <td className="num"><Num value={c.leadDays} step={1} onChange={(v) => patchCountry(i, { leadDays: v })} width={54} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-note">
          Landed cost per part = mill price × group factor + freight + duty + insurance + allocated clearance/documents.
          Select the source country on each line in <b>Optimized BOQ</b>.
        </div>
      </Card>

      <Card title="Export markets — delivery basis" sub="freight, port, customs, duty, insurance and documentation">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Country</th><th>Port</th><th className="num">Sea nm</th><th className="num">Road km</th><th className="num">Port km</th>
                <th className="num">Land $/km</th><th className="num">Sea base $</th><th className="num">Sea $/t</th>
                <th className="num">Customs %</th><th className="num">Duty %</th><th className="num">Insurance %</th>
                <th className="num">Docs $</th><th className="num">Handling $</th><th className="num">Broker $</th>
              </tr>
            </thead>
            <tbody>
              {rates.destinations.map((d, i) => (
                <tr key={d.country}>
                  <td><b>{d.country}</b></td>
                  <td className="small muted">{d.port}</td>
                  <td className="num"><Num value={d.seaNm} step={10} onChange={(v) => patchDestination(i, { seaNm: v })} width={54} /></td>
                  <td className="num"><Num value={d.roadKm} step={10} onChange={(v) => patchDestination(i, { roadKm: v })} width={54} /></td>
                  <td className="num"><Num value={d.portKm} step={10} onChange={(v) => patchDestination(i, { portKm: v })} width={54} /></td>
                  <td className="num"><Num value={d.landPerKm} onChange={(v) => patchDestination(i, { landPerKm: v })} width={54} /></td>
                  <td className="num"><Num value={d.seaBase} step={50} onChange={(v) => patchDestination(i, { seaBase: v })} width={64} /></td>
                  <td className="num"><Num value={d.seaPerT} onChange={(v) => patchDestination(i, { seaPerT: v })} width={54} /></td>
                  <td className="num"><Num value={d.customsPct} onChange={(v) => patchDestination(i, { customsPct: v })} width={52} /></td>
                  <td className="num"><Num value={d.dutyPct} onChange={(v) => patchDestination(i, { dutyPct: v })} width={52} /></td>
                  <td className="num"><Num value={d.insurancePct} onChange={(v) => patchDestination(i, { insurancePct: v })} width={54} /></td>
                  <td className="num"><Num value={d.docsUsd} step={10} onChange={(v) => patchDestination(i, { docsUsd: v })} width={58} /></td>
                  <td className="num"><Num value={d.handlingUsd} step={10} onChange={(v) => patchDestination(i, { handlingUsd: v })} width={64} /></td>
                  <td className="num"><Num value={d.brokerUsd} step={10} onChange={(v) => patchDestination(i, { brokerUsd: v })} width={58} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Shipping equipment — capacity and rate" sub="the Logistics tab selects the smallest suitable unit">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unit</th><th>Mode</th><th className="num">Max L</th><th className="num">Max W</th><th className="num">Max H</th>
                <th className="num">Max t</th><th className="num">Base $</th><th className="num">$/km</th><th className="num">$/t</th><th className="num">$/nm</th>
              </tr>
            </thead>
            <tbody>
              {rates.equipment.map((u, i) => (
                <tr key={u.name}>
                  <td>{u.name}</td>
                  <td><Pill tone={u.mode === 'Land' ? undefined : 'info'}>{u.mode}</Pill></td>
                  <td className="num"><Num value={u.maxL} onChange={(v) => patchUnit(i, { maxL: v })} width={54} /></td>
                  <td className="num"><Num value={u.maxW} onChange={(v) => patchUnit(i, { maxW: v })} width={54} /></td>
                  <td className="num"><Num value={u.maxH} onChange={(v) => patchUnit(i, { maxH: v })} width={54} /></td>
                  <td className="num"><Num value={u.maxT} step={5} onChange={(v) => patchUnit(i, { maxT: v })} width={58} /></td>
                  <td className="num"><Num value={u.baseUsd} step={50} onChange={(v) => patchUnit(i, { baseUsd: v })} width={68} /></td>
                  <td className="num"><Num value={u.perKm} onChange={(v) => patchUnit(i, { perKm: v })} width={54} /></td>
                  <td className="num"><Num value={u.perT} onChange={(v) => patchUnit(i, { perT: v })} width={54} /></td>
                  <td className="num"><Num value={u.perNm} onChange={(v) => patchUnit(i, { perNm: v })} width={54} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>
          These are budgetary rates, not quotations. Replace them with live mill, freight and customs figures.
          The equipment fit is a hard dimensional and weight filter; a cargo that fits no unit is flagged on the
          Logistics tab instead of being silently priced.
        </Note>
      </Card>

      <Card title="Rate build-up check" sub="selected vessel labour and delivery">
        <div className="grid g4">
          <Stat label="Labour rate" value={rates.shopRateBhd.toFixed(2)} unit="BHD/h" hint={`${money(rates.shopRateBhd / rates.fxBhdPerUsd)}/h equivalent`} />
          <Stat label="Engineering hours" value="1,000" unit="h" hint="example labour block" />
          <Stat label="Direct labour" value={moneyBhd(1000 * rates.shopRateBhd)} hint="1,000 h × shop rate" tone="amber" />
          <Stat label="USD equivalent" value={money(1000 * rates.shopRateBhd / rates.fxBhdPerUsd)} hint={`at ${round(rates.fxBhdPerUsd, 3)} BHD/USD`} />
        </div>
      </Card>
    </div>
  );
}
