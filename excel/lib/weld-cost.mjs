import { C, newSheet, title, section, head, calcCell, textCell, noteRow, grid, definedName } from './style.mjs';

// Weld plan with layer-by-layer procedure rules:
//   root GTAW, fill SMAW up to the thickness threshold, SAW above it,
//   single-V below the double-V threshold, back-gouge by diameter.
export function buildWeld(wb) {
  const ws = newSheet(wb, 'Weld', [2, 40, 7, 26, 7, 9, 7, 9, 10, 16, 10, 11, 9, 9, 9, 9, 10], {
    tab: C.navy, freeze: { y: 5, x: 2 },
  });
  title(ws, 'Weld — joint schedule by layer, procedure and back-gouging',
    'Joint type, fill process and back-gouge method follow the rules on the Rates sheet. Root pass is always GTAW; fill is SMAW ≤ threshold and SAW above.', 'Q');

  section(ws, 4, 'WELD SCHEDULE — LAYER, PROCESS AND BACK-GOUGE', 'B', 'Q');
  head(ws, 5, 'B', 'Q');
  ['Joint', 'Cat', 'Joint detail', 'Qty', 'Length (m)', 'Thk (mm)', 'Root', 'Fill', 'Back-gouge', 'Groove area (mm²)', 'Weld metal (kg)', 'Root h', 'Fill h', 'Gouge h', 'Fit-up h', 'Total h'].forEach((t, i) => {
    ws.getCell(`${String.fromCharCode(66 + i)}5`).value = t;
  });

  const joint = (r, name, cat, detail, qty, length, thk, root, fill, gouge) => {
    textCell(ws, `B${r}`, name, { bold: true, wrap: true });
    textCell(ws, `C${r}`, cat, { align: 'center' });
    if (typeof detail === 'string' && detail.startsWith('=')) calcCell(ws, `D${r}`, detail, 'General', { wrap: true, size: 9 });
    else textCell(ws, `D${r}`, detail, { wrap: true, size: 9 });
    if (typeof qty === 'string' && qty.startsWith('=')) calcCell(ws, `E${r}`, qty, '0', { align: 'center' });
    else textCell(ws, `E${r}`, qty, { align: 'center' });
    calcCell(ws, `F${r}`, length, '#,##0.0', { align: 'right' });
    calcCell(ws, `G${r}`, thk, '0.0', { align: 'center' });
    textCell(ws, `H${r}`, root, { align: 'center', size: 9 });
    if (typeof fill === 'string' && fill.startsWith('=')) calcCell(ws, `I${r}`, fill, 'General', { align: 'center', size: 9 });
    else textCell(ws, `I${r}`, fill, { align: 'center', size: 9 });
    if (typeof gouge === 'string' && gouge.startsWith('=')) calcCell(ws, `J${r}`, gouge, 'General', { align: 'center', size: 9, wrap: true });
    else textCell(ws, `J${r}`, gouge, { align: 'center', size: 9, wrap: true });
    calcCell(ws, `K${r}`, `=IF($D${r}="Double-V butt",0.32*$G${r}^2,IF($D${r}="Fillet",0.4*$G${r}^2,0.58*$G${r}^2))`, '#,##0.0', { align: 'right' });
    calcCell(ws, `L${r}`, `=$F${r}*1000*$K${r}*mm3_to_kg*weld_factor`, '#,##0.0', { align: 'right' });
    calcCell(ws, `M${r}`, `=IF($H${r}="GTAW",($F${r}*1000*root_area*mm3_to_kg*weld_factor)/rate_gtaw*weld_arc_factor,0)`, '#,##0.0', { align: 'right' });
    calcCell(ws, `N${r}`,
      `=($L${r}-IF($H${r}="GTAW",$F${r}*1000*root_area*mm3_to_kg*weld_factor,0))/IF($I${r}="SAW",rate_saw,IF($I${r}="SMAW",rate_smaw,IF($I${r}="FCAW",rate_fcaw,rate_gtaw)))*weld_arc_factor`,
      '#,##0.0', { align: 'right' });
    calcCell(ws, `O${r}`, `=IF(OR($D${r}="Double-V butt",$D${r}="Fillet"),0,$F${r}*IF($J${r}="Machine grinding",gouge_machine,gouge_manual))`, '#,##0.0', { align: 'right' });
    calcCell(ws, `P${r}`, `=$F${r}*weld_fit_h+$E${r}*weld_joint_h`, '#,##0.0', { align: 'right' });
    calcCell(ws, `Q${r}`, `=$M${r}+$N${r}+$O${r}+$P${r}`, '#,##0.0', { align: 'right', bold: true });
    ws.getRow(r).height = 30;
  };

  const autoDetail = (r) => `=IF($G${r}>=doublev_min,"Double-V butt","Single-V butt")`;
  const autoFill = (r) => `=IF($G${r}<=fill_threshold,fill_low,fill_high)`;
  const autoGouge = (r) => `=IF($D${r}="Double-V butt","Not required",IF(in_di>=gouge_dia,"Machine grinding","Manual grinding"))`;

  joint(6, 'Long seams — lower shell', 'A', autoDetail(6), 2, '=2*lower_len/1000', '=t_shell', 'GTAW', autoFill(6), autoGouge(6));
  joint(7, 'Circumferential seams — lower shell', 'A', autoDetail(7), '=IF(in_ditop>0,3,2)',
    '=PI()*(in_di/1000)*E7', '=t_shell', 'GTAW', autoFill(7), autoGouge(7));
  joint(8, 'Long seams — upper shell', 'A', autoDetail(8), '=IF(in_ditop>0,2,0)', '=E8*upper_len/1000',
    '=t_shell_top', 'GTAW', autoFill(8), autoGouge(8));
  joint(9, 'Circumferential seams — upper shell', 'A', autoDetail(9), '=IF(in_ditop>0,2,0)',
    '=PI()*(in_ditop/1000)*E9', '=t_shell_top', 'GTAW', autoFill(9), autoGouge(9));
  joint(10, 'Cone seams', 'A', autoDetail(10), '=IF(in_ditop>0,2,0)',
    '=PI()*((in_di+in_ditop)/2/1000)*E10', '=t_cone', 'GTAW', autoFill(10), autoGouge(10));
  joint(11, 'Head-to-shell seams', 'A', autoDetail(11), 2,
    '=PI()*((in_di+2*in_ca)/1000)+PI()*((IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/1000)',
    '=(t_head_top+t_head_bot)/2', 'GTAW', autoFill(11), autoGouge(11));
  joint(12, 'Nozzle and manway welds', 'B', 'Full-pen + fillet', '=COUNTIF(Nozzles!$D$6:$D$25,">0")',
    '=2*SUM(Nozzles!$K$6:$K$25)/1000', '=t_shell', 'GTAW', 'SMAW', 'Not required');
  joint(13, 'Support, pad, tray-ring and attachment welds', 'C', 'Fillet', 1,
    '=PI()*(in_di+2*t_shell)/1000+2*(in_tt/1000)+in_trays*PI()*(in_di/1000)+2*(in_tt/1000)', '=MAX(6,t_shell*0.5)', 'FCAW', 'FCAW', 'Not required');

  textCell(ws, 'B14', 'TOTAL', { bold: true, fill: C.pale, size: 11 });
  for (const [col, fmt] of [['E', '0'], ['F', '#,##0.0'], ['L', '#,##0.0'], ['M', '#,##0.0'], ['N', '#,##0.0'], ['O', '#,##0.0'], ['P', '#,##0.0'], ['Q', '#,##0.0']]) {
    calcCell(ws, `${col}14`, `=SUM(${col}6:${col}13)`, fmt, { bold: true, fill: C.pale, align: 'right' });
  }
  for (const ref of ['B14', 'C14', 'D14', 'E14', 'F14', 'G14', 'H14', 'I14', 'J14', 'K14', 'L14', 'M14', 'N14', 'O14', 'P14', 'Q14']) {
    grid(ws.getCell(ref), { fill: C.pale, bold: true });
  }

  section(ws, 16, 'WELD HOURS — BREAKDOWN', 'B', 'D');
  head(ws, 17, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => { ws.getCell(`${'BCD'[i]}17`).value = t; });
  const helper = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
  };
  helper(18, 'Total weld length', '=F14', 'm');
  helper(19, 'Total weld metal', '=L14', 'kg');
  helper(20, 'GTAW root hours', '=M14', 'h');
  helper(21, 'Fill hours — SMAW / SAW / FCAW', '=N14', 'h');
  helper(22, 'Back-gouging hours', '=O14', 'h');
  helper(23, 'Fit-up and handling hours', '=P14', 'h');
  helper(24, 'Total weld hours', '=Q14', 'h');
  helper(25, 'Weld length per tonne', '=F14/(w_total/1000)', 'm/t');
  helper(26, 'Average deposition rate', '=L14/(Q14+0.0001)', 'kg/h', '0.00');

  noteRow(ws, 28, 'B', 'Q', 'The procedure follows the Rates sheet: GTAW root; fill SMAW up to 20 mm and SAW above; double-V from 12 mm, single-V below; back-gouge by manual grinding under 1200 mm bore and machine grinding at or above it. Weld metal is groove area × length × deposit factor. Change the rules or process rates on Rates and every row re-times. This is a planning estimate — the qualified WPS and weld map govern fabrication.');

  definedName(wb, 'Weld', '$F$14', 'weld_length');
  definedName(wb, 'Weld', '$L$14', 'weld_metal');
  definedName(wb, 'Weld', '$Q$14', 'weld_hours');
}

export function buildCost(wb) {
  const ws = newSheet(wb, 'Cost', [2, 38, 40, 12, 12, 16, 10], { tab: C.navy, freeze: { y: 5 } });
  title(ws, 'Cost — landed material, fabrication and delivery',
    'Material follows the source country on each Components line. Rates are on the Rates sheet; labour is at your BHD shop rate. Currency is BHD.', 'G');

  section(ws, 4, 'COST BUILD-UP', 'B', 'G');
  head(ws, 5, 'B', 'G');
  ['Item', 'Basis', 'Qty', 'Rate', 'Amount (BHD)', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCDEFG'[i]}5`).value = t;
  });

  const line = (r, name, basis, qty, rate, amount, unit) => {
    textCell(ws, `B${r}`, name, { bold: true, wrap: true });
    textCell(ws, `C${r}`, basis, { wrap: true, color: C.muted, size: 9 });
    calcCell(ws, `D${r}`, qty, '#,##0.0', { align: 'right' });
    if (typeof rate === 'string' && rate.startsWith('=')) calcCell(ws, `E${r}`, rate, '#,##0.00', { align: 'right' });
    else textCell(ws, `E${r}`, rate, { align: 'right', fmt: '#,##0.00' });
    calcCell(ws, `F${r}`, amount, '"BD "#,##0', { align: 'right', bold: true });
    textCell(ws, `G${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    ws.getRow(r).height = 26;
  };

  const material = (r, name, group, basis) => {
    line(r, name, basis,
      `=SUMIF(Components!$I$6:$I$25,"${group}",Components!$G$6:$G$25)`,
      `=IF(D${r}>0,F${r}/D${r},0)`,
      `=SUMIF(Components!$I$6:$I$25,"${group}",Components!$Q$6:$Q$25)*fx_bhd`,
      'kg');
  };

  material(6, 'Landed material — shell', 'Shell', 'Mill price × factor + freight + duty + insurance + clearance, per Components');
  material(7, 'Landed material — heads', 'Heads', 'Formed heads at the 1.22 factor');
  material(8, 'Landed material — nozzles', 'Nozzles', 'Necks, flanges and pads at the 2.6 factor');
  material(9, 'Landed material — manways', 'Manways', 'Manway assemblies at the 2.2 factor');
  material(10, 'Landed material — internals', 'Internals', 'Trays, rings, packing and breaker at 1.4');
  material(11, 'Landed material — support', 'Support', 'Skirt, base ring or saddles');
  material(12, 'Landed material — attachments', 'Attachments', 'Ladder, rings, trunnions, transport saddles, stiffeners');
  material(13, 'Landed material — lining', 'Lining', 'Stainless lining; zero when unlined');

  line(14, 'Weld consumables', 'Weld metal from the Weld sheet',
    '=weld_metal', '=rate_consumable*fx_bhd', '=D14*E14', 'kg');
  line(15, 'Fabrication labour', 'Weld hours + fitting, nozzles and trays at the shop rate',
    '=C29', '=rate_hour', '=D15*E15', 'h');
  line(16, 'NDT — radiography', 'Weld length × RT rate + 900 base + 750 for wet H2S',
    '=weld_length', '=IF(D16>0,F16/D16,0)',
    '=(D16*IF(in_rt="Full",rate_ndt_full,IF(in_rt="Spot",rate_ndt_spot,0))+900+IF(in_h2s="Yes",750,0))*fx_bhd', 'm');
  line(17, 'Post-weld heat treatment', 'Setup + charge weight + furnace hours; zero when not required',
    '=IF(in_pwht="Yes",w_total,0)', '=IF(D17>0,F17/D17,0)',
    '=IF(in_pwht="Yes",(rate_pwht_setup+D17*rate_pwht_kg+C28*120)*fx_bhd,0)', 'kg');
  line(18, 'Surface preparation and paint', 'External area from the Weights sheet',
    '=area_total', '=rate_paint*fx_bhd', '=D18*E18', 'm²');
  line(19, 'Export logistics — land + sea', 'Delivered to the client site; see the Logistics sheet',
    1, '=Logistics!$C$30', '=E19', 'lot');

  textCell(ws, 'B20', 'TOTAL FABRICATED + DELIVERED COST', { bold: true, fill: C.pale, size: 11 });
  calcCell(ws, 'F20', '=SUM(F6:F19)', '"BD "#,##0', { bold: true, fill: C.pale, align: 'right' });
  textCell(ws, 'G20', 'BHD', { fill: C.pale, bold: true, align: 'center' });
  for (const ref of ['B20', 'C20', 'D20', 'E20', 'F20', 'G20']) grid(ws.getCell(ref), { fill: C.pale, bold: true });

  textCell(ws, 'B21', 'Cost per kilogram', { bold: true });
  textCell(ws, 'C21', 'Total delivered cost ÷ total weight', { color: C.muted, size: 9 });
  calcCell(ws, 'F21', '=F20/w_total', '"BD "#,##0.00', { align: 'right', bold: true });
  textCell(ws, 'G21', 'BD/kg', { align: 'center', color: C.muted, size: 9 });

  textCell(ws, 'B22', 'Manhours', { bold: true });
  textCell(ws, 'C22', 'Weld hours + 120 + 12 h per nozzle + 9 h per tray + 40 h PWHT', { color: C.muted, size: 9, wrap: true });
  calcCell(ws, 'F22', '=C29', '#,##0', { align: 'right', bold: true });
  textCell(ws, 'G22', 'h', { align: 'center', color: C.muted, size: 9 });

  section(ws, 24, 'MANHOUR AND PWHT HELPERS', 'B', 'D');
  head(ws, 25, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => { ws.getCell(`${'BCD'[i]}25`).value = t; });
  const helper = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
  };
  helper(26, 'PWHT heat / cool rate', '=MAX(28,222/(MAX(t_shell,t_head_bot,t_head_top)/25.4))', '°C/h', '#,##0');
  helper(27, 'PWHT hold time', '=MAX(1,MAX(t_shell,t_head_bot,t_head_top)/25.4)', 'h', '0.0');
  helper(28, 'PWHT furnace hours', '=IF(in_pwht="Yes",(595-20)/C26+C27+(595-60)/C26+4,0)', 'h', '0.0');
  helper(29, 'Total manhours', '=weld_hours+120+(Weights!D11+Weights!D12)*12+in_trays*9+IF(in_pwht="Yes",40,0)', 'h', '#,##0');

  noteRow(ws, 31, 'B', 'G', 'Material is priced by source country on Components and landed in Bahrain, then converted to BHD. Labour is manhours × the shop rate on Rates (2.00 BHD/h default). NDT, PWHT and paint rates are converted from USD at the Rates FX. Export logistics comes from the Logistics sheet. Excludes engineering, contingency, margin and taxes beyond those shown.');

  const names = {
    cost_shell: 'F6', cost_heads: 'F7', cost_nozzles: 'F8', cost_manways: 'F9', cost_internals: 'F10',
    cost_support: 'F11', cost_attachments: 'F12', cost_lining: 'F13', cost_consumables: 'F14',
    cost_labour: 'F15', cost_ndt: 'F16', cost_pwht: 'F17', cost_paint: 'F18', cost_export: 'F19',
    cost_total: 'F20', cost_per_kg: 'F21', manhours: 'C29',
  };
  for (const [name, ref] of Object.entries(names)) definedName(wb, 'Cost', `$${ref[0]}$${ref.slice(1)}`, name);
}
