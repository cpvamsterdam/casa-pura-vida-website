const { requireSession } = require('./utils/auth-guard');

exports.handler = async (event) => {
  const session = requireSession(event);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loggedIn: !!session }),
  };
};
