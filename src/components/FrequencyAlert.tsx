import React from 'react';
import { AlertTriangle, TrendingUp, Eye, Target, ArrowRight } from 'lucide-react';
import { AccountFrequencyData } from '../types';
import { motion } from 'motion/react';

interface FrequencyAlertProps {
  data: AccountFrequencyData[];
}

const FATIGUE_THRESHOLD = 2.5;
const CRITICAL_THRESHOLD = 3.0;

type Severity = 'critical' | 'fatiguing';
type Trend = 'climbing' | 'already-high' | 'stable';

function getSeverity(freq7d: number): Severity | null {
  if (freq7d >= CRITICAL_THRESHOLD) return 'critical';
  if (freq7d >= FATIGUE_THRESHOLD) return 'fatiguing';
  return null;
}

function getTrend(freq7d: number, freq14d: number, freq30d: number): Trend {
  if (freq7d > freq14d && freq14d > freq30d) return 'climbing';
  if (freq30d >= FATIGUE_THRESHOLD) return 'already-high';
  return 'stable';
}

function freqColor(value: number): string {
  if (value >= CRITICAL_THRESHOLD) return 'text-rose-600 bg-rose-50 border-rose-200';
  if (value >= FATIGUE_THRESHOLD) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (value >= 2.0) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
}

function FreqBox({ label, value }: { label: string; value: number }) {
  return (
    <div className={`flex flex-col items-center px-5 py-3 rounded-xl border ${freqColor(value)}`}>
      <span className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">{label}</span>
      <span className="text-2xl font-bold">{value > 0 ? value.toFixed(2) : '—'}</span>
    </div>
  );
}

export const FrequencyAlert: React.FC<FrequencyAlertProps> = ({ data }) => {
  const flaggedAds = data
    .flatMap(account =>
      account.ads
        .filter(ad => getSeverity(ad.freq_7d) !== null)
        .map(ad => ({
          accountId: account.account_id,
          severity: getSeverity(ad.freq_7d) as Severity,
          trend: getTrend(ad.freq_7d, ad.freq_14d, ad.freq_30d),
          ...ad,
        }))
    )
    .sort((a, b) => b.freq_7d - a.freq_7d);

  const criticalCount = flaggedAds.filter(a => a.severity === 'critical').length;
  const fatiguingCount = flaggedAds.filter(a => a.severity === 'fatiguing').length;
  const totalAds = data.flatMap(a => a.ads).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Frequency Monitor</h2>
          <p className="text-gray-500">Creative fatigue signals across 7, 14 & 30-day windows</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 border rounded-full ${
          flaggedAds.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
        }`}>
          <AlertTriangle className={`w-4 h-4 ${flaggedAds.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          <span className={`text-sm font-medium ${flaggedAds.length > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
            {flaggedAds.length} of {totalAds} Ads Flagged
          </span>
        </div>
      </div>

      {flaggedAds.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Eye className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fatiguing  2.5 – 3.0</p>
              <p className="text-2xl font-bold text-amber-600">{fatiguingCount}</p>
            </div>
          </div>
          <div className="bg-white border border-rose-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Critical  3.0+</p>
              <p className="text-2xl font-bold text-rose-600">{criticalCount}</p>
            </div>
          </div>
        </div>
      )}

      {flaggedAds.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-medium text-emerald-900">All Creative Healthy</h3>
          <p className="text-emerald-700 mt-1 max-w-md mx-auto">
            No ads currently exceed the 2.5 frequency threshold.
          </p>
          <p className="text-emerald-600 text-sm mt-3 max-w-lg mx-auto">
            If conversions are down but frequency is under 2.0, the creative isn't the problem — check the landing page, audience, or offer before refreshing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {flaggedAds.map((ad, idx) => {
            const isCritical = ad.severity === 'critical';
            return (
              <motion.div
                key={`${ad.ad_id}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  isCritical ? 'border-rose-100' : 'border-amber-100'
                }`}
              >
                <div className={`px-6 py-3 border-b flex items-center justify-between ${
                  isCritical ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border bg-white ${
                      isCritical ? 'text-rose-600 border-rose-200' : 'text-amber-600 border-amber-200'
                    }`}>
                      {isCritical ? 'Critical — Refresh Now' : 'Fatiguing'}
                    </span>
                    <span className={`text-sm font-medium ${isCritical ? 'text-rose-900' : 'text-amber-900'}`}>
                      Account: {ad.accountId}
                    </span>
                    {ad.trend === 'climbing' && (
                      <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-white border border-rose-200 px-2 py-0.5 rounded">
                        <TrendingUp className="w-3 h-3" /> Climbing
                      </span>
                    )}
                    {ad.trend === 'already-high' && (
                      <span className="text-xs font-bold text-amber-700 bg-white border border-amber-200 px-2 py-0.5 rounded">
                        Already Fatigued
                      </span>
                    )}
                  </div>
                  <div className={`text-sm font-semibold ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
                    7d Freq: {ad.freq_7d.toFixed(2)}
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Ad Name</h4>
                    <p className="text-lg font-bold text-gray-900 leading-tight">{ad.ad_name}</p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                      <Target className="w-4 h-4 shrink-0" />
                      <span className="truncate">{ad.campaign_name}</span>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center justify-around bg-gray-50 rounded-xl p-4 gap-3">
                    <FreqBox label="30d" value={ad.freq_30d} />
                    <ArrowRight className="w-5 h-5 text-gray-300 shrink-0" />
                    <FreqBox label="14d" value={ad.freq_14d} />
                    <ArrowRight className="w-5 h-5 text-gray-300 shrink-0" />
                    <FreqBox label="7d" value={ad.freq_7d} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {flaggedAds.length > 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-700">Reminder:</span> If conversions are down but frequency is under 2.0, the creative isn't the problem — check the landing page, audience, or offer before refreshing the creative.
          </p>
        </div>
      )}
    </div>
  );
};
