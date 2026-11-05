import {
  C, newSheet, title, section, head, calcCell, textCell, noteRow, grid, rangeValidation,
} from './style.mjs';

// Component schedule with per-part source country and landed-cost build-up.
// B..H keep the original schedule; I..Q add sourcing, import cost and landed cost.
export function buildComponents(wb) {
  const ws = newSheet(wb, 'Components', [2, 34, 7, 8, 20, 34, 11, 38, 12, 15, 12, 14, 12, 10, 10, 15, 15], {
    tab: C.navy, freeze: { y: 5, x: 2 },
  });
  title(ws, 'Components — schedule of parts with source country and landed cost',
    'Each line is a procurement package. Pick the source country; the sheet adds mill price, freight, duty, insurance and clearance to give landed cost.', 'Q');

  section(ws, 4, 'COMPONENT SCHEDULE — OPTIMISED BOQ SOURCING', 'B', 'Q');
  head(ws, 5, 'B', 'Q');
  ['Component', 'Qty', 'Unit', 'Material', 'Size / basis', 'Weight (kg)', 'Notes', 'Cost group', 'Source country', 'Mat $/kg', 'Base $', 'Freight $', 'Duty $', 'Insurance $', 'Clearance $', 'Landed $'].forEach((t, i) => {
    ws.getCell(`${String.fromCharCode(66 + i)}5`).value = t;
  });

  const row = (r, name, qty, unit, material, size, weight, note, group, country) => {
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
    textCell(ws, `I${r}`, group, { align: 'center', size: 9 });
    textCell(ws, `J${r}`, country, { align: 'center', size: 9 });
    rangeValidation(ws.getCell(`J${r}`), 'src_country');
    calcCell(ws, `K${r}`,
      `=IFERROR(IF(ISNUMBER(SEARCH("SS",$E${r})),INDEX(src_ss,MATCH($J${r},src_country,0)),INDEX(src_cs,MATCH($J${r},src_country,0)))*INDEX(mat_factor,MATCH($I${r},mat_group,0)),0)`,
      '#,##0.00', { align: 'right' });
    calcCell(ws, `L${r}`, `=G${r}*K${r}`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `M${r}`, `=G${r}*IFERROR(INDEX(src_freight,MATCH($J${r},src_country,0)),0)`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `N${r}`, `=L${r}*IFERROR(INDEX(src_duty,MATCH($J${r},src_country,0)),0)/100`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `O${r}`, `=(L${r}+M${r}+N${r})*IFERROR(INDEX(src_ins,MATCH($J${r},src_country,0)),0)/100`, '"$"#,##0', { align: 'right' });
    calcCell(ws, `P${r}`,
      `=(IFERROR(INDEX(src_clear,MATCH($J${r},src_country,0)),0)+IFERROR(INDEX(src_docs,MATCH($J${r},src_country,0)),0))*G${r}/SUM($G$6:$G$25)`,
      '"$"#,##0', { align: 'right' });
    calcCell(ws, `Q${r}`, `=L${r}+M${r}+N${r}+O${r}+P${r}`, '"$"#,##0', { align: 'right', bold: true });
    ws.getRow(r).height = 28;
  };

  row(6, 'Shell courses', '=IF(in_ditop>0,2,1)', 'course', '=in_matl',
    '="Ø"&in_di&IF(in_ditop>0," / Ø"&in_ditop,"")&" ID · "&t_shell&" mm"',
    '=w_shell_lower+w_shell_upper', 'Lower course plus the smaller upper course.', 'Shell', 'India');
  row(7, 'Vessel heads', 2, 'off', '=in_matl',
    '=IF(in_head_top="FLAT","Flat","2:1 SE")&" "&t_head_top&" / "&IF(in_head_bot="FLAT","Flat","2:1 SE")&" "&t_head_bot&" mm"',
    '=w_head_top+w_head_bot', 'Top and bottom heads.', 'Heads', 'India');
  row(8, 'Process nozzles', '=Nozzles!$E$27-COUNTIF(Nozzles!$B$6:$B$25,"M*")', 'pcs', '=in_matl',
    'NPS 2–14 · CL150 / CL300', '=w_nozzles', 'Necks, flanges and pads from the nozzle schedule.', 'Nozzles', 'India');
  row(9, 'Manways', '=COUNTIF(Nozzles!$B$6:$B$25,"M*")', 'off', '=in_matl',
    '18" / 24" · CL300', '=w_manways', 'Flange, cover, neck and studs.', 'Manways', 'India');
  row(10, 'Tray assemblies', '=in_trays', 'off', 'SS 304 / 316',
    '="Ø"&in_di&" ID · 45 kg/m² × 55% open"',
    '=IF(in_trays>0,(PI()/4)*(in_di/1000)^2*tray_mass*tray_open*in_trays,0)', 'Trays by tray vendor; allowance only.', 'Internals', 'China');
  row(11, 'Tray support rings', '=in_trays', 'off', '=in_matl',
    '="Ø"&in_di&" ID · 50 × 8 flat"',
    '=IF(in_trays>0,(PI()/4)*(in_di/1000)^2*ring_mass*in_trays,0)', 'Welded to the shell, one per tray.', 'Internals', 'India');
  row(12, 'Demister support ring', '=IF(in_demister="Yes",1,0)', 'off', '=in_matl',
    '="Ø"&in_di&" ID · 50 × 8 flat"', 0, 'Weight included in the attachment allowance.', 'Internals', 'India');
  row(13, 'Packing support / limiter', '=IF(OR(in_packing="Yes",in_bed>0),2,0)', 'off', '=in_matl',
    '="Ø"&in_di&" ID · bed "&TEXT(MAX(in_bed,1000),"#,##0")&" mm"', '=w_packing', 'Support grid and hold-down limiter.', 'Internals', 'India');
  row(14, 'Vortex breaker', '=IF(OR(in_kind="Separator",in_kind="Drum"),1,0)', 'off', '=in_matl',
    '9 kg/m² allowance', '=w_vortex', 'Bottom outlet protection.', 'Internals', 'India');
  row(15, 'Boot / drop leg', '=IF(in_drop_od>0,1,0)', 'off', '=in_matl',
    '=IF(in_drop_od>0,"Ø"&in_drop_od&" OD × "&TEXT(in_drop_len,"#,##0")&" T/T · "&t_drop&" mm shell","—")',
    '=w_boot', 'Shell plus bottom head.', 'Shell', 'India');
  row(16, 'Permanent support', 1, 'set', '=in_matl',
    '=in_support&IF(in_support="Skirt"," · "&TEXT(Weights!C26,"#,##0")&" mm high","")', '=w_support', 'Skirt, saddles or legs.', 'Support', 'India');
  row(17, 'Base ring / anchor bolts', '=IF(in_support="Skirt",1,IF(in_support="Saddles",8,1))', 'set', '=in_matl',
    'Skirt base ring 35 mm × 90 mm', 0, 'Included in the support weight.', 'Support', 'India');
  row(18, 'Lifting trunnions', 2, 'off', '=in_matl', '2 off, 120 kg each', '=2*trunnion_kg', 'For erection only.', 'Attachments', 'India');
  row(19, 'Insulation rings & clips', 1, 'lot', '=in_matl',
    '=TEXT(Weights!C29,"#,##0.0")&" m² shell"', '=Weights!C29*2.8', '2.8 kg/m² of shell surface.', 'Attachments', 'China');
  row(20, 'Nameplate / earthing', 1, 'lot', '=in_matl', 'Stainless nameplate + bosses', '=misc_kg', '', 'Attachments', 'China');
  row(21, 'Transportation saddles', '=IF(in_orient="V",2,0)', 'off', '=in_matl',
    '="2 off · "&TEXT(Weights!C34,"#,##0")&" × "&TEXT(Weights!C35,"#,##0")&" mm"', '=w_transport', 'Reusable, removed after erection.', 'Attachments', 'India');
  row(22, 'Vacuum stiffener rings', '=rings', 'off', '=in_matl',
    '=IF(rings>0,TEXT(ring_spacing,"#,##0")&" mm spacing","Not required")', '=w_stiffeners', 'From the external-pressure screen.', 'Attachments', 'India');
  row(23, 'PWHT supports / thermocouples', '=IF(in_pwht="Yes",1,0)', 'lot', '—', 'Furnace supports and TC pads', '=IF(in_pwht="Yes",150,0)', 'Removed after heat treatment.', 'Attachments', 'Bahrain');
  row(24, 'Internal lining', '=IF(in_liner="Yes",1,0)', 'lot', 'Glass-flake / rubber',
    '=IF(in_liner="Yes",TEXT(Weights!C32,"#,##0.0")&" m²","—")', '=w_lining', 'Mass allowance only.', 'Lining', 'China');
  row(25, 'Nozzle reinforcement pads', '=COUNTIF(Nozzles!$AA$6:$AA$25,"Pad required")', 'off', '=in_matl',
    '2:1 tapered pad, 6 mm nominal', 0, 'Weight included in the nozzle weights.', 'Nozzles', 'India');

  textCell(ws, 'B27', 'TOTAL', { bold: true, fill: C.pale, size: 11 });
  calcCell(ws, 'G27', '=SUM(G6:G25)', '#,##0.0', { bold: true, fill: C.pale, align: 'right' });
  calcCell(ws, 'H27', '=TEXT(G27/1000,"0.0")&" t"', 'General', { fill: C.pale, bold: true });
  calcCell(ws, 'Q27', '=SUM(Q6:Q25)', '"$"#,##0', { bold: true, fill: C.pale, align: 'right' });
  for (const ref of ['B27', 'C27', 'D27', 'E27', 'F27', 'G27', 'H27', 'I27', 'J27', 'K27', 'L27', 'M27', 'N27', 'O27', 'P27', 'Q27']) {
    grid(ws.getCell(ref), { fill: C.pale, bold: true });
  }

  noteRow(ws, 29, 'B', 'Q', 'Each line is a procurement package: change the source country to re-price it. Landed cost = mill price × cost-group factor + freight + duty + insurance + allocated clearance and documents. The source-country list and rates are on the Rates sheet; the country totals are on Logistics.');
}
