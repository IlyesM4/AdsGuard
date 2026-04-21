import React, { useState, useEffect } from 'react';
import { FBConfig, AdAccountInsight, AlertThreshold } from './types';
import { fetchAdAccountData } from './services/facebookAds';
import { ConfigForm } from './components/ConfigForm';
import { HighCPLAlert } from './components/HighCPLAlert';
import { MeetingPrep } from './components/MeetingPrep';
import { 
  LayoutDashboard, 
  Bell, 
  Settings, 
  LogOut, 
  RefreshCw, 
  ShieldAlert,
  BarChart3,
  Activity,
  Presentation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [config, setConfig] = useState<FBConfig | null>(() => {
    const saved = localStorage.getItem('adguard_config');
    return saved ? JSON.parse(saved) : null;
  });
  const [data, setData] = useState<AdAccountInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<AlertThreshold>(2);
  const [activeTab, setActiveTab] = useState<'alerts' | 'stats' | 'meeting'>('alerts');

  const handleSaveConfig = (newConfig: FBConfig) => {
    setConfig(newConfig);
    localStorage.setItem('adguard_config', JSON.stringify(newConfig));
  };

  const handleLogout = () => {
    localStorage.removeItem('adguard_config');
    localStorage.removeItem('adguard_fb_token');
    localStorage.removeItem('adguard_google_tokens');
    localStorage.removeItem('adguard_hypothesis_id');
    localStorage.removeItem('adguard_looker_url');
    setConfig(null);
    setData([]);
  };

  const loadData = async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const insights = await fetchAdAccountData(config);
      setData(insights);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data. Check your token and IDs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (config) {
      loadData();
    }
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] py-12 px-4">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600 rounded-2xl mb-6 shadow-xl shadow-indigo-200">
            <ShieldAlert className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">AdGuard</h1>
          <p className="text-xl text-gray-600">Professional Ads Management & Performance Monitoring</p>
        </div>
        <ConfigForm onSave={handleSaveConfig} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">AdGuard</span>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'alerts' 
                ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Bell className="w-5 h-5" />
            CPL Alerts
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'stats' 
                ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Campaign Stats
          </button>
          <button
            onClick={() => setActiveTab('meeting')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === 'meeting' 
                ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Presentation className="w-5 h-5" />
            Meeting Prep
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="px-4 py-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Settings</p>
            <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Alert Threshold</label>
                    <select 
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value) as AlertThreshold)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={1.15}>15% Higher CPL</option>
                      <option value={2}>2x Avg CPL</option>
                      <option value={3}>3x Avg CPL</option>
                      <option value={0}>0 Conversions (Wasted)</option>
                    </select>
                  </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-all mt-4"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Welcome back to your ad performance center</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24"
            >
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-6 text-gray-500 font-medium">Fetching Facebook Ads Data...</p>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'alerts' ? (
                <HighCPLAlert data={data} threshold={threshold} />
              ) : activeTab === 'meeting' ? (
                <MeetingPrep fbData={data} />
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-900">Campaign Statistics</h2>
                      <p className="text-gray-500">Overview of active campaigns in the last 7 days</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-6">
                    {data.flatMap(acc => acc.campaigns.map(campaign => ({ ...campaign, accountId: acc.account_id }))).map(campaign => {
                      const cheapestAd = campaign.ads.reduce((min, ad) => {
                        if (ad.cpl > 0 && (min === null || ad.cpl < min.cpl)) {
                          return ad;
                        }
                        return min;
                      }, null as any);

                      return (
                        <div key={`${campaign.accountId}-${campaign.campaign_id}`} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 rounded-xl">
                              <Activity className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{campaign.campaign_name}</h3>
                              <p className="text-sm text-gray-500">ID: {campaign.campaign_id}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-x-8 gap-y-4 flex-1">
                            <div className="text-right min-w-[80px]">
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Spend</p>
                              <p className="text-lg font-bold text-gray-900">${campaign.spend.toFixed(2)}</p>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Avg CPL</p>
                              <p className="text-lg font-bold text-indigo-600">${campaign.cpl.toFixed(2)}</p>
                            </div>
                            <div className="text-right min-w-[60px]">
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Ads</p>
                              <p className="text-lg font-bold text-gray-900">{campaign.ads.length}</p>
                            </div>
                            <div className="text-right min-w-[80px]">
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Best CPL</p>
                              <p className="text-lg font-bold text-emerald-600">
                                {cheapestAd ? `$${cheapestAd.cpl.toFixed(2)}` : 'N/A'}
                              </p>
                            </div>
                            <div className="text-right min-w-[120px] max-w-[200px]">
                              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Best Ad</p>
                              <p className="text-sm font-bold text-gray-900 truncate" title={cheapestAd?.ad_name}>
                                {cheapestAd ? cheapestAd.ad_name : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
