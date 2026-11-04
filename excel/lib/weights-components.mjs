import { C, newSheet, title, section, head, calcCell, textCell, noteRow, grid, definedName, ng } from './style.mjs';

export function buildWeights(wb) {
  const ws = newSheet(wb, 'Weights', [2, 40, 40, 8, 8, 14, 52], { tab: C.navy, freeze: { y: 5 } });
  title(ws, 'Weights — steel, internals, support and attachments', 'Metric tonnes are shown on the Summary.', 'G');

  section(ws, 4, 'WEIGHT BUILD-UP', 'B', 'G');
  head(ws, 5, 'B', 'G');
  ['Group', 'Basis / size', 'Qty', 'Unit', 'Weight (kg)', 'Notes'].forEach((t, i) => {
    ws.getCell(`${'BCDEFG'[i]}5`).value = t;
  });

  const item = (r, labelText, basis, qty, unit, formula, note) => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    if (typeof basis === 'string' && basis.startsWith('=')) calcCell(ws, `C${r}`, basis, 'General', { wrap: true });
    else textCell(ws, `C${r}`, basis, { wrap: true, color: C.muted, size: 9 });
    if (typeof qty === 'string' && qty.startsWith('=')) calcCell(ws, `D${r}`, qty, '#,##0', { align: 'center' });
    else textCell(ws, `D${r}`, qty, { align: 'center' });
    textCell(ws, `E${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    calcCell(ws, `F${r}`, formula, '#,##0.0', { align: 'right', bold: true });
    textCell(ws, `G${r}`, note, { wrap: true, color: C.muted, size: 9 });
    ws.getRow(r).height = 30;
  };

  item(6, 'Shell — lower course', '="Ø"&in_di&" ID × "&t_shell&" mm · L = "&TEXT(lower_len,"#,##0")&" mm"', 1, 'course',
    '=PI()*(in_di+t_shell)*lower_len*t_shell*rho/1000000000', 'Mid-surface area × plate thickness × density.');
  item(7, 'Shell — upper course', '=IF(in_ditop>0,"Ø"&in_ditop&" ID × "&t_shell_top&" mm · L = "&TEXT(upper_len,"#,##0")&" mm","—")',
    '=IF(in_ditop>0,1,0)', 'course',
    '=IF(in_ditop>0,PI()*(in_ditop+t_shell_top)*upper_len*t_shell_top*rho/1000000000,0)', 'Only when a smaller upper section exists.');
  item(8, 'Conical transition', '=IF(in_ditop>0,"Ø"&in_di&" → Ø"&in_ditop&" · "&t_cone&" mm","—")', '=IF(in_ditop>0,1,0)', 'off',
    '=IF(in_ditop>0,PI()*((in_di+in_ditop)/2)*SQRT(((in_di-in_ditop)/2)^2+((in_di-in_ditop)/2/TAN(RADIANS(30)))^2)*t_cone*rho/1000000000,0)',
    '30° transition, slant length from the radial step.');
  item(9, 'Top head', '=IF(in_head_top="FLAT","Flat","2:1 SE")&" · Ø"&(IF(in_ditop>0,in_ditop,in_di)+2*in_ca)&" · "&t_head_top&" mm"', 1, 'off',
    '=(1.084*((IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/1000)^2+0.28*PI()*((IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/1000))*(t_head_top/1000)*rho',
    'Ellipsoidal area formula, or the flat-head area.');
  item(10, 'Bottom head', '=IF(in_head_bot="FLAT","Flat","2:1 SE")&" · Ø"&(in_di+2*in_ca)&" · "&t_head_bot&" mm"', 1, 'off',
    '=(1.084*((in_di+2*in_ca)/1000)^2+0.28*PI()*((in_di+2*in_ca)/1000))*(t_head_bot/1000)*rho', 'Bottom head is sized on the larger diameter.');
  item(11, 'Process nozzles', 'Nozzle schedule — necks, flanges, pads', '=SUMIFS(Nozzles!$E$6:$E$25,Nozzles!$D$6:$D$25,"<18")', 'pcs',
    '=Nozzles!$Z$27-F12', 'All non-manway rows from the nozzle schedule.');
  item(12, 'Manways', 'Nozzle schedule — manway rows (mark M…)', '=SUMIF(Nozzles!$B$6:$B$25,"M*",Nozzles!$E$6:$E$25)', 'off',
    '=SUMIF(Nozzles!$B$6:$B$25,"M*",Nozzles!$Z$6:$Z$25)', 'Flange, blind/cover, neck and studs.');
  item(13, 'Trays + support rings', '=IF(in_trays>0,in_trays&" trays · Ø"&in_di&" ID","—")', '=in_trays', 'off',
    '=IF(in_trays>0,((PI()/4)*(in_di/1000)^2*tray_mass*tray_open+(PI()/4)*(in_di/1000)^2*ring_mass)*in_trays,0)',
    '45 kg/m² × 55% open area, plus a 50 × 8 ring at 7 kg/m².');
  item(14, 'Packing / structured bed', '=IF(OR(in_packing="Yes",in_bed>0),"Bed depth "&TEXT(MAX(in_bed,1000),"#,##0")&" mm","—")',
    '=IF(OR(in_packing="Yes",in_bed>0),1,0)', 'bed',
    '=IF(OR(in_packing="Yes",in_bed>0),(PI()/4)*(in_di/1000)^2*(MAX(in_bed,1000)/1000)*packing_rho,0)', 'Packing density from Lists.');
  item(15, 'Vortex breaker / distributor', '=IF(OR(in_kind="Separator",in_kind="Drum"),"One off · "&in_kind&" allowance","—")',
    '=IF(OR(in_kind="Separator",in_kind="Drum"),1,0)', 'off',
    '=IF(OR(in_kind="Separator",in_kind="Drum"),(PI()/4)*(in_di/1000)^2*9,0)', '9 kg/m² allowance, as in the app.');
  item(16, 'Permanent support', '=in_support&IF(in_support="Skirt"," · h = "&TEXT(C26,"#,##0")&" mm · "&C27&" mm","")',
    1, 'set',
    '=IF(in_support="Skirt",PI()*(in_di+2*t_shell+C27)*C26*C27*rho/1000000000+PI()*(in_di/1000)*0.35*90,IF(in_support="Saddles",600,720))',
    'Skirt plus base ring, or a saddle / leg allowance.');
  item(17, 'Attachments', 'Insulation rings, ladder, cage, trunnions, misc.', 1, 'lot',
    '=C29*2.8+ladder_kg+cage_kgm*C28+2*trunnion_kg+misc_kg', 'Shell-mounted attachments at 2.8 kg/m².');
  item(18, 'Vacuum stiffener rings', '=IF(rings>0,rings&" rings · "&TEXT(ring_spacing,"#,##0")&" mm spacing","Not required")', '=rings', 'off',
    '=IF(rings>0,rings*PI()*(in_di/1000)*12,0)', '12 kg per metre of ring circumference.');
  item(19, 'Transportation saddles', '="2 off · "&TEXT(C34,"#,##0")&" × "&TEXT(C35,"#,##0")&" mm"', '=IF(in_orient="V",2,0)', 'off',
    '=IF(in_orient="V",2*(2*0.55*C34*C35*12+(C34+C35)*240*16)*rho/1000000000,0)', 'Reusable transport saddles, vertical vessels only.');
  item(20, 'Boot / drop leg', '=IF(in_drop_od>0,"Ø"&in_drop_od&" × "&TEXT(in_drop_len,"#,##0")&" T/T · "&t_drop&" mm","—")', '=IF(in_drop_od>0,1,0)', 'off',
    '=IF(in_drop_od>0,PI()*(in_drop_od/1000)*(in_drop_len/1000)*(t_drop/1000)*rho+(1.084*(in_drop_od/1000)^2+0.28*PI()*(in_drop_od/1000))*(t_drop/1000)*rho,0)',
    'Shell plus bottom head. The app’s total omits this weight.');
  item(21, 'Internal lining', '=IF(in_liner="Yes","Lining over "&TEXT(C32,"#,##0.0")&" m²","—")', '=IF(in_liner="Yes",1,0)', 'lot',
    '=IF(in_liner="Yes",C32*1.2*0.6,0)', 'Approximate lining mass at 1.2 mm and 0.6 kg/m² per mm.');

  textCell(ws, 'B22', 'TOTAL WEIGHT', { bold: true, fill: C.pale, size: 11 });
  ws.mergeCells('C22:E22');
  textCell(ws, 'C22', 'Steel + internals + lining', { fill: C.pale, color: C.muted, italic: true });
  calcCell(ws, 'F22', '=SUM(F6:F21)', '#,##0.0', { bold: true, fill: C.pale });
  calcCell(ws, 'G22', '=TEXT(F22/1000,"0.00")&" t"', 'General', { fill: C.pale, bold: true });
  for (const ref of ['B22', 'C22', 'D22', 'E22', 'F22', 'G22']) grid(ws.getCell(ref), { fill: C.pale, bold: true });

  section(ws, 24, 'DERIVED DIMENSIONS AND AREAS', 'B', 'D');
  head(ws, 25, 'B', 'D');
  ['Item', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}25`).value = t;
  });
  const derived = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
  };
  derived(26, 'Skirt height (12% T/T, 1600–4000 mm)', '=IF(in_support="Skirt",MAX(1600,MIN(4000,in_tt*0.12)),0)', 'mm', '#,##0');
  derived(27, 'Skirt thickness', `=IF(in_support="Skirt",${ng('MAX(8,t_shell*0.6)')},0)`, 'mm', '0.0');
  derived(28, 'Ladder length', '=in_tt/1000', 'm', '0.00');
  derived(29, 'Shell surface area', '=PI()*(in_di/1000)*(in_tt/1000)', 'm²', '0.00');
  derived(30, 'Top head surface area', '=1.084*((IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/1000)^2+0.28*PI()*((IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/1000)', 'm²', '0.00');
  derived(31, 'Bottom head surface area', '=1.084*((in_di+2*in_ca)/1000)^2+0.28*PI()*((in_di+2*in_ca)/1000)', 'm²', '0.00');
  derived(32, 'Insulation / lining area', '=C29+C30+C31', 'm²', '0.00');
  derived(33, 'Paint area (external)', '=C32', 'm²', '0.00');
  derived(34, 'Transport saddle length', '=MAX(450,ROUND(850*ts_len_factor/10,0)*10)', 'mm', '#,##0');
  derived(35, 'Transport saddle height', '=MAX(300,ROUND(850*ts_h_factor/50,0)*50)', 'mm', '#,##0');

  noteRow(ws, 37, 'B', 'G', 'Weights are estimating values from geometry, not a bill of material. Nozzle weights come from the schedule; supports, ladders, trunnions and transport saddles use the app’s allowance model. Add tray, packing and internals vendor data when available.');

  definedName(wb, 'Weights', '$F$6', 'w_shell_lower');
  definedName(wb, 'Weights', '$F$7', 'w_shell_upper');
  definedName(wb, 'Weights', '$F$8', 'w_cone');
  definedName(wb, 'Weights', '$F$9', 'w_head_top');
  definedName(wb, 'Weights', '$F$10', 'w_head_bot');
  definedName(wb, 'Weights', '$F$11', 'w_nozzles');
  definedName(wb, 'Weights', '$F$12', 'w_manways');
  definedName(wb, 'Weights', '$F$13', 'w_trays');
  definedName(wb, 'Weights', '$F$14', 'w_packing');
  definedName(wb, 'Weights', '$F$15', 'w_vortex');
  definedName(wb, 'Weights', '$F$16', 'w_support');
  definedName(wb, 'Weights', '$F$17', 'w_attachments');
  definedName(wb, 'Weights', '$F$18', 'w_stiffeners');
  definedName(wb, 'Weights', '$F$19', 'w_transport');
  definedName(wb, 'Weights', '$F$20', 'w_boot');
  definedName(wb, 'Weights', '$F$21', 'w_lining');
  definedName(wb, 'Weights', '$F$22', 'w_total');
  definedName(wb, 'Weights', '$C$32', 'area_total');
}

export function buildComponents(wb) {
  const ws = newSheet(wb, 'Components', [2, 34, 7, 8, 22, 36, 12, 46], { tab: C.navy, freeze: { y: 5 } });
  title(ws, 'Components — schedule of parts', 'Grouping mirrors the app’s component matrix. Delete rows you do not supply; weights follow the Weights sheet.', 'H');

  section(ws, 4, 'COMPONENT SCHEDULE', 'B', 'H');
  head(ws, 5, 'B', 'H');
  ['Component', 'Qty', 'Unit', 'Material', 'Size / basis', 'Weight (kg)', 'Notes'].forEach((t, i) => {
    ws.getCell(`${'BCDEFGH'[i]}5`).value = t;
  });

  const row = (r, name, qty, unit, material, size, weight, note) => {
    textCell(ws, `B${r}`, name, { bold: true, wrap: true });
    if (typeof qty === 'string' && qty.startsWith('=')) calcCell(ws, `C${r}`, qty, '#,##0', { align: 'center' });
    else textCell(ws, `C${r}`, qty, { align: 'center' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    textCell(ws, `E${r}`, material, { wrap: true });
    if (typeof size === 'string' && size.startsWith('=')) calcCell(ws, `F${r}`, size, 'General', { wrap: true });
    else textCell(ws, `F${r}`, size, { wrap: true });
    if (typeof weight === 'string' && weight.startsWith('=')) calcCell(ws, `G${r}`, weight, '#,##0.0', { align: 'right', bold: true });
    else textCell(ws, `G${r}`, weight, { align: 'right' });
    textCell(ws, `H${r}`, note, { wrap: true, color: C.muted, size: 9 });
    ws.getRow(r).height = 28;
  };

  row(6, 'Shell courses', '=IF(in_ditop>0,2,1)', 'course', '=in_matl',
    '="Ø"&in_di&IF(in_ditop>0," / Ø"&in_ditop,"")&" ID · "&t_shell&" mm"',
    '=w_shell_lower+w_shell_upper', 'Lower course plus the smaller upper course.');
  row(7, 'Vessel heads', 2, 'off', '=in_matl',
    '=IF(in_head_top="FLAT","Flat","2:1 SE")&" "&t_head_top&" / "&IF(in_head_bot="FLAT","Flat","2:1 SE")&" "&t_head_bot&" mm"',
    '=w_head_top+w_head_bot', 'Top and bottom heads.');
  row(8, 'Process nozzles', '=Nozzles!$E$27-COUNTIF(Nozzles!$B$6:$B$25,"M*")', 'pcs', '=in_matl',
    'NPS 2–14 · CL150 / CL300', '=w_nozzles', 'Necks, flanges and pads from the nozzle schedule.');
  row(9, 'Manways', '=COUNTIF(Nozzles!$B$6:$B$25,"M*")', 'off', '=in_matl',
    '18" / 24" · CL300', '=w_manways', 'Flange, cover, neck and studs.');
  row(10, 'Tray assemblies', '=in_trays', 'off', 'SS 304 / 316',
    '="Ø"&in_di&" ID · 45 kg/m² × 55% open"',
    '=IF(in_trays>0,(PI()/4)*(in_di/1000)^2*tray_mass*tray_open*in_trays,0)', 'Trays by tray vendor; allowance only.');
  row(11, 'Tray support rings', '=in_trays', 'off', '=in_matl',
    '="Ø"&in_di&" ID · 50 × 8 flat"',
    '=IF(in_trays>0,(PI()/4)*(in_di/1000)^2*ring_mass*in_trays,0)', 'Welded to the shell, one per tray.');
  row(12, 'Demister support ring', '=IF(in_demister="Yes",1,0)', 'off', '=in_matl',
    '="Ø"&in_di&" ID · 50 × 8 flat"', 0, 'Weight included in the attachment allowance.');
  row(13, 'Packing support / limiter', '=IF(OR(in_packing="Yes",in_bed>0),2,0)', 'off', '=in_matl',
    '="Ø"&in_di&" ID · bed "&TEXT(MAX(in_bed,1000),"#,##0")&" mm"', '=w_packing', 'Support grid and hold-down limiter.');
  row(14, 'Vortex breaker', '=IF(OR(in_kind="Separator",in_kind="Drum"),1,0)', 'off', '=in_matl',
    '9 kg/m² allowance', '=w_vortex', 'Bottom outlet protection.');
  row(15, 'Boot / drop leg', '=IF(in_drop_od>0,1,0)', 'off', '=in_matl',
    '=IF(in_drop_od>0,"Ø"&in_drop_od&" OD × "&TEXT(in_drop_len,"#,##0")&" T/T · "&t_drop&" mm shell","—")',
    '=w_boot', 'Shell plus bottom head.');
  row(16, 'Permanent support', 1, 'set', '=in_matl',
    '=in_support&IF(in_support="Skirt"," · "&TEXT(Weights!C26,"#,##0")&" mm high","")', '=w_support', 'Skirt, saddles or legs.');
  row(17, 'Base ring / anchor bolts', '=IF(in_support="Skirt",1,IF(in_support="Saddles",8,1))', 'set', '=in_matl',
    'Skirt base ring 35 mm × 90 mm', 0, 'Included in the support weight.');
  row(18, 'Lifting trunnions', 2, 'off', '=in_matl', '2 off, 120 kg each', '=2*trunnion_kg', 'For erection only.');
  row(19, 'Insulation rings & clips', 1, 'lot', '=in_matl',
    '=TEXT(Weights!C29,"#,##0.0")&" m² shell"', '=Weights!C29*2.8', '2.8 kg/m² of shell surface.');
  row(20, 'Nameplate / earthing', 1, 'lot', '=in_matl', 'Stainless nameplate + bosses', '=misc_kg', '');
  row(21, 'Transportation saddles', '=IF(in_orient="V",2,0)', 'off', '=in_matl',
    '="2 off · "&TEXT(Weights!C34,"#,##0")&" × "&TEXT(Weights!C35,"#,##0")&" mm"', '=w_transport', 'Reusable, removed after erection.');
  row(22, 'Vacuum stiffener rings', '=rings', 'off', '=in_matl',
    '=IF(rings>0,TEXT(ring_spacing,"#,##0")&" mm spacing","Not required")', '=w_stiffeners', 'From the external-pressure screen.');
  row(23, 'PWHT supports / thermocouples', '=IF(in_pwht="Yes",1,0)', 'lot', '—', 'Furnace supports and TC pads', '=IF(in_pwht="Yes",150,0)', 'Removed after heat treatment.');
  row(24, 'Internal lining', '=IF(in_liner="Yes",1,0)', 'lot', 'Glass-flake / rubber',
    '=IF(in_liner="Yes",TEXT(Weights!C32,"#,##0.0")&" m²","—")', '=w_lining', 'Mass allowance only.');
  row(25, 'Nozzle reinforcement pads', '=COUNTIF(Nozzles!$AA$6:$AA$25,"Pad required")', 'off', '=in_matl',
    '2:1 tapered pad, 6 mm nominal', 0, 'Weight included in the nozzle weights.');

  textCell(ws, 'B27', 'TOTAL', { bold: true, fill: C.pale, size: 11 });
  calcCell(ws, 'G27', '=SUM(G6:G25)', '#,##0.0', { bold: true, fill: C.pale });
  calcCell(ws, 'H27', '=TEXT(G27/1000,"0.0")&" t"', 'General', { fill: C.pale, bold: true });
  for (const ref of ['B27', 'C27', 'D27', 'E27', 'F27', 'G27', 'H27']) grid(ws.getCell(ref), { fill: C.pale, bold: true });

  noteRow(ws, 29, 'B', 'H', 'Quantities marked “allowance” are estimating values, not released vendor data. The component matrix is the same grouping used by the web app, so a line can be traced back to the corresponding app table.');
}
