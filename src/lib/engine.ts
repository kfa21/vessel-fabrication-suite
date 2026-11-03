import type { Vessel } from '../data/vessels';
import {
  ALLOYS, COST_RATES, E_MODULUS_MPA, KGCM2_TO_MPA, PLATE_GAUGES, PLATE_STOCK,
  PROCESS_RATE, STEEL_DENSITY, STRESS_TABLE, YIELD_MPA, flangeMass, pipeOD, pipeWall,
} from '../data/materials';

/* ────────────────────────────── basic helpers ────────────────────────────── */

export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export function allowableStress(tempC: number): number {
  const t = STRESS_TABLE;
  if (tempC <= t[0].tempC) return t[0].sMpa;
  for (let i = 0; i < t.length - 1; i++) {
    if (tempC >= t[i].tempC && tempC <= t[i + 1].tempC) {
      const f = (tempC - t[i].tempC) / (t[i + 1].tempC - t[i].tempC);
      return t[i].sMpa + f * (t[i + 1].sMpa - t[i].sMpa);
    }
  }
  return t[t.length - 1].sMpa;
}

export function nextGauge(t: number, min = 6): number {
  const target = Math.max(t, min);
  return PLATE_GAUGES.find((g) => g >= target) ?? Math.ceil(target / 5) * 5;
}

export type Strategy = 'standard' | 'wide' | 'optimized';

/* ─────────────────────────── thickness calculations ─────────────────────────── */

export interface ThkRow {
  key: string;
  item: string;
  clause: string;
  formula: string;
  inputs: string;
  pMpa: number;
  radius: number;
  s: number;
  e: number;
  tCalc: number;   // pressure thickness, no CA
  ca: number;
  tReq: number;    // pressure + CA
  tSel: number;    // selected plate / schedule
  util: number;    // % utilisation
  status: 'OK' | 'THIN';
}

export interface ExternalCheck {
  requiredKpa: number;
  t: number;
  doM: number;
  allowableKpa: number;
  acceptable: boolean;
  maxSpanMm: number;
  ringsRequired: number;
  ringSpacingMm: number;
}

export interface ReinfResult {
  mark: string;
  nps: number;
  service: string;
  od: number;
  wall: number;
  d: number;
  tr: number;
  trn: number;
  ar: number;
  a1: number;
  a2: number;
  available: number;
  padArea: number;
  padWidth: number;
  padThk: number;
  status: 'Self-reinforced' | 'Pad required';
}

export interface CalcOptions {
  strategy: Strategy;
  rt: 'auto' | 'full' | 'spot' | 'none';
}

export interface ThkReport {
  pMpa: number;
  s: number;
  e: number;
  rows: ThkRow[];
  tShell: number;
  tShellTop: number;
  tHeadTop: number;
  tHeadBot: number;
  tCone: number;
  govern: string;
  external: ExternalCheck;
  reinf: ReinfResult[];
}

function shellCirc(pMpa: number, ri: number, s: number, e: number) {
  return (pMpa * ri) / (s * e - 0.6 * pMpa);
}
function shellLong(pMpa: number, ri: number, s: number, e: number) {
  return (pMpa * ri) / (2 * s * e + 0.4 * pMpa);
}
function seHead(pMpa: number, d: number, s: number, e: number) {
  return (pMpa * d) / (2 * s * e - 0.2 * pMpa);
}

/** Elastic buckling allowable for a cylindrical shell under external pressure,
 *  then solved for the maximum unstiffened span. Screening per UG-28. */
function externalCheck(di: number, t: number, length: number, pReqKpa: number): ExternalCheck {
  const doM = (di + 2 * t) / 1000;
  const tM = t / 1000;
  const spanM = length / 1000;
  const k = (2.42 * E_MODULUS_MPA) / Math.pow(1 - 0.3 * 0.3, 0.75);
  const q = Math.pow(tM / doM, 2.5);
  const denom = Math.max(0.05, spanM / doM - 0.45 * Math.sqrt(tM / doM));
  const paMpa = (k * q) / denom;
  const yieldCap = (0.667 * YIELD_MPA * 2 * tM) / doM;
  const allowableKpa = Math.min(paMpa, yieldCap) * 1000;

  // solve span for the required pressure
  const num = (k * q) / (pReqKpa / 1000);
  const maxSpanM = (num + 0.45 * Math.sqrt(tM / doM)) * doM;
  const maxSpanMm = Math.max(300, maxSpanM * 1000);
  const rings = maxSpanMm >= length ? 0 : Math.ceil(length / maxSpanMm) - 1;
  const spacing = rings <= 0 ? length : length / (rings + 1);
  return {
    requiredKpa: pReqKpa, t, doM, allowableKpa, acceptable: allowableKpa >= pReqKpa,
    maxSpanMm: Math.round(maxSpanMm), ringsRequired: rings, ringSpacingMm: Math.round(spacing),
  };
}

export function calcThickness(v: Vessel, opt: CalcOptions): ThkReport {
  const pMpa = v.p * KGCM2_TO_MPA;
  const s = allowableStress(v.designTempC);
  let e = v.rtPolicy === 'Full' ? 1.0 : 0.85;
  if (opt.rt === 'full') e = 1.0;
  if (opt.rt === 'spot') e = 0.85;
  if (opt.rt === 'none') e = 0.7;

  const ri = v.di / 2 + v.ca;
  const tCirc = shellCirc(pMpa, ri, s, e) + v.ca;
  const tLong = shellLong(pMpa, ri, s, e) + v.ca;
  const minFab = v.di > 900 ? 6 : 5;

  const rows: ThkRow[] = [];

  const push = (key: string, item: string, clause: string, formula: string, inputs: string,
    p: number, radius: number, tCalc: number, ca: number, min = minFab, sVal = s, eVal = e) => {
    const tReq = tCalc + ca;
    const tSel = nextGauge(Math.max(tReq, min));
    rows.push({
      key, item, clause, formula, inputs, pMpa: p, radius, s: sVal, e: eVal,
      tCalc, ca, tReq: Math.max(tReq, min), tSel, util: round(((tCalc + ca) / tSel) * 100, 1),
      status: tSel >= tReq ? 'OK' : 'THIN',
    });
    return tSel;
  };

  push('shell-circ', `Shell ${v.di} mm ID — circumferential stress`, 'UG-27(c)(1)',
    't = P·R / (S·E − 0.6P) + CA', `P=${round(pMpa, 3)} MPa · R=${round(ri, 1)} mm · S=${round(s, 0)} MPa · E=${e.toFixed(2)}`,
    pMpa, ri, shellCirc(pMpa, ri, s, e), v.ca);

  push('shell-long', `Shell ${v.di} mm ID — longitudinal stress`, 'UG-27(c)(2)',
    't = P·R / (2S·E + 0.4P) + CA', `P=${round(pMpa, 3)} MPa · R=${round(ri, 1)} mm`,
    pMpa, ri, shellLong(pMpa, ri, s, e), v.ca);

  if (v.diTop && v.diTop !== v.di) {
    const riTop = v.diTop / 2 + v.ca;
    push('shell-top', `Shell ${v.diTop} mm ID (upper section)`, 'UG-27(c)(1)',
      't = P·R / (S·E − 0.6P) + CA', `P=${round(pMpa, 3)} MPa · R=${round(riTop, 1)} mm`,
      pMpa, riTop, shellCirc(pMpa, riTop, s, e), v.ca);

    const alpha = (30 * Math.PI) / 180;
    const dCone = v.di + 2 * v.ca;
    push('cone', `Conical transition Ø${v.diTop} → Ø${v.di}`, 'UG-32(f) / 1-8',
      't = P·D / (2·cos α ·(S·E − 0.6P)) + CA', `D=${round(dCone, 0)} mm · α=30°`,
      pMpa, dCone / 2, (pMpa * dCone) / (2 * Math.cos(alpha) * (s * e - 0.6 * pMpa)), v.ca);
  }

  // the top head sits on the upper shell, so on a two-diameter column it is sized on D_top
  const dTop = (v.diTop ?? v.di) + 2 * v.ca;
  const headTopSel = v.headTop === 'FLAT'
    ? push('head-top-flat', 'Top head — flanged flat cover', 'UG-34(c)(1)',
      't = d·√(0.33P / (S·E)) + CA', `d=${round(dTop, 0)} mm`,
      pMpa, dTop / 2,
      dTop * Math.sqrt((0.33 * pMpa) / (s * e)), v.ca)
    : push('head-top', 'Top head — 2:1 ellipsoidal', 'UG-32(d)',
      't = P·D / (2S·E − 0.2P) + CA', `D=${round(dTop, 0)} mm`,
      pMpa, dTop / 2, seHead(pMpa, dTop, s, e), v.ca, 6);

  const headBotSel = v.headBot === 'FLAT'
    ? push('head-bot-flat', 'Bottom head — flanged flat cover', 'UG-34(c)(1)',
      't = d·√(0.33P / (S·E)) + CA', `d=${round(v.di + 2 * v.ca, 0)} mm`,
      pMpa, (v.di + 2 * v.ca) / 2,
      (v.di + 2 * v.ca) * Math.sqrt((0.33 * pMpa) / (s * e)), v.ca)
    : push('head-bot', 'Bottom head — 2:1 ellipsoidal', 'UG-32(d)',
      't = P·D / (2S·E − 0.2P) + CA', `D=${round(v.di + 2 * v.ca, 0)} mm`,
      pMpa, (v.di + 2 * v.ca) / 2, seHead(pMpa, v.di + 2 * v.ca, s, e), v.ca, 6);

  let legT = 0;
  if (v.dropLeg) {
    const legCA = v.caLeg ?? v.ca;
    const legDi = v.dropLeg.od - 2 * 8;
    legT = push('dropleg', `Drop leg ${v.dropLeg.od.toFixed(0)} mm OD`, 'UG-27(c)(1)',
      't = P·R / (S·E − 0.6P) + CA', `P=${round(pMpa, 3)} MPa · R=${round(legDi / 2 + legCA, 1)} mm · CA=${legCA}`,
      pMpa, legDi / 2 + legCA, shellCirc(pMpa, legDi / 2 + legCA, s, e), legCA, 6);
  }

  const tShell = rows.find((r) => r.key === 'shell-circ')!.tSel;
  const tShellTop = v.diTop ? (rows.find((r) => r.key === 'shell-top')?.tSel ?? tShell) : tShell;
  const tCone = rows.find((r) => r.key === 'cone')?.tSel ?? tShell;

  const govern = rows.reduce((a, b) => (b.tSel > a.tSel ? b : a), rows[0]);

  const external = externalCheck(v.di, tShell, v.tt + v.di / 4, v.vacuum ? 101.3 : 25);

  /* ── UG-37 nozzle reinforcement (simplified, fr1 = fr2 = 1) ── */
  const tr = shellCirc(pMpa, v.di / 2 + v.ca, s, e);
  const reinf: ReinfResult[] = [];
  const nozzleUniq = new Map<string, { nps: number; service: string; cls?: number }>();
  v.nozzles.forEach((n) => { if (!nozzleUniq.has(n.mark)) nozzleUniq.set(n.mark, { nps: n.nps, service: n.service, cls: n.cls }); });

  nozzleUniq.forEach((nz, mark) => {
    const od = pipeOD(nz.nps);
    const cls = nz.cls ?? v.asmeClass;
    const tNom = nz.nps >= 18 ? Math.max(pipeWall(nz.nps, cls), 16) : pipeWall(nz.nps, cls);
    const d = od - 2 * tNom + 2 * v.ca;
    const rn = d / 2 + v.ca;
    const trn = shellCirc(pMpa, rn, s, e) + v.ca;
    const ar = d * tr + 2 * tNom * tr * 0;
    const a1 = Math.max(0, d * (tShell - tr));
    const a2 = 2 * Math.max(0, tNom - trn) * Math.min(2.5 * tShell, 2.5 * tNom);
    const available = a1 + a2;
    const padArea = Math.max(0, ar - available);
    const padWidth = padArea > 0 ? (padArea > 3000 ? 150 : padArea > 1200 ? 100 : 75) : 0;
    const padThk = padWidth > 0 ? nextGauge(padArea / (2 * padWidth)) : 0;
    reinf.push({
      mark, nps: nz.nps, service: nz.service, od, wall: tNom, d: round(d, 1),
      tr: round(tr, 2), trn: round(trn, 2), ar: round(ar, 0), a1: round(a1, 0), a2: round(a2, 0),
      available: round(available, 0), padArea: round(padArea, 0), padWidth,
      padThk, status: padArea > 0 ? 'Pad required' : 'Self-reinforced',
    });
  });

  return {
    pMpa, s, e, rows, tShell, tShellTop, tHeadTop: headTopSel, tHeadBot: headBotSel,
    tCone, govern: govern.item, external, reinf,
  };
}

/* ───────────────────────────── shell plate planning ───────────────────────────── */

export interface Course {
  idx: number; height: number; pieces: number; plateW: number; plateL: number;
  thk: number; weight: number; seamM: number;
}
export interface ShellPlan {
  courses: Course[]; circumference: number; netArea: number; plateArea: number; scrapPct: number;
  plateCount: number; longSeamM: number; girthSeamM: number; cost: number; label: string;
  plateWeight: number;
}
export interface PlanAlt { label: string; plateW: number; plateL: number; courses: number; plateCount: number; scrapPct: number; cost: number; seamM: number; selected: boolean }

export function planShell(di: number, length: number, thk: number, strategy: Strategy): { plan: ShellPlan; alts: PlanAlt[] } {
  const C = Math.PI * (di + thk); // mean circumference, mm
  const net = C * length;          // mm2
  const candidates = strategy === 'standard'
    ? PLATE_STOCK.filter((p) => p.w === 2000 && p.l === 6000)
    : strategy === 'wide'
      ? PLATE_STOCK.filter((p) => p.w === 2500 && p.l === 12000)
      : PLATE_STOCK;

  const alts: PlanAlt[] = candidates.map((st) => {
    const pieces = Math.ceil(C / st.w);
    const nCourses = Math.max(1, Math.ceil(length / st.l));
    const h = length / nCourses;
    // purchased plate area (each course is cut from a full stock plate)
    const plateArea = nCourses * pieces * st.w * st.l;
    const scrap = Math.max(0, 1 - net / plateArea);
    const seamM = (nCourses * pieces * h) / 1000;
    const plateCount = nCourses * pieces;
    const cost = (plateArea / 1e6) * thk * 0.001 * STEEL_DENSITY * COST_RATES.plateKg
      + (seamM * 46) + plateCount * 120;
    return {
      label: st.label, plateW: st.w, plateL: st.l, courses: nCourses, plateCount,
      scrapPct: round(scrap * 100, 1), cost: round(cost, 0), seamM: round(seamM, 1), selected: false,
    };
  });

  const bestIdx = alts.reduce((bi, a, i) => (a.cost < alts[bi].cost ? i : bi), 0);
  const forced = strategy === 'optimized' ? bestIdx : 0;
  alts.forEach((a, i) => { a.selected = i === forced; });
  const a = alts[forced];
  const nCourses = a.courses;
  const h = length / nCourses;
  const courses: Course[] = [];
  for (let i = 0; i < nCourses; i++) {
    const height = round(i === nCourses - 1 ? length - h * (nCourses - 1) : h, 1);
    courses.push({
      idx: i + 1, height, pieces: Math.ceil(C / a.plateW), plateW: a.plateW, plateL: a.plateL,
      thk, weight: round(C * height * thk * 7.85e-6, 1),
      seamM: round((height * Math.ceil(C / a.plateW)) / 1000, 2),
    });
  }
  const plateAreaM2 = (a.plateCount * a.plateW * a.plateL) / 1e6;
  const plateWeight = round(((a.plateCount * a.plateW * a.plateL * thk) / 1e9) * STEEL_DENSITY, 1);
  return {
    plan: {
      courses, circumference: round(C, 0), netArea: round(net / 1e6, 2), plateArea: round(plateAreaM2, 2),
      scrapPct: a.scrapPct, plateCount: a.plateCount, longSeamM: round(a.seamM, 1),
      girthSeamM: round(((nCourses - 1) * C) / 1000, 1), cost: a.cost, label: a.label, plateWeight,
    },
    alts,
  };
}

/* ───────────────────────────────── parts ───────────────────────────────── */

export type PartGroup = 'Shell' | 'Heads' | 'Nozzles' | 'Manways' | 'Internals' | 'Support' | 'Attachments' | 'Lining';

export interface Part {
  no: string; group: PartGroup; description: string; qty: number; material: string;
  size: string; thk: string; unitWt: number; totalWt: number; remark: string;
}

/* ───────────────────────────── weight build-up ───────────────────────────── */

export interface WeightBreak {
  shell: number; heads: number; nozzles: number; manways: number; internals: number;
  support: number; attachments: number; lining: number; total: number; stiffeners: number;
}

/* ───────────────────────────── weld / NDT / PWHT ───────────────────────────── */

export interface WeldRow {
  no: string; joint: string; category: 'A' | 'B' | 'C' | 'D' | 'Att.'; type: string;
  qty: number; lengthM: number; thk: number; process: string; e: number;
  rtPct: number; metalKg: number; hours: number;
}
export interface WeldSummary { rows: WeldRow[]; totalLengthM: number; totalMetalKg: number; hours: number; arcHours: number }

export interface NdtRow {
  no: string; method: string; item: string; extent: string; stage: string;
  standard: string; acceptance: string; hold: boolean;
}

export interface PwhtPlan {
  required: boolean; active: boolean; reason: string; tempMin: number; tempMax: number;
  holdHours: number; heatRate: number; coolRate: number; chargeKg: number; furnaceHours: number;
  thermocouples: number; cost: number; hardnessMax: number; postNdt: string; curve: { t: number; temp: number }[];
}

export interface Stage { id: string; name: string; days: number; start: number; end: number; resource: string; gate: string }

export interface CostBreak { plate: number; consumables: number; labour: number; ndt: number; pwht: number; paint: number; total: number }

export interface VesselCalc {
  vessel: Vessel;
  thk: ThkReport;
  shell: ShellPlan; shellTop?: ShellPlan; shellAlts: PlanAlt[];
  weight: WeightBreak;
  parts: Part[];
  weld: WeldSummary;
  ndt: NdtRow[];
  pwht: PwhtPlan;
  schedule: Stage[];
  cost: CostBreak;
  manhours: number;
  paintM2: number;
  steelGrade: string;
  calc: {
    totalLengthM: number;
  };
}

const headWeight = (di: number, t: number, kind: 'SE' | 'FLAT' | 'CONE'): number => {
  const D = di / 1000;
  if (kind === 'FLAT') return ((Math.PI / 4) * D * D * (t / 1000) * STEEL_DENSITY);
  const area = 1.084 * D * D + 0.28 * Math.PI * D; // dished area + 140 mm straight flange
  return area * (t / 1000) * STEEL_DENSITY;
};

export function buildVessel(v: Vessel, opt: CalcOptions, pwhtOn: boolean): VesselCalc {
  const thk = calcThickness(v, opt);
  const twoDiameter = !!v.diTop && v.diTop !== v.di;
  const lowerLen = twoDiameter ? v.tt * 0.55 : v.tt;
  const { plan: shell, alts } = planShell(v.di, lowerLen, thk.tShell, opt.strategy);
  const shellTop = twoDiameter
    ? planShell(v.diTop!, v.tt * 0.45, thk.tShellTop, opt.strategy).plan
    : undefined;

  const parts: Part[] = [];
  let pNo = 0;
  const add = (group: PartGroup, description: string, qty: number, material: string, size: string,
    thkStr: string, unitWt: number, remark = '') => {
    pNo += 1;
    const no = `${v.id}-${String(pNo).padStart(2, '0')}`;
    parts.push({
      no, group, description, qty, material, size, thk: thkStr,
      unitWt: round(unitWt, 1), totalWt: round(unitWt * qty, 1), remark,
    });
  };

  const grade = ALLOYS[v.h2s || v.ca >= 6 ? 'KCS' : 'KCS'];
  const plateMat = 'SA-516 Gr.70';

  // shell courses
  const shellCourses = [...shell.courses.map((c) => ({ ...c, section: 'lower' })),
  ...(shellTop ? shellTop.courses.map((c) => ({ ...c, section: 'upper' })) : [])];
  shellCourses.forEach((c) => add('Shell', `Shell course ${c.section === 'lower' ? 'L' : 'U'}${c.idx} — ${c.pieces === 1 ? '1 plate rolled' : `${c.pieces} plates`}`,
    1, plateMat, `${c.plateW} × ${c.plateL} stock`, `${c.thk} mm`, c.weight,
    `${c.height} mm high · ${round(Math.PI * ((c.section === 'lower' ? v.di : v.diTop ?? v.di) + c.thk) / 1000, 2)} m circumference`));

  if (shellTop) {
    const coneW = round(Math.PI * ((v.di + (v.diTop ?? v.di)) / 2 + thk.tCone) * ((v.di + (v.diTop ?? v.di)) / 2) * 0.3 * thk.tCone * 7.85e-6 * 0.6, 1);
    add('Shell', 'Conical transition section', 1, plateMat,
      `Ø${v.diTop} → Ø${v.di}`, `${thk.tCone} mm`, Math.max(60, coneW), '30° half angle, 4 segments');
  }

  const topHeadW = headWeight(v.diTop ?? v.di, thk.tHeadTop, v.headTop === 'FLAT' ? 'FLAT' : 'SE');
  const botHeadW = headWeight(v.di, thk.tHeadBot, v.headBot === 'FLAT' ? 'FLAT' : 'SE');
  add('Heads', v.headTop === 'FLAT' ? 'Top head — flanged flat cover' : 'Top head — 2:1 ellipsoidal, with straight flange',
    1, plateMat, `Ø${v.diTop ?? v.di}`, `${thk.tHeadTop} mm`, topHeadW,
    v.headTop === 'FLAT' ? 'Removable cover, NPS 24 body flange' : 'Crown radius = 0.9 D, knuckle = 0.17 D');
  add('Heads', `Bottom head — 2:1 ellipsoidal, with straight flange`, 1, plateMat,
    `Ø${v.di}`, `${thk.tHeadBot} mm`, botHeadW, 'Crown radius = 0.9 D, knuckle = 0.17 D');

  // nozzles
  let nozW = 0; let mwW = 0;
  v.nozzles.forEach((nz) => {
    const od = pipeOD(nz.nps);
    const wall = nz.nps >= 18
      ? Math.max(pipeWall(nz.nps, nz.cls ?? v.asmeClass), 16)
      : pipeWall(nz.nps, nz.cls ?? v.asmeClass);
    const isManway = nz.nps >= 18;
    const neckLen = isManway ? 240 : 190;
    const neckW = Math.PI * od * wall * neckLen * 7.85e-6;
    const fl = flangeMass(nz.nps, nz.cls ?? v.asmeClass);
    const pad = thk.reinf.find((r) => r.mark === nz.mark && r.padArea > 0);
    const padW = pad ? (Math.PI * ((od + 2 * pad.padWidth) ** 2 - od ** 2) / 4) * pad.padThk * 7.85e-6 : 0;
    const coverW = isManway ? (Math.PI * (od + 120) ** 2) / 4 * 24 * 7.85e-6 : 0;
    if (isManway) {
      add('Manways', `${nz.mark} — NPS ${nz.nps} manway (${nz.service})`, nz.qty, plateMat,
        `NPS ${nz.nps} · CL${nz.cls ?? v.asmeClass}`, `${wall} mm neck`, neckW + fl + coverW + padW,
        'Flange + cover + davit/lifting lug + gasket');
      mwW += (neckW + fl + coverW + padW) * nz.qty;
    } else {
      add('Nozzles', `${nz.mark} — NPS ${nz.nps} ${nz.service}`, nz.qty, plateMat,
        `NPS ${nz.nps} · CL${nz.cls ?? v.asmeClass}`, `${wall} mm wall`, neckW + fl + padW,
        pad ? `Reinforcing pad ${pad.padWidth}×${pad.padThk} mm` : 'Self-reinforced, full-pen');
      nozW += (neckW + fl + padW) * nz.qty;
    }
  });

  // internals
  const areaM2 = (Math.PI / 4) * (v.di / 1000) ** 2;
  let intW = 0;
  if (v.trays) {
    const trayW = areaM2 * 45;
    add('Internals', `Valve trays + downcomers (${v.trays} off)`, v.trays, 'SA-240 Type 410 / CS',
      `Ø${v.di}`, '3 mm', trayW * 0.55,
      `Tray spacing 600 mm · ${v.trayType ?? ''}`);
    add('Internals', 'Tray support rings, bolting bars & downcomer supports', v.trays, 'SA-516 Gr.70',
      `Ø${v.di}`, '8 mm', areaM2 * 7, 'Continuous fillet to shell, 50×8 flats');
    intW += v.trays * (trayW * 0.55 + areaM2 * 7);
  }
  if (v.packing || v.bedDepth) {
    add('Internals', v.packing ? 'Packing support, bed limiter & redistributor' : 'Support screen + bed limiter + distributor',
      1, 'SA-240 Type 304 / 316L', `Ø${v.di}`, '6 mm', areaM2 * 32, 'Internals pass through manway');
    add('Internals', 'Inert ball grading / bed material support', 1, 'SA-240 Type 304',
      `Ø${v.di}`, '3 mm', areaM2 * 12, 'Screen DWG 3-331');
    intW += areaM2 * 44;
  }
  if (v.kind === 'Separator' || v.kind === 'Drum') {
    add('Internals', 'Vortex breaker, baffle & distributor support', 1, plateMat, `Ø${v.di}`, '10 mm',
      areaM2 * 9, 'DWG 3-122 / 3-115 Type I');
    intW += areaM2 * 9;
  }
  if (!v.trays && !v.packing && !v.bedDepth && v.kind !== 'Separator' && v.kind !== 'Drum') {
    add('Internals', 'Distributor support + baffle', 1, 'SA-240 Type 316L', `Ø${v.di}`, '6 mm',
      areaM2 * 8, 'DWG 3-183 Type C');
    intW += areaM2 * 8;
  }

  // support — permanent (skirt, legs or two saddles)
  const horiz = v.orientation === 'H';
  const skirtH = v.support === 'Skirt'
    ? Math.max(1600, Math.min(4000, v.tt * 0.12))
    : v.support === 'Legs' ? 1200 : 0;
  const Rmm = v.di / 2;
  const sadW = Math.max(300, Math.round((Rmm * 0.7) / 10) * 10);      // saddle width along the axis
  const sadH = Math.max(400, Math.round((Rmm * 0.45) / 50) * 50);     // saddle height, base plate to shell
  let tsW = 0; // transportation saddle width, set for vertical vessels below
  let supW = 0;
  if (v.support === 'Skirt') {
    const tSkirt = nextGauge(Math.max(8, thk.tShell * 0.6), 8);
    const w = Math.PI * (v.di + 2 * thk.tShell + tSkirt) * skirtH * tSkirt * 7.85e-6;
    add('Support', `Support skirt ${skirtH} mm high`, 1, plateMat, `Ø${v.di}`, `${tSkirt} mm`,
      w, 'With base ring 40 mm, gussets, 24 anchor bolts');
    add('Support', 'Skirt base ring + gussets + anchor bolts', 1, 'SA-36 / 8.8 bolts', `Ø${v.di}`,
      '40 mm', Math.PI * (v.di / 1000) * 0.35 * 90, 'Grout holes, earthing boss');
    supW = w + Math.PI * (v.di / 1000) * 0.35 * 90;
  } else if (v.support === 'Saddles') {
    const tWeb = 12; const tBase = 20; const tWear = Math.max(10, thk.tShell);
    const webKG = 2 * 2 * (0.6 * sadW * sadH * tWeb * 7.85e-6);                   // 2 webs × 2 saddles
    const baseKG = 2 * ((sadW + 300) * 300 * tBase * 7.85e-6);
    const wearKG = 2 * (sadW * Rmm * 1.15 * tWear * 7.85e-6);
    const stiffKG = 2 * 4 * (0.45 * sadH * 0.22 * sadW * tWeb * 7.85e-6);
    add('Support', `Saddle assembly (2 off) — ${sadW} × ${sadH} mm, web 12 mm, base plate 20 mm`, 2,
      plateMat, `${sadW} wide × ${sadH} high`, `${tWeb} mm`, webKG / 2 + stiffKG / 2 + baseKG / 2,
      'One fixed saddle, one sliding (slotted base plate + PTFE pad), 4 anchor bolts each');
    add('Support', 'Saddle wear plates (stainless-clad contact pads) + anchor bolts', 2, 'SA-240 Type 304L / 8.8',
      `${sadW} × ${Math.round(Rmm * 1.15)} arc`, `${tWear} mm`, wearKG / 2, 'Wear plate welded to shell, ground flush before MT');
    supW = webKG + baseKG + wearKG + stiffKG;
  } else {
    const legOD = 168.3; const legT = 7.1;
    add('Support', `Support legs (4 off) × ${skirtH} mm`, 4, 'SA-106 Gr.B', 'NPS 6 SCH40',
      `${legT} mm`, Math.PI * legOD * legT * skirtH * 7.85e-6, 'With base plates 200×200×16');
    add('Support', 'Base plates, gussets & anchor bolts', 4, 'SA-36', '200 × 200', '16 mm',
      (0.2 * 0.2 * 0.016 * 7850), '');
    supW = 4 * (Math.PI * legOD * legT * skirtH * 7.85e-6 + 5);
  }

  // transportation saddles — every vertical vessel travels lying down on two cradles
  let transportW = 0;
  if (!horiz) {
    tsW = Math.max(450, Math.round((Rmm * 0.85) / 10) * 10);
    const tsH = Math.max(300, Math.round((Rmm * 0.3) / 50) * 50);
    const tsKG = 2 * (2 * 0.55 * tsW * tsH * 12 * 7.85e-6 + (tsW + 240) * 240 * 16 * 7.85e-6);
    add('Support', 'Transportation saddles (2 off, temporary shipping cradle)', 2, 'SA-36',
      `${tsW} wide × ${tsH} high`, '16 mm web / 20 mm base', tsKG / 2,
      'Bolted to skirt or shell with clamped lugs, wood cribbing; removed after erection, weld areas ground + MT');
    add('Support', 'Shipping tie-down lugs + lifting trunnion pads (temporary)', 4, 'SA-36', '—', '20 mm',
      Math.max(28, Rmm * 0.05), 'Calculated for 1.5 × shipping weight, removed after erection');
    transportW = tsKG + 4 * Math.max(28, Rmm * 0.05);
  } else {
    const sadW = Math.max(300, Math.round((Rmm * 0.7) / 10) * 10);
    add('Support', 'Fixed + sliding saddle anchor bolts, shims & grout pads', 8, '8.8 / SA-36',
      'M24', '20 mm', 6, 'Sliding saddle slot length per thermal growth at design temperature');
    supW += 8 * 6;
    transportW = 0;
  }

  // attachments
  const shellArea = Math.PI * (v.di / 1000) * (v.tt / 1000) + 2 * areaM2;
  add('Attachments', 'Insulation support rings + Clips (25 mm pins @ 450 crs)', 1, 'SA-36',
    `Ø${v.di}`, '3 mm', shellArea * 2.8, 'Per insulation vendor drawing');
  add('Attachments', 'Ladder & platform clips / cage brackets', 1, 'SA-36', '—', '6 mm',
    65 + v.tt * 0.004, 'Where indicated on sheet');
  add('Attachments', 'Lifting trunnions / tailing lugs', 2, plateMat, '—', '20 mm',
    v.tt > 8000 ? 120 : 70, 'Calculated for erection load, 1.5 × WLL');
  add('Attachments', 'Nameplate bracket, earthing boss, C/W lugs', 1, 'SA-36', '—', '6 mm', 12, 'U-1A nameplate, EB');
  let attW = shellArea * 2.8 + 65 + v.tt * 0.004 + 2 * (v.tt > 8000 ? 120 : 70) + 12 + transportW;

  if (thk.external.ringsRequired > 0) {
    const nRings = thk.external.ringsRequired;
    const ringW = Math.PI * ((v.di + 60) / 1000) * 0.12 * 0.012 * 7850;
    add('Attachments', `External vacuum stiffener rings (${nRings} off @ ${thk.external.ringSpacingMm} mm)`, nRings,
      plateMat, `Ø${v.di}`, '12 × 120 mm flat', ringW, 'UG-29 / UG-30, continuous + intermittent welds');
    attW += nRings * ringW;
  }

  if (pwhtOn) {
    add('Attachments', 'PWHT internal/external temp supports & thermocouple pads', 1, 'SA-36',
      '—', '16 mm', 180, '8 TC pads, 4 supports, bracing');
    attW += 180;
  }

  let liningW = 0;
  if (v.liner) {
    const w = Math.PI * (v.di / 1000) * (v.tt / 1000) * 0.5 * 3 * 7.98;
    add('Lining', '316L strip lining, bottom half + nozzle liners', 1, 'SA-240 Type 316L',
      `Ø${v.di}`, '3 mm', w, 'Lining is the corrosion allowance in lined portion');
    liningW = w;
  }

  const shellW = shellCourses.reduce((a, c) => a + c.weight, 0);
  const headsW = topHeadW + botHeadW;
  const weight: WeightBreak = {
    shell: round(shellW, 0), heads: round(headsW, 0), nozzles: round(nozW, 0),
    manways: round(mwW, 0), internals: round(intW, 0), support: round(supW, 0),
    attachments: round(attW, 0), lining: round(liningW, 0),
    stiffeners: 0,
    total: round(shellW + headsW + nozW + mwW + intW + supW + attW + liningW, 0),
  };

  /* ── welds ── */
  const weldRows: WeldRow[] = [];
  let wno = 0;
  const addWeld = (joint: string, category: WeldRow['category'], type: string, qty: number,
    lengthM: number, t: number, process: string, e: number, rtPct: number, groove: number) => {
    wno += 1;
    const metalKg = lengthM * 1000 * groove * 1.06 * 7.85e-6;
    const rate = PROCESS_RATE[process] ?? 2;
    const hours = metalKg / rate * 1.55 + lengthM * 0.9 + qty * 0.35;
    weldRows.push({
      no: `W-${String(wno).padStart(2, '0')}`, joint, category, type, qty, lengthM: round(lengthM, 1),
      thk: t, process, e, rtPct, metalKg: round(metalKg, 1), hours: round(hours, 1),
    });
  };

  const gArea = (t: number) => 0.35 * t * t + 2 * t; // double-V 60°, 2 mm root gap, mm²
  const rtPct = thk.e >= 1 ? 100 : thk.e >= 0.85 ? 20 : 0;

  addWeld('Longitudinal shell seams (Category A)', 'A', 'Double-welded butt, Type 1', shell.plateCount,
    shell.longSeamM + (shellTop?.longSeamM ?? 0), thk.tShell, 'SAW', thk.e, rtPct, gArea(thk.tShell));
  addWeld('Circumferential shell seams (Category B)', 'B', 'Double-welded butt, Type 1',
    Math.max(1, shell.courses.length - 1) + (shellTop ? shellTop.courses.length : 0),
    shell.girthSeamM + (shellTop?.girthSeamM ?? 0), thk.tShell, 'SAW', thk.e, rtPct, gArea(thk.tShell));
  addWeld('Head-to-shell closure (Category A)', 'A', 'Double-welded butt, Type 1', 2,
    (Math.PI * (v.di + thk.tShell) * 2) / 1000, thk.tHeadBot, 'SAW', thk.e, rtPct, gArea(thk.tHeadBot));
  if (shellTop) {
    addWeld('Cone-to-shell seams (Category A/B)', 'A', 'Double-welded butt, Type 1', 2,
      (Math.PI * (v.di + v.diTop!) / 1000) * 0.98, thk.tCone, 'SAW', thk.e, rtPct, gArea(thk.tCone));
  }
  const nozzleCount = v.nozzles.reduce((a, nz) => a + nz.qty, 0);
  addWeld('Nozzle neck to shell/head — full penetration (Category D)', 'D', 'Full-pen groove + fillet',
    nozzleCount, v.nozzles.reduce((a, nz) => a + (Math.PI * pipeOD(nz.nps) * nz.qty) / 1000, 0),
    thk.tShell, 'FCAW', 1.0, 100, gArea(Math.min(thk.tShell, 20)));
  addWeld('Nozzle flange to neck (Category C)', 'C', 'Butt weld, Type 1', nozzleCount,
    v.nozzles.reduce((a, nz) => a + (Math.PI * pipeOD(nz.nps) * nz.qty) / 1000, 0),
    Math.min(20, pipeWall(6, v.asmeClass)), 'GTAW', 1.0, 0, gArea(Math.min(20, pipeWall(6, v.asmeClass)), ), );
  addWeld('Internal attachment welds — tray rings, baffles, vortex breaker', 'Att.', 'Fillet, 6-8 mm leg',
    Math.max(1, v.trays ?? 8), (Math.PI * (v.di / 1000) * Math.max(1, v.trays ?? 4)) * 1.4,
    8, 'FCAW', 0.85, 0, 0.5 * 8 * 8);
  if (v.support === 'Skirt') {
    addWeld('Skirt-to-shell closure + insulation ring clips', 'Att.', 'Fillet + partial-pen',
      1, Math.PI * (v.di / 1000) * 2.2 + 40, Math.max(8, thk.tShell * 0.7), 'FCAW', 0.85, 0, 0.5 * 10 * 10);
  } else if (v.support === 'Saddles') {
    addWeld('Saddle wear plate to shell — continuous fillet both sides (Category Att.)', 'Att.',
      'Continuous fillet, 10 mm leg', 2, 2 * (sadW / 1000) * 2 * 1.15, Math.max(10, thk.tShell), 'FCAW', 0.85, 0, 0.5 * 10 * 10);
    addWeld('Saddle web-to-base, gusset and stiffener welds (Category Att.)', 'Att.', 'Fillet, 8-10 mm leg',
      2, 4 * (sadH / 1000) + 4 * (sadW / 1000), 12, 'FCAW', 0.85, 0, 0.5 * 9 * 9);
  } else {
    addWeld('Leg-to-shell pads + gusset welds (Category Att.)', 'Att.', 'Fillet, 8 mm leg',
      4, 4 * (Math.PI * 0.168) + 4 * 1.2, Math.max(8, thk.tShell), 'FCAW', 0.85, 0, 0.5 * 8 * 8);
  }
  if (!horiz) {
    addWeld('Temporary transportation saddle cradles + tie-down lugs', 'Att.',
      'Fillet, 8 mm leg — temporary, removed after erection', 2, 4 * (sadW / 1000) + 2 * 1.6, 10, 'FCAW', 0.85, 0, 0.5 * 8 * 8);
  }
  if (thk.external.ringsRequired > 0) {
    addWeld('Vacuum stiffener rings to shell', 'Att.', 'Continuous + intermittent fillet',
      thk.external.ringsRequired, Math.PI * (v.di / 1000) * thk.external.ringsRequired * 0.62, 12, 'FCAW', 0.85, 0, 0.5 * 10 * 10);
  }
  if (v.dropLeg) {
    addWeld('Drop leg shell + head seams', 'A', 'Double-welded butt, Type 1', 3,
      (Math.PI * (v.dropLeg.od / 1000)) * 2.2, Math.max(8, thk.tShell * 0.65), 'SAW', thk.e, rtPct, gArea(Math.max(8, thk.tShell * 0.65)));
  }

  const totalLengthM = weldRows.reduce((a, r) => a + r.lengthM, 0);
  const totalMetalKg = weldRows.reduce((a, r) => a + r.metalKg, 0);
  const arcHours = weldRows.reduce((a, r) => a + r.metalKg / (PROCESS_RATE[r.process] ?? 2), 0);
  const hours = weldRows.reduce((a, r) => a + r.hours, 0);
  const weld: WeldSummary = {
    rows: weldRows, totalLengthM: round(totalLengthM, 1), totalMetalKg: round(totalMetalKg, 1),
    hours: round(hours, 0), arcHours: round(arcHours, 0),
  };

  /* ── NDT ── */
  const ndt: NdtRow[] = [];
  let ndtNo = 0;
  const addNdt = (method: string, item: string, extent: string, stage: string, standard: string,
    acceptance: string, hold = false) => {
    ndtNo += 1;
    ndt.push({ no: `N-${String(ndtNo).padStart(2, '0')}`, method, item, extent, stage, standard, acceptance, hold });
  };
  if (thk.e >= 1) {
    addNdt('RT', 'All Category A & B butt welds', '100%', 'After welding, before PWHT (final after PWHT for UHA/UCS)', 'UW-51 / UW-52', 'No cracks; linear indications per UW-51(b); porosity limits', true);
  } else if (thk.e >= 0.85) {
    addNdt('RT', 'Category A butt welds', 'Spot — 20% of each weld length, min 150 mm', 'After welding', 'UW-52', 'Acceptable per UW-52', false);
    addNdt('RT', 'Category B butt welds', 'Spot — 5% or 20% per UW-11(a)(5)(b) as elected', 'After welding', 'UW-52', 'Acceptable per UW-52', false);
  } else {
    addNdt('VT', 'All pressure-retaining welds', '100%', 'In process & final', 'UW-35', 'Full penetration, no undercut beyond UW-35', false);
  }
  addNdt('UT', 'Nozzle-to-shell full-pen welds (NPS ≥ 4) + T-joints', '100% of full-pen nozzle welds', '24 h after welding, before PWHT', 'UW-52 / Appendix 12', 'No planar defects; UT per ASME VIII Div.1 App.12', true);
  addNdt('MT', 'All manway/nozzle attachment welds, skirt closure, internal clips', '100% (root + final)', 'Root pass and final after PWHT', 'UW-35 / Appendix 6', 'No relevant linear indications', true);
  if (v.support === 'Saddles') {
    addNdt('MT', 'Saddle wear plate to shell + web/base welds', '100% (root + final)', 'After welding, before hydrotest', 'UW-35 / Appendix 6', 'No cracks; no weld under the base plate', true);
  }
  if (!horiz) {
    addNdt('MT', 'Temporary transportation saddle + tie-down weld areas after removal', '100% of ground area', 'After saddle removal, before painting', 'Appendix 6', 'No cracks after grinding; thickness ≥ t required', true);
  }
  addNdt('PT', 'Stainless / alloy welds and 316L lining seams', v.liner ? '100% of lining + nozzle liners' : 'All SS attachment welds', 'Final', 'Appendix 8', 'No relevant indications', false);
  if (thk.e >= 1) addNdt('RT', 'Nozzle-to-shell full-pen (NPS ≥ 4)', '100% (radiographic or UT per UW-51 alternative)', 'After welding', 'UW-51', 'Acceptable', false);
  addNdt('HT', 'Hydrostatic test', '1.3 × design pressure, 30 min hold', 'After PWHT + final NDT', 'UG-99(b)', 'No leakage / no permanent distortion', true);
  addNdt('UT', 'Shell thickness survey (corrosion allowance verification)', 'Grid 4 × 4 per course', 'After hydrotest', 'UG-90(c)', 't ≥ tReq + CA', false);
  if (thk.e >= 1) addNdt('PMI', 'Alloy components (316L lining, Alloy 400 internals)', '100% of alloy items', 'Receiving', 'Project spec', 'Chemistry matches cert', false);
  if (v.h2s) addNdt('HB', 'Hardness survey — H2S service', '10% of welds, min 3 per vessel', 'After PWHT', 'NACE MR0103 / UCS-56', '≤ 200 HB (22 HRC)', true);
  addNdt('VT', 'Closure / dimensional check', '100%', 'Final', 'Approved GA drawing', 'Tolerance ±10 mm T/T, ±3 mm ID', false);

  /* ── PWHT ── */
  const tMax = Math.max(thk.tShell, thk.tHeadBot, thk.tHeadTop);
  const heatRate = round(Math.max(28, 222 / Math.max(1, tMax / 25.4)), 0);
  const coolRate = heatRate;
  const holdHours = round(Math.max(1, tMax / 25.4), 1);
  const holdTempMin = 595; const holdTempMax = 650;
  const thermocouples = Math.max(6, Math.ceil((v.tt / 1000) / 3) + 2);
  const chargeKg = weight.total;
  const furnaceHours = round((holdTempMin - 20) / heatRate + holdHours + (holdTempMin - 60) / coolRate + 4, 1);
  const pwhtCost = pwhtOn ? round(COST_RATES.pwhtSetup + chargeKg * COST_RATES.pwhtPerKg + furnaceHours * 120, 0) : 0;
  const curve: { t: number; temp: number }[] = [];
  let tAcc = 0;
  const heatTime = (holdTempMin - 20) / heatRate;
  for (let i = 0; i <= 10; i++) curve.push({ t: round((heatTime * i) / 10, 1), temp: round(20 + ((holdTempMin - 20) * i) / 10, 0) });
  tAcc = heatTime;
  const holdTemp = Math.round((holdTempMin + holdTempMax) / 2);
  curve.push({ t: round(tAcc, 1), temp: holdTempMin });
  curve.push({ t: round(tAcc + 0.15, 1), temp: holdTemp });
  curve.push({ t: round(tAcc + holdHours, 1), temp: holdTemp });
  tAcc += holdHours;
  const coolTime = (holdTempMin - 60) / coolRate;
  for (let i = 1; i <= 8; i++) curve.push({ t: round(tAcc + (coolTime * i) / 8, 1), temp: round(holdTempMin - ((holdTempMin - 60) * i) / 8, 0) });

  const pwht: PwhtPlan = {
    required: v.pwhtRequired, active: pwhtOn,
    reason: v.pwhtNote ?? (v.pwhtRequired
      ? 'Nominal thickness / P-No.1 rule (UCS-56) or wet H2S service'
      : `Not mandatory: P-No.1, t = ${tMax} mm ≤ 32 mm, no wet H2S / caustic service`),
    tempMin: holdTempMin, tempMax: holdTempMax, holdHours, heatRate, coolRate,
    chargeKg: round(chargeKg, 0), furnaceHours, thermocouples, cost: pwhtCost,
    hardnessMax: 200, postNdt: pwhtOn ? 'MT/PT of all attachments + 10% RT of butt welds + hardness survey after PWHT' : 'Not applicable',
    curve,
  };

  /* ── schedule ── */
  const weldDays = Math.max(2, weld.hours / (8 * 6 * 0.75));
  const stageDefs: { id: string; name: string; days: number; resource: string; gate: string }[] = [
    { id: 'eng', name: 'Engineering — GA, calc sheet, nozzle orientation', days: 6 + nozzleCount * 0.15, resource: 'Design 3', gate: 'UOP / client approval' },
    { id: 'proc', name: 'Plate & forging procurement (mill lead time)', days: 42, resource: 'Procurement', gate: 'MTC EN 10204 3.1 review' },
    { id: 'recv', name: 'Material receipt, PMI, marking & traceability', days: 4, resource: 'Stores / QC', gate: 'H1 — material verification' },
    { id: 'cut', name: 'Nesting, CNC cutting, edge prep & rolling', days: 3 + shellCourses.length * 0.9 + (v.diTop ? 2 : 0), resource: 'Plate shop', gate: 'H2 — dimensional + bevel check' },
    { id: 'fit', name: 'Fit-up of courses, heads, nozzles & internals', days: 3 + shellCourses.length * 0.7 + nozzleCount * 0.18, resource: 'Fit-up crew 4', gate: 'H3 — fit-up / root inspection' },
    { id: 'weld', name: 'Welding — SAW shell seams, FCAW nozzles & attachments', days: weldDays, resource: 'Welders 6', gate: 'H4 — weld completion' },
    { id: 'ndt', name: 'NDT — RT / UT / MT / PT', days: Math.max(2, weldDays * 0.28 + 2), resource: 'NDT subcontract', gate: 'H5 — NDT release' },
    { id: 'pwht', name: 'PWHT — furnace charge, controlled cycle, hardness', days: pwhtOn ? 3 : 0, resource: 'Heat treatment', gate: 'H6 — PWHT chart + hardness' },
    { id: 'hydro', name: 'Hydrostatic test + post-test NDT + drying', days: 3, resource: 'QC / test bay', gate: 'H7 — hydro witness' },
    { id: 'paint', name: 'Surface prep, painting, insulation clips, nameplate', days: 4, resource: 'Paint shop', gate: 'H8 — DFT / final visual' },
    { id: 'doc', name: 'Documentation, preservation, packing & dispatch', days: 6, resource: 'QA / logistics', gate: 'H9 — MDR handover' },
  ];
  // planning durations carry a shop allowance: real bays, cranes, holidays and rework
  const SHOP_ALLOWANCE = 1.3;
  const relaxed = stageDefs.map((s) => ({
    ...s,
    days: Math.round(s.days * SHOP_ALLOWANCE * 2) / 2,
  }));
  const relaxedTotal = relaxed.reduce((a, s) => a + s.days, 0);
  relaxed.push({
    id: 'buffer',
    name: 'Contingency — rework, crane/bay availability, statutory holidays',
    days: Math.round(relaxedTotal * 0.1 * 2) / 2,
    resource: 'Production control',
    gate: 'H10 — management release',
  });

  let cursor = 0;
  const schedule: Stage[] = relaxed.map((s) => {
    const start = cursor;
    const end = start + Math.round(s.days * 10) / 10;
    cursor = end;
    return { ...s, days: Math.round(s.days * 10) / 10, start: Math.round(start * 10) / 10, end };
  });

  /* ── cost & manhours ── */
  const plateCost = weight.shell * COST_RATES.plateKg * 1.08
    + weight.heads * COST_RATES.plateKg * 1.22
    + weight.nozzles * COST_RATES.plateKg * 2.6
    + weight.manways * COST_RATES.plateKg * 2.2
    + weight.internals * COST_RATES.plateKg * 1.4
    + weight.support * COST_RATES.plateKg
    + weight.attachments * COST_RATES.plateKg
    + weight.lining * COST_RATES.ssPlateKg;
  const manhours = round(weld.hours + 120 + nozzleCount * 12 + (v.trays ?? 0) * 9 + (pwhtOn ? 40 : 0), 0);
  const paintM2 = round(Math.PI * (v.di / 1000) * (v.tt / 1000) + 2 * areaM2 + Math.PI * (v.di / 1000) * skirtH / 1000, 1);
  const ndtCost = round(totalLengthM * (thk.e >= 1 ? 58 : 34) + 900 + (v.h2s ? 750 : 0), 0);
  const cost: CostBreak = {
    plate: round(plateCost, 0),
    consumables: round(weld.totalMetalKg * 5.2, 0),
    labour: round(manhours * COST_RATES.shopHour, 0),
    ndt: ndtCost,
    pwht: pwhtCost,
    paint: round(paintM2 * COST_RATES.paintPerM2, 0),
    total: 0,
  };
  cost.total = round(cost.plate + cost.consumables + cost.labour + cost.ndt + cost.pwht + cost.paint, 0);

  return {
    vessel: v, thk, shell, shellTop, shellAlts: alts, weight, parts, weld, ndt, pwht, schedule,
    cost, manhours, paintM2, steelGrade: grade.spec,
    calc: {
      totalLengthM: v.orientation === 'H'
        ? v.tt / 1000 + (sadW / 1000) * 2
        : v.tt / 1000 + (tsW / 1000) * 2
    }
  };
}

/* ───────────────────── fleet raw-material procurement (optimised BOQ) ───────────────────── */

export interface BoqDemandRow { id: string; service: string; cls: string; gauge: number; area: number; weight: number }
export interface BoqGaugeLine {
  gauge: number; vessels: string[]; netArea: number; envelope: string; plateW: number; plateL: number;
  plates: number; purchaseArea: number; weight: number; cost: number; soloCost: number;
  soloPlates: number; scrapPct: number;
}
export interface BoqPlan {
  lines: BoqGaugeLine[]; demand: BoqDemandRow[];
  plates: number; weight: number; cost: number; soloCost: number; saving: number;
  netArea: number; purchaseArea: number; scrapPct: number; soloSavingPct: number;
}

/** Net pressure-plate area per gauge: shell courses (mid-surface) and dished-end blanks. */
function plateDemand(c: VesselCalc): { gauge: number; area: number }[] {
  const acc: Record<number, number> = {};
  const push = (g: number, a: number) => { acc[g] = (acc[g] ?? 0) + a; };
  const v = c.vessel;
  c.shell.courses.forEach((cs) => push(cs.thk, Math.PI * ((v.di + cs.thk) / 1000) * (cs.height / 1000)));
  c.shellTop?.courses.forEach((cs) => push(cs.thk, Math.PI * (((v.diTop ?? v.di) + cs.thk) / 1000) * (cs.height / 1000)));
  const blank = (d: number) => 1.18 * (Math.PI / 4) * (d / 1000) ** 2;
  push(c.thk.tHeadTop, blank(v.diTop ?? v.di));
  push(c.thk.tHeadBot, blank(v.di));
  return Object.entries(acc).map(([g, a]) => ({ gauge: Number(g), area: round(a, 2) }));
}

const NEST_EFF = 0.85;

/**
 * Buys plate for the whole scope in one go: per gauge, the stock envelope that minimises plate cost
 * across every vessel, compared with each vessel buying its own plates.
 */
export function fleetBoq(calcs: VesselCalc[]): BoqPlan {
  const byGauge = new Map<number, { vessels: string[]; area: number }>();
  const demand: BoqDemandRow[] = [];

  calcs.forEach((c) => {
    plateDemand(c).forEach((d) => {
      const g = byGauge.get(d.gauge) ?? { vessels: [], area: 0 };
      g.area += d.area;
      if (!g.vessels.includes(c.vessel.id)) g.vessels.push(c.vessel.id);
      byGauge.set(d.gauge, g);
      demand.push({
        id: c.vessel.id, service: c.vessel.service, cls: c.vessel.kind,
        gauge: d.gauge, area: d.area, weight: Math.round(d.area * (d.gauge / 1000) * STEEL_DENSITY),
      });
    });
  });

  const plateRate = (g: number) => (g / 1000) * STEEL_DENSITY * COST_RATES.plateKg * 1.06;

  const lines: BoqGaugeLine[] = [];
  byGauge.forEach((grp, gauge) => {
    let best = { envelope: '', plateW: 0, plateL: 0, plates: 0, purchaseArea: 0, cost: Infinity };
    PLATE_STOCK.forEach((env) => {
      const plateArea = (env.w * env.l) / 1e6;
      const plates = Math.max(1, Math.ceil(grp.area / (plateArea * NEST_EFF)));
      const purchaseArea = plates * plateArea;
      const cost = purchaseArea * plateRate(gauge);
      if (cost < best.cost) best = { envelope: env.label, plateW: env.w, plateL: env.l, plates, purchaseArea, cost };
    });

    // what the same plates would cost if every vessel bought on its own
    let soloCost = 0; let soloPlates = 0;
    calcs.forEach((c) => {
      const d = plateDemand(c).find((x) => x.gauge === gauge);
      if (!d) return;
      let cheapest = Infinity; let plates = 0;
      PLATE_STOCK.forEach((env) => {
        const plateArea = (env.w * env.l) / 1e6;
        const n = Math.max(1, Math.ceil(d.area / (plateArea * NEST_EFF)));
        const cost = n * plateArea * plateRate(gauge);
        if (cost < cheapest) { cheapest = cost; plates = n; }
      });
      soloCost += cheapest; soloPlates += plates;
    });

    const weight = Math.round(best.purchaseArea * (gauge / 1000) * STEEL_DENSITY);
    lines.push({
      gauge, vessels: grp.vessels, netArea: round(grp.area, 2), envelope: best.envelope,
      plateW: best.plateW, plateL: best.plateL, plates: best.plates, purchaseArea: round(best.purchaseArea, 2),
      weight, cost: Math.round(best.cost), soloCost: Math.round(soloCost), soloPlates,
      scrapPct: round((1 - grp.area / best.purchaseArea) * 100, 1),
    });
  });

  lines.sort((a, b) => a.gauge - b.gauge);

  const plates = lines.reduce((a, l) => a + l.plates, 0);
  const weight = lines.reduce((a, l) => a + l.weight, 0);
  const cost = lines.reduce((a, l) => a + l.cost, 0);
  const soloCost = lines.reduce((a, l) => a + l.soloCost, 0);
  const netArea = lines.reduce((a, l) => a + l.netArea, 0);
  const purchaseArea = lines.reduce((a, l) => a + l.purchaseArea, 0);

  return {
    lines, demand: demand.sort((a, b) => a.gauge - b.gauge || a.id.localeCompare(b.id)),
    plates, weight, cost, soloCost, saving: Math.round(soloCost - cost),
    netArea: round(netArea, 1), purchaseArea: round(purchaseArea, 1),
    scrapPct: round((1 - netArea / purchaseArea) * 100, 1),
    soloSavingPct: soloCost > 0 ? round(((soloCost - cost) / soloCost) * 100, 1) : 0,
  };
}

/* ─────────────────────── equipment part schedule (shop sheet) ─────────────────────── */

export interface EquipPartRow {
  part: string;
  qty: number;
  unit: string;
  material: string;
  note: string;
}

/** Part-by-part quantity sheet per equipment, laid out like the shop's equipment table. */
export function equipmentPartSchedule(c: VesselCalc): EquipPartRow[] {
  const v = c.vessel;
  const notes = v.notes.join(' ').toLowerCase();
  const nozzleQty = v.nozzles.filter((n) => n.nps < 18).reduce((a, n) => a + n.qty, 0);
  const manwayQty = v.nozzles.filter((n) => n.nps >= 18).reduce((a, n) => a + n.qty, 0);
  const courses = c.shell.courses.length + (c.shellTop?.courses.length ?? 0);
  const has = (s: string) => notes.includes(s);

  const rows: EquipPartRow[] = [
    {
      part: 'Shell', qty: courses, unit: 'course',
      material: 'SA-516 Gr.70',
      note: `${v.di}${v.diTop ? ` / ${v.diTop}` : ''} mm ID · t ${c.thk.tShell} mm (upper ${c.thk.tShellTop} mm)`,
    },
    {
      part: 'Vessel Head', qty: 2, unit: 'off',
      material: 'SA-516 Gr.70',
      note: `top ${v.headTop === 'FLAT' ? 'flat' : '2:1 ellip.'} ${c.thk.tHeadTop} mm · bottom ${v.headBot === 'FLAT' ? 'flat' : '2:1 ellip.'} ${c.thk.tHeadBot} mm`,
    },
  ];

  /* nozzle / manway breakdown — appended after `rows` exists to avoid a TDZ self-reference */
  v.nozzles.forEach((nz) => {
    const od = pipeOD(nz.nps);
    const wall = nz.nps >= 18
      ? Math.max(pipeWall(nz.nps, nz.cls ?? v.asmeClass), 16)
      : pipeWall(nz.nps, nz.cls ?? v.asmeClass);
    const cls = nz.cls ?? v.asmeClass;
    const isManway = nz.nps >= 18;
    const gasketOD = isManway ? od + 120 : od + 50;
    const gasketThk = isManway ? 6 : 3;
    const fastenerQty = isManway ? nz.qty * 8 : nz.qty * 4;
    if (isManway) {
      rows.push(
        { part: 'Manway Cover', qty: nz.qty, unit: 'off', material: 'SA-516 Gr.70', note: `NPS ${nz.nps} cover with davit lug` },
        { part: 'Gasket', qty: nz.qty, unit: 'off', material: '304 SS / SS-304', note: `OD ${round(gasketOD / 1000, 1)} mm · thickness ${gasketThk} mm` },
        { part: 'Fasteners', qty: fastenerQty, unit: 'off', material: 'S.S. Bolts Nuts', note: `${nz.qty} sets of M20 × 80 mm bolts & nuts` },
      );
    } else {
      rows.push(
        { part: 'Pipe', qty: nz.qty, unit: 'off', material: 'SA-106 Gr.B', note: `NPS ${nz.nps} · Sch.${wall} · OD ${round(od / 1000, 1)} in` },
        { part: 'Flange', qty: nz.qty, unit: 'off', material: 'SA-105 / WNRF', note: `NPS ${nz.nps} · CL${cls} RF` },
        { part: 'Gasket', qty: nz.qty, unit: 'off', material: 'Spiral Wound 304/304L + graphite', note: `NPS ${nz.nps} · CL${cls}` },
        { part: 'Fasteners', qty: nz.qty * 4, unit: 'off', material: 'S.S. Bolts Nuts', note: `${nz.qty} sets of M16 × 70 mm bolts & nuts` },
      );
    }
  });

  rows.push(
    { part: 'Manways (legacy)', qty: manwayQty, unit: 'off', material: 'SA-516 Gr.70 + forging', note: 'NPS 18 / 24 with cover, davit & gasket' },
    {
      part: 'External Support', qty: v.support === 'Saddles' ? 2 : v.support === 'Legs' ? 4 : 1, unit: 'off',
      material: v.support === 'Saddles' ? 'SA-516 Gr.70 + SA-304L wear plate' : 'SA-516 Gr.70 / SA-36',
      note: v.support === 'Saddles' ? 'fixed + sliding saddle' : v.support === 'Skirt' ? 'skirt with base ring' : 'legs with base plates',
    },
    {
      part: 'Transportation Saddles', qty: v.orientation === 'H' ? 0 : 2, unit: 'off',
      material: 'SA-36 + timber',
      note: v.orientation === 'H' ? 'not applicable — travels on its own saddles' : 'temporary shipping cradles, reusable',
    },
    {
      part: 'Ladders', qty: v.orientation === 'V' && v.tt > 2500 ? 1 : 0, unit: 'set', material: 'SA-36 / galvanised',
      note: v.orientation === 'H' ? 'by others — drum reached from structure'
        : v.tt > 2500 ? `${round(v.tt / 1000, 1)} m caged ladder + rest platforms` : 'not required',
    },
    {
      part: 'Platforms', qty: v.orientation === 'V' && v.tt > 6000 ? Math.ceil(v.tt / 6000) : 0, unit: 'off',
      material: 'SA-36 grating',
      note: v.orientation === 'H' ? 'by others — access from structure' : v.tt > 6000 ? 'at manways and level instruments' : 'not required',
    },
    {
      part: 'Internal Rungs', qty: v.trays ? v.trays : c.thk.external.ringsRequired, unit: v.trays ? 'ring' : 'ring',
      material: 'SA-516 Gr.70',
      note: v.trays ? 'tray support rings, 50 × 8 flats' : c.thk.external.ringsRequired > 0 ? 'vacuum stiffener rings' : 'not required',
    },
    { part: 'Baffles', qty: has('baffle') || ['Drum', 'Separator'].includes(v.kind) ? 1 : 0, unit: 'off', material: 'SA-516 Gr.70', note: has('baffle') ? 'per DWG 3-185 / 3-115' : ['Drum', 'Separator'].includes(v.kind) ? 'inlet baffle' : 'not required' },
    { part: 'Demisters', qty: has('mist eliminator') ? 1 : 0, unit: 'off', material: 'Alloy 400 / 304', note: has('mist eliminator') ? 'mist eliminator — by others, support by fabricator' : 'not required' },
    { part: 'Coalescers', qty: has('coalescer') ? 1 : 0, unit: 'off', material: 'Type 316', note: has('coalescer') ? 'coalescer 300 mm — by others' : 'not required' },
    { part: 'Vortex Breaker', qty: has('vortex') || ['Drum', 'Receiver'].includes(v.kind) ? 1 : 0, unit: 'off', material: 'SA-516 Gr.70', note: has('vortex') ? 'per DWG 3-123' : 'outlet protection' },
    { part: 'Boot', qty: v.dropLeg ? 1 : 0, unit: 'off', material: 'SA-516 Gr.70', note: v.dropLeg ? `${v.dropLeg.od} mm OD × ${fmt(v.dropLeg.tt)} mm, CA ${v.caLeg ?? v.ca} mm` : 'not required' },
    { part: 'Skirt Opening', qty: v.support === 'Skirt' ? 1 : 0, unit: 'off', material: '—', note: v.support === 'Skirt' ? 'NPS 20 access opening + cover in skirt' : 'not applicable' },
  );
  return rows;
}

/* ───────────────────────────── 3D geometry spec ───────────────────────────── */

export interface GeoNozzle {
  mark: string; nps: number; od: number; wall: number; y: number; angle: number;
  service: string; cls: number; manway: boolean;
}
export interface GeoCourse { h: number; pieces: number; t: number; upper: boolean }
export interface GeoSaddle { count: number; h: number; w: number; positions: number[] }

export interface VesselGeo {
  di: number; diTop: number; tt: number; tShell: number; tShellTop: number;
  tHeadTop: number; tHeadBot: number; headTop: 'SE' | 'FLAT' | 'CONE'; headBot: 'SE' | 'FLAT' | 'CONE';
  skirtH: number; support: string; nozzles: GeoNozzle[]; trayCount: number;
  stiffenerYs: number[]; dropLeg?: { od: number; tt: number; t: number };
  coneAt: number; hasCone: boolean; pwht: boolean; bedDepth?: number; lined: boolean;
  orientation: 'V' | 'H';
  /** Real plate courses from the nesting plan — drives course seams and longitudinal seam count. */
  courses: GeoCourse[];
  /** Total length over saddles/cradles in metres (for display in registers and reports). */
  totalLengthM: number;
  /** Permanent saddles for horizontal equipment (positions are fractions of T/T). */
  saddle?: GeoSaddle;
  /** Temporary transportation cradles — vertical equipment is shipped lying down. */
  shipping?: GeoSaddle;
  packingBeds?: number;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h / 997;
}

function serviceFraction(service: string): number {
  const s = service.toLowerCase();
  if (s.includes('ventilation')) return 0.955;
  if (s.includes('vapor outlet')) return 0.92;
  if (s.includes('reflux')) return 0.87;
  if (s.includes('relief') || s.includes('pg-pt') || s.includes('pt-pg') || s.includes('pg')) return 0.78;
  if (s.includes('inlet') || s.includes('feed')) return 0.56;
  if (s.includes('reboiler')) return 0.24;
  if (s.includes('bottom outlet')) return 0.03;
  if (s.includes('liquid outlet') || s.includes('water outlet') || s.includes('outlet')) return 0.05;
  if (s.includes('drain')) return 0.02;
  if (s.includes('steamout') || s.includes('blowdown') || s.includes('utility')) return 0.12;
  if (s.includes('level')) return 0.42;
  if (s.includes('ti')) return 0.62;
  if (s.includes('screen') || s.includes('withdrawal')) return 0.2;
  if (s.includes('manway') || s.includes('handhole')) return 0.5;
  if (s.includes('flange')) return 0.6;
  return 0.45;
}

/** Clock position of a nozzle around a horizontal drum, in the viewer's local axis frame.
 *  After the −90° roll the local 3π/2 direction points up and π/2 points down. */
function horizonAngle(service: string): number {
  const s = service.toLowerCase();
  if (s.includes('level') || s.includes('lt')) return 0;
  if (s.includes('liquid') || s.includes('water') || s.includes('bottom') || s.includes('hcbn')) return Math.PI / 2;
  if (s.includes('inlet') || s.includes('feed') || s.includes('reflux') || s.includes('reboiler')) return Math.PI * 1.5;
  return Math.PI * 1.5;
}

export function buildGeo(v: Vessel, c: VesselCalc): VesselGeo {
  const horiz = v.orientation === 'H';
  const geoNozzles: GeoNozzle[] = [];
  const manways: typeof v.nozzles = [];
  const others: typeof v.nozzles = [];
  v.nozzles.forEach((nz) => (nz.nps >= 18 ? manways : others).push(nz));

  manways.forEach((nz, i) => {
    const frac = manways.length === 1 ? 0.55 : 0.12 + (0.76 * i) / Math.max(1, manways.length - 1);
    geoNozzles.push({
      mark: nz.mark, nps: nz.nps, od: pipeOD(nz.nps) / 1000, wall: pipeWall(nz.nps, nz.cls ?? v.asmeClass) / 1000,
      y: frac * v.tt,
      angle: horiz ? Math.PI * 1.5 : (i % 2 === 0 ? 0 : Math.PI) + (i % 4 === 3 ? Math.PI / 2 : 0),
      service: nz.service, cls: nz.cls ?? v.asmeClass, manway: true,
    });
  });

  // horizontal drums: stack nozzles along the axis, spread around the shell
  const used: { y: number; a: number }[] = [];
  const seen: Record<number, number> = {};
  others.forEach((nz, i) => {
    const f = serviceFraction(nz.service);
    let y = Math.min(v.tt - 120, Math.max(120, v.tt * f + (hash(nz.mark) - 0.5) * v.tt * 0.06));
    let a = horiz ? horizonAngle(nz.service) : ((i * 137.5 + hash(nz.mark) * 90) * Math.PI) / 180;
    if (horiz) {
      // several nozzles on the same clock line must be spaced axially
      const k = (seen[a] ?? 0) + 1;
      seen[a] = k;
      let nudge = 0;
      while (used.some((u) => Math.abs(u.a - a) < 0.2 && Math.abs(u.y - y) < 260) && nudge < 12) {
        y += (nudge % 2 ? 1 : -1) * 180;
        nudge++;
      }
      y = Math.min(v.tt - 150, Math.max(150, y));
    } else {
      let tries = 0;
      while (used.some((u) => Math.abs(u.y - y) < 140 && Math.abs(((u.a - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.45) && tries < 12) {
        a += (Math.PI * 2) / 9;
        tries++;
      }
    }
    used.push({ y, a });
    geoNozzles.push({
      mark: nz.mark, nps: nz.nps, od: pipeOD(nz.nps) / 1000,
      wall: pipeWall(nz.nps, nz.cls ?? v.asmeClass) / 1000,
      y, angle: a, service: nz.service, cls: nz.cls ?? v.asmeClass, manway: false,
    });
  });

  const skirtH = v.support === 'Skirt' ? Math.max(1600, Math.min(4000, v.tt * 0.12))
    : v.support === 'Legs' ? 1200 : 0;
  const stiffenerYs: number[] = [];
  if (c.thk.external.ringsRequired > 0) {
    const n = c.thk.external.ringsRequired;
    for (let i = 1; i <= n; i++) stiffenerYs.push((v.tt * i) / (n + 1));
  }

  const R = v.di / 2;
  const sadW = Math.max(300, Math.round((R * 0.7) / 10) * 10);
  const sadH = Math.max(400, Math.round((R * 0.45) / 50) * 50);
  const twoDiameter = !!v.diTop && v.diTop !== v.di;
  const courses: GeoCourse[] = [
    ...c.shell.courses.map((x) => ({ h: x.height, pieces: x.pieces, t: x.thk, upper: false })),
    ...(c.shellTop ? c.shellTop.courses.map((x) => ({ h: x.height, pieces: x.pieces, t: x.thk, upper: true })) : []),
  ];

  return {
    di: v.di, diTop: v.diTop ?? v.di, tt: v.tt, tShell: c.thk.tShell, tShellTop: c.thk.tShellTop,
    tHeadTop: c.thk.tHeadTop, tHeadBot: c.thk.tHeadBot,
    headTop: v.headTop, headBot: v.headBot, skirtH, support: v.support,
    nozzles: geoNozzles, trayCount: v.trays ?? 0, stiffenerYs,
    dropLeg: v.dropLeg ? { od: v.dropLeg.od, tt: v.dropLeg.tt, t: Math.max(8, c.thk.tShell * 0.65) } : undefined,
    coneAt: v.tt * 0.55, hasCone: twoDiameter,
    pwht: c.pwht.active, bedDepth: v.bedDepth, lined: !!v.liner,
    orientation: v.orientation, courses,
    totalLengthM: v.orientation === 'H'
      ? (v.tt / 1000) + (sadW / 1000) * 2
      : 0
    };
  }

/* ───────────────────────────── fleet roll-up ───────────────────────────── */

export interface FleetRow {
  id: string; service: string; unit: string; kind: string; weight: number; plateT: number;
  weldM: number; ndtM: number; hours: number; cost: number; pwht: boolean; scrapPct: number; tShell: number; totalLengthM: number;
}

export function fleetRollup(calcs: VesselCalc[]): {
  rows: FleetRow[]; weight: number; plate: number; weldM: number; hours: number; cost: number;
  pwhtCount: number; scrapAvg: number; nozzles: number; area: number;
} {
  const rows: FleetRow[] = calcs.map((c) => ({
    id: c.vessel.id, service: c.vessel.service, unit: c.vessel.unit, kind: c.vessel.kind,
    weight: c.weight.total, plateT: round(c.weight.total / 1000, 2), weldM: c.calc.totalLengthM,
    ndtM: round(c.calc.totalLengthM * (c.thk.e >= 1 ? 1.14 : 0.52), 1),
    hours: c.manhours, cost: c.cost.total, pwht: c.pwht.active, scrapPct: c.shell.scrapPct, tShell: c.thk.tShell,
    totalLengthM: c.calc.totalLengthM,
  }));
  return {
    rows,
    weight: rows.reduce((a, r) => a + r.weight, 0),
    plate: rows.reduce((a, r) => a + r.plateT, 0),
    weldM: round(rows.reduce((a, r) => a + r.weldM, 0), 0),
    hours: rows.reduce((a, r) => a + r.hours, 0),
    cost: rows.reduce((a, r) => a + r.cost, 0),
    pwhtCount: rows.filter((r) => r.pwht).length,
    scrapAvg: round(rows.reduce((a, r) => a + r.scrapPct, 0) / Math.max(1, rows.length), 1),
    nozzles: calcs.reduce((a, c) => a + c.vessel.nozzles.reduce((b, nz) => b + nz.qty, 0), 0),
    area: round(calcs.reduce((a, c) => a + c.paintM2, 0), 0),
  };
}

export function fmt(n: number, d = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}
