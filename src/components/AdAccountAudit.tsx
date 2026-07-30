import React, { useState, useRef } from 'react';
import {
  Upload, FileText, Wand2, Check, ChevronRight, ChevronLeft, Copy,
  RotateCcw, Save, ChevronDown, Trash2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadedFileData } from '../types';

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseRow(line);
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] ?? '' }), {} as Record<string, string>);
  });

  return { headers, rows };
}

const TEMPLATES_KEY = 'adguard_audit_templates';

const DEFAULT_TEMPLATE_NAME = 'Default';
const DEFAULT_TEMPLATE = `AD ACCOUNT AUDIT — STRUCTURE & STYLE GUIDE

Voice: First person, conversational — like a quick internal update to a teammate who's about to pick up this task. Open with a casual greeting ("Hii", "Hey", "Hello -"). Not stiff, not overly formal.

Structure to follow:

1. Opening
   - Casual greeting + one line framing what this audit covers (account/niche, and the period(s) reviewed)

2. Recent Context / What Happened
   - Narrate, in rough chronological order, anything relevant that happened in the account: offer changes, tests launched or ended (creative, copy, level-of-awareness, condition, LPO), budget changes, tracking/technical issues, external events (account hacked, clinic OOO, tracking bug, etc.)
   - Mention specific dates where useful

3. Performance Snapshot
   - Cite the real numbers from the data: CPL, CPSchedule, CPShow, CPClose, ROAS, Booking %, Show %, Close %, LP CR, CTR (all), Unique Outbound CTR — whichever apply
   - Always compare across periods explicitly (L7 vs L14 vs L30, WoW % change) and call out the trend direction
   - If the account has multiple niches, locations, or campaigns, give each its own short sub-section with its own snapshot — don't blend them together

4. Issues & Root Cause
   - Name the specific issue (creative fatigue, low volume from a budget cap, targeting/audience size too narrow or too wide, tracking discrepancy, DQ/DND drivers, offer fatigue, LP friction, hacked/skewed data, etc.)
   - Always explain the WHY behind a metric move, tied to something concrete in the data — don't just restate the number

5. Actions Already Taken
   - What's already been done in response — ended or launched a test, submitted an LPO request, requested a budget increase, reallocated budget to a winning adset, excluded specific leads, escalated a tracking issue, etc.

6. Next Steps
   - Numbered, concrete, forward-looking actions
   - If a decision or input is needed from the reader, ask directly rather than assuming

7. Closing (optional)
   - A short wrap-up line — "To conclude:", "Overall, the account is doing well", or a direct question if input is needed

Tone rules:
- Always cite specific numbers with $ and % and the exact period (L7/L14/L30/MTD/WoW) — never vague ("it's doing better")
- Explain reasoning, not just facts — the reader should understand WHY a decision was made
- Keep paragraphs short and conversational; use numbered lists only for next-step action items
- Don't pad with fluff or corporate-speak — write the way you'd actually type a quick internal note`;

type SlotKey = 'period7' | 'period14' | 'period30' | 'period90' | 'notes';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
};

const SLOTS: { key: SlotKey; label: string; accept: string; pdfAllowed: boolean; imageAllowed: boolean }[] = [
  { key: 'period7', label: 'Last 7 Days', accept: '.csv,.pdf,.png,.jpg,.jpeg,.webp', pdfAllowed: true, imageAllowed: true },
  { key: 'period14', label: 'Last 14 Days', accept: '.csv,.pdf,.png,.jpg,.jpeg,.webp', pdfAllowed: true, imageAllowed: true },
  { key: 'period30', label: 'Last 30 Days', accept: '.csv,.pdf,.png,.jpg,.jpeg,.webp', pdfAllowed: true, imageAllowed: true },
  { key: 'period90', label: 'Last 90 Days', accept: '.csv,.pdf,.png,.jpg,.jpeg,.webp', pdfAllowed: true, imageAllowed: true },
  { key: 'notes', label: 'Control Center Notes', accept: '.csv', pdfAllowed: false, imageAllowed: false },
];

function loadTemplateStore(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '{}');
    if (Object.keys(saved).length === 0) {
      const seeded = { [DEFAULT_TEMPLATE_NAME]: DEFAULT_TEMPLATE };
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return saved;
  } catch {
    const seeded = { [DEFAULT_TEMPLATE_NAME]: DEFAULT_TEMPLATE };
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function UploadSlot({
  label, accept, pdfAllowed, imageAllowed, file, onFile, onClear, error,
}: {
  label: string;
  accept: string;
  pdfAllowed: boolean;
  imageAllowed: boolean;
  file: UploadedFileData | null;
  onFile: (file: File) => void;
  onClear: () => void;
  error?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypesLabel = pdfAllowed
    ? (imageAllowed ? 'CSV, PDF, or screenshot' : 'CSV or PDF')
    : 'CSV';

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : file
            ? 'border-emerald-200 bg-emerald-50/40'
            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
        />
        {file ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {file.fileType === 'image' && file.imageBase64 ? (
                <img
                  src={`data:${file.imageMimeType || 'image/png'};base64,${file.imageBase64}`}
                  alt={file.fileName}
                  className="w-8 h-8 object-cover rounded-lg border border-emerald-200 flex-shrink-0"
                />
              ) : (
                <div className="p-1.5 bg-emerald-100 rounded-lg flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              )}
              <div className="min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                <p className="text-xs text-gray-500">
                  {file.fileType === 'csv' ? `${file.rows?.length ?? 0} rows` : file.fileType === 'image' ? 'Screenshot' : 'PDF'}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="p-1 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-5 h-5 text-gray-400" />
            <p className="text-xs text-gray-500">
              Drop or click · {acceptedTypesLabel}
            </p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function AdAccountAudit() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [files, setFiles] = useState<Record<SlotKey, UploadedFileData | null>>({
    period7: null,
    period14: null,
    period30: null,
    period90: null,
    notes: null,
  });
  const [fileErrors, setFileErrors] = useState<Partial<Record<SlotKey, string>>>({});

  const [savedTemplates, setSavedTemplates] = useState<Record<string, string>>(loadTemplateStore);
  const [templateName, setTemplateName] = useState(DEFAULT_TEMPLATE_NAME);
  const [template, setTemplate] = useState(() => savedTemplates[DEFAULT_TEMPLATE_NAME] ?? DEFAULT_TEMPLATE);
  const [savedBadge, setSavedBadge] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleFile = (slot: SlotKey, pdfAllowed: boolean, imageAllowed: boolean, file: File) => {
    setFileErrors(prev => ({ ...prev, [slot]: undefined }));
    const name = file.name.toLowerCase();
    const imageExt = IMAGE_EXTENSIONS.find(ext => name.endsWith(ext));
    if (name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.headers.length === 0) {
          setFileErrors(prev => ({ ...prev, [slot]: 'Could not parse CSV — check for a header row.' }));
          return;
        }
        setFiles(prev => ({ ...prev, [slot]: { fileName: file.name, fileType: 'csv', headers: parsed.headers, rows: parsed.rows } }));
      };
      reader.readAsText(file);
    } else if (pdfAllowed && name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        setFiles(prev => ({ ...prev, [slot]: { fileName: file.name, fileType: 'pdf', pdfBase64: base64 } }));
      };
      reader.readAsDataURL(file);
    } else if (imageAllowed && imageExt) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        const mimeType = IMAGE_MIME_TYPES[imageExt.slice(1)] || 'image/png';
        setFiles(prev => ({ ...prev, [slot]: { fileName: file.name, fileType: 'image', imageBase64: base64, imageMimeType: mimeType } }));
      };
      reader.readAsDataURL(file);
    } else {
      const allowedLabel = pdfAllowed
        ? (imageAllowed ? '.csv, .pdf, or a screenshot (.png/.jpg/.webp)' : '.csv or .pdf')
        : '.csv';
      setFileErrors(prev => ({ ...prev, [slot]: `Please upload a ${allowedLabel} file.` }));
    }
  };

  const clearFile = (slot: SlotKey) => {
    setFiles(prev => ({ ...prev, [slot]: null }));
    setFileErrors(prev => ({ ...prev, [slot]: undefined }));
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      setError('Enter a template name before saving.');
      return;
    }
    setError('');
    const updated = { ...savedTemplates, [templateName.trim()]: template };
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setSavedTemplates(updated);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  const loadTemplate = (name: string) => {
    setTemplate(savedTemplates[name]);
    setTemplateName(name);
    setTemplateDropdownOpen(false);
  };

  const deleteTemplate = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...savedTemplates };
    delete updated[name];
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setSavedTemplates(updated);
    if (templateName === name) setTemplateName('');
  };

  const hasAnyFile = Object.values(files).some(Boolean);
  const uploadedCount = Object.values(files).filter(Boolean).length;

  const generate = async () => {
    if (!hasAnyFile || !template.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const res = await fetch('/api/generate-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setOutput(data.output);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setOutput('');
    setFiles({ period7: null, period14: null, period30: null, period90: null, notes: null });
    setFileErrors({});
    setStep(1);
  };

  const isCompleted = (s: number) => {
    if (s === 1) return hasAnyFile;
    if (s === 2) return !!template.trim();
    return false;
  };

  const stepLabels = ['Upload Data', 'Template', 'Generate'];
  const templateNames = Object.keys(savedTemplates);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Ad Account Audit</h2>
        <p className="text-gray-500">Upload L7/L14/L30 data and Control Center notes, and generate an audit write-up to paste into your task.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => setStep(s as 1 | 2 | 3)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                step === s
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : isCompleted(s)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-white text-gray-400 border border-gray-200'
              }`}
            >
              {isCompleted(s) && step !== s ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <span>{s}</span>
              )}
              {stepLabels[i]}
            </button>
            {s < 3 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* ── Step 1: Upload Data ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {SLOTS.map(slot => (
                  <div key={slot.key}>
                    <UploadSlot
                      label={slot.label}
                      accept={slot.accept}
                      pdfAllowed={slot.pdfAllowed}
                      imageAllowed={slot.imageAllowed}
                      file={files[slot.key]}
                      onFile={(f) => handleFile(slot.key, slot.pdfAllowed, slot.imageAllowed, f)}
                      onClear={() => clearFile(slot.key)}
                      error={fileErrors[slot.key]}
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 px-1">
                {hasAnyFile ? `${uploadedCount} of ${SLOTS.length} files uploaded — at least one is required.` : 'Upload at least one file to continue.'}
              </p>

              {hasAnyFile && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                  >
                    Next: Set Template
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Template ── */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Load saved template */}
              {templateNames.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setTemplateDropdownOpen(o => !o)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all w-full justify-between"
                  >
                    <span className="font-medium text-gray-600">
                      {templateName ? `Template: ${templateName}` : 'Load a saved template…'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${templateDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {templateDropdownOpen && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {templateNames.map(name => (
                        <div
                          key={name}
                          onClick={() => loadTemplate(name)}
                          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <span className={`font-medium ${templateName === name ? 'text-indigo-600' : 'text-gray-700'}`}>{name}</span>
                          <button
                            onClick={(e) => deleteTemplate(name, e)}
                            className="text-gray-300 hover:text-rose-500 transition-colors p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name (required to save)"
                    className="flex-1 text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                  />
                  <button
                    onClick={saveTemplate}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${
                      savedBadge
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {savedBadge ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {savedBadge ? 'Saved!' : 'Save'}
                  </button>
                </div>
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Define the structure, tone, and sections your audit should follow. The AI uses this as a guide — not copied literally — and fills it with real insights from your data."
                  className="w-full h-96 p-6 text-sm font-mono text-gray-700 placeholder-gray-400 resize-none outline-none"
                />
              </div>

              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">{error}</p>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!template.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Generate
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Generate ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
                {SLOTS.map(slot => (
                  <div key={slot.key}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{slot.label}</p>
                    <p className="text-sm text-gray-700 truncate">
                      {files[slot.key]?.fileName ?? <span className="text-gray-300">— not uploaded —</span>}
                    </p>
                  </div>
                ))}
              </div>

              {!output && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        Generate Audit
                      </>
                    )}
                  </button>
                  {loading && (
                    <p className="text-sm text-gray-400">This usually takes a few seconds…</p>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">{error}</p>
              )}

              {output && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-gray-700">Generated Audit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={generate}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Regenerate
                      </button>
                      <button
                        onClick={copyOutput}
                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${
                          copied
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <pre className="p-6 text-sm text-gray-700 whitespace-pre-wrap font-sans leading-7">{output}</pre>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all text-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Start Over
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
