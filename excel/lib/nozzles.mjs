import { C, newSheet, title, section, head, calcCell, textCell, noteRow, inputCell, grid, definedName, colName, ng } from './style.mjs';

// 12-C01 nozzle and manway schedule (mark, service, NPS, qty, flange class).
const SCHEDULE = [
  ['G01', 'Ventilation', 8, 1, null],
  ['I01', 'Reflux inlet', 3, 1, null],
  ['M01', 'Manway', 18, 1, 300],
  ['O01', 'Vapor outlet', 8, 1, null],
  ['V01', 'Vent', 2, 1, null],
  ['M02', 'Manway', 18, 1, 300],
  ['T03', 'TI / TIC', 2, 2, null],
  ['I04', 'Feed inlet', 8, 1, null],
  ['M04', 'Manway', 24, 1, 300],
  ['M05', 'Manway', 24, 1, 300],
  ['T05', 'TI', 2, 1, null],
  ['I06', 'Reboiler return', 14, 1, 300],
  ['L06', 'Level gauge', 2, 3, null],
  ['M06', 'Manway', 24, 1, 300],
  ['S06', 'Steam-out', 2, 1, null],
  ['W06', 'PG / PT', 2, 2, null],
  ['O07', 'Bottom outlet', 10, 1, 300],
];

export function buildNozzles(wb) {
  const widths = [5, 8, 24, 7, 6, 6, 7, 9, 8, 8, 8, 9, 8, 9, 9, 9, 10, 9, 10, 9, 9, 9, 8, 9, 11, 11, 17];
  const ws = newSheet(wb, 'Nozzles', widths, { tab: C.navy, freeze: { x: 3, y: 5 } });
  title(ws, 'Nozzles and manways — UG-37 reinforcement, pads, studs and weights', 'One row per nozzle mark. Delete unused rows. Yellow cells are inputs; the rest recalculates from the Design sheet and Lists.', 'AA');

  section(ws, 4, 'NOZZLE AND MANWAY SCHEDULE', 'A', 'AA');
  head(ws, 5, 'A', 'AA');
  const heads = [
    'No.', 'Mark', 'Service', 'NPS', 'Qty', 'CL', 'Class', 'OD (mm)', 'Wall (mm)', 't nom (mm)',
    'Neck L (mm)', 'd (mm)', 'tr (mm)', 'rn (mm)', 'trn (mm)', 'Ar (mm²)', 'A1 (mm²)', 'A2 (mm²)',
    'Available (mm²)', 'Shortfall / pad (mm²)', 'Pad width (mm)', 'Pad thk (mm)', 'Studs', 'Stud size',
    'Weight each (kg)', 'Total (kg)', 'Status',
  ];
  heads.forEach((t, i) => {
    ws.getCell(`${colName(i + 1)}5`).value = t;
  });

  for (let r = 6; r <= 25; r += 1) {
    const data = SCHEDULE[r - 6];
    const idx = r - 5;
    textCell(ws, `A${r}`, idx, { align: 'center', color: C.muted, size: 9 });
    inputCell(ws, `B${r}`, data ? data[0] : '');
    inputCell(ws, `C${r}`, data ? data[1] : '');
    inputCell(ws, `D${r}`, data ? data[2] : '', '0.0##');
    inputCell(ws, `E${r}`, data ? data[3] : '', '0');
    inputCell(ws, `F${r}`, data && data[4] ? data[4] : '', '0');
    ws.getCell(`D${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['nps_list'], showErrorMessage: true, errorTitle: 'Unknown size', error: 'Use an NPS from the Lists sheet.' };
    ws.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"150,300,400,600,900,1500,2500"'], showErrorMessage: true, errorTitle: 'Unknown class', error: 'Use an ASME B16.5 class.' };

    calcCell(ws, `G${r}`, `=IF($D${r}="","",IF($F${r}="",150,$F${r}))`, '0', { align: 'center' });
    calcCell(ws, `H${r}`, `=IF($D${r}="","",IFERROR(INDEX(nps_od,MATCH($D${r},nps_list,0)),"verify"))`, '0.0');
    calcCell(ws, `I${r}`, `=IF($D${r}="","",IF($G${r}=10,IFERROR(INDEX(sch20,MATCH($D${r},nps_list,0)),5),IF($G${r}=40,IFERROR(INDEX(sch40,MATCH($D${r},nps_list,0)),8),IF($G${r}=80,IFERROR(INDEX(sch80,MATCH($D${r},nps_list,0)),10),IF($G${r}=160,IFERROR(INDEX(sch80,MATCH($D${r},nps_list,0)),10)*1.4,IFERROR(INDEX(sch40,MATCH($D${r},nps_list,0)),8))))))`, '0.00');
    calcCell(ws, `J${r}`, `=I${r}`, '0.00');
    calcCell(ws, `K${r}`, `=IF($D${r}="","",MAX(150,2*$H${r}+20))`, '#,##0');
    calcCell(ws, `L${r}`, `=IF($D${r}="","",$H${r}-2*($J${r}+3))`, '0.0');
    calcCell(ws, `M${r}`, `=IF($D${r}="","",Design!$K$14)`, '0.00');
    calcCell(ws, `N${r}`, `=IF($D${r}="","",($H${r}-$J${r})/2)`, '0.00');
    calcCell(ws, `O${r}`, `=IF($D${r}="","",t_shell)`, '0.00');
    calcCell(ws, `P${r}`, `=IF($D${r}="","",$L${r}*$M${r})`, '#,##0');
    calcCell(ws, `Q${r}`, `=IF($D${r}="","",MAX(0,($O${r}-$M${r})*($L${r}+2*$J${r})))`, '#,##0');
    calcCell(ws, `R${r}`, `=IF($D${r}="","",MAX(0,2*($J${r}-$M${r})*$O${r}))`, '#,##0');
    calcCell(ws, `S${r}`, `=IF($D${r}="","",$Q${r}+$R${r})`, '#,##0');
    calcCell(ws, `T${r}`, `=IF($D${r}="","",MAX(0,$P${r}-$S${r}))`, '#,##0');
    calcCell(ws, `U${r}`, `=IF($D${r}="","",IF($T${r}>0,MAX(40,CEILING($T${r}/12,10)),0))`, '#,##0');
    calcCell(ws, `V${r}`, `=IF($D${r}="","",IF($U${r}>0,${ng(`$T${r}/(2*$U${r})`)},0))`, '0.0');
    calcCell(ws, `W${r}`, `=IF($D${r}="","",IFERROR(INDEX(stud_counts,MATCH($D${r},stud_nps,0),MATCH($G${r},stud_classes,0)),0))`, '0');
    calcCell(ws, `X${r}`, `=IF($D${r}="","",IFERROR(INDEX(stud_dia,MATCH($D${r},stud_nps,0)),"—"))`, 'General', { align: 'center' });
    calcCell(ws, `Y${r}`, `=IF($D${r}="","",IFERROR(INDEX(flange_mass,MATCH($D${r},flange_nps,1)),0)*IFERROR(INDEX(class_factor,MATCH($G${r},class_list,0)),1)+PI()*(($H${r}-$J${r})/1000)*($K${r}/1000)*$J${r}*rho/1000+2*$U${r}*($L${r}+$U${r})*$V${r}*rho/1000000000+$W${r}*0.25)`, '#,##0.0');
    calcCell(ws, `Z${r}`, `=IF($D${r}="","",$E${r}*$Y${r})`, '#,##0.0');
    calcCell(ws, `AA${r}`, `=IF($D${r}="","",IF($E${r}<=0,"",IF($T${r}>0,"Pad required","Self-reinforced")))`, 'General', { align: 'center' });
    ws.getRow(r).height = 20;
  }

  textCell(ws, 'B27', 'TOTAL', { bold: true, fill: C.pale });
  calcCell(ws, 'E27', '=SUM(E6:E25)', '0', { bold: true });
  calcCell(ws, 'W27', '=SUM(W6:W25)', '0', { bold: true });
  calcCell(ws, 'Z27', '=SUM(Z6:Z25)', '#,##0.0', { bold: true });
  for (const ref of ['B27', 'C27', 'D27', 'F27', 'G27', 'H27', 'I27', 'J27', 'K27', 'L27', 'M27', 'N27', 'O27', 'P27', 'Q27', 'R27', 'S27', 'T27', 'U27', 'V27', 'X27', 'Y27', 'Z27', 'AA27']) {
    grid(ws.getCell(ref), { fill: C.pale, bold: true });
  }

  noteRow(ws, 29, 'A', 'AA', 'UG-37 screen: required area Ar = d·tr. Available area is the excess in the shell (A1) plus the excess in the nozzle neck (A2). When available area is short, a reinforcing pad is sized two-sided: width from the shortfall at an assumed 6 mm plate, then thickness rounded to the next gauge. Stud counts and sizes come from the B16.5 table in Lists. Full UG-37 with fillet welds, repads on manways and external loads must be confirmed by the responsible engineer.');

  ws.addConditionalFormatting({
    ref: 'AA6:AA25',
    rules: [
      { type: 'expression', priority: 1, formulae: ['AA6="Pad required"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.amberFill } }, font: { color: { argb: C.amber }, bold: true } } },
      { type: 'expression', priority: 2, formulae: ['AA6="Self-reinforced"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.greenFill } }, font: { color: { argb: C.green } } } },
    ],
  });

  definedName(wb, 'Nozzles', '$E$6:$E$25', 'noz_qty');
  definedName(wb, 'Nozzles', '$D$6:$D$25', 'noz_nps');
  definedName(wb, 'Nozzles', '$Z$6:$Z$25', 'noz_weight');
  definedName(wb, 'Nozzles', '$AA$6:$AA$25', 'noz_status');
}
