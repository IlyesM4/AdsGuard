import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, ChevronDown, ChevronUp, Copy, Check,
  RefreshCw, X, AlertTriangle, Zap, Flag, FileText,
  LayoutTemplate, Save,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PCReviewRow, PCFlaggedRow, PCReviewThresholds, PCRuleType } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: PCReviewThresholds = {
  rule1MinSchedules: 3,
  rule1MinCPSchedule: 200,
  rule2CPScheduleThreshold: 390,
  rule2MinSpendZeroSchedules: 390,
};

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseNum(val: string): number | null {
  if (!val || val.trim() === '-') return null;
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): PCReviewRow[] {
  // Strip BOM and normalise line endings
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: PCReviewRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = values[idx] ?? ''; });

    const name = raw['Campaign Name'] || '';
    if (!name) continue;

    rows.push({
      campaignName: name,
      spend: parseNum(raw['Spend']) ?? 0,
      uniqueClicks: parseNum(raw['Unique Clicks']) ?? 0,
      ctrAll: parseNum(raw['CTR (all)']),
      uniqueOutboundCtr: parseNum(raw['Unique Outbound CTR']),
      lpConvRate: parseNum(raw['LP Conv Rate']),
      leadsIn: parseNum(raw['Leads In']) ?? 0,
      cpl: parseNum(raw['CPL']),
      disqualifieds: parseNum(raw['Disqualifieds']) ?? 0,
      dnds: parseNum(raw['DNDs']) ?? 0,
      uniqueLeads: parseNum(raw['Unique Leads']) ?? 0,
      schedules: parseNum(raw['Schedules']) ?? 0,
      cpSchedule: parseNum(raw['CPSchedule']),
      shows: parseNum(raw['Shows']) ?? 0,
      cpShow: parseNum(raw['CPShow']),
      closes: parseNum(raw['Closes']) ?? 0,
      cpClose: parseNum(raw['CPClose']),
      revenue: parseNum(raw['Revenue']) ?? 0,
      roas: parseNum(raw['ROAS']),
    });
  }

  return rows;
}

// ─── Rule Engine ──────────────────────────────────────────────────────────────

function flagAccounts(rows: PCReviewRow[], t: PCReviewThresholds): PCFlaggedRow[] {
  const result: PCFlaggedRow[] = [];

  for (const row of rows) {
    const isRule1 =
      row.schedules >= t.rule1MinSchedules &&
      row.cpSchedule !== null &&
      row.cpSchedule >= t.rule1MinCPSchedule;

    const isRule2 =
      (row.cpSchedule !== null && row.cpSchedule >= t.rule2CPScheduleThreshold) ||
      (row.spend >= t.rule2MinSpendZeroSchedules && row.schedules === 0);

    if (!isRule1 && !isRule2) continue;

    const ruleType: PCRuleType = isRule1 && isRule2 ? 'both' : isRule1 ? 'rule1' : 'rule2';
    result.push({ ...row, ruleType });
  }

  // Most urgent first: both > rule2 > rule1, then CPSchedule desc within group
  const priority: Record<PCRuleType, number> = { both: 0, rule2: 1, rule1: 2 };
  return result.sort((a, b) => {
    if (priority[a.ruleType] !== priority[b.ruleType]) {
      return priority[a.ruleType] - priority[b.ruleType];
    }
    return (b.cpSchedule ?? 0) - (a.cpSchedule ?? 0);
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n === null) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtRoas(n: number | null): string {
  if (n === null || n === 0) return n === 0 ? '0x' : '—';
  return `${n.toFixed(2)}x`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RuleBadge({ rule }: { rule: PCRuleType }) {
  if (rule === 'rule1') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold whitespace-nowrap">
        <AlertTriangle className="w-3 h-3" />
        Rule 1
      </span>
    );
  }
  if (rule === 'rule2') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold whitespace-nowrap">
        <Zap className="w-3 h-3" />
        Rule 2
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold whitespace-nowrap">
      <Flag className="w-3 h-3" />
      Both
    </span>
  );
}

function TemplateButton({ hasTemplate, onClick }: { hasTemplate: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl border transition-all shrink-0 ${
        hasTemplate
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      <LayoutTemplate className="w-4 h-4" />
      {hasTemplate ? 'Edit Template' : 'Set Template'}
      {hasTemplate && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
    </button>
  );
}

function ThresholdInput({
  label,
  value,
  prefix,
  onChange,
}: {
  label: string;
  value: number;
  prefix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5 font-medium">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          min={0}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v >= 0) onChange(v);
          }}
          className={`w-full border border-gray-200 rounded-lg py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 ${
            prefix ? 'pl-7 pr-3' : 'px-3'
          }`}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BookingPCReview() {
  const [allRows, setAllRows] = useState<PCReviewRow[]>([]);
  const [flaggedRows, setFlaggedRows] = useState<PCFlaggedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [thresholds, setThresholds] = useState<PCReviewThresholds>(() => {
    try {
      const saved = localStorage.getItem('adguard_pc_thresholds');
      return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
    } catch {
      return DEFAULT_THRESHOLDS;
    }
  });
  const [showThresholds, setShowThresholds] = useState(false);

  const [selectedRow, setSelectedRow] = useState<PCFlaggedRow | null>(null);
  const [auditText, setAuditText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Template ─────────────────────────────────────────────────────────────────

  const [template, setTemplate] = useState<string>(
    () => localStorage.getItem('adguard_pc_audit_template') || '',
  );
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateDraft, setTemplateDraft] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);

  const openTemplateModal = () => {
    setTemplateDraft(template);
    setTemplateSaved(false);
    setShowTemplateModal(true);
  };

  const saveTemplate = () => {
    setTemplate(templateDraft);
    localStorage.setItem('adguard_pc_audit_template', templateDraft);
    setTemplateSaved(true);
    setTimeout(() => {
      setTemplateSaved(false);
      setShowTemplateModal(false);
    }, 800);
  };

  const clearTemplate = () => {
    setTemplateDraft('');
    setTemplate('');
    localStorage.removeItem('adguard_pc_audit_template');
    setShowTemplateModal(false);
  };

  // ── File handling ────────────────────────────────────────────────────────────

  const processFile = (file: File) => {
    setParseError(null);
    if (!file.name.endsWith('.csv')) {
      setParseError('Only CSV files are supported.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setParseError('No valid data found in the CSV file. Make sure it matches the Data Studio export format.');
          return;
        }
        setAllRows(rows);
        setFlaggedRows(flagAccounts(rows, thresholds));
        setFileName(file.name);
      } catch {
        setParseError('Failed to parse the CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [thresholds],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  // ── Thresholds ───────────────────────────────────────────────────────────────

  const updateThresholds = (updated: PCReviewThresholds) => {
    setThresholds(updated);
    localStorage.setItem('adguard_pc_thresholds', JSON.stringify(updated));
    if (allRows.length > 0) setFlaggedRows(flagAccounts(allRows, updated));
  };

  // ── Audit generation ─────────────────────────────────────────────────────────

  const generateAudit = async (row: PCFlaggedRow) => {
    setSelectedRow(row);
    setAuditText('');
    setGenerateError(null);
    setGenerating(true);
    setCopied(false);
    try {
      const res = await fetch('/api/generate-pc-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, ruleType: row.ruleType, thresholds, template: template || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setAuditText(data.output);
    } catch (err: any) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyAudit = async () => {
    await navigator.clipboard.writeText(auditText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setSelectedRow(null);
    setAuditText('');
    setGenerateError(null);
    setCopied(false);
  };

  const resetFile = () => {
    setAllRows([]);
    setFlaggedRows([]);
    setFileName('');
    setParseError(null);
  };

  // ── Derived counts ────────────────────────────────────────────────────────────

  const rule1Count = flaggedRows.filter(r => r.ruleType === 'rule1' || r.ruleType === 'both').length;
  const rule2Count = flaggedRows.filter(r => r.ruleType === 'rule2' || r.ruleType === 'both').length;

  // ─────────────────────────────────────────────────────────────────────────────
  // Upload / empty state
  // ─────────────────────────────────────────────────────────────────────────────

  if (allRows.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Booking PC Review</h2>
            <p className="text-gray-500 mt-1">
              Upload your Data Studio L7 export to flag accounts needing PC inquiry.
            </p>
          </div>
          <TemplateButton hasTemplate={!!template} onClick={openTemplateModal} />
        </div>

        {parseError && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm">
            {parseError}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-indigo-50 rounded-2xl">
              <Upload className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">Drop your CSV here</p>
              <p className="text-gray-500 mt-1">or click to browse — Data Studio L7 export</p>
            </div>
            <p className="text-xs text-gray-400">CSV format only</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Rules legend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-amber-100 rounded-2xl p-5 space-y-2">
            <RuleBadge rule="rule1" />
            <p className="text-sm font-medium text-gray-800">
              ≥{thresholds.rule1MinSchedules} schedules at CPSchedule ≥ ${thresholds.rule1MinCPSchedule}
            </p>
            <p className="text-xs text-gray-500">
              Quality inquiry — are these bookings showing/closing, deal value? No kill on this trigger; decision follows show/ROAS data.
            </p>
          </div>
          <div className="bg-white border border-rose-100 rounded-2xl p-5 space-y-2">
            <RuleBadge rule="rule2" />
            <p className="text-sm font-medium text-gray-800">
              CPSchedule ≥ ${thresholds.rule2CPScheduleThreshold}, or spend ≥ $
              {thresholds.rule2MinSpendZeroSchedules} with 0 schedules
            </p>
            <p className="text-xs text-gray-500">
              Efficiency inquiry — kill if low-intent after contact; keep + nurture if follow-up gap found.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Results state
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Booking PC Review</h2>
          <p className="text-gray-500 mt-1 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-xs" title={fileName}>{fileName}</span>
            <span className="text-gray-300">·</span>
            {allRows.length} accounts scanned
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TemplateButton hasTemplate={!!template} onClick={openTemplateModal} />
          <button
            onClick={resetFile}
            className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            Upload New File
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {flaggedRows.length} flagged
          </span>
        </div>
        {rule1Count > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">{rule1Count} Rule 1</span>
          </div>
        )}
        {rule2Count > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl">
            <Zap className="w-3.5 h-3.5 text-rose-600" />
            <span className="text-sm font-medium text-rose-700">{rule2Count} Rule 2</span>
          </div>
        )}
      </div>

      {/* Thresholds panel */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setShowThresholds(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
        >
          <span>Alert Thresholds</span>
          {showThresholds
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        <AnimatePresence>
          {showThresholds && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-gray-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  <ThresholdInput
                    label="Rule 1 — Min Schedules"
                    value={thresholds.rule1MinSchedules}
                    prefix=""
                    onChange={v => updateThresholds({ ...thresholds, rule1MinSchedules: v })}
                  />
                  <ThresholdInput
                    label="Rule 1 — Min CPSchedule"
                    value={thresholds.rule1MinCPSchedule}
                    prefix="$"
                    onChange={v => updateThresholds({ ...thresholds, rule1MinCPSchedule: v })}
                  />
                  <ThresholdInput
                    label="Rule 2 — CPSchedule Threshold"
                    value={thresholds.rule2CPScheduleThreshold}
                    prefix="$"
                    onChange={v => updateThresholds({ ...thresholds, rule2CPScheduleThreshold: v })}
                  />
                  <ThresholdInput
                    label="Rule 2 — Min Spend (0 schedules)"
                    value={thresholds.rule2MinSpendZeroSchedules}
                    prefix="$"
                    onChange={v => updateThresholds({ ...thresholds, rule2MinSpendZeroSchedules: v })}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Flagged table */}
      {flaggedRows.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-3xl mb-3">✓</p>
          <p className="text-lg font-semibold text-gray-800">No accounts flagged</p>
          <p className="text-gray-500 text-sm mt-1">
            All {allRows.length} accounts are within the current thresholds.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="w-1 px-0" />
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Account
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Spend
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Leads
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Schedules
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    CPSchedule
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Shows
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    ROAS
                  </th>
                  <th className="px-4 py-3.5 text-center font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Rule
                  </th>
                  <th className="px-4 py-3.5 text-center font-semibold text-gray-500 uppercase tracking-wider text-xs">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {flaggedRows.map((row, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-gray-50/60 transition-colors"
                  >
                    {/* Colored urgency stripe */}
                    <td className="w-1 p-0">
                      <div
                        className={`w-1 h-full min-h-[52px] rounded-sm ${
                          row.ruleType === 'both'
                            ? 'bg-purple-400'
                            : row.ruleType === 'rule2'
                            ? 'bg-rose-400'
                            : 'bg-amber-400'
                        }`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p
                        className="font-medium text-gray-900 max-w-xs truncate"
                        title={row.campaignName}
                      >
                        {row.campaignName}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-gray-700">{fmt(row.spend)}</td>
                    <td className="px-4 py-4 text-right text-gray-700">{row.leadsIn}</td>
                    <td className="px-4 py-4 text-right text-gray-700">{row.schedules}</td>
                    <td className="px-4 py-4 text-right font-mono font-semibold">
                      <span
                        className={
                          row.cpSchedule === null
                            ? 'text-gray-400'
                            : row.cpSchedule >= thresholds.rule2CPScheduleThreshold
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }
                      >
                        {fmt(row.cpSchedule)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-700">{row.shows}</td>
                    <td className="px-4 py-4 text-right font-mono text-gray-700">{fmtRoas(row.roas)}</td>
                    <td className="px-4 py-4 text-center">
                      <RuleBadge rule={row.ruleType} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => generateAudit(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Audit Request
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowTemplateModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-start justify-between p-6 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Audit Request Template</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    The AI uses this as a structural guide. Leave blank to use the default format.
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <textarea
                  value={templateDraft}
                  onChange={e => setTemplateDraft(e.target.value)}
                  className="w-full h-80 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Paste your audit request template here…"
                />
              </div>

              <div className="flex items-center justify-between p-6 border-t border-gray-100">
                <button
                  onClick={clearTemplate}
                  disabled={!templateDraft && !template}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Template
                </button>
                <button
                  onClick={saveTemplate}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all text-sm font-semibold shadow-sm"
                >
                  {templateSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {templateSaved ? 'Saved!' : 'Save Template'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audit modal */}
      <AnimatePresence>
        {selectedRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]"
            >
              {/* Modal header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-100 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RuleBadge rule={selectedRow.ruleType} />
                    {template && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium">
                        <LayoutTemplate className="w-3 h-3" />
                        Template applied
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-2 leading-tight">
                    PC Audit Request
                  </h3>
                  <p
                    className="text-sm text-gray-500 mt-0.5 truncate"
                    title={selectedRow.campaignName}
                  >
                    {selectedRow.campaignName}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-6">
                {generating ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="relative w-12 h-12 mb-4">
                      <div className="absolute inset-0 border-4 border-indigo-100 rounded-full" />
                      <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin" />
                    </div>
                    <p className="text-gray-500 text-sm">Generating audit request...</p>
                  </div>
                ) : generateError ? (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm">
                    {generateError}
                  </div>
                ) : (
                  <textarea
                    value={auditText}
                    onChange={e => setAuditText(e.target.value)}
                    className="w-full h-72 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                    placeholder="Generated audit request will appear here..."
                  />
                )}
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-100">
                <button
                  onClick={() => generateAudit(selectedRow)}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
                <button
                  onClick={copyAudit}
                  disabled={!auditText || generating}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-50 shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
