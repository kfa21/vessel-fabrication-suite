// Commercial, weld-procedure, sourcing and delivery basis for the app.
// These mirror the Rates and Logistics sheets of the Excel workbook so the
// website and the workbook quote from the same assumptions.

export type CostGroup =
  | 'Shell' | 'Heads' | 'Nozzles' | 'Manways' | 'Internals' | 'Support' | 'Attachments' | 'Lining';

export type WeldProcess = 'GTAW' | 'SMAW' | 'SAW' | 'FCAW';

export type ShippingMode = 'Auto' | 'Land' | 'Sea' | 'Land+Sea';

export interface CountryRate {
  country: string;
  region: string;
  csUsdKg: number;
  ssUsdKg: number;
  freightUsdKg: number;
  dutyPct: number;
  clearanceUsd: number;
  docsUsd: number;
  insurancePct: number;
  leadDays: number;
}

export interface Destination {
  country: string;
  port: string;
  seaNm: number;
  roadKm: number;
  portKm: number;
  landPerKm: number;
  seaBase: number;
  seaPerT: number;
  customsPct: number;
  dutyPct: number;
  insurancePct: number;
  docsUsd: number;
  handlingUsd: number;
  brokerUsd: number;
}

export interface ShippingUnit {
  name: string;
  mode: 'Land' | 'Sea';
  maxL: number;
  maxW: number;
  maxH: number;
  maxT: number;
  baseUsd: number;
  perKm: number;
  perT: number;
  perNm: number;
}

export interface WeldRules {
  rootProcess: WeldProcess;
  fillLow: WeldProcess;
  fillHigh: WeldProcess;
  fillThreshold: number;
  doubleVMin: number;
  rootArea: number;
  gougeDia: number;
  gougeManual: number;
  gougeMachine: number;
  rates: Record<WeldProcess, number>;
  arcFactor: number;
  fitPerM: number;
  jointSetup: number;
  depositFactor: number;
}

export interface Rates {
  shopRateBhd: number;
  fxBhdPerUsd: number;
  contingencyPct: number;
  marginPct: number;
  plateUsdKg: number;
  ssPlateUsdKg: number;
  paintPerM2: number;
  pwhtPerKg: number;
  pwhtSetup: number;
  ndtFullPerM: number;
  ndtSpotPerM: number;
  consumablePerKg: number;
  liningPerM2: number;
  factors: Record<CostGroup, number>;
  weld: WeldRules;
  countries: CountryRate[];
  destinations: Destination[];
  equipment: ShippingUnit[];
}

export interface LogisticsChoice {
  destination: string;
  mode: ShippingMode;
}

export const GCC = ['Bahrain', 'Saudi Arabia', 'UAE', 'Qatar', 'Kuwait', 'Oman'];

export const COST_GROUPS: CostGroup[] = [
  'Shell', 'Heads', 'Nozzles', 'Manways', 'Internals', 'Support', 'Attachments', 'Lining',
];

export const DEFAULT_SOURCE: Record<CostGroup, string> = {
  Shell: 'India',
  Heads: 'China',
  Nozzles: 'UAE',
  Manways: 'UAE',
  Internals: 'Bahrain',
  Support: 'Bahrain',
  Attachments: 'Bahrain',
  Lining: 'Italy',
};

export const COUNTRIES: CountryRate[] = [
  { country: 'India', region: 'South Asia', csUsdKg: 1.30, ssUsdKg: 4.90, freightUsdKg: 0.16, dutyPct: 5, clearanceUsd: 180, docsUsd: 120, insurancePct: 0.35, leadDays: 35 },
  { country: 'China', region: 'East Asia', csUsdKg: 1.28, ssUsdKg: 4.70, freightUsdKg: 0.20, dutyPct: 5, clearanceUsd: 220, docsUsd: 140, insurancePct: 0.35, leadDays: 40 },
  { country: 'UAE', region: 'GCC', csUsdKg: 1.45, ssUsdKg: 5.60, freightUsdKg: 0.06, dutyPct: 0, clearanceUsd: 120, docsUsd: 80, insurancePct: 0.25, leadDays: 12 },
  { country: 'Saudi Arabia', region: 'GCC', csUsdKg: 1.48, ssUsdKg: 5.70, freightUsdKg: 0.08, dutyPct: 0, clearanceUsd: 150, docsUsd: 90, insurancePct: 0.25, leadDays: 14 },
  { country: 'Bahrain', region: 'GCC', csUsdKg: 1.55, ssUsdKg: 5.90, freightUsdKg: 0.02, dutyPct: 0, clearanceUsd: 50, docsUsd: 40, insurancePct: 0.15, leadDays: 3 },
  { country: 'Oman', region: 'GCC', csUsdKg: 1.50, ssUsdKg: 5.75, freightUsdKg: 0.09, dutyPct: 0, clearanceUsd: 140, docsUsd: 90, insurancePct: 0.25, leadDays: 10 },
  { country: 'Kuwait', region: 'GCC', csUsdKg: 1.52, ssUsdKg: 5.80, freightUsdKg: 0.10, dutyPct: 0, clearanceUsd: 150, docsUsd: 90, insurancePct: 0.25, leadDays: 8 },
  { country: 'Qatar', region: 'GCC', csUsdKg: 1.50, ssUsdKg: 5.75, freightUsdKg: 0.08, dutyPct: 0, clearanceUsd: 140, docsUsd: 90, insurancePct: 0.25, leadDays: 7 },
  { country: 'USA', region: 'North America', csUsdKg: 1.65, ssUsdKg: 6.40, freightUsdKg: 0.34, dutyPct: 5, clearanceUsd: 260, docsUsd: 180, insurancePct: 0.40, leadDays: 45 },
  { country: 'UK', region: 'Europe', csUsdKg: 1.70, ssUsdKg: 6.60, freightUsdKg: 0.30, dutyPct: 5, clearanceUsd: 240, docsUsd: 160, insurancePct: 0.40, leadDays: 40 },
  { country: 'Germany', region: 'Europe', csUsdKg: 1.72, ssUsdKg: 6.70, freightUsdKg: 0.30, dutyPct: 5, clearanceUsd: 250, docsUsd: 170, insurancePct: 0.40, leadDays: 42 },
  { country: 'Italy', region: 'Europe', csUsdKg: 1.68, ssUsdKg: 6.50, freightUsdKg: 0.26, dutyPct: 5, clearanceUsd: 220, docsUsd: 150, insurancePct: 0.40, leadDays: 35 },
  { country: 'Spain', region: 'Europe', csUsdKg: 1.66, ssUsdKg: 6.45, freightUsdKg: 0.26, dutyPct: 5, clearanceUsd: 220, docsUsd: 150, insurancePct: 0.40, leadDays: 36 },
  { country: 'Turkey', region: 'Europe / Asia', csUsdKg: 1.58, ssUsdKg: 6.10, freightUsdKg: 0.18, dutyPct: 5, clearanceUsd: 190, docsUsd: 130, insurancePct: 0.35, leadDays: 28 },
];

export const DESTINATIONS: Destination[] = [
  { country: 'Saudi Arabia', port: 'Dammam', seaNm: 120, roadKm: 500, portKm: 25, landPerKm: 1.8, seaBase: 900, seaPerT: 22, customsPct: 0, dutyPct: 5, insurancePct: 0.30, docsUsd: 120, handlingUsd: 350, brokerUsd: 250 },
  { country: 'UAE', port: 'Jebel Ali', seaNm: 300, roadKm: 900, portKm: 30, landPerKm: 1.8, seaBase: 1100, seaPerT: 24, customsPct: 0, dutyPct: 5, insurancePct: 0.30, docsUsd: 120, handlingUsd: 380, brokerUsd: 260 },
  { country: 'Qatar', port: 'Hamad', seaNm: 150, roadKm: 700, portKm: 20, landPerKm: 1.9, seaBase: 950, seaPerT: 23, customsPct: 0, dutyPct: 5, insurancePct: 0.30, docsUsd: 120, handlingUsd: 360, brokerUsd: 250 },
  { country: 'Kuwait', port: 'Shuwaikh', seaNm: 250, roadKm: 650, portKm: 25, landPerKm: 1.9, seaBase: 1000, seaPerT: 23, customsPct: 0, dutyPct: 5, insurancePct: 0.30, docsUsd: 120, handlingUsd: 360, brokerUsd: 250 },
  { country: 'Oman', port: 'Sohar', seaNm: 400, roadKm: 1200, portKm: 30, landPerKm: 1.7, seaBase: 1250, seaPerT: 25, customsPct: 0, dutyPct: 5, insurancePct: 0.30, docsUsd: 130, handlingUsd: 390, brokerUsd: 260 },
  { country: 'Bahrain', port: 'Khalifa Bin Salman', seaNm: 10, roadKm: 40, portKm: 15, landPerKm: 1.6, seaBase: 500, seaPerT: 18, customsPct: 0, dutyPct: 0, insurancePct: 0.20, docsUsd: 80, handlingUsd: 250, brokerUsd: 180 },
  { country: 'Iraq', port: 'Umm Qasr', seaNm: 500, roadKm: 1800, portKm: 550, landPerKm: 2.2, seaBase: 1800, seaPerT: 32, customsPct: 5, dutyPct: 15, insurancePct: 0.60, docsUsd: 250, handlingUsd: 650, brokerUsd: 450 },
  { country: 'Jordan', port: 'Aqaba', seaNm: 900, roadKm: 2000, portKm: 330, landPerKm: 2.1, seaBase: 2100, seaPerT: 34, customsPct: 5, dutyPct: 15, insurancePct: 0.60, docsUsd: 240, handlingUsd: 620, brokerUsd: 430 },
  { country: 'Libya', port: 'Misrata', seaNm: 1600, roadKm: 0, portKm: 250, landPerKm: 2.4, seaBase: 3200, seaPerT: 42, customsPct: 5, dutyPct: 20, insurancePct: 0.70, docsUsd: 320, handlingUsd: 800, brokerUsd: 520 },
  { country: 'Egypt', port: 'Alexandria', seaNm: 1300, roadKm: 0, portKm: 220, landPerKm: 2.3, seaBase: 2800, seaPerT: 38, customsPct: 5, dutyPct: 20, insurancePct: 0.65, docsUsd: 300, handlingUsd: 750, brokerUsd: 480 },
  { country: 'Algeria', port: 'Algiers', seaNm: 1500, roadKm: 0, portKm: 400, landPerKm: 2.5, seaBase: 3100, seaPerT: 41, customsPct: 5, dutyPct: 20, insurancePct: 0.70, docsUsd: 310, handlingUsd: 780, brokerUsd: 500 },
  { country: 'Tunisia', port: 'Rades', seaNm: 1400, roadKm: 0, portKm: 350, landPerKm: 2.4, seaBase: 2950, seaPerT: 40, customsPct: 5, dutyPct: 20, insurancePct: 0.70, docsUsd: 300, handlingUsd: 760, brokerUsd: 490 },
  { country: 'Morocco', port: 'Casablanca', seaNm: 3000, roadKm: 0, portKm: 300, landPerKm: 2.4, seaBase: 4200, seaPerT: 48, customsPct: 5, dutyPct: 20, insurancePct: 0.75, docsUsd: 340, handlingUsd: 850, brokerUsd: 540 },
];

export const SHIPPING_UNITS: ShippingUnit[] = [
  { name: 'Flatbed trailer 13.6 m', mode: 'Land', maxL: 13.6, maxW: 2.5, maxH: 2.8, maxT: 25, baseUsd: 350, perKm: 1.6, perT: 0, perNm: 0 },
  { name: 'Extendable flatbed 18 m', mode: 'Land', maxL: 18, maxW: 3.0, maxH: 3.0, maxT: 35, baseUsd: 520, perKm: 2.1, perT: 0, perNm: 0 },
  { name: 'Lowbed trailer 12 m', mode: 'Land', maxL: 12, maxW: 3.2, maxH: 3.6, maxT: 60, baseUsd: 780, perKm: 2.8, perT: 0, perNm: 0 },
  { name: 'Multi-axle hydraulic trailer', mode: 'Land', maxL: 20, maxW: 4.0, maxH: 4.2, maxT: 120, baseUsd: 1450, perKm: 4.5, perT: 0, perNm: 0 },
  { name: 'Custom heavy haul (permits)', mode: 'Land', maxL: 45, maxW: 5.0, maxH: 5.0, maxT: 200, baseUsd: 3500, perKm: 6.5, perT: 0, perNm: 0 },
  { name: '20 ft flat rack', mode: 'Sea', maxL: 6.0, maxW: 2.4, maxH: 2.6, maxT: 20, baseUsd: 1200, perKm: 0, perT: 30, perNm: 0.50 },
  { name: '40 ft flat rack', mode: 'Sea', maxL: 12.0, maxW: 2.4, maxH: 2.6, maxT: 30, baseUsd: 1800, perKm: 0, perT: 38, perNm: 0.40 },
  { name: '40 ft high cube', mode: 'Sea', maxL: 12.0, maxW: 2.35, maxH: 2.69, maxT: 26, baseUsd: 1400, perKm: 0, perT: 26, perNm: 0.35 },
  { name: 'Breakbulk vessel', mode: 'Sea', maxL: 40, maxW: 8, maxH: 8, maxT: 300, baseUsd: 6500, perKm: 0, perT: 52, perNm: 1.20 },
  { name: 'Heavy-lift vessel', mode: 'Sea', maxL: 60, maxW: 12, maxH: 12, maxT: 800, baseUsd: 18000, perKm: 0, perT: 85, perNm: 2.20 },
  { name: 'Deck barge', mode: 'Sea', maxL: 80, maxW: 20, maxH: 6, maxT: 1500, baseUsd: 24000, perKm: 0, perT: 60, perNm: 1.80 },
];

export const DEFAULT_RATES: Rates = {
  shopRateBhd: 2.0,
  fxBhdPerUsd: 0.376,
  contingencyPct: 0,
  marginPct: 0,
  plateUsdKg: 1.35,
  ssPlateUsdKg: 5.8,
  paintPerM2: 12.5,
  pwhtPerKg: 0.22,
  pwhtSetup: 3400,
  ndtFullPerM: 58,
  ndtSpotPerM: 34,
  consumablePerKg: 5.2,
  liningPerM2: 45,
  factors: {
    Shell: 1.08, Heads: 1.22, Nozzles: 2.6, Manways: 2.2,
    Internals: 1.4, Support: 1.0, Attachments: 1.0, Lining: 1.0,
  },
  weld: {
    rootProcess: 'GTAW',
    fillLow: 'SMAW',
    fillHigh: 'SAW',
    fillThreshold: 20,
    doubleVMin: 12,
    rootArea: 12,
    gougeDia: 1200,
    gougeManual: 0.35,
    gougeMachine: 0.12,
    rates: { GTAW: 0.45, SMAW: 1.5, SAW: 4.6, FCAW: 2.4 },
    arcFactor: 1.55,
    fitPerM: 0.9,
    jointSetup: 0.35,
    depositFactor: 1.06,
  },
  countries: COUNTRIES,
  destinations: DESTINATIONS,
  equipment: SHIPPING_UNITS,
};

export const DEFAULT_LOGISTICS: LogisticsChoice = {
  destination: 'Saudi Arabia',
  mode: 'Auto',
};

export function isGcc(country: string): boolean {
  return GCC.includes(country);
}
