const { getJSON, setJSON } = require('./utils/storage');
const { requireSession } = require('./utils/auth-guard');
const crypto = require('crypto');

const DEFAULT_DATA = {
  tokens: [],   // [{ token, createdAt, used }]
  reviews: [],  // [{ id, token, name, country, ratings:{cleanliness,location,value,communication,accuracy}, comment, photoCount, status, submittedAt }]
};

function genToken() {
  return crypto.randomBytes(12).toString('hex');
}

exports.handler = async (event) => {
  const session = requireSession(event);

  if (event.httpMethod === 'GET') {
    const data = await getJSON('reviews-data', DEFAULT_DATA);

    // Public: only approved reviews, with their photos attached.
    if (!session) {
      const approved = data.reviews.filter(r => r.status === 'approved');
      const withPhotos = [];
      for (const r of approved) {
        const photos = await getJSON(`review-photos:${r.id}`, []);
        const { photoCount, ...rest } = r;
        withPhotos.push({ ...rest, photos });
      }
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviews: withPhotos }) };
    }

    // Admin: everything, including pending/rejected, plus their photos for moderation.
    const allWithPhotos = [];
    for (const r of data.reviews) {
      const photos = await getJSON(`review-photos:${r.id}`, []);
      allWithPhotos.push({ ...r, photos });
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: data.tokens, reviews: allWithPhotos }) };
  }

  if (event.httpMethod === 'POST') {
    if (!session) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated.' }) };
    }
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
    }

    const data = await getJSON('reviews-data', DEFAULT_DATA);

    if (body.action === 'generateToken') {
      const token = genToken();
      data.tokens.push({ token, createdAt: new Date().toISOString(), used: false });
      await setJSON('reviews-data', data);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) };
    }

    if (body.action === 'moderate') {
      const { reviewId, status } = body;
      if (!['approved', 'rejected'].includes(status)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid status.' }) };
      }
      const review = data.reviews.find(r => r.id === reviewId);
      if (!review) return { statusCode: 404, body: JSON.stringify({ error: 'Review not found.' }) };
      review.status = status;
      await setJSON('reviews-data', data);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'ok' }) };
    }

    if (body.action === 'delete') {
      const { reviewId } = body;
      data.reviews = data.reviews.filter(r => r.id !== reviewId);
      await setJSON('reviews-data', data);
      const { deleteKey } = require('./utils/storage');
      await deleteKey(`review-photos:${reviewId}`);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'ok' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action.' }) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
