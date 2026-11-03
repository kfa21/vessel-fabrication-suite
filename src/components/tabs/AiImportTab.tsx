import { useMemo, useRef, useState } from 'react';
import { Card, Note, Pill } from '../ui';
import type { Vessel } from '../../data/vessels';
import {
  extractFromFreeText,
  extractFromPairs,
  isImageFile,
  isPdfFile,
  pairsFromDelimited,
  readDocument,
  type DocRead,
  type Extraction,
} from '../../lib/extract';
import { imageToDataUrl, pdfPagesToImages } from '../../lib/pdf';

type Status = 'idle' | 'reading' | 'done' | 'error';

type FileInfo = {
  name: string;
  size: number;
  kind: 'pdf' | 'sheet' | 'text' | 'image';
  pages?: number;
  /** PDF with no text layer, or a raster drawing — only the AI reader can see it. */
  needsVision?: boolean;
};

const FIELD_HINT: Partial<Record<keyof Vessel, string>> = {
  p: 'kg/cm²(g)',
  designTempC: '°C',
  mdmtC: '°C',
  ca: 'mm',
  di: 'mm',
  diTop: 'mm',
  tt: 'mm',
  nll: 'mm',
  bedDepth: 'mm',
  asmeClass: 'class',
};

const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} kB` : `${(bytes / 1048576).toFixed(1)} MB`;

const AI_KEY_STORE = 'fb.ai.apiKey';
const AI_MODEL_STORE = 'fb.ai.model';
const AI_ENDPOINT_STORE = 'fb.ai.endpoint';

const SYSTEM_PROMPT =
  'You read pressure-vessel datasheets, equipment drawings and project specifications. ' +
  'Reply with JSON only, no prose and no code fences. Keys: id, service, kind (Column|Drum|Receiver|Treater|Separator), ' +
  'orientation (V|H), p (number, kg/cm2g), designTempC (number, C), mdmtC (number, C), ca (number, mm), di (number, mm), ' +
  'diTop (number, mm), tt (number, mm, tangent to tangent), headTop (SE|FLAT|CONE), headBot (SE|FLAT|CONE), ' +
  'support (Skirt|Legs|Saddles), asmeClass (150|300|600|900|1500|2500), rtPolicy (Full|Spot), ' +
  'pwhtRequired (boolean), vacuum (boolean), trays (number), h2s (boolean). ' +
  'Convert barg/psi/MPa to kg/cm2g, inches to mm and degF to degC. Omit keys you cannot determine.';

/** Turn a model reply into extraction rows, tolerating fences and stray prose. */
function fromAiText(text: string): Extraction[] {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The model did not return JSON.');
  const data = JSON.parse(match[0]) as Record<string, unknown>;
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([field, value]) => ({
      field: field as keyof Vessel,
      label: field,
      value: value as string | number | boolean,
      raw: `AI · ${field}`,
      confidence: 'medium' as const,
    }));
}

export default function AiImportTab({ fleet, selectedId, onSelect, onPatch }: {
  fleet: Vessel[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<Vessel>) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [targetId, setTargetId] = useState(selectedId);
  const [pasted, setPasted] = useState('');
  const [applied, setApplied] = useState(0);
  const [showAi, setShowAi] = useState(false);
  const [visionImages, setVisionImages] = useState<string[]>([]);
  const [visionSource, setVisionSource] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(AI_KEY_STORE) ?? '');
  const [model, setModel] = useState(() => localStorage.getItem(AI_MODEL_STORE) ?? 'gpt-4o-mini');
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem(AI_ENDPOINT_STORE) ?? 'https://api.openai.com/v1/chat/completions');
  const fileRef = useRef<HTMLInputElement>(null);

  const target = fleet.find((v) => v.id === targetId) ?? fleet[0];
  const accepted = useMemo(() => Object.keys(picked).filter((k) => picked[k]), [picked]);

  const acceptAll = (list: Extraction[]) =>
    setPicked(Object.fromEntries(list.map((e) => [e.field, true])));

  const merge = (list: Extraction[]) => {
    const rank = { high: 3, medium: 2, low: 1 } as const;
    const map = new Map<string, Extraction>();
    // A labelled pair from the title block beats a regex guess from the same page.
    [...extractions, ...list].forEach((e) => {
      const prev = map.get(e.field);
      if (!prev || rank[e.confidence] >= rank[prev.confidence]) map.set(e.field, e);
    });
    const merged = Array.from(map.values());
    setExtractions(merged);
    acceptAll(merged);
    // If the document names a tag we know, point the review table at that equipment.
    const tag = merged.find((e) => e.field === 'id');
    if (tag) {
      const hit = fleet.find((v) => v.id.toLowerCase() === String(tag.value).toLowerCase());
      if (hit) {
        setTargetId(hit.id);
        onSelect(hit.id);
      }
    }
  };

  /** Narrow a multi-page PDF to the sheet(s) carrying the selected tag, when that is unambiguous. */
  const pagesForTarget = (doc: DocRead, tag: string) => {
    if (!doc.pages || doc.pages.length < 2) return { pairs: doc.pairs, text: doc.text, note: '' };
    const needle = tag.toLowerCase();
    const hits = doc.pages
      .map((text, i) => (text.toLowerCase().includes(needle) ? i : -1))
      .filter((i) => i >= 0);
    if (hits.length !== 1) return { pairs: doc.pairs, text: doc.text, note: '' };
    const page = hits[0];
    return {
      pairs: doc.pagePairs?.[page] ?? [],
      text: doc.pages[page],
      note: ` Page ${page + 1} of ${doc.numPages} carries ${tag}, so only that sheet was read.`,
    };
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    setStatus('reading');
    setMessage('');
    const collected: Extraction[] = [];
    const meta: FileInfo[] = [];
    const images: string[] = [];
    const notes: string[] = [];
    let scannedName = '';

    try {
      for (const file of Array.from(fileList)) {
        if (isImageFile(file)) {
          meta.push({ name: file.name, size: file.size, kind: 'image', needsVision: true });
          images.push(await imageToDataUrl(file));
          scannedName = scannedName || file.name;
          continue;
        }
        if (isPdfFile(file)) {
          const doc = await readDocument(file);
          meta.push({ name: file.name, size: file.size, kind: 'pdf', pages: doc.numPages, needsVision: doc.scanned });
          if (doc.scanned) {
            scannedName = scannedName || file.name;
            notes.push(`${file.name} has no text layer (scan or outlined drawing text).`);
            // Render the sheets now so the vision read can be started straight away.
            try {
              images.push(...(await pdfPagesToImages(file, 3)));
            } catch {
              notes.push(' (Pages could not be rendered for the vision read.)');
            }
            continue;
          }
          const scope = pagesForTarget(doc, target.id);
          collected.push(...extractFromPairs(scope.pairs));
          collected.push(...extractFromFreeText(scope.text));
          if (scope.note) notes.push(scope.note);
          continue;
        }
        const kind = /\.(xlsx|xlsm|csv|tsv)$/i.test(file.name) ? 'sheet' : 'text';
        const doc = await readDocument(file);
        meta.push({ name: file.name, size: file.size, kind });
        collected.push(...(doc.pairs.length ? extractFromPairs(doc.pairs) : []));
        collected.push(...extractFromFreeText(doc.text));
      }

      setFiles((prev) => [...prev.filter((p) => !meta.some((m) => m.name === p.name)), ...meta]);
      // Keep the rendered pages of an earlier scan when this batch was text-readable.
      if (images.length) {
        setVisionImages(images);
        setVisionSource(scannedName);
      }

      if (!collected.length) {
        setStatus('done');
        setMessage(
          scannedName
            ? `${scannedName} is an image-only document — use “Read with AI vision” below, or paste the title-block text.`
            : 'No datasheet fields were recognised. Paste the drawing notes or spec text below and extract again.',
        );
        return;
      }
      merge(collected);
      setStatus('done');
      setMessage(
        `${collected.length} field${collected.length === 1 ? '' : 's'} recognised from ${meta.length} document${meta.length === 1 ? '' : 's'}.${notes.join('')}`,
      );
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const readPasted = () => {
    if (!pasted.trim()) return;
    const list = [
      ...extractFromFreeText(pasted),
      ...extractFromPairs(pasted.split(/\r?\n/).map((l) => {
        const [a, ...rest] = l.split(/\t|:|\s{2,}/);
        return [a ?? '', rest.join(' ').trim()] as [string, string];
      })),
      ...extractFromPairs(pairsFromDelimited(pasted)),
    ];
    if (!list.length) {
      setStatus('done');
      setMessage('Nothing recognised in the pasted text.');
      return;
    }
    merge(list);
    setStatus('done');
    setMessage(`${list.length} field${list.length === 1 ? '' : 's'} recognised from pasted text.`);
  };

  const checkKey = () => {
    if (!apiKey.trim()) {
      setStatus('error');
      setMessage('Add an API key under “Use AI reader” first — it is stored only in this browser.');
      return false;
    }
    return true;
  };

  const runAi = async () => {
    if (!checkKey()) return;
    if (!pasted.trim()) {
      setStatus('error');
      setMessage('Paste the drawing notes / datasheet text into the box first.');
      return;
    }
    setStatus('reading');
    setMessage('Asking the model to read the document…');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Extract the datasheet values for equipment ${target.id}.\n\n${pasted.slice(0, 12000)}` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Model returned ${res.status}. Check the key, model name and endpoint.`);
      const json = await res.json();
      const list = fromAiText(json.choices?.[0]?.message?.content ?? '');
      if (!list.length) throw new Error('The model found no fields.');
      merge(list);
      setStatus('done');
      setMessage(`${list.length} fields returned by the model. Review before applying.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'AI extraction failed.');
    }
  };

  /** Scanned PDFs and raster drawings: render the pages and let a vision model look at them. */
  const runVision = async () => {
    if (!checkKey()) return;
    setStatus('reading');
    setMessage('Rendering the sheet and asking the model to read it…');
    try {
      let images = visionImages;
      if (!images.length) throw new Error('Open a scanned PDF or a drawing image first.');
      images = images.slice(0, 3);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    `This is an equipment drawing / scanned datasheet for ${target.id}. ` +
                    'Read the title block, design data block and notes. Report the tag exactly as drawn if it differs.',
                },
                ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Model returned ${res.status}. The model may not accept images, or the key/endpoint is wrong.`);
      const json = await res.json();
      const list = fromAiText(json.choices?.[0]?.message?.content ?? '');
      if (!list.length) throw new Error('The model found no readable fields.');
      merge(list);
      setStatus('done');
      setMessage(`${list.length} fields read from ${visionSource || 'the drawing'}. Review before applying.`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Vision read failed.');
    }
  };

  const apply = () => {
    if (!accepted.length) return;
    const patch: Partial<Vessel> = {};
    accepted.forEach((field) => {
      const e = extractions.find((x) => x.field === field);
      if (e) (patch as Record<string, unknown>)[field] = e.value;
    });
    onPatch(target.id, patch);
    setApplied(accepted.length);
    setStatus('done');
    setMessage(`Applied ${accepted.length} field${accepted.length === 1 ? '' : 's'} to ${target.id}. All tabs recalculated.`);
    setExtractions([]);
    setPicked({});
  };

  const needsVision = files.some((f) => f.needsVision);

  return (
    <div className="ai">
      <Card title="AI data entry" sub="Read a PDF datasheet, equipment drawing, specification or spreadsheet and fill the datasheet automatically">
        <div className="ai-steps">
          <div className="ai-step">
            <span className="ai-step-no">1</span>
            <div>
              <b>Drop the document</b>
              <p>PDF, drawing image, XLSX or text. Text layers are read in the browser — the file is never uploaded.</p>
            </div>
          </div>
          <div className="ai-step">
            <span className="ai-step-no">2</span>
            <div>
              <b>Review what was found</b>
              <p>Every field shows its source and confidence. Multi-page PDFs are narrowed to the sheet carrying the tag.</p>
            </div>
          </div>
          <div className="ai-step">
            <span className="ai-step-no">3</span>
            <div>
              <b>Apply to the datasheet</b>
              <p>Values become overrides on the selected equipment and drive every calculation downstream.</p>
            </div>
          </div>
        </div>

        <div
          className="ai-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
        >
          <b>Drop datasheet, drawing or specification files here</b>
          <span>.pdf · .xlsx · .csv · .tsv · .txt · .png · .jpg — click to browse</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.json,.xml,.png,.jpg,.jpeg,.webp"
            style={{ display: 'none' }}
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="ai-files">
            {files.map((f) => (
              <span key={f.name} className={f.needsVision ? 'ai-file warn' : 'ai-file'}>
                {f.kind === 'pdf' ? 'PDF' : f.kind === 'image' ? 'DRAWING' : f.kind === 'sheet' ? 'SHEET' : 'TEXT'} · {f.name} · {fileSize(f.size)}
                {f.pages ? ` · ${f.pages} page${f.pages === 1 ? '' : 's'}` : ''}
                {f.needsVision ? ' · image only' : ''}
              </span>
            ))}
          </div>
        )}

        {(needsVision || visionImages.length > 0) && (
          <div className="ai-vision">
            <div className="ai-vision-head">
              <b>Scanned / drawing read</b>
              <span>{visionSource || 'the dropped file'} has no usable text layer, so the pages are read as images by a vision model.</span>
            </div>
            {visionImages.length > 0 ? (
              <div className="ai-thumbs">
                {visionImages.slice(0, 3).map((src, i) => (
                  <img key={i} src={src} alt={`Page ${i + 1}`} />
                ))}
              </div>
            ) : (
              <div className="small muted">Open the file again after a scan so the page images can be rendered.</div>
            )}
            <div className="ai-vision-actions">
              <button className="btn sm" onClick={() => void runVision()} disabled={status === 'reading' || !visionImages.length}>
                {status === 'reading' ? 'Reading…' : 'Read with AI vision'}
              </button>
              <span className="small muted">Uses the endpoint and key below; up to 3 pages per read.</span>
            </div>
          </div>
        )}

        <div className="ai-paste">
          <label>Or paste text from a PDF / drawing title block / specification clause</label>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            placeholder={'e.g. 12-D05  HP Separator\nDesign pressure 42 kg/cm2(g)\nDesign temperature 120 °C\nMDMT -29 °C\nCorrosion allowance 3 mm\nInside diameter 2400 mm\nT/T 7200 mm\n2:1 ellipsoidal heads, horizontal, saddles, class 600'}
          />
          <div className="ai-paste-actions">
            <button className="btn sm" onClick={readPasted}>Extract from text</button>
            <button className="btn sm" onClick={() => setShowAi((s) => !s)}>
              {showAi ? 'Hide AI reader' : 'Use AI reader'}
            </button>
          </div>
        </div>

        {showAi && (
          <div className="ai-config">
            <Note tone="cyan">
              The AI reader calls an OpenAI-compatible endpoint directly from this browser with your own key.
              The key is kept in this browser's local storage only — it is never written into the project or sent anywhere else.
              Image reads need a vision-capable model.
            </Note>
            <div className="ai-config-grid">
              <label>
                <span>API key</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); localStorage.setItem(AI_KEY_STORE, e.target.value); }}
                  placeholder="sk-…"
                />
              </label>
              <label>
                <span>Model</span>
                <input value={model} onChange={(e) => { setModel(e.target.value); localStorage.setItem(AI_MODEL_STORE, e.target.value); }} />
              </label>
              <label className="grow">
                <span>Endpoint</span>
                <input value={endpoint} onChange={(e) => { setEndpoint(e.target.value); localStorage.setItem(AI_ENDPOINT_STORE, e.target.value); }} />
              </label>
            </div>
            <button className="btn sm" onClick={() => void runAi()} disabled={status === 'reading'}>
              {status === 'reading' ? 'Reading…' : 'Run AI extraction on pasted text'}
            </button>
          </div>
        )}

        {(message || status === 'error') && (
          <div className={status === 'error' ? 'ai-msg err' : 'ai-msg'}>
            {message}
          </div>
        )}
      </Card>

      {extractions.length > 0 && (
        <Card
          title="Review extracted data"
          sub={`${extractions.length} field${extractions.length === 1 ? '' : 's'} found · ${accepted.length} selected`}
          right={
            <div className="ai-target">
              <select value={targetId} onChange={(e) => { setTargetId(e.target.value); onSelect(e.target.value); }}>
                {fleet.map((v) => <option key={v.id} value={v.id}>{v.id} — {v.service}</option>)}
              </select>
            </div>
          }
        >
          <div className="ai-table-wrap">
            <table className="ai-table">
              <thead>
                <tr>
                  <th className="ai-check"><input type="checkbox" checked={accepted.length === extractions.length} onChange={(e) => acceptAll(e.target.checked ? extractions : [])} /></th>
                  <th>Field</th>
                  <th>Extracted</th>
                  <th>Current on {target.id}</th>
                  <th>Source</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {extractions.map((e) => {
                  const current = (target as unknown as Record<string, unknown>)[e.field];
                  const changed = String(current) !== String(e.value);
                  return (
                    <tr key={String(e.field)} className={changed ? 'changed' : ''}>
                      <td><input type="checkbox" checked={Boolean(picked[e.field])} onChange={(ev) => setPicked((p) => ({ ...p, [e.field]: ev.target.checked }))} /></td>
                      <td>
                        <b>{e.label}</b>
                        <span className="mono small muted"> {String(e.field)}</span>
                      </td>
                      <td className="mono">{String(e.value)}{FIELD_HINT[e.field] ? ` ${FIELD_HINT[e.field]}` : ''}</td>
                      <td className="mono muted">{current === undefined ? '—' : String(current)}</td>
                      <td className="ai-src">{e.raw}</td>
                      <td><Pill tone={e.confidence === 'high' ? 'ok' : e.confidence === 'medium' ? 'info' : 'warn'}>{e.confidence}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ai-apply">
            <button className="btn" onClick={apply} disabled={!accepted.length}>
              Apply {accepted.length} field{accepted.length === 1 ? '' : 's'} to {target.id}
            </button>
            <button className="btn sm" onClick={() => { setExtractions([]); setPicked({}); setMessage(''); }}>Discard</button>
            {applied > 0 && <span className="small muted">{applied} field(s) applied — open the Datasheet tab to review.</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
