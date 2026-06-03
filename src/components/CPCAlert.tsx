import React from 'react';
import { MousePointerClick, DollarSign, Target, TrendingDown } from 'lucide-react';
import { AdAccountInsight } from '../types';
import { motion } from 'motion/react';

interface CPCAlertProps {
  data: AdAccountInsight[];
}

type CPCTier = 'green' | 'orange' | 'red' | 'none';

function getCPCTier(cpc: number): CPCTier {
  if (cpc <= 0) return 'none';
  if (cpc < 4.5) return 'green';
  if (cpc <= 7) return 'orange';
  return 'red';
}

const tierStyles: Record<CPCTier, { border: string; bg: string; badge: string; text: string; label: string }> = {
  green:  { border: 'border-emerald-200', bg: 'bg-emerald-50',  badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-600', label: 'Good' },
  orange: { border: 'border-amber-200',   bg: 'bg-amber-50',    badge: 'bg-amber-100 text-amber-800 border-amber-200',       text: 'text-amber-600',   label: 'Average' },
  red:    { border: 'border-rose-200',    bg: 'bg-rose-50',     badge: 'bg-rose-100 text-rose-800 border-rose-200',          text: 'text-rose-600',    label: 'High CPC' },
  none:   { border: 'border-gray-200',    bg: 'bg-gray-50',     badge: 'bg-gray-100 text-gray-500 border-gray-200',          text: 'text-gray-400',    label: 'No Clicks' },
};

export const CPCAlert: React.FC<CPCAlertProps> = ({ data }) => {
  const allAds = data.flatMap(account =>
    account.campaigns.flatMap(campaign =>
      campaign.ads.map(ad => ({
        accountId: account.account_id,
        campaignName: campaign.campaign_name,
        ...ad,
      }))
    )
  );

  const withClicks = allAds.filter(ad => ad.cpc > 0);
  const counts = {
    green:  withClicks.filter(ad => getCPCTier(ad.cpc) === 'green').length,
    orange: withClicks.filter(ad => getCPCTier(ad.cpc) === 'orange').length,
    red:    withClicks.filter(ad => getCPCTier(ad.cpc) === 'red').length,
  };

  const sorted = [...allAds].sort((a, b) => b.cpc - a.cpc);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">CPC Alerts</h2>
          <p className="text-gray-500">Cost per Link Click — last 7 days across all active ads</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border border-indigo-100 bg-indigo-50 rounded-full">
          <MousePointerClick className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-900">{withClicks.length} Ads with Clicks</span>
        </div>
      </div>

      {/* Tier summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Good  &lt; $4.50</p>
            <p className="text-2xl font-bold text-emerald-600">{counts.green}</p>
          </div>
        </div>
        <div className="bg-white border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Average  $4.50–$7</p>
            <p className="text-2xl font-bold text-amber-600">{counts.orange}</p>
          </div>
        </div>
        <div className="bg-white border border-rose-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">High CPC  &gt; $7</p>
            <p className="text-2xl font-bold text-rose-600">{counts.red}</p>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-12 text-center">
          <p className="text-gray-500">No ad data available. Refresh to load.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sorted.map((ad, idx) => {
            const tier = getCPCTier(ad.cpc);
            const s = tierStyles[tier];
            return (
              <motion.div
                key={`${ad.ad_id}-${idx}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`bg-white rounded-2xl border-2 ${s.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className={`${s.bg} px-6 py-3 border-b ${s.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border ${s.badge}`}>
                      {s.label}
                    </span>
                    <span className="text-sm text-gray-500">Account: {ad.accountId}</span>
                  </div>
                  <div className={`text-sm font-semibold ${s.text}`}>
                    {ad.link_clicks.toLocaleString()} clicks
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Ad Name</h4>
                    <p className="text-base font-bold text-gray-900 leading-tight">{ad.ad_name}</p>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                      <Target className="w-4 h-4 shrink-0" />
                      <span className="truncate">{ad.campaignName}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-around bg-gray-50 rounded-xl p-4 md:col-span-2 gap-4">
                    <div className="text-center">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">CPC</h4>
                      <div className={`flex items-center justify-center gap-1 font-bold text-2xl ${s.text}`}>
                        {tier === 'none' ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <>
                            <DollarSign className="w-5 h-5" />
                            {ad.cpc.toFixed(2)}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="w-px h-10 bg-gray-200" />

                    <div className="text-center">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Link Clicks</h4>
                      <div className="flex items-center justify-center gap-1 text-gray-900 font-bold text-xl">
                        <MousePointerClick className="w-4 h-4 text-gray-400" />
                        {ad.link_clicks.toLocaleString()}
                      </div>
                    </div>

                    <div className="w-px h-10 bg-gray-200" />

                    <div className="text-center">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Spend (7d)</h4>
                      <div className="flex items-center justify-center gap-1 text-gray-600 font-medium text-lg">
                        <DollarSign className="w-4 h-4" />
                        {ad.spend.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
