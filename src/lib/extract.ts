import type { Vessel, HeadKind, Orientation, SupportKind } from '../data/vessels';

/** A single value lifted out of a document, with where it came from and how sure we are. */
export interface Extraction {
  field: keyof Vessel;
  label: string;
  value: string | number | boolean;
  raw: string;
  confidence: 'high' | 'medium' | 'low';
}

type Pair = [string, string];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Label aliases seen in shop datasheets, UOP spec sheets and spreadsheet exports. */
const ALIASES: { field: keyof Vessel; label: string; keys: string[] }[] = [
  { field: 'id', label: 'Equipment tag', keys: ['equipment id', 'equipment no', 'equipment number', 'tag', 'tag no', 'item no', 'item number', 'equipment tag'] },
  { field: 'service', label: 'Service', keys: ['service', 'service description', 'description', 'equipment name', 'name'] },
  { field: 'kind', label: 'Equipment type', keys: ['equipment type', 'type', 'construction', 'equipment category'] },
  { field: 'orientation', label: 'Orientation', keys: ['orientation', 'axis', 'position'] },
  { field: 'p', label: 'Design pressure', keys: ['design pressure', 'design pressure kg/cm2', 'design pressure kg/cm2g', 'internal design pressure', 'dp'] },
  { field: 'designTempC', label: 'Design temperature', keys: ['design temperature', 'design temp', 'design temperature c', 'dt'] },
  { field: 'mdmtC', label: 'MDMT', keys: ['mdmt', 'minimum design metal temperature', 'minimum metal temperature'] },
  { field: 'ca', label: 'Corrosion allowance', keys: ['corrosion allowance', 'corrosion allowance mm', 'ca', 'ca mm'] },
  { field: 'di', label: 'Inside diameter', keys: ['inside diameter', 'inside diameter mm', 'id', 'id mm', 'diameter', 'dia', 'di', 'di mm'] },
  { field: 'diTop', label: 'Upper inside diameter', keys: ['top inside diameter', 'upper inside diameter', 'top id', 'upper id'] },
  { field: 'tt', label: 'T/T length', keys: ['t t length', 'tt', 'tt length', 'tangent to tangent', 'tangent to tangent length', 'length', 'overall length', 'shell length'] },
  { field: 'headTop', label: 'Top head', keys: ['top head', 'top head type', 'top dished end', 'top dish end', 'top end'] },
  { field: 'headBot', label: 'Bottom head', keys: ['bottom head', 'bottom head type', 'bottom dished end', 'bottom dish end', 'bottom end'] },
  { field: 'support', label: 'Support', keys: ['support', 'support type', 'external support'] },
  { field: 'asmeClass', label: 'Nozzle / flange class', keys: ['nozzle class', 'flange class', 'flange rating', 'class', 'rating'] },
  { field: 'rtPolicy', label: 'Radiography', keys: ['radiography', 'rt', 'rt policy', 'radiographic examination', 'nde'] },
  { field: 'pwhtRequired', label: 'PWHT required', keys: ['pwht', 'post weld heat treatment', 'heat treatment', 'pwht required'] },
  { field: 'vacuum', label: 'Full vacuum', keys: ['vacuum', 'full vacuum', 'external pressure', 'vacuum design'] },
  { field: 'trays', label: 'Number of trays', keys: ['number of trays', 'no of trays', 'trays', 'tray count', 'no of sieve trays', 'number of valve trays'] },
  { field: 'trayType', label: 'Tray type', keys: ['tray type', 'tray description', 'internals'] },
  { field: 'packing', label: 'Packing', keys: ['packing', 'packing type', 'random packing', 'structured packing'] },
  { field: 'bedDepth', label: 'Bed depth', keys: ['bed depth', 'catalyst bed depth', 'bed height'] },
  { field: 'nll', label: 'Nozzle projection (NLL)', keys: ['nll', 'nozzle projection', 'nozzle length', 'tangent line to face of flange'] },
  { field: 'sg', label: 'Design specific gravity', keys: ['specific gravity', 'design specific gravity', 'sg', 'liquid sg'] },
  { field: 'h2s', label: 'Wet H₂S service', keys: ['h2s', 'wet h2s', 'sour service', 'nace'] },
  { field: 'liner', label: 'Liner / cladding', keys: ['liner', 'cladding', 'internal lining', 'lining'] },
];

/** Drawings put the same label in a dozen spellings; match on containment, longest key first. */
const SORTED = [...ALIASES].sort((a, b) => {
  const la = Math.max(...a.keys.map((k) => k.length));
  const lb = Math.max(...b.keys.map((k) => k.length));
  return lb - la;
});

function findAlias(label: string): (typeof ALIASES)[number] | undefined {
  const key = norm(label);
  if (!key || key.length > 70) return undefined;
  for (const a of SORTED) {
    if (a.keys.includes(key)) return a;
  }
  for (const a of SORTED) {
    for (const k of a.keys) {
      if (k.length < 3) continue;
      if (new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(key)) return a;
    }
  }
  return undefined;
}

function toNumber(s: string): number | undefined {
  const m = s.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return undefined;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

function toYesNo(s: string): boolean | undefined {
  const t = norm(s);
  if (/^(y|yes|true|required|req|applicable)\b/.test(t)) return true;
  if (/^(n|no|false|not required|na|n a|not applicable|none)\b/.test(t)) return false;
  return undefined;
}

function toHead(s: string): HeadKind | undefined {
  const t = norm(s);
  if (/flat|flanged flat|blind/.test(t)) return 'FLAT';
  if (/cone|conical/.test(t)) return 'CONE';
  if (/elliptical|ellipsoidal|2 1|2:1|torispher|dished|se/.test(t)) return 'SE';
  return undefined;
}

function toOrientation(s: string): Orientation | undefined {
  const t = norm(s);
  if (/^(v|vert|vertical)/.test(t)) return 'V';
  if (/^(h|horiz|horizontal)/.test(t)) return 'H';
  return undefined;
}

function toSupport(s: string): SupportKind | undefined {
  const t = norm(s);
  if (/skirt/.test(t)) return 'Skirt';
  if (/leg|column support/.test(t)) return 'Legs';
  if (/saddle/.test(t)) return 'Saddles';
  return undefined;
}

function toKind(s: string): Vessel['kind'] | undefined {
  const t = norm(s);
  if (/column|tower/.test(t)) return 'Column';
  if (/drum/.test(t)) return 'Drum';
  if (/receiver|accumulator/.test(t)) return 'Receiver';
  if (/treater/.test(t)) return 'Treater';
  if (/separator|ko drum|knock/.test(t)) return 'Separator';
  return undefined;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Drawings put the unit in the label ("DESIGN PRESSURE, BARG") as often as in the
// value ("42 barg"), so every conversion looks at both.
const both = (value: string, ctx: string) => `${norm(value)} ${norm(ctx)}`;

function toPressure(s: string, ctx = ''): number | undefined {
  const n = toNumber(s);
  if (n === undefined) return undefined;
  const t = both(s, ctx);
  if (/\bmpa\b/.test(t)) return r3(n * 10.1972);
  if (/\bkpa\b/.test(t)) return r3(n * 0.0101972);
  if (/\bpsi/.test(t)) return r3(n * 0.070307);
  if (/\bbar\b|\bbarg\b|\bbara\b/.test(t)) return r3(n * 1.01972);
  return n;
}

function toTempC(s: string, ctx = ''): number | undefined {
  const n = toNumber(s);
  if (n === undefined) return undefined;
  const t = both(s, ctx);
  if (/°?\s*f\b|deg\s*f\b|fahrenheit/.test(t)) return r3(((n - 32) * 5) / 9);
  return n;
}

function toLengthMm(s: string, ctx = ''): number | undefined {
  const n = toNumber(s);
  if (n === undefined) return undefined;
  if (/["″]/.test(s) || /\b(in|inch|inches|in\.)\s*$/.test(s.trim())) return r3(n * 25.4);
  const c = norm(ctx);
  if (/\b(in|inch|inches|ins|in\.)\b/.test(c) && !/mm|millimet/.test(c)) return r3(n * 25.4);
  if (/\bm\b|\bmeter/.test(norm(s)) || (/\bm\b|\bmeter/.test(c) && !/mm|millimet/.test(c))) return r3(n * 1000);
  return n;
}

/** Convert a raw cell into the typed value the vessel model expects. */
function coerce(field: keyof Vessel, raw: string, ctx = ''): string | number | boolean | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  switch (field) {
    case 'p':
      return toPressure(v, ctx);
    case 'designTempC':
    case 'mdmtC':
      return toTempC(v, ctx);
    case 'ca':
    case 'di':
    case 'diTop':
    case 'tt':
    case 'nll':
    case 'bedDepth':
      return toLengthMm(v, ctx);
    case 'h2s':
      return toYesNo(v);
    case 'sg':
      return toNumber(v);
    case 'trays':
      return toNumber(v);
    case 'trayType':
    case 'packing':
    case 'liner':
      return v;
    case 'id':
    case 'service':
      return v;
    case 'kind':
      return toKind(v);
    case 'orientation':
      return toOrientation(v);
    case 'support':
      return toSupport(v);
    case 'headTop':
    case 'headBot':
      return toHead(v);
    case 'pwhtRequired':
    case 'vacuum':
      return toYesNo(v);
    case 'rtPolicy': {
      const t = norm(v);
      if (/full|100/.test(t)) return 'Full';
      if (/spot|partial|sample/.test(t)) return 'Spot';
      return undefined;
    }
    case 'asmeClass':
      return toNumber(v);
    default:
      return toNumber(v);
  }
}

/** Build extractions from label/value pairs — the shape of a real datasheet spreadsheet. */
export function extractFromPairs(pairs: Pair[]): Extraction[] {
  const out: Extraction[] = [];
  const seen = new Set<string>();
  pairs.forEach(([label, value]) => {
    const key = norm(label);
    if (!key || !value || !value.trim()) return;
    if (/^(project|client|drawing|dwg|rev|revision|sheet|scale|date|checked|approved|prepared)\b/.test(key)) return;
    const hit = findAlias(label);
    if (!hit) return;
    if (seen.has(hit.field)) return;
    const val = coerce(hit.field, value, label);
    if (val === undefined) return;
    seen.add(hit.field);
    out.push({ field: hit.field, label: hit.label, value: val, raw: `${label}: ${value}`, confidence: 'high' });
  });
  return out;
}

/** Split a CSV/TSV dump into label/value pairs. */
export function pairsFromDelimited(text: string): Pair[] {
  const lines = text.split(/\r?\n/);
  const pairs: Pair[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(/\t|,(?![^(]*\))|;/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length >= 2) pairs.push([cells[0], cells.slice(1).join(' ')]);
  }
  return pairs;
}

/** Regex fallback for prose specs, drawing notes and pasted PDF text. */
export function extractFromFreeText(text: string): Extraction[] {
  const out: Extraction[] = [];
  const push = (field: keyof Vessel, label: string, raw: string, value: string | number | boolean | undefined) => {
    if (value === undefined) return;
    if (out.some((e) => e.field === field)) return;
    out.push({ field, label, value, raw: raw.trim().slice(0, 90), confidence: 'medium' });
  };
  const grab = (re: RegExp) => text.match(re)?.[1];

  const tag = grab(/\b(\d{2}-[A-Z]\d{2}[A-Z]?)\b/);
  if (tag) push('id', 'Equipment tag', tag, tag);

  push('p', 'Design pressure', grab(/(?:design\s*pressure|internal\s*design\s*pressure)[^\d-]{0,24}(-?\d+(?:\.\d+)?)/i) ?? '',
    toNumber(grab(/(?:design\s*pressure|internal\s*design\s*pressure)[^\d-]{0,24}(-?\d+(?:\.\d+)?)/i) ?? ''));
  const dt = grab(/(?:design\s*temperature|design\s*temp)[^\d-]{0,24}(-?\d+(?:\.\d+)?)/i);
  push('designTempC', 'Design temperature', dt ?? '', toNumber(dt ?? ''));
  const mdmt = grab(/(?:mdmt|minimum\s*design\s*metal\s*temperature)[^\d-]{0,24}(-?\d+(?:\.\d+)?)/i);
  push('mdmtC', 'MDMT', mdmt ?? '', toNumber(mdmt ?? ''));
  const ca = grab(/(?:corrosion\s*allowance|ca)[^\d-]{0,16}(\d+(?:\.\d+)?)/i);
  push('ca', 'Corrosion allowance', ca ?? '', toNumber(ca ?? ''));

  // Drawings state the size as "2400 ID x 7200 T/T" or "SIZE 2400 x 7200" instead of labelled
  // fields. This has to run before the plain "ID" rule, or the x 7200 gets taken as the diameter.
  const sizeMatch = text.match(/(?:size|shell\s*size|dimension)[^\d]{0,12}(\d{3,5})\s*(?:mm)?\s*(?:id|i\/d)?\s*[x×]\s*(\d{3,6})/i)
    ?? text.match(/(\d{3,5})\s*(?:mm)?\s*(?:id|i\/d|inside\s*dia)[^\d]{0,6}[x×][^\d]{0,6}(\d{3,6})/i);
  if (sizeMatch) {
    push('di', 'Inside diameter', sizeMatch[0], toNumber(sizeMatch[1]));
    push('tt', 'T/T length', sizeMatch[0], toNumber(sizeMatch[2]));
  }

  const di = sizeMatch ? null : grab(/(?:inside\s*diameter|internal\s*diameter|\bID\b|Ø)[^\d-]{0,12}(\d+(?:\.\d+)?)/i);
  if (di) push('di', 'Inside diameter', di, toNumber(di));
  const tt = grab(/(?:tangent\s*to\s*tangent|T\/T|\bTT\b)[^\d-]{0,12}(\d+(?:\.\d+)?)/i);
  push('tt', 'T/T length', tt ?? '', toNumber(tt ?? ''));

  const head = grab(/\b(2:1\s*ellipsoidal|2:1\s*elliptical|elliptical|ellipsoidal|torispherical|hemispherical|flat)\b/i);
  if (head) push('headTop', 'Top head', head, toHead(head));
  push('orientation', 'Orientation', grab(/\b(vertical|horizontal)\b/i) ?? '', toOrientation(grab(/\b(vertical|horizontal)\b/i) ?? ''));
  push('support', 'Support', grab(/\b(skirt|saddles?|legs?)\b/i) ?? '', toSupport(grab(/\b(skirt|saddles?|legs?)\b/i) ?? ''));
  const cls = grab(/(?:class|rating|CL)\s*(150|300|600|900|1500|2500)/i);
  push('asmeClass', 'Nozzle / flange class', cls ?? '', toNumber(cls ?? ''));
  const rt = grab(/\b(full|spot|partial)\s*(?:rt|radiography|radiographic)\b|\b(?:rt|radiography)\s*[:\-]?\s*(full|spot|partial)\b/i);
  if (rt) {
    const t = norm(rt);
    push('rtPolicy', 'Radiography', rt, /full/.test(t) ? 'Full' : 'Spot');
  }
  if (/pwht|post\s*weld\s*heat\s*treatment/i.test(text)) {
    const yes = /pwht\s*[:\-]?\s*(yes|required|y)\b|post\s*weld\s*heat\s*treatment\s*(is\s*)?required/i.test(text);
    const no = /pwht\s*[:\-]?\s*(no|not\s*required|n)\b/i.test(text);
    if (yes || no) push('pwhtRequired', 'PWHT required', yes ? 'required' : 'not required', yes);
  }
  return out;
}

/** Minimal XLSX reader — unzips the workbook and returns label/value pairs from the first sheet. */
export async function readXlsxPairs(file: File): Promise<Pair[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const files = await unzip(buf);
  const sheetKey = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k))
    ?? Object.keys(files).find((k) => /^xl\/worksheets\/.*\.xml$/.test(k));
  if (!sheetKey) throw new Error('No worksheet found in the workbook.');
  const sheet = decode(files[sheetKey]);
  const shared = files['xl/sharedStrings.xml'] ? decode(files['xl/sharedStrings.xml']) : '';

  const strings = Array.from(shared.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((m) =>
    Array.from(m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((t) => unescapeXml(t[1])).join(''),
  );

  const rows = Array.from(sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map((rm) =>
    Array.from(rm[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)).map((cm) => {
      const attrs = cm[1];
      const body = cm[2];
      const isStr = /t="s"/.test(attrs);
      const vMatch = body.match(/<v>([\s\S]*?)<\/v>/);
      if (isStr && vMatch) return strings[Number(vMatch[1])] ?? '';
      const inline = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      if (inline) return unescapeXml(inline[1]);
      return vMatch ? unescapeXml(vMatch[1]) : '';
    }).filter(Boolean),
  );

  const pairs: Pair[] = [];
  for (const row of rows) {
    if (row.length >= 2) pairs.push([row[0], row[1]]);
    // some sheets put label / value / label / value across one row
    for (let i = 2; i + 1 < row.length; i += 2) pairs.push([row[i], row[i + 1]]);
  }
  return pairs;
}

function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

const decoder = new TextDecoder('utf-8');
function decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Tiny ZIP reader (stored + deflate entries) using the browser's DecompressionStream. */
async function unzip(buf: Uint8Array): Promise<Record<string, Uint8Array>> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx (zip) file.');
  const entries = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const out: Record<string, Uint8Array> = {};

  for (let i = 0; i < entries; i++) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const compSize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const localOff = view.getUint32(off + 42, true);
    const name = decode(buf.subarray(off + 46, off + 46 + nameLen));

    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    out[name] = method === 0 ? data : await inflateRaw(data);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface DocRead {
  pairs: Pair[];
  text: string;
  /** Per-page text for PDFs — used to isolate the page that carries the target tag. */
  pages?: string[];
  pagePairs?: Pair[][];
  numPages?: number;
  /** PDF has no text layer: a scan or a drawing with outlined text. */
  scanned?: boolean;
}

/** Read any supported file into label/value pairs or free text. */
export async function readDocument(file: File): Promise<DocRead> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const pairs = await readXlsxPairs(file);
    return { pairs, text: pairs.map(([a, b]) => `${a}\t${b}`).join('\n') };
  }
  if (name.endsWith('.pdf')) {
    // Imported lazily so the calculator bundle does not carry pdf.js until a PDF is opened.
    const { readPdf } = await import('./pdf');
    const pdf = await readPdf(file);
    return { pairs: pdf.pairs, text: pdf.text, pages: pdf.pages, pagePairs: pdf.pagePairs, numPages: pdf.numPages, scanned: pdf.scanned };
  }
  const text = await file.text();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.xml')) {
    return { pairs: pairsFromDelimited(text), text };
  }
  return { pairs: [], text };
}

export const SUPPORTED_EXTENSIONS = ['xlsx', 'xlsm', 'pdf', 'csv', 'tsv', 'txt', 'md', 'json', 'xml', 'png', 'jpg', 'jpeg', 'webp'];

export function isImageFile(file: File): boolean {
  return /\.(png|jpe?g|webp)$/i.test(file.name) || /^image\//.test(file.type);
}

export function isPdfFile(file: File): boolean {
  return /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
}
