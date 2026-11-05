import { C, newSheet, title, section, head, calcCell, textCell, noteRow, grid, font } from './style.mjs';

export function buildSummary(wb) {
  const ws = newSheet(wb, 'Summary', [2, 40, 26, 12, 46, 28, 14], { tab: C.green });
  title(ws, 'Summary — one-page result', 'Change the Input sheet and this page follows. All values are formula-driven.', 'E');

  const block = (row, text) => section(ws, row, text, 'B', 'E');
  const header = (row, cols) => {
    head(ws, row, 'B', 'E');
    ['Parameter', 'Value', 'Unit', 'Basis / note'].forEach((t, i) => {
      ws.getCell(`${'BCDE'[i]}${row}`).value = t;
    });
    if (cols) {
      // no-op hook for readability
    }
  };
  const line = (r, labelText, formula, unit, basis, fmt = '0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true, wrap: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right', bold: true });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    textCell(ws, `E${r}`, basis, { wrap: true, color: C.muted, size: 9 });
    ws.getRow(r).height = 22;
  };
  const total = (r, labelText, formula, unit, fmt = '#,##0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true, fill: C.pale, size: 11 });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right', bold: true, fill: C.pale });
    textCell(ws, `D${r}`, unit, { align: 'center', fill: C.pale });
    textCell(ws, `E${r}`, '', { fill: C.pale });
    for (const ref of ['B', 'C', 'D', 'E']) grid(ws.getCell(`${ref}${r}`), { fill: C.pale, bold: true });
    ws.getRow(r).height = 26;
  };

  block(4, 'DESIGN RESULTS');
  header(5);
  line(6, 'Design pressure', '=in_p', 'kg/cm²g', 'Input value, converted to MPa on the Design sheet.', '0.0');
  line(7, 'Design temperature', '=in_temp', '°C', 'Selects the allowable stress from the temperature table.', '0');
  line(8, 'Allowable stress, S', '=s_allow', 'MPa', 'Interpolated from Lists.', '0.0');
  line(9, 'Joint efficiency, E', '=e_joint', '', 'Full RT 1.00 · spot RT 0.85 · no RT 0.70.', '0.00');
  line(10, 'Shell — required thickness', '=Design!K14', 'mm', 'UG-27(c)(1), including corrosion allowance.', '0.00');
  line(11, 'Shell — selected plate', '=t_shell', 'mm', 'Next stocked gauge above the requirement.', '0.0');
  line(12, 'Upper shell — selected plate', '=IF(in_ditop>0,t_shell_top,"—")', 'mm', 'Only where a smaller upper section exists.', '0.0');
  line(13, 'Conical transition — selected', '=IF(in_ditop>0,t_cone,"—")', 'mm', 'UG-32(f) at 30°.', '0.0');
  line(14, 'Top head — selected plate', '=t_head_top', 'mm', 'UG-32(d) 2:1 ellipsoidal, or UG-34 flat.', '0.0');
  line(15, 'Bottom head — selected plate', '=t_head_bot', 'mm', 'UG-32(d) on the larger diameter.', '0.0');
  line(16, 'Boot / drop leg — selected', '=IF(in_drop_od>0,t_drop,"—")', 'mm', 'UG-27(c)(1) on the boot OD.', '0.0');
  line(17, 'Governing MAWP', '=mawp_kg', 'kg/cm²g', 'Lowest of shell, heads and boot.', '0.0');
  line(18, 'Design margin (P / MAWP)', '=mawp_margin', '', 'Shows how much of MAWP the design uses.', '0.0%');
  line(19, 'External allowable pressure', '=ext_allow', 'kPa', 'UG-28 simplified screen.', '0.0');
  line(20, 'External required pressure', '=ext_req', 'kPa', 'Full vacuum 101.3 kPa, otherwise 25 kPa.', '0.0');
  textCell(ws, 'B21', 'External pressure status', { bold: true });
  calcCell(ws, 'C21', '=ext_status', 'General', { align: 'center', bold: true });
  textCell(ws, 'D21', '', { align: 'center' });
  textCell(ws, 'E21', 'OK, or intermediate stiffener rings required.', { wrap: true, color: C.muted, size: 9 });
  ws.getRow(21).height = 22;

  block(23, 'QUANTITIES');
  header(24);
  line(25, 'Process nozzles', '=Weights!D11', 'pcs', 'Counted from the nozzle schedule.', '0');
  line(26, 'Manways', '=Weights!D12', 'off', 'Mark M… rows in the schedule.', '0');
  line(27, 'Trays', '=in_trays', 'off', 'Each with a 50 × 8 support ring.', '0');
  line(28, 'Demister support ring', '=IF(in_demister="Yes",1,0)', 'off', 'Mist eliminator support.', '0');
  line(29, 'Bed support / limiter rings', '=IF(OR(in_packing="Yes",in_bed>0),2,0)', 'off', 'Support grid plus hold-down.', '0');
  line(30, 'Vortex breaker', '=IF(OR(in_kind="Separator",in_kind="Drum"),1,0)', 'off', 'Separator / drum allowance.', '0');
  line(31, 'Boot / drop leg', '=IF(in_drop_od>0,1,0)', 'off', '', '0');
  line(32, 'Vacuum stiffener rings', '=rings', 'off', 'From the external-pressure screen.', '0');
  line(33, 'Reinforcement pads', '=COUNTIF(Nozzles!$AA$6:$AA$25,"Pad required")', 'off', 'Nozzles short of area without a pad.', '0');
  line(34, 'Total nozzles and manways', '=Weights!D11+Weights!D12', 'off', '', '0');

  block(36, 'WEIGHT');
  header(37);
  line(38, 'Shell courses', '=w_shell_lower+w_shell_upper', 'kg', 'Lower and upper courses.', '#,##0');
  line(39, 'Conical transition', '=w_cone', 'kg', '', '#,##0');
  line(40, 'Heads', '=w_head_top+w_head_bot', 'kg', '', '#,##0');
  line(41, 'Process nozzles', '=w_nozzles', 'kg', 'Necks, flanges and pads.', '#,##0');
  line(42, 'Manways', '=w_manways', 'kg', 'Flange, cover, neck and studs.', '#,##0');
  line(43, 'Internals', '=w_trays+w_packing+w_vortex', 'kg', 'Trays, rings, packing and breaker.', '#,##0');
  line(44, 'Permanent support', '=w_support', 'kg', 'Skirt, saddles or legs.', '#,##0');
  line(45, 'Attachments', '=w_attachments+w_stiffeners', 'kg', 'Rings, ladder, trunnions, stiffeners.', '#,##0');
  line(46, 'Transportation saddles', '=w_transport', 'kg', 'Reusable, vertical vessels only.', '#,##0');
  line(47, 'Boot / drop leg', '=w_boot', 'kg', 'Included here; omitted by the app total.', '#,##0');
  line(48, 'Internal lining', '=w_lining', 'kg', 'Mass allowance only.', '#,##0');
  total(49, 'TOTAL WEIGHT', '=w_total', 'kg', '#,##0');
  line(50, 'Total weight', '=w_total/1000', 't', 'Rounded to 0.1 t on the register.', '0.00');

  block(52, 'COST AND HOURS (BHD)');
  header(53);
  line(54, 'Landed raw material', '=SUM(Cost!F6:F13)', 'BHD', 'Shell, heads, nozzles, manways, internals, support, attachments and lining, imported.', '"BD "#,##0');
  line(55, 'Weld consumables', '=cost_consumables', 'BHD', '', '"BD "#,##0');
  line(56, 'Fabrication labour', '=cost_labour', 'BHD', 'Manhours × your shop rate of 2.00 BHD/h.', '"BD "#,##0');
  line(57, 'NDT — radiography', '=cost_ndt', 'BHD', '', '"BD "#,##0');
  line(58, 'Post-weld heat treatment', '=cost_pwht', 'BHD', '', '"BD "#,##0');
  line(59, 'Surface preparation and paint', '=cost_paint', 'BHD', '', '"BD "#,##0');
  line(60, 'Export logistics — land + sea', '=cost_export', 'BHD', 'Delivered to the client site.', '"BD "#,##0');
  total(61, 'TOTAL FABRICATED + DELIVERED', '=cost_total', 'BHD', '"BD "#,##0');
  line(62, 'Cost per kilogram', '=cost_per_kg', 'BHD/kg', '', '"BD "#,##0.00');
  line(63, 'Manhours', '=manhours', 'h', 'Weld hours plus fitting, nozzles, trays and PWHT.', '#,##0');
  line(64, 'Weld length', '=weld_length', 'm', '', '#,##0.0');
  line(65, 'Import content', '=IF(cost_total>0,SUM(Cost!F6:F13)/cost_total,0)', '%', 'Share of delivered cost that is imported material.', '0.0%');
  line(66, 'Export logistics share', '=IF(cost_total>0,cost_export/cost_total,0)', '%', 'Freight, duty, insurance, clearance and documentation.', '0.0%');

  block(68, 'DATASHEET OUTPUT');
  header(69);
  const out = (r, labelText, formula, basis) => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    ws.mergeCells(`C${r}:E${r}`);
    calcCell(ws, `C${r}`, formula, 'General', { wrap: true });
    ws.getCell(`C${r}`).font = font(10, false, C.ink);
    ws.getRow(r).height = 26;
    if (basis) {
      // basis merged into the same cell text where useful
    }
  };
  out(70, 'Shell / upper / cone', '="Shell "&t_shell&" mm · upper "&IF(in_ditop>0,t_shell_top&" mm","n/a")&" · cone "&IF(in_ditop>0,t_cone&" mm","n/a")');
  out(71, 'Heads', '=IF(in_head_top="FLAT","Flat","2:1 SE")&" "&t_head_top&" mm / "&IF(in_head_bot="FLAT","Flat","2:1 SE")&" "&t_head_bot&" mm"');
  out(72, 'Boot / drop leg', '=IF(in_drop_od>0,"Ø"&in_drop_od&" OD × "&TEXT(in_drop_len,"#,##0")&" T/T · "&t_drop&" mm shell","Not provided")');
  out(73, 'Tray support rings', '=IF(in_trays>0,in_trays&" off · Ø"&in_di&" ID · 50 × 8 flat, welded to shell","No trays")');
  out(74, 'Demister support ring', '=IF(in_demister="Yes","1 off · Ø"&in_di&" ID · 50 × 8 flat","Not provided")');
  out(75, 'Vortex breaker', '=IF(G7>0,"Ø"&G7&" × "&G8&" mm high · vanes "&G9&" long","—")');
  out(76, 'Nozzles / manways', '=Weights!D11&" process nozzles · "&Weights!D12&" manway(s) · "&COUNTIF(Nozzles!$AA$6:$AA$25,"Pad required")&" pad(s)"');
  out(77, 'Code / RT / PWHT / CA', '="ASME VIII Div.1 · RT "&in_rt&" · PWHT "&in_pwht&" · CA "&in_ca&" mm"');
  out(78, 'Service / unit', '=in_service&" · "&in_unit&" · "&in_kind&" ("&in_orient&")"');
  out(79, 'Note 1', '=in_note1');
  out(80, 'Note 2', '=in_note2');
  out(81, 'Note 3', '=in_note3');

  // Derived helpers for the vortex breaker statement.
  textCell(ws, 'F4', 'DERIVED HELPERS', { bold: true, fill: C.slate, color: C.white });
  ws.mergeCells('F4:G4');
  const help = (r, labelText, formula, fmt = '0') => {
    textCell(ws, `F${r}`, labelText, { wrap: true, color: C.muted, size: 9 });
    calcCell(ws, `G${r}`, formula, fmt, { align: 'right', size: 9 });
  };
  help(5, 'Vortex outlet NPS', '=IFERROR(LOOKUP(2,1/((Nozzles!$C$6:$C$25="Bottom outlet")*(Nozzles!$D$6:$D$25>0)),Nozzles!$D$6:$D$25),0)', '0.0');
  help(6, 'Outlet OD (mm)', '=IF(G5>0,IFERROR(INDEX(nps_od,MATCH(G5,nps_list,0)),0),0)', '0');
  help(7, 'Breaker OD (mm)', '=IF(G6>0,MIN(ROUND(G6*1.6,0),G6+300),0)', '0');
  help(8, 'Vane height (mm)', '=IF(G7>0,ROUND(G7*0.35,0),0)', '0');
  help(9, 'Vane length (mm)', '=IF(G7>0,ROUND(G7*0.8,0),0)', '0');
  help(11, 'Demister ring', '=IF(in_demister="Yes",1,0)', '0');

  ws.addConditionalFormatting({
    ref: 'C21',
    rules: [
      { type: 'expression', priority: 1, formulae: ['C21="OK"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.greenFill } }, font: { color: { argb: C.green }, bold: true } } },
      { type: 'expression', priority: 2, formulae: ['C21<>"OK"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.amberFill } }, font: { color: { argb: C.amber }, bold: true } } },
    ],
  });

  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.printArea = 'A1:E81';
}

export function buildFleet(wb, fleet) {
  const widths = [5, 10, 22, 20, 11, 7, 9, 9, 9, 10, 8, 7, 7, 7, 7, 7, 60];
  const ws = newSheet(wb, 'Fleet', widths, { tab: 'FF7F7F7F', freeze: { x: 2, y: 4 } });
  title(ws, 'Fleet reference — 28 project vessels', 'Static snapshot of the project register input data. This sheet is not formula-driven; use it for comparison, not calculation.', 'Q');

  head(ws, 4, 'A', 'Q');
  const headers = [
    'No.', 'Tag', 'Service', 'Unit', 'Type', 'Orient', 'Di (mm)', 'Di top (mm)', 'T/T (mm)', 'P (kg/cm²g)',
    'Temp (°C)', 'CA (mm)', 'Class', 'RT', 'PWHT', 'Trays', 'Notes',
  ];
  headers.forEach((t, i) => {
    ws.getCell(`${String.fromCharCode(64 + i + 1)}4`).value = t;
  });

  fleet.forEach((v, i) => {
    const r = 5 + i;
    const vals = [
      i + 1, v.id, v.service, v.unit, v.kind, v.orientation, v.di, v.diTop || '—', v.tt, v.p,
      v.designTempC, v.ca, v.asmeClass, v.rtPolicy, v.pwhtRequired ? 'Yes' : 'No', v.trays || 0,
      (v.notes || []).join(' · '),
    ];
    vals.forEach((val, c) => {
      const cell = ws.getCell(`${String.fromCharCode(64 + c + 1)}${r}`);
      cell.value = val;
      grid(cell, {
        size: 9,
        wrap: c === 16,
        align: c === 16 ? 'left' : 'center',
        fill: i % 2 ? C.pale : undefined,
      });
    });
    ws.getRow(r).height = 26;
  });

  noteRow(ws, 34, 'A', 'Q', 'Register values are the datasheet inputs used by the app and by the pre-filled Input sheet (12-C01). To calculate a different vessel, copy its row into Input and replace the nozzle schedule. The Fleet sheet itself is a static reference and will not recalculate.');
}
