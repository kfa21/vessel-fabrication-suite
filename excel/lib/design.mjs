import { C, newSheet, title, section, head, calcCell, textCell, noteRow, grid, font, definedName, ng, S_FORMULA } from './style.mjs';

export function buildDesign(wb) {
  const ws = newSheet(wb, 'Design', [2, 42, 15, 40, 10, 10, 10, 8, 10, 8, 10, 8, 10, 9], { tab: C.navy, freeze: { y: 13 } });
  title(ws, 'Design — ASME VIII Div.1 thickness, MAWP and external pressure', 'All values are live formulas driven by the Input sheet. Selected plate is rounded up to the next stocked gauge in Lists.', 'N');

  const basis = (row, labelText, formula, unit, note, fmt = '0.000') => {
    textCell(ws, `B${row}`, labelText, { bold: true });
    calcCell(ws, `C${row}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${row}`, unit, { align: 'center', color: C.muted, size: 9 });
    ws.mergeCells(`E${row}:N${row}`);
    const c = ws.getCell(`E${row}`);
    c.value = note;
    c.font = font(9, false, C.muted, true);
    c.alignment = { vertical: 'middle', horizontal: 'left', wrap: true, indent: 1 };
  };

  section(ws, 4, 'DESIGN BASIS', 'B', 'N');
  basis(5, 'Design pressure, P', '=in_p*kgcm2_mpa', 'MPa', 'Input pressure (kg/cm²g) converted with 0.0980665.', '0.000');
  basis(6, 'Allowable stress, S', `=${S_FORMULA}`, 'MPa', 'Interpolated from the stress/temperature table in Lists for the material class.', '0.0');
  basis(7, 'Joint efficiency, E', '=IF(in_rt="Full",1,IF(in_rt="Spot",0.85,0.7))', '', 'Full RT = 1.00, spot RT = 0.85, no RT = 0.70.', '0.00');
  basis(8, 'Inside radius + CA, R', '=in_di/2+in_ca', 'mm', 'Used by the circumferential shell formula.', '0.0');
  basis(9, 'Minimum fabrication thickness', '=IF(in_di>900,6,5)', 'mm', '6 mm above 900 mm ID, 5 mm below. Heads use a 6 mm minimum.', '0.0');
  basis(10, 'Lower shell length', '=lower_len', 'mm', '55% of T/T for a two-diameter column, otherwise the full T/T.', '#,##0');
  basis(11, 'Upper shell length', '=upper_len', 'mm', '45% of T/T for a two-diameter column; zero for a straight shell.', '#,##0');

  section(ws, 12, 'THICKNESS CALCULATION (UG-27 / UG-32 / UG-34)', 'B', 'N');
  head(ws, 13, 'B', 'N');
  ['Component', 'Clause', 'Formula', 'P (MPa)', 'R or D/2 (mm)', 'S (MPa)', 'E', 't calc (mm)', 'CA (mm)', 't req (mm)', 'Min (mm)', 'Selected (mm)', 'Utilisation'].forEach((t, i) => {
    ws.getCell(`${String.fromCharCode(66 + i)}13`).value = t;
  });

  const row = (r, component, clause, formulaText, pRef, rRef, iFormula, caRef, minRef, util = `=K${r}/M${r}`) => {
    textCell(ws, `B${r}`, component, { bold: true, wrap: true });
    textCell(ws, `C${r}`, clause, { align: 'center', size: 9 });
    textCell(ws, `D${r}`, formulaText, { wrap: true, size: 8, color: C.muted });
    calcCell(ws, `E${r}`, pRef, '0.000');
    calcCell(ws, `F${r}`, rRef, '0.0');
    calcCell(ws, `G${r}`, '=$C$6', '0.0');
    calcCell(ws, `H${r}`, '=$C$7', '0.00');
    calcCell(ws, `I${r}`, iFormula, '0.00');
    calcCell(ws, `J${r}`, caRef, '0.0');
    calcCell(ws, `K${r}`, `=I${r}+J${r}`, '0.00');
    calcCell(ws, `L${r}`, minRef, '0.0');
    calcCell(ws, `M${r}`, `=${ng(`MAX(K${r},L${r})`)}`, '0.0');
    calcCell(ws, `N${r}`, util, '0.0%');
    ws.getRow(r).height = 34;
  };

  // Row 14 — lower shell, circumferential
  row(14, 'Shell 1700 mm ID — circumferential stress', 'UG-27(c)(1)',
    't = P·R / (S·E − 0.6P) + CA', '=$C$5', '=$C$8',
    '=E14*F14/(G14*H14-0.6*E14)', '=in_ca', '=$C$9');

  // Row 15 — lower shell, longitudinal
  row(15, 'Shell — longitudinal stress check', 'UG-27(c)(2)',
    't = P·R / (2S·E + 0.4P) + CA', '=$C$5', '=$C$8',
    '=E15*F15/(2*G15*H15+0.4*E15)', '=in_ca', '=$C$9');

  // Row 16 — upper shell (conditional)
  textCell(ws, 'B16', 'Shell 1100 mm ID — upper section', { bold: true, wrap: true });
  textCell(ws, 'C16', 'UG-27(c)(1)', { align: 'center', size: 9 });
  textCell(ws, 'D16', 't = P·R / (S·E − 0.6P) + CA', { wrap: true, size: 8, color: C.muted });
  calcCell(ws, 'E16', '=IF(in_ditop>0,$C$5,0)', '0.000');
  calcCell(ws, 'F16', '=IF(in_ditop>0,in_ditop/2+in_ca,0)', '0.0');
  calcCell(ws, 'G16', '=IF(in_ditop>0,$C$6,0)', '0.0');
  calcCell(ws, 'H16', '=IF(in_ditop>0,$C$7,0)', '0.00');
  calcCell(ws, 'I16', '=IF(in_ditop>0,E16*F16/(G16*H16-0.6*E16),0)', '0.00');
  calcCell(ws, 'J16', '=IF(in_ditop>0,in_ca,0)', '0.0');
  calcCell(ws, 'K16', '=I16+J16', '0.00');
  calcCell(ws, 'L16', '=IF(in_ditop>0,$C$9,0)', '0.0');
  calcCell(ws, 'M16', `=IF(in_ditop>0,${ng('MAX(K16,L16)')},0)`, '0.0;-0.0;"—"');
  calcCell(ws, 'N16', '=IF(M16>0,K16/M16,0)', '0.0%;-0.0%;"—"');
  ws.getRow(16).height = 34;

  // Row 17 — cone
  textCell(ws, 'B17', 'Conical transition Ø1100 → Ø1700', { bold: true, wrap: true });
  textCell(ws, 'C17', 'UG-32(f)', { align: 'center', size: 9 });
  textCell(ws, 'D17', 't = P·D / (2·cos α ·(S·E − 0.6P)) + CA', { wrap: true, size: 8, color: C.muted });
  calcCell(ws, 'E17', '=IF(in_ditop>0,$C$5,0)', '0.000');
  calcCell(ws, 'F17', '=IF(in_ditop>0,(in_di+2*in_ca)/2,0)', '0.0');
  calcCell(ws, 'G17', '=IF(in_ditop>0,$C$6,0)', '0.0');
  calcCell(ws, 'H17', '=IF(in_ditop>0,$C$7,0)', '0.00');
  calcCell(ws, 'I17', '=IF(in_ditop>0,E17*F17/(COS(RADIANS(30))*(G17*H17-0.6*E17)),0)', '0.00');
  calcCell(ws, 'J17', '=IF(in_ditop>0,in_ca,0)', '0.0');
  calcCell(ws, 'K17', '=I17+J17', '0.00');
  calcCell(ws, 'L17', '=IF(in_ditop>0,$C$9,0)', '0.0');
  calcCell(ws, 'M17', `=IF(in_ditop>0,${ng('MAX(K17,L17)')},0)`, '0.0;-0.0;"—"');
  calcCell(ws, 'N17', '=IF(M17>0,K17/M17,0)', '0.0%;-0.0%;"—"');
  ws.getRow(17).height = 34;

  // Row 18 — top head
  textCell(ws, 'B18', 'Top head — 2:1 ellipsoidal / flat', { bold: true, wrap: true });
  textCell(ws, 'C18', 'UG-32(d) / UG-34', { align: 'center', size: 9 });
  textCell(ws, 'D18', 'SE: t = P·D / (2S·E − 0.2P) + CA', { wrap: true, size: 8, color: C.muted });
  calcCell(ws, 'E18', '=$C$5', '0.000');
  calcCell(ws, 'F18', '=(IF(in_ditop>0,in_ditop,in_di)+2*in_ca)/2', '0.0');
  calcCell(ws, 'G18', '=$C$6', '0.0');
  calcCell(ws, 'H18', '=$C$7', '0.00');
  calcCell(ws, 'I18', '=IF(in_head_top="FLAT",2*F18*SQRT(0.33*E18/(G18*H18)),E18*2*F18/(2*G18*H18-0.2*E18))', '0.00');
  calcCell(ws, 'J18', '=in_ca', '0.0');
  calcCell(ws, 'K18', '=I18+J18', '0.00');
  calcCell(ws, 'L18', '=6', '0.0');
  calcCell(ws, 'M18', `=${ng('MAX(K18,L18)')}`, '0.0');
  calcCell(ws, 'N18', '=K18/M18', '0.0%');
  ws.getRow(18).height = 34;

  // Row 19 — bottom head
  textCell(ws, 'B19', 'Bottom head — 2:1 ellipsoidal / flat', { bold: true, wrap: true });
  textCell(ws, 'C19', 'UG-32(d) / UG-34', { align: 'center', size: 9 });
  textCell(ws, 'D19', 'SE: t = P·D / (2S·E − 0.2P) + CA', { wrap: true, size: 8, color: C.muted });
  calcCell(ws, 'E19', '=$C$5', '0.000');
  calcCell(ws, 'F19', '=(in_di+2*in_ca)/2', '0.0');
  calcCell(ws, 'G19', '=$C$6', '0.0');
  calcCell(ws, 'H19', '=$C$7', '0.00');
  calcCell(ws, 'I19', '=IF(in_head_bot="FLAT",2*F19*SQRT(0.33*E19/(G19*H19)),E19*2*F19/(2*G19*H19-0.2*E19))', '0.00');
  calcCell(ws, 'J19', '=in_ca', '0.0');
  calcCell(ws, 'K19', '=I19+J19', '0.00');
  calcCell(ws, 'L19', '=6', '0.0');
  calcCell(ws, 'M19', `=${ng('MAX(K19,L19)')}`, '0.0');
  calcCell(ws, 'N19', '=K19/M19', '0.0%');
  ws.getRow(19).height = 34;

  // Row 20 — drop leg
  textCell(ws, 'B20', 'Boot / drop leg', { bold: true, wrap: true });
  textCell(ws, 'C20', 'UG-27(c)(1)', { align: 'center', size: 9 });
  textCell(ws, 'D20', 't = P·R / (S·E − 0.6P) + leg CA', { wrap: true, size: 8, color: C.muted });
  calcCell(ws, 'E20', '=IF(in_drop_od>0,$C$5,0)', '0.000');
  calcCell(ws, 'F20', '=IF(in_drop_od>0,(in_drop_od-16)/2+in_caleg,0)', '0.0');
  calcCell(ws, 'G20', '=IF(in_drop_od>0,$C$6,0)', '0.0');
  calcCell(ws, 'H20', '=IF(in_drop_od>0,$C$7,0)', '0.00');
  calcCell(ws, 'I20', '=IF(in_drop_od>0,E20*F20/(G20*H20-0.6*E20),0)', '0.00');
  calcCell(ws, 'J20', '=IF(in_drop_od>0,in_caleg,0)', '0.0');
  calcCell(ws, 'K20', '=I20+J20', '0.00');
  calcCell(ws, 'L20', '=IF(in_drop_od>0,6,0)', '0.0');
  calcCell(ws, 'M20', `=IF(in_drop_od>0,${ng('MAX(K20,L20)')},0)`, '0.0;-0.0;"—"');
  calcCell(ws, 'N20', '=IF(M20>0,K20/M20,0)', '0.0%;-0.0%;"—"');
  ws.getRow(20).height = 34;

  noteRow(ws, 21, 'B', 'N', 'Selected thickness = next stocked plate gauge at or above max(required, minimum). Utilisation compares required (calc + CA) against the selected plate; values approaching 100% mean the next gauge would be needed for any increase in pressure, diameter or corrosion allowance.');

  // MAWP block
  section(ws, 23, 'MAWP BACK-CALCULATION FROM THE SELECTED PLATE', 'B', 'N');
  const mawp = (r, labelText, formula, unit, note, fmt = '0.000') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    ws.mergeCells(`E${r}:N${r}`);
    const c = ws.getCell(`E${r}`);
    c.value = note;
    c.font = font(9, false, C.muted, true);
    c.alignment = { vertical: 'middle', horizontal: 'left', wrap: true, indent: 1 };
  };
  mawp(24, 'Shell MAWP (circumferential)', '=$C$6*$C$7*(t_shell-$J$14)/($F$14+0.6*(t_shell-$J$14))', 'MPa', 'Inverts UG-27(c)(1) using the selected lower-shell plate.', '0.000');
  mawp(25, 'Shell MAWP', '=C24/kgcm2_mpa', 'kg/cm²g', 'Converted for comparison with the input design pressure.', '0.0');
  mawp(26, 'Top head MAWP', '=IF(M18>0,2*$C$6*$C$7*(t_head_top-$J$18)/(2*$F$18+0.2*(t_head_top-$J$18)),999)', 'MPa', 'UG-32(d) inverted. Heads are not governing in a typical column.', '0.000');
  mawp(27, 'Bottom head MAWP', '=IF(M19>0,2*$C$6*$C$7*(t_head_bot-$J$19)/(2*$F$19+0.2*(t_head_bot-$J$19)),999)', 'MPa', 'UG-32(d) inverted for the larger bottom head.', '0.000');
  mawp(28, 'Drop leg MAWP', '=IF(in_drop_od>0,$C$6*$C$7*(t_drop-$J$20)/($F$20+0.6*(t_drop-$J$20)),999)', 'MPa', 'UG-27(c)(1) inverted for the boot shell.', '0.000');
  mawp(29, 'Governing MAWP', '=MIN(C24,C26,C27,C28)', 'MPa', 'Lowest of the shell, heads and boot.', '0.000');
  mawp(30, 'Governing MAWP', '=C29/kgcm2_mpa', 'kg/cm²g', 'The vessel MAWP printed on the summary.', '0.0');
  mawp(31, 'Design margin (P / MAWP)', '=p_mpa/C29', '', 'Fraction of MAWP used by the design pressure; lower is more conservative.', '0.0%');

  // External pressure
  section(ws, 34, 'EXTERNAL PRESSURE — UG-28 SCREEN', 'B', 'N');
  const ext = (r, labelText, formula, unit, note, fmt = '0.0') => {
    textCell(ws, `B${r}`, labelText, { bold: true });
    calcCell(ws, `C${r}`, formula, fmt, { align: 'right' });
    textCell(ws, `D${r}`, unit, { align: 'center', color: C.muted, size: 9 });
    ws.mergeCells(`E${r}:N${r}`);
    const c = ws.getCell(`E${r}`);
    c.value = note;
    c.font = font(9, false, C.muted, true);
    c.alignment = { vertical: 'middle', horizontal: 'left', wrap: true, indent: 1 };
  };
  ext(35, 'Outside diameter, Do', '=(in_di+2*t_shell)/1000', 'm', 'Selected shell plate plus inside diameter.', '0.000');
  ext(36, 'Thickness, t', '=t_shell/1000', 'm', 'Selected shell plate, no corrosion allowance (UG-28 uses the furnished thickness).', '0.000');
  ext(37, 'Unstiffened length', '=(in_tt+in_di/4)/1000', 'm', 'T/T plus one quarter of the diameter, per the app’s screening assumption.', '0.000');
  ext(38, 'Factor k', '=2.42*e_mod/(1-0.3^2)^0.75', '', 'Elastic buckling constant for steel (ν = 0.3).', '0');
  ext(39, 'Factor q', '=(C36/C35)^2.5', '', 'Ro/t term of the simplified strain curve.', '0.0000');
  ext(40, 'Divisor', '=MAX(0.05,C37/C35-0.45*SQRT(C36/C35))', '', 'Length-to-diameter term, floored at 0.05.', '0.0000');
  ext(41, 'Pa — elastic', '=C38*C39/C40*1000', 'kPa', 'Allowable external pressure from the elastic curve.', '0.0');
  ext(42, 'Pa — yield cap', '=0.667*yield_mpa*2*C36/C35*1000', 'kPa', 'Caps the elastic solution at two-thirds of yield.', '0.0');
  ext(43, 'Allowable external pressure', '=MIN(C41,C42)', 'kPa', 'Governing allowable, used for the stiffener check.', '0.0');
  ext(44, 'Required external pressure', '=IF(in_vacuum="Yes",101.3,25)', 'kPa', 'Full vacuum requires 101.3 kPa; otherwise the 25 kPa screen applies.', '0.0');
  textCell(ws, 'B45', 'Status', { bold: true });
  calcCell(ws, 'C45', '=IF(C43>=C44,"OK","STIFFENERS REQUIRED")', 'General', { align: 'center', bold: true });
  ws.mergeCells('D45:N45');
  const st = ws.getCell('D45');
  st.value = 'OK means the shell resists the required external pressure without stiffeners.';
  st.font = font(9, false, C.muted, true);
  st.alignment = { vertical: 'middle', horizontal: 'left', wrap: true, indent: 1 };
  ext(46, 'Maximum unstiffened span', '=MAX(300,((C38*C39/(C44/1000))+0.45*SQRT(C36/C35))*C35*1000)', 'mm', 'Longest shell length that survives the required pressure without a ring.', '#,##0');
  ext(47, 'Stiffener rings required', '=IF(C46>=(in_tt+in_di/4),0,CEILING((in_tt+in_di/4)/C46,1)-1)', 'off', 'Number of intermediate vacuum stiffener rings.', '0');
  ext(48, 'Ring spacing', '=(in_tt+in_di/4)/(C47+1)', 'mm', 'Equal spacing between rings (and the end supports).', '#,##0');
  noteRow(ws, 49, 'B', 'N', 'The external-pressure check is the app’s simplified UG-28 screen, not a full Div.1 UG-28 evaluation. A ring schedule shown here still needs a qualified engineer to confirm the ring section, attachment details and any combined load case.');

  // Conditional formatting on utilisation and status
  ws.addConditionalFormatting({
    ref: 'N14:N20',
    rules: [{
      type: 'cellIs', operator: 'greaterThan', formulae: ['1'],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.redFill } }, font: { color: { argb: C.red }, bold: true } },
    }],
  });
  ws.addConditionalFormatting({
    ref: 'C45',
    rules: [
      { type: 'expression', priority: 1, formulae: ['C45="OK"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.greenFill } }, font: { color: { argb: C.green }, bold: true } } },
      { type: 'expression', priority: 2, formulae: ['C45<>"OK"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.amberFill } }, font: { color: { argb: C.amber }, bold: true } } },
    ],
  });

  const names = {
    p_mpa: 'C5', s_allow: 'C6', e_joint: 'C7', t_shell: 'M14', t_shell_top: 'M16',
    t_cone: 'M17', t_head_top: 'M18', t_head_bot: 'M19', t_drop: 'M20',
    mawp_mpa: 'C29', mawp_kg: 'C30', mawp_margin: 'C31', ext_allow: 'C43',
    ext_req: 'C44', ext_status: 'C45', ring_span: 'C46', rings: 'C47', ring_spacing: 'C48',
  };
  for (const [name, ref] of Object.entries(names)) definedName(wb, 'Design', `$${ref[0]}$${ref.slice(1)}`, name);
}
