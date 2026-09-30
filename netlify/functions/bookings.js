// Admin-only booking requests manager.
//   GET                      -> list of all booking requests (newest first)
//   POST {action:'confirm'}  -> mark confirmed + email the guest an official confirmation
//   POST {action:'decline'}  -> mark declined  + email the guest a polite decline
//   POST {action:'cancel'}   -> mark cancelled + email the guest a cancellation notice
//   POST {action:'delete'}   -> remove a request from the list (no email)
// The status only changes AFTER the email was sent successfully, so a failed send
// can simply be retried.

const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');
const { sendGuestEmail } = require('./utils/booking-emails');

const STORE_KEY = 'bookings-data';
const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

// action -> { from: allowed current statuses, to: new status, emailKind }
const TRANSITIONS = {
  confirm: { from: ['pending'], to: 'confirmed', emailKind: 'confirmed' },
  decline: { from: ['pending'], to: 'declined', emailKind: 'declined' },
  cancel: { from: ['confirmed'], to: 'cancelled', emailKind: 'cancelled' },
};

exports.handler = async (event) => {
  const session = requireSession(event);
  if (!session) return json(401, { error: 'Not authenticated.' });

  if (event.httpMethod === 'GET') {
    const data = await getJSON(STORE_KEY, { bookings: [] });
    const list = Array.isArray(data.bookings) ? data.bookings.slice() : [];
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json(200, { bookings: list });
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid request body.' });
  }

  const data = await getJSON(STORE_KEY, { bookings: [] });
  if (!Array.isArray(data.bookings)) data.bookings = [];
  const booking = data.bookings.find((b) => b.id === body.bookingId);
  if (!booking) return json(404, { error: 'Booking request not found.' });

  if (body.action === 'delete') {
    data.bookings = data.bookings.filter((b) => b.id !== body.bookingId);
    await setJSON(STORE_KEY, data);
    return json(200, { message: 'ok' });
  }

  const tr = TRANSITIONS[body.action];
  if (!tr) return json(400, { error: 'Unknown action.' });
  if (!tr.from.includes(booking.status)) {
    return json(409, { error: `This request is already "${booking.status}" and cannot be changed this way.` });
  }

  const lang = ['en', 'es', 'he'].includes(body.lang) ? body.lang : (booking.lang || 'en');
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1500) : '';
  const total = typeof body.total === 'string' ? body.total.trim().slice(0, 40) : '';

  try {
    await sendGuestEmail({ kind: tr.emailKind, booking, lang, note, total });
  } catch (err) {
    return json(502, { error: 'Email was not sent, so the status was not changed. ' + err.message });
  }

  booking.status = tr.to;
  if (body.action === 'confirm' && total) booking.estimatedTotal = total;
  booking.history = Array.isArray(booking.history) ? booking.history : [];
  booking.history.push({ status: tr.to, at: new Date().toISOString(), note, emailLang: lang });
  await setJSON(STORE_KEY, data);

  return json(200, { message: 'ok', booking });
};
