const crypto = require('crypto');

// Generate a random 6-digit numeric code, e.g. "042817"
function generateOtp() {
  const num = crypto.randomInt(0, 1000000);
  return num.toString().padStart(6, '0');
}

// We never store the raw OTP anywhere (not in Blobs, not in logs) - only a hash of it,
// combined with the session secret. This way, even if the storage were somehow read,
// the actual code guests would need to guess is not exposed.
function hashOtp(otp, salt) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'fallback-dev-secret')
    .update(`${salt}:${otp}`)
    .digest('hex');
}

function verifyOtp(otp, salt, expectedHash) {
  const actualHash = hashOtp(otp, salt);
  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { generateOtp, hashOtp, verifyOtp };
