import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Loader2, 
  ArrowRight,
  Monitor,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Calendar,
  Lock,
  Database,
  Calculator,
  RefreshCw,
  TrendingUp,
  DollarSign,
  UserCheck,
  CalendarCheck
} from 'lucide-react';
import { AdAccountInsight, GHLMetrics, FBConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { fetchAdAccountData } from '../services/facebookAds';
import { fetchGHLData } from '../services/ghl';

interface MeetingPrepProps {
  fbData: AdAccountInsight[];
}

export function MeetingPrep({ fbData }: MeetingPrepProps) {
  const [ghlToken, setGhlToken] = useState<string>(() => localStorage.getItem('adguard_ghl_token') || '');
  const [locationId, setLocationId] = useState<string>(() => localStorage.getItem('adguard_ghl_location') || '');
  const [dateRange, setDateRange] = useState<number>(7);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>(fbData[0]?.account_id || '');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<GHLMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('adguard_ghl_token', ghlToken);
  }, [ghlToken]);

  useEffect(() => {
    localStorage.setItem('adguard_ghl_location', locationId);
  }, [locationId]);

  const calculateMetrics = async () => {
    if (!ghlToken || !locationId || !selectedAdAccount) {
      setError("Please fill in all GHL and Ad Account details.");
      return;
    }

    setLoading(true);
    setError(null);
    setMetrics(null);

    try {
      // 1. Get FB Spend first for the selected range
      const savedConfig = localStorage.getItem('adguard_config');
      if (!savedConfig) throw new Error("Facebook configuration not found.");
      
      const config: FBConfig = JSON.parse(savedConfig);
      // Adjust config to only fetch the selected account if needed, but fetchAdAccountData handles list
      const datePreset = `last_${dateRange}d`;
      const freshFbData = await fetchAdAccountData({
        ...config,
        adAccountIds: [selectedAdAccount]
      }, datePreset);

      const totalSpend = freshFbData.reduce((sum, acc) => 
        sum + acc.campaigns.reduce((cSum, camp) => cSum + camp.spend, 0), 0
      );

      // 2. Fetch GHL Data and perform math
      const ghlMetrics = await fetchGHLData(
        { accessToken: ghlToken, locationId },
        dateRange,
        totalSpend
      );

      setMetrics(ghlMetrics);
    } catch (err: any) {
      console.error('Error calculating metrics:', err);
      setError(err.message || "Failed to calculate metrics. Check your tokens and permissions.");
    } finally {
      setLoading(false);
    }
  };

  const metricCards = metrics ? [
    { label: 'Leads', value: metrics.leads, icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Revenue', value: `$${metrics.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Booking Rate', value: `${metrics.bookingRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'ROAS', value: `${metrics.roas.toFixed(2)}x`, icon: Calculator, color: 'text-rose-600', bg: 'bg-rose-50' },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">1</div>
              <h4 className="font-bold text-gray-900 uppercase text-xs tracking-wider">Ad Account</h4>
            </div>
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-600 appearance-none cursor-pointer"
            >
              {fbData.map(acc => (
                <option key={acc.account_id} value={acc.account_id}>
                  Account: {acc.account_id}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">2</div>
              <h4 className="font-bold text-gray-900 uppercase text-xs tracking-wider">GHL Integration</h4>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block px-1">API Access Token (v2 OAuth)</label>
                <div className="relative">
                  <input
                    type="password"
                    value={ghlToken}
                    onChange={(e) => setGhlToken(e.target.value)}
                    placeholder="Access Token (from OAuth/Marketplace)"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-medium pr-10"
                  />
                  <Lock className="w-4 h-4 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                {ghlToken && !ghlToken.includes('.') && !ghlToken.startsWith('pit-') && (
                  <p className="text-[9px] text-orange-500 mt-1 px-1 font-bold">
                    ⚠️ This looks like an API Key. Use a PIT Token (pit-...) or OAuth Token.
                  </p>
                )}
                {ghlToken && ghlToken.startsWith('pit-') && (
                  <p className="text-[9px] text-emerald-500 mt-1 px-1 font-bold">
                    ✅ Private Integration Token detected.
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block px-1">Location ID (Sub-Account)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    placeholder="Location ID"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-medium pr-10"
                  />
                  <Database className="w-4 h-4 text-gray-300 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">3</div>
              <h4 className="font-bold text-gray-900 uppercase text-xs tracking-wider">Date Range</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[7, 14, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setDateRange(days)}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    dateRange === days 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                      : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-100'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Last {days} Days
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={calculateMetrics}
            disabled={loading || !ghlToken || !locationId}
            className="w-full group flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Calculator className="w-5 h-5" />
                Perform Calculations
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>

        {/* Right Panel: Data Display */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 flex items-center gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {metrics ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Highlight Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metricCards.map((card, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <div className={`p-2 w-fit rounded-lg ${card.bg} mb-3`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
                    <p className="text-xl font-black text-gray-900 mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Comprehensive Table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">Performance Summary</h3>
                    <p className="text-xs text-gray-400 font-medium">Cross-channel data: Meta Ads + GoHighLevel</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Last {dateRange} Days
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Metric Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Count / Result</th>
                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Unit Efficiency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-sm font-bold text-gray-700">Leads</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">{metrics.leads}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black">
                            ${metrics.cpLead.toFixed(2)} / Lead
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span className="text-sm font-bold text-gray-700">Duplicates</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">{metrics.duplicates}</td>
                        <td className="px-6 py-4 text-right text-xs text-gray-400 font-medium whitespace-nowrap">
                          {metrics.leads > 0 ? ((metrics.duplicates / metrics.leads) * 100).toFixed(1) : 0}% of leads
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                            <span className="text-sm font-bold text-gray-700">Bookings</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">{metrics.bookings}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 text-[10px] font-black">
                            ${metrics.cpBooking.toFixed(2)} / Booking
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-300" />
                            <span className="text-sm font-bold text-gray-700">Booking Rate</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-orange-600">{metrics.bookingRate.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-right text-xs text-gray-400 font-medium whitespace-nowrap">
                          {metrics.bookings} / {metrics.leads} leads
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span className="text-sm font-bold text-gray-700">Shows</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">{metrics.shows}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black">
                            ${metrics.cpShow.toFixed(2)} / Show
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                            <span className="text-sm font-bold text-gray-700">Show Rate</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-amber-600">{metrics.showRate.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-right text-xs text-gray-400 font-medium whitespace-nowrap">
                          {metrics.shows} / {metrics.bookings} bookings
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-sm font-bold text-gray-700">Closes</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">{metrics.closes}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black">
                            ${metrics.cpClose.toFixed(2)} / Close
                          </span>
                        </td>
                      </tr>
                      <tr className="bg-gray-50/20">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                            <span className="text-sm font-black text-gray-900">Ad Spend</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-gray-900">${metrics.totalSpend.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase">Meta Ads</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                      <TrendingUp className="w-6 h-6 text-indigo-100" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Final ROAS Ratio</p>
                      <p className="text-3xl font-black">{metrics.roas.toFixed(2)}x</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider">Total Pipeline Revenue</p>
                    <p className="text-3xl font-black">${metrics.revenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center p-24 border-2 border-dashed border-gray-100 bg-white rounded-[40px] opacity-40">
              <div className="p-6 bg-gray-50 rounded-full mb-6">
                <Monitor className="w-16 h-16 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-400">Ready to sync GHL</h3>
              <p className="text-sm text-gray-300 mt-2 text-center max-w-xs">Fill in your integration details and select a date range to generate the performance report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
