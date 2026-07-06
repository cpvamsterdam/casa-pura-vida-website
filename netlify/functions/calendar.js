const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');

const DEFAULT_DATA = {
  blockedDates: [],       // array of 'YYYY-MM-DD' strings
  seasonalPrices: [],     // array of { start:'YYYY-MM-DD', end:'YYYY-MM-DD', pricePerNightILS: number, label: string }
  basePriceILS: 2600,     // base price per night, up to 6 guests, non-holiday
  extraGuestPriceILS: 200 // per extra guest per night
};

exports.handler = async (event) => {
  const session = requireSession(event);

  if (event.httpMethod === 'GET') {
    // Public-readable: the booking page needs this to show availability/pricing,
    // but only the admin (verified session) can see it via the admin UI too - same data either way.
    const data = await getJSON('booking-data', DEFAULT_DATA);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'POST') {
    // Writing requires a valid admin session
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

    // Basic validation to avoid corrupting the stored data with garbage
    const next = {
      blockedDates: Array.isArray(body.blockedDates) ? body.blockedDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : current.blockedDates,
      seasonalPrices: Array.isArray(body.seasonalPrices) ? body.seasonalPrices : current.seasonalPrices,
      basePriceILS: typeof body.basePriceILS === 'number' && body.basePriceILS > 0 ? body.basePriceILS : current.basePriceILS,
      extraGuestPriceILS: typeof body.extraGuestPriceILS === 'number' && body.extraGuestPriceILS >= 0 ? body.extraGuestPriceILS : current.extraGuestPriceILS,
    };

    await setJSON('booking-data', next);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
