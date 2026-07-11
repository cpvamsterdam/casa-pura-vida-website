const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');

const DEFAULT_DATA = {
  blockedRanges: [],       // array of { start:'YYYY-MM-DD', end:'YYYY-MM-DD', name:string } - ADMIN ONLY, never exposed publicly
  holidayDates: [],        // array of { start:'YYYY-MM-DD', end:'YYYY-MM-DD', priceEUR: number, label: string }
  basePriceEUR: 800,       // per night, up to 6 guests, regular (non-holiday) dates
  holidayPriceEUR: 900,    // per night, up to 6 guests, on holiday dates (default suggestion for new ranges)
  extraGuestPriceEUR: 50,  // per extra guest per night, beyond 6, up to 12 total
  minNights: 3,            // minimum stay, year-round
  vatRate: 0.21,           // Netherlands VAT rate on short-stay accommodation (21% as of Jan 2026)
};

function formatDateISO(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Expands admin-entered ranges (inclusive of both start and end night) into a flat,
// deduplicated list of blocked date strings - this is the only thing shown publicly.
function expandRangesToDates(ranges){
  const dates = new Set();
  for (const r of (ranges || [])) {
    if (!r || !/^\d{4}-\d{2}-\d{2}$/.test(r.start) || !/^\d{4}-\d{2}-\d{2}$/.test(r.end)) continue;
    let cursor = new Date(r.start);
    const end = new Date(r.end);
    // Safety cap so a malformed range can't loop forever
    let guard = 0;
    while (cursor <= end && guard < 3660) {
      dates.add(formatDateISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }
  return Array.from(dates).sort();
}

exports.handler = async (event) => {
  const session = requireSession(event);

  // One-time migration: older data used a flat `blockedDates` array with no names.
  // If we find that old shape and no `blockedRanges` yet, convert each date into its
  // own single-night range so nothing you already blocked gets lost.
  function migrateOldShape(stored) {
    if (!stored.blockedRanges && Array.isArray(stored.blockedDates)) {
      return stored.blockedDates
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .map(d => ({ start: d, end: d, name: '' }));
    }
    return stored.blockedRanges || DEFAULT_DATA.blockedRanges;
  }

  if (event.httpMethod === 'GET') {
    // Merge with defaults (not just fall back to them) so that data stored under an
    // older schema still has every field the frontend expects, instead of missing new ones.
    const stored = await getJSON('booking-data', {});
    const data = { ...DEFAULT_DATA, ...stored, blockedRanges: migrateOldShape(stored) };
    const blockedDates = expandRangesToDates(data.blockedRanges);

    const publicData = {
      blockedDates,
      holidayDates: data.holidayDates,
      basePriceEUR: data.basePriceEUR,
      holidayPriceEUR: data.holidayPriceEUR,
      extraGuestPriceEUR: data.extraGuestPriceEUR,
      minNights: data.minNights,
      vatRate: data.vatRate,
    };

    if (!session) {
      // Guests / the public booking page never see guest names tied to blocked dates.
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publicData) };
    }

    // Admin (authenticated): also include the named ranges for the admin calendar to display.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...publicData, blockedRanges: data.blockedRanges }),
    };
  }

  if (event.httpMethod === 'POST') {
    if (!session) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
    }

    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
    }

    const currentStored = await getJSON('booking-data', {});
    const current = { ...DEFAULT_DATA, ...currentStored, blockedRanges: migrateOldShape(currentStored) };

    const validHolidayDates = Array.isArray(body.holidayDates)
      ? body.holidayDates.filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(h.start) && /^\d{4}-\d{2}-\d{2}$/.test(h.end) && typeof h.priceEUR === 'number' && h.priceEUR > 0)
      : current.holidayDates;

    const validBlockedRanges = Array.isArray(body.blockedRanges)
      ? body.blockedRanges
          .filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(r.start) && /^\d{4}-\d{2}-\d{2}$/.test(r.end))
          .map(r => ({ start: r.start, end: r.end, name: typeof r.name === 'string' ? r.name.slice(0, 200) : '' }))
      : current.blockedRanges;

    const next = {
      blockedRanges: validBlockedRanges,
      holidayDates: validHolidayDates,
      basePriceEUR: typeof body.basePriceEUR === 'number' && body.basePriceEUR > 0 ? body.basePriceEUR : current.basePriceEUR,
      holidayPriceEUR: typeof body.holidayPriceEUR === 'number' && body.holidayPriceEUR > 0 ? body.holidayPriceEUR : current.holidayPriceEUR,
      extraGuestPriceEUR: typeof body.extraGuestPriceEUR === 'number' && body.extraGuestPriceEUR >= 0 ? body.extraGuestPriceEUR : current.extraGuestPriceEUR,
      minNights: typeof body.minNights === 'number' && body.minNights >= 1 ? body.minNights : current.minNights,
      vatRate: typeof body.vatRate === 'number' && body.vatRate >= 0 ? body.vatRate : current.vatRate,
    };

    await setJSON('booking-data', next);
    const blockedDates = expandRangesToDates(next.blockedRanges);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...next, blockedDates }) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
