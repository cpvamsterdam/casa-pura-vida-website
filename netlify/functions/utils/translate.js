// Minimal Google Cloud Translation API (v2 Basic) wrapper. Translates one
// string into all target site languages.
//
// Requires GOOGLE_TRANSLATE_API_KEY in Netlify environment variables. If
// it's not set, translation is silently skipped (the review still saves
// fine, just without translated versions — the site falls back to showing
// the original text).
//
// If you already have a Google Cloud project for Maps/Places, you can reuse
// it: just enable the "Cloud Translation API" in that same project. You can
// reuse the existing Maps API key if it's unrestricted, or (recommended)
// create a separate key restricted to only the Cloud Translation API.
const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';

// Site language codes -> Google Translate target-language codes.
const TARGETS = { en: 'en', es: 'es', he: 'he' };

async function translateOne(text, targetLang) {
  const url = `${ENDPOINT}?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target: targetLang, format: 'text' }),
  });
  if (!res.ok) throw new Error(`Google Translate request failed: ${res.status}`);
  const data = await res.json();
  return data.data?.translations?.[0]?.translatedText || text;
}

// Returns { en, es, he } — always all three, so the display code never has to
// guess which ones exist. If no API key is configured, or a call fails,
// that language just falls back to the original text (never blocks the review).
async function translateToAllLangs(text) {
  const result = { en: text, es: text, he: text };
  if (!text || !process.env.GOOGLE_TRANSLATE_API_KEY) return result;

  await Promise.all(
    Object.entries(TARGETS).map(async ([siteLang, googleLang]) => {
      try {
        result[siteLang] = await translateOne(text, googleLang);
      } catch (e) {
        // Leave that language as the original text; never fail the submission.
      }
    })
  );
  return result;
}

module.exports = { translateToAllLangs };
