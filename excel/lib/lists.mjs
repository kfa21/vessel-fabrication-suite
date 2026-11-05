import { C, newSheet, title, section, head, textCell, grid, definedName, font } from './style.mjs';

const GAUGES = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40, 45, 50, 56, 60, 65, 70, 80, 90, 100];
const STRESS = [
  [40, 138], [100, 138], [150, 138], [200, 138], [250, 138],
  [300, 132], [350, 126], [400, 120],
];
const NPS = [1, 1.5, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30];
const OD = [33.4, 48.3, 60.3, 88.9, 114.3, 168.3, 219.1, 273.0, 323.8, 355.6, 406.4, 457.0, 508.0, 610.0, 762.0];
const SCH20 = [2.77, 2.77, 2.77, 3.05, 3.05, 3.4, 3.76, 4.19, 4.57, 4.78, 4.78, 4.78, 5.54, 6.35, 6.35];
const SCH40 = [3.38, 3.68, 3.91, 5.49, 6.02, 7.11, 8.18, 9.27, 10.31, 11.13, 12.7, 14.27, 15.09, 17.48, 19.05];
const SCH80 = [4.55, 5.08, 5.54, 7.62, 8.56, 10.97, 12.7, 15.09, 17.48, 19.05, 21.44, 23.83, 26.19, 30.96, 33.32];

// Stud bolt table for ASME B16.5 flanges: count per flange, then bolt size.
const STUD_NPS = [1, 1.5, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24];
const CLASSES = [150, 300, 400, 600, 900, 1500, 2500];
const STUD_COUNTS = [
  [4, 4, 4, 4, 4, 4, 4],
  [4, 4, 4, 4, 4, 4, 4],
  [4, 8, 8, 8, 8, 8, 8],
  [4, 8, 8, 8, 8, 8, 8],
  [8, 8, 8, 8, 8, 8, 8],
  [8, 12, 12, 12, 12, 12, 12],
  [8, 12, 12, 12, 12, 12, 12],
  [12, 16, 16, 16, 16, 16, 16],
  [12, 16, 16, 20, 20, 20, 20],
  [12, 20, 20, 20, 20, 20, 20],
  [16, 20, 20, 20, 20, 20, 20],
  [16, 24, 24, 24, 24, 24, 24],
  [20, 24, 24, 24, 24, 24, 24],
  [20, 24, 24, 24, 24, 24, 24],
];
const STUD_DIA = ['M20', 'M20', 'M20', 'M20', 'M20', 'M20', 'M20', 'M24', 'M27', 'M30', 'M33', 'M33', 'M36', 'M39'];
const STUD_LEN = [70, 75, 75, 90, 90, 100, 110, 120, 130, 140, 150, 160, 170, 190];

// CL150 flange mass (kg), used with a class factor below.
const FLANGE_NPS = [1, 1.5, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 30];
const FLANGE_MASS = [2.2, 3.2, 5.0, 9.0, 14.0, 24.0, 36.0, 50.0, 68.0, 82.0, 100.0, 120.0, 145.0, 195.0, 265.0];

const RATES = [
  [49, 'Steel density', 7850, 'kg/m³', 'rho'],
  [50, 'Elastic modulus', 200000, 'MPa', 'e_mod'],
  [51, 'Yield strength', 260, 'MPa', 'yield_mpa'],
  [52, 'kg/cm² → MPa', 0.0980665, '', 'kgcm2_mpa'],
  [53, 'mm³ → kg', 0.00000785, '', 'mm3_to_kg'],
  [54, 'Weld deposition rate', 2.2, 'kg/h', 'dep_rate'],
  [55, 'Weld metal factor', 1.15, '', 'dep_factor'],
  [56, 'Packing density', 250, 'kg/m³', 'packing_rho'],
  [57, 'Tray mass', 45, 'kg/m²', 'tray_mass'],
  [58, 'Tray open-area factor', 0.55, '', 'tray_open'],
  [59, 'Tray ring mass', 7, 'kg/m²', 'ring_mass'],
  [60, 'Ladder base mass', 65, 'kg', 'ladder_kg'],
  [61, 'Ladder cage rate', 4, 'kg/m', 'cage_kgm'],
  [62, 'Lifting trunnion mass', 120, 'kg each', 'trunnion_kg'],
  [63, 'Attachment misc. mass', 12, 'kg', 'misc_kg'],
  [64, 'Transport saddle base', 450, 'kg', 'ts_base'],
  [65, 'Transport saddle length factor', 0.85, '', 'ts_len_factor'],
  [66, 'Transport saddle height factor', 0.3, '', 'ts_h_factor'],
];

const CLASSES_2 = [
  [71, 150, 1.0],
  [72, 300, 1.35],
  [73, 400, 1.5],
  [74, 600, 1.7],
  [75, 900, 2.0],
  [76, 1500, 2.6],
  [77, 2500, 3.6],
];

export function buildLists(wb) {
  const ws = newSheet(wb, 'Lists', [2, 12, 12, 14, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12], { tab: 'FF7F7F7F' });
  title(ws, 'Lists — lookup tables and rates', 'Edit these tables to revise the basis. Named ranges feed every formula, so a change here propagates through the workbook.', 'P');

  // Gauges
  head(ws, 4, 'B', 'B');
  ws.getCell('B4').value = 'Plate gauges';
  GAUGES.forEach((g, i) => textCell(ws, `B${5 + i}`, g, { align: 'center', fmt: '0' }));
  ws.getCell(`B${5 + GAUGES.length}`).value = 'mm';
  ws.getCell(`B${5 + GAUGES.length}`).font = font(8, false, C.muted, true);
  definedName(wb, 'Lists', `$B$5:$B$${4 + GAUGES.length}`, 'gauges');

  // Stress vs temperature
  head(ws, 4, 'D', 'E');
  ws.getCell('D4').value = 'Temp °C';
  ws.getCell('E4').value = 'S (MPa)';
  STRESS.forEach(([t, s], i) => {
    textCell(ws, `D${5 + i}`, t, { align: 'center', fmt: '0' });
    textCell(ws, `E${5 + i}`, s, { align: 'center', fmt: '0' });
  });
  definedName(wb, 'Lists', '$D$5:$D$12', 'stress_t');
  definedName(wb, 'Lists', '$E$5:$E$12', 'stress_s');

  // Pipe sizes and schedules
  head(ws, 4, 'G', 'H');
  ws.getCell('G4').value = 'NPS';
  ws.getCell('H4').value = 'OD (mm)';
  NPS.forEach((n, i) => {
    textCell(ws, `G${5 + i}`, n, { align: 'center' });
    textCell(ws, `H${5 + i}`, OD[i], { align: 'center', fmt: '0.0' });
  });
  definedName(wb, 'Lists', '$G$5:$G$19', 'nps_list');
  definedName(wb, 'Lists', '$H$5:$H$19', 'nps_od');

  head(ws, 4, 'J', 'M');
  ['NPS', 'Sch 20', 'Sch 40', 'Sch 80'].forEach((t, i) => {
    ws.getCell(`${'JKLM'[i]}4`).value = t;
  });
  NPS.forEach((n, i) => {
    textCell(ws, `J${5 + i}`, n, { align: 'center' });
    textCell(ws, `K${5 + i}`, SCH20[i], { align: 'center', fmt: '0.00' });
    textCell(ws, `L${5 + i}`, SCH40[i], { align: 'center', fmt: '0.00' });
    textCell(ws, `M${5 + i}`, SCH80[i], { align: 'center', fmt: '0.00' });
  });
  definedName(wb, 'Lists', '$K$5:$K$19', 'sch20');
  definedName(wb, 'Lists', '$L$5:$L$19', 'sch40');
  definedName(wb, 'Lists', '$M$5:$M$19', 'sch80');

  // Flange masses
  head(ws, 4, 'O', 'P');
  ws.getCell('O4').value = 'NPS';
  ws.getCell('P4').value = 'CL150 kg';
  FLANGE_NPS.forEach((n, i) => {
    textCell(ws, `O${5 + i}`, n, { align: 'center' });
    textCell(ws, `P${5 + i}`, FLANGE_MASS[i], { align: 'center', fmt: '0.0' });
  });
  definedName(wb, 'Lists', '$O$5:$O$19', 'flange_nps');
  definedName(wb, 'Lists', '$P$5:$P$19', 'flange_mass');

  // Stud bolts
  section(ws, 22, 'STUD BOLTS — NUMBER PER FLANGE AND SIZE (ASME B16.5)', 'E', 'N');
  const studHead = ['NPS', ...CLASSES.map((c) => c.toString()), 'Dia', 'Len (mm)'];
  head(ws, 23, 'E', 'N');
  studHead.forEach((t, i) => {
    ws.getCell(`${String.fromCharCode(69 + i)}23`).value = t;
  });
  STUD_NPS.forEach((n, r) => {
    const row = 24 + r;
    textCell(ws, `E${row}`, n, { align: 'center' });
    STUD_COUNTS[r].forEach((count, c) => {
      textCell(ws, `${String.fromCharCode(70 + c)}${row}`, count, { align: 'center', fmt: '0' });
    });
    textCell(ws, `M${row}`, STUD_DIA[r], { align: 'center' });
    textCell(ws, `N${row}`, STUD_LEN[r], { align: 'center', fmt: '0' });
  });
  definedName(wb, 'Lists', '$E$24:$E$37', 'stud_nps');
  definedName(wb, 'Lists', '$F$23:$L$23', 'stud_classes');
  definedName(wb, 'Lists', '$F$24:$L$37', 'stud_counts');
  definedName(wb, 'Lists', '$M$24:$M$37', 'stud_dia');
  definedName(wb, 'Lists', '$N$24:$N$37', 'stud_len');

  // Rates and constants
  section(ws, 39, 'RATES, DENSITIES AND WEIGHT CONSTANTS', 'B', 'D');
  head(ws, 40, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}40`).value = t;
  });
  RATES.forEach(([row, labelText, value, unit, name]) => {
    textCell(ws, `B${row}`, labelText, { bold: true });
    textCell(ws, `C${row}`, value, { align: 'right', fmt: value < 0.01 ? '0.0000000' : '0.00##' });
    textCell(ws, `D${row}`, unit, { align: 'center', color: C.muted, size: 9 });
    definedName(wb, 'Lists', `$C$${row}`, name);
  });

  // Plate stock
  section(ws, 67, 'PLATE STOCK', 'B', 'D');
  textCell(ws, 'B68', 'Plate width', { bold: true });
  textCell(ws, 'C68', 2000, { align: 'right', fmt: '#,##0' });
  textCell(ws, 'D68', 'mm', { align: 'center', color: C.muted, size: 9 });
  textCell(ws, 'B69', 'Plate length', { bold: true });
  textCell(ws, 'C69', 6000, { align: 'right', fmt: '#,##0' });
  textCell(ws, 'D69', 'mm', { align: 'center', color: C.muted, size: 9 });
  definedName(wb, 'Lists', '$C$68', 'plate_w');
  definedName(wb, 'Lists', '$C$69', 'plate_l');

  // Flange class factors
  head(ws, 70, 'B', 'C');
  ws.getCell('B70').value = 'Class';
  ws.getCell('C70').value = 'Factor';
  CLASSES_2.forEach(([row, cls, factor]) => {
    textCell(ws, `B${row}`, cls, { align: 'center' });
    textCell(ws, `C${row}`, factor, { align: 'center', fmt: '0.00' });
  });
  definedName(wb, 'Lists', '$B$71:$B$77', 'class_list');
  definedName(wb, 'Lists', '$C$71:$C$77', 'class_factor');

  textCell(ws, 'B79', 'Commercial rates and weld-procedure settings moved to the Rates sheet.', { bold: true, wrap: true, color: C.muted });
  ws.mergeCells('B79:D80');
  ws.getRow(79).height = 28;
}
