// Material, stock and consumable data used by the sizing / BOQ engine.
// All values are preliminary-engineering references; final values must be
// taken from the ASME BPVC Section II-D tables applicable to the purchase order.

export const STEEL_DENSITY = 7850; // kg/m3
export const KGCM2_TO_MPA = 0.0980665;

export type StressPoint = { tempC: number; sMpa: number };

// SA-516 Gr.70 / SA-105 / SA-106 Gr.B carbon steel (P-No.1, Group 1/2)
// Indicative allowable stress, ASME II-D Table 1A style values.
export const STRESS_TABLE: StressPoint[] = [
  { tempC: 40, sMpa: 138 },
  { tempC: 100, sMpa: 138 },
  { tempC: 150, sMpa: 138 },
  { tempC: 200, sMpa: 138 },
  { tempC: 250, sMpa: 138 },
  { tempC: 300, sMpa: 138 },
  { tempC: 343, sMpa: 138 },
  { tempC: 371, sMpa: 135 },
  { tempC: 400, sMpa: 127 },
  { tempC: 425, sMpa: 117 },
  { tempC: 450, sMpa: 103 },
  { tempC: 475, sMpa: 86 },
  { tempC: 500, sMpa: 62 },
];

export const YIELD_MPA = 262; // SA-516 Gr.70 at ambient
export const E_MODULUS_MPA = 200000;

export const ALLOYS: Record<string, { spec: string; pNo: string; group: string; notes: string }> = {
  KCS: { spec: 'SA-516 Gr.70 / SA-105 / SA-106 Gr.B', pNo: 'P-No.1', group: 'Group 1/2', notes: 'Killed carbon steel' },
  SS304: { spec: 'SA-240 Type 304', pNo: 'P-No.8', group: 'Group 1', notes: 'Austenitic stainless' },
  SS316L: { spec: 'SA-240 Type 316L', pNo: 'P-No.8', group: 'Group 1', notes: '316L lining / internals' },
  SS410: { spec: 'SA-240 Type 410S', pNo: 'P-No.7', group: 'Group 1', notes: '13% Cr tray material' },
};

// Standard plate gauges commonly stocked by pressure-vessel shops (mm).
export const PLATE_GAUGES = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 60, 65, 70, 80, 90, 100];

// Plate stock envelopes (width x length in mm).
export const PLATE_STOCK = [
  { w: 2000, l: 6000, label: '2000 × 6000' },
  { w: 2000, l: 8000, label: '2000 × 8000' },
  { w: 2500, l: 6000, label: '2500 × 6000' },
  { w: 2500, l: 10000, label: '2500 × 10000' },
  { w: 2500, l: 12000, label: '2500 × 12000' },
  { w: 3000, l: 12000, label: '3000 × 12000' },
  { w: 3200, l: 12000, label: '3200 × 12000' },
];

// Approximate flange mass (kg) per NPS for CL150; scaled by class factor.
const FLANGE_CL150: Record<number, number> = {
  1: 2.2, 1.5: 3.2, 2: 5.0, 3: 9.0, 4: 14.0, 6: 24.0, 8: 36.0, 10: 50.0,
  12: 68.0, 14: 82.0, 16: 100.0, 18: 120.0, 20: 145.0, 24: 195.0, 28: 265.0, 30: 310.0,
};
const CLASS_FACTOR: Record<number, number> = { 150: 1, 300: 1.6, 600: 2.6, 900: 3.6, 1500: 5.2, 2500: 8.5 };

export function flangeMass(nps: number, cls = 300): number {
  const keys = Object.keys(FLANGE_CL150).map(Number).sort((a, b) => a - b);
  let base = FLANGE_CL150[24];
  if (nps <= keys[0]) base = FLANGE_CL150[keys[0]];
  else {
    for (let i = 0; i < keys.length - 1; i++) {
      if (nps >= keys[i] && nps <= keys[i + 1]) {
        const t = (nps - keys[i]) / (keys[i + 1] - keys[i]);
        base = FLANGE_CL150[keys[i]] * (1 - t) + FLANGE_CL150[keys[i + 1]] * t;
        break;
      }
    }
  }
  return base * (CLASS_FACTOR[cls] ?? 2.6);
}

// Nominal pipe OD (mm) and available wall thickness for common schedules (mm).
export function pipeOD(nps: number): number {
  const table: Record<number, number> = {
    1: 33.4, 1.5: 48.3, 2: 60.3, 3: 88.9, 4: 114.3, 6: 168.3, 8: 219.1,
    10: 273.0, 12: 323.8, 14: 355.6, 16: 406.4, 18: 457.0, 20: 508.0, 24: 610.0, 28: 711.0, 30: 762.0,
  };
  if (table[nps]) return table[nps];
  // interpolate / extrapolate for odd sizes
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (nps >= keys[i] && nps <= keys[i + 1]) {
      const t = (nps - keys[i]) / (keys[i + 1] - keys[i]);
      return table[keys[i]] * (1 - t) + table[keys[i + 1]] * t;
    }
  }
  return table[30] * (nps / 30);
}

// Wall thickness (mm) taken from common schedules; heavy classes use heavier wall.
export function pipeWall(nps: number, cls = 300): number {
  const sch = cls >= 600 ? 80 : cls >= 300 ? 40 : 20;
  const base: Record<number, { s20: number; s40: number; s80: number }> = {
    1: { s20: 2.77, s40: 3.38, s80: 4.55 },
    1.5: { s20: 2.77, s40: 3.68, s80: 5.08 },
    2: { s20: 2.77, s40: 3.91, s80: 5.54 },
    3: { s20: 3.05, s40: 5.49, s80: 7.62 },
    4: { s20: 3.05, s40: 6.02, s80: 8.56 },
    6: { s20: 3.4, s40: 7.11, s80: 10.97 },
    8: { s20: 3.76, s40: 8.18, s80: 12.7 },
    10: { s20: 4.19, s40: 9.27, s80: 15.09 },
    12: { s20: 4.57, s40: 10.31, s80: 17.48 },
    14: { s20: 4.78, s40: 11.13, s80: 19.05 },
    16: { s20: 4.78, s40: 12.7, s80: 21.44 },
    18: { s20: 5.16, s40: 14.27, s80: 23.83 },
    20: { s20: 5.54, s40: 15.09, s80: 26.19 },
    24: { s20: 6.35, s40: 17.48, s80: 30.96 },
    28: { s20: 6.35, s40: 19.05, s80: 34.93 },
    30: { s20: 6.35, s40: 20.62, s80: 38.1 },
  };
  const row = base[nps] ?? base[nps > 30 ? 30 : 24];
  return sch === 20 ? row.s20 : sch === 40 ? row.s40 : row.s80;
}

// Weld deposition rates (kg deposited metal per arc hour).
export const PROCESS_RATE: Record<string, number> = { SAW: 4.6, FCAW: 2.4, SMAW: 1.5, GTAW: 0.45 };

export const COST_RATES = {
  plateKg: 1.35, // USD/kg carbon steel plate, delivered
  ssPlateKg: 5.8,
  weldKg: 14.0, // consumable + labour per kg deposited
  ndtPerM: 42.0,
  pwhtPerKg: 0.22,
  pwhtSetup: 3400.0,
  shopHour: 42.0,
  paintPerM2: 12.5,
};
