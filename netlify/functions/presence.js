// Tracks real live visitors via a simple heartbeat mechanism, using Netlify's
// built-in geo-IP context (no external service needed) to know which country
// each visitor is browsing from.
const { getJSON, setJSON } = require('./utils/storage');

const ACTIVE_WINDOW_MS = 45 * 1000; // a visitor counts as "active" if seen in the last 45 seconds

exports.handler = async (event, context) => {
  const stored = await getJSON('presence-data', { sessions: {} });
  const now = Date.now();

  // Prune stale sessions on every call - keeps storage small, no separate cleanup job needed.
  const sessions = {};
  for (const [id, s] of Object.entries(stored.sessions || {})) {
    if (now - s.lastSeen < ACTIVE_WINDOW_MS) sessions[id] = s;
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
    }
    const sessionId = body.sessionId;
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing sessionId.' }) };
    }
    const country = (context && context.geo && context.geo.country && context.geo.country.name) || null;
    sessions[sessionId] = { lastSeen: now, country };
    await setJSON('presence-data', { sessions });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod === 'GET') {
    // Only persist prunes when they actually change anything, to avoid needless writes on every read.
    if (Object.keys(sessions).length !== Object.keys(stored.sessions || {}).length) {
      await setJSON('presence-data', { sessions });
    }
    const countries = Array.from(new Set(Object.values(sessions).map(s => s.country).filter(Boolean)));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realCount: Object.keys(sessions).length, countries }),
    };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
