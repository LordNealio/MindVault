# MindVault AI — Deploy & Install Guide

## What you're getting
- A live HTTPS URL (free, permanent)
- Installable on your iPhone home screen as a full-screen app
- Fully offline journaling — no internet needed once installed
- AI features work over the network when available

---

## STEP 1 — Get the tools (one-time, ~5 minutes)

You need three things installed on your computer:

1. **Node.js** (v18 or later)  
   Download: https://nodejs.org → click the LTS button

2. **Git**  
   Download: https://git-scm.com → click Downloads

3. **A GitHub account** (free)  
   Sign up: https://github.com

4. **A Vercel account** (free)  
   Sign up at https://vercel.com using your GitHub account

---

## STEP 2 — Set up the project on your computer

Open **Terminal** (Mac) or **Command Prompt** (Windows) and run these commands one at a time:

```bash
# 1. Create a new folder and go into it
mkdir mindvault-ai
cd mindvault-ai

# 2. Copy all the project files into this folder
#    (the files you downloaded: package.json, vite.config.js,
#     index.html, vercel.json, .gitignore, and the src/ and public/ folders)

# 3. Install dependencies
npm install

# 4. Test it runs locally
npm run dev
```

Open http://localhost:5173 in your browser.  
If you see the MindVault app, you're ready to deploy.

Press **Ctrl+C** to stop the local server.

---

## STEP 3 — Push to GitHub

```bash
# Inside the mindvault-ai folder:

git init
git add .
git commit -m "Initial MindVault AI build"

# Create a new repo on GitHub at https://github.com/new
# Name it: mindvault-ai
# Keep it Private
# Do NOT add a README (you already have files)

# Then connect and push (replace YOUR-USERNAME):
git remote add origin https://github.com/YOUR-USERNAME/mindvault-ai.git
git branch -M main
git push -u origin main
```

---

## STEP 4 — Deploy to Vercel (2 minutes)

1. Go to https://vercel.com/dashboard
2. Click **Add New → Project**
3. Click **Import** next to your `mindvault-ai` repository
4. Vercel auto-detects Vite — leave all settings as-is
5. Click **Deploy**

Wait ~60 seconds. You'll get a URL like:  
`https://mindvault-ai.vercel.app`

That's your live app. ✓

Every time you push a change to GitHub, Vercel redeploys automatically.

---

## STEP 5 — Generate app icons

Before installing on your phone, create the icons (otherwise you'll get a blank icon):

1. Copy the SVG from `public/icons/README.txt`
2. Go to https://realfavicongenerator.net
3. Paste/upload the SVG
4. Download the package
5. Copy these files into `public/icons/`:
   - `icon-32.png`
   - `icon-180.png`  
   - `icon-192.png`
   - `icon-512.png`
6. Commit and push — Vercel will redeploy in ~60 seconds

---

## STEP 6 — Install on your iPhone

1. Open **Safari** on your iPhone (must be Safari, not Chrome)
2. Go to your Vercel URL
3. Tap the **Share button** (the box with an arrow pointing up)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **Add**

MindVault now appears on your home screen with the Mondrian icon.  
Open it — it launches full screen with no browser bar, like a native app.

---

## STEP 7 — Test voice recording on iPhone

Voice recording requires HTTPS, which Vercel provides automatically.

On your iPhone:
1. Open MindVault from the home screen
2. Tap TODAY → GUIDED
3. When prompted, tap **Allow** for microphone access
4. Speak — you should see the waveform animate

If microphone access was previously denied:
- Go to **Settings → Safari → Microphone** → Allow

---

## Notes on specific iOS behaviours

| Feature | Status | Notes |
|---|---|---|
| Install to home screen | ✓ Works | Safari only — not Chrome on iOS |
| Full-screen (no browser bar) | ✓ Works | Once installed from home screen |
| Camera (take photo) | ✓ Works | Will prompt for permission |
| Photo library | ✓ Works | Separate permission from camera |
| Voice recording | ✓ Works | Requires HTTPS — Vercel provides this |
| Offline journaling | ✓ Works | Service worker caches the app shell |
| AI features (scan, chat) | Needs internet | Expected — AI calls go to Anthropic |
| Push notifications | Not yet | Coming in the next build phase |
| Keyboard pushing content up | May shift layout | Normal iOS behaviour in PWAs |

---

## Updating the app

Whenever you make changes:

```bash
# Make your edits to src/App.jsx
git add .
git commit -m "describe what you changed"
git push
```

Vercel deploys automatically. Your URL stays the same.  
Your journal data stays on the device — deploys never affect user data.

---

## Sharing with others

Send them the Vercel URL.  
They follow Step 6 to install on their own phone.  
Their data is completely separate from yours — everything is local to each device.

---

## Troubleshooting

**"npm: command not found"**  
Node.js isn't installed. Go to nodejs.org and install the LTS version.

**App doesn't update after deploy**  
Hard refresh: hold Shift and tap refresh in Safari.  
Or delete and re-add to home screen.

**Voice recording says "not supported"**  
Make sure you're opening the app from the Vercel HTTPS URL, not localhost.  
Use Safari on iOS, not Chrome.

**Photos don't save**  
IndexedDB storage may be limited in private/incognito mode.  
Use regular browser mode.

**"Failed to register service worker"**  
Not a problem — the app still works, just without offline caching.  
This usually means you're on HTTP (not HTTPS). Vercel is always HTTPS.
