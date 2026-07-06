const { getStore } = require('@netlify/blobs');

// Single shared store for all admin/auth/booking data.
function store() {
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
