// Sends a real email notification when a guest submits the booking inquiry form.
// Uses the same Resend account already configured for admin login codes.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const required = ['name', 'email', 'phone', 'checkin', 'checkout', 'guests'];
  for (const field of required) {
    if (!data[field]) {
      return { statusCode: 400, body: JSON.stringify({ error: `Missing required field: ${field}` }) };
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ADMIN_EMAIL;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey || !toEmail) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured for sending emails.' }) };
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const html = `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
      <h2 style="color:#2F6B73;">New booking request - Casa Pura Vida</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:6px 0; font-weight:bold;">Name</td><td>${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Email</td><td>${escapeHtml(data.email)}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Phone</td><td>${escapeHtml(data.phone)}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Check-in</td><td>${escapeHtml(data.checkin)}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Check-out</td><td>${escapeHtml(data.checkout)}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Guests over age 2</td><td>${escapeHtml(data.guests)}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Estimated total (incl. VAT)</td><td>${escapeHtml(data.estimatedTotal || 'n/a')}</td></tr>
        <tr><td style="padding:6px 0; font-weight:bold;">Message</td><td>${escapeHtml(data.message || '-')}</td></tr>
      </table>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        reply_to: data.email,
        subject: `New booking request: ${data.checkin} to ${data.checkout}`,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send notification email: ' + text }) };
    }
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send notification email: ' + err.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Sent.' }) };
};
