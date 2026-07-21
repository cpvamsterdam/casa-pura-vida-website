const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');

const DEFAULT_DATA = {
  blockedRanges: [],           // array of { start:'YYYY-MM-DD', end:'YYYY-MM-DD', name:string } - ADMIN ONLY, never exposed publicly
  holidayDates: [],            // array of { start:'YYYY-MM-DD', end:'YYYY-MM-DD', priceEUR: number, label: string } - priceEUR here is the 3-6 guest holiday rate for that range (defaults to holidayPriceEUR when adding)
  basePriceEUR: 800,           // per night, 3-6 guests, regular (non-holiday) dates
  holidayPriceEUR: 900,        // per night, 3-6 guests, holiday dates
  extraGuestPriceEUR: 50,      // per extra guest per night, beyond 6, up to 12 total (both regular and holiday)
  coupleAutumnWinterEUR: 550,  // per night, 1-2 guests, regular dates, Sep-Feb
  coupleSpringSummerEUR: 600,  // per night, 1-2 guests, regular dates, Mar-Aug
  coupleHolidayEUR: 750,       // per night, 1-2 guests, holiday dates (any season)
  nightDiscount5to10EUR: 100,  // per-night discount, applied to every night, for stays of 5-10 nights
  nightDiscount11to30EUR: 150, // per-night discount, applied to every night, for stays of 11-30 nights
  minNights: 3,                // minimum stay, year-round
  maxNights: 30,               // maximum stay bookable online; beyond this, guest must contact the booking desk directly
  vatRate: 0.21,               // Netherlands VAT rate on short-stay accommodation (21% as of Jan 2026)
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
  function migrateOldShape(stored) {
    if (!stored.blockedRanges && Array.isArray(stored.blockedDates)) {
      return stored.blockedDates
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .map(d => ({ start: d, end: d, name: '' }));
    }
    return stored.blockedRanges || DEFAULT_DATA.blockedRanges;
  }

  if (event.httpMethod === 'GET') {
    const stored = await getJSON('booking-data', {});
    const data = { ...DEFAULT_DATA, ...stored, blockedRanges: migrateOldShape(stored) };
    const blockedDates = expandRangesToDates(data.blockedRanges);

    const publicData = {
      blockedDates,
      holidayDates: data.holidayDates,
      basePriceEUR: data.basePriceEUR,
      holidayPriceEUR: data.holidayPriceEUR,
      extraGuestPriceEUR: data.extraGuestPriceEUR,
      coupleAutumnWinterEUR: data.coupleAutumnWinterEUR,
      coupleSpringSummerEUR: data.coupleSpringSummerEUR,
      coupleHolidayEUR: data.coupleHolidayEUR,
      nightDiscount5to10EUR: data.nightDiscount5to10EUR,
      nightDiscount11to30EUR: data.nightDiscount11to30EUR,
      minNights: data.minNights,
      maxNights: data.maxNights,
      vatRate: data.vatRate,
    };

    if (!session) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publicData) };
    }
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

    const numOr = (val, fallback, min) => (typeof val === 'number' && val >= (min ?? 0)) ? val : fallback;

    const next = {
      blockedRanges: validBlockedRanges,
      holidayDates: validHolidayDates,
      basePriceEUR: numOr(body.basePriceEUR, current.basePriceEUR, 1),
      holidayPriceEUR: numOr(body.holidayPriceEUR, current.holidayPriceEUR, 1),
      extraGuestPriceEUR: numOr(body.extraGuestPriceEUR, current.extraGuestPriceEUR, 0),
      coupleAutumnWinterEUR: numOr(body.coupleAutumnWinterEUR, current.coupleAutumnWinterEUR, 1),
      coupleSpringSummerEUR: numOr(body.coupleSpringSummerEUR, current.coupleSpringSummerEUR, 1),
      coupleHolidayEUR: numOr(body.coupleHolidayEUR, current.coupleHolidayEUR, 1),
      nightDiscount5to10EUR: numOr(body.nightDiscount5to10EUR, current.nightDiscount5to10EUR, 0),
      nightDiscount11to30EUR: numOr(body.nightDiscount11to30EUR, current.nightDiscount11to30EUR, 0),
      minNights: numOr(body.minNights, current.minNights, 1),
      maxNights: numOr(body.maxNights, current.maxNights, 1),
      vatRate: numOr(body.vatRate, current.vatRate, 0),
    };

    await setJSON('booking-data', next);
    const blockedDates = expandRangesToDates(next.blockedRanges);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...next, blockedDates }) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
