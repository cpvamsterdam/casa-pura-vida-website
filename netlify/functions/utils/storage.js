const { getStore } = require('@netlify/blobs');

// Netlify is supposed to auto-configure Blobs access for Functions, but this
// sometimes fails in production with "MissingBlobsEnvironmentError" (a known,
// currently-active Netlify platform issue). As a reliable fallback, we support
// explicitly supplying the site ID and a Personal Access Token via environment
// variables. If both are set, we use them; otherwise we fall back to relying
// on Netlify's automatic configuration.
function store() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'casa-pura-vida-admin', siteID, token });
  }
  return getStore('casa-pura-vida-admin');
}

async function getJSON(key, fallback = null) {
  const s = store();
  const value = await s.get(key, { type: 'json' });
  return value === null ? fallback : value;
}

async function setJSON(key, value) {
  const s = store();
  await s.setJSON(key, value);
}

async function deleteKey(key) {
  const s = store();
  await s.delete(key);
}

module.exports = { getJSON, setJSON, deleteKey };
