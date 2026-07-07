const crypto = require('crypto');

// SESSION_SECRET must be set as a Netlify environment variable (long random string).
// This signs session tokens so they can't be forged even if someone sees the cookie value.
function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set. Generate one and add it in Netlify site settings.');
  }
  return secret;
}

// Create a signed session token: base64(payloadJson).signatureHex
function createSessionToken(payload, expiresInSeconds = 60 * 60 * 12) {
  const data = { ...payload, exp: Date.now() + expiresInSeconds * 1000 };
  const payloadB64 = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');
  return `${payloadB64}.${signature}`;
}

// Verify a session token. Returns the payload if valid, or null if invalid/expired/tampered.
function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('hex');

  // Constant-time comparison to avoid timing attacks
  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }

  if (!payload.exp || Date.now() > payload.exp) return null; // expired
  return payload;
}

// Parse the session cookie out of a raw Cookie header string
function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  if (!match) return null;
  return decodeURIComponent(match.split('=').slice(1).join('='));
}

function buildSetCookieHeader(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

function buildClearCookieHeader(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  getCookie,
  buildSetCookieHeader,
  buildClearCookieHeader,
};
