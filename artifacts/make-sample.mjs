import fs from 'node:fs';
const lines = [
  [60, 780, 'UOP PROJECT SPECIFICATION 301'], [60, 760, 'EQUIPMENT NO.'], [300, 760, '12-D05'],
  [60, 735, 'DESIGN PRESSURE, BARG'], [300, 735, '42'],
  [60, 710, 'DESIGN TEMPERATURE, DEG F'], [300, 710, '250'],
  [60, 685, 'MDMT'], [300, 685, '-29'],
  [60, 660, 'CORROSION ALLOWANCE, MM'], [300, 660, '3'],
  [60, 635, 'SIZE'], [300, 635, '2400 ID x 7200 T/T'],
  [60, 610, 'NOZZLE CLASS'], [300, 610, '600'],
  [60, 585, 'ORIENTATION'], [300, 585, 'HORIZONTAL'],
  [60, 560, 'SUPPORT'], [300, 560, 'SADDLES'],
  [60, 535, 'RADIOGRAPHY'], [300, 535, 'FULL'],
  [60, 510, 'TAG NO.: 12-D05'],
];
const esc = (t) => t.replace(/([()\\])/g, '\\$1');
const content = lines.map(([x, y, t]) => `BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${esc(t)}) Tj ET`).join('\n');
const objs = ['<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
  `<</Length ${Buffer.byteLength(content)}>>\nstream\n${content}\nendstream`];
let out = '%PDF-1.4\n'; const offs = [];
objs.forEach((o, i) => { offs.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = Buffer.byteLength(out);
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offs.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
out += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
fs.writeFileSync('artifacts/sample-datasheet.pdf', out);
console.log('sample PDF bytes:', Buffer.byteLength(out));
