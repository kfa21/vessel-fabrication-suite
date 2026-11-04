// Generates excel/Vessel-Fabrication-Suite.xlsx.
// Run: npm run excel
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { buildReadme, buildInput } from './lib/readme-input.mjs';
import { buildDesign } from './lib/design.mjs';
import { buildNozzles } from './lib/nozzles.mjs';
import { buildWeights, buildComponents } from './lib/weights-components.mjs';
import { buildWeld, buildCost } from './lib/weld-cost.mjs';
import { buildSummary, buildFleet } from './lib/summary-fleet.mjs';
import { buildLists } from './lib/lists.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fleet = JSON.parse(fs.readFileSync(path.join(here, 'fleet.json'), 'utf8'));

const wb = new ExcelJS.Workbook();
wb.creator = 'Vessel Fabrication Suite';
wb.lastModifiedBy = 'Vessel Fabrication Suite';
wb.calcProperties.fullCalcOnLoad = true;
wb.calcProperties.calcMode = 'auto';

buildReadme(wb);
buildInput(wb);
buildDesign(wb);
buildNozzles(wb);
buildWeights(wb);
buildComponents(wb);
buildWeld(wb);
buildCost(wb);
buildSummary(wb);
buildFleet(wb, fleet);
buildLists(wb);

const out = path.join(here, 'Vessel-Fabrication-Suite.xlsx');
await wb.xlsx.writeFile(out);
console.log(`Wrote ${path.relative(process.cwd(), out)} (${wb.worksheets.length} sheets, ${wb.definedNames.model.length} defined names)`);
