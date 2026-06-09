import { AdAccountInsight, AdFrequencyData, AccountFrequencyData, AdInsight, CampaignInsight, FBConfig } from '../types';

const FB_API_VERSION = 'v25.0';

export async function fetchAdAccountData(config: FBConfig, datePreset: string = 'last_7d'): Promise<AdAccountInsight[]> {
  const results: AdAccountInsight[] = [];

  for (const accountId of config.adAccountIds) {
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    try {
      // Fetch insights for the account's campaigns
      const campaignInsights = await fetchCampaignInsights(formattedAccountId, config.campaignIds, config.accessToken, datePreset);
      results.push({
        account_id: accountId,
        campaigns: campaignInsights,
      });
    } catch (error) {
      console.error(`Error fetching data for account ${accountId}:`, error);
    }
  }

  return results;
}

async function fetchCampaignInsights(accountId: string, targetCampaignIds: string[], accessToken: string, datePreset: string): Promise<CampaignInsight[]> {
  // 1. Get campaigns
  const campaignListUrl = `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/campaigns?fields=id,name,effective_status&limit=100&access_token=${accessToken}`;
  const campaignListResponse = await fetch(campaignListUrl);
  const campaignListData = await campaignListResponse.json();

  if (campaignListData.error) {
    throw new Error(`Facebook API Error (Campaigns): ${campaignListData.error.message} (${campaignListData.error.code})`);
  }

  const filteredCampaigns = targetCampaignIds.length > 0 
    ? (campaignListData.data || []).filter((c: any) => targetCampaignIds.includes(c.id))
    : (campaignListData.data || []);

  const campaignInsights: CampaignInsight[] = [];

  for (const campaign of filteredCampaigns) {
    try {
      // 2. Get active adsets for this campaign
      const adsetListUrl = `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/adsets?fields=id,name,effective_status&limit=100&access_token=${accessToken}`;
      const adsetListResponse = await fetch(adsetListUrl);
      const adsetListData = await adsetListResponse.json();
      
      if (adsetListData.error) {
        console.warn(`Could not fetch adsets for campaign ${campaign.id}:`, adsetListData.error.message);
        continue;
      }

      const activeAdsetIds = (adsetListData.data || [])
        .filter((as: any) => as.effective_status === 'ACTIVE')
        .map((as: any) => as.id);

      // 3. Get active ads for this campaign
      const adListUrl = `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/ads?fields=id,name,adset_id,effective_status&limit=500&access_token=${accessToken}`;
      const adListResponse = await fetch(adListUrl);
      const adListData = await adListResponse.json();
      
      if (adListData.error) {
        console.warn(`Could not fetch ads for campaign ${campaign.id}:`, adListData.error.message);
        continue;
      }
      
      // An ad is considered "Active" if both it and its parent adset are ACTIVE
      const activeAdsList = (adListData.data || []).filter((ad: any) => 
        ad.effective_status === 'ACTIVE' && activeAdsetIds.includes(ad.adset_id)
      );

      // 4. Get insights for the campaign and its ads
      const campaignInsightFields = 'spend,actions,cost_per_action_type,cost_per_inline_link_click';
      const campaignInsightUrl = `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/insights?fields=${campaignInsightFields}&date_preset=${datePreset}&access_token=${accessToken}`;
      const campaignInsightResponse = await fetch(campaignInsightUrl);
      const campaignInsightData = await campaignInsightResponse.json();
      const campaignInsight: any = campaignInsightData.data?.[0] || { spend: '0', actions: [], cost_per_action_type: [] };

      const adInsightFields = 'ad_id,ad_name,spend,actions,cost_per_action_type,inline_link_clicks,cost_per_inline_link_click';
      const adInsightUrl = `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/insights?level=ad&fields=${adInsightFields}&date_preset=${datePreset}&access_token=${accessToken}`;
      const adInsightResponse = await fetch(adInsightUrl);
      const adInsightData = await adInsightResponse.json();
      const adInsightsMap = new Map<string, any>((adInsightData.data || []).map((ins: any) => [ins.ad_id, ins]));

      // 5. Build the final ad list for the campaign, focusing on active ads
      const ads: AdInsight[] = activeAdsList.map((ad: any) => {
        const insight = adInsightsMap.get(ad.id);
        return {
          ad_id: ad.id,
          ad_name: ad.name,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          adset_id: ad.adset_id,
          adset_name: '',
          spend: insight ? parseFloat(insight.spend) : 0,
          reach: 0,
          impressions: 0,
          leads: insight ? getLeadsFromResult(insight.actions) : 0,
          cpl: insight ? getCPLFromResult(insight.cost_per_action_type) : 0,
          link_clicks: insight ? parseInt(insight.inline_link_clicks || '0') : 0,
          cpc: insight ? parseFloat(insight.cost_per_inline_link_click || '0') : 0,
        };
      });

      campaignInsights.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        spend: parseFloat(campaignInsight.spend || '0'),
        cpl: getCPLFromResult(campaignInsight.cost_per_action_type),
        cpc: parseFloat(campaignInsight.cost_per_inline_link_click || '0'),
        leads: getLeadsFromResult(campaignInsight.actions),
        ads: ads
      });
    } catch (campaignError) {
      console.error(`Error processing campaign ${campaign.id}:`, campaignError);
    }
  }

  return campaignInsights;
}

export async function fetchFrequencyData(config: FBConfig): Promise<AccountFrequencyData[]> {
  const results: AccountFrequencyData[] = [];

  for (const accountId of config.adAccountIds) {
    const formattedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    try {
      const ads = await fetchFrequencyForAccount(formattedAccountId, config.campaignIds, config.accessToken);
      results.push({ account_id: accountId, ads });
    } catch (error) {
      console.error(`Error fetching frequency for account ${accountId}:`, error);
    }
  }

  return results;
}

async function fetchFrequencyForAccount(
  accountId: string,
  targetCampaignIds: string[],
  accessToken: string
): Promise<AdFrequencyData[]> {
  const campaignListUrl = `https://graph.facebook.com/${FB_API_VERSION}/${accountId}/campaigns?fields=id,name,effective_status&limit=100&access_token=${accessToken}`;
  const campaignListData = await (await fetch(campaignListUrl)).json();

  if (campaignListData.error) throw new Error(campaignListData.error.message);

  const filteredCampaigns = targetCampaignIds.length > 0
    ? (campaignListData.data || []).filter((c: any) => targetCampaignIds.includes(c.id))
    : (campaignListData.data || []);

  const allAds: AdFrequencyData[] = [];

  for (const campaign of filteredCampaigns) {
    try {
      const adsetData = await (await fetch(
        `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/adsets?fields=id,effective_status&limit=100&access_token=${accessToken}`
      )).json();
      const activeAdsetIds = new Set<string>(
        (adsetData.data || []).filter((as: any) => as.effective_status === 'ACTIVE').map((as: any) => as.id)
      );

      const adListData = await (await fetch(
        `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/ads?fields=id,name,adset_id,effective_status&limit=500&access_token=${accessToken}`
      )).json();
      const activeAds = (adListData.data || []).filter((ad: any) =>
        ad.effective_status === 'ACTIVE' && activeAdsetIds.has(ad.adset_id)
      );

      if (activeAds.length === 0) continue;

      const activeAdIds = new Set<string>(activeAds.map((ad: any) => ad.id));

      const [map7d, map14d, map30d] = await Promise.all([
        fetchFrequencyForPreset(campaign.id, activeAdIds, accessToken, 'last_7d'),
        fetchFrequencyForPreset(campaign.id, activeAdIds, accessToken, 'last_14d'),
        fetchFrequencyForPreset(campaign.id, activeAdIds, accessToken, 'last_30d'),
      ]);

      for (const ad of activeAds) {
        allAds.push({
          ad_id: ad.id,
          ad_name: ad.name,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          freq_7d: map7d.get(ad.id) || 0,
          freq_14d: map14d.get(ad.id) || 0,
          freq_30d: map30d.get(ad.id) || 0,
        });
      }
    } catch (err) {
      console.error(`Error fetching frequency for campaign ${campaign.id}:`, err);
    }
  }

  return allAds;
}

async function fetchFrequencyForPreset(
  campaignId: string,
  activeAdIds: Set<string>,
  accessToken: string,
  datePreset: string
): Promise<Map<string, number>> {
  const url = `https://graph.facebook.com/${FB_API_VERSION}/${campaignId}/insights?level=ad&fields=ad_id,frequency&date_preset=${datePreset}&access_token=${accessToken}`;
  const data = await (await fetch(url)).json();

  const map = new Map<string, number>();
  for (const ins of (data.data || [])) {
    if (activeAdIds.has(ins.ad_id)) {
      map.set(ins.ad_id, parseFloat(ins.frequency || '0'));
    }
  }
  return map;
}

function getCPLFromResult(costPerActionType?: { action_type: string; value: string }[]): number {
  if (!costPerActionType) return 0;
  
  // Look for common lead/registration action types
  const leadActionTypes = [
    'complete_registration',
    'lead',
    'submit_application',
    'offsite_conversion.fb_pixel_complete_registration',
    'offsite_conversion.fb_pixel_lead',
    'offsite_conversion.fb_pixel_submit_application'
  ];

  const result = costPerActionType.find(a => leadActionTypes.includes(a.action_type));
  
  return result ? parseFloat(result.value) : 0;
}

function getLeadsFromResult(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  
  const leadActionTypes = [
    'complete_registration',
    'lead',
    'submit_application',
    'offsite_conversion.fb_pixel_complete_registration',
    'offsite_conversion.fb_pixel_lead',
    'offsite_conversion.fb_pixel_submit_application'
  ];

  const result = actions.find(a => leadActionTypes.includes(a.action_type));
  
  return result ? parseInt(result.value) : 0;
}
