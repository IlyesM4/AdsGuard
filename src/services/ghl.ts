import { GHLConfig, GHLMetrics } from '../types';

export async function fetchGHLData(
  config: GHLConfig,
  days: number,
  fbSpend: number
): Promise<GHLMetrics> {
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  const [opportunities, appointments] = await Promise.all([
    fetchFromProxy(config, 'opportunities', startTime, endTime),
    fetchFromProxy(config, 'appointments', startTime, endTime),
  ]);

  // Leads = all opportunities created in the date range
  const leadsCount = opportunities.length;

  // Duplicates = opportunities whose pipeline stage name contains "duplicate"
  const duplicatesCount = opportunities.filter((o: any) => {
    const stage = (o.pipelineStageName || '').toLowerCase();
    return stage.includes('duplicate') || stage.includes('dup');
  }).length;

  // Bookings = all calendar events in the date range (regardless of show status)
  const bookingsCount = appointments.length;

  // Shows = calendar events where the person attended
  const showsCount = appointments.filter((a: any) => {
    const status = (a.appointmentStatus || a.status || '').toLowerCase();
    return status === 'showed';
  }).length;

  // Closes = won opportunities
  const wonOpportunities = opportunities.filter((o: any) => o.status?.toLowerCase() === 'won');
  const closesCount = wonOpportunities.length;
  const revenue = wonOpportunities.reduce(
    (sum: number, o: any) => sum + (parseFloat(o.monetaryValue) || 0),
    0
  );

  const bookingRate = leadsCount > 0 ? (bookingsCount / leadsCount) * 100 : 0;
  const showRate = bookingsCount > 0 ? (showsCount / bookingsCount) * 100 : 0;

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
  };
}

async function fetchFromProxy(
  config: GHLConfig,
  type: 'opportunities' | 'appointments',
  startTime: number,
  endTime: number
): Promise<any[]> {
  const rawToken = config.accessToken.trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;

  const params = new URLSearchParams({
    locationId: config.locationId.trim(),
    startTime: startTime.toString(),
    endTime: endTime.toString(),
  });

  const response = await fetch(`/api/ghl/${type}?${params}`, {
    headers: { Authorization: token },
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? (await response.json()).error
      : await response.text();
    throw new Error(body || `Failed to fetch ${type} from GHL`);
  }

  const data = await response.json();
  return data[type] || data.data || [];
}
