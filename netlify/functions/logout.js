const { buildClearCookieHeader } = require('./utils/session');

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': buildClearCookieHeader('cpv_admin_session'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Logged out.' }),
  };
};
