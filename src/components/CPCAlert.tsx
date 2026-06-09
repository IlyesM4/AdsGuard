import React from 'react';
import { AlertTriangle, TrendingUp, MousePointerClick, DollarSign, Target, ArrowRight } from 'lucide-react';
import { AdAccountInsight } from '../types';
import { motion } from 'motion/react';

interface CPCAlertProps {
  data: AdAccountInsight[];
}

const CPC_THRESHOLD = 2.5;

export const CPCAlert: React.FC<CPCAlertProps> = ({ data }) => {
  const flaggedAds = data.flatMap(account =>
    account.campaigns.flatMap(campaign =>
      campaign.ads
        .filter(ad =>
          ad.cpc > 0 &&
          campaign.cpc > 0 &&
          ad.cpc >= campaign.cpc * CPC_THRESHOLD
        )
        .map(ad => ({
          accountId: account.account_id,
          campaignName: campaign.campaign_name,
          campaignCPC: campaign.cpc,
          ratio: ad.cpc / campaign.cpc,
          ...ad,
        }))
    )
  ).sort((a, b) => b.ratio - a.ratio);

  const totalAdsWithClicks = data.flatMap(account =>
    account.campaigns.flatMap(campaign =>
      campaign.ads.filter(ad => ad.cpc > 0)
    )
  ).length;

  const accountsWithAlerts = Array.from(new Set(flaggedAds.map(ad => ad.accountId)));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">CPC Alerts</h2>
          <p className="text-gray-500">Ads with Cost Per Link Click ≥ 2.5× their campaign average — last 7 days</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 border rounded-full ${
          flaggedAds.length > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
        }`}>
          <AlertTriangle className={`w-4 h-4 ${flaggedAds.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          <span className={`text-sm font-medium ${flaggedAds.length > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>
            {flaggedAds.length} of {totalAdsWithClicks} Ads Flagged
          </span>
        </div>
      </div>

      {flaggedAds.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-medium text-emerald-900">CPC Looks Healthy</h3>
          <p className="text-emerald-700 mt-1">
            No ads are currently exceeding 2.5× their campaign average CPC.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {flaggedAds.map((ad, idx) => (
            <motion.div
              key={`${ad.ad_id}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl border-2 border-rose-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="bg-rose-50 px-6 py-3 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-white px-2 py-1 rounded border border-rose-200">
                    High CPC Alert
                  </span>
                  <span className="text-sm font-medium text-rose-900">Account: {ad.accountId}</span>
                </div>
                <div className="text-sm font-semibold text-rose-700">
                  {ad.ratio.toFixed(1)}× Campaign Avg
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Ad Name</h4>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{ad.ad_name}</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <Target className="w-4 h-4 shrink-0" />
                    <span className="truncate">{ad.campaignName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-around bg-gray-50 rounded-xl p-4 md:col-span-2 gap-4">
                  <div className="text-center">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Ad CPC</h4>
                    <div className="flex items-center justify-center gap-1 font-bold text-xl text-rose-600">
                      <DollarSign className="w-4 h-4" />
                      {ad.cpc.toFixed(2)}
                    </div>
                  </div>

                  <ArrowRight className="w-6 h-6 text-gray-300" />

                  <div className="text-center">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Campaign Avg</h4>
                    <div className="flex items-center justify-center gap-1 text-gray-900 font-bold text-xl">
                      <DollarSign className="w-4 h-4" />
                      {ad.campaignCPC.toFixed(2)}
                    </div>
                  </div>

                  <div className="w-px h-10 bg-gray-200" />

                  <div className="text-center">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Link Clicks</h4>
                    <div className="flex items-center justify-center gap-1 text-gray-600 font-medium text-lg">
                      <MousePointerClick className="w-4 h-4" />
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
          ))}
        </div>
      )}

      {accountsWithAlerts.length > 0 && (
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Affected Accounts Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accountsWithAlerts.map(accId => (
              <div key={accId} className="bg-rose-600 text-white p-4 rounded-xl shadow-lg shadow-rose-200 flex items-center justify-between">
                <div>
                  <p className="text-rose-100 text-xs font-medium uppercase">Action Required</p>
                  <p className="font-bold">{accId}</p>
                </div>
                <AlertTriangle className="w-6 h-6 text-rose-200" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
