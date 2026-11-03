import { useMemo, useState } from 'react';
import { Pill, downloadCsv } from '../ui';
import { fmt, money, nextGauge, round, type VesselCalc } from '../../lib/engine';
import { datasheetFor, type Vessel, type HeadKind, type NozzleSpec, type Orientation } from '../../data/vessels';

type RowKind = 'text' | 'number' | 'select' | 'yesno' | 'static';

interface Row {
  label: string;
  kind: RowKind;
  field?: keyof Vessel;
  options?: { v: string | number; l: string }[];
  value?: (v: Vessel, c: VesselCalc) => string;
  unit?: string;
  note?: string;
  /** field does not exist on the original UOP datasheet — added for the calculation basis */
  isNew?: boolean;
  step?: number;
  wide?: boolean;
}

interface Section {
  no: number;
  title: string;
  sub: string;
  rows: Row[];
  /** component schedule rendered under the rows */
  table?: 'nozzle' | 'manway';
  /** free-form component schedule for internals, vortex breakers and boots */
  parts?: (v: Vessel, c: VesselCalc) => { head: string[]; rows: string[][]; note: string };
}

const SELECTS: Record<string, { v: string | number; l: string }[]> = {
  kind: [
    { v: 'Column', l: 'Column' },
    { v: 'Drum', l: 'Drum' },
    { v: 'Receiver', l: 'Receiver' },
    { v: 'Treater', l: 'Treater' },
    { v: 'Separator', l: 'Separator' },
  ],
  orientation: [
    { v: 'V', l: 'Vertical' },
    { v: 'H', l: 'Horizontal' },
  ],
  head: [
    { v: 'SE', l: '2:1 Elliptical' },
    { v: 'FLAT', l: 'Flat' },
    { v: 'CONE', l: 'Conical' },
  ],
  support: [
    { v: 'Skirt', l: 'Skirt' },
    { v: 'Legs', l: 'Legs' },
    { v: 'Saddles', l: 'Saddles' },
  ],
  rt: [
    { v: 'Full', l: 'Full RT' },
    { v: 'Spot', l: 'Spot RT' },
  ],
  class: [150, 300, 600, 900, 1500, 2500].map((n) => ({ v: n, l: `CL${n}` })),
  yesno: [
    { v: 'true', l: 'Yes' },
    { v: 'false', l: 'No' },
  ],
};

const headLabel = (h: HeadKind) => (h === 'FLAT' ? 'Flat' : h === 'CONE' ? 'Conical' : '2:1 Elliptical');

export default function DatasheetTab({ vessel, calc, fleet, onPatch, onReset, isOverridden }: {
  vessel: Vessel;
  calc: VesselCalc;
  fleet: VesselCalc[];
  onPatch: (patch: Partial<Vessel>) => void;
  onReset: () => void;
  isOverridden: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const set = (field: keyof Vessel, raw: string, kind: RowKind) => {
    setDraft((d) => ({ ...d, [field]: raw }));
    if (kind === 'number') {
      if (raw === '' || raw === '-') return;
      const n = Number(raw);
      if (Number.isFinite(n)) onPatch({ [field]: n } as Partial<Vessel>);
      return;
    }
    if (kind === 'yesno') {
      onPatch({ [field]: raw === 'true' } as Partial<Vessel>);
      return;
    }
    if (field === 'orientation') {
      onPatch({ orientation: raw as Orientation, support: raw === 'H' ? 'Saddles' : vessel.support } as Partial<Vessel>);
      return;
    }
    onPatch({ [field]: raw } as Partial<Vessel>);
  };

  const ds = useMemo(() => datasheetFor(vessel.id), [vessel.id]);
  const nozzles = vessel.nozzles.filter((n) => n.nps < 18);
  const nozzleCount = nozzles.reduce((a, n) => a + n.qty, 0);
  const manways = vessel.nozzles.filter((n) => n.nps >= 18);
  const manwayCount = manways.reduce((a, n) => a + n.qty, 0);
  const overrideCount = Object.keys(draft).length;

  /* component matrix — one row per fabricated component, one column per equipment item */
  const grid = useMemo(() => {
    const order: Vessel['kind'][] = ['Column', 'Drum', 'Separator', 'Receiver', 'Treater'];
    const groups = order
      .map((kind) => ({ kind, items: fleet.filter((c) => c.vessel.kind === kind) }))
      .filter((g) => g.items.length > 0);
    const cols = groups.flatMap((g) => g.items);
    const rows = COMPONENTS.map((comp) => ({
      label: comp.label,
      cells: cols.map((c) => comp.cell(c.vessel, c)),
    }));
    return { groups, cols, rows };
  }, [fleet]);
  const activeCol = grid.cols.findIndex((c) => c.vessel.id === vessel.id);

  const sections: Section[] = useMemo(() => [
    {
      no: 0,
      title: 'Datasheet — Excel sequence',
      sub: 'Issued client datasheet (Book3), same columns and order. Design pressure, temperature and orientation stay live and editable; the other columns are the values as issued.',
      rows: [
        { label: 'S. No.', kind: 'static', value: () => (ds ? String(ds.sno) : '—') },
        { label: 'Unit', kind: 'static', value: () => ds?.unit ?? '—' },
        { label: 'Tag no.', kind: 'static', value: () => vessel.id },
        { label: 'Service', kind: 'static', value: () => ds?.service ?? vessel.service },
        { label: 'Orientation', kind: 'select', field: 'orientation', options: SELECTS.orientation },
        { label: 'Design pressure', kind: 'number', field: 'p', unit: 'kg/cm²(g)', step: 0.5 },
        { label: 'Design temperature', kind: 'number', field: 'designTempC', unit: '°C', step: 5 },
        { label: 'MOC', kind: 'static', value: () => ds?.moc ?? '—' },
        { label: 'Size', kind: 'static', value: () => ds?.size ?? '—' },
        { label: 'Special service', kind: 'static', value: () => ds?.specialService ?? '—' },
        { label: 'Shell thickness', kind: 'static', value: () => ds?.shellThk ?? '—' },
        { label: 'Top head thickness', kind: 'static', value: () => ds?.headTopThk ?? '—' },
        { label: 'Bottom head thickness', kind: 'static', value: () => ds?.headBotThk ?? '—' },
        { label: 'Design pressure (as issued)', kind: 'static', value: () => ds?.p ?? '—' },
      ],
    },
    {
      no: 1,
      title: 'Identification',
      sub: 'Equipment identification and basic design data',
      rows: [
        { label: 'Equipment item no.', kind: 'text', field: 'id' },
        { label: 'Service', kind: 'text', field: 'service', wide: true },
        { label: 'Equipment type', kind: 'select', field: 'kind', options: SELECTS.kind },
        { label: 'Construction', kind: 'static', value: (v) => v.kind },
        { label: 'Orientation', kind: 'select', field: 'orientation', options: SELECTS.orientation },
        { label: 'Project unit', kind: 'static', value: (v) => v.unit },
        { label: 'Spec / datasheet', kind: 'static', value: (v) => v.spec },
        { label: 'Design pressure', kind: 'number', field: 'p', unit: 'kg/cm²(g)', step: 0.5 },
        { label: 'Design temperature', kind: 'number', field: 'designTempC', unit: '°C', step: 5 },
        { label: 'MDMT', kind: 'number', field: 'mdmtC', unit: '°C', step: 1 },
        { label: 'Corrosion allowance', kind: 'number', field: 'ca', unit: 'mm', step: 0.5 },
        { label: 'Flange / nozzle class', kind: 'select', field: 'asmeClass', options: SELECTS.class, isNew: true },
        { label: 'Radiography', kind: 'select', field: 'rtPolicy', options: SELECTS.rt, isNew: true },
        { label: 'PWHT required', kind: 'yesno', field: 'pwhtRequired', isNew: true },
        { label: 'Full vacuum design', kind: 'yesno', field: 'vacuum', isNew: true },
        { label: 'Wet H₂S service', kind: 'yesno', field: 'h2s', isNew: true },
      ],
    },
    {
      no: 2,
      title: 'Shell segment 1',
      sub: 'Governing (lower) shell — thickness from UG-27(c)(1)',
      rows: [
        { label: 'Inside diameter', kind: 'number', field: 'di', unit: 'mm', step: 50 },
        { label: 'Upper inside diameter', kind: 'number', field: 'diTop', unit: 'mm', step: 50, isNew: true },
        { label: 'T/T length', kind: 'number', field: 'tt', unit: 'mm', step: 50 },
        { label: 'Shell material', kind: 'static', value: () => 'SA-516 Gr.70', isNew: true },
        { label: 'Shell thickness (calculated)', kind: 'static', value: (_v, c) => `${thick(c, 'shell-circ')} mm`, isNew: true },
        { label: 'Upper shell thickness', kind: 'static', value: (_v, c) => (c.vessel.diTop ? `${thick(c, 'shell-top')} mm` : '—'), isNew: true },
        { label: 'Stiffener rings', kind: 'static', value: (_v, c) => (c.thk.external.ringsRequired ? `${c.thk.external.ringsRequired} off · spacing ${c.thk.external.ringSpacingMm} mm` : 'not required'), isNew: true },
        { label: 'Total length (incl. heads & skirt)', kind: 'static', value: (_v, c) => `${fmt(c.calc.totalLengthM / 1000, 1)} m`, isNew: true },
      ],
    },
    {
      no: 3,
      title: 'Vessel head 1',
      sub: 'Top and bottom dished ends — UG-32 / UG-34',
      rows: [
        { label: 'Top head type', kind: 'select', field: 'headTop', options: SELECTS.head },
        { label: 'Bottom head type', kind: 'select', field: 'headBot', options: SELECTS.head },
        { label: 'Top head thickness', kind: 'static', value: (_v, c) => `${thick(c, c.vessel.headTop === 'FLAT' ? 'head-top-flat' : 'head-top')} mm`, isNew: true },
        { label: 'Bottom head thickness', kind: 'static', value: (_v, c) => `${thick(c, c.vessel.headBot === 'FLAT' ? 'head-bot-flat' : 'head-bot')} mm`, isNew: true },
        { label: 'Cone transition', kind: 'static', value: (_v, c) => (c.vessel.diTop ? `${thick(c, 'cone')} mm` : 'not applicable'), isNew: true },
        { label: 'Governing thickness', kind: 'static', value: (_v, c) => `${c.thk.govern}`, isNew: true },
        { label: 'Dishend material', kind: 'static', value: () => 'SA-516 Gr.70', isNew: true },
      ],
    },
    {
      no: 4,
      title: 'Nozzles',
      sub: `${nozzles.length} unique marks · ${nozzleCount} off total · flange CL${vessel.asmeClass} RF — manways are scheduled separately in section 06`,
      rows: [],
      table: 'nozzle',
    },
    {
      no: 5,
      title: 'Manways',
      sub: manways.length ? `${manwayCount} off · ${manways.map((m) => `NPS ${m.nps}`).join(', ')} — every component scheduled below` : 'No manway-sized opening on this datasheet',
      rows: [
        { label: 'Manway size', kind: 'static', value: () => (manways.length ? manways.map((m) => `NPS ${m.nps}`).join(' / ') : '—') },
        { label: 'Covers', kind: 'static', value: () => (manways.length ? `${manwayCount} off · hinged davit arm each` : '—') },
        { label: 'Davit arm', kind: 'static', value: () => (manways.length ? 'Yes — one per cover' : 'No') },
      ],
      table: 'manway',
    },
    {
      no: 6,
      title: 'External support',
      sub: 'Permanent support and transportation arrangement',
      rows: [
        { label: 'Permanent support', kind: 'select', field: 'support', options: SELECTS.support },
        { label: 'Support quantity', kind: 'static', value: (v) => (v.support === 'Saddles' ? '2 off (1 fixed + 1 sliding)' : v.support === 'Legs' ? '4 off' : '1 off skirt') },
        { label: 'Saddle bearing width', kind: 'static', value: (v) => `${saddleW(v)} mm`, isNew: true },
        { label: 'Saddle height', kind: 'static', value: (v) => `${saddleH(v)} mm`, isNew: true },
        { label: 'Transportation saddles', kind: 'static', value: (v) => (v.orientation === 'H' ? 'not applicable — travels on permanent saddles' : '2 off shipping cradles at 0.3 L from each tangent line'), isNew: true },
        { label: 'Transportation saddle spacing', kind: 'static', value: (v) => (v.orientation === 'H' ? '—' : `${fmt((v.tt * 0.6) / 1000, 2)} m`), isNew: true },
        { label: 'Lifting lugs / trunnions', kind: 'static', value: () => lugsFor(calc), isNew: true },
        { label: 'Shipping weight', kind: 'static', value: (_v, c) => `${fmt(c.weight.total / 1000, 2)} t`, isNew: true },
      ],
    },
    {
      no: 7,
      title: 'Ladders',
      sub: 'Access equipment',
      rows: [
        { label: 'Caged ladder', kind: 'static', value: (v) => (v.orientation === 'V' && v.tt > 2500 ? `1 set · ${fmt(v.tt / 1000, 1)} m` : 'not required') },
        { label: 'Rest platforms', kind: 'static', value: (v) => (v.orientation === 'V' && v.tt > 6000 ? `${Math.ceil(v.tt / 6000)} off` : 'not required') },
        { label: 'Stairs', kind: 'static', value: () => 'by others' },
      ],
    },
    {
      no: 8,
      title: 'Platforms',
      sub: 'Walkways and standing areas',
      rows: [
        { label: 'Platform area', kind: 'static', value: (v) => (v.orientation === 'V' && v.tt > 6000 ? `${round((Math.PI * ((v.di + 300) / 1000)) * 1.2 * Math.ceil(v.tt / 6000), 1)} m²` : 'by others') },
        { label: 'Grating', kind: 'static', value: () => 'SA-36 galvanised' },
      ],
    },
    {
      no: 9,
      title: 'Internal rungs / rings',
      sub: 'Tray, demister and bed support rings — welded direct to the shell',
      rows: [
        { label: 'Support rings welded to shell', kind: 'static', value: (v, c) => `${(v.trays ?? 0) + (v.packing || v.bedDepth ? 2 : 0) + (has(v, 'mist eliminator') ? 1 : 0) + (c.thk.external.ringsRequired ?? 0)} off` },
        { label: 'Tray support rings', kind: 'static', value: (v) => (v.trays ? `${v.trays} off · 50 × 8 flats` : 'not required') },
        { label: 'Demister support ring', kind: 'static', value: (v) => (has(v, 'mist eliminator') ? '1 off · 50 × 8 flat' : 'not required') },
        { label: 'Bed support / limiter rings', kind: 'static', value: (v) => (v.packing || v.bedDepth ? '2 off · 75 × 10 and 50 × 8 flats' : 'not required') },
        { label: 'Vacuum stiffener rings', kind: 'static', value: (_v, c) => (c.thk.external.ringsRequired ? `${c.thk.external.ringsRequired} off` : 'not required') },
        { label: 'Attachment', kind: 'static', value: () => 'Direct weld to shell — continuous 6 mm fillet, ground flush' },
        { label: 'Material', kind: 'static', value: () => 'SA-516 Gr.70' },
      ],
      parts: (v, c) => ({
        head: ['Ring', 'Qty', 'Size', 'Section', 'Material', 'Attachment'],
        rows: ringRows(v, c),
        note: 'Support rings are welded directly to the shell before the internals are installed · tray rings set level within ±3 mm at each tray elevation and located from the top tangent · demister and bed rings carry the full bed / element load into the shell · all internal welds are completed before final closure and before PWHT · ring-to-shell welds are continuous 6 mm fillets, ground flush where trays or packing sit on the ring.',
      }),
    },
    {
      no: 10,
      title: 'Baffles / trays',
      sub: 'Internals that set the process duty',
      rows: [
        { label: 'Trays', kind: 'static', value: (v) => (v.trays ? `${v.trays} off` : '—') },
        { label: 'Tray type', kind: 'static', value: (v) => v.trayType ?? '—' },
        { label: 'Bed depth', kind: 'static', value: (v) => (v.bedDepth ? `${v.bedDepth} mm` : '—') },
        { label: 'Packing', kind: 'static', value: (v) => v.packing ?? '—' },
      ],
    },
    {
      no: 11,
      title: 'Demisters',
      sub: 'Mist eliminator',
      rows: [
        { label: 'Mist eliminator', kind: 'static', value: (v) => (has(v, 'mist eliminator') ? '1 off — by others, support by fabricator' : 'not required') },
        { label: 'Material', kind: 'static', value: () => 'Alloy 400 / 304' },
      ],
    },
    {
      no: 12,
      title: 'Coalescers',
      sub: 'Coalescing equipment',
      rows: [
        { label: 'Coalescer', kind: 'static', value: (v) => (has(v, 'coalescer') ? '1 off · 300 mm — by others' : 'not required') },
        { label: 'Material', kind: 'static', value: () => 'Type 316' },
      ],
    },
    {
      no: 13,
      title: 'Vortex breaker',
      sub: 'Outlet protection — cross-vane breaker welded into the bottom head',
      rows: [
        { label: 'Vortex breaker', kind: 'static', value: (v) => (vortexApplies(v) ? '1 off · raised cross-vane' : 'not required') },
        { label: 'Protected outlet', kind: 'static', value: (v, c) => { const d = vortexDims(v, c); return d ? `${d.nozzle.mark} · ${npsText(d.nozzle.nps)} · ${d.nozzle.service}` : '—'; } },
        { label: 'Breaker size', kind: 'static', value: (v, c) => { const d = vortexDims(v, c); return d ? `Ø${d.breakerOd} × ${d.vaneH} mm high` : '—'; } },
        { label: 'Plate thickness', kind: 'static', value: () => '10 mm' },
        { label: 'Material', kind: 'static', value: () => 'SA-516 Gr.70' },
        { label: 'Attachment', kind: 'static', value: () => 'Directly welded to the bottom head and outlet neck — no removable fasteners' },
      ],
      parts: (v, c) => ({
        head: ['Component', 'Qty', 'Size (mm)', 'Thk', 'Material', 'Fixing'],
        rows: vortexRows(v, c),
        note: 'Cross-vane vortex breaker in the outlet, sized from the protected nozzle bore · vanes and top plate 10 mm SA-516 Gr.70, fully fillet-welded to each other and to the outlet collar · the collar is welded directly to the bottom head with a continuous 8 mm fillet, so the breaker is a permanent internal and is installed before final closure · vane height and breaker diameter are generated from the outlet size, so they follow any nozzle change.',
      }),
    },
    {
      no: 14,
      title: 'Boot / drop leg',
      sub: 'Outlet configuration — shell, head, closure and fasteners',
      rows: [
        { label: 'Boot provided', kind: 'static', value: (v) => (v.dropLeg ? 'Yes' : 'No') },
        { label: 'Boot OD', kind: 'static', value: (v) => (v.dropLeg ? `${v.dropLeg.od} mm` : '—') },
        { label: 'Boot length T/T', kind: 'static', value: (v) => (v.dropLeg ? `${fmt(v.dropLeg.tt)} mm` : '—') },
        { label: 'Boot shell thickness', kind: 'static', value: (_v, c) => (c.vessel.dropLeg ? `${selThk(c, 'dropleg') ?? '—'} mm` : '—') },
        { label: 'Boot corrosion allowance', kind: 'static', value: (v) => (v.dropLeg ? `${v.caLeg ?? v.ca} mm` : '—') },
        { label: 'Boot closure', kind: 'static', value: (v) => (v.dropLeg ? `BLRF ${npsText(npsFromOd(v.dropLeg.od))} CL${v.asmeClass} · blind + 6 mm SW gasket` : '—') },
        { label: 'Boot insulation / heat trace', kind: 'static', value: (v) => (v.dropLeg ? 'By others — winterizing of boot and bottom head' : '—') },
      ],
      parts: (v, c) => ({
        head: ['Component', 'Qty', 'Size', 'Thk', 'Material', 'Notes'],
        rows: bootRows(v, c),
        note: 'Boot is a pressure part in its own right: shell thickness from UG-27 with its own corrosion allowance, dished bottom head and a bolted blind closure · the boot-to-main-shell junction is a full-penetration weld with the main shell, radiographed with the shell seams · flange, blind, gasket and studs follow ASME B16.5 at the vessel class · insulation and heat tracing on the boot are by others.',
      }),
    },
  ], [vessel, calc, ds]);

  const exportCsv = () => downloadCsv(`Datasheet-${vessel.id}.csv`, [
    ['UOP DATASHEET', vessel.id, vessel.service],
    ['Section', 'Field', 'Value', 'Source'],
    ...sections.flatMap((s) => [
      ...s.rows.map((r) => [
        `${s.no + 1}. ${s.title}`,
        r.label,
        r.kind === 'static' ? (r.value?.(vessel, calc) ?? '') : display(vessel, r, draft),
        r.isNew ? 'added for calculation basis' : 'datasheet',
      ]),
      ...(s.table ? (s.table === 'manway' ? manways : nozzles).flatMap((nz) => {
        const p = nozzleParts(vessel, calc, nz);
        const who = `${nz.mark} · ${npsText(nz.nps)} · CL${nz.cls ?? vessel.asmeClass} · ${nz.qty} off`;
        const src = s.table === 'manway' ? 'manway schedule' : 'nozzle schedule';
        return [
          [`${s.no + 1}. ${s.title}`, `${who} — flange`, p.flange, src],
          [`${s.no + 1}. ${s.title}`, `${who} — pipe / neck`, p.pipe, src],
          [`${s.no + 1}. ${s.title}`, `${who} — pipe length`, `${p.length} mm (flange face to shell)`, src],
          [`${s.no + 1}. ${s.title}`, `${who} — RF pad`, p.pad, src],
          [`${s.no + 1}. ${s.title}`, `${who} — gasket`, p.gasket, src],
          [`${s.no + 1}. ${s.title}`, `${who} — fasteners`, p.bolts, src],
        ];
      }) : []),
      ...(s.parts ? s.parts(vessel, calc).rows.map((r) => [
        `${s.no + 1}. ${s.title}`,
        r[0],
        r.slice(1).join(' · '),
        'component schedule',
      ]) : []),
    ]),
  ]);

  const exportMatrixCsv = () => downloadCsv('Component-matrix.csv', [
    ['Component', ...grid.cols.map((c) => `${c.vessel.id} — ${c.vessel.service}`)],
    ...grid.rows.map((r) => [r.label, ...r.cells]),
  ]);

  return (
    <div className="ds">
      <div className="ds-bar">
        <div className="ds-bar-id">
          <span className="ds-tag">{vessel.id}</span>
          <div>
            <b>{vessel.service}</b>
            <span>
              {vessel.kind} · {vessel.orientation === 'V' ? 'vertical' : 'horizontal'} · Ø{vessel.di}
              {vessel.diTop ? `/${vessel.diTop}` : ''} mm · {fmt(vessel.tt)} mm T/T
            </span>
          </div>
        </div>
        <div className="ds-bar-actions">
          {isOverridden && <Pill tone="warn">{overrideCount || 'edited'} field{overrideCount === 1 ? '' : 's'} overridden</Pill>}
          <button className="btn sm" onClick={exportCsv}>↓ Export CSV</button>
          <button className="btn sm" onClick={exportMatrixCsv}>↓ Component matrix</button>
          {isOverridden && <button className="btn sm" onClick={() => { setDraft({}); onReset(); }}>Reset to datasheet</button>}
          <button className={editing ? 'btn sm on' : 'btn sm'} onClick={() => setEditing((e) => !e)}>
            {editing ? '✓ Done editing' : '✎ Edit values'}
          </button>
        </div>
      </div>

      <div className="ds-basis">
        <div><span>Shell (calc)</span><b>{calc.thk.tShell} mm</b></div>
        <div><span>Head (calc)</span><b>{calc.thk.tHeadTop} / {calc.thk.tHeadBot} mm</b></div>
        <div><span>Total length</span><b>{fmt(calc.calc.totalLengthM / 1000, 2)} m</b></div>
        <div><span>Fabricated weight</span><b>{fmt(calc.weight.total / 1000, 2)} t</b></div>
        <div><span>Weld length</span><b>{fmt(calc.weld.totalLengthM)} m</b></div>
        <div><span>Man-hours</span><b>{fmt(calc.manhours)}</b></div>
        <div><span>Estimated value</span><b>{money(calc.cost.total)}</b></div>
      </div>

      <div className="ds-legend">
        <span className="ds-new-chip">NEW</span>
        <span>fields added for the calculation basis — not present on the original UOP datasheet.</span>
      </div>

      <section className="ds-sec ds-comp">
        <header className="ds-sec-head">
          <span className="ds-sec-no">C</span>
          <div>
            <h3>Component summary — columns &amp; vessels</h3>
            <p>
              {grid.rows.length} components × {grid.cols.length} equipment items · values generated by the live calculation ·
              the column for {vessel.id} is highlighted
            </p>
          </div>
        </header>
        <div className="ds-comp-scroll">
          <table className="ds-comp-table">
            <thead>
              <tr>
                <th className="ds-comp-corner" rowSpan={2}>Component</th>
                {grid.groups.map((g) => (
                  <th className="ds-comp-group" key={g.kind} colSpan={g.items.length}>
                    {g.kind === 'Column' ? 'Columns' : `${g.kind}s`}
                  </th>
                ))}
              </tr>
              <tr>
                {grid.cols.map((c) => (
                  <th key={c.vessel.id} className={c.vessel.id === vessel.id ? 'on' : ''}>
                    <b>{c.vessel.id}</b>
                    <span>{c.vessel.service}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.cells.map((txt, i) => (
                    <td key={grid.cols[i].vessel.id} className={`${i === activeCol ? 'on' : ''}${txt === '—' ? ' na' : ''}`}>
                      {txt}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ds-nozzle-note">
          Qty and principal size / grade per component, as fabricated for each equipment item: shell courses and neck walls from
          UG-27, heads from UG-32/34, pads from UG-37, support from the skirt / saddle / leg take-off, internals from the process
          data. “—” means the component is not applicable to that item. Component values follow the datasheet edits, PWHT and
          radiography switches, so the matrix recalculates with the rest of the suite.
        </p>
      </section>

      {sections.map((s) => (
        <section className="ds-sec" key={s.no}>
          <header className="ds-sec-head">
            <span className="ds-sec-no">{String(s.no + 1).padStart(2, '0')}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.sub}</p>
            </div>
          </header>

          {s.rows.length > 0 && <div className="ds-grid">
            {s.rows.map((r) => (
              <div className={r.isNew ? 'ds-row ds-row-new' : 'ds-row'} key={r.label}>
                <span className="ds-label">
                  {r.label}
                  {r.isNew && <span className="ds-new-chip">NEW</span>}
                </span>
                <span className="ds-value">
                  {editing && r.kind !== 'static' && r.field ? (
                    <Control vessel={vessel} row={r} draft={draft} onChange={set} />
                  ) : r.kind === 'static' ? (
                    <>{r.value?.(vessel, calc) ?? '—'}</>
                  ) : (
                    <>
                      {display(vessel, r, draft)}
                      {r.unit && <span className="ds-unit"> {r.unit}</span>}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>}

          {s.table && (
            <div className="ds-nozzles">
              <table>
                <thead>
                  <tr>
                    <th>Mark</th><th>Service</th><th>NPS</th><th>Qty</th><th>CL</th>
                    <th>Flange — type · size · material</th>
                    <th>Pipe / neck — size · sch · material</th>
                    <th>Pipe length<br />face to shell</th>
                    <th>RF pad — size · material</th>
                    <th>Gasket</th>
                    <th>Fasteners</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.table === 'manway' ? manways : nozzles).map((n) => {
                    const p = nozzleParts(vessel, calc, n);
                    return (
                      <tr key={n.mark}>
                        <td className="mono">{n.mark}</td>
                        <td>{n.service}</td>
                        <td>{npsText(n.nps)}</td>
                        <td>{n.qty}</td>
                        <td>CL{n.cls ?? vessel.asmeClass}</td>
                        <td>{p.flange}</td>
                        <td>{p.pipe}</td>
                        <td>{p.length} mm</td>
                        <td>{p.pad}</td>
                        <td>{p.gasket}</td>
                        <td>{p.bolts}</td>
                      </tr>
                    );
                  })}
                  {(s.table === 'manway' ? manways : nozzles).length === 0 && (
                    <tr>
                      <td className="ds-empty" colSpan={11}>
                        {s.table === 'manway' ? 'No manway-sized opening on this datasheet.' : 'No process nozzle under NPS 18 on this datasheet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="ds-nozzle-note">
                {s.table === 'manway' ? (
                  <>
                    Manways are the NPS 18 and larger openings, scheduled here with their own components · flange face RF and stud
                    sizes / bolt counts per ASME B16.5 · blind flange with davit arm, hinge and swing bolt per cover · 6 mm
                    spiral-wound SS316L/graphite gasket · 300 mm neck projection from flange face to shell · NPS 20 and above use a
                    neck fabricated from shell plate · fasteners are A193 B7 studs with A194 2H nuts, quoted per joint.
                  </>
                ) : (
                  <>
                    Process nozzles below NPS 18 · flange face RF · sizes, stud sizes and bolt counts per ASME B16.5 · spiral-wound
                    (SW) gaskets SS316L/graphite · RF pads sized by UG-37 and shown as OD × thickness · pipe length is the neck
                    projection from flange face to shell (150 mm up to NPS 4, 200 mm NPS 6–8, 250 mm NPS 10–16), allowing for
                    insulation and wrench clearance — confirm against the GA drawing · fasteners are A193 B7 studs with A194 2H
                    nuts, quoted per joint (multiply by Qty for the vessel total).
                  </>
                )}
              </p>
            </div>
          )}

          {s.parts && (() => {
            const pt = s.parts(vessel, calc);
            return (
              <div className="ds-nozzles ds-parts">
                <table>
                  <thead>
                    <tr>{pt.head.map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {pt.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => <td key={j} className={j === 0 ? 'mono' : ''}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="ds-nozzle-note">{pt.note}</p>
              </div>
            );
          })()}
        </section>
      ))}

      <p className="ds-foot">
        Every value here is the input to the suite's calculations: change a field and shell/head thickness,
        weights, weld lengths, BOQ take-off and cost are recomputed for all tabs. Fields tagged
        <span className="ds-new-chip">NEW</span> were added by this suite and are not on the original UOP sheet.
      </p>
    </div>
  );
}

function Control({ vessel, row, draft, onChange }: {
  vessel: Vessel;
  row: Row;
  draft: Record<string, string>;
  onChange: (field: keyof Vessel, raw: string, kind: RowKind) => void;
}) {
  const field = row.field!;
  const current = draft[field] ?? String(vessel[field] ?? '');

  if (row.kind === 'select') {
    return (
      <select className="ds-input" value={current} onChange={(e) => onChange(field, e.target.value, 'select')}>
        {row.options?.map((o) => <option key={String(o.v)} value={String(o.v)}>{o.l}</option>)}
      </select>
    );
  }
  if (row.kind === 'yesno') {
    return (
      <select className="ds-input" value={String(Boolean(vessel[field]))} onChange={(e) => onChange(field, e.target.value, 'yesno')}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (row.kind === 'number') {
    return (
      <input
        className="ds-input"
        type="number"
        step={row.step ?? 1}
        value={current}
        onChange={(e) => onChange(field, e.target.value, 'number')}
      />
    );
  }
  return (
    <input className="ds-input" value={current} onChange={(e) => onChange(field, e.target.value, 'text')} />
  );
}

function display(vessel: Vessel, row: Row, draft: Record<string, string>): string {
  if (!row.field) return '';
  const raw = draft[row.field] ?? String(vessel[row.field] ?? '');
  if (row.field === 'orientation') return raw === 'H' ? 'Horizontal' : 'Vertical';
  if (row.field === 'headTop' || row.field === 'headBot') return headLabel(raw as HeadKind);
  if (row.field === 'pwhtRequired') return vessel.pwhtRequired ? 'Yes' : 'No';
  if (row.field === 'vacuum') return vessel.vacuum ? 'Yes' : 'No';
  if (row.field === 'h2s') return vessel.h2s ? 'Yes' : 'No';
  if (row.field === 'rtPolicy') return raw === 'Full' ? 'Full RT' : 'Spot RT';
  if (row.field === 'asmeClass') return `CL${raw}`;
  return raw || '—';
}

/* ── nozzle component schedule ── */

type NozParts = { flange: string; pipe: string; length: number; pad: string; gasket: string; bolts: string };

/** ASME B16.5 stud count by class and NPS. */
const STUD_COUNT: Record<number, Record<string, number>> = {
  150: { '1': 4, '1.5': 4, '2': 4, '3': 4, '4': 8, '6': 8, '8': 8, '10': 12, '12': 12, '14': 12, '16': 16, '18': 16, '20': 20, '24': 20 },
  300: { '1': 4, '1.5': 4, '2': 8, '3': 8, '4': 8, '6': 12, '8': 12, '10': 16, '12': 16, '14': 20, '16': 20, '18': 24, '20': 24, '24': 24 },
  600: { '1': 4, '1.5': 4, '2': 8, '3': 8, '4': 8, '6': 12, '8': 12, '10': 16, '12': 20, '14': 20, '16': 20, '18': 20, '20': 24, '24': 24 },
};

/** Metric stud diameter used for the B16.5 inch series. */
const STUD_DIA: Record<number, Record<string, string>> = {
  150: { '1': 'M14', '1.5': 'M14', '2': 'M16', '3': 'M16', '4': 'M16', '6': 'M20', '8': 'M20', '10': 'M24', '12': 'M24', '14': 'M27', '16': 'M27', '18': 'M30', '20': 'M30', '24': 'M33' },
  300: { '1': 'M14', '1.5': 'M20', '2': 'M16', '3': 'M20', '4': 'M20', '6': 'M20', '8': 'M24', '10': 'M27', '12': 'M30', '14': 'M30', '16': 'M33', '18': 'M33', '20': 'M33', '24': 'M36' },
  600: { '1': 'M14', '1.5': 'M20', '2': 'M16', '3': 'M20', '4': 'M27', '6': 'M27', '8': 'M30', '10': 'M33', '12': 'M33', '14': 'M36', '16': 'M39', '18': 'M42', '20': 'M42', '24': 'M48' },
};

const STUD_LEN: Record<string, number> = {
  '1': 90, '1.5': 90, '2': 90, '3': 110, '4': 110, '6': 130, '8': 130,
  '10': 160, '12': 160, '14': 180, '16': 180, '18': 210, '20': 210, '24': 240,
};

const npsText = (n: number) => `${n}″`;

/** Nearest tabulated size at or below the nozzle size. */
function fitKey<T>(map: Record<string, T>, nps: number): string {
  if (map[String(nps)] !== undefined) return String(nps);
  const sizes = Object.keys(map).map(Number).sort((a, b) => a - b);
  const pick = [...sizes].reverse().find((s) => s <= nps) ?? sizes[0];
  return String(pick);
}

function pipeSchedule(nps: number, cls: number): string {
  if (nps <= 2) return 'Sch 80';
  if (nps <= 4) return cls >= 600 ? 'Sch 80' : 'Sch 40';
  if (nps <= 12) return cls >= 600 ? 'Sch 80' : 'STD';
  return 'STD';
}

function studCount(cls: number, nps: number): number {
  const t = STUD_COUNT[cls] ?? STUD_COUNT[300];
  return t[fitKey(t, nps)];
}

function studDia(cls: number, nps: number): string {
  const t = STUD_DIA[cls] ?? STUD_DIA[300];
  return t[fitKey(t, nps)];
}

function studLen(nps: number): number {
  return STUD_LEN[fitKey(STUD_LEN, nps)];
}

/** One row of the nozzle schedule: every pressure-containing component, by type, size and material. */
function nozzleParts(v: Vessel, c: VesselCalc, n: NozzleSpec): NozParts {
  const cls = n.cls ?? v.asmeClass;
  const lined = String(v.liner ?? '').includes('316L');
  const blind = /manway|flanged head|body flange|handhole/i.test(n.service);
  const flangeType = blind ? 'BLRF' : n.nps <= 1.5 ? 'SW RF' : 'WNRF';

  const flange = `${flangeType} · ${npsText(n.nps)} CL${cls} · ${lined ? 'SA-105N + 316L face' : 'SA-105N'}`;

  const neckWall = c.thk.reinf.find((x) => x.mark === n.mark)?.wall;
  const pipe = n.nps >= 20
    ? `${npsText(n.nps)} plate · ${(neckWall ?? c.thk.tShell).toFixed(1)} mm · SA-516 Gr.70`
    : n.nps >= 18
      ? `${npsText(n.nps)} · ${(neckWall ?? 16).toFixed(1)} mm wall · ${lined ? 'SA-106 Gr.B + 316L lining' : 'SA-106 Gr.B'}`
      : `${npsText(n.nps)} · ${pipeSchedule(n.nps, cls)} · ${lined ? 'SA-106 Gr.B + 316L lining' : 'SA-106 Gr.B'}`;

  const rf = c.thk.reinf.find((x) => x.mark === n.mark);
  const pad = rf && rf.padArea > 0
    ? `Ø${Math.round(rf.od + 2 * rf.padWidth)} × ${rf.padThk} thk · ${lined ? 'SA-240 316L' : 'SA-516 Gr.70'}`
    : '— self-reinforced';

  const gasket = `SW ${blind ? 6 : 4.5} mm · ${npsText(n.nps)} CL${cls} · 316L/graphite`;
  const bolts = `${studCount(cls, n.nps)} × ${studDia(cls, n.nps)} × ${studLen(n.nps)} · A193 B7 / A194 2H`;
  const length = n.nps <= 4 ? 150 : n.nps <= 8 ? 200 : n.nps <= 16 ? 250 : 300;

  return { flange, pipe, length, pad, gasket, bolts };
}

function thick(c: VesselCalc, key: string): string {
  const r = c.thk.rows.find((x) => x.key === key);
  return r ? `${r.tReq.toFixed(1)} → ${r.tSel}` : '—';
}

function has(v: Vessel, s: string) {
  return v.notes.join(' ').toLowerCase().includes(s);
}

function lugsFor(c: VesselCalc): string {
  const t = c.weight.total;
  const qty = t > 40000 ? 4 : 2;
  const swl = Math.max(2, Math.ceil(t / 1000 / qty));
  const boltSize = t > 40000 ? 'M24 × 100' : 'M20 × 80';
  const spareQty = Math.max(1, Math.ceil(qty / 4));
  return `${qty} off trunnions · SWL ${swl} t each · pad ${qty} off · bolt ${boltSize} · spare ${spareQty} off`;
}

function saddleW(v: Vessel): number {
  const R = (v.di + 2 * v.ca) / 2;
  return Math.max(v.orientation === 'H' ? 300 : 450, Math.round((R * (v.orientation === 'H' ? 0.7 : 0.85)) / 10) * 10);
}

function saddleH(v: Vessel): number {
  const R = (v.di + 2 * v.ca) / 2;
  return Math.max(400, Math.round((R * 0.45) / 50) * 50);
}

/* ── internals, vortex breaker and boot component data ── */

const NPS_OD: [number, number][] = [
  [114.3, 4], [168.3, 6], [219.1, 8], [273, 10], [323.9, 12],
  [355.6, 14], [406.4, 16], [457, 18], [508, 20], [610, 24],
];

function npsFromOd(od: number): number {
  let nps = 24, diff = Infinity;
  for (const [o, n] of NPS_OD) {
    const d = Math.abs(o - od);
    if (d < diff) { diff = d; nps = n; }
  }
  return nps;
}

function selThk(c: VesselCalc, key: string): number | undefined {
  return c.thk.rows.find((r) => r.key === key)?.tSel;
}

const vortexApplies = (v: Vessel) => has(v, 'vortex') || ['Drum', 'Separator', 'Receiver'].includes(v.kind);

function vortexDims(v: Vessel, c: VesselCalc) {
  if (!vortexApplies(v)) return null;
  const pool = v.nozzles.filter((n) => n.nps < 18);
  if (!pool.length) return null;
  const primary = pool.filter((n) => /bottom outlet|liquid outlet/i.test(n.service));
  const anyOutlet = pool.filter((n) => /outlet/i.test(n.service));
  const n = [...(primary.length ? primary : anyOutlet.length ? anyOutlet : pool)].sort((a, b) => b.nps - a.nps)[0];
  const od = c.thk.reinf.find((x) => x.mark === n.mark)?.od ?? n.nps * 25.4;
  const breakerOd = Math.round(Math.max(od * 2, od + 100) / 10) * 10;
  const vaneH = Math.max(100, Math.round((od * 0.8) / 10) * 10);
  const vaneL = Math.max(40, Math.round((breakerOd - od) / 2));
  return { nozzle: n, od, breakerOd, vaneH, vaneL };
}

function ringRows(v: Vessel, c: VesselCalc): string[][] {
  const rows: string[][] = [];
  const mat = 'SA-516 Gr.70';
  if (v.trays) {
    rows.push(['Tray support ring', `${v.trays} off`, `Ø${v.di} ID`, '50 × 8 flat', mat,
      'Continuous 6 mm fillet to shell · level ±3 mm at each tray']);
  }
  if (v.packing || v.bedDepth) {
    rows.push(['Packing bed support ring', '1 off', `Ø${v.di} ID`, '75 × 10 flat', mat,
      'Continuous 6 mm fillet to shell · support grid on top']);
    rows.push(['Bed limiter ring', '1 off', `Ø${v.di} ID`, '50 × 8 flat', 'SA-240 Type 304',
      'Direct weld to shell, 6 mm fillet']);
  }
  if (has(v, 'mist eliminator')) {
    rows.push(['Demister support ring', '1 off', `Ø${v.di} ID`, '50 × 8 flat', mat,
      'Continuous 6 mm fillet to shell · drilled for element fixings']);
  }
  if (c.thk.external.ringsRequired) {
    rows.push(['Vacuum stiffener ring', `${c.thk.external.ringsRequired} off`, `Ø${v.di}`, `${c.thk.tShell} × 100 plate`, mat,
      'Intermittent 6 mm fillet, 100 mm pitch · 12 mm clear of seams']);
  }
  if (!rows.length) {
    rows.push(['Distributor support ring', '1 off', `Ø${v.di} ID`, '50 × 8 flat', 'SA-240 Type 316L',
      'Direct weld to shell, 6 mm fillet']);
  }
  return rows;
}

function vortexRows(v: Vessel, c: VesselCalc): string[][] {
  const d = vortexDims(v, c);
  if (!d) return [['Vortex breaker', '0', '—', '—', '—', 'Not required for this service']];
  return [
    ['Radial vanes', '4 off', `${d.vaneL} long × ${d.vaneH} high`, '10 mm', 'SA-516 Gr.70', 'Full fillet to top plate and outlet collar'],
    ['Top cover plate', '1 off', `Ø${d.breakerOd}`, '10 mm', 'SA-516 Gr.70', '6 mm fillet all round, underside flush'],
    ['Outlet collar ring', '1 off', `Ø${d.od} × 25 high`, '10 mm', 'SA-516 Gr.70', 'Continuous 8 mm fillet to bottom head — permanent weld'],
    ['Tie bars', '4 off', `Ø12 × ${d.vaneL}`, '—', 'SA-36', 'Welded between adjacent vanes, 6 mm fillet'],
  ];
}

function bootRows(v: Vessel, c: VesselCalc): string[][] {
  const d = v.dropLeg;
  if (!d) return [['Boot', '0', '—', '—', '—', 'Not required for this service']];
  const t = selThk(c, 'dropleg') ?? Math.max(8, Math.round(c.thk.tShell * 0.65));
  const nps = npsFromOd(d.od);
  const cls = v.asmeClass;
  const ca = v.caLeg ?? v.ca;
  const head = v.headBot === 'FLAT' ? 'flat plate' : '2:1 SE';
  const studs = studCount(cls, nps);
  return [
    ['Boot shell', '1 off', `Ø${d.od} OD × ${fmt(d.tt)} T/T`, `${t} mm`, 'SA-516 Gr.70',
      `Full-pen butt to main shell · CA ${ca} mm`],
    ['Bottom head', '1 off', `Ø${d.od} · ${head}`, `${t} mm`, 'SA-516 Gr.70', 'Butt weld, 100% RT with shell seams'],
    ['Bottom flange', '1 off', `BLRF ${npsText(nps)} CL${cls}`, '—', 'SA-105N', 'RF face, welded to boot shell'],
    ['Blind cover', '1 off', `${npsText(nps)} CL${cls} · drilled`, '—', 'SA-516 Gr.70', 'B16.5 bolt circle, lifting lug'],
    ['Gasket', '1 off', `${npsText(nps)} CL${cls}`, '6 mm', '316L/graphite', 'Spiral wound, centring ring'],
    ['Fasteners', `${studs} sets`, `${studs} × ${studDia(cls, nps)} × ${studLen(nps)}`, '—', 'A193 B7 / A194 2H', 'Per joint, plus 10% spares'],
  ];
}

/* ── component summary matrix (shop component list) ── */

const headShort = (h: HeadKind) => (h === 'FLAT' ? 'flat' : h === 'CONE' ? 'conical' : '2:1 SE');

const skirtHeight = (v: Vessel) =>
  v.support === 'Skirt' ? Math.max(1600, Math.min(4000, v.tt * 0.12)) : v.support === 'Legs' ? 1200 : 0;

const nozzleQtyOf = (c: VesselCalc) => c.vessel.nozzles.filter((n) => n.nps < 18).reduce((a, n) => a + n.qty, 0);
const manwayQtyOf = (c: VesselCalc) => c.vessel.nozzles.filter((n) => n.nps >= 18).reduce((a, n) => a + n.qty, 0);

const COMPONENTS: { label: string; cell: (v: Vessel, c: VesselCalc) => string }[] = [
  {
    label: 'Shell',
    cell: (v, c) =>
      `${c.shell.courses.length + (c.shellTop?.courses.length ?? 0)} crs · ${c.thk.tShell}${v.diTop ? `/${c.thk.tShellTop}` : ''} mm`,
  },
  { label: 'Heads', cell: (v, c) => `2 · ${headShort(v.headTop)} / ${headShort(v.headBot)} ${c.thk.tHeadTop}/${c.thk.tHeadBot} mm` },
  { label: 'Nozzles', cell: (v, c) => `${nozzleQtyOf(c)} off · CL${v.asmeClass}` },
  { label: 'Manways', cell: (_v, c) => (manwayQtyOf(c) ? `${manwayQtyOf(c)} off` : '—') },
  {
    label: 'External support',
    cell: (v) =>
      v.support === 'Skirt'
        ? `Skirt ${fmt(skirtHeight(v) / 1000, 1)} m`
        : v.support === 'Saddles'
          ? '2 saddles'
          : '4 legs · 1.2 m',
  },
  {
    label: 'Internal support',
    cell: (v) =>
      v.trays
        ? 'Ring beams + clips'
        : v.packing || v.bedDepth
          ? 'Bed support + limiter'
          : v.kind === 'Separator' || v.kind === 'Drum'
            ? 'Baffle supports'
            : 'Distributor support',
  },
  {
    label: 'Tray / demister support rings',
    cell: (v, c) => {
      const n = (v.trays ?? 0) + (v.packing || v.bedDepth ? 2 : 0) + (has(v, 'mist eliminator') ? 1 : 0) + (c.thk.external.ringsRequired ?? 0);
      return n ? `${n} off · welded to shell` : '—';
    },
  },
  {
    label: 'Skirt',
    cell: (v, c) =>
      v.support === 'Skirt'
        ? `Ø${v.di} · ${skirtHeight(v)} mm · ${nextGauge(Math.max(8, c.thk.tShell * 0.6), 8)} mm`
        : '—',
  },
  { label: 'Ladders', cell: (v) => (v.orientation === 'V' && v.tt > 2500 ? `${fmt(v.tt / 1000, 1)} m caged` : '—') },
  { label: 'Platforms', cell: (v) => (v.orientation === 'V' && v.tt > 6000 ? `${Math.ceil(v.tt / 6000)} off` : '—') },
  {
    label: 'Tray assembly',
    cell: (v) =>
      v.trays
        ? `${v.trays} trays`
        : v.bedDepth
          ? `${Math.max(1, Math.round(v.bedDepth / 5000))} beds`
          : v.packing
            ? 'Packed beds'
            : '—',
  },
  {
    label: 'Internal rungs',
    cell: (_v, c) =>
      c.vessel.trays
        ? `${c.vessel.trays} rings`
        : c.thk.external.ringsRequired
          ? `${c.thk.external.ringsRequired} stiffeners`
          : '—',
  },
  { label: 'Baffles', cell: (v) => (has(v, 'baffle') || v.kind === 'Drum' || v.kind === 'Separator' ? '1 off' : '—') },
  { label: 'Demisters', cell: (v) => (has(v, 'mist eliminator') ? '1 off' : '—') },
  { label: 'Coalescers', cell: (v) => (has(v, 'coalescer') ? '1 off' : '—') },
  { label: 'Vortex breaker', cell: (v) => (vortexApplies(v) ? '1 off' : '—') },
  {
    label: 'Base ring',
    cell: (v) => (v.support === 'Skirt' ? `Ø${v.di} · 40 mm` : v.support === 'Legs' ? '4 × 200 × 200' : '—'),
  },
  {
    label: 'Boot shell',
    cell: (v, c) => (v.dropLeg ? `Ø${v.dropLeg.od} × ${fmt(v.dropLeg.tt)} T/T · ${selThk(c, 'dropleg') ?? '—'} mm` : '—'),
  },
  {
    label: 'Fireproofing',
    cell: (v) =>
      v.support === 'Skirt' ? 'Skirt + base ring' : v.support === 'Saddles' ? 'Saddles · by others' : 'Legs · by others',
  },
  {
    label: 'Foundation template',
    cell: (v) => (v.support === 'Skirt' ? `Ø${v.di} · 1 off` : v.support === 'Legs' ? '4 × 300 × 300' : '—'),
  },
  { label: 'Insulation ring', cell: (v) => (v.orientation === 'V' ? '1 off · 50 × 6' : '—') },
  {
    label: 'Lifting trunnion',
    cell: (_v, c) => {
      const q = c.weight.total > 40000 ? 4 : 2;
      return `${q} off · SWL ${Math.max(2, Math.ceil(c.weight.total / 1000 / q))} t`;
    },
  },
  {
    label: 'Stiffener ring',
    cell: (_v, c) => (c.thk.external.ringsRequired ? `${c.thk.external.ringsRequired} off` : '—'),
  },
  { label: 'Tail lug', cell: (v) => (v.support === 'Skirt' ? '1 off · 20 mm' : '—') },
  { label: 'Transportation saddle', cell: (v) => (v.orientation === 'V' ? '2 off' : '—') },
];
