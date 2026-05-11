import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Wand2, Check, ChevronRight, ChevronLeft, Copy, RotateCcw, Save, ChevronDown, Trash2, Users, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../types';

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

const TEMPLATES_KEY = 'adguard_meeting_templates';

type ClientMode = 'none' | 'existing' | 'new';

export function MeetingPrep() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // File data
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'pdf' | null>(null);
  const [pdfBase64, setPdfBase64] = useState('');

  // Client selection
  const [clients, setClients] = useState<Client[]>([]);
  const [clientMode, setClientMode] = useState<ClientMode>('none');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientNiche, setNewClientNiche] = useState('');

  // Templates
  const [savedTemplates, setSavedTemplates] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '{}'); }
    catch { return {}; }
  });
  const [template, setTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [savedBadge, setSavedBadge] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  // Output
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Save state
  const [savedPrepId, setSavedPrepId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [postMeetingNotes, setPostMeetingNotes] = useState('');
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Fetch clients on mount
  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => { if (d.clients) setClients(d.clients); })
      .catch(() => {});
  }, []);

  const effectiveClientName = clientMode === 'existing'
    ? (clients.find(c => c.id === selectedClientId)?.name || '')
    : clientMode === 'new' ? newClientName : '';

  const effectiveNiche = clientMode === 'existing'
    ? (clients.find(c => c.id === selectedClientId)?.niche || '')
    : clientMode === 'new' ? newClientNiche : '';

  const handleFile = (file: File) => {
    setError('');
    if (file.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.headers.length === 0) {
          setError('Could not parse CSV. Make sure the file has a header row.');
          return;
        }
        setCsvData(parsed);
        setPdfBase64('');
        setFileType('csv');
        setFileName(file.name);
      };
      reader.readAsText(file);
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        setPdfBase64(base64);
        setCsvData(null);
        setFileType('pdf');
        setFileName(file.name);
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please upload a .csv or .pdf file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
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

  const generate = async () => {
    if ((!csvData && !pdfBase64) || !template.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');
    setSavedPrepId(null);
    setSaveStatus('idle');
    setPostMeetingNotes('');
    try {
      const body = fileType === 'pdf'
        ? { pdfBase64, template, clientName: effectiveClientName, niche: effectiveNiche, clientId: clientMode === 'existing' ? selectedClientId : null }
        : { rows: csvData!.rows, headers: csvData!.headers, template, clientName: effectiveClientName, niche: effectiveNiche, clientId: clientMode === 'existing' ? selectedClientId : null };

      const res = await fetch('/api/generate-meeting-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const saveReport = async () => {
    setSaveStatus('saving');
    setError('');
    try {
      let clientId = selectedClientId;

      // Create new client if needed
      if (clientMode === 'new' && !savedPrepId) {
        if (!newClientName.trim()) {
          setError('Enter a client name before saving.');
          setSaveStatus('idle');
          return;
        }
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newClientName.trim(), niche: newClientNiche.trim() || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create client');
        clientId = data.client.id;
        setSelectedClientId(clientId);
        setClients(prev => [...prev, data.client].sort((a, b) => a.name.localeCompare(b.name)));
      }

      const res = await fetch('/api/meeting-preps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, output, fileName: fileName || null, templateName: templateName || null, template: template || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save report');
      setSavedPrepId(data.prep.id);
      setSaveStatus('saved');
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    }
  };

  const saveNotes = async () => {
    if (!savedPrepId) return;
    setNoteSaveStatus('saving');
    try {
      await fetch(`/api/meeting-preps/${savedPrepId}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: postMeetingNotes }),
      });
      setNoteSaveStatus('saved');
      setTimeout(() => setNoteSaveStatus('idle'), 2000);
    } catch {
      setNoteSaveStatus('idle');
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
    setFileType(null);
    setPdfBase64('');
    setSavedPrepId(null);
    setSaveStatus('idle');
    setPostMeetingNotes('');
    setNoteSaveStatus('idle');
    setStep(1);
  };

  const isCompleted = (s: number) => {
    if (s === 1) return !!fileType;
    if (s === 2) return !!template.trim();
    return false;
  };

  const canSave = clientMode !== 'none' && (
    (clientMode === 'existing' && !!selectedClientId) ||
    (clientMode === 'new' && !!newClientName.trim())
  );

  const stepLabels = ['Upload File', 'Template', 'Generate'];
  const templateNames = Object.keys(savedTemplates);

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
          {/* ── Step 1: Upload File ── */}
          {step === 1 && (
            <div className="space-y-6">

              {/* Client selector */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-700">Client</p>
                  <span className="text-xs text-gray-400 font-normal">— optional, enables AI memory & report saving</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {(['none', 'existing', 'new'] as ClientMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => { setClientMode(mode); if (mode !== 'existing') setSelectedClientId(null); }}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                        clientMode === mode
                          ? 'bg-indigo-600 text-white border-transparent shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {mode === 'none' ? 'One-time (no client)' : mode === 'existing' ? 'Existing client' : '+ New client'}
                    </button>
                  ))}
                </div>

                {clientMode === 'existing' && (
                  <div className="space-y-2">
                    <select
                      value={selectedClientId || ''}
                      onChange={e => setSelectedClientId(e.target.value || null)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all bg-white"
                    >
                      <option value="">Select a client…</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.niche ? ` · ${c.niche}` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedClientId && (
                      <p className="text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                        AI will analyze this client's previous reports to spot changes, patterns & opportunities
                      </p>
                    )}
                    {clients.length === 0 && (
                      <p className="text-xs text-gray-400 px-1">No clients yet. Save your first report to create one.</p>
                    )}
                  </div>
                )}

                {clientMode === 'new' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Client Name *</label>
                      <input
                        type="text"
                        value={newClientName}
                        onChange={e => setNewClientName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Niche / Industry</label>
                      <input
                        type="text"
                        value={newClientNiche}
                        onChange={e => setNewClientNiche(e.target.value)}
                        placeholder="e.g. Knee Pain, Dentistry"
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* File upload */}
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
                  accept=".csv,.pdf"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                />
                <div className="flex flex-col items-center gap-4">
                  <div className={`p-4 rounded-2xl ${fileType ? 'bg-emerald-100' : 'bg-indigo-100'}`}>
                    {fileType
                      ? <Check className="w-8 h-8 text-emerald-600" />
                      : <Upload className="w-8 h-8 text-indigo-600" />
                    }
                  </div>
                  {fileType ? (
                    <>
                      <p className="font-semibold text-gray-900">{fileName}</p>
                      <p className="text-sm text-gray-500">
                        {fileType === 'csv'
                          ? `${csvData?.rows.length} rows · ${csvData?.headers.length} columns · Click to replace`
                          : 'PDF uploaded · Click to replace'
                        }
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-900">Drop your file here, or click to browse</p>
                      <p className="text-sm text-gray-500">Supports CSV and PDF</p>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">{error}</p>
              )}

              {/* CSV Preview */}
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

              {fileType && (
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
                  placeholder={`Define the structure and sections you want in your meeting prep output. The AI will use this as a guide — not copy it literally — and fill it with real insights from your data.\n\nExample:\n─────────────────────────────\nClient: [client name]\nPeriod: [date range]\n\nPerformance Summary\n• Leads generated: [number]\n• Ad Spend: $[amount]\n• Cost Per Lead: $[cpl]\n• Bookings: [number]\n• ROAS: [value]x\n\nKey Wins This Period:\n[AI fills this in]\n\nAreas to Improve:\n[AI fills this in]\n─────────────────────────────`}
                  className="w-full h-80 p-6 text-sm font-mono text-gray-700 placeholder-gray-400 resize-none outline-none"
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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    {fileType === 'pdf' ? 'PDF File' : 'CSV Data'}
                  </p>
                  <p className="font-semibold text-gray-900 truncate">{fileName}</p>
                  {fileType === 'csv' && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {csvData?.rows.length} rows · {csvData?.headers.length} columns
                    </p>
                  )}
                  {effectiveClientName && (
                    <p className="text-xs text-indigo-600 mt-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {effectiveClientName}{effectiveNiche ? ` · ${effectiveNiche}` : ''}
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Template</p>
                  {templateName && (
                    <p className="text-xs font-semibold text-indigo-600 mb-1">{templateName}</p>
                  )}
                  <p className="text-sm text-gray-700 line-clamp-3 font-mono leading-relaxed">
                    {template.substring(0, 120)}{template.length > 120 ? '…' : ''}
                  </p>
                </div>
              </div>

              {/* AI memory indicator */}
              {clientMode === 'existing' && selectedClientId && (
                <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700">
                  <BookOpen className="w-4 h-4 flex-shrink-0" />
                  AI will reference previous reports for <strong>{effectiveClientName}</strong> to spot changes & patterns
                </div>
              )}

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
                <>
                  {/* Generated output */}
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

                  {/* Save to client */}
                  {canSave && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                      {saveStatus !== 'saved' ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Save to client file</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Attach this report to <strong>{effectiveClientName || 'this client'}</strong> — the AI will reference it in future sessions.
                            </p>
                          </div>
                          <button
                            onClick={saveReport}
                            disabled={saveStatus === 'saving'}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-60"
                          >
                            {saveStatus === 'saving' ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving…
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                Save Report
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <div className="p-1 bg-emerald-100 rounded-full">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-semibold">Saved to {effectiveClientName}'s file</span>
                          </div>

                          {/* Post-meeting notes */}
                          <div className="border-t border-gray-100 pt-4 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Post-meeting notes</p>
                              <p className="text-xs text-gray-400 mt-0.5">Add notes after the meeting — the AI will reference these next time.</p>
                            </div>
                            <textarea
                              value={postMeetingNotes}
                              onChange={e => setPostMeetingNotes(e.target.value)}
                              placeholder="e.g. Client closed 3 deals. They want to push YouTube Ads next month. Happy with CPL, concerned about show rate…"
                              rows={3}
                              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all"
                            />
                            <button
                              onClick={saveNotes}
                              disabled={noteSaveStatus === 'saving'}
                              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-all ${
                                noteSaveStatus === 'saved'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {noteSaveStatus === 'saved'
                                ? <><Check className="w-3.5 h-3.5" /> Notes saved</>
                                : <><Save className="w-3.5 h-3.5" /> Save Notes</>
                              }
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
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
