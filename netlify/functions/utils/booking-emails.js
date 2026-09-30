// Guest-facing emails sent from the admin panel when the host confirms, declines
// or cancels a booking request. Trilingual (en / es / he), same look as the
// "we received your request" email in submit-inquiry.js.

const LOGO_URL = 'https://casapuravidanl.com/assets/email/email-logo.png';
const WHATSAPP_URL = 'https://wa.me/message/QZBXKQJ6BSIRN1';
const SITE_URL = 'https://casapuravidanl.com';

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const COMMON = {
  en: {
    greeting: (name) => `Dear ${name},`,
    checkin: 'Check-in', checkout: 'Check-out', guests: 'Guests over age 2', total: 'Total (incl. VAT)',
    noteTitle: 'A note from us',
    depositTitle: 'Security deposit',
    depositBody: 'A separate security deposit of €900 is required. This deposit is not part of the booking total shown above - it is charged separately, and is fully refunded within 5 business days after checkout, provided no damage occurred and house rules were respected.',
    cancelTitle: 'Cancellation policy',
    cancelLink: 'View the full cancellation policy',
    contactTitle: 'Questions? Contact us on WhatsApp',
    contactBody: 'You can call us or send a message directly on WhatsApp:',
    contactBtn: 'Open WhatsApp',
    footer: 'Casa Pura Vida Amsterdam - Sloten, Amsterdam, The Netherlands',
  },
  es: {
    greeting: (name) => `Hola ${name},`,
    checkin: 'Entrada', checkout: 'Salida', guests: 'Huéspedes mayores de 2 años', total: 'Total (IVA incl.)',
    noteTitle: 'Un mensaje de nuestra parte',
    depositTitle: 'Depósito de seguridad',
    depositBody: 'Se requiere un depósito de seguridad separado de 900€. Este depósito no forma parte del total mostrado arriba - se cobra por separado, y se reembolsa en su totalidad dentro de los 5 días hábiles posteriores a la salida, siempre que no haya daños y se respeten las normas de la casa.',
    cancelTitle: 'Política de cancelación',
    cancelLink: 'Ver la política de cancelación completa',
    contactTitle: '¿Preguntas? Contáctanos por WhatsApp',
    contactBody: 'Puedes llamarnos o enviarnos un mensaje directamente por WhatsApp:',
    contactBtn: 'Abrir WhatsApp',
    footer: 'Casa Pura Vida Amsterdam - Sloten, Ámsterdam, Países Bajos',
  },
  he: {
    greeting: (name) => `שלום ${name},`,
    checkin: 'הגעה', checkout: 'עזיבה', guests: 'אורחים מעל גיל שנתיים', total: 'סה"כ (כולל מע"מ)',
    noteTitle: 'הערה מאיתנו',
    depositTitle: 'פיקדון ביטחון',
    depositBody: 'נדרש פיקדון ביטחון נפרד בסך 900€. פיקדון זה אינו חלק מהסכום הכולל שמוצג למעלה - הוא נגבה בנפרד, ומוחזר במלואו עד 5 ימי עסקים לאחר תום השהייה, בכפוף לכך שלא נגרם נזק וכללי הבית כובדו.',
    cancelTitle: 'מדיניות ביטולים',
    cancelLink: 'צפייה במדיניות הביטולים המלאה',
    contactTitle: 'שאלות? צרו קשר בוואטסאפ',
    contactBody: 'ניתן להתקשר אלינו או לשלוח הודעה ישירות בוואטסאפ:',
    contactBtn: 'פתיחת וואטסאפ',
    footer: 'Casa Pura Vida Amsterdam - סלוטן, אמסטרדם, הולנד',
  },
};

const KINDS = {
  confirmed: {
    en: {
      subject: (ci, co) => `Your booking is confirmed: ${ci} to ${co}`,
      title: 'Your booking is confirmed ✓',
      intro: 'We are happy to confirm your stay at Casa Pura Vida Amsterdam. Here are your booking details:',
    },
    es: {
      subject: (ci, co) => `Tu reserva está confirmada: ${ci} a ${co}`,
      title: 'Tu reserva está confirmada ✓',
      intro: 'Nos alegra confirmar tu estancia en Casa Pura Vida Amsterdam. Estos son los datos de tu reserva:',
    },
    he: {
      subject: (ci, co) => `ההזמנה שלך אושרה: ${ci} עד ${co}`,
      title: 'ההזמנה שלך אושרה ✓',
      intro: 'אנחנו שמחים לאשר את השהייה שלך ב-Casa Pura Vida Amsterdam. הנה פרטי ההזמנה:',
    },
    theme: { bg: '#EAF3F2', title: '#1E4A50', text: '#2F6B73' },
    showDetails: true, showDeposit: true, showCancelPolicy: true,
  },
  declined: {
    en: {
      subject: (ci, co) => `About your booking request: ${ci} to ${co}`,
      title: 'We could not confirm your request',
      intro: 'Thank you for your interest in Casa Pura Vida Amsterdam. Unfortunately we are not able to confirm your booking request for these dates:',
      closing: 'We would be happy to help you find alternative dates - just contact us and we will look at the options together.',
    },
    es: {
      subject: (ci, co) => `Sobre tu solicitud de reserva: ${ci} a ${co}`,
      title: 'No pudimos confirmar tu solicitud',
      intro: 'Gracias por tu interés en Casa Pura Vida Amsterdam. Lamentablemente no podemos confirmar tu solicitud de reserva para estas fechas:',
      closing: 'Con gusto te ayudamos a encontrar fechas alternativas - contáctanos y revisaremos las opciones juntos.',
    },
    he: {
      subject: (ci, co) => `בנוגע לבקשת ההזמנה שלך: ${ci} עד ${co}`,
      title: 'לא הצלחנו לאשר את הבקשה שלך',
      intro: 'תודה על העניין שלך ב-Casa Pura Vida Amsterdam. לצערנו אין באפשרותנו לאשר את בקשת ההזמנה שלך לתאריכים הבאים:',
      closing: 'נשמח לעזור לך למצוא תאריכים חלופיים - פשוט צרו איתנו קשר ונבדוק את האפשרויות יחד.',
    },
    theme: { bg: '#F3F1EE', title: '#3A3D40', text: '#54595E' },
    showDetails: 'datesOnly', showDeposit: false, showCancelPolicy: false,
  },
  cancelled: {
    en: {
      subject: (ci, co) => `Your booking has been cancelled: ${ci} to ${co}`,
      title: 'Your booking has been cancelled',
      intro: 'We are writing to let you know that the following booking at Casa Pura Vida Amsterdam has been cancelled:',
      closing: 'If you have any questions, or would like to look at other dates, please contact us.',
    },
    es: {
      subject: (ci, co) => `Tu reserva ha sido cancelada: ${ci} a ${co}`,
      title: 'Tu reserva ha sido cancelada',
      intro: 'Te escribimos para informarte de que la siguiente reserva en Casa Pura Vida Amsterdam ha sido cancelada:',
      closing: 'Si tienes alguna pregunta, o quieres ver otras fechas, por favor contáctanos.',
    },
    he: {
      subject: (ci, co) => `ההזמנה שלך בוטלה: ${ci} עד ${co}`,
      title: 'ההזמנה שלך בוטלה',
      intro: 'אנחנו כותבים כדי להודיע שההזמנה הבאה ב-Casa Pura Vida Amsterdam בוטלה:',
      closing: 'לכל שאלה, או אם תרצו לבדוק תאריכים אחרים, אנחנו זמינים עבורכם.',
    },
    theme: { bg: '#FBEFE0', title: '#8A5A2B', text: '#6B4A26' },
    showDetails: 'datesOnly', showDeposit: false, showCancelPolicy: false,
  },
};

function buildEmail(kind, booking, lang, opts) {
  const k = KINDS[kind];
  if (!k) throw new Error('Unknown email kind: ' + kind);
  const safeLang = ['en', 'es', 'he'].includes(lang) ? lang : 'en';
  const c = COMMON[safeLang];
  const t = k[safeLang];
  const dir = safeLang === 'he' ? 'rtl' : 'ltr';
  const align = safeLang === 'he' ? 'right' : 'left';
  const valAlign = safeLang === 'he' ? 'left' : 'right';
  const note = opts && opts.note ? String(opts.note).trim() : '';
  const total = (opts && opts.total) || booking.estimatedTotal || '';

  const row = (label, value, last) =>
    `<tr><td style="padding:8px 0; ${last ? '' : 'border-bottom:1px solid #E7E5E1;'} font-weight:bold; color:#1A1D1F;">${label}</td><td style="padding:8px 0; ${last ? '' : 'border-bottom:1px solid #E7E5E1;'} text-align:${valAlign};">${escapeHtml(value)}</td></tr>`;

  let detailsRows = row(c.checkin, booking.checkin) + row(c.checkout, booking.checkout, k.showDetails === 'datesOnly');
  if (k.showDetails === true) {
    detailsRows = row(c.checkin, booking.checkin) + row(c.checkout, booking.checkout) + row(c.guests, booking.guests)
      + (total ? row(c.total, total, true) : '');
  }

  const noteBlock = note
    ? `<div style="background:#ffffff; border:1px solid #E7E5E1; border-radius:12px; padding:16px 18px; margin-bottom:20px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1A1D1F; font-size:14px;">${c.noteTitle}</p>
        <p style="margin:0; font-size:13.5px; color:#54595E; line-height:1.6; white-space:pre-wrap;">${escapeHtml(note)}</p>
      </div>`
    : '';

  const html = `
  <div dir="${dir}" style="font-family:Arial,Helvetica,sans-serif; max-width:560px; margin:0 auto; background:#FAFAF9; padding:0;">
    <div style="background:#ffffff; padding:28px 24px 20px; text-align:center; border-bottom:1px solid #E7E5E1;">
      <img src="${LOGO_URL}" alt="Casa Pura Vida" width="220" style="max-width:220px; height:auto;">
    </div>
    <div style="padding:28px 24px; text-align:${align};">
      <p style="font-size:15px; color:#1A1D1F; margin:0 0 12px;">${c.greeting(escapeHtml(booking.name))}</p>

      <div style="background:${k.theme.bg}; border-radius:12px; padding:16px 18px; margin-bottom:20px;">
        <p style="margin:0 0 6px; font-weight:bold; color:${k.theme.title}; font-size:16px;">${t.title}</p>
        <p style="margin:0; font-size:13.5px; color:${k.theme.text}; line-height:1.6;">${t.intro}</p>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:20px;">
        ${detailsRows}
      </table>

      ${noteBlock}

      ${t.closing ? `<p style="font-size:13.5px; color:#54595E; line-height:1.6; margin:0 0 20px;">${t.closing}</p>` : ''}

      ${k.showDeposit ? `<div style="background:#EAF3F2; border-radius:12px; padding:16px 18px; margin-bottom:20px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1E4A50; font-size:14px;">${c.depositTitle}</p>
        <p style="margin:0; font-size:13.5px; color:#2F6B73; line-height:1.5;">${c.depositBody}</p>
      </div>` : ''}

      ${k.showCancelPolicy ? `<div style="margin-bottom:24px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1A1D1F; font-size:14px;">${c.cancelTitle}</p>
        <a href="${SITE_URL}/#booking" style="font-size:13.5px; color:#2F6B73;">${c.cancelLink} →</a>
      </div>` : ''}

      <div style="text-align:center; padding:20px; background:#ffffff; border:1px solid #E7E5E1; border-radius:12px;">
        <p style="margin:0 0 4px; font-weight:bold; color:#1A1D1F; font-size:14px;">${c.contactTitle}</p>
        <p style="margin:0 0 14px; font-size:13.5px; color:#54595E;">${c.contactBody}</p>
        <a href="${WHATSAPP_URL}" style="display:inline-block; background:#25D366; color:#ffffff; text-decoration:none; padding:10px 22px; border-radius:100px; font-size:14px; font-weight:bold;">${c.contactBtn}</a>
      </div>
    </div>
    <div style="padding:16px 24px; text-align:center; font-size:11.5px; color:#8A9291;">
      ${c.footer}
    </div>
  </div>
  `;

  return { subject: t.subject(booking.checkin, booking.checkout), html };
}

async function sendGuestEmail({ kind, booking, lang, note, total }) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const { subject, html } = buildEmail(kind, booking, lang, { note, total });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: booking.email,
      reply_to: adminEmail || undefined,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email provider error ${res.status}: ${text}`);
  }
  return true;
}

module.exports = { sendGuestEmail, buildEmail };
