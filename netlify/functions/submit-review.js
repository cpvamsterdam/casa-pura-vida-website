const { getJSON, setJSON } = require('./utils/storage');
const { translateToAllLangs } = require('./utils/translate');
const crypto = require('crypto');

const DEFAULT_DATA = { tokens: [], reviews: [] };
const RATING_CATEGORIES = ['cleanliness', 'location', 'value', 'communication', 'accuracy'];
const MAX_PHOTOS = 4;
// Roughly 1.5MB per photo as a base64 string cap, keeping well under the 5MB per-key Blobs limit
// even for a review with all 5 photos in one storage key.
const MAX_PHOTO_CHARS = 1_500_000;

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    // Used by the guest-facing review page to check a token is valid before showing the form.
    const token = (event.queryStringParameters || {}).token;
    if (!token) return { statusCode: 400, body: JSON.stringify({ error: 'Missing token.' }) };
    const data = await getJSON('reviews-data', DEFAULT_DATA);
    const entry = data.tokens.find(t => t.token === token);
    if (!entry) return { statusCode: 404, body: JSON.stringify({ valid: false, error: 'Invalid link.' }) };
    if (entry.used) return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'This review link has already been used.' }) };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valid: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { token, name, country, ratings, comment, photos } = body;

  if (!token || !name || !country || !ratings) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields.' }) };
  }
  // Names are displayed as-is in every site language (never translated), so
  // they must be entered in English/Latin letters to read correctly everywhere.
  if (!/^[A-Za-z\s.'-]+$/.test(String(name).trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please enter your name using English letters only.' }) };
  }
  for (const cat of RATING_CATEGORIES) {
    const val = ratings[cat];
    if (typeof val !== 'number' || val < 1 || val > 5) {
      return { statusCode: 400, body: JSON.stringify({ error: `Invalid rating for ${cat}.` }) };
    }
  }
  if (photos && (!Array.isArray(photos) || photos.length > MAX_PHOTOS)) {
    return { statusCode: 400, body: JSON.stringify({ error: `Maximum ${MAX_PHOTOS} photos allowed.` }) };
  }
  if (photos) {
    for (const p of photos) {
      if (typeof p !== 'string' || !p.startsWith('data:image/') || p.length > MAX_PHOTO_CHARS) {
        return { statusCode: 400, body: JSON.stringify({ error: 'One or more photos are invalid or too large.' }) };
      }
    }
  }

  const data = await getJSON('reviews-data', DEFAULT_DATA);
  const tokenEntry = data.tokens.find(t => t.token === token);
  if (!tokenEntry) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Invalid review link.' }) };
  }
  if (tokenEntry.used) {
    return { statusCode: 409, body: JSON.stringify({ error: 'This review link has already been used.' }) };
  }

  const reviewId = crypto.randomUUID();
  const cleanRatings = {};
  RATING_CATEGORIES.forEach(cat => { cleanRatings[cat] = ratings[cat]; });

  const cleanName = String(name).trim().slice(0, 100);
  const cleanCountry = String(country).slice(0, 100);
  const cleanComment = comment ? String(comment).slice(0, 1000) : '';
  // Translated once here, at submission time — never re-translated on page
  // load, so this costs a couple of small API calls per review, not per page
  // view. Name isn't translated: it's enforced to be English/Latin letters
  // at validation above, so there's nothing useful to translate there.
  const [translatedComment, translatedCountry] = await Promise.all([
    translateToAllLangs(cleanComment),
    translateToAllLangs(cleanCountry),
  ]);

  const review = {
    id: reviewId,
    token,
    name: cleanName,
    country: cleanCountry,
    country_en: translatedCountry.en,
    country_es: translatedCountry.es,
    country_he: translatedCountry.he,
    ratings: cleanRatings,
    comment: cleanComment,
    comment_en: translatedComment.en,
    comment_es: translatedComment.es,
    comment_he: translatedComment.he,
    photoCount: photos ? photos.length : 0,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  data.reviews.push(review);
  tokenEntry.used = true;
  await setJSON('reviews-data', data);
  if (photos && photos.length > 0) {
    await setJSON(`review-photos:${reviewId}`, photos);
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Submitted for review.' }) };
};
