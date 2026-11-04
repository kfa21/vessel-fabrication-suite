// Shared styling + formula helpers for the vessel workbook generator.
// Colours are ARGB strings; all sheets use the same visual language.

export const C = {
  navy: 'FF1F3864',
  slate: 'FF2E4A62',
  pale: 'FFF3F5F8',
  input: 'FFFFF2CC',
  white: 'FFFFFFFF',
  line: 'FFC9D2DC',
  ink: 'FF1F2933',
  muted: 'FF5B6B7B',
  green: 'FF0B6E4F',
  greenFill: 'FFE3F4EC',
  amber: 'FF8A5A00',
  amberFill: 'FFFFF0C2',
  red: 'FF9B1C1C',
  redFill: 'FFFBE4E4',
};

export const font = (size = 10, bold = false, color = C.ink, italic = false) => ({
  name: 'Calibri',
  size,
  bold,
  italic,
  color: { argb: color },
});

const thin = { style: 'thin', color: { argb: C.line } };

export const colNum = (letters) =>
  [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

export const colName = (num) => {
  let s = '';
  let n = num;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export function grid(cell, o = {}) {
  cell.border = { top: thin, left: thin, bottom: thin, right: thin };
  cell.font = font(o.size ?? 10, !!o.bold, o.color ?? C.ink, !!o.italic);
  if (o.fill) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } };
  }
  cell.alignment = {
    vertical: o.valign ?? 'middle',
    horizontal: o.align ?? 'left',
    wrapText: !!o.wrap,
    indent: o.indent ?? 0,
  };
  if (o.fmt) cell.numFmt = o.fmt;
  return cell;
}

export function newSheet(wb, name, widths, o = {}) {
  const views = o.freeze
    ? [{ state: 'frozen', xSplit: o.freeze.x ?? 0, ySplit: o.freeze.y ?? 0 }]
    : [];
  const ws = wb.addWorksheet(name, {
    views,
    properties: { tabColor: { argb: o.tab ?? C.navy } },
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.properties.defaultRowHeight = 18;
  return ws;
}

export function title(ws, text, subtitle, lastCol = 'N') {
  ws.mergeCells(`A1:${lastCol}1`);
  const c = ws.getCell('A1');
  c.value = text;
  c.font = font(16, true, C.white);
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } };
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastCol}2`);
  const s = ws.getCell('A2');
  s.value = subtitle;
  s.font = font(9, false, C.muted, true);
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;
}

export function section(ws, row, text, from = 'B', to = 'N') {
  ws.mergeCells(`${from}${row}:${to}${row}`);
  const c = ws.getCell(`${from}${row}`);
  c.value = text;
  c.font = font(10, true, C.white);
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.slate } };
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(row).height = 20;
}

export function head(ws, row, from, to) {
  const a = colNum(from);
  const b = colNum(to);
  for (let n = a; n <= b; n += 1) {
    grid(ws.getCell(`${colName(n)}${row}`), {
      fill: C.slate,
      color: C.white,
      bold: true,
      align: 'center',
      wrap: true,
      size: 9,
    });
  }
  ws.getRow(row).height = 30;
}

export function inputCell(ws, ref, value, fmt = 'General') {
  const c = ws.getCell(ref);
  c.value = value;
  return grid(c, { fill: C.input, color: 'FF7A4E00', bold: true, fmt });
}

export function calcCell(ws, ref, formula, fmt = 'General', o = {}) {
  const c = ws.getCell(ref);
  c.value = { formula: String(formula).replace(/^=/, '') };
  return grid(c, { fill: o.fill ?? C.pale, fmt, bold: o.bold, align: o.align, wrap: o.wrap });
}

export function textCell(ws, ref, value, o = {}) {
  const c = ws.getCell(ref);
  c.value = value;
  return grid(c, o);
}

export function noteRow(ws, row, from, to, text) {
  ws.mergeCells(`${from}${row}:${to}${row}`);
  const c = ws.getCell(`${from}${row}`);
  c.value = text;
  c.font = font(9, false, C.muted, true);
  c.alignment = { vertical: 'top', horizontal: 'left', wrap: true, indent: 1 };
  ws.getRow(row).height = 26;
}

export function definedName(wb, sheet, ref, name) {
  wb.definedNames.add(`${sheet}!${ref}`, name);
}

export function listValidation(cell, items) {
  cell.dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${items.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: 'Invalid value',
    error: 'Pick a value from the drop-down list.',
  };
}

export function numberValidation(cell, min, max, hint) {
  cell.dataValidation = {
    type: 'decimal',
    operator: 'between',
    formulae: [min, max],
    allowBlank: true,
    showErrorMessage: true,
    errorTitle: 'Out of range',
    error: hint,
  };
}

// Next stocked plate gauge at or above `target` (gauges are sorted ascending).
export const ng = (target) => {
  const t = `(${target})`;
  const at = `INDEX(gauges,MATCH(${t},gauges,1))`;
  return (
    `IF(${t}<=MIN(gauges),MIN(gauges),` +
    `IF(${t}>MAX(gauges),CEILING(${t},5),` +
    `INDEX(gauges,MATCH(${t},gauges,1)+IF(${at}=${t},0,1))))`
  );
};

// Allowable stress: piecewise-linear interpolation over the temperature table.
export const S_FORMULA =
  'IF(in_temp<=INDEX(stress_t,1),INDEX(stress_s,1),' +
  'IF(in_temp>=INDEX(stress_t,ROWS(stress_t)),INDEX(stress_s,ROWS(stress_t)),' +
  'INDEX(stress_s,MATCH(in_temp,stress_t,1))+(in_temp-INDEX(stress_t,MATCH(in_temp,stress_t,1)))/' +
  '(INDEX(stress_t,MATCH(in_temp,stress_t,1)+1)-INDEX(stress_t,MATCH(in_temp,stress_t,1)))*' +
  '(INDEX(stress_s,MATCH(in_temp,stress_t,1)+1)-INDEX(stress_s,MATCH(in_temp,stress_t,1)))))';

// Nozzle status test (shared by the schedule and the summary count).
export const padStatus = (r) =>
  `IF($D${r}="","",IF($E${r}<=0,"",IF($R${r}<0,"PAD REQUIRED — pad larger than opening",IF($T${r}>0,"Pad required","Self-reinforced"))))`;

export function statusFormats(ws, ranges) {
  for (const [ref, text] of ranges) {
    ws.addConditionalFormatting({
      ref,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [`ISNUMBER(SEARCH("Pad required",${ref.split(':')[0]}))`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.amberFill } },
            font: { color: { argb: C.amber }, bold: true },
          },
        },
        {
          type: 'expression',
          priority: 2,
          formulae: [`ISNUMBER(SEARCH("Self-reinforced",${ref.split(':')[0]}))`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: C.greenFill } },
            font: { color: { argb: C.green } },
          },
        },
      ],
    });
  }
}
