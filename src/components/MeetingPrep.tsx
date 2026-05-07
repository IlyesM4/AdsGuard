import React, { useState, useRef } from 'react';
import { Upload, FileText, Wand2, Check, ChevronRight, ChevronLeft, Copy, RotateCcw, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const TEMPLATE_KEY = 'adguard_meeting_template';

export function MeetingPrep() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [template, setTemplate] = useState(() => localStorage.getItem(TEMPLATE_KEY) || '');
  const [savedBadge, setSavedBadge] = useState(false);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        setError('Could not parse CSV. Make sure the file has a header row.');
        return;
      }
      setCsvData(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const saveTemplate = () => {
    localStorage.setItem(TEMPLATE_KEY, template);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

  const generate = async () => {
    if (!csvData || !template.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    try {
      const res = await fetch('/api/generate-meeting-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: csvData.rows, headers: csvData.headers, template }),
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
    setCsvData(null);
    setFileName('');
    setStep(1);
  };

  const isCompleted = (s: number) => {
    if (s === 1) return !!csvData;
    if (s === 2) return !!template.trim();
    return false;
  };

  const stepLabels = ['Upload CSV', 'Template', 'Generate'];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Meeting Prep</h2>
        <p className="text-gray-500">Upload your data, define your template, and generate your prep in seconds.</p>
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
          {/* ── Step 1: CSV Upload ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-2xl ${csvData ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
                    {csvData
                      ? <Check className="w-8 h-8 text-emerald-600" />
                      : <Upload className="w-8 h-8 text-indigo-600" />
                    }
                  </div>
                  {csvData ? (
                    <>
                      <p className="font-semibold text-gray-900">{fileName}</p>
                      <p className="text-sm text-gray-500">
                        {csvData.rows.length} rows · {csvData.headers.length} columns · Click to replace
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900">Drop your CSV here, or click to browse</p>
                      <p className="text-sm text-gray-500">Headers must be in the first row</p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">{error}</p>
              )}

              {csvData && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Preview</span>
                    </div>
                    <span className="text-xs text-gray-400">First 5 rows</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {csvData.headers.map(h => (
                            <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap text-xs uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {csvData.rows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {csvData.headers.map(h => (
                              <td key={h} className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {csvData && (
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
              {csvData && (
                <div className="bg-indigo-50 rounded-xl px-5 py-4 border border-indigo-100">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
                    Columns available in your CSV
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {csvData.headers.map(h => (
                      <span key={h} className="text-xs font-mono bg-white border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-lg">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Meeting Prep Template</span>
                  </div>
                  <button
                    onClick={saveTemplate}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all ${
                      savedBadge
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {savedBadge ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {savedBadge ? 'Saved!' : 'Save Template'}
                  </button>
                </div>
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder={`Paste your meeting prep template here. Describe the format and structure you want — the AI will fill it in using your CSV data.\n\nExample:\n─────────────────────────────\nClient: [client name]\nPeriod: [date range]\n\nPerformance Summary\n• Leads generated: [number]\n• Ad Spend: $[amount]\n• Cost Per Lead: $[cpl]\n• Bookings: [number]\n• ROAS: [value]x\n\nKey Wins This Period:\n[AI fills this in]\n\nAreas to Improve:\n[AI fills this in]\n─────────────────────────────`}
                  className="w-full h-80 p-6 text-sm font-mono text-gray-700 placeholder-gray-400 resize-none outline-none"
                />
              </div>

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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">CSV Data</p>
                  <p className="font-semibold text-gray-900 truncate">{fileName}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {csvData?.rows.length} rows · {csvData?.headers.length} columns
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Template</p>
                  <p className="text-sm text-gray-700 line-clamp-3 font-mono leading-relaxed">
                    {template.substring(0, 120)}{template.length > 120 ? '…' : ''}
                  </p>
                </div>
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
                        Generate Meeting Prep
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
                      <span className="text-sm font-semibold text-gray-700">Generated Meeting Prep</span>
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
