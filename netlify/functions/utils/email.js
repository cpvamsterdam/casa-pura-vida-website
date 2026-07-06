// Sends email via Resend (https://resend.com). Free tier covers this use case easily
// (a handful of login emails per month). Requires RESEND_API_KEY env var.
async function sendOtpEmail(code) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.ADMIN_EMAIL; // fixed, set once in Netlify env vars - never user-supplied
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set.');
  if (!toEmail) throw new Error('ADMIN_EMAIL environment variable is not set.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject: `Casa Pura Vida admin login code: ${code}`,
      html: `
        <div style="font-family:sans-serif; max-width:400px; margin:0 auto;">
          <h2 style="color:#2F6B73;">Admin login verification</h2>
          <p>Your one-time code is:</p>
          <p style="font-size:32px; font-weight:bold; letter-spacing:6px; color:#1A1D1F;">${code}</p>
          <p style="color:#54595E; font-size:13px;">This code expires in 5 minutes. If you didn't request this, someone else knows your admin password — consider changing it.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send OTP email: ${res.status} ${text}`);
  }
  return true;
}

module.exports = { sendOtpEmail };
