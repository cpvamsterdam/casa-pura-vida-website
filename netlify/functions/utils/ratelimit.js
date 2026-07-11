const { getJSON, setJSON } = require('./storage');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Returns { allowed: boolean, remainingMs: number }
async function checkRateLimit(bucketKey) {
  const record = await getJSON(`ratelimit:${bucketKey}`, { attempts: 0, lockedUntil: 0 });
  const now = Date.now();

  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, remainingMs: record.lockedUntil - now };
  }
  return { allowed: true, remainingMs: 0 };
}

async function recordFailedAttempt(bucketKey) {
  const record = await getJSON(`ratelimit:${bucketKey}`, { attempts: 0, lockedUntil: 0 });
  const now = Date.now();

  // Reset counter if a previous lockout has already expired
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.attempts = 0;
    record.lockedUntil = 0;
  }

  record.attempts += 1;
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    record.attempts = 0;
  }
  await setJSON(`ratelimit:${bucketKey}`, record);
  return record;
}

async function clearRateLimit(bucketKey) {
  await setJSON(`ratelimit:${bucketKey}`, { attempts: 0, lockedUntil: 0 });
}

module.exports = { checkRateLimit, recordFailedAttempt, clearRateLimit, MAX_ATTEMPTS, LOCKOUT_MS };
