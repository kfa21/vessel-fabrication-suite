import { C, newSheet, title, section, head, calcCell, textCell, noteRow, grid, definedName } from './style.mjs';

export function buildWeld(wb) {
  const ws = newSheet(wb, 'Weld', [2, 44, 7, 30, 7, 10, 8, 18, 10, 12, 12], { tab: C.navy, freeze: { y: 5 } });
  title(ws, 'Weld — joint schedule, weld metal and deposition hours', 'Weld metal drives consumables and fabrication labour on the Cost sheet.', 'K');

  section(ws, 4, 'WELD SCHEDULE', 'B', 'K');
  head(ws, 5, 'B', 'K');
  ['Joint', 'Cat', 'Type', 'Qty', 'Length (m)', 'Thk (mm)', 'Process', 'Groove area (mm²)', 'Weld metal (kg)', 'Hours (arc + fit-up)'].forEach((t, i) => {
    ws.getCell(`${'BCDEFGHIJK'[i]}5`).value = t;
  });

  const joint = (r, name, cat, type, qty, length, thk, process, groove) => {
    textCell(ws, `B${r}`, name, { bold: true, wrap: true });
    textCell(ws, `C${r}`, cat, { align: 'center' });
    textCell(ws, `D${r}`, type, { wrap: true, size: 9 });
    if (typeof qty === 'string' && qty.startsWith('=')) calcCell(ws, `E${r}`, qty, '0', { align: 'center' });
    else textCell(ws, `E${r}`, qty, { align: 'center' });
    calcCell(ws, `F${r}`, length, '#,##0.0', { align: 'right' });
    calcCell(ws, `G${r}`, thk, '0.0', { align: 'center' });
    textCell(ws, `H${r}`, process, { align: 'center', size: 9 });
    calcCell(ws, `I${r}`, groove, '#,##0.0', { align: 'right' });
    calcCell(ws, `J${r}`, `=F${r}*1000*I${r}*weld_factor*mm3_to_kg`, '#,##0.0', { align: 'right' });
    calcCell(ws, `K${r}`,
      `=J${r}/IF(H${r}="SAW",rate_saw,IF(H${r}="FCAW",rate_fcaw,IF(H${r}="GTAW",rate_gtaw,rate_smaw)))*weld_arc_factor+F${r}*weld_fit_h+E${r}*weld_joint_h`,
      '#,##0.0', { align: 'right' });
    ws.getRow(r).height = 26;
  };

  joint(6, 'Long seams — lower shell', 'A', 'Double-V butt', 2, '=2*lower_len/1000', '=t_shell', 'SAW',
    '=IF(G6<=12,G6^2*0.5,G6^2*0.35)');
  joint(7, 'Circumferential seams — lower shell', 'A', 'Double-V butt', '=IF(in_ditop>0,3,2)',
    '=PI()*(in_di/1000)*E7', '=t_shell', 'SAW', '=IF(G7<=12,G7^2*0.5,G7^2*0.35)');
  joint(8, 'Long seams — upper shell', 'A', 'Double-V butt', '=IF(in_ditop>0,2,0)', '=E8*upper_len/1000',
    '=t_shell_top', 'SAW', '=IF(G8<=12,G8^2*0.5,G8^2*0.35)');
  joint(9, 'Circumferential seams — upper shell', 'A', 'Double-V butt', '=IF(in_ditop>0,2,0)',
    '=PI()*(in_ditop/1000)*E9', '=t_shell_top', 'SAW', '=IF(G9<=12,G9^2*0.5,G9^2*0.35)');
  joint(10, 'Cone seams', 'A', 'Double-V butt', '=IF(in_ditop>0,2,0)',
    '=PI()*((in_di+in_ditop)/2/1000)*E10', '=t_cone', 'SAW', '=IF(G10<=12,G10^2*0.5,G10^2*0.35)');
  joint(11, 'Head-to-shell seams', 'A', 'Single-V butt', 2,
    '=PI()*((in_di+2*in_ca)/1000)+PI()*((IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/1000)',
    '=(t_head_top+t_head_bot)/2', 'GTAW + SAW', '=G11^2*0.5');
  joint(12, 'Nozzle and manway welds', 'B', 'Full-penetration + fillet', '=COUNTIF(Nozzles!$D$6:$D$25,">0")',
    '=2*SUM(Nozzles!$K$6:$K$25)/1000', '=t_shell', 'GTAW', '=G12^2*0.5');
  joint(13, 'Support, pad, tray-ring and attachment welds', 'C', 'Fillet', 1,
    '=PI()*(in_di+2*t_shell)/1000+2*(in_tt/1000)+in_trays*PI()*(in_di/1000)+2*(in_tt/1000)', '=MAX(6,t_shell*0.5)', 'FCAW', '=G13^2*0.4');

  textCell(ws, 'B14', 'TOTAL', { bold: true, fill: C.pale, size: 11 });
  calcCell(ws, 'F14', '=SUM(F6:F13)', '#,##0.0', { bold: true, fill: C.pale });
  calcCell(ws, 'J14', '=SUM(J6:J13)', '#,##0.0', { bold: true, fill: C.pale });
  calcCell(ws, 'K14', '=SUM(K6:K13)', '#,##0.0', { bold: true, fill: C.pale });
  for (const ref of ['B14', 'C14', 'D14', 'E14', 'F14', 'G14', 'H14', 'I14', 'J14', 'K14']) grid(ws.getCell(ref), { fill: C.pale, bold: true });

  section(ws, 16, 'WELD SUMMARY', 'B', 'D');
  head(ws, 17, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}17`).value = t;
  });
  const helper = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
  };
  helper(18, 'Total weld length', '=F14', 'm');
  helper(19, 'Total weld metal', '=J14', 'kg');
  helper(20, 'Total weld hours', '=K14', 'h');
  helper(21, 'Weld length per tonne', '=F14/(w_total/1000)', 'm/t');
  helper(22, 'Average deposition rate', '=J14/(K14+0.0001)', 'kg/h', '0.00');

  noteRow(ws, 24, 'B', 'K', 'Weld lengths are geometric estimates: seam counts assume a two-course shell with a cone, one head seam per head and two girth welds per nozzle. Metal mass uses a simplified groove area (double-V ≈ 0.35–0.5 t²) and a 1.06 deposit factor. Hours follow the app model: arc time × 1.55 + 0.9 h/m fit-up + 0.35 h per joint. Use the actual WPS and weld map for fabrication.');

  definedName(wb, 'Weld', '$F$14', 'weld_length');
  definedName(wb, 'Weld', '$J$14', 'weld_metal');
  definedName(wb, 'Weld', '$K$14', 'weld_hours');
}

export function buildCost(wb) {
  const ws = newSheet(wb, 'Cost', [2, 38, 34, 12, 12, 15, 10], { tab: C.navy, freeze: { y: 5 } });
  title(ws, 'Cost — material, labour, NDT, PWHT and paint', 'Rates live on the Lists sheet. Currency is USD. The model mirrors the app’s cost build-up.', 'G');

  section(ws, 4, 'COST BUILD-UP', 'B', 'G');
  head(ws, 5, 'B', 'G');
  ['Item', 'Basis', 'Qty', 'Rate', 'Amount (USD)', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCDEFG'[i]}5`).value = t;
  });

  const line = (r, name, basis, qty, rate, amount, unit) => {
    textCell(ws, `B${r}`, name, { bold: true, wrap: true });
    textCell(ws, `C${r}`, basis, { wrap: true, color: C.muted, size: 9 });
    calcCell(ws, `D${r}`, qty, '#,##0.0', { align: 'right' });
    if (typeof rate === 'string' && rate.startsWith('=')) calcCell(ws, `E${r}`, rate, '#,##0.00', { align: 'right' });
    else textCell(ws, `E${r}`, rate, { align: 'right', fmt: '#,##0.00' });
    calcCell(ws, `F${r}`, amount, '"$"#,##0', { align: 'right', bold: true });
    textCell(ws, `G${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    ws.getRow(r).height = 24;
  };

  line(6, 'Plate — shell courses', 'Weight × plate rate × 1.08 fabrication factor',
    '=w_shell_lower+w_shell_upper', '=rate_plate_cs*plate_factor_shell', '=D6*E6', 'kg');
  line(7, 'Plate — heads', 'Weight × plate rate × 1.22 for formed heads',
    '=w_head_top+w_head_bot', '=rate_plate_cs*plate_factor_heads', '=D7*E7', 'kg');
  line(8, 'Plate — process nozzles', 'Weight × plate rate × 2.6 for necks, flanges and pads',
    '=w_nozzles', '=rate_plate_cs*plate_factor_nozzle', '=D8*E8', 'kg');
  line(9, 'Plate — manways', 'Weight × plate rate × 2.2 for manway assemblies',
    '=w_manways', '=rate_plate_cs*plate_factor_manway', '=D9*E9', 'kg');
  line(10, 'Plate — internals', 'Weight × plate rate × 1.4 for trays, rings and breaker',
    '=w_trays+w_packing+w_vortex', '=rate_plate_cs*plate_factor_internals', '=D10*E10', 'kg');
  line(11, 'Plate — permanent support', 'Skirt, base ring or saddles',
    '=w_support', '=rate_plate_cs', '=D11*E11', 'kg');
  line(12, 'Plate — attachments', 'Ladder, rings, trunnions, transport saddles, stiffeners',
    '=w_attachments+w_stiffeners+w_transport', '=rate_plate_cs', '=D12*E12', 'kg');
  line(13, 'Internal lining', 'Stainless lining rate; zero when unlined',
    '=w_lining', '=rate_plate_ss', '=D13*E13', 'kg');
  line(14, 'Weld consumables', 'Weld metal from the Weld sheet',
    '=weld_metal', '=rate_consumable', '=D14*E14', 'kg');
  line(15, 'Fabrication labour', 'Weld hours + fitting, nozzles and trays',
    '=C28', '=rate_hour', '=D15*E15', 'h');
  line(16, 'NDT — radiography', 'Weld length × RT rate + 900 base + 750 for wet H2S',
    '=weld_length', '=IF(in_rt="Full",rate_ndt_full,IF(in_rt="Spot",rate_ndt_spot,0))', '=D16*E16+900+IF(in_h2s="Yes",750,0)', 'm');
  line(17, 'Post-weld heat treatment', 'Setup + charge weight + furnace hours; zero when not required',
    '=IF(in_pwht="Yes",w_total,0)', '=rate_pwht_kg', '=IF(in_pwht="Yes",rate_pwht_setup+D17*E17+C27*120,0)', 'kg');
  line(18, 'Surface preparation and paint', 'External area from the Weights sheet',
    '=area_total', '=rate_paint', '=D18*E18', 'm²');

  textCell(ws, 'B19', 'TOTAL FABRICATED COST', { bold: true, fill: C.pale, size: 11 });
  calcCell(ws, 'F19', '=SUM(F6:F18)', '"$"#,##0', { bold: true, fill: C.pale, align: 'right' });
  textCell(ws, 'G19', 'USD', { fill: C.pale, bold: true, align: 'center' });
  for (const ref of ['B19', 'C19', 'D19', 'E19', 'F19', 'G19']) grid(ws.getCell(ref), { fill: C.pale, bold: true });

  textCell(ws, 'B20', 'Cost per kilogram', { bold: true });
  textCell(ws, 'C20', 'Total fabricated cost ÷ total weight', { color: C.muted, size: 9 });
  calcCell(ws, 'F20', '=F19/w_total', '"$"#,##0.00', { align: 'right', bold: true });
  textCell(ws, 'G20', '$/kg', { align: 'center', color: C.muted, size: 9 });

  textCell(ws, 'B21', 'Manhours', { bold: true });
  textCell(ws, 'C21', 'Weld hours + 120 + 12 h per nozzle + 9 h per tray + 40 h PWHT', { color: C.muted, size: 9, wrap: true });
  calcCell(ws, 'F21', '=C28', '#,##0', { align: 'right', bold: true });
  textCell(ws, 'G21', 'h', { align: 'center', color: C.muted, size: 9 });

  section(ws, 23, 'MANHOUR AND PWHT HELPERS', 'B', 'D');
  head(ws, 24, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}24`).value = t;
  });
  const helper = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
  };
  helper(25, 'PWHT heat / cool rate', '=MAX(28,222/(MAX(t_shell,t_head_bot,t_head_top)/25.4))', '°C/h', '#,##0');
  helper(26, 'PWHT hold time', '=MAX(1,MAX(t_shell,t_head_bot,t_head_top)/25.4)', 'h', '0.0');
  helper(27, 'PWHT furnace hours', '=IF(in_pwht="Yes",(595-20)/C25+C26+(595-60)/C25+4,0)', 'h', '0.0');
  helper(28, 'Total manhours', '=weld_hours+120+(Weights!D11+Weights!D12)*12+in_trays*9+IF(in_pwht="Yes",40,0)', 'h', '#,##0');

  noteRow(ws, 30, 'B', 'G', 'Budgetary estimate, following the app: plate rates with forming/fabrication factors, weld consumables per kg deposited, manhours from weld + fitting + nozzle + tray allowances, NDT per metre plus a base charge, PWHT by charge weight and furnace time, paint per m². Excludes engineering, freight, margin and taxes. Adjust the rates in Lists to match the shop.');

  const names = {
    cost_shell: 'F6', cost_heads: 'F7', cost_nozzles: 'F8', cost_manways: 'F9', cost_internals: 'F10',
    cost_support: 'F11', cost_attachments: 'F12', cost_lining: 'F13', cost_consumables: 'F14',
    cost_labour: 'F15', cost_ndt: 'F16', cost_pwht: 'F17', cost_paint: 'F18',
    cost_total: 'F19', cost_per_kg: 'F20', manhours: 'C28',
  };
  for (const [name, ref] of Object.entries(names)) definedName(wb, 'Cost', `$${ref[0]}$${ref.slice(1)}`, name);
}
