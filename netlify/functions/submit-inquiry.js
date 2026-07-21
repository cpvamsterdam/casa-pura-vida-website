// Sends a real email notification when a guest submits the booking inquiry form,
// and also sends the guest a styled confirmation-of-receipt email (not a booking
// confirmation - that still requires host approval).
// Uses the same Resend account already configured for admin login codes.

const LOGO_URL = 'https://casapuravidanl.com/assets/email/email-logo.png';
const WHATSAPP_URL = 'https://wa.me/message/QZBXKQJ6BSIRN1';
const SITE_URL = 'https://casapuravidanl.com';

async function verifyRecaptcha(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { ok: false, reason: 'RECAPTCHA_SECRET_KEY not configured on the server.' };
  }
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.append('remoteip', remoteIp);
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const result = await res.json();
  return { ok: !!result.success, reason: result.success ? '' : JSON.stringify(result['error-codes'] || []) };
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const GUEST_EMAIL_TEXT = {
  en: {
    subject: (checkin, checkout) => `We received your booking request: ${checkin} to ${checkout}`,
    preheader: 'This is a confirmation of receipt, not a booking confirmation.',
    greeting: (name) => `Dear ${name},`,
    intro: 'Thank you for your booking request for Casa Pura Vida Amsterdam. Here are the details you submitted:',
    notConfirmationTitle: 'Important - this is not a booking confirmation',
    notConfirmationBody: 'Your reservation is not yet confirmed. We will review your request and confirm availability within 1 business day.',
    checkin: 'Check-in', checkout: 'Check-out', guests: 'Guests over age 2', total: 'Estimated total (incl. VAT)', message: 'Your message',
    depositTitle: 'Security deposit',
    depositBody: 'A separate security deposit of €900 is required once your booking is confirmed. This deposit is not part of the booking total shown above - it is charged separately, and is fully refunded within 5 business days after checkout, provided no damage occurred and house rules were respected.',
    cancelTitle: 'Cancellation policy',
    cancelBody: 'By submitting this request you have confirmed you read and agree to our cancellation policy.',
    cancelLink: 'View the full cancellation policy',
    contactTitle: 'Questions? Contact us on WhatsApp',
    contactBody: 'You can call us or send a message directly on WhatsApp:',
    contactBtn: 'Open WhatsApp',
    footer: 'Casa Pura Vida Amsterdam - Sloten, Amsterdam, The Netherlands',
  },
  es: {
    subject: (checkin, checkout) => `Hemos recibido tu solicitud de reserva: ${checkin} a ${checkout}`,
    preheader: 'Esto es una confirmación de recepción, no una confirmación de reserva.',
    greeting: (name) => `Hola ${name},`,
    intro: 'Gracias por tu solicitud de reserva para Casa Pura Vida Amsterdam. Estos son los datos que enviaste:',
    notConfirmationTitle: 'Importante - esto no es una confirmación de reserva',
    notConfirmationBody: 'Tu reserva aún no está confirmada. Revisaremos tu solicitud y confirmaremos la disponibilidad dentro de 1 día hábil.',
    checkin: 'Entrada', checkout: 'Salida', guests: 'Huéspedes mayores de 2 años', total: 'Total estimado (IVA incl.)', message: 'Tu mensaje',
    depositTitle: 'Depósito de seguridad',
    depositBody: 'Se requiere un depósito de seguridad separado de 900€ una vez confirmada tu reserva. Este depósito no forma parte del total mostrado arriba - se cobra por separado, y se reembolsa en su totalidad dentro de los 5 días hábiles posteriores a la salida, siempre que no haya daños y se respeten las normas de la casa.',
    cancelTitle: 'Política de cancelación',
    cancelBody: 'Al enviar esta solicitud has confirmado que leíste y aceptas nuestra política de cancelación.',
    cancelLink: 'Ver la política de cancelación completa',
    contactTitle: '¿Preguntas? Contáctanos por WhatsApp',
    contactBody: 'Puedes llamarnos o enviarnos un mensaje directamente por WhatsApp:',
    contactBtn: 'Abrir WhatsApp',
    footer: 'Casa Pura Vida Amsterdam - Sloten, Ámsterdam, Países Bajos',
  },
  he: {
    subject: (checkin, checkout) => `קיבלנו את בקשת ההזמנה שלך: ${checkin} עד ${checkout}`,
    preheader: 'זהו אישור קבלה בלבד, לא אישור הזמנה.',
    greeting: (name) => `שלום ${name},`,
    intro: 'תודה על בקשת ההזמנה שלך ל-Casa Pura Vida Amsterdam. הנה הפרטים ששלחת:',
    notConfirmationTitle: 'חשוב - זהו לא אישור הזמנה',
    notConfirmationBody: 'ההזמנה שלך עדיין לא מאושרת. נבדוק את הבקשה ונאשר זמינות תוך יום עסקים אחד.',
    checkin: 'הגעה', checkout: 'עזיבה', guests: 'אורחים מעל גיל שנתיים', total: 'סה"כ משוער (כולל מע"מ)', message: 'ההודעה שלך',
    depositTitle: 'פיקדון ביטחון',
    depositBody: 'נדרש פיקדון ביטחון נפרד בסך 3,000 ₪ לאחר אישור ההזמנה. פיקדון זה אינו חלק מהסכום הכולל שמוצג למעלה - הוא נגבה בנפרד, ומוחזר במלואו עד 5 ימי עסקים לאחר תום השהייה, בכפוף לכך שלא נגרם נזק וכללי הבית כובדו.',
    cancelTitle: 'מדיניות ביטולים',
    cancelBody: 'בשליחת הבקשה אישרת שקראת והסכמת למדיניות הביטולים שלנו.',
    cancelLink: 'צפייה במדיניות הביטולים המלאה',
    contactTitle: 'שאלות? צרו קשר בוואטסאפ',
    contactBody: 'ניתן להתקשר אלינו או לשלוח הודעה ישירות בוואטסאפ:',
    contactBtn: 'פתיחת וואטסאפ',
    footer: 'Casa Pura Vida Amsterdam - סלוטן, אמסטרדם, הולנד',
  },
};

function buildGuestEmailHtml(data, lang) {
  const t = GUEST_EMAIL_TEXT[lang] || GUEST_EMAIL_TEXT.en;
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const align = lang === 'he' ? 'right' : 'left';
  return `
  <div dir="${dir}" style="font-family:Arial,Helvetica,sans-serif; max-width:560px; margin:0 auto; background:#FAFAF9; padding:0;">
    <div style="background:#ffffff; padding:28px 24px 20px; text-align:center; border-bottom:1px solid #E7E5E1;">
      <img src="${LOGO_URL}" alt="Casa Pura Vida" width="220" style="max-width:220px; height:auto;">
    </div>
    <div style="padding:28px 24px; text-align:${align};">
      <p style="font-size:15px; color:#1A1D1F; margin:0 0 12px;">${t.greeting(escapeHtml(data.name))}</p>
      <p style="font-size:14px; color:#54595E; line-height:1.6; margin:0 0 20px;">${t.intro}</p>

      <div style="background:#FBEFE0; border-radius:12px; padding:16px 18px; margin-bottom:20px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#8A5A2B; font-size:14px;">⚠ ${t.notConfirmationTitle}</p>
        <p style="margin:0; font-size:13.5px; color:#6B4A26; line-height:1.5;">${t.notConfirmationBody}</p>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:20px;">
        <tr><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; font-weight:bold; color:#1A1D1F;">${t.checkin}</td><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; text-align:${lang==='he'?'left':'right'};">${escapeHtml(data.checkin)}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; font-weight:bold; color:#1A1D1F;">${t.checkout}</td><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; text-align:${lang==='he'?'left':'right'};">${escapeHtml(data.checkout)}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; font-weight:bold; color:#1A1D1F;">${t.guests}</td><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; text-align:${lang==='he'?'left':'right'};">${escapeHtml(data.guests)}</td></tr>
        <tr><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; font-weight:bold; color:#1A1D1F;">${t.total}</td><td style="padding:8px 0; border-bottom:1px solid #E7E5E1; text-align:${lang==='he'?'left':'right'};">${escapeHtml(data.estimatedTotal || 'n/a')}</td></tr>
        ${data.message ? `<tr><td style="padding:8px 0; font-weight:bold; color:#1A1D1F; vertical-align:top;">${t.message}</td><td style="padding:8px 0; text-align:${lang==='he'?'left':'right'};">${escapeHtml(data.message)}</td></tr>` : ''}
      </table>

      <div style="background:#EAF3F2; border-radius:12px; padding:16px 18px; margin-bottom:20px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1E4A50; font-size:14px;">${t.depositTitle}</p>
        <p style="margin:0; font-size:13.5px; color:#2F6B73; line-height:1.5;">${t.depositBody}</p>
      </div>

      <div style="margin-bottom:24px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1A1D1F; font-size:14px;">${t.cancelTitle}</p>
        <p style="margin:0 0 6px; font-size:13.5px; color:#54595E; line-height:1.5;">${t.cancelBody}</p>
        <a href="${SITE_URL}/#booking" style="font-size:13.5px; color:#2F6B73;">${t.cancelLink} →</a>
      </div>

      <div style="text-align:center; padding:20px; background:#ffffff; border:1px solid #E7E5E1; border-radius:12px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1A1D1F; font-size:14px;">${t.contactTitle}</p>
        <p style="margin:0 0 14px; font-size:13.5px; color:#54595E;">${t.contactBody}</p>
        <a href="${WHATSAPP_URL}" style="display:inline-block; background:#25D366; color:#ffffff; text-decoration:none; padding:10px 22px; border-radius:100px; font-size:14px; font-weight:bold;">${t.contactBtn}</a>
      </div>
    </div>
    <div style="padding:16px 24px; text-align:center; font-size:11.5px; color:#8A9291;">
      ${t.footer}
    </div>
  </div>
  `;
}

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

  if (!data.recaptchaToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing reCAPTCHA verification.' }) };
  }
  const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'];
  const recaptchaCheck = await verifyRecaptcha(data.recaptchaToken, clientIp);
  if (!recaptchaCheck.ok) {
    return { statusCode: 403, body: JSON.stringify({ error: 'reCAPTCHA verification failed.', detail: recaptchaCheck.reason }) };
  }

  const required = ['name', 'email', 'phone', 'checkin', 'checkout', 'guests'];
  for (const field of required) {
    if (!data[field]) {
      return { statusCode: 400, body: JSON.stringify({ error: `Missing required field: ${field}` }) };
    }
  }

  const lang = ['en', 'es', 'he'].includes(data.lang) ? data.lang : 'en';

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ADMIN_EMAIL;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey || !toEmail) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured for sending emails.' }) };
  }

  const adminHtml = `
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
        html: adminHtml,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send notification email: ' + text }) };
    }
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send notification email: ' + err.message }) };
  }

  // Send the guest-facing confirmation-of-receipt email. This is best-effort - if it
  // fails, we don't fail the whole request, since the admin has already been notified
  // and can follow up manually. We report it in the response so issues are visible.
  let guestEmailSent = false;
  try {
    const t = GUEST_EMAIL_TEXT[lang] || GUEST_EMAIL_TEXT.en;
    const guestRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: data.email,
        reply_to: toEmail,
        subject: t.subject(data.checkin, data.checkout),
        html: buildGuestEmailHtml(data, lang),
      }),
    });
    guestEmailSent = guestRes.ok;
  } catch (err) {
    guestEmailSent = false;
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Sent.', guestEmailSent }) };
};
