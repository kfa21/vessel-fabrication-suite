import { useMemo } from 'react';
import { Card, Note, Pill, Stat } from '../ui';
import {
  type LogisticsChoice, type Rates, type ShippingMode,
} from '../../data/rates';
import { fmt, money, moneyBhd, round, type VesselCalc } from '../../lib/engine';

const modes: ShippingMode[] = ['Auto', 'Land', 'Sea', 'Land+Sea'];

export default function LogisticsTab({ calc, fleet, rates, logistics, onChange }: {
  calc: VesselCalc; fleet: VesselCalc[]; rates: Rates;
  logistics: LogisticsChoice; onChange: (l: LogisticsChoice) => void;
}) {
  const s = calc.shipment;
  const cargo = s.cargo;

  const fleetImport = useMemo(() => {
    const map = new Map<string, { country: string; weight: number; usd: number; bhd: number }>();
    fleet.forEach((c) => c.importSummary.forEach((r) => {
      const line = map.get(r.country) ?? { country: r.country, weight: 0, usd: 0, bhd: 0 };
      line.weight += r.weight; line.usd += r.landedUsd; line.bhd += r.landedBhd;
      map.set(r.country, line);
    }));
    const total = [...map.values()].reduce((a, r) => a + r.usd, 0) || 1;
    return [...map.values()].sort((a, b) => b.usd - a.usd)
      .map((r) => ({ ...r, sharePct: round((r.usd / total) * 100, 1) }));
  }, [fleet]);

  const fits = (maxL: number, maxW: number, maxH: number, maxT: number) =>
    cargo.lengthM <= maxL && cargo.widthM <= maxW && cargo.heightM <= maxH && cargo.weightT <= maxT;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Stat label="Cargo envelope" value={`${fmt(cargo.lengthM, 1)} × ${fmt(cargo.widthM, 1)} × ${fmt(cargo.heightM, 1)}`} unit="m" hint={`${fmt(cargo.weightT, 1)} t · ${fmt(cargo.volumeM3, 0)} m³ · ${fmt(cargo.freightT, 1)} freight t`} tone="amber" />
        <Stat label="Selected sea unit" value={s.seaUnit?.name ?? '—'} hint={s.seaUnit ? `${s.seaTrips} trip${s.seaTrips === 1 ? '' : 's'} · ${s.destination.seaNm} nm to ${s.destination.port}` : 'not on this route'} />
        <Stat label="Selected road unit" value={s.landUnit?.name ?? '—'} hint={s.landUnit ? `${s.roadTrips} trip${s.roadTrips === 1 ? '' : 's'} · ${s.resolvedMode}` : 'no road unit fits'} />
        <Stat label="Export logistics" value={moneyBhd(s.totalBhd)} unit="BHD" hint={`${money(s.totalUsd)} · ${s.resolvedMode}`} tone="cyan" />
      </div>

      <Card
        title="Export shipment — destination, mode and equipment"
        sub={`${calc.vessel.id} · ${calc.vessel.service} · fabricated value ${money(s.fabricatedValueUsd)}`}
      >
        <div className="filter-row" style={{ marginBottom: 10 }}>
          <label>
            <span>Destination country</span>
            <select value={logistics.destination} onChange={(e) => onChange({ ...logistics, destination: e.target.value })}>
              {rates.destinations.map((d) => <option key={d.country} value={d.country}>{d.country} — {d.port}</option>)}
            </select>
          </label>
          <div>
            <div className="small muted" style={{ marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.07em', fontSize: 9 }}>Shipping mode</div>
            <div className="seg">
              {modes.map((m) => (
                <button key={m} className={logistics.mode === m ? 'on' : ''} onClick={() => onChange({ ...logistics, mode: m })}>{m}</button>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
            <Pill tone="ok">{s.resolvedMode}</Pill>
            <Pill>{calc.rates.fxBhdPerUsd.toFixed(3)} BHD/USD</Pill>
            <Pill tone="warn">duty {s.destination.dutyPct}%</Pill>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transport unit</th><th>Mode</th><th className="num">Capacity L×W×H</th><th className="num">Max t</th>
                <th>Fit</th><th>Selection</th>
              </tr>
            </thead>
            <tbody>
              {rates.equipment.map((u) => {
                const ok = fits(u.maxL, u.maxW, u.maxH, u.maxT);
                const selected = s.seaUnit?.name === u.name || s.landUnit?.name === u.name;
                return (
                  <tr key={u.name} style={selected ? { background: 'var(--amber-soft)' } : undefined}>
                    <td>{u.name}</td>
                    <td><Pill tone={u.mode === 'Land' ? undefined : 'info'}>{u.mode}</Pill></td>
                    <td className="num mono">{u.maxL} × {u.maxW} × {u.maxH} m</td>
                    <td className="num">{u.maxT} t</td>
                    <td>{ok ? <Pill tone="ok">fits</Pill> : <Pill tone="bad">too small</Pill>}</td>
                    <td className="small">{selected ? <b style={{ color: 'var(--amber)' }}>selected</b> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Note tone="cyan">
          The selected unit is the smallest deck envelope that clears the cargo length, width, height and weight.
          A cargo that fits no unit is flagged rather than quoted. Land+Sea uses the road unit for the works-to-port
          leg and the port-to-site leg, and the sea unit for the ocean leg.
        </Note>
      </Card>

      <div className="grid g2">
        <Card title="Export cost build-up" sub={`${s.destination.country} · ${s.resolvedMode}`}>
          <table>
            <thead><tr><th>Cost line</th><th className="num">USD</th><th className="num">BHD</th></tr></thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td className="num">{money(l.usd)}</td>
                  <td className="num muted">{moneyBhd(l.usd * rates.fxBhdPerUsd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total export logistics</td>
                <td className="num">{money(s.totalUsd)}</td>
                <td className="num">{moneyBhd(s.totalBhd)}</td>
              </tr>
            </tfoot>
          </table>
          <Note tone="amber">
            Duty and customs are charged on the fabricated value ({money(s.fabricatedValueUsd)}), then insurance is
            charged on value plus freight and duty. That is why the insurance line is not simply a percentage of the
            material cost. Confirm the HS code and incoterm before using this as a customs declaration.
          </Note>
        </Card>

        <Card title="Import landed cost by country" sub={`${fleet.length} equipment in scope`}>
          <table>
            <thead><tr><th>Country</th><th className="num">Weight</th><th className="num">Landed USD</th><th className="num">Landed BHD</th><th className="num">Share</th></tr></thead>
            <tbody>
              {fleetImport.map((r) => (
                <tr key={r.country}>
                  <td>{r.country}</td>
                  <td className="num">{fmt(r.weight / 1000, 1)} t</td>
                  <td className="num">{money(r.usd)}</td>
                  <td className="num">{moneyBhd(r.bhd)}</td>
                  <td className="num">{r.sharePct}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total imported material</td>
                <td className="num">{fmt(fleetImport.reduce((a, r) => a + r.weight, 0) / 1000, 1)} t</td>
                <td className="num">{money(fleetImport.reduce((a, r) => a + r.usd, 0))}</td>
                <td className="num">{moneyBhd(fleetImport.reduce((a, r) => a + r.bhd, 0))}</td>
                <td className="num">100%</td>
              </tr>
            </tfoot>
          </table>
          <div className="tbl-note">
            This table follows the source country selected on each part in the Optimized BOQ tab. Selecting a
            different country there immediately re-prices freight, duty, insurance and clearance here.
          </div>
        </Card>
      </div>

      <Card title="Fleet delivery register" sub="one line per equipment at the chosen destination and mode" flush>
        <div className="table-wrap" style={{ maxHeight: 420 }}>
          <table>
            <thead>
              <tr>
                <th>Equipment</th><th>Service</th><th className="num">Cargo m</th><th className="num">t</th>
                <th>Route</th><th>Sea unit</th><th>Road unit</th>
                <th className="num">USD</th><th className="num">BHD</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((c) => (
                <tr key={c.vessel.id} style={c.vessel.id === calc.vessel.id ? { background: 'var(--amber-soft)' } : undefined}>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{c.vessel.id}</td>
                  <td className="small muted">{c.vessel.service}</td>
                  <td className="num">{c.shipment.cargo.lengthM} × {c.shipment.cargo.widthM} × {c.shipment.cargo.heightM}</td>
                  <td className="num">{fmt(c.shipment.cargo.weightT, 1)}</td>
                  <td><Pill>{c.shipment.resolvedMode}</Pill></td>
                  <td className="small">{c.shipment.seaUnit?.name ?? '—'}</td>
                  <td className="small">{c.shipment.landUnit?.name ?? '—'}</td>
                  <td className="num">{money(c.shipment.totalUsd)}</td>
                  <td className="num">{moneyBhd(c.shipment.totalBhd)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>Total export logistics</td>
                <td className="num">{money(fleet.reduce((a, c) => a + c.shipment.totalUsd, 0))}</td>
                <td className="num">{moneyBhd(fleet.reduce((a, c) => a + c.shipment.totalBhd, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="tbl-note">
          Cargo is the fabricated envelope including heads, skirt, transport saddles and attachments. Sea and road
          trips are rounded up from the selected unit's tonnage capacity.
        </div>
      </Card>
    </div>
  );
}
