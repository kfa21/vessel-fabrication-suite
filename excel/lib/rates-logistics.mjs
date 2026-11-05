import {
  C, newSheet, title, section, head, inputCell, calcCell, textCell, noteRow, grid,
  definedName, listValidation, rangeValidation, colName,
} from './style.mjs';

// Raw-material sourcing basis. Columns: country, region, CS $/kg, SS $/kg,
// freight $/kg to Bahrain, duty %, clearance $, documents $, insurance %, lead days.
const COUNTRIES = [
  ['India', 'South Asia', 1.30, 4.90, 0.16, 5.0, 180, 120, 0.35, 35],
  ['China', 'East Asia', 1.28, 4.70, 0.20, 5.0, 220, 140, 0.35, 40],
  ['UAE', 'GCC', 1.45, 5.60, 0.06, 0.0, 120, 80, 0.25, 12],
  ['Saudi Arabia', 'GCC', 1.48, 5.70, 0.08, 0.0, 150, 90, 0.25, 14],
  ['Bahrain', 'GCC', 1.55, 5.90, 0.02, 0.0, 50, 40, 0.15, 3],
  ['Oman', 'GCC', 1.50, 5.75, 0.09, 0.0, 140, 90, 0.25, 10],
  ['Kuwait', 'GCC', 1.52, 5.80, 0.10, 0.0, 150, 90, 0.25, 8],
  ['Qatar', 'GCC', 1.50, 5.75, 0.08, 0.0, 140, 90, 0.25, 7],
  ['USA', 'North America', 1.65, 6.40, 0.34, 5.0, 260, 180, 0.40, 45],
  ['UK', 'Europe', 1.70, 6.60, 0.30, 5.0, 240, 160, 0.40, 40],
  ['Germany', 'Europe', 1.72, 6.70, 0.30, 5.0, 250, 170, 0.40, 42],
  ['Italy', 'Europe', 1.68, 6.50, 0.26, 5.0, 220, 150, 0.40, 35],
  ['Spain', 'Europe', 1.66, 6.45, 0.26, 5.0, 220, 150, 0.40, 36],
  ['Turkey', 'Europe / Asia', 1.58, 6.10, 0.18, 5.0, 190, 130, 0.35, 28],
];

// Export delivery basis. Columns: country, port, sea nm, road km from Bahrain,
// port-to-site km, land $/km, sea base $, sea $/t, customs %, duty %,
// insurance %, documents $, port handling $, clearance broker $.
const DESTINATIONS = [
  ['Saudi Arabia', 'Dammam', 120, 500, 25, 1.8, 900, 22, 0.0, 5.0, 0.30, 120, 350, 250],
  ['UAE', 'Jebel Ali', 300, 900, 30, 1.8, 1100, 24, 0.0, 5.0, 0.30, 120, 380, 260],
  ['Qatar', 'Hamad', 150, 700, 20, 1.9, 950, 23, 0.0, 5.0, 0.30, 120, 360, 250],
  ['Kuwait', 'Shuwaikh', 250, 650, 25, 1.9, 1000, 23, 0.0, 5.0, 0.30, 120, 360, 250],
  ['Oman', 'Sohar', 400, 1200, 30, 1.7, 1250, 25, 0.0, 5.0, 0.30, 130, 390, 260],
  ['Bahrain', 'Khalifa Bin Salman', 10, 40, 15, 1.6, 500, 18, 0.0, 0.0, 0.20, 80, 250, 180],
  ['Iraq', 'Umm Qasr', 500, 1800, 550, 2.2, 1800, 32, 5.0, 15.0, 0.60, 250, 650, 450],
  ['Jordan', 'Aqaba', 900, 2000, 330, 2.1, 2100, 34, 5.0, 15.0, 0.60, 240, 620, 430],
  ['Libya', 'Misrata', 1600, 0, 250, 2.4, 3200, 42, 5.0, 20.0, 0.70, 320, 800, 520],
  ['Egypt', 'Alexandria', 1300, 0, 220, 2.3, 2800, 38, 5.0, 20.0, 0.65, 300, 750, 480],
  ['Algeria', 'Algiers', 1500, 0, 400, 2.5, 3100, 41, 5.0, 20.0, 0.70, 310, 780, 500],
  ['Tunisia', 'Rades', 1400, 0, 350, 2.4, 2950, 40, 5.0, 20.0, 0.70, 300, 760, 490],
  ['Morocco', 'Casablanca', 3000, 0, 300, 2.4, 4200, 48, 5.0, 20.0, 0.75, 340, 850, 540],
];

// Shipping equipment. Columns: name, mode, max L/W/H (m), max t, base $,
// $/km, $/t, $/nm.
const EQUIPMENT = [
  ['Flatbed trailer 13.6 m', 'Land', 13.6, 2.5, 2.8, 25, 350, 1.6, 0, 0],
  ['Extendable flatbed 18 m', 'Land', 18.0, 3.0, 3.0, 35, 520, 2.1, 0, 0],
  ['Lowbed trailer 12 m', 'Land', 12.0, 3.2, 3.6, 60, 780, 2.8, 0, 0],
  ['Multi-axle hydraulic trailer', 'Land', 20.0, 4.0, 4.2, 120, 1450, 4.5, 0, 0],
  ['Custom heavy haul (permits)', 'Land', 45.0, 5.0, 5.0, 200, 3500, 6.5, 0, 0],
  ['20 ft flat rack', 'Sea', 6.0, 2.4, 2.6, 20, 1200, 0, 30, 0.50],
  ['40 ft flat rack', 'Sea', 12.0, 2.4, 2.6, 30, 1800, 0, 38, 0.40],
  ['40 ft high cube', 'Sea', 12.0, 2.35, 2.69, 26, 1400, 0, 26, 0.35],
  ['Breakbulk vessel', 'Sea', 40.0, 8.0, 8.0, 300, 6500, 0, 52, 1.20],
  ['Heavy-lift vessel', 'Sea', 60.0, 12.0, 12.0, 800, 18000, 0, 85, 2.20],
  ['Deck barge', 'Sea', 80.0, 20.0, 6.0, 1500, 24000, 0, 60, 1.80],
];

const range = (wb, sheet, from, to, name) => definedName(wb, sheet, `${from}:${to}`, name);

export function buildRates(wb) {
  const ws = newSheet(wb, 'Rates', [2, 46, 15, 16, 16, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15], {
    tab: C.amber, freeze: { y: 3 },
  });
  title(ws, 'Rates — commercial settings, weld procedure, sourcing and delivery',
    'Every yellow cell is an input. The shop rate is in BHD; material and freight rates are in USD and converted at the FX rate here.', 'O');

  const setting = (r, labelText, value, unit, name, fmt = '#,##0.00', note = '') => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    inputCell(ws, `C${r}`, value, fmt);
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    textCell(ws, `E${r}`, note, { wrap: true, color: C.muted, size: 9 });
    if (name) definedName(wb, 'Rates', `$C$${r}`, name);
  };

  section(ws, 4, '1 · COMMERCIAL SETTINGS', 'B', 'O');
  head(ws, 5, 'B', 'E');
  ['Item', 'Value', 'Unit', 'Basis'].forEach((t, i) => { ws.getCell(`${'BCDE'[i]}5`).value = t; });
  setting(6, 'Cost currency', 'BHD', '', '', 'General', 'Cost, labour and totals are presented in Bahraini dinar.');
  setting(7, 'Exchange rate — 1 USD in BHD', 0.376, 'BHD/USD', 'fx_bhd', '0.0000', 'BHD is pegged at 0.376 to the US dollar.');
  setting(8, 'Shop manhour rate', 2.00, 'BHD/h', 'rate_hour', '0.00', 'Your rate; override here and every labour line follows.');
  setting(9, 'Overtime multiplier', 1.25, '×', 'ot_factor', '0.00', 'Reference only, for shift planning.');
  setting(10, 'Cost contingency', 0, '%', 'contingency', '0.0', 'Added to the delivered total when non-zero.');
  setting(11, 'Fabrication margin', 0, '%', 'margin', '0.0', 'Commercial margin applied after fabrication.');

  section(ws, 13, '2 · MATERIAL, NDT AND FINISHING RATES (USD)', 'B', 'O');
  head(ws, 14, 'B', 'E');
  ['Item', 'Value', 'Unit', 'Basis'].forEach((t, i) => { ws.getCell(`${'BCDE'[i]}14`).value = t; });
  setting(15, 'Plate rate — carbon steel', 1.35, '$/kg', 'rate_plate_cs', '#,##0.00', 'Base mill price before fabrication factor.');
  setting(16, 'Plate rate — stainless', 5.80, '$/kg', 'rate_plate_ss', '#,##0.00', 'Used for SS parts and lining mass.');
  setting(17, 'Paint rate', 12.50, '$/m²', 'rate_paint', '#,##0.00', 'Surface preparation plus primer/topcoat.');
  setting(18, 'PWHT rate', 0.22, '$/kg', 'rate_pwht_kg', '#,##0.00', 'Charge weight basis.');
  setting(19, 'PWHT setup charge', 3400, '$', 'rate_pwht_setup', '#,##0', 'Furnace setup and chart.');
  setting(20, 'NDT — full RT', 58, '$/m', 'rate_ndt_full', '#,##0.00', 'Per metre of weld.');
  setting(21, 'NDT — spot RT', 34, '$/m', 'rate_ndt_spot', '#,##0.00', 'Per metre of weld.');
  setting(22, 'Weld consumables rate', 5.20, '$/kg', 'rate_consumable', '#,##0.00', 'Electrodes, wire, flux and gas per kg deposited.');
  setting(23, 'Internal lining rate', 45, '$/m²', 'rate_lining', '#,##0.00', 'Glass-flake / rubber lining.');

  section(ws, 25, '3 · PLATE AND COMPONENT COST FACTORS', 'B', 'O');
  head(ws, 26, 'B', 'C');
  ws.getCell('B26').value = 'Cost group';
  ws.getCell('C26').value = 'Factor';
  const GROUPS = [
    ['Shell', 1.08], ['Heads', 1.22], ['Nozzles', 2.60], ['Manways', 2.20],
    ['Internals', 1.40], ['Support', 1.00], ['Attachments', 1.00], ['Lining', 1.00],
  ];
  GROUPS.forEach(([group, factor], i) => {
    textCell(ws, `B${27 + i}`, group, { bold: true });
    inputCell(ws, `C${27 + i}`, factor, '0.00');
  });
  range(wb, 'Rates', '$B$27', '$B$34', 'mat_group');
  range(wb, 'Rates', '$C$27', '$C$34', 'mat_factor');

  section(ws, 36, '4 · WELDING PROCEDURE — LAYERS, JOINT TYPE AND BACK-GOUGING', 'B', 'O');
  head(ws, 37, 'B', 'E');
  ['Rule', 'Value', 'Unit', 'Application'].forEach((t, i) => { ws.getCell(`${'BCDE'[i]}37`).value = t; });
  setting(38, 'Root pass process', 'GTAW', '', 'root_process', 'General', 'All butt joints: GTAW root, then fill.');
  setting(39, 'Fill process — thickness ≤ threshold', 'SMAW', '', 'fill_low', 'General', 'Manual fill for plate up to the threshold.');
  setting(40, 'Fill process — thickness > threshold', 'SAW', '', 'fill_high', 'General', 'Automatic fill above the threshold.');
  setting(41, 'Fill process threshold', 20, 'mm', 'fill_threshold', '0', 'SMAW ≤ 20 mm; SAW > 20 mm.');
  setting(42, 'Double-V minimum thickness', 12, 'mm', 'doublev_min', '0', 'Code/access rule: double-V from 12 mm; single-V below.');
  setting(43, 'Root pass area', 12, 'mm²', 'root_area', '0.0', 'Root + hot pass cross-section.');
  setting(44, 'Back-gouge diameter threshold', 1200, 'mm', 'gouge_dia', '#,##0', 'Below: manual grinding. At/above: machine grinding.');
  setting(45, 'Back-gouging — manual grinding', 0.35, 'h/m', 'gouge_manual', '0.00', 'Single-V root preparation by hand.');
  setting(46, 'Back-gouging — machine grinding', 0.12, 'h/m', 'gouge_machine', '0.00', 'Machine/ARC gouging and grinding.');
  setting(47, 'GTAW deposition rate', 0.45, 'kg/h', 'rate_gtaw', '0.00', 'Root pass.');
  setting(48, 'SMAW deposition rate', 1.50, 'kg/h', 'rate_smaw', '0.00', 'Fill ≤ threshold.');
  setting(49, 'SAW deposition rate', 4.60, 'kg/h', 'rate_saw', '0.00', 'Fill > threshold.');
  setting(50, 'FCAW deposition rate', 2.40, 'kg/h', 'rate_fcaw', '0.00', 'Attachments and fillets.');
  setting(51, 'Arc-time factor', 1.55, '×', 'weld_arc_factor', '0.00', 'Arc hours → paid hours.');
  setting(52, 'Fit-up hours per metre', 0.90, 'h/m', 'weld_fit_h', '0.00', 'Alignment, tacks and cleaning.');
  setting(53, 'Handling hours per joint', 0.35, 'h', 'weld_joint_h', '0.00', 'Rigging and repositioning.');
  setting(54, 'Weld metal deposit factor', 1.06, '×', 'weld_factor', '0.00', 'Spatter, stub and profile allowance.');

  section(ws, 56, '5 · RAW MATERIAL SOURCING — COUNTRY LANDED-COST BASIS (USD)', 'B', 'O');
  const countryHead = ['Country', 'Region', 'CS $/kg', 'SS $/kg', 'Freight $/kg', 'Duty %', 'Clearance $', 'Documents $', 'Insurance %', 'Lead days'];
  head(ws, 57, 'B', 'K');
  countryHead.forEach((t, i) => { ws.getCell(`${colName(2 + i)}57`).value = t; });
  COUNTRIES.forEach((row, r) => {
    row.forEach((v, c) => {
      const cell = ws.getCell(`${colName(2 + c)}${58 + r}`);
      if (c === 0 || c === 1) textCell(ws, cell.address, v, { bold: c === 0, wrap: true });
      else inputCell(ws, cell.address, v, c <= 4 ? '#,##0.00' : c === 5 ? '0.0' : c === 9 ? '0' : '#,##0');
    });
    ws.getRow(58 + r).height = 20;
  });
  range(wb, 'Rates', '$B$58', '$B$71', 'src_country');
  range(wb, 'Rates', '$D$58', '$D$71', 'src_cs');
  range(wb, 'Rates', '$E$58', '$E$71', 'src_ss');
  range(wb, 'Rates', '$F$58', '$F$71', 'src_freight');
  range(wb, 'Rates', '$G$58', '$G$71', 'src_duty');
  range(wb, 'Rates', '$H$58', '$H$71', 'src_clear');
  range(wb, 'Rates', '$I$58', '$I$71', 'src_docs');
  range(wb, 'Rates', '$J$58', '$J$71', 'src_ins');
  range(wb, 'Rates', '$K$58', '$K$71', 'src_lead');

  section(ws, 73, '6 · EXPORT MARKETS — DELIVERY BASIS (USD)', 'B', 'O');
  const destHead = ['Country', 'Port', 'Sea nm', 'Road km', 'Port km', 'Land $/km', 'Sea base $', 'Sea $/t', 'Customs %', 'Duty %', 'Insurance %', 'Documents $', 'Handling $', 'Broker $'];
  head(ws, 74, 'B', 'O');
  destHead.forEach((t, i) => { ws.getCell(`${colName(2 + i)}74`).value = t; });
  DESTINATIONS.forEach((row, r) => {
    row.forEach((v, c) => {
      const cell = ws.getCell(`${colName(2 + c)}${75 + r}`);
      if (c === 0 || c === 1) textCell(ws, cell.address, v, { bold: c === 0, wrap: true });
      else inputCell(ws, cell.address, v, c <= 2 ? '#,##0' : c === 3 || c === 4 ? '#,##0' : c === 5 ? '0.00' : c <= 7 ? '#,##0' : c <= 10 ? '0.0' : '#,##0');
    });
    ws.getRow(75 + r).height = 20;
  });
  range(wb, 'Rates', '$B$75', '$B$87', 'dest_country');
  range(wb, 'Rates', '$C$75', '$C$87', 'dest_port');
  range(wb, 'Rates', '$D$75', '$D$87', 'dest_nm');
  range(wb, 'Rates', '$E$75', '$E$87', 'dest_road');
  range(wb, 'Rates', '$F$75', '$F$87', 'dest_port_km');
  range(wb, 'Rates', '$G$75', '$G$87', 'dest_land_km');
  range(wb, 'Rates', '$H$75', '$H$87', 'dest_sea_base');
  range(wb, 'Rates', '$I$75', '$I$87', 'dest_sea_t');
  range(wb, 'Rates', '$J$75', '$J$87', 'dest_customs');
  range(wb, 'Rates', '$K$75', '$K$87', 'dest_duty');
  range(wb, 'Rates', '$L$75', '$L$87', 'dest_ins');
  range(wb, 'Rates', '$M$75', '$M$87', 'dest_docs');
  range(wb, 'Rates', '$N$75', '$N$87', 'dest_handling');
  range(wb, 'Rates', '$O$75', '$O$87', 'dest_broker');

  section(ws, 89, '7 · SHIPPING EQUIPMENT — CAPACITY AND RATE', 'B', 'O');
  const eqHead = ['Equipment', 'Mode', 'Max L (m)', 'Max W (m)', 'Max H (m)', 'Max t', 'Base $', '$/km', '$/t', '$/nm'];
  head(ws, 90, 'B', 'M');
  eqHead.forEach((t, i) => { ws.getCell(`${colName(2 + i)}90`).value = t; });
  EQUIPMENT.forEach((row, r) => {
    row.forEach((v, c) => {
      const cell = ws.getCell(`${colName(2 + c)}${91 + r}`);
      if (c <= 1) textCell(ws, cell.address, v, { bold: c === 0, wrap: true });
      else inputCell(ws, cell.address, v, c <= 6 ? '#,##0.0' : '#,##0.00');
    });
    ws.getRow(91 + r).height = 20;
  });
  range(wb, 'Rates', '$B$91', '$B$101', 'eq_name');
  range(wb, 'Rates', '$C$91', '$C$101', 'eq_mode');
  range(wb, 'Rates', '$D$91', '$D$101', 'eq_l');
  range(wb, 'Rates', '$E$91', '$E$101', 'eq_w');
  range(wb, 'Rates', '$F$91', '$F$101', 'eq_h');
  range(wb, 'Rates', '$G$91', '$G$101', 'eq_t');
  range(wb, 'Rates', '$H$91', '$H$101', 'eq_base');
  range(wb, 'Rates', '$I$91', '$I$101', 'eq_km');
  range(wb, 'Rates', '$J$91', '$J$101', 'eq_ton');
  range(wb, 'Rates', '$K$91', '$K$101', 'eq_nm');

  // Equipment fit scores: first suitable unit wins; 999999 means "does not fit".
  EQUIPMENT.forEach((_, r) => {
    const row = 91 + r;
    calcCell(ws, `L${row}`,
      `=IF($C${row}<>"Land",999999,IF(AND($D${row}>=Logistics!$C$8,$E${row}>=Logistics!$C$9,$F${row}>=Logistics!$C$10,$G${row}>=Logistics!$C$11),$D${row}*1000+$E${row}*10+ROW()/1000,999999))`,
      '#,##0.000', { align: 'right', size: 9 });
    calcCell(ws, `M${row}`,
      `=IF($C${row}<>"Sea",999999,IF(AND($D${row}>=Logistics!$C$8,$E${row}>=Logistics!$C$9,$F${row}>=Logistics!$C$10,$G${row}>=Logistics!$C$11),$D${row}*1000+$E${row}*10+ROW()/1000,999999))`,
      '#,##0.000', { align: 'right', size: 9 });
  });
  head(ws, 90, 'L', 'M');
  ws.getCell('L90').value = 'Land fit';
  ws.getCell('M90').value = 'Sea fit';
  range(wb, 'Rates', '$L$91', '$L$101', 'eq_land_score');
  range(wb, 'Rates', '$M$91', '$M$101', 'eq_sea_score');

  noteRow(ws, 103, 'B', 'O', 'Sourcing and delivery rates are budgetary. Replace them with your live quotations: material price by mill/country, freight per kg, duty and clearance, insurance, documentation, port handling and the destination delivery rate. The equipment table is filtered by cargo length, width, height and weight on the Logistics sheet, so the cheapest suitable unit is selected automatically.');

  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.printArea = 'A1:O103';
}

export function buildLogistics(wb) {
  const ws = newSheet(wb, 'Logistics', [2, 42, 16, 12, 64, 14, 14, 14, 14, 14, 14, 14], { tab: C.amber, freeze: { y: 3 } });
  title(ws, 'Logistics — raw-material import and finished-goods delivery',
    'Choose the destination and mode; the sheet selects the transport unit from its dimensions and weight, then builds the landed import and export cost.', 'L');

  section(ws, 4, 'EXPORT SHIPMENT — CARGO, ROUTE AND EQUIPMENT', 'B', 'L');
  head(ws, 5, 'B', 'E');
  ['Field', 'Value', 'Unit', 'Basis / note'].forEach((t, i) => { ws.getCell(`${'BCDE'[i]}5`).value = t; });

  const input = (r, labelText, value, unit, note, items) => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    const c = inputCell(ws, `C${r}`, value);
    if (items) listValidation(c, items);
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    textCell(ws, `E${r}`, note, { wrap: true, color: C.muted, size: 9 });
    ws.getRow(r).height = 22;
  };
  const calc = (r, labelText, formula, unit, note, fmt = '#,##0.00') => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right', bold: true });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    textCell(ws, `E${r}`, note, { wrap: true, color: C.muted, size: 9 });
    ws.getRow(r).height = 22;
  };

  input(6, 'Destination country', 'Saudi Arabia', '', 'Client delivery country; drives the route, duty and clearance.', null);
  rangeValidation(ws.getCell('C6'), 'dest_country');
  input(7, 'Shipping mode', 'Auto', '', 'Auto = road for GCC, land+sea elsewhere.', ['Auto', 'Land', 'Sea', 'Land+Sea']);
  calc(8, 'Cargo length', '=(in_tt+IF(in_orient="V",Weights!C26,0)+IF(in_drop_od>0,in_drop_len,0)+0.5*in_di)/1000', 'm', 'Overall length shipped horizontally, including skirt and heads.', '0.00');
  calc(9, 'Cargo width', '=(in_di+2*MAX(t_shell,t_head_bot)+600)/1000', 'm', 'Shell OD plus saddles and attachments.', '0.00');
  calc(10, 'Cargo height', '=(in_di+2*MAX(t_shell,t_head_bot)+900)/1000', 'm', 'Shell OD plus transport saddles and lugs.', '0.00');
  calc(11, 'Cargo weight', '=w_total/1000', 't', 'Fabricated weight from the Weights sheet.', '0.00');
  calc(12, 'Cargo volume', '=C8*C9*C10', 'm³', 'Bounding volume.', '0.00');
  calc(13, 'Freight ton', '=MAX(C11,C12/3)', 't', 'Weight or volume at 3 m³ per tonne, whichever governs.', '0.00');
  calc(14, 'Selected sea unit', '=IF(MIN(eq_sea_score)>=999999,"—",INDEX(eq_name,MATCH(MIN(eq_sea_score),eq_sea_score,0)))', '', 'Smallest sea unit that fits the cargo.', 'General');
  calc(15, 'Selected land unit', '=IF(MIN(eq_land_score)>=999999,"—",INDEX(eq_name,MATCH(MIN(eq_land_score),eq_land_score,0)))', '', 'Smallest road unit that fits the cargo.', 'General');
  calc(16, 'Sea trips', '=IF(C14="—",0,MAX(1,ROUNDUP(C11/INDEX(eq_t,C36),0)))', 'trips', 'Based on the selected sea unit capacity.', '0');
  calc(17, 'Road trips', '=IF(C15="—",0,MAX(1,ROUNDUP(C11/C43,0)))', 'trips', 'Based on the selected road unit capacity.', '0');

  section(ws, 19, 'EXPORT COST — LAND + SEA (USD, THEN BHD)', 'B', 'L');
  head(ws, 20, 'B', 'E');
  ['Cost line', 'Amount', 'Unit', 'Basis'].forEach((t, i) => { ws.getCell(`${'BCDE'[i]}20`).value = t; });
  const costLine = (r, labelText, formula, unit, note, fmt = '"$"#,##0') => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right', bold: true });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    textCell(ws, `E${r}`, note, { wrap: true, color: C.muted, size: 9 });
    ws.getRow(r).height = 22;
  };
  costLine(21, 'Origin inland haul — works to port', '=IF(C34="Land",(C41+C42*INDEX(dest_road,C35))*C17,(C41+C42*25)*C17)', '$', 'Selected road unit; 25 km to Khalifa Bin Salman port.');
  costLine(22, 'Ocean freight — port to port', '=IF(OR(C34="Sea",C34="Land+Sea"),(C38+C39*C11+C40*INDEX(dest_nm,C35))*C16,0)', '$', 'Selected sea unit, weight and sea distance.');
  costLine(23, 'Destination inland haul', '=IF(C34="Land+Sea",(C41+C42*INDEX(dest_port_km,C35))*C17,0)', '$', 'Port to site in the client country.');
  costLine(24, 'Port handling and stevedoring', '=IF(OR(C34="Sea",C34="Land+Sea"),INDEX(dest_handling,C35)*C16,0)', '$', 'Lift-on/lift-off, wharfage and storage.');
  costLine(25, 'Customs clearance / broker', '=INDEX(dest_broker,C35)*MAX(1,C16)', '$', 'Import broker and clearance formalities.');
  costLine(26, 'Import duty', '=INDEX(dest_duty,C35)/100*SUM(Cost!$F$6:$F$18)/fx_bhd', '$', 'Destination duty on the fabricated value.');
  costLine(27, 'Cargo insurance', '=(SUM(Cost!$F$6:$F$18)/fx_bhd+C21+C22+C23+C24+C25+C26)*INDEX(dest_ins,C35)/100', '$', 'Marine/road transit cover on value plus freight.');
  costLine(28, 'Documentation', '=INDEX(dest_docs,C35)*MAX(1,C16)', '$', 'Certificate of origin, packing list, BL and legalisation.');
  costLine(29, 'TOTAL EXPORT LOGISTICS', '=SUM(C21:C28)', '$', 'Landed at the client site, before contingency and margin.');
  costLine(30, 'TOTAL EXPORT LOGISTICS', '=C29*fx_bhd', 'BHD', 'Converted at the Rates FX rate.', '"BD "#,##0');

  section(ws, 32, 'CALCULATION HELPERS', 'B', 'L');
  head(ws, 33, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => { ws.getCell(`${'BCD'[i]}33`).value = t; });
  const helper = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
  };
  helper(34, 'Resolved shipping mode', '=IF(C7="Auto",IF(OR(C6="Bahrain",C6="Saudi Arabia",C6="UAE",C6="Qatar",C6="Kuwait",C6="Oman"),"Land","Land+Sea"),C7)', '', 'General');
  helper(35, 'Destination row', '=IFERROR(MATCH(C6,dest_country,0),1)', '', '0');
  helper(36, 'Sea equipment row', '=IFERROR(MATCH(C14,eq_name,0),1)', '', '0');
  helper(37, 'Land equipment row', '=IFERROR(MATCH(C15,eq_name,0),1)', '', '0');
  helper(38, 'Sea unit base', '=INDEX(eq_base,C36)', '$', '#,##0');
  helper(39, 'Sea unit $/t', '=INDEX(eq_ton,C36)', '$/t');
  helper(40, 'Sea unit $/nm', '=INDEX(eq_nm,C36)', '$/nm');
  helper(41, 'Road unit base', '=INDEX(eq_base,C37)', '$', '#,##0');
  helper(42, 'Road unit $/km', '=INDEX(eq_km,C37)', '$/km');
  helper(43, 'Road unit capacity', '=INDEX(eq_t,C37)', 't', '#,##0');

  section(ws, 45, 'RAW MATERIAL IMPORT — LANDED COST BY SOURCE COUNTRY', 'B', 'L');
  head(ws, 46, 'B', 'L');
  ['Country', 'Weight (kg)', 'Material $', 'Freight $', 'Duty $', 'Insurance $', 'Clearance $', 'Landed $', 'Landed BHD', '$/kg', 'Lead days', 'Share'].forEach((t, i) => {
    ws.getCell(`${colName(2 + i)}46`).value = t;
  });
  COUNTRIES.forEach((row, i) => {
    const r = 47 + i;
    textCell(ws, `B${r}`, row[0], { bold: true });
    calcCell(ws, `C${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$G$6:$G$25)`, '#,##0', { align: 'right' });
    calcCell(ws, `D${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$L$6:$L$25)`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `E${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$M$6:$M$25)`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `F${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$N$6:$N$25)`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `G${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$O$6:$O$25)`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `H${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$P$6:$P$25)`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `I${r}`, `=SUMIF(Components!$J$6:$J$25,$B${r},Components!$Q$6:$Q$25)`, '"$"#,##0', { align: 'right', bold: true });
    calcCell(ws, `J${r}`, `=I${r}*fx_bhd`, '"BD "#,##0', { align: 'right' });
    calcCell(ws, `K${r}`, `=IF(C${r}>0,I${r}/C${r},0)`, '"$"#,##0.00', { align: 'right' });
    calcCell(ws, `L${r}`, `=INDEX(src_lead,MATCH($B${r},src_country,0))`, '0', { align: 'center' });
    calcCell(ws, `M${r}`, `=IF(SUM($C$47:$C$60)>0,C${r}/SUM($C$47:$C$60),0)`, '0.0%', { align: 'center' });
    ws.getRow(r).height = 20;
  });
  textCell(ws, 'B61', 'TOTAL IMPORTED MATERIAL', { bold: true, fill: C.pale, size: 11 });
  for (const col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
    const fmt = col === 'C' ? '#,##0' : col === 'J' ? '"BD "#,##0' : '"$"#,##0';
    calcCell(ws, `${col}61`, `=SUM(${col}47:${col}60)`, fmt, { bold: true, fill: C.pale, align: 'right' });
  }
  calcCell(ws, 'K61', '=IF(C61>0,I61/C61,0)', '"$"#,##0.00', { bold: true, fill: C.pale, align: 'right' });
  textCell(ws, 'L61', '', { fill: C.pale });
  textCell(ws, 'M61', '=IF(J61>0,J61/J61,0)', '0.0%', { fill: C.pale });

  section(ws, 63, 'COST FLOW — FABRICATION, IMPORT AND DELIVERY', 'B', 'L');
  head(ws, 64, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => { ws.getCell(`${'BCD'[i]}64`).value = t; });
  const flow = (r, labelText, formula, unit, fmt = '"BD "#,##0') => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right', bold: true });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    ws.getRow(r).height = 22;
  };
  flow(65, 'Raw material landed', '=J61', 'BHD');
  flow(66, 'Finished-goods export logistics', '=C30', 'BHD');
  flow(67, 'TOTAL FABRICATED + DELIVERED', '=Cost!F20', 'BHD');
  flow(68, 'Import content of fabricated cost', '=IF(Cost!F20>0,SUM(Cost!F6:F13)/Cost!F20,0)', '%', '0.0%');
  flow(69, 'Export logistics share', '=IF(Cost!F20>0,C30/Cost!F20,0)', '%', '0.0%');
  flow(70, 'Lowest landed material rate', '=IFERROR(SMALL($K$47:$K$60,COUNTIF($K$47:$K$60,0)+1),0)', '$/kg', '"$"#,##0.00');
  flow(71, 'Highest landed material rate', '=MAX(K47:K60)', '$/kg', '"$"#,##0.00');

  noteRow(ws, 73, 'B', 'L', 'The import table follows the source country selected on each Components row. Landed cost = mill price × cost-group factor + freight + duty + insurance + allocated clearance/documents. Export cost uses the destination market table, the selected road/sea units and the fabricated value; duty and insurance are calculated on that value, so the result is a delivered budget, not a customs ruling.');

  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.printArea = 'A1:M73';
}
