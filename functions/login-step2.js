const { verifyOtp } = require('./utils/otp');
const { getJSON, deleteKey } = require('./utils/storage');
const { checkRateLimit, recordFailedAttempt, clearRateLimit } = require('./utils/ratelimit');
const { createSessionToken, buildSetCookieHeader } = require('./utils/session');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  const rateLimitKey = `login-step2:${clientIp}`;

  const rl = await checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.remainingMs / 60000);
    return { statusCode: 429, body: JSON.stringify({ error: `Too many attempts. Try again in ${minutes} minute(s).` }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { otpSessionId, code } = body;
  if (!otpSessionId || !code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing code.' }) };
  }

  const record = await getJSON(`otp:${otpSessionId}`);
  if (!record) {
    await recordFailedAttempt(rateLimitKey);
    return { statusCode: 401, body: JSON.stringify({ error: 'Code expired or invalid. Please log in again.' }) };
  }

  if (Date.now() > record.expiresAt) {
    await deleteKey(`otp:${otpSessionId}`);
    return { statusCode: 401, body: JSON.stringify({ error: 'Code expired. Please log in again.' }) };
  }

  const valid = verifyOtp(code, otpSessionId, record.otpHash);
  if (!valid) {
    await recordFailedAttempt(rateLimitKey);
    // also track attempts against this specific OTP so it can't be brute-forced
    // even from different IPs within its 5-minute window
    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts >= 5) {
      await deleteKey(`otp:${otpSessionId}`);
      return { statusCode: 401, body: JSON.stringify({ error: 'Too many wrong codes. Please log in again from the start.' }) };
    }
    return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect code.' }) };
  }

  // Success - consume the OTP (single use) and issue a session
  await deleteKey(`otp:${otpSessionId}`);
  await clearRateLimit(rateLimitKey);

  const sessionMaxAge = 60 * 60 * 12; // 12 hours
  const token = createSessionToken({ role: 'admin' }, sessionMaxAge);

  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': buildSetCookieHeader('cpv_admin_session', token, sessionMaxAge),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Logged in.' }),
  };
};
