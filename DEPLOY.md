# Casa Pura Vida — Full Website + Booking Admin
Deployment guide

## Important — read this first
This folder contains your **entire site**: the public website (index.html, photos, video)
**and** the admin system, combined into one. This is deliberate — they must be deployed
together, as **one Netlify site**, so the website can reach the admin functions.

Deploy this whole folder as a single site on Netlify. You need **one** Netlify account
(free) for everything — not a separate account or site for the admin part.

## What the admin part is
A password + email-code (2FA) protected admin panel for:
- Blocking/unblocking specific nights
- Setting a base price and per-extra-guest price
- Setting seasonal price overrides for date ranges

All data is stored in **Netlify Blobs** (built into Netlify, no external database needed).

---

## One-time setup (about 15 minutes)

### 1. Get a Resend account (for the email login code) — free
1. Go to https://resend.com and sign up (free tier: 3,000 emails/month, more than enough).
2. Verify your sending domain, OR for the fastest start, just use their default
   `onboarding@resend.dev` sender (works immediately, no domain setup needed).
3. Go to **API Keys** in the Resend dashboard, create one, copy it.

### 2. Choose your admin password and generate its hash
Your real password is never stored anywhere — only a SHA-256 hash of it. To generate the hash:

Open a terminal with Node.js installed and run (replace `YOUR-PASSWORD-HERE`):
```
node -e "console.log(require('crypto').createHash('sha256').update('YOUR-PASSWORD-HERE').digest('hex'))"
```
This prints a long hex string. Copy it — you'll paste it into Netlify's environment variables
(never into any file), as `ADMIN_PASSWORD_HERE` below.

Pick a genuinely strong password (long, not a dictionary word) — the hashing protects it from
being visible in code, but a weak password can still be guessed.

### 3. Generate a session secret
Run this once and copy the output:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy to Netlify
1. Unzip this project.
2. Go to https://app.netlify.com and either:
   - Drag-and-drop the folder onto Netlify Drop for a quick test, or
   - Connect it as a proper Git-based site for ongoing deployment (recommended long-term).
3. Once the site exists, go to **Site settings → Environment variables** and add:

   | Key | Value |
   |---|---|
   | `ADMIN_PASSWORD_HASH` | the hex string from step 2 |
   | `SESSION_SECRET` | the hex string from step 3 |
   | `ADMIN_EMAIL` | the email address that should receive login codes (e.g. cpvamsterdam@gmail.com) |
   | `RESEND_API_KEY` | the API key from step 1 |
   | `FROM_EMAIL` | `onboarding@resend.dev` (or your verified sender if you set one up) |

4. Trigger a deploy (or redeploy) so the environment variables take effect.
5. Netlify will automatically install `@netlify/blobs` from `package.json` during the build —
   no manual step needed for that part.

### 5. Test it
Visit `https://YOUR-SITE.netlify.app/admin` — you should see the password screen.
Enter your password → check the admin email for a 6-digit code → enter it → you're in.

---

## Ongoing use
- Sessions last 12 hours, then you'll need to log in again.
- After 5 wrong password or code attempts from the same connection, there's a 15-minute lockout —
  this is intentional, it's what stops someone from guessing repeatedly.
- The booking page on the main site can read the same blocked-dates/pricing data via
  `GET /.netlify/functions/calendar` (no login needed for reading — only writing requires the
  admin session). I have not yet wired the main site's booking calendar to pull from this live
  data — that's the next step once you confirm this admin panel works the way you want.

## What this does NOT do (by design)
- No credit card collection or processing.
- No guest-facing payment of any kind — matches your bank-transfer/cash-only process.
- No automatic sync with Bordo or any other platform (a separate step if you want it later).
