export interface FBConfig {
  accessToken: string;
  adAccountIds: string[];
  campaignIds: string[];
}

export interface AdInsight {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  spend: number;
  reach: number;
  impressions: number;
  leads: number;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  cpl?: number;
}

export interface CampaignInsight {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  cpl: number;
  leads: number;
  ads: AdInsight[];
}

export interface AdAccountInsight {
  account_id: string;
  campaigns: CampaignInsight[];
}

export type AlertThreshold = 1.15 | 2 | 3 | 0;

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleSheetFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface GHLConfig {
  accessToken: string;
  locationId: string;
}

export interface GHLMetrics {
  leads: number;
  duplicates: number;
  bookings: number;
  shows: number;
  closes: number;
  revenue: number;
  bookingRate: number;
  showRate: number;
  cpLead: number;
  cpBooking: number;
  cpShow: number;
  cpClose: number;
  roas: number;
  totalSpend: number;
}

export interface MeetingPrepData {
  fbData: AdAccountInsight[];
  ghlMetrics: GHLMetrics;
  dateRange: number;
}
