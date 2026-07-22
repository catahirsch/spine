# Spine — Book Library Scanner

A phone-installable web app (PWA) that scans a book's barcode (or, as a
fallback, reads the cover with OCR), looks up the title/author/edition via
Google Books, finds the matching row in your Google Sheet, and lets you
update the **owner** column.

## What you get
- `index.html`, `style.css`, `app.js` — the app itself
- `manifest.json`, `sw.js` — makes it installable to your phone's home screen
- No backend server needed — it talks directly to Google's APIs from the browser

## Why a PWA instead of a native app
A true native iOS/Android app needs to be built with Xcode/Android Studio and
signed with a paid developer account, which isn't something buildable or
distributable from this chat. A PWA gets you the same day-to-day experience —
icon on your home screen, full-screen camera access, works offline for the UI
shell — without any app store step. If you outgrow this later, this same
logic can be ported into a native app (e.g. with React Native or Swift).

---

## One-time setup (about 10 minutes)

### 1. Get a Google Cloud OAuth Client ID (for writing to Sheets)
1. Go to https://console.cloud.google.com/ and create a new project (or use an existing one).
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → OAuth consent screen** → choose "External" (or "Internal" if you're on Workspace), fill in the app name, your email, and add yourself as a test user.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins: add the URL you'll host this app on (see hosting below), e.g. `https://yourname.github.io`
   - Save, and copy the **Client ID** (looks like `xxxx.apps.googleusercontent.com`).

### 2. (Optional) Get a Google Books API key
Google Books works without a key for light use. If you'll scan a lot of books
in a short time, get a free key: **APIs & Services → Library → enable
"Books API" → Credentials → Create Credentials → API key**.

### 3. Find your Sheet ID and columns
- Open your Google Sheet. The ID is the long string in the URL:
  `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
- For each column field in Settings, you can enter **either** a column
  letter (`D`) **or** the exact header text from row 1 (e.g. `Dueño`,
  `Título`, `ISBN`) — the app reads your header row and matches by name if
  what you typed isn't a plain letter. This means it works with sheets in
  any language.
- The app matches rows by ISBN first, falling back to exact title match.

### 4. Host the app
It needs to run over **HTTPS** (or `localhost`) for camera access to work —
`file://` won't work. Easiest free options:
- **GitHub Pages**: create a repo, upload these files, enable Pages in repo settings.
- **Netlify / Vercel**: drag-and-drop the folder in their dashboard.

Once hosted, open the URL on your phone, tap **Settings (⚙)** in the app, and
enter your Client ID, Sheet ID, sheet/tab name, and column letters. Tap
**Sign in with Google** once — after that it stays signed in for the browser
session.

### 5. Install to your home screen (optional but recommended)
- **iPhone (Safari)**: Share button → "Add to Home Screen."
- **Android (Chrome)**: menu (⋮) → "Add to Home screen" / "Install app."

---

## Using it
1. Open the app, point the camera at the barcode (default mode) — it
   auto-detects the ISBN and looks it up.
2. If there's no barcode, tap **Cover photo**, frame the title/author, and
   tap **Capture cover** — it OCRs the text and searches Google Books with it.
3. The app then searches your Sheet for a matching row.
4. **If found:** type the new owner's name and tap **Update owner** — it
   writes directly into that row's owner column.
5. **If not found:** an **"Add as new book in sheet"** button appears
   instead. Type an owner name (optional) and tap it — the app appends a new
   row, filling in whatever columns you've configured (ISBN, Title, Author,
   Edition, Owner) from what it read off the cover/barcode.

## Notes & limitations
- Cover-photo OCR is much less reliable than barcode scanning — stylized
  fonts, glare, or curved covers can throw it off. Barcode is the reliable path.
- When adding a new row, it appends to the bottom of the sheet/tab — it
  doesn't try to preserve any particular sort order.
- Sign-in is per-browser-session by design (safer than storing long-lived
  tokens client-side). You'll re-authenticate occasionally.
