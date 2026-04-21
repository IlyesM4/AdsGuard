import React from 'react';
import { AlertTriangle, TrendingUp, DollarSign, Target, ArrowRight } from 'lucide-react';
import { AdAccountInsight, AlertThreshold } from '../types';
import { motion } from 'motion/react';

interface HighCPLAlertProps {
  data: AdAccountInsight[];
  threshold: AlertThreshold;
}

export const HighCPLAlert: React.FC<HighCPLAlertProps> = ({ data, threshold }) => {
  const flaggedAds = data.flatMap(account => 
    account.campaigns.flatMap(campaign => 
      campaign.ads
        .filter(ad => {
          if (threshold === 0) {
            // New threshold: 0 Conversions and there's spend in the last 7 days
            return ad.leads === 0 && ad.spend > 0;
          }
          // Original thresholds: High CPL compared to campaign average
          return ad.cpl > 0 && campaign.cpl > 0 && ad.cpl >= campaign.cpl * threshold;
        })
        .map(ad => ({
          accountId: account.account_id,
          campaignName: campaign.campaign_name,
          campaignCPL: campaign.cpl,
          ...ad
        }))
    )
  );

  const accountsWithAlerts = Array.from(new Set(flaggedAds.map(ad => ad.accountId)));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {threshold === 0 ? 'Wasted Budget Alerts' : 'High CPL Alerts'}
          </h2>
          <p className="text-gray-500">
            {threshold === 0 
              ? 'Ads with spend but 0 conversions in the last 7 days'
              : 'Comparing individual ad CPL vs campaign average (Last 7 Days)'}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 border rounded-full ${
          threshold === 0 ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
        }`}>
          <AlertTriangle className={`w-4 h-4 ${threshold === 0 ? 'text-rose-600' : 'text-amber-600'}`} />
          <span className={`text-sm font-medium ${threshold === 0 ? 'text-rose-900' : 'text-amber-900'}`}>
            {flaggedAds.length} Alerts Found
          </span>
        </div>
      </div>

      {flaggedAds.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-medium text-emerald-900">All Performance Normal</h3>
          <p className="text-emerald-700">
            {threshold === 0 
              ? 'No ads are currently spending without producing conversions.'
              : `No ads are currently exceeding the ${threshold === 1.15 ? '15% higher' : `${threshold}x`} CPL threshold.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {flaggedAds.map((ad, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={`${ad.ad_id}-${idx}`}
              className="bg-white rounded-2xl border-2 border-rose-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="bg-rose-50 px-6 py-3 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-white px-2 py-1 rounded border border-rose-200">
                    {threshold === 0 ? 'Wasted Budget' : 'High CPL Alert'}
                  </span>
                  <span className="text-sm font-medium text-rose-900">Account: {ad.accountId}</span>
                </div>
                <div className="text-sm font-semibold text-rose-700">
                  {threshold === 0 
                    ? '0 Conversions Found'
                    : `${((ad.cpl / ad.campaignCPL)).toFixed(1)}x Campaign Avg`}
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Ad Name</h4>
                  <p className="text-lg font-bold text-gray-900 leading-tight">{ad.ad_name}</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <Target className="w-4 h-4" />
                    {ad.campaignName}
                  </div>
                </div>

                <div className="flex items-center justify-around bg-gray-50 rounded-xl p-4 md:col-span-2">
                  <div className="text-center">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                      {threshold === 0 ? 'Conversions' : 'Ad CPL'}
                    </h4>
                    <div className={`flex items-center justify-center gap-1 font-bold text-xl ${threshold === 0 ? 'text-rose-600' : 'text-rose-600'}`}>
                      {threshold === 0 ? (
                        '0'
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" />
                          {ad.cpl.toFixed(2)}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <ArrowRight className="w-6 h-6 text-gray-300" />

                  <div className="text-center">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">
                      {threshold === 0 ? 'Spend (7d)' : 'Campaign Avg'}
                    </h4>
                    <div className="flex items-center justify-center gap-1 text-gray-900 font-bold text-xl">
                      <DollarSign className="w-4 h-4" />
                      {threshold === 0 ? ad.spend.toFixed(2) : ad.campaignCPL.toFixed(2)}
                    </div>
                  </div>

                  {threshold !== 0 && (
                    <div className="text-center border-l border-gray-200 pl-8">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Spend (7d)</h4>
                      <div className="flex items-center justify-center gap-1 text-gray-600 font-medium text-lg">
                        <DollarSign className="w-4 h-4" />
                        {ad.spend.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {threshold === 0 && (
                    <div className="text-center border-l border-gray-200 pl-8">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-1">Status</h4>
                      <div className="text-rose-600 font-bold text-sm uppercase tracking-wider">
                        Wasting Budget
                      </div>
                    </div>
                  )}
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
