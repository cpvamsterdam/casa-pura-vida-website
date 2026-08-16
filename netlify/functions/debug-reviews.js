const { getJSON, setJSON, deleteKey } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');

// TEMPORARY diagnostic tool. Visit this URL in your browser while logged
// into the admin panel (same browser, same tab is fine):
//
//   https://casapuravidanl.com/.netlify/functions/debug-reviews
//
// It shows you every review exactly as it's stored, with a "Delete" link
// next to each one. No terminal, no tokens, nothing to install.
//
// Delete this file (and remove the netlify.toml redirect if you added one)
// once you're done — it's not meant to stay on the site long-term.

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

exports.handler = async (event) => {
  const session = requireSession(event);
  if (!session) {
    return { statusCode: 401, headers: { 'Content-Type': 'text/plain' }, body: 'Please log into the admin panel first, then reload this page in the same browser.' };
  }

  const data = await getJSON('reviews-data', { tokens: [], reviews: [] });
  const params = event.queryStringParameters || {};

  if (params.delete) {
    const before = data.reviews.length;
    data.reviews = data.reviews.filter(r => r.id !== params.delete);
    if (data.reviews.length < before) {
      await setJSON('reviews-data', data);
      try { await deleteKey(`review-photos:${params.delete}`); } catch (e) {}
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: `<p>Deleted review ${escapeHtml(params.delete)}.</p><p><a href="/.netlify/functions/debug-reviews">Back to the list</a></p>`,
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<p>No review found with that id. Nothing was deleted.</p><p><a href="/.netlify/functions/debug-reviews">Back to the list</a></p>`,
    };
  }

  const rows = data.reviews.map(r => `
    <div style="border:1px solid #ddd; border-radius:10px; padding:14px; margin-bottom:12px; font-family:sans-serif;">
      <div><b>name:</b> ${escapeHtml(r.name)} &nbsp; <b>country:</b> ${escapeHtml(r.country)}</div>
      <div><b>status:</b> ${escapeHtml(r.status)} &nbsp; <b>id:</b> ${escapeHtml(r.id)}</div>
      <div><b>comment:</b> ${escapeHtml((r.comment || '').slice(0, 200))}</div>
      <div><b>submittedAt:</b> ${escapeHtml(r.submittedAt)}</div>
      <a href="/.netlify/functions/debug-reviews?delete=${encodeURIComponent(r.id)}"
         onclick="return confirm('Delete this review permanently?')"
         style="display:inline-block; margin-top:8px; color:#fff; background:#c1272d; padding:6px 14px; border-radius:100px; text-decoration:none; font-family:sans-serif; font-size:13px;">
        Delete this review
      </a>
    </div>
  `).join('');

  const body = `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><title>Reviews (raw storage)</title></head>
  <body style="max-width:700px; margin:30px auto; font-family:sans-serif;">
    <h2>All reviews found in storage (${data.reviews.length} total)</h2>
    ${rows || '<p>No reviews found in storage at all.</p>'}
  </body></html>`;

  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body };
};
