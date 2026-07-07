const { verifySessionToken, getCookie } = require('./session');

// Returns the session payload if the request has a valid session cookie, else null.
function requireSession(event) {
  const cookieHeader = event.headers.cookie || event.headers.Cookie;
  const token = getCookie(cookieHeader, 'cpv_admin_session');
  return verifySessionToken(token);
}

module.exports = { requireSession };
