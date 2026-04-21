import { GHLConfig, GHLMetrics } from '../types';

export async function fetchGHLData(
  config: GHLConfig,
  days: number,
  fbSpend: number
): Promise<GHLMetrics> {
  const endTime = new Date().getTime();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  // Ideally these should be proxied to avoid CORS and protect tokens
  // For now we will implement the logic and ensure it works with the server proxy
  
  const opportunities = await fetchFromGHL(config, 'opportunities', startTime, endTime);
  const appointments = await fetchFromGHL(config, 'appointments', startTime, endTime);

  // Leads: We count all opportunities in specific stages or just total if user implies "New Lead" = Leads
  // User said: "New Lead" = Leads, "Disqualified" = Disqualified, "Won" = Closes
  // We'll normalize stage names for comparisons
  
  const leadsCount = opportunities.filter((o: any) => 
    o.pipelineStageName?.toLowerCase().includes('new lead') || 
    o.status?.toLowerCase() === 'open'
  ).length;

  const disqualifiedCount = opportunities.filter((o: any) => 
    o.pipelineStageName?.toLowerCase().includes('disqualified') ||
    o.status?.toLowerCase() === 'abandoned' ||
    o.status?.toLowerCase() === 'lost'
  ).length;

  const wonOpportunities = opportunities.filter((o: any) => o.status?.toLowerCase() === 'won');
  const closesCount = wonOpportunities.length;
  const revenue = wonOpportunities.reduce((sum: number, o: any) => sum + (parseFloat(o.monetaryValue) || 0), 0);

  const schedulesCount = appointments.filter((a: any) => a.status?.toLowerCase() === 'confirmed').length;
  const showsCount = appointments.filter((a: any) => a.status?.toLowerCase() === 'showed').length;

  const bookingRate = leadsCount > 0 ? (schedulesCount / leadsCount) * 100 : 0;
  const showRate = schedulesCount > 0 ? (showsCount / schedulesCount) * 100 : 0;

  const cpLead = leadsCount > 0 ? fbSpend / leadsCount : 0;
  const cpSchedule = schedulesCount > 0 ? fbSpend / schedulesCount : 0;
  const cpSale = closesCount > 0 ? fbSpend / closesCount : 0;
  const roas = fbSpend > 0 ? revenue / fbSpend : 0;

  return {
    leads: leadsCount,
    disqualified: disqualifiedCount,
    closes: closesCount,
    revenue,
    schedules: schedulesCount,
    shows: showsCount,
    bookingRate,
    showRate,
    cpLead,
    cpSchedule,
    cpSale,
    roas,
    totalSpend: fbSpend
  };
}

async function fetchFromGHL(config: GHLConfig, type: 'opportunities' | 'appointments', startTime: number, endTime: number) {
  // Ensure we format the token correctly for GHL
  // PIT tokens and OAuth tokens both use Bearer, but we'll prune whitespace
  const rawToken = config.accessToken.trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;

  const params = new URLSearchParams({
    locationId: config.locationId.trim(),
    startTime: startTime.toString(),
    endTime: endTime.toString()
  });

  const url = `/api/ghl/${type}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': token
    }
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    let errorMessage = `Failed to fetch ${type} from GHL`;
    if (isJson) {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } else {
      errorMessage = await response.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (!isJson) {
    throw new Error(`Expected JSON response from ${type} but received something else.`);
  }

  const data = await response.json();
  return data[type] || data.data || [];
}
