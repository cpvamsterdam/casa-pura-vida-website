const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');

const DEFAULT_DATA = {
  blockedDates: [],        // array of 'YYYY-MM-DD' strings
  holidayDates: [],        // array of { start:'YYYY-MM-DD', end:'YYYY-MM-DD', priceEUR: number, label: string }
  basePriceEUR: 800,       // per night, up to 6 guests, regular (non-holiday) dates
  holidayPriceEUR: 900,    // per night, up to 6 guests, on holiday dates (default suggestion for new ranges)
  extraGuestPriceEUR: 50,  // per extra guest per night, beyond 6, up to 12 total
  minNights: 3,            // minimum stay, year-round
  vatRate: 0.21,           // Netherlands VAT rate on short-stay accommodation (21% as of Jan 2026)
};

exports.handler = async (event) => {
  const session = requireSession(event);

  if (event.httpMethod === 'GET') {
    const data = await getJSON('booking-data', DEFAULT_DATA);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
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

    const current = await getJSON('booking-data', DEFAULT_DATA);

    const validHolidayDates = Array.isArray(body.holidayDates)
      ? body.holidayDates.filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(h.start) && /^\d{4}-\d{2}-\d{2}$/.test(h.end) && typeof h.priceEUR === 'number' && h.priceEUR > 0)
      : current.holidayDates;

    const next = {
      blockedDates: Array.isArray(body.blockedDates) ? body.blockedDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : current.blockedDates,
      holidayDates: validHolidayDates,
      basePriceEUR: typeof body.basePriceEUR === 'number' && body.basePriceEUR > 0 ? body.basePriceEUR : current.basePriceEUR,
      holidayPriceEUR: typeof body.holidayPriceEUR === 'number' && body.holidayPriceEUR > 0 ? body.holidayPriceEUR : current.holidayPriceEUR,
      extraGuestPriceEUR: typeof body.extraGuestPriceEUR === 'number' && body.extraGuestPriceEUR >= 0 ? body.extraGuestPriceEUR : current.extraGuestPriceEUR,
      minNights: typeof body.minNights === 'number' && body.minNights >= 1 ? body.minNights : current.minNights,
      vatRate: typeof body.vatRate === 'number' && body.vatRate >= 0 ? body.vatRate : current.vatRate,
    };

    await setJSON('booking-data', next);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
