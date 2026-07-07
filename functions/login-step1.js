const crypto = require('crypto');
const { generateOtp, hashOtp } = require('./utils/otp');
const { setJSON } = require('./utils/storage');
const { checkRateLimit, recordFailedAttempt, clearRateLimit } = require('./utils/ratelimit');
const { sendOtpEmail } = require('./utils/email');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Rate-limit by client IP so repeated wrong passwords get locked out
  const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  const rateLimitKey = `login-step1:${clientIp}`;

  const rl = await checkRateLimit(rateLimitKey);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.remainingMs / 60000);
    return {
      statusCode: 429,
      body: JSON.stringify({ error: `Too many attempts. Try again in ${minutes} minute(s).` }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { password } = body;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH; // sha256 hash, set in Netlify env vars

  if (!adminPasswordHash) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (ADMIN_PASSWORD_HASH missing).' }) };
  }
  if (!password || typeof password !== 'string') {
    await recordFailedAttempt(rateLimitKey);
    return { statusCode: 400, body: JSON.stringify({ error: 'Password required.' }) };
  }

  const suppliedHash = crypto.createHash('sha256').update(password).digest('hex');
  const suppliedBuf = Buffer.from(suppliedHash, 'hex');
  const expectedBuf = Buffer.from(adminPasswordHash, 'hex');
  const isMatch = suppliedBuf.length === expectedBuf.length && crypto.timingSafeEqual(suppliedBuf, expectedBuf);

  if (!isMatch) {
    await recordFailedAttempt(rateLimitKey);
    return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect password.' }) };
  }

  // Password correct -> generate OTP, store its hash (never the raw code), email it
  await clearRateLimit(rateLimitKey);

  const otpSessionId = crypto.randomUUID();
  const otp = generateOtp();
  const otpHash = hashOtp(otp, otpSessionId);

  await setJSON(`otp:${otpSessionId}`, {
    otpHash,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  try {
    await sendOtpEmail(otp);
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Password correct, but failed to send the code email. ' + err.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ otpSessionId, message: 'Code sent to admin email.' }),
  };
};
