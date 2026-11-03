import { useMemo, useState, useEffect } from 'react';
import { EQUIPMENT, UNITS, withOrientation, type Orientation, type Vessel } from './data/vessels';
import { buildVessel, buildGeo, fleetRollup, fmt, money, type Strategy, type VesselCalc } from './lib/engine';
import RegisterTab from './components/tabs/RegisterTab';
import SummaryTab from './components/tabs/SummaryTab';
import DatasheetTab from './components/tabs/DatasheetTab';
import AiImportTab from './components/tabs/AiImportTab';
import DesignTab from './components/tabs/DesignTab';
import MaterialsTab from './components/tabs/MaterialsTab';
import BoqTab from './components/tabs/BoqTab';
import PartsTab from './components/tabs/PartsTab';
import WeldTab from './components/tabs/WeldTab';
import NdtTab from './components/tabs/NdtTab';
import PwhtTab from './components/tabs/PwhtTab';
import MfgTab from './components/tabs/MfgTab';

type TabId = 'register' | 'summary' | 'design' | 'material' | 'boq' | 'parts' | 'weld' | 'ndt' | 'pwht' | 'mfg' | 'datasheet' | 'ai';
type RtMode = 'auto' | 'full' | 'spot' | 'none';

function stamp(roll: ReturnType<typeof fleetRollup>, calcs: VesselCalc[]) {
  return {
    scrap: roll.scrapAvg,
    plates: calcs.reduce((a, c) => a + c.shell.plateCount, 0),
    cost: roll.cost,
    weight: roll.weight,
  };
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'register', label: 'Register' },
  { id: 'summary', label: 'Equipment summary' },
  { id: 'design', label: 'Design & 3D' },
  { id: 'material', label: 'Material / BOQ' },
  { id: 'boq', label: 'Optimized BOQ' },
  { id: 'parts', label: 'Part plan' },
  { id: 'weld', label: 'Weld plan' },
  { id: 'ndt', label: 'NDT plan' },
  { id: 'pwht', label: 'PWHT' },
  { id: 'mfg', label: 'Manufacturing' },
  { id: 'datasheet', label: 'Datasheet' },
  { id: 'ai', label: 'AI data entry' },
];

export default function App() {
  const [unit, setUnit] = useState<'All' | (typeof UNITS)[number]>('All');
  const [selectedId, setSelectedId] = useState('12-C01');
  const [tab, setTab] = useState<TabId>('register');
  const [strategy, setStrategy] = useState<Strategy>('optimized');
  const [rtMode, setRtMode] = useState<RtMode>('auto');
  const [query, setQuery] = useState('');
  const [pwhtMap, setPwhtMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(EQUIPMENT.map((v) => [v.id, v.pwhtRequired])),
  );
  const [orientMap, setOrientMap] = useState<Record<string, Orientation>>(() =>
    Object.fromEntries(EQUIPMENT.map((v) => [v.id, v.orientation])),
  );
  // datasheet edits — these are the engineering basis for every downstream calculation
  const [overrides, setOverrides] = useState<Record<string, Partial<Vessel>>>({});

  const patchVessel = (id: string, patch: Partial<Vessel>) =>
    setOverrides((m) => ({ ...m, [id]: { ...(m[id] ?? {}), ...patch } }));

  // orientation is datasheet data; flipping it also swaps the permanent support
  const vessels = useMemo(
    () => EQUIPMENT.map((v) =>
      withOrientation({ ...v, ...(overrides[v.id] ?? {}) }, overrides[v.id]?.orientation ?? orientMap[v.id] ?? v.orientation),
    ),
    [orientMap, overrides],
  );

  const baselineCalcs = useMemo(
    () => vessels.map((v) => buildVessel(v, { strategy: 'standard', rt: rtMode }, pwhtMap[v.id])),
    [vessels, pwhtMap, rtMode],
  );
  const optimizedCalcs = useMemo(
    () => vessels.map((v) => buildVessel(v, { strategy: 'optimized', rt: rtMode }, pwhtMap[v.id])),
    [vessels, pwhtMap, rtMode],
  );
  const wideCalcs = useMemo(
    () => vessels.map((v) => buildVessel(v, { strategy: 'wide', rt: rtMode }, pwhtMap[v.id])),
    [vessels, pwhtMap, rtMode],
  );

  const fleet = strategy === 'standard' ? baselineCalcs : strategy === 'wide' ? wideCalcs : optimizedCalcs;
  const selected = fleet.find((c) => c.vessel.id === selectedId) ?? fleet[0];

  // keep the selection inside the unit filter
  useEffect(() => {
    if (unit !== 'All' && selected.vessel.unit !== unit) {
      const first = fleet.find((c) => c.vessel.unit === unit);
      if (first) setSelectedId(first.vessel.id);
    }
  }, [unit, fleet, selected.vessel.unit]);

  const inUnit = (c: VesselCalc) => unit === 'All' || c.vessel.unit === unit;
  const visible = fleet.filter(inUnit);
  const roll = fleetRollup(visible);
  const baseScope = baselineCalcs.filter(inUnit);
  const optScope = optimizedCalcs.filter(inUnit);
  const baselineRoll = stamp(fleetRollup(baseScope), baseScope);
  const optimizedRoll = stamp(fleetRollup(optScope), optScope);

  const togglePwht = (id: string) => setPwhtMap((m) => ({ ...m, [id]: !m[id] }));
  const setOrientation = (id: string, o: Orientation) => setOrientMap((m) => ({ ...m, [id]: o }));

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((c) =>
      `${c.vessel.id} ${c.vessel.service} ${c.vessel.kind}`.toLowerCase().includes(q));
  }, [visible, query]);

  const groups = (['Platforming', 'NHT', 'Par-Isom'] as const).filter((u) => unit === 'All' || u === unit);
  const geo = useMemo(() => buildGeo(selected.vessel, selected), [selected]);

  const tabBadge: Partial<Record<TabId, string>> = {
    parts: String(selected.parts.length),
    weld: `${Math.round(selected.calc.totalLengthM)} m`,
    ndt: `${selected.ndt.length}`,
    pwht: selected.pwht.active ? 'ON' : '—',
    mfg: `${Math.round(Math.max(...selected.schedule.map((s) => s.end)))} d`,
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Vessel Fabrication Suite</h1>
            <p>UOP 301 · ASME VIII Div.1 · shop package</p>
          </div>
        </div>

        <div className="unit-tabs">
          {(['All', ...UNITS] as const).map((u) => (
            <button key={u} className={unit === u ? 'on' : ''} onClick={() => setUnit(u)}>
              {u === 'All' ? 'All units' : u}
            </button>
          ))}
        </div>

        <div className="top-stats">
          <div className="top-stat"><b>{visible.length}</b><span>vessels</span></div>
          <div className="top-stat"><b>{fmt(roll.weight / 1000, 0)} t</b><span>fabricated</span></div>
          <div className="top-stat"><b>{roll.pwhtCount}</b><span>PWHT</span></div>
          <div className="top-stat"><b>{money(roll.cost)}</b><span>est. value</span></div>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <div className="side-head">
            <span>Equipment register</span>
            <span className="badge-count">{visible.length}</span>
          </div>
          <div className="side-search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="item no. or service…" />
          </div>
          <div className="vessel-list">
            {groups.map((g) => {
              const items = searchResults.filter((c) => c.vessel.unit === g);
              if (!items.length) return null;
              return (
                <div key={g}>
                  <div className="group-label">
                    <span>{g}</span><span>{items.length}</span>
                  </div>
                  {items.map((c) => {
                    const v: Vessel = c.vessel;
                    return (
                      <button
                        key={v.id}
                        className={`vessel-item ${v.id === selected.vessel.id ? 'on' : ''}`}
                        onClick={() => setSelectedId(v.id)}
                      >
                        <span className="vp" />
                        <span className="vmain">
                          <span className="vid">{v.id}</span>
                          <span className="vsvc">{v.service}</span>
                          <span className="vmeta">Ø{v.di}{v.diTop ? `/${v.diTop}` : ''} · {fmt(v.tt / 1000, 1)} m · {fmt(c.weight.total / 1000, 1)} t</span>
                        </span>
                        <span className={`dot ${c.pwht.active ? 'pwht' : 'none'}`} title={c.pwht.active ? 'PWHT' : 'no PWHT'} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {!searchResults.length && <div className="small muted" style={{ padding: 12 }}>No vessel matches.</div>}
          </div>
        </aside>

        <main className="main">
          <div className="vessel-head">
            <div className="vh-top">
              <div style={{ minWidth: 0 }}>
                <div className="vh-title">
                  <h2>{selected.vessel.service}</h2>
                  <span className="code">{selected.vessel.id}</span>
                  <span className="muted small">{selected.vessel.spec}</span>
                </div>
                <div className="vh-sub">
                  <span>{selected.vessel.unit} unit</span>
                  <span>·</span>
                  <span>{selected.vessel.kind}</span>
                  <span>·</span>
                  <span>{selected.vessel.asmeClass > 0 ? `ASME CL${selected.vessel.asmeClass} RF` : ''}</span>
                  <span>·</span>
                  <span>{selected.vessel.h2s ? 'wet H2S service' : 'non-sour service'}</span>
                </div>
                <div className="chip-row">
                  <span className="chip">{selected.vessel.orientation === 'H' ? 'horizontal' : 'vertical'} <b>{selected.vessel.support}</b></span>
                  <span className="chip">ID <b>{selected.vessel.di}{selected.vessel.diTop ? `/${selected.vessel.diTop}` : ''} mm</b></span>
                  <span className="chip">T/T <b>{fmt(selected.vessel.tt)} mm</b></span>
                  <span className="chip">P <b>{selected.vessel.p} kg/cm²(g)</b></span>
                  <span className="chip">T <b>{selected.vessel.designTempC} °C</b></span>
                  <span className="chip">CA <b>{selected.vessel.ca} mm</b></span>
                  <span className="chip">shell <b>{selected.thk.tShell} mm</b></span>
                  <span className="chip">weight <b>{fmt(selected.weight.total / 1000, 1)} t</b></span>
                  {selected.pwht.active
                    ? <span className="chip amber">PWHT queued</span>
                    : selected.pwht.required
                      ? <span className="chip red">PWHT required</span>
                      : <span className="chip green">no PWHT</span>}
                  {selected.vessel.vacuum && <span className="chip">full vacuum</span>}
                </div>
              </div>

              <div className="vh-right">
                <button className="pwht-switch" onClick={() => togglePwht(selected.vessel.id)} title="Manual PWHT push">
                  <div className={`switch ${selected.pwht.active ? 'on' : ''}`} />
                  <div className="txt">
                    <b>PWHT furnace</b>
                    <span>{selected.pwht.active ? 'queued' : 'not scheduled'}</span>
                  </div>
                </button>
              </div>
            </div>

            <nav className="tabs">
              {TABS.map((t, i) => (
                <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); if (t.id === 'register') setUnit('All'); }}>
                  <span className="num">{String(i + 1).padStart(2, '0')}</span>
                  {t.label}
                  {tabBadge[t.id] && <span className="badge-count">{tabBadge[t.id]}</span>}
                </button>
              ))}
            </nav>
          </div>

          <div className="content">
            {tab === 'register' && (
              <RegisterTab fleet={visible} all={fleet} selectedId={selected.vessel.id} onSelect={(id) => { setSelectedId(id); }} />
            )}
            {tab === 'summary' && <SummaryTab fleet={visible} />}
            {tab === 'design' && (
              <DesignTab
                calc={selected} geo={geo} rtMode={rtMode} setRtMode={setRtMode}
                setOrientation={(o) => setOrientation(selected.vessel.id, o)}
              />
            )}
            {tab === 'material' && (
              <MaterialsTab
                calc={selected} strategy={strategy} setStrategy={setStrategy} fleet={visible}
                baseline={baselineRoll} optimized={optimizedRoll}
              />
            )}
            {tab === 'boq' && <BoqTab fleet={visible} />}
            {tab === 'parts' && <PartsTab calc={selected} />}
            {tab === 'weld' && <WeldTab calc={selected} />}
            {tab === 'ndt' && <NdtTab calc={selected} />}
            {tab === 'pwht' && <PwhtTab calc={selected} fleet={visible} onToggle={togglePwht} />}
            {tab === 'mfg' && <MfgTab calc={selected} />}
            {tab === 'datasheet' && (
              <DatasheetTab
                vessel={selected.vessel}
                calc={selected}
                onPatch={(patch) => patchVessel(selected.vessel.id, patch)}
                onReset={() => setOverrides((m) => {
                  const next = { ...m };
                  delete next[selected.vessel.id];
                  setOrientMap((o) => ({ ...o, [selected.vessel.id]: EQUIPMENT.find((v) => v.id === selected.vessel.id)!.orientation }));
                  return next;
                })}
                isOverridden={Boolean(overrides[selected.vessel.id])}
              />
            )}
            {tab === 'ai' && (
              <AiImportTab
                fleet={vessels}
                selectedId={selected.vessel.id}
                onSelect={(id) => setSelectedId(id)}
                onPatch={patchVessel}
              />
            )}

            <div className="footer-note">
              <b>Engineering basis.</b> Thickness sizing per ASME BPVC Section VIII Division 1 (UG-27, UG-32, UG-34,
              UG-37, UG-28, UW-11, UCS-56) using design data transcribed from UOP Project Specification 301 sheets
              9135752-301, 9135751-301 and 9135753-301 (rev 0). Allowable stresses are indicative SA-516 Gr.70 values
              and must be verified against Section II-D for the purchased material and final design temperature.
              Corrosion allowances, radiography basis and PWHT are shown per sheet; items marked MR on the datasheet
              are resolved here by explicit assumption for planning and remain the manufacturer's responsibility to
              confirm. This tool produces a preliminary fabrication package, not a stamped design report.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
