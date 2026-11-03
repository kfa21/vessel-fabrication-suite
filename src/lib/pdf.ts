// PDF reading for the AI data-entry page.
//
// Datasheets and specification sheets carry a text layer, so they are read
// directly with pdf.js inside the browser — nothing is uploaded. Drawings are
// usually the awkward case: CAD exports keep their text layer but scatter it
// across the sheet, while scans have none at all. For the scattered case we
// rebuild reading rows from the text-item coordinates; for scans we can render
// the page to an image and let the AI reader look at it.

export interface PdfResult {
  numPages: number;
  /** One entry per page, reading order rebuilt from text-item geometry. */
  pages: string[];
  /** Label/value pairs recovered from row geometry (title blocks, datasheet columns). */
  pairs: [string, string][];
  /** The same pairs kept per page, so a multi-page drawing set can be narrowed to one sheet. */
  pagePairs: [string, string][][];
  text: string;
  /** True when the file has no usable text layer and must be read as an image. */
  scanned: boolean;
}

export type PdfItem = { str: string; x: number; y: number; w: number; h: number };

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [lib, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      lib.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
      return lib;
    })();
  }
  return pdfjsPromise;
}

const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

/** Group text items into visual rows (same baseline), ordered top-to-bottom, left-to-right. */
export function groupRows(items: PdfItem[]): PdfItem[][] {
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const rows: PdfItem[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    const ref = row?.[0];
    const tol = Math.max(2.5, (item.h || 8) * 0.4);
    if (ref && Math.abs(ref.y - item.y) <= tol) row.push(item);
    else rows.push([item]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

/** Label/value pairs from one visual row: title-block columns and "LABEL: value" text runs. */
export function pairsFromRow(row: PdfItem[]): [string, string][] {
  const out: [string, string][] = [];
  const cells = row.map((i) => clean(i.str)).filter(Boolean);
  if (cells.length === 0) return out;

  // "TAG NO.: 12-D05" style — label and value inside one text item.
  if (cells.length === 1) {
    const m = cells[0].match(/^(.{2,60}?)\s*[:\-–]\s*(.+)$/);
    if (m) out.push([m[1].trim(), m[2].trim()]);
    return out;
  }
  // Two cells side by side is the datasheet column layout.
  if (cells.length === 2) {
    out.push([cells[0], cells[1]]);
    return out;
  }
  // More cells: every left/right neighbour pair is worth testing. The alias
  // matcher decides which ones are real labels, so noisy pairs are harmless.
  for (let i = 0; i + 1 < cells.length; i++) out.push([cells[i], cells[i + 1]]);
  // A three-cell row where the last cell is the value: "Design pressure kg/cm2 42".
  if (cells.length === 3) out.push([`${cells[0]} ${cells[1]}`, cells[2]]);
  return out;
}

export async function readPdf(file: File): Promise<PdfResult> {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({ data });
  const doc = await task.promise;
  const pages: string[] = [];
  const pairs: [string, string][] = [];
  const pagePairs: [string, string][][] = [];
  let chars = 0;

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
      if (typeof it.str !== 'string' || !it.transform) continue;
      const str = clean(it.str);
      if (!str) continue;
      items.push({ str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0, h: it.height ?? 0 });
    }
    chars += items.reduce((a, i) => a + i.str.length, 0);

    const rows = groupRows(items);
    pages.push(rows.map((r) => r.map((i) => i.str).join('  ')).join('\n'));
    const local: [string, string][] = [];
    rows.forEach((r) => local.push(...pairsFromRow(r)));
    pagePairs.push(local);
    pairs.push(...local);
    page.cleanup();
  }

  await task.destroy();
  const text = pages.join('\n\n');
  return {
    numPages: pages.length,
    pages,
    pairs,
    pagePairs,
    text,
    // A datasheet page carries hundreds of characters. Under ~40 per page it is
    // an image-only scan or a drawing whose text is outlined.
    scanned: chars < pageless(pages.length),
  };
}

function pageless(n: number) {
  return Math.max(80, n * 40);
}

/** Render the first pages to JPEG data URLs so the AI reader can look at a scan or drawing. */
export async function pdfPagesToImages(file: File, maxPages = 3): Promise<string[]> {
  const lib = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = lib.getDocument({ data });
  const doc = await task.promise;
  const out: string[] = [];
  const count = Math.min(maxPages, doc.numPages);

  for (let n = 1; n <= count; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // Keep the long edge around 1600 px: enough to read a title block, small
    // enough to stay inside a vision request.
    const scale = Math.min(2.5, 1600 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot render PDF pages (no canvas 2D context).');
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas.toDataURL('image/jpeg', 0.85));
    page.cleanup();
  }

  await task.destroy();
  return out;
}

/** Read a raster drawing (PNG/JPG/WebP) as a data URL for the AI reader. */
export async function imageToDataUrl(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Image is larger than 8 MB — export a smaller scan.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}
