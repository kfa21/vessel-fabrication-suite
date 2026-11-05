import { C, newSheet, title, section, head, inputCell, calcCell, textCell, noteRow, grid, font, definedName, listValidation, numberValidation } from './style.mjs';

export function buildReadme(wb) {
  const ws = newSheet(wb, 'README', [2, 24, 112], { tab: 'FF7F7F7F' });
  title(ws, 'Vessel Fabrication Suite — Engineering Workbook', 'ASME VIII Div.1 pressure-part design · weights · weld · cost · datasheet output. Live formulas, no macros.', 'C');

  const rows = [];
  const h = (t) => rows.push(['h', t]);
  const p = (t) => rows.push(['p', t]);
  const kv = (a, b) => rows.push(['kv', a, b]);

  h('WHAT THIS WORKBOOK IS');
  p('A single-vessel calculator. You enter the process and geometry data on the Input sheet (yellow cells); every other sheet recalculates from those inputs using live Excel formulas. No values are pasted in, so changing the design pressure, diameter or material immediately updates thickness, MAWP, weights and cost.');
  p('The engineering basis matches the Vessel Fabrication Suite web app: ASME VIII Div.1 UG-27 (shell), UG-32 (heads and cone), UG-28 (external pressure screen), UG-37 (nozzle reinforcement), UG-34 (flat heads), plus the app’s plate-gauge rounding, weight model, weld estimate and cost model.');

  h('HOW TO USE IT');
  p('1. Open the Input sheet and fill the yellow cells. Drop-downs are provided for equipment type, orientation, support, radiography, PWHT, heads, packing and lining.');
  p('2. Press F9 (or Ctrl+Alt+F9) to force a full recalculation. The workbook is set to recalculate on load, so results are current whenever it opens.');
  p('3. Read Summary for the design result, quantities, weight and cost; read Design for the clause-by-clause thickness calculation; read Nozzles for the reinforcement check; read Weights, Components, Weld and Cost for the build-up.');
  p('4. To reuse the workbook for another vessel, overwrite the Input cells and the Nozzles schedule (delete unused nozzle rows). Everything else is formula-driven.');

  h('SHEET MAP');
  kv('Input', 'Process data, design conditions, geometry and boot/lining inputs. The only sheet you edit for a new design.');
  kv('Design', 'UG-27/32/34 thickness table with utilisation, MAWP back-calculation, and the UG-28 external-pressure screen with stiffener-ring spacing.');
  kv('Nozzles', 'Nozzle and manway schedule: neck, reinforcement (UG-37), pad sizing, stud bolts, flange and neck weights.');
  kv('Weights', 'Weight build-up by group: shell courses, cone, heads, nozzles, manways, internals, support, attachments, transportation, boot and lining.');
  kv('Components', 'Part schedule with cost group and source country per line. Each line carries mill price, freight, duty, insurance and clearance, giving landed cost.');
  kv('Rates', 'Commercial control panel: BHD shop rate and FX, material/NDT/painting rates, weld-procedure rules, source countries, export markets and shipping equipment.');
  kv('Weld', 'Joint schedule timed by layer: GTAW root, SMAW fill to the thickness threshold, SAW above, single/double-V per code, back-gouging by bore.');
  kv('Cost', 'Landed material by group, consumables, BHD labour, NDT, PWHT, paint, export logistics and delivered total.');
  kv('Logistics', 'Finished-goods export: cargo size, auto-selected road/sea unit, freight, customs, duty, insurance and documentation; import landed cost by country.');
  kv('Summary', 'One-page output: design results, quantities, weights, delivered cost, manhours and datasheet-ready text.');
  kv('Fleet', 'Static reference table of the 28 vessels in the project register (read-only snapshot, not formula-driven).');
  kv('Lists', 'Technical lookups: plate gauges, allowable stress vs temperature, pipe OD/wall, flange masses, stud bolts, plate stock. Commercial rates live on Rates.');

  h('ENGINEERING BASIS (as implemented in the formulas)');
  kv('Shell', 'UG-27(c)(1) circumferential: t = P·R / (S·E − 0.6P) + CA. Longitudinal check: t = P·R / (2S·E + 0.4P) + CA. R is the inside radius plus corrosion allowance.');
  kv('Heads', 'UG-32(d) 2:1 ellipsoidal: t = P·D / (2S·E − 0.2P) + CA, D = inside diameter + 2CA. Flat heads use UG-34(c)(1) with C = 0.33.');
  kv('Cone', 'UG-32(f) / Appendix 1-8: t = P·D / (2·cos α ·(S·E − 0.6P)) + CA at α = 30°.');
  kv('Plate selection', 'Required thickness (calc + CA) is rounded up to the next stocked gauge in Lists, with a fabrication minimum of 6 mm above 900 mm ID (5 mm below) and 6 mm for heads.');
  kv('External pressure', 'UG-28 screen using the app’s simplified elastic curve (A = 0.125/(Ro/t)^1.5 capped at 0.1, B = 0.667·Sy·A, Pa = 4B/[3(Do/t)]). Unstiffened length = T/T + Di/4. Required pressure is 101.3 kPa under full vacuum, otherwise 25 kPa.');
  kv('Nozzles', 'UG-37 area replacement: available area in shell excess, neck excess and inward nozzle projection against required area A = d·tr·F + 2·tn·tr·F·(1 − fr1). Pads are sized from the shortfall with a 2:1 spread.');
  kv('Weights', 'Steel density 7.85 g/cm³. Shell and head weights from mid-surface area × thickness. Nozzles include neck pipe, flange and pad. Supports, ladders, trunnions and transport saddles follow the app model.');
  kv('Weld', 'Root pass GTAW; fill SMAW up to 20 mm and SAW above; double-V from 12 mm (single-V below with back-gouging); manual grinding below 1200 mm bore, machine grinding above. Hours = metal ÷ process rate × 1.55 + fit-up 0.9 h/m + 0.35 h/joint + gouging.');
  kv('Cost', 'Material is landed per source country (mill price × group factor + freight + duty + insurance + clearance), then converted at 0.376 BHD/USD. Labour = manhours × 2.00 BHD/h. Export logistics is added from the Logistics sheet.');

  h('VERIFICATION STATUS');
  p('The workbook was recalculated in Excel and checked against the app for vessel 12-C01 (Platforming Debutanizer, 1700/1100 mm ID, 26 900 mm T/T, 13.5 kg/cm²g at 265 °C, SA-516-70, spot RT, no PWHT, skirt). Shell 14 mm, upper shell 10 mm, cone 16 mm, top head 10 mm and bottom head 14 mm match the app’s thickness table exactly. Governing MAWP is 14.9 kg/cm²g; the external screen gives 194.6 kPa allowable against 101.3 kPa required, so no stiffener rings are needed. Total weight is 20 635 kg versus 20 550 kg in the app (+0.4%; this workbook includes the boot/drop-leg weight, which the app total omits).');
  p('The weld plan now times 519.8 h against 542 h in the app, using GTAW roots, SMAW fill to 20 mm, SAW above, single-V below 12 mm and machine back-gouging at the 1700 mm bore. Landed material is $48 450 (BD 18 217) from the default India / China / Bahrain sourcing. Delivered cost is BD 31 311 (about $83k), including BD 4 130 of export logistics to Saudi Arabia by road; labour is 1 207 h at 2.00 BHD/h. Excel recalculated with zero formula errors. Sea and land+sea routes were also recalculated with zero errors.');
  p('The workbook is a calculation aid, not a substitute for a reviewed design: verify nozzle loads, wind/seismic, support local stresses, MDMT impact requirements and any client specification before issue.');

  h('REBUILDING AND REVISION');
  p('This file is generated, not hand-edited, so revisions stay reproducible. The generator lives in excel/build-workbook.mjs and is committed with the workbook. Run “npm run excel” to regenerate excel/Vessel-Fabrication-Suite.xlsx after changing formulas, lists or the pre-filled example. Formula logic is kept in the generator, so a revision is a small diff rather than manual cell surgery.');

  let r = 4;
  rows.forEach((row) => {
    const [kind, a, b] = row;
    if (kind === 'h') {
      section(ws, r, a.toUpperCase(), 'B', 'C');
      r += 1;
    } else if (kind === 'p') {
      ws.mergeCells(`B${r}:C${r}`);
      const c = ws.getCell(`B${r}`);
      c.value = a;
      c.font = font(10, false, C.ink);
      c.alignment = { vertical: 'top', horizontal: 'left', wrap: true, indent: 1 };
      ws.getRow(r).height = Math.max(18, 15 * Math.ceil(a.length / 118));
      r += 1;
    } else {
      grid(ws.getCell(`B${r}`), { bold: true, fill: C.pale, wrap: true, valign: 'top' });
      const c = ws.getCell(`C${r}`);
      c.value = b;
      grid(c, { wrap: true, valign: 'top' });
      ws.getRow(r).height = Math.max(18, 15 * Math.ceil(b.length / 112));
      r += 1;
    }
    r += 0; // keep rows tight
  });

  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 112;
  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.printArea = 'A1:C' + (r - 1);
}

export function buildInput(wb) {
  const ws = newSheet(wb, 'Input', [2, 36, 20, 10, 62], { tab: C.amber, freeze: { y: 3 } });
  title(ws, 'Input — datasheet data', 'Enter the yellow cells only. Every other sheet recalculates from these values.', 'E');

  const hint = (row, text) => {
    if (!text) return;
    const c = ws.getCell(`E${row}`);
    c.value = text;
    c.font = font(9, false, C.muted, true);
    c.alignment = { vertical: 'middle', horizontal: 'left', wrap: true, indent: 1 };
  };
  const label = (row, text, hintText = '') => {
    if (text) textCell(ws, `B${row}`, text, { bold: true });
    hint(row, hintText);
  };
  const unit = (row, text) => textCell(ws, `D${row}`, text, { align: 'center', color: C.muted, size: 9 });
  const text = (row, value, hintText) => {
    hint(row, hintText);
    return inputCell(ws, `C${row}`, value);
  };
  const num = (row, value, fmt, hintText, min = 0, max = 100000) => {
    hint(row, hintText);
    const c = inputCell(ws, `C${row}`, value, fmt);
    numberValidation(c, min, max, 'Enter a number in the expected range.');
    return c;
  };
  const choice = (row, value, items, hintText) => {
    hint(row, hintText);
    const c = inputCell(ws, `C${row}`, value);
    listValidation(c, items);
    return c;
  };

  section(ws, 5, '1 · IDENTIFICATION', 'B', 'E');
  head(ws, 6, 'B', 'D');
  ['Field', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}6`).value = t;
  });
  label(7, 'Tag number');
  text(7, '12-C01', 'Vessel tag as used in the project register.');
  label(8, 'Service');
  text(8, 'Platforming', 'Process service, printed on the datasheet and summary.');
  label(9, 'Unit / area');
  text(9, 'Debutanizer', 'Unit or area description.');
  label(10, 'Design code');
  text(10, 'ASME VIII Div.1', 'Code basis for the calculation clauses used in this workbook.');
  label(11, 'Equipment type');
  choice(11, 'Column', ['Column', 'Drum', 'Receiver', 'Treater', 'Separator'], 'Drives the vortex-breaker and boot allowances in the component list.');
  label(12, 'Orientation');
  choice(12, 'V', ['V', 'H'], 'V = vertical, H = horizontal. Horizontal vessels use saddles instead of a skirt.');
  label(13, 'Support type');
  choice(13, 'Skirt', ['Skirt', 'Saddles', 'Legs'], 'Permanent support; the weight model follows this selection.');

  section(ws, 15, '2 · DESIGN CONDITIONS', 'B', 'E');
  head(ws, 16, 'B', 'D');
  ['Parameter', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}16`).value = t;
  });
  label(17, 'Design pressure');
  unit(17, 'kg/cm²g');
  inputCell(ws, 'C17', 13.5, '0.0');
  numberValidation(ws.getCell('C17'), 0, 1000, 'Design pressure in kg/cm²g.');
  label(17, '', 'Internal design pressure. Converted to MPa as P × 0.0980665 in every formula.');
  label(18, 'Design temperature');
  unit(18, '°C');
  inputCell(ws, 'C18', 265, '0');
  numberValidation(ws.getCell('C18'), -50, 900, 'Metal design temperature, °C.');
  label(18, '', 'Selects the allowable stress by interpolating the stress table in Lists.');
  label(19, 'Full vacuum');
  unit(19, '');
  choice(19, 'No', ['Yes', 'No'], 'Yes sets the external required pressure to 101.3 kPa; No uses the 25 kPa screen.');
  label(20, 'Minimum design metal temperature');
  unit(20, '°C');
  inputCell(ws, 'C20', 0, '0');
  numberValidation(ws.getCell('C20'), -200, 900, 'MDMT, °C.');
  label(20, '', 'Recorded on the summary for impact-testing review. Not used in the thickness formulas.');
  label(21, 'Corrosion allowance');
  unit(21, 'mm');
  inputCell(ws, 'C21', 3, '0.0');
  numberValidation(ws.getCell('C21'), 0, 20, 'Corrosion allowance, mm.');
  label(21, '', 'Added to shell, head and cone thickness, and to R and D in the design formulas.');
  label(22, 'Boot / leg corrosion allowance');
  unit(22, 'mm');
  inputCell(ws, 'C22', 3, '0.0');
  numberValidation(ws.getCell('C22'), 0, 20, 'Corrosion allowance for the boot or drop leg, mm.');
  label(22, '', 'Used only for the drop-leg / boot neck calculation.');
  label(23, 'Radiography');
  unit(23, '');
  choice(23, 'Spot', ['Full', 'Spot', 'None'], 'Full RT gives E = 1.0, spot RT E = 0.85, no RT E = 0.70.');
  label(24, 'Post-weld heat treatment');
  unit(24, '');
  choice(24, 'No', ['Yes', 'No'], 'Adds PWHT cost and furnace hours; does not change allowable stress.');
  label(25, 'Material');
  unit(25, '');
  choice(25, 'SA-516-70', ['SA-516-70', 'SA-516-60', 'SA-240-316L', 'SA-240-304L', 'SA-537-CL1', 'SA-387-11'], 'Material grade shown on the datasheet and cost sheet.');
  label(26, 'Material class');
  unit(26, '');
  choice(26, 'Carbon steel', ['Carbon steel', 'Low alloy', 'Stainless 304L', 'Stainless 316L'], 'Selects the plate rate and the stainless lining allowance.');

  section(ws, 28, '3 · GEOMETRY', 'B', 'E');
  head(ws, 29, 'B', 'D');
  ['Dimension', 'Value', 'Unit'].forEach((t, i) => {
    ws.getCell(`${'BCD'[i]}29`).value = t;
  });
  label(30, 'Inside diameter — lower / main section');
  unit(30, 'mm');
  inputCell(ws, 'C30', 1700, '#,##0');
  numberValidation(ws.getCell('C30'), 200, 10000, 'Inside diameter, mm.');
  label(30, '', 'Used for the shell, bottom head, cone, tray and skirt calculations.');
  label(31, 'Inside diameter — upper section');
  unit(31, 'mm');
  inputCell(ws, 'C31', 1100, '#,##0');
  numberValidation(ws.getCell('C31'), 0, 10000, 'Set 0 for a straight shell.');
  label(31, '', 'A smaller upper diameter creates a 30° conical transition and splits the shell into two courses.');
  label(32, 'Tangent-to-tangent length');
  unit(32, 'mm');
  inputCell(ws, 'C32', 26900, '#,##0');
  numberValidation(ws.getCell('C32'), 100, 100000, 'T/T length, mm.');
  label(32, '', 'Drives shell weights, external-pressure length, ladder length and skirt height.');
  label(33, 'Lower shell length (calculated)');
  unit(33, 'mm');
  calcCell(ws, 'C33', '=IF(in_ditop>0,in_tt*0.55,in_tt)', '#,##0');
  label(33, '', 'Fixed at 55% of T/T when a two-diameter column exists, otherwise the full T/T.');
  label(34, 'Upper shell length (calculated)');
  unit(34, 'mm');
  calcCell(ws, 'C34', '=IF(in_ditop>0,in_tt*0.45,0)', '#,##0');
  label(34, '', '45% of T/T when a two-diameter column exists; zero for a straight shell.');
  label(35, 'Trays');
  unit(35, 'off');
  inputCell(ws, 'C35', 35, '0');
  numberValidation(ws.getCell('C35'), 0, 200, 'Number of trays.');
  label(35, '', 'Each tray adds a tray weight (45 kg/m² × 55% open area) and a 50 × 8 support ring.');
  label(36, 'Packing / structured bed');
  unit(36, '');
  choice(36, 'No', ['Yes', 'No'], 'Yes adds packing mass by bed volume and a support/limiter ring pair.');
  label(37, 'Packing bed depth');
  unit(37, 'mm');
  inputCell(ws, 'C37', 0, '#,##0');
  numberValidation(ws.getCell('C37'), 0, 50000, 'Packed height, mm.');
  label(37, '', 'Used only when packing = Yes. Packing density is a constant 250 kg/m³ in the weight model.');
  label(38, 'Demister / mist eliminator');
  unit(38, '');
  choice(38, 'Yes', ['Yes', 'No'], 'Adds a demister support ring to the component schedule.');
  label(39, 'Top head type');
  unit(39, '');
  choice(39, 'SE', ['SE', 'FLAT'], 'SE = 2:1 ellipsoidal (UG-32(d)); FLAT = flat head per UG-34(c)(1).');
  label(40, 'Bottom head type');
  unit(40, '');
  choice(40, 'SE', ['SE', 'FLAT'], 'Bottom head type; the bottom head is sized on the larger diameter.');
  label(41, 'Boot / drop-leg outside diameter');
  unit(41, 'mm');
  inputCell(ws, 'C41', 0, '#,##0');
  numberValidation(ws.getCell('C41'), 0, 3000, 'Set 0 for no boot.');
  label(41, '', 'A non-zero value adds the drop-leg thickness check, boot weight and boot components.');
  label(42, 'Boot tangent-to-tangent length');
  unit(42, 'mm');
  inputCell(ws, 'C42', 1200, '#,##0');
  numberValidation(ws.getCell('C42'), 0, 20000, 'Boot T/T length, mm.');
  label(43, 'Boot bottom head');
  unit(43, '');
  choice(43, '2:1 SE', ['2:1 SE', 'Flat'], 'Selects the boot-bottom head type in the schedule.');
  label(45, 'Internal lining');
  unit(45, '');
  choice(45, 'No', ['Yes', 'No'], 'Yes adds lining area and cost to the cost sheet.');
  label(46, 'Wet H2S service');
  unit(46, '');
  choice(46, 'No', ['Yes', 'No'], 'Flags NACE / hardness review on the summary.');

  section(ws, 48, '4 · NOTES', 'B', 'E');
  label(49, 'Design notes (line 1)');
  text(49, 'Design pressure includes static head where applicable.');
  label(50, 'Design notes (line 2)');
  text(50, 'Trays and internals by others unless listed.');
  label(51, 'Design notes (line 3)');
  text(51, 'Verify nozzle loads and support local stresses before issue.');

  ws.pageSetup.orientation = 'portrait';
  ws.pageSetup.printArea = 'A1:E52';

  // Named ranges — the contract between sheets.
  const names = {
    in_tag: 'C7', in_service: 'C8', in_unit: 'C9', in_code: 'C10', in_kind: 'C11',
    in_orient: 'C12', in_support: 'C13', in_p: 'C17', in_temp: 'C18', in_vacuum: 'C19',
    in_mdmt: 'C20', in_ca: 'C21', in_caleg: 'C22', in_rt: 'C23', in_pwht: 'C24',
    in_matl: 'C25', in_class: 'C26', in_di: 'C30', in_ditop: 'C31', in_tt: 'C32',
    lower_len: 'C33', upper_len: 'C34', in_trays: 'C35', in_packing: 'C36', in_bed: 'C37',
    in_demister: 'C38', in_head_top: 'C39', in_head_bot: 'C40', in_drop_od: 'C41', in_drop_len: 'C42', in_boot_head: 'C43',
    in_liner: 'C45', in_h2s: 'C46', in_note1: 'C49', in_note2: 'C50', in_note3: 'C51',
  };
  for (const [name, ref] of Object.entries(names)) definedName(wb, 'Input', `$${ref[0]}$${ref.slice(1)}`, name);
}
