// Vessel register transcribed from the three UOP Project Specification 301 packets
// supplied with the inquiry:
//   9135752-301  Fixed-Bed Platforming Process Unit   (rev 0, 04-SEP-26)
//   9135751-301  Naphtha Hydrotreating Process Unit   (rev 0, 21-AUG-26)
//   9135753-301  Par-Isom Process Unit                (rev 0, 04-SEP-26)
//
// Values marked "MR" in the source (manufacturer's responsibility) are modelled
// with preliminary-engineering assumptions that are visible in the calculation
// sheets, never silently.

export type NozzleSpec = { mark: string; nps: number; qty: number; service: string; cls?: number };
export type SupportKind = 'Skirt' | 'Legs' | 'Saddles';
export type HeadKind = 'SE' | 'FLAT' | 'CONE';
export type Orientation = 'V' | 'H';

export interface Vessel {
  id: string;
  /** Axis of the equipment. Drums and receivers in horizontal service sit on two saddles. */
  orientation: Orientation;
  /** Two identical parallel units supplied as a pair (A/B) — each is costed as its own equipment. */
  parallel?: boolean;
  unit: 'Platforming' | 'NHT' | 'Par-Isom';
  spec: string;
  service: string;
  kind: 'Column' | 'Drum' | 'Receiver' | 'Treater' | 'Separator';
  di: number;              // mm, inside diameter of governing (lower) shell
  diTop?: number;          // mm, inside diameter of upper shell for 2-diameter columns
  tt: number;              // mm, tangent-to-tangent
  p: number;               // kg/cm2(g) internal design pressure
  vacuum: boolean;
  designTempC: number;
  mdmtC: number;
  ca: number;              // mm corrosion allowance
  caLeg?: number;          // mm corrosion allowance of drop leg
  headTop: HeadKind;
  headBot: HeadKind;
  asmeClass: number;
  rtPolicy: 'Full' | 'Spot';
  pwhtRequired: boolean;
  pwhtNote?: string;
  trays?: number;
  trayType?: string;
  packing?: string;
  bedDepth?: number;
  support: SupportKind;
  nll?: number;
  sg?: number;
  dropLeg?: { od: number; tt: number };
  liner?: string;
  h2s: boolean;
  notes: string[];
  nozzles: NozzleSpec[];
}const n = (mark: string, nps: number, service: string, qty = 1, cls?: number): NozzleSpec => ({ mark, nps, service, qty, cls });

/** Default permanent support when an item is flipped between vertical and horizontal. */
export function supportFor(v: Vessel, o: Orientation): SupportKind {
  if (o === 'H') return 'Saddles';
  if (v.kind === 'Column') return 'Skirt';
  if (v.dropLeg) return 'Legs';
  return v.tt > 4500 ? 'Skirt' : 'Legs';
}

/** Returns the vessel with an explicit orientation and a support consistent with it. */
export function withOrientation(v: Vessel, o: Orientation): Vessel {
  if (v.orientation === o) return v;
  return { ...v, orientation: o, support: supportFor(v, o) };
}

export const VESSELS: Vessel[] = [
  // ───────────────────────── Platforming (9135752) ─────────────────────────
  {
    id: '12-C01', orientation: 'V', unit: 'Platforming', spec: '9135752-301', service: 'Debutanizer', kind: 'Column',
    di: 1700, diTop: 1100, tt: 26900, p: 13.5, vacuum: true, designTempC: 265, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Spot', pwhtRequired: false,
    trays: 35, trayType: 'Valve tray, 1-pass (1-18) / 2-pass (19-35)',
    support: 'Skirt', nll: 1215, sg: 0.585, h2s: false,
    notes: ['Two shell diameters 1100 / 1700 mm with conical transition', 'Max allowable ΔP 0.369 kg/cm²', 'Nozzles must not be located in downcomers'],
    nozzles: [
      n('G01', 8, 'Ventilation'), n('I01', 3, 'Reflux inlet'), n('M01', 18, 'ID manway'),
      n('O01', 8, 'Vapor outlet'), n('V01', 2, 'Vent'), n('M02', 18, 'ID manway'),
      n('T03', 2, 'TI-TIC', 2), n('I04', 8, 'Feed inlet'), n('M04', 24, 'ID manway'),
      n('M05', 24, 'ID manway'), n('T05', 2, 'TI'), n('I06', 14, 'Reboiler return'),
      n('L06', 2, 'Level', 3), n('M06', 24, 'ID manway'), n('S06', 2, 'Steamout'),
      n('W06', 2, 'PG-PT', 2), n('O07', 10, 'Bottom outlet'),
    ],
  },
  {
    id: '12-C02', orientation: 'V', unit: 'Platforming', spec: '9135752-301', service: 'Deethanizer', kind: 'Column',
    di: 1200, tt: 23100, p: 34, vacuum: true, designTempC: 145, mdmtC: -29,
    ca: 3, headTop: 'FLAT', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    packing: 'IMTP 25 random packing, 3 beds', bedDepth: 15000,
    support: 'Skirt', nll: 330, sg: 0.377, h2s: false,
    notes: ['Top head flanged flat with NPS 24 removable cover', 'NPS 18 / 24 body flanges for packing loading', 'Max allowable ΔP 0.218 kg/cm²'],
    nozzles: [
      n('F01', 24, 'Body flange / head'), n('I01', 4, 'Reflux inlet'), n('M01', 24, 'Flanged head'),
      n('O01', 3, 'Vapor outlet'), n('V01', 2, 'Vent'), n('F03', 18, 'Body flange'),
      n('F04', 24, 'Body flange'), n('I04', 6, 'Inlet'), n('T04', 2, 'TI'), n('F06', 24, 'Body flange'),
      n('C08', 2, 'PG-PT', 2), n('D08', 2, 'Drain', 2), n('L08', 2, 'Level', 2),
      n('M08', 24, 'ID manway'), n('R08', 18, 'Reboiler'), n('S08', 2, 'Steamout'),
      n('T08', 2, 'TI'), n('O09', 2, 'Bottom outlet'),
    ],
  },
  {
    id: '12-D01', orientation: 'H', unit: 'Platforming', spec: '9135752-301', service: 'Separator', kind: 'Separator',
    di: 2600, tt: 4300, p: 18, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', nll: 1140, sg: 0.752, h2s: false,
    notes: ['3 mm Alloy 400 mist eliminator (by others), support per DWG 3-264', 'Hydrogen service — full radiography of main seams'],
    nozzles: [
      n('G01', 4, 'Ventilation'), n('O01', 18, 'Vapor outlet'), n('V01', 2, 'Vent'),
      n('B02', 24, 'ID manway'), n('J02', 20, 'Inlet'), n('L02', 2, 'Level', 2),
      n('LH02', 2, 'Shutdown LT high', 2), n('P02', 2, 'PT-PG', 2), n('U02', 2, 'Relief', 2),
      n('W03', 8, 'Liquid outlet'),
    ],
  },
  {
    id: '12-D02', orientation: 'H', unit: 'Platforming', spec: '9135752-301', service: 'Net Gas Compressor Suction Drum', kind: 'Drum',
    di: 1700, tt: 5600, p: 22, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', nll: 1430, sg: 0.744, h2s: false,
    notes: ['Mist eliminator by others, Alloy 400', 'Hydrogen service'],
    nozzles: [
      n('G01', 6, 'Ventilation'), n('O01', 8, 'Vapor outlet'), n('V01', 2, 'Vent'),
      n('B02', 24, 'ID manway'), n('J02', 10, 'Inlet'), n('L02', 2, 'Level', 3),
      n('LH02', 2, 'Shutdown LT high', 2), n('P02', 2, 'PG-PT', 2), n('U02', 2, 'Relief', 2),
      n('W03', 6, 'Liquid outlet'),
    ],
  },
  {
    id: '12-D03', orientation: 'H', unit: 'Platforming', spec: '9135752-301', service: 'Recontact Drum', kind: 'Drum',
    di: 1700, tt: 5600, p: 51.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 600, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', nll: 1430, sg: 0.735, h2s: false,
    notes: ['CL600 nozzle flanges', 'Hydrogen service'],
    nozzles: [
      n('G01', 6, 'Ventilation'), n('O01', 6, 'Vapor outlet'), n('V01', 2, 'Vent'),
      n('B02', 24, 'ID manway'), n('J02', 8, 'Inlet'), n('L02', 2, 'Level', 3),
      n('LH02', 2, 'Shutdown LT high', 2), n('P02', 2, 'PG-PT', 2), n('U02', 2, 'Relief', 2),
      n('W03', 6, 'Liquid outlet'),
    ],
  },
  {
    id: '12-D04', orientation: 'V', parallel: true, unit: 'Platforming', spec: '9135752-301', service: 'Net Gas Chloride Treaters (A/B)', kind: 'Treater',
    di: 1200, tt: 7600, p: 51.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 600, rtPolicy: 'Full', pwhtRequired: false,
    bedDepth: 6300, support: 'Skirt', h2s: false,
    notes: ['2 vessels (A/B)', 'Activated alumina bed with inert ball grading', 'Support screen DWG 3-331'],
    nozzles: [
      n('I01', 6, 'Inlet'), n('M01', 24, 'ID manway'), n('V01', 2, 'Vent'),
      n('B02', 24, 'ID manway'), n('W03', 6, 'Outlet'),
    ],
  },
  {
    id: '12-D05', orientation: 'H', unit: 'Platforming', spec: '9135752-301', service: 'Debutanizer Receiver', kind: 'Receiver',
    di: 1400, tt: 4100, p: 14, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, caLeg: 6, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Spot', pwhtRequired: false,
    support: 'Saddles', nll: 0, sg: 0.514, h2s: false,
    dropLeg: { od: 457, tt: 1430 },
    notes: ['Drop leg 18" OD × 1430 mm T/T, CA 6 mm', 'Winterizing: insulate + heat trace drop leg and head', 'Distributor type C per DWG 3-183'],
    nozzles: [
      n('A01', 2, 'PG'), n('I01', 8, 'Inlet'), n('M01', 24, 'ID manway'), n('S01', 2, 'Steamout'),
      n('B02', 4, 'Ventilation'), n('K02', 2, 'Level', 2), n('L02', 2, 'Level', 2),
      n('N02', 6, 'HCBN outlet'), n('O02', 3, 'Vapor outlet'), n('V02', 2, 'Vent'),
      n('W02', 2, 'Water outlet'),
    ],
  },
  {
    id: '12-D06', orientation: 'V', parallel: true, unit: 'Platforming', spec: '9135752-301', service: 'Debutanizer Fuel Gas Chloride Treaters (A/B)', kind: 'Treater',
    di: 600, tt: 3000, p: 14, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'FLAT', headBot: 'SE', asmeClass: 300, rtPolicy: 'Spot', pwhtRequired: false,
    bedDepth: 1800, support: 'Legs', h2s: false,
    notes: ['NPS 24 fabricated from pipe', 'Removable flanged head', '2 vessels (A/B)'],
    nozzles: [
      n('I01', 3, 'Inlet'), n('M01', 24, 'Flanged head'), n('V01', 2, 'Vent'),
      n('B02', 8, 'Handhole'), n('W03', 3, 'Outlet'), n('Z03', 8, 'Screen'),
    ],
  },
  {
    id: '12-D07', orientation: 'V', parallel: true, unit: 'Platforming', spec: '9135752-301', service: 'LPG Chloride Treaters (A/B)', kind: 'Treater',
    di: 600, tt: 3800, p: 42.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'FLAT', headBot: 'SE', asmeClass: 300, rtPolicy: 'Spot', pwhtRequired: false,
    bedDepth: 2300, support: 'Legs', h2s: false,
    notes: ['2" distributor, 29 × 6 mm holes', 'Screen Alloy 400', '2 vessels (A/B)'],
    nozzles: [
      n('M01', 24, 'Flanged head'), n('V01', 2, 'Vent'), n('B02', 8, 'Handhole'),
      n('C02', 2, 'Relief'), n('J02', 3, 'Inlet'), n('W03', 2, 'Outlet'), n('Z03', 8, 'Screen'),
    ],
  },
  {
    id: '12-D08', orientation: 'H', unit: 'Platforming', spec: '9135752-301', service: 'Deethanizer Receiver', kind: 'Receiver',
    di: 1000, tt: 3200, p: 34.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, caLeg: 6, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Spot', pwhtRequired: false,
    support: 'Saddles', sg: 0.791, h2s: false,
    dropLeg: { od: 355.6, tt: 1170 },
    notes: ['Drop leg 14" OD × 1170 mm T/T, CA 6 mm', 'Winterizing of drop leg'],
    nozzles: [
      n('A01', 2, 'PG-PT', 2), n('I01', 4, 'Inlet'), n('M01', 18, 'ID manway'), n('S01', 2, 'Steamout'),
      n('B02', 4, 'Ventilation'), n('K02', 2, 'Level', 2), n('L02', 2, 'Level', 2),
      n('N02', 3, 'HCBN outlet'), n('O02', 2, 'Vapor outlet'), n('V02', 2, 'Vent'), n('W02', 2, 'Water outlet'),
    ],
  },
  {
    id: '12-D10', orientation: 'H', unit: 'Platforming', spec: '9135752-301', service: 'Steam Disengaging Drum', kind: 'Drum',
    di: 1600, tt: 5400, p: 49.5, vacuum: true, designTempC: 285, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 600, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', h2s: false,
    notes: ['Horizontal drum on two saddles — one sliding, one fixed with slotted base plate', 'Designed to ASME Section I per sheet note', '10 mm min baffles with stiffeners', '12" XS short-radius elbow on X01'],
    nozzles: [
      n('B01', 6, 'Ventilation'), n('I01', 12, 'Inlet'), n('K01', 2, 'Level', 2),
      n('L01', 2, 'Level', 2), n('M01', 24, 'ID manway'), n('P01', 2, 'Relief', 1),
      n('U01', 2, 'Relief', 1), n('V01', 2, 'Vent'), n('X01', 1.5, 'Continuous blowdown'),
      n('Y01', 1.5, 'Intermittent blowdown'), n('M02', 24, 'ID manway'), n('N02', 12, 'Water outlet'),
      n('O02', 8, 'Vapor outlet'), n('Y02', 1.5, 'Intermittent blowdown'), n('Z02', 1, 'Chemical feed'),
    ],
  },

  // ─────────────────────── Naphtha Hydrotreating (9135751) ───────────────────────
  {
    id: '10-C01', orientation: 'V', unit: 'NHT', spec: '9135751-301', service: 'Stripper', kind: 'Column',
    di: 2500, diTop: 1200, tt: 26000, p: 13, vacuum: false, designTempC: 240, mdmtC: -29,
    ca: 6, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: true,
    pwhtNote: 'Wet H2S service — PWHT YES per spec sheet 9135751-301; hardness ≤ 200 HB',
    trays: 31, trayType: 'Valve tray Type 410, 1-pass (1-10) / 2-pass (11-31)',
    support: 'Skirt', nll: 1735, sg: 0.523, h2s: true,
    notes: ['Two shell diameters 1200 / 2500 mm', 'Max allowable ΔP 0.262 kg/cm²', 'Trays 5-10 designed for 500 kg/m² uplift'],
    nozzles: [
      n('G01', 8, 'Ventilation'), n('I01', 3, 'Reflux inlet'), n('M01', 24, 'ID manway'),
      n('O01', 6, 'Outlet'), n('V01', 2, 'Vent'), n('M02', 24, 'ID manway'),
      n('I03', 8, 'Feed inlet'), n('M03', 24, 'ID manway'), n('M04', 24, 'ID manway'),
      n('T05', 2, 'TI'), n('I06', 20, 'Reboiler return'), n('L06', 2, 'Level', 3),
      n('M06', 24, 'ID manway'), n('S06', 2, 'Steamout'), n('W06', 2, 'PG-PT', 2), n('O07', 16, 'Bottom outlet'),
    ],
  },
  {
    id: '10-C02', orientation: 'V', unit: 'NHT', spec: '9135751-301', service: 'Naphtha Splitter', kind: 'Column',
    di: 2700, tt: 46800, p: 3.5, vacuum: true, designTempC: 200, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    trays: 67, trayType: 'Valve tray, 2-pass, 67 trays @ 600 mm',
    support: 'Skirt', nll: 1430, sg: 0.599, h2s: false,
    notes: ['67 trays, 46800 mm T/T — shop erection in max transportable sections', 'Max allowable ΔP 0.557 kg/cm²'],
    nozzles: [
      n('G01', 8, 'Ventilation'), n('I01', 6, 'Reflux inlet'), n('M01', 24, 'ID manway'),
      n('O01', 20, 'Vapor outlet'), n('V01', 2, 'Vent'), n('M02', 24, 'ID manway'),
      n('T02', 2, 'TI-TIC', 2), n('I03', 10, 'Feed inlet'), n('M03', 24, 'ID manway'),
      n('T04', 2, 'TI'), n('M05', 24, 'ID manway'), n('M06', 24, 'ID manway'), n('T06', 2, 'TI'),
      n('I07', 24, 'Reboiler return'), n('L07', 2, 'Level', 3), n('M07', 24, 'ID manway'),
      n('S07', 2, 'Steamout'), n('W07', 2, 'PG-PT', 2), n('O08', 16, 'Bottom outlet'),
    ],
  },
  {
    id: '10-D01', orientation: 'H', unit: 'NHT', spec: '9135751-301', service: 'Feed Surge Drum', kind: 'Drum',
    di: 3800, tt: 11300, p: 14, vacuum: false, designTempC: 120, mdmtC: -29,
    ca: 3, caLeg: 6, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', sg: 0.699, h2s: false,
    dropLeg: { od: 406.4, tt: 1520 },
    notes: ['Drop leg 16" OD × 1520 mm T/T', 'Designed for blocked-in pump condition', 'Baffle DWG 3-185'],
    nozzles: [
      n('I01', 6, 'Inlet'), n('M01', 24, 'ID manway'), n('S01', 2, 'Steamout'),
      n('U01', 2, 'Relief', 1), n('B02', 8, 'Ventilation'), n('K02', 2, 'Level', 2),
      n('L02', 2, 'Level', 2), n('LL02', 2, 'Shutdown', 2), n('N02', 10, 'HCBN outlet'),
      n('O02', 2, 'Blanketing'), n('V02', 2, 'Vent'), n('W02', 2, 'Water outlet'),
    ],
  },
  {
    id: '10-D02', orientation: 'H', unit: 'NHT', spec: '9135751-301', service: 'Separator', kind: 'Separator',
    di: 2700, tt: 8000, p: 35.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 6, caLeg: 6, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: true,
    pwhtNote: 'Wet H2S + 6 mm CA — PWHT mandatory, hardness survey ≤ 200 HB',
    support: 'Saddles', h2s: true,
    dropLeg: { od: 457, tt: 1870 },
    liner: 'Bottom half lined 3 mm Type 316L; internals 316L; nozzles 316L lined and faced',
    notes: ['Coalescer 300 mm Type 316 (by others), support DWG 3-266', 'Lining is the corrosion allowance in lined portion'],
    nozzles: [
      n('C01', 2, 'PG-PT', 2), n('I01', 12, 'Inlet'), n('M01', 24, 'ID manway'),
      n('U01', 2, 'Relief', 1), n('B02', 8, 'Ventilation'), n('K02', 2, 'Level', 2),
      n('L02', 2, 'Level', 2), n('N02', 8, 'Liquid outlet'), n('O02', 6, 'Vapor outlet'),
      n('V02', 2, 'Vent'), n('W02', 2, 'Water outlet'),
    ],
  },
  {
    id: '10-D03', orientation: 'H', unit: 'NHT', spec: '9135751-301', service: 'Recycle Compressor Suction Drum', kind: 'Drum',
    di: 1100, tt: 2400, p: 35.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 6, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: true,
    pwhtNote: 'H2S service, 6 mm CA — PWHT mandatory',
    support: 'Saddles', h2s: true,
    notes: ['Horizontal suction drum on two saddles, sliding saddle downstream', 'Mist eliminator Type 316 by others', 'Bottom head and lower shell insulated + heat traced'],
    nozzles: [
      n('G01', 4, 'Ventilation'), n('O01', 6, 'Vapor outlet'), n('V01', 2, 'Vent'),
      n('B02', 18, 'ID manway'), n('J02', 6, 'Inlet'), n('L02', 2, 'Level', 2),
      n('LH02', 2, 'Shutdown LT high', 2), n('W03', 2, 'Liquid outlet'),
    ],
  },
  {
    id: '10-D04', orientation: 'V', unit: 'NHT', spec: '9135751-301', service: 'Water Break Tank', kind: 'Receiver',
    di: 600, tt: 1900, p: 12.5, vacuum: false, designTempC: 195, mdmtC: -29,
    ca: 3, headTop: 'FLAT', headBot: 'SE', asmeClass: 150, rtPolicy: 'Spot', pwhtRequired: false,
    support: 'Legs', nll: 555, sg: 0.992, h2s: false,
    notes: ['Insulate + heat trace for winterizing'],
    nozzles: [
      n('M01', 24, 'Flanged head'), n('O01', 2, 'Blanketing'), n('U01', 2, 'Relief', 1),
      n('V01', 2, 'Vent'), n('L02', 2, 'Level', 2), n('S02', 2, 'Steamout'), n('W03', 3, 'Inlet/outlet'),
    ],
  },
  {
    id: '10-D05', orientation: 'H', unit: 'NHT', spec: '9135751-301', service: 'Stripper Receiver', kind: 'Receiver',
    di: 1300, tt: 3700, p: 13.5, vacuum: false, designTempC: 120, mdmtC: -29,
    ca: 6, caLeg: 6, headTop: 'SE', headBot: 'SE', asmeClass: 150, rtPolicy: 'Full', pwhtRequired: true,
    pwhtNote: 'Wet H2S + 6 mm CA — PWHT mandatory',
    support: 'Saddles', h2s: true,
    dropLeg: { od: 355.6, tt: 1270 },
    notes: ['Drop leg 14" OD × 1270 mm T/T', 'Winterizing of drop leg'],
    nozzles: [
      n('C01', 2, 'PG-PT', 2), n('I01', 8, 'Inlet'), n('M01', 24, 'ID manway'),
      n('S01', 2, 'Steamout'), n('B02', 4, 'Ventilation'), n('K02', 2, 'Level', 2),
      n('L02', 2, 'Level', 2), n('N02', 6, 'HCBN outlet'), n('O02', 3, 'Vapor outlet'),
      n('V02', 2, 'Vent'), n('W02', 2, 'Water outlet'),
    ],
  },
  {
    id: '10-D06', orientation: 'H', unit: 'NHT', spec: '9135751-301', service: 'Naphtha Splitter Receiver', kind: 'Receiver',
    di: 2200, tt: 6500, p: 4, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 150, rtPolicy: 'Spot', pwhtRequired: false,
    support: 'Saddles', sg: 0.622, h2s: false,
    notes: ['Horizontal receiver on two saddles with sliding/fixed arrangement', 'Distributor type B DWG 3-183', 'Baffle DWG 3-185'],
    nozzles: [
      n('A01', 2, 'PG'), n('E01', 1.5, 'Equalizing'), n('I01', 8, 'Inlet'), n('J01', 2, 'Noncondensable vent'),
      n('M01', 24, 'ID manway'), n('S01', 2, 'Steamout'), n('U01', 2, 'Relief', 1),
      n('B02', 6, 'Ventilation'), n('D02', 2, 'Drain'), n('L02', 2, 'Level', 2),
      n('N02', 10, 'HCBN outlet'), n('V02', 2, 'Vent'), n('Z02', 8, 'Hot vapor bypass'),
    ],
  },
  {
    id: '10-D07', orientation: 'V', unit: 'NHT', spec: '9135751-301', service: 'Sulfur Guard Bed', kind: 'Treater',
    di: 2000, tt: 5700, p: 17.5, vacuum: true, designTempC: 230, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    bedDepth: 4180, support: 'Skirt', h2s: true,
    notes: ['6" distributor, 67 × 25 mm holes', 'Support screen DWG 3-331, withdrawal pipe DWG 3-335'],
    nozzles: [
      n('M01', 24, 'ID manway'), n('U01', 2, 'Relief', 1), n('V01', 2, 'Vent'),
      n('J02', 6, 'Inlet'), n('E03', 6, 'Inclined withdrawal', 2), n('W03', 6, 'Outlet'),
    ],
  },

  // ───────────────────────────── Par-Isom (9135753) ─────────────────────────────
  {
    id: '11-C01', orientation: 'V', unit: 'Par-Isom', spec: '9135753-301', service: 'Stabilizer', kind: 'Column',
    di: 2300, diTop: 1300, tt: 24900, p: 18.5, vacuum: false, designTempC: 210, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    trays: 30, trayType: 'Valve tray, 1-pass (1-15) / 2-pass (16-30)',
    support: 'Skirt', nll: 1580, sg: 0.455, h2s: false,
    notes: ['Two shell diameters 1300 / 2300 mm', 'Max allowable ΔP 0.211 kg/cm²', 'Trays 10-15 designed for 500 kg/m² uplift'],
    nozzles: [
      n('G01', 8, 'Ventilation'), n('I01', 3, 'Reflux inlet'), n('M01', 24, 'ID manway'),
      n('O01', 6, 'Vapor outlet'), n('V01', 2, 'Vent'), n('M02', 24, 'ID manway'),
      n('I03', 8, 'Feed inlet'), n('M03', 24, 'ID manway'), n('M04', 24, 'ID manway'),
      n('T04', 2, 'TI'), n('I05', 16, 'Reboiler return'), n('L05', 2, 'Level', 3),
      n('M05', 24, 'ID manway'), n('S05', 2, 'Utility'), n('W05', 2, 'PG-PT', 2), n('O06', 14, 'Liquid outlet'),
    ],
  },
  {
    id: '11-C02', orientation: 'V', unit: 'Par-Isom', spec: '9135753-301', service: 'Deisohexanizer', kind: 'Column',
    di: 3400, tt: 51100, p: 4, vacuum: true, designTempC: 170, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 150, rtPolicy: 'Full', pwhtRequired: false,
    trays: 80, trayType: 'Valve tray, 2-pass (65 trays) + accumulator DWG 3-290',
    support: 'Skirt', nll: 760, sg: 0.637, h2s: false,
    notes: ['80 trays, 51100 mm T/T — largest column in scope', 'Max allowable ΔP 0.562 kg/cm²', 'Internals pass through 24" manway'],
    nozzles: [
      n('G01', 8, 'Ventilation'), n('I01', 6, 'Reflux inlet'), n('M01', 24, 'ID manway'),
      n('O01', 24, 'Vapor outlet'), n('V01', 2, 'Vent'), n('T02', 2, 'TI-TIC', 2),
      n('M03', 24, 'ID manway'), n('I04', 8, 'Feed inlet'), n('M04', 24, 'ID manway'),
      n('M05', 24, 'ID manway'), n('M06', 24, 'ID manway'), n('M07', 24, 'ID manway'),
      n('O07', 6, 'Sidedraw'), n('M08', 24, 'ID manway'), n('T08', 2, 'TI'),
      n('I09', 28, 'Reboiler return'), n('L09', 2, 'Level', 2), n('M09', 24, 'ID manway'),
      n('S09', 2, 'Utility'), n('W09', 2, 'PG-PT', 2), n('O10', 18, 'Liquid outlet'),
    ],
  },
  {
    id: '11-D01', orientation: 'H', unit: 'Par-Isom', spec: '9135753-301', service: 'Feed Surge Drum', kind: 'Drum',
    di: 2700, tt: 8700, p: 15.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 150, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', nll: 4380, sg: 0.621, h2s: false,
    notes: ['Horizontal surge drum on two saddles, fixed saddle at the pump-suction end', 'Designed for blocked-in pump condition', 'Baffle DWG 3-115 Type I'],
    nozzles: [
      n('G01', 8, 'Ventilation'), n('O01', 2, 'Blanketing'), n('U01', 2, 'Relief', 1),
      n('V01', 2, 'Vent'), n('B02', 24, 'ID manway'), n('J02', 6, 'Inlet'),
      n('L02', 2, 'Level', 3), n('LL02', 2, 'Shutdown LT low', 2), n('W03', 8, 'Outlet'),
    ],
  },
  {
    id: '11-D02', orientation: 'H', unit: 'Par-Isom', spec: '9135753-301', service: 'Separator', kind: 'Separator',
    di: 1500, tt: 7200, p: 32.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', nll: 1960, sg: 0.63, h2s: false,
    notes: ['Mist eliminator Type 304 by others, support DWG 3-264', 'Hydrogen service'],
    nozzles: [
      n('G01', 6, 'Ventilation'), n('O01', 8, 'Vapor outlet'), n('V01', 2, 'Vent'),
      n('B02', 24, 'ID manway'), n('J02', 10, 'Inlet'), n('L02', 2, 'Level', 3),
      n('P02', 2, 'PT-PG', 2), n('U02', 2, 'Relief', 1), n('W03', 6, 'Liquid outlet'),
    ],
  },
  {
    id: '11-D03', orientation: 'V', unit: 'Par-Isom', spec: '9135753-301', service: 'Recycle Gas Drier', kind: 'Treater',
    di: 2000, tt: 5900, p: 44.5, vacuum: true, designTempC: 345, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    bedDepth: 4600, support: 'Skirt', h2s: false,
    notes: ['Dual design condition: 44.5 kg/cm²(g) normal / 14 kg/cm²(g) regeneration', 'Molecular sieve bed, 30-mesh Type 316 screen', 'Vessel + flanges insulated for heat conservation'],
    nozzles: [
      n('I01', 6, 'Inlet'), n('M01', 24, 'ID manway'), n('V01', 2, 'Vent'),
      n('B02', 24, 'ID manway'), n('W03', 6, 'Outlet'),
    ],
  },
  {
    id: '11-D04', orientation: 'H', unit: 'Par-Isom', spec: '9135753-301', service: 'Stabilizer Receiver', kind: 'Receiver',
    di: 1400, tt: 4000, p: 19, vacuum: false, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Spot', pwhtRequired: false,
    support: 'Saddles', sg: 0.508, h2s: false, nll: 0,
    notes: ['Distributor type C DWG 3-183', 'Vortex breaker raised DWG 3-123'],
    nozzles: [
      n('A01', 2, 'PG'), n('C01', 2, 'PT'), n('I01', 8, 'Inlet'), n('M01', 24, 'ID manway'),
      n('S01', 2, 'Utility'), n('B02', 4, 'Ventilation'), n('D02', 2, 'Drain'),
      n('L02', 2, 'Level', 2), n('N02', 6, 'Liquid outlet'), n('O02', 3, 'Vapor outlet'), n('V02', 2, 'Vent'),
    ],
  },
  {
    id: '11-D05', orientation: 'H', unit: 'Par-Isom', spec: '9135753-301', service: 'Deisohexanizer Receiver', kind: 'Receiver',
    di: 2500, tt: 7000, p: 4.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 150, rtPolicy: 'Spot', pwhtRequired: false,
    support: 'Saddles', sg: 0.599, h2s: false, nll: 0,
    notes: ['Horizontal receiver on two saddles with sliding/fixed arrangement', 'Distributor type C DWG 3-183', 'Baffle DWG 3-185'],
    nozzles: [
      n('C01', 2, 'PG'), n('E01', 3, 'Equalizing'), n('I01', 10, 'Inlet'), n('M01', 24, 'ID manway'),
      n('S01', 2, 'Utility'), n('U01', 2, 'Relief', 1), n('B02', 6, 'Ventilation'),
      n('D02', 2, 'Drain'), n('L02', 2, 'Level', 2), n('N02', 10, 'HCBN outlet'),
      n('O02', 2, 'Noncondensible vent'), n('V02', 2, 'Vent'), n('Z02', 8, 'Hot vapor bypass'),
    ],
  },
  {
    id: '11-D06', orientation: 'H', unit: 'Par-Isom', spec: '9135753-301', service: 'Recycle Gas Knockout Drum', kind: 'Drum',
    di: 1000, tt: 2400, p: 32.5, vacuum: true, designTempC: 120, mdmtC: -29,
    ca: 3, headTop: 'SE', headBot: 'SE', asmeClass: 300, rtPolicy: 'Full', pwhtRequired: false,
    support: 'Saddles', h2s: false,
    notes: ['Horizontal KO drum on two saddles — one sliding, one fixed', 'Mist eliminator Type 304 by others', 'Hydrogen service'],
    nozzles: [
      n('O01', 8, 'Vapor outlet'), n('V01', 2, 'Vent'), n('B02', 18, 'ID manway'),
      n('J02', 8, 'Inlet'), n('L02', 2, 'Level', 2), n('LH02', 2, 'Shutdown LT high', 2),
      n('W03', 2, 'Liquid outlet'),
    ],
  },
];

/* ── classification and A/B expansion ── */

export type EquipClass = 'Column' | 'Vessel';

/** Only two classes are procured: columns and vessels. */
export const equipClass = (v: Vessel): EquipClass => (v.kind === 'Column' ? 'Column' : 'Vessel');

/**
 * Expands the A/B pairs into two separate equipment records so that tonnage, BOQ and material
 * procurement are correct — a pair of treaters is two vessels, not one.
 */
export function expandFleet(list: Vessel[]): Vessel[] {
  const out: Vessel[] = [];
  list.forEach((v) => {
    if (!v.parallel) { out.push(v); return; }
    (['A', 'B'] as const).forEach((suffix) => {
      out.push({
        ...v,
        id: `${v.id}${suffix}`,
        service: `${v.service.replace(/\s*\(A\/B\)/, '')} (${suffix})`,
        parallel: undefined,
        notes: [`Unit ${suffix} of the A/B pair — identical to its twin, fabricated and tested separately`, ...v.notes.filter((n) => !/A\/B|2 vessels/.test(n))],
      });
    });
  });
  return out;
}

export const UNITS = ['Platforming', 'NHT', 'Par-Isom'] as const;

export const vesselById = (id: string): Vessel => VESSELS.find((v) => v.id === id) ?? VESSELS[0];

/** The full procurement list: A/B pairs split into separate equipment records. */
export const EQUIPMENT: Vessel[] = expandFleet(VESSELS);

/* ── issued datasheet (Book3) — exact Excel column sequence ── */

/**
 * Column & Vessel datasheet as issued by the client, reproduced verbatim.
 * Order and wording follow the spreadsheet columns:
 * Sno · Unit · Tag No · Service · Orientation · Design Pressure · Design Temperature ·
 * MOC · Size · Special Service · Shell Thickness · Top head thickness · Bottom Head Thickness.
 * These are reference values; the live design inputs remain the Vessel records above.
 */
export interface DatasheetRow {
  sno: number;
  unit: 'NHT' | 'Par-Isom' | 'Platforming';
  id: string;
  service: string;
  orientation: Orientation;
  /** design pressure exactly as issued, e.g. "13.5 / FV" */
  p: string;
  designTempC: number;
  moc: string;
  size: string;
  specialService: string;
  shellThk: string;
  headTopThk: string;
  headBotThk: string;
}

export const DATASHEET: DatasheetRow[] = [
  // ── columns ──
  { sno: 1, unit: 'NHT', id: '10-C01', service: 'Stripper', orientation: 'V', p: '13', designTempC: 240,
    moc: 'KCS', size: '2500 x 1200 x 26000', specialService: 'Hydrogen and Wet H2S',
    shellThk: 'DIA. 2500 = 22 THK · CONE = 24 THK · DIA. 1200 = 18, 16, 14 THK', headTopThk: '18', headBotThk: '26' },
  { sno: 2, unit: 'NHT', id: '10-C02', service: 'Naphtha Splitter', orientation: 'V', p: '3.5 / FV', designTempC: 200,
    moc: 'KCS', size: '2700 x 46800', specialService: '—',
    shellThk: '20', headTopThk: '22', headBotThk: '24' },
  { sno: 1, unit: 'Par-Isom', id: '11-C01', service: 'Stabilizer', orientation: 'V', p: '18.5', designTempC: 210,
    moc: 'KCS', size: '2300 x 1300 x 24900', specialService: 'Hydrogen',
    shellThk: 'Bottom 24 · Cone 26 · Top 16', headTopThk: '18', headBotThk: '26' },
  { sno: 2, unit: 'Par-Isom', id: '11-C02', service: 'Deisohexanizer', orientation: 'V', p: '4 / FV', designTempC: 170,
    moc: 'KCS', size: '3400 x 51100', specialService: '—',
    shellThk: '16', headTopThk: '18', headBotThk: '18' },
  { sno: 1, unit: 'Platforming', id: '12-C01', service: 'Debutanizer', orientation: 'V', p: '13.5 / FV', designTempC: 265,
    moc: 'KCS', size: '1700 x 1100 x 26900', specialService: '—',
    shellThk: 'Upper 16 · Lower 22 · Cone 25', headTopThk: '18', headBotThk: '24' },
  { sno: 2, unit: 'Platforming', id: '12-C02', service: 'Deethanizer', orientation: 'V', p: '34 / FV', designTempC: 145,
    moc: 'KCS', size: '1200 x 24" x 18" x 23100', specialService: '—',
    shellThk: '18in: 12 · 24in: 16 · 1200 ID: 22 · Cones: 18 / 28', headTopThk: '25', headBotThk: '25' },

  // ── NHT vessels ──
  { sno: 1, unit: 'NHT', id: '10-D01', service: 'Feed Surge Drum', orientation: 'H', p: '14', designTempC: 120,
    moc: 'KCS', size: '3800 x 11300 x 16" Boot', specialService: 'Hydrogen',
    shellThk: 'Shell 32 · Boot 14', headTopThk: 'Boot head 16', headBotThk: '36 / 36' },
  { sno: 2, unit: 'NHT', id: '10-D02', service: 'Separator', orientation: 'H', p: '35.5 / FV', designTempC: 120,
    moc: 'KCS', size: '2700 x 8000', specialService: 'Hydrogen and Wet H2S',
    shellThk: '46', headTopThk: '50', headBotThk: '50' },
  { sno: 3, unit: 'NHT', id: '10-D03', service: 'Recycle Compressor Suction Drum', orientation: 'H', p: '35.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1100 x 2400', specialService: 'Hydrogen and Wet H2S',
    shellThk: '28', headTopThk: '30', headBotThk: '30' },
  { sno: 4, unit: 'NHT', id: '10-D04', service: 'Water Break Tank', orientation: 'V', p: '12.5', designTempC: 195,
    moc: 'KCS', size: '600 x 1900', specialService: '—',
    shellThk: '16', headTopThk: '24" STD blind', headBotThk: '18' },
  { sno: 5, unit: 'NHT', id: '10-D05', service: 'Stripper Receiver', orientation: 'H', p: '13.5', designTempC: 120,
    moc: 'KCS', size: '1300 x 3700', specialService: 'Hydrogen and Wet H2S',
    shellThk: 'Shell 16 · Boot 14', headTopThk: 'Boot head 18', headBotThk: '18 / 18' },
  { sno: 6, unit: 'NHT', id: '10-D06', service: 'Naphtha Splitter Receiver', orientation: 'H', p: '4', designTempC: 120,
    moc: 'KCS', size: '2200 x 6500', specialService: '—',
    shellThk: '18', headTopThk: '20', headBotThk: '20' },
  { sno: 7, unit: 'NHT', id: '10-D07', service: 'Sulfur Guard Bed', orientation: 'V', p: '17.5', designTempC: 230,
    moc: 'KCS', size: '2000 x 5700', specialService: 'Wet H2S',
    shellThk: '24', headTopThk: '26', headBotThk: '26' },

  // ── Par-Isom vessels ──
  { sno: 8, unit: 'Par-Isom', id: '11-D01', service: 'Feed Surge Drum', orientation: 'H', p: '15.5 / FV', designTempC: 120,
    moc: 'KCS', size: '2700 x 8700', specialService: 'Hydrogen',
    shellThk: '24', headTopThk: '26', headBotThk: '26' },
  { sno: 9, unit: 'Par-Isom', id: '11-D02', service: 'Separator', orientation: 'H', p: '32.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1500 x 7200', specialService: 'Hydrogen',
    shellThk: '24', headTopThk: '26', headBotThk: '26' },
  { sno: 10, unit: 'Par-Isom', id: '11-D03', service: 'Recycle Gas Drier', orientation: 'V', p: '44.5 / FV', designTempC: 345,
    moc: 'KCS', size: '2000 x 5900', specialService: 'Hydrogen',
    shellThk: '40', headTopThk: '44', headBotThk: '44' },
  { sno: 11, unit: 'Par-Isom', id: '11-D04', service: 'Stabilizer Receiver', orientation: 'H', p: '19', designTempC: 120,
    moc: 'KCS', size: '1400 x 4000', specialService: 'Hydrogen',
    shellThk: '18', headTopThk: '20', headBotThk: '20' },
  { sno: 12, unit: 'Par-Isom', id: '11-D05', service: 'Deisohexanizer Receiver', orientation: 'H', p: '4.5 / FV', designTempC: 120,
    moc: 'KCS', size: '2500 x 7000', specialService: '—',
    shellThk: '16', headTopThk: '18', headBotThk: '18' },
  { sno: 13, unit: 'Par-Isom', id: '11-D06', service: 'Recycle Gas Knockout Drum', orientation: 'H', p: '32.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1000 x 2400', specialService: 'Hydrogen',
    shellThk: '22', headTopThk: '24', headBotThk: '24' },

  // ── Platforming vessels ──
  { sno: 14, unit: 'Platforming', id: '12-D01', service: 'Separator', orientation: 'H', p: '18 / FV', designTempC: 120,
    moc: 'KCS', size: '2600 x 4300', specialService: 'Hydrogen',
    shellThk: '24', headTopThk: '26', headBotThk: '26' },
  { sno: 15, unit: 'Platforming', id: '12-D02', service: 'Net Gas Compressor Suction Drum', orientation: 'H', p: '22 / FV', designTempC: 120,
    moc: 'KCS', size: '1700 x 5600', specialService: 'Hydrogen',
    shellThk: '22', headTopThk: '24', headBotThk: '24' },
  { sno: 16, unit: 'Platforming', id: '12-D03', service: 'Recontact Drum', orientation: 'H', p: '51.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1700 x 5600', specialService: 'Hydrogen',
    shellThk: '36', headTopThk: '40', headBotThk: '40' },
  { sno: 17, unit: 'Platforming', id: '12-D04A', service: 'Net Gas Chloride Treaters', orientation: 'V', p: '51.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1200 x 7600', specialService: 'Hydrogen',
    shellThk: '30', headTopThk: '30', headBotThk: '30' },
  { sno: 18, unit: 'Platforming', id: '12-D04B', service: 'Net Gas Chloride Treaters', orientation: 'V', p: '51.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1200 x 7600', specialService: 'Hydrogen',
    shellThk: '30', headTopThk: '30', headBotThk: '30' },
  { sno: 19, unit: 'Platforming', id: '12-D05', service: 'Debutanizer Receiver', orientation: 'H', p: '14 / FV', designTempC: 120,
    moc: 'KCS', size: '1400 x 4100 x 18" boot', specialService: 'Hydrogen',
    shellThk: '14 · boot 12', headTopThk: 'Boot head 14', headBotThk: '16 / 16' },
  { sno: 20, unit: 'Platforming', id: '12-D06A', service: 'Debutanizer Fuel Gas Chloride Treaters', orientation: 'V', p: '14 / FV', designTempC: 120,
    moc: 'KCS', size: '24" x 3000', specialService: '—',
    shellThk: '12', headTopThk: '14', headBotThk: '14' },
  { sno: 21, unit: 'Platforming', id: '12-D06B', service: 'Debutanizer Fuel Gas Chloride Treaters', orientation: 'V', p: '14 / FV', designTempC: 120,
    moc: 'KCS', size: '24" x 3000', specialService: '—',
    shellThk: '12', headTopThk: '14', headBotThk: '14' },
  { sno: 22, unit: 'Platforming', id: '12-D07A', service: 'LPG Chloride Treaters', orientation: 'V', p: '42.5 / FV', designTempC: 120,
    moc: 'KCS', size: '24" x 3800', specialService: '—',
    shellThk: '16', headTopThk: '18', headBotThk: '18' },
  { sno: 23, unit: 'Platforming', id: '12-D07B', service: 'LPG Chloride Treaters', orientation: 'V', p: '42.5 / FV', designTempC: 120,
    moc: 'KCS', size: '24" x 3800', specialService: '—',
    shellThk: '16', headTopThk: '18', headBotThk: '18' },
  { sno: 24, unit: 'Platforming', id: '12-D08', service: 'Deethanizer Receiver', orientation: 'H', p: '34.5 / FV', designTempC: 120,
    moc: 'KCS', size: '1000 x 3200 x 14" boot', specialService: '—',
    shellThk: '18 · boot 14', headTopThk: 'Boot head 16', headBotThk: '20 / 20' },
  { sno: 25, unit: 'Platforming', id: '12-D10', service: 'Steam Disengaging Drum', orientation: 'H', p: '49.5 / FV', designTempC: 285,
    moc: 'KCS', size: '1600 x 5400', specialService: '—',
    shellThk: '36', headTopThk: '40', headBotThk: '40' },
];

export const datasheetFor = (id: string): DatasheetRow | undefined => DATASHEET.find((r) => r.id === id);
