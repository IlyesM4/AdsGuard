import { AdAccountInsight, AdInsight, CampaignInsight, FBConfig } from '../types';

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
      const campaignInsightFields = 'spend,actions,cost_per_action_type';
      const campaignInsightUrl = `https://graph.facebook.com/${FB_API_VERSION}/${campaign.id}/insights?fields=${campaignInsightFields}&date_preset=${datePreset}&access_token=${accessToken}`;
      const campaignInsightResponse = await fetch(campaignInsightUrl);
      const campaignInsightData = await campaignInsightResponse.json();
      const campaignInsight: any = campaignInsightData.data?.[0] || { spend: '0', actions: [], cost_per_action_type: [] };

      const adInsightFields = 'ad_id,ad_name,spend,actions,cost_per_action_type';
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
          cpl: insight ? getCPLFromResult(insight.cost_per_action_type) : 0
        };
      });

      campaignInsights.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        spend: parseFloat(campaignInsight.spend || '0'),
        cpl: getCPLFromResult(campaignInsight.cost_per_action_type),
        leads: getLeadsFromResult(campaignInsight.actions),
        ads: ads
      });
    } catch (campaignError) {
      console.error(`Error processing campaign ${campaign.id}:`, campaignError);
    }
  }

  return campaignInsights;
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
