import { GHLConfig, GHLMetrics } from '../types';

const STOP_WORDS = new Set([
  // Platforms
  'fb', 'facebook', 'meta', 'google', 'instagram', 'youtube', 'tiktok', 'bing',
  // Campaign types
  'vsl', 'video', 'sales', 'letter', 'webinar', 'quiz',
  'campaign', 'campaigns', 'ads', 'ad', 'advertising',
  'retargeting', 'remarketing', 'conversion', 'conversions', 'awareness', 'traffic',
  'lead', 'leads', 'generation', 'gen',
  'landing', 'page', 'lander', 'funnel', 'offer', 'form',
  // Versions / dates
  '2023', '2024', '2025', '2026',
  'v1', 'v2', 'v3', 'v4', 'v5', 'ver',
  'test', 'testing', 'new', 'old', 'updated', 'revised',
  // Audience
  'cold', 'warm', 'hot', 'lookalike', 'lal', 'interest', 'broad', 'narrow',
  // Geo
  'us', 'usa', 'canada', 'uk', 'au', 'australia', 'nz',
  // Time
  'q1', 'q2', 'q3', 'q4',
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  // Creative format
  'copy', 'creative', 'image', 'carousel', 'collection', 'reel',
  'phase', 'stage', 'round', 'wave',
  // Common words
  'and', 'the', 'for', 'with', 'from', 'that',
  // Business / clinic / brand terms
  'integrated', 'medical', 'cellular', 'solutions', 'wellness', 'health',
  'center', 'clinic', 'institute', 'practice', 'care', 'group', 'associates',
  'services', 'specialist', 'specialists', 'management', 'advanced', 'premium',
  'professional', 'certified', 'licensed', 'comprehensive', 'holistic',
  'functional', 'natural', 'alternative', 'expert', 'experts',
]);

/**
 * Strips marketing jargon from a campaign name to extract the core niche keyword.
 * e.g. "FB - Knee Pain - VSL 2024" → "knee pain"
 */
export function extractNicheFromCampaign(campaignName: string): string {
  return campaignName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .join(' ')
    .trim();
}

export async function fetchGHLData(
  config: GHLConfig,
  days: number,
  fbSpend: number,
  campaignName: string = '',
  nicheTag: string = ''
): Promise<GHLMetrics> {
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const trimmedNiche = nicheTag.trim();

  // Run all 3 fetches in parallel
  const [contacts, appointments, opportunities] = await Promise.all([
    trimmedNiche
      ? fetchContactsByTag(config, trimmedNiche, startTime, endTime)
      : Promise.resolve([] as any[]),
    fetchFromProxy(config, 'appointments', startTime, endTime),
    fetchFromProxy(config, 'opportunities', startTime, endTime),
  ]);

  // Leads = contacts tagged with the niche (if niche provided), else all opportunities
  const leadsSource = trimmedNiche ? contacts : opportunities;
  const leadsCount = leadsSource.length;

  // Duplicates:
  // - if using contacts: contacts tagged "duplicate" or "dup"
  // - if using opportunities: opportunities with "duplicate" in stage name
  const duplicatesCount = trimmedNiche
    ? contacts.filter((c: any) =>
        (c.tags || []).some((t: string) =>
          t.toLowerCase().includes('duplicate') || t.toLowerCase().includes('dup')
        )
      ).length
    : opportunities.filter((o: any) =>
        (o.pipelineStageName || '').toLowerCase().includes('duplicate')
      ).length;

  // Bookings = appointments CREATED (booked) within the selected date range.
  // The server fetches +90 days forward so future-scheduled appointments are included;
  // we filter here by dateAdded (when the booking was made).
  const bookingsCount = appointments.filter((a: any) => {
    const created = new Date(a.dateAdded || a.createdAt || 0).getTime();
    return created >= startTime && created <= endTime;
  }).length;

  // Shows = appointments that OCCURRED in the date range AND the person attended.
  const showsCount = appointments.filter((a: any) => {
    const apptTime = new Date(a.startTime || 0).getTime();
    const status = (a.appointmentStatus || a.status || '').toLowerCase();
    return apptTime >= startTime && apptTime <= endTime && status === 'showed';
  }).length;

  // Closes = won opportunities
  // If niche is provided, cross-reference by contactId to filter to niche contacts only
  let wonOpportunities: any[];
  if (trimmedNiche && contacts.length > 0) {
    const contactIds = new Set(contacts.map((c: any) => c.id));
    wonOpportunities = opportunities.filter(
      (o: any) => o.status?.toLowerCase() === 'won' && contactIds.has(o.contactId)
    );
    // Fallback: if cross-ref yields 0, use all won opportunities (contactId may not be in response)
    if (wonOpportunities.length === 0) {
      wonOpportunities = opportunities.filter((o: any) => o.status?.toLowerCase() === 'won');
    }
  } else {
    wonOpportunities = opportunities.filter((o: any) => o.status?.toLowerCase() === 'won');
  }

  const closesCount = wonOpportunities.length;
  const revenue = wonOpportunities.reduce(
    (sum: number, o: any) => sum + (parseFloat(o.monetaryValue) || 0),
    0
  );

  const bookingRate = leadsCount > 0 ? (bookingsCount / leadsCount) * 100 : 0;
  const showRate    = bookingsCount > 0 ? (showsCount / bookingsCount) * 100 : 0;

  const cpLead    = leadsCount    > 0 ? fbSpend / leadsCount    : 0;
  const cpBooking = bookingsCount > 0 ? fbSpend / bookingsCount : 0;
  const cpShow    = showsCount    > 0 ? fbSpend / showsCount    : 0;
  const cpClose   = closesCount   > 0 ? fbSpend / closesCount   : 0;
  const roas      = fbSpend       > 0 ? revenue / fbSpend       : 0;

  return {
    leads: leadsCount,
    duplicates: duplicatesCount,
    bookings: bookingsCount,
    shows: showsCount,
    closes: closesCount,
    revenue,
    bookingRate,
    showRate,
    cpLead,
    cpBooking,
    cpShow,
    cpClose,
    roas,
    totalSpend: fbSpend,
    campaignName,
    nicheTag: trimmedNiche,
  };
}

async function fetchContactsByTag(
  config: GHLConfig,
  tag: string,
  startTime: number,
  endTime: number
): Promise<any[]> {
  const token = bearerToken(config.accessToken);
  const params = new URLSearchParams({
    locationId: config.locationId.trim(),
    tag,
    startTime: startTime.toString(),
    endTime: endTime.toString(),
  });

  const response = await fetch(`/api/ghl/contacts?${params}`, {
    headers: { Authorization: token },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch contacts from GHL`);
  }

  const data = await response.json();
  return data.contacts || [];
}

async function fetchFromProxy(
  config: GHLConfig,
  type: 'opportunities' | 'appointments',
  startTime: number,
  endTime: number
): Promise<any[]> {
  const token = bearerToken(config.accessToken);
  const params = new URLSearchParams({
    locationId: config.locationId.trim(),
    startTime: startTime.toString(),
    endTime: endTime.toString(),
  });

  const response = await fetch(`/api/ghl/${type}?${params}`, {
    headers: { Authorization: token },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch ${type} from GHL`);
  }

  const data = await response.json();
  return data[type] || data.data || [];
}

function bearerToken(raw: string): string {
  const t = raw.trim();
  return t.startsWith('Bearer ') ? t : `Bearer ${t}`;
}
