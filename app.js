/* ---------- Settings persistence ---------- */
const SETTINGS_KEY = 'spine_settings_v1';

function loadSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

const DEFAULT_SETTINGS = {
  clientId: '928002501379-ltduio6o1125pce5fodqucd419e4ebi5.apps.googleusercontent.com',
  sheetId: '12Xu85bnpRe_rMirl5h0fBUpCDyXzgCE6',
  sheetName: 'LISTA ORIGINAL',
  colIsbn: 'P',
  colTitle: 'D',
  colOwner: 'J',
  colAuthor: 'F',
  colEdition: '',
  booksKey: '',
};

let settings = Object.assign({}, DEFAULT_SETTINGS, loadSettings());

const els = {
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  scanView: document.getElementById('scanView'),
  resultView: document.getElementById('resultView'),
  clientId: document.getElementById('clientId'),
  sheetId: document.getElementById('sheetId'),
  sheetName: document.getElementById('sheetName'),
  colIsbn: document.getElementById('colIsbn'),
  colTitle: document.getElementById('colTitle'),
  colOwner: document.getElementById('colOwner'),
  colAuthor: document.getElementById('colAuthor'),
  colEdition: document.getElementById('colEdition'),
  booksKey: document.getElementById('booksKey'),
  saveSettings: document.getElementById('saveSettings'),
  signInBtn: document.getElementById('signInBtn'),
  authStatus: document.getElementById('authStatus'),
  video: document.getElementById('video'),
  torchBtn: document.getElementById('torchBtn'),
  setupBanner: document.getElementById('setupBanner'),
  setupBannerBtn: document.getElementById('setupBannerBtn'),
  manualInput: document.getElementById('manualInput'),
  manualLookupBtn: document.getElementById('manualLookupBtn'),
  scanStatus: document.getElementById('scanStatus'),
  modeBarcode: document.getElementById('modeBarcode'),
  modeCover: document.getElementById('modeCover'),
  captureBtn: document.getElementById('captureBtn'),
  bookThumb: document.getElementById('bookThumb'),
  bookTitle: document.getElementById('bookTitle'),
  bookAuthor: document.getElementById('bookAuthor'),
  bookEdition: document.getElementById('bookEdition'),
  bookIsbn: document.getElementById('bookIsbn'),
  matchBox: document.getElementById('matchBox'),
  matchStatus: document.getElementById('matchStatus'),
  ownerInput: document.getElementById('ownerInput'),
  updateOwnerBtn: document.getElementById('updateOwnerBtn'),
  addRowBtn: document.getElementById('addRowBtn'),
  scanAgainBtn: document.getElementById('scanAgainBtn'),
  hiddenCanvas: document.getElementById('hiddenCanvas'),
};

function fillSettingsForm(){
  els.clientId.value  = settings.clientId  || DEFAULT_SETTINGS.clientId;
  els.sheetId.value   = settings.sheetId   || DEFAULT_SETTINGS.sheetId;
  els.sheetName.value = settings.sheetName || DEFAULT_SETTINGS.sheetName;
  els.colIsbn.value   = settings.colIsbn   || DEFAULT_SETTINGS.colIsbn;
  els.colTitle.value  = settings.colTitle  || DEFAULT_SETTINGS.colTitle;
  els.colOwner.value  = settings.colOwner  || DEFAULT_SETTINGS.colOwner;
  els.colAuthor.value = settings.colAuthor || DEFAULT_SETTINGS.colAuthor;
  els.colEdition.value= settings.colEdition|| DEFAULT_SETTINGS.colEdition;
  els.booksKey.value  = settings.booksKey  || DEFAULT_SETTINGS.booksKey;
}
fillSettingsForm();

function refreshSetupBanner(){
  const ready = settings.clientId && settings.sheetId;
  els.setupBanner.classList.toggle('hidden', !!ready);
}
refreshSetupBanner();

els.setupBannerBtn.onclick = () => {
  els.settingsPanel.classList.remove('hidden');
  els.scanView.classList.add('hidden');
  els.resultView.classList.add('hidden');
  els.setupBanner.classList.add('hidden');
};

els.settingsBtn.onclick = () => {
  const opening = els.settingsPanel.classList.contains('hidden');
  els.settingsPanel.classList.toggle('hidden');
  els.scanView.classList.toggle('hidden');
  els.resultView.classList.add('hidden');
  els.setupBanner.classList.toggle('hidden', opening);
  if (!opening) refreshSetupBanner();
};

els.saveSettings.onclick = () => {
  settings = {
    clientId: els.clientId.value.trim() || DEFAULT_SETTINGS.clientId,
    sheetId: els.sheetId.value.trim() || DEFAULT_SETTINGS.sheetId,
    sheetName: els.sheetName.value.trim() || DEFAULT_SETTINGS.sheetName,
    colIsbn: els.colIsbn.value.trim() || DEFAULT_SETTINGS.colIsbn,
    colTitle: els.colTitle.value.trim() || DEFAULT_SETTINGS.colTitle,
    colOwner: els.colOwner.value.trim() || DEFAULT_SETTINGS.colOwner,
    colAuthor: els.colAuthor.value.trim() || '',
    colEdition: els.colEdition.value.trim() || '',
    booksKey: els.booksKey.value.trim(),
  };
  saveSettings(settings);
  els.authStatus.textContent = 'Saved ✓';
  refreshSetupBanner();
};

/* ---------- Google OAuth (Identity Services, token client) ---------- */
let accessToken = null;
let tokenClient = null;

function ensureTokenClient(){
  if (!settings.clientId) {
    els.authStatus.textContent = 'Enter your Client ID first.';
    return null;
  }
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: settings.clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (resp) => {
        if (resp.error) {
          els.authStatus.textContent = 'Sign-in failed: ' + resp.error;
          return;
        }
        accessToken = resp.access_token;
        els.authStatus.textContent = 'Signed in ✓';
      },
    });
  }
  return tokenClient;
}

els.signInBtn.onclick = () => {
  const client = ensureTokenClient();
  if (!client) return;
  client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
};

async function authedFetch(url, options = {}){
  if (!accessToken) throw new Error('Not signed in to Google yet.');
  options.headers = Object.assign({}, options.headers, {
    Authorization: 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
  });
  const res = await fetch(url, options);
  if (!res.ok) throw new Error('Sheets API error ' + res.status + ': ' + await res.text());
  return res.json();
}

/* ---------- Barcode scanning (html5-qrcode) ---------- */
let html5QrCode = null;
let currentMode = 'barcode';
let scanning = false;

async function startBarcodeScan(){
  await stopEverything();
  els.scanStatus.textContent = 'Point the camera at the barcode.';
  await startQrRegion();
}

// html5-qrcode wants a div id, not our <video>. We create a hidden div and mirror sizing.
async function startQrRegion(){
  let region = document.getElementById('qrRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'qrRegion';
    region.style.width = '100%';
    region.style.height = '100%';
    els.video.parentElement.insertBefore(region, els.video);
    els.video.style.display = 'none';
  }
  region.style.display = 'block';
  html5QrCode = new Html5Qrcode('qrRegion', {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
    ],
    verbose: false,
  });
  try {
    scanning = true;
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 20,
        // Scan a wide, short band across most of the frame — matches a barcode's
        // shape and doesn't force the user to hit one tiny fixed-size box.
        qrbox: (viewfinderW, viewfinderH) => ({
          width: Math.max(50, Math.floor(viewfinderW * 0.85)),
          height: Math.max(50, Math.floor(Math.min(viewfinderH * 0.4, viewfinderW * 0.5))),
        }),
        aspectRatio: 1.0,
        disableFlip: false,
        // Resolution/facingMode hints go here, not in the first argument —
        // html5-qrcode requires that first object to have exactly one key.
        videoConstraints: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      },
      (decodedText) => onIsbnDecoded(decodedText),
      () => {} // ignore per-frame scan failures
    );
    detectTorchSupport();
  } catch (err) {
    els.scanStatus.textContent = '⚠ Camera error: ' + err;
  }
}

/* Torch (flashlight) toggle, when the device supports it — works for both modes */
let torchOn = false;
function detectTorchSupport(){
  try {
    const caps = html5QrCode.getRunningTrackCapabilities();
    els.torchBtn.classList.toggle('hidden', !(caps && caps.torch));
  } catch { els.torchBtn.classList.add('hidden'); }
}
function detectCoverTorchSupport(){
  try {
    const track = coverStream && coverStream.getVideoTracks()[0];
    const caps = track && track.getCapabilities && track.getCapabilities();
    els.torchBtn.classList.toggle('hidden', !(caps && caps.torch));
  } catch { els.torchBtn.classList.add('hidden'); }
}
if (els.torchBtn) {
  els.torchBtn.onclick = async () => {
    torchOn = !torchOn;
    try {
      if (currentMode === 'barcode' && html5QrCode && scanning) {
        await html5QrCode.applyVideoConstraints({ advanced: [{ torch: torchOn }] });
      } else if (currentMode === 'cover' && coverStream) {
        const track = coverStream.getVideoTracks()[0];
        await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      }
      els.torchBtn.classList.toggle('active', torchOn);
    } catch { /* not supported on this device/browser */ }
  };
}

function stopEverything(){
  let stopPromise = Promise.resolve();
  if (html5QrCode && scanning) {
    stopPromise = html5QrCode.stop().catch(()=>{});
    scanning = false;
  }
  torchOn = false;
  if (els.torchBtn) { els.torchBtn.classList.add('hidden'); els.torchBtn.classList.remove('active'); }
  const region = document.getElementById('qrRegion');
  if (region) region.style.display = 'none';
  els.video.style.display = 'block';
  return stopPromise; // callers should await this before requesting the camera again
}

let lastDecoded = null;
function onIsbnDecoded(text){
  try {
    if (text === lastDecoded) return; // debounce repeat frames
    lastDecoded = text;
    const isbn = text.replace(/[^0-9Xx]/g, '');
    if (isbn.length !== 10 && isbn.length !== 13) {
      // Likely a supplemental/price add-on barcode next to the real one, or a misread.
      // Important: do NOT stop/restart the scanner here. The scan loop is already
      // running fine — restarting it from inside its own decode callback raced
      // the old camera stream against a newly-requested one and could freeze or
      // crash the tab, especially on repeat reads of the same non-ISBN barcode.
      els.scanStatus.textContent = `Read a barcode ("${isbn}") that isn't a valid ISBN length — try centering the main barcode.`;
      els.scanStatus.className = 'status error';
      // Allow the same code to be considered again after a short pause, instead
      // of clearing it immediately (which caused an instant re-trigger loop).
      setTimeout(() => { if (lastDecoded === text) lastDecoded = null; }, 1500);
      return;
    }
    els.scanStatus.textContent = '✓ Barcode found — looking it up…';
    els.scanStatus.className = 'status success';
    // Defer tearing down the camera to the next tick. html5-qrcode calls this
    // callback from inside its own frame-processing loop, so calling stop()
    // synchronously from in here can race the library's internal state
    // machine — this shows up as a freeze/glitch, and it's timing-dependent,
    // so it tends to happen on whichever barcodes happen to decode fastest
    // rather than any one barcode type consistently. Deferring lets that
    // in-flight frame finish before we touch the camera.
    setTimeout(() => {
      stopEverything();
      lookupByIsbn(isbn);
    }, 0);
  } catch (err) {
    // Never let an error here escape into html5-qrcode's own call stack —
    // an uncaught throw at this point can silently kill its scan loop,
    // which looks like the camera just freezing with no explanation.
    console.error('onIsbnDecoded error:', err);
    els.scanStatus.textContent = '⚠ Something went wrong reading that — try again.';
    els.scanStatus.className = 'status error';
    lastDecoded = null;
  }
}

/* ---------- Cover camera (plain getUserMedia, for OCR mode) ---------- */
let coverStream = null;
async function startCoverCamera(){
  await stopEverything();
  els.scanStatus.textContent = 'Frame the title & author, then capture.';
  els.scanStatus.className = 'status';
  coverStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
  });
  els.video.srcObject = coverStream;
  els.video.style.display = 'block';
  await els.video.play();
  detectCoverTorchSupport();
}
function stopCoverCamera(){
  if (coverStream) { coverStream.getTracks().forEach(t => t.stop()); coverStream = null; }
}

els.modeBarcode.onclick = () => setMode('barcode');
els.modeCover.onclick = () => setMode('cover');

function setMode(mode){
  currentMode = mode;
  els.modeBarcode.classList.toggle('active', mode === 'barcode');
  els.modeCover.classList.toggle('active', mode === 'cover');
  els.captureBtn.style.display = mode === 'cover' ? 'block' : 'none';
  document.getElementById('modeTip').textContent = mode === 'barcode'
    ? 'Tip: hold steady about 4–6 inches from the barcode, in good light. Fill as much of the frame as you can.'
    : 'Tip: keep the title & author inside the highlighted box, avoid glare, and hold the phone still before tapping capture.';
  stopCoverCamera();
  lastDecoded = null;
  if (mode === 'barcode') startBarcodeScan();
  else startCoverCamera();
}

// ---- OCR image preprocessing helpers ----
// Otsu's method: picks the grayscale threshold that best splits the image
// into two classes (ink vs. background), instead of a single fixed guess.
// This is what actually lets stylized covers work — a hand-lettered or
// low-contrast title needs a threshold tuned to *that* photo's lighting,
// not a generic one.
function otsuThreshold(gray, len){
  const hist = new Array(256).fill(0);
  for (let i = 0; i < len; i++) hist[gray[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = -1, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = len - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) { maxVar = varBetween; threshold = t; }
  }
  return threshold;
}

// Crops a region of the live video into a canvas, upscales small crops
// (stylized/thin fonts need more pixels to survive thresholding), sharpens
// to help thin or cursive strokes, then binarizes — auto-detecting whether
// the cover has dark text on a light background or light text on a dark
// background (very common on cover art) and normalizing to black-on-white,
// which OCR engines are tuned for.
function captureAndPrepCanvas(sx, sy, sW, sH){
  const raw = document.createElement('canvas');
  raw.width = sW; raw.height = sH;
  raw.getContext('2d').drawImage(els.video, sx, sy, sW, sH, 0, 0, sW, sH);

  const canvas = els.hiddenCanvas;
  const targetW = Math.min(1600, Math.max(sW, 900));
  const scale = targetW / sW;
  canvas.width = Math.round(sW * scale);
  canvas.height = Math.round(sH * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(raw, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const w = canvas.width, h = canvas.height, len = w * h;
  const gray = new Uint8ClampedArray(len);
  for (let i = 0, p = 0; p < len; i += 4, p++) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  // Light unsharp-mask pass on the grayscale buffer: helps thin serif/cursive
  // strokes that a straight threshold would otherwise erode away.
  const sharp = new Uint8ClampedArray(len);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { sharp[idx] = gray[idx]; continue; }
      const sum = gray[idx] * 5
        - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
      sharp[idx] = sum;
    }
  }

  const threshold = otsuThreshold(sharp, len);
  let aboveCount = 0;
  for (let p = 0; p < len; p++) if (sharp[p] > threshold) aboveCount++;
  const backgroundIsBright = aboveCount >= (len - aboveCount);

  for (let i = 0, p = 0; p < len; i += 4, p++) {
    let val = sharp[p] > threshold ? 255 : 0;
    if (!backgroundIsBright) val = 255 - val; // normalize to black text / white background
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

async function runOcrOnRegion(sx, sy, sW, sH){
  const canvas = captureAndPrepCanvas(sx, sy, sW, sH);
  // PSM 6 ("assume a single uniform block of text") suits a cropped title
  // region much better than the default automatic layout analysis, which
  // tends to get confused by stylized cover typography.
  const { data: { text } } = await Tesseract.recognize(canvas, 'spa+eng', {
    tessedit_pageseg_mode: '6',
  });
  return text.replace(/\s+/g, ' ').trim();
}

els.captureBtn.onclick = async () => {
  if (currentMode !== 'cover') return;
  els.scanStatus.textContent = 'Reading text from the cover…';
  els.scanStatus.className = 'status';
  const vw = els.video.videoWidth, vh = els.video.videoHeight;

  try {
    // Pass 1: the same region the on-screen reticle highlights — cuts out
    // background/cover art noise and lets the OCR focus on the text that
    // actually matters.
    let cleaned = await runOcrOnRegion(vw * 0.12, vh * 0.20, vw * 0.76, vh * 0.60);

    // Pass 2 (automatic fallback): if that came back too short — e.g. the
    // title didn't fully fit inside the box, or a stylized font needed more
    // context to resolve — retry on the full frame instead of making the
    // person recapture.
    if (!cleaned || cleaned.length < 3) {
      els.scanStatus.textContent = 'Not much there — trying the full frame…';
      cleaned = await runOcrOnRegion(0, 0, vw, vh);
    }

    if (!cleaned || cleaned.length < 3) {
      els.scanStatus.textContent = '✗ Could not read any text — try filling more of the box with just the title, in brighter light, and hold still.';
      els.scanStatus.className = 'status error';
      return;
    }
    els.scanStatus.textContent = 'Read: "' + cleaned.slice(0, 60) + '…" — searching Google Books…';
    lookupByText(cleaned);
  } catch (err) {
    els.scanStatus.textContent = '✗ OCR failed: ' + err.message;
    els.scanStatus.className = 'status error';
  }
};

els.manualLookupBtn.onclick = () => {
  const raw = els.manualInput.value.trim();
  if (!raw) return;
  const digitsOnly = raw.replace(/[^0-9Xx]/g, '');
  els.scanStatus.textContent = 'Searching Google Books…';
  els.scanStatus.className = 'status';
  if (digitsOnly.length === 10 || digitsOnly.length === 13) {
    lookupByIsbn(digitsOnly);
  } else {
    lookupByText(raw);
  }
};

/* ---------- Google Books lookup (with Open Library fallback for ISBNs) ---------- */
async function lookupByIsbn(isbn){
  els.scanStatus.textContent = 'Looking up ISBN ' + isbn + ' in Google Books…';
  const key = settings.booksKey ? '&key=' + encodeURIComponent(settings.booksKey) : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.items && json.items.length) {
      handleBooksResult(json, isbn);
      return;
    }
  } catch { /* fall through to Open Library */ }

  // Google Books' coverage is noticeably weaker for regional/Spanish-language
  // publishers, so fall back to Open Library, which often has these.
  els.scanStatus.textContent = 'Not in Google Books — trying Open Library…';
  try {
    const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const olRes = await fetch(olUrl);
    const olJson = await olRes.json();
    const entry = olJson['ISBN:' + isbn];
    if (entry) {
      showResult({
        title: entry.title || 'Unknown title',
        authors: (entry.authors || []).map(a => a.name).join(', ') || 'Unknown author',
        edition: [entry.publishers && entry.publishers.map(p => p.name).join(', '), entry.publish_date]
          .filter(Boolean).join(' · ') || '—',
        isbn,
        thumb: (entry.cover && (entry.cover.medium || entry.cover.small)) || '',
      });
      return;
    }
  } catch { /* no luck there either */ }

  els.scanStatus.textContent = `✗ ISBN ${isbn} isn't in Google Books or Open Library. Try Cover photo mode, or enter the title manually below.`;
  els.scanStatus.className = 'status error';
}

async function lookupByText(text){
  const key = settings.booksKey ? '&key=' + encodeURIComponent(settings.booksKey) : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(text)}${key}`;
  const res = await fetch(url);
  const json = await res.json();
  handleBooksResult(json, null);
}

function handleBooksResult(json, fallbackIsbn){
  if (!json.items || !json.items.length) {
    els.scanStatus.textContent = '✗ No match found in Google Books. Try again, use Cover photo mode, or enter it manually below.';
    els.scanStatus.className = 'status error';
    return;
  }
  const info = json.items[0].volumeInfo;
  const ids = info.industryIdentifiers || [];
  const isbn13 = (ids.find(i => i.type === 'ISBN_13') || {}).identifier;
  const isbn10 = (ids.find(i => i.type === 'ISBN_10') || {}).identifier;
  const isbn = isbn13 || isbn10 || fallbackIsbn || '';

  showResult({
    title: info.title || 'Unknown title',
    authors: (info.authors || []).join(', ') || 'Unknown author',
    edition: [info.publisher, info.publishedDate].filter(Boolean).join(' · ') || '—',
    isbn,
    thumb: (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) || '',
  });
}

/* ---------- Result + Sheets matching ---------- */
let currentBook = null;
let matchedRowNumber = null;

function showResult(book){
  currentBook = book;
  matchedRowNumber = null;
  els.scanView.classList.add('hidden');
  els.resultView.classList.remove('hidden');
  els.bookTitle.textContent = book.title;
  els.bookAuthor.textContent = book.authors;
  els.bookEdition.textContent = book.edition;
  els.bookIsbn.textContent = book.isbn ? 'ISBN ' + book.isbn : '';
  els.bookThumb.src = book.thumb;
  els.matchBox.className = 'match-box';
  els.matchStatus.textContent = 'Searching your sheet…';
  els.updateOwnerBtn.disabled = true;
  findRowInSheet(book);
}

function colLetterToIndex(letter){
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1; // 0-based
}
function indexToColLetter(idx){
  let n = idx + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Accepts either a plain column letter ("D") or a header name ("Dueño").
// headerRow is the sheet's row 1 (array of header strings).
function resolveColumn(spec, headerRow){
  if (!spec) return -1;
  if (/^[A-Za-z]{1,2}$/.test(spec)) return colLetterToIndex(spec);
  const target = spec.trim().toLowerCase();
  const idx = headerRow.findIndex(h => (h || '').trim().toLowerCase() === target);
  return idx; // -1 if not found
}

// Normalize a title for loose comparison: lowercase, strip punctuation/accents, collapse whitespace.
function normalizeTitle(t){
  return (t || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let resolvedCols = {}; // isbn, title, author, owner, edition -> 0-based index

async function findRowInSheet(book){
  if (!settings.sheetId) {
    els.matchStatus.textContent = 'No Sheet ID set — open Settings to connect your sheet.';
    els.matchBox.classList.add('notfound');
    return;
  }
  if (!accessToken) {
    els.matchStatus.textContent = 'Not signed in — open Settings and sign in with Google.';
    els.matchBox.classList.add('notfound');
    return;
  }
  try {
    const range = `${settings.sheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${settings.sheetId}/values/${encodeURIComponent(range)}`;
    const data = await authedFetch(url);
    const rows = data.values || [];
    const headerRow = rows[0] || [];

    resolvedCols = {
      isbn: resolveColumn(settings.colIsbn, headerRow),
      title: resolveColumn(settings.colTitle, headerRow),
      owner: resolveColumn(settings.colOwner, headerRow),
      author: resolveColumn(settings.colAuthor, headerRow),
      edition: resolveColumn(settings.colEdition, headerRow),
    };

    if (resolvedCols.owner < 0) {
      els.matchStatus.textContent = `Couldn't find an owner column matching "${settings.colOwner}" — check Settings.`;
      els.matchBox.classList.add('notfound');
      return;
    }

    // Pass 1: match by ISBN — most reliable when present on both sides.
    let foundRow = -1;
    let matchedBy = '';
    if (book.isbn && resolvedCols.isbn >= 0) {
      for (let i = 1; i < rows.length; i++) {
        const cellIsbn = (rows[i][resolvedCols.isbn] || '').replace(/[^0-9Xx]/g, '');
        if (cellIsbn && cellIsbn === book.isbn) { foundRow = i; matchedBy = 'ISBN'; break; }
      }
    }

    // Pass 2: no ISBN match (or no ISBN at all) — fall back to title.
    // Many sheet rows won't have an ISBN filled in, so this is the common path.
    if (foundRow < 0 && book.title && resolvedCols.title >= 0) {
      const wanted = normalizeTitle(book.title);
      let bestScore = 0;
      for (let i = 1; i < rows.length; i++) {
        const cellTitle = normalizeTitle(rows[i][resolvedCols.title] || '');
        if (!cellTitle) continue;
        let score = 0;
        if (cellTitle === wanted) score = 100;
        else if (cellTitle.includes(wanted) || wanted.includes(cellTitle)) score = 80;
        else {
          // token overlap, e.g. "hobbit" vs "the hobbit an unexpected journey"
          const wTokens = new Set(wanted.split(' ').filter(w => w.length > 2));
          const cTokens = new Set(cellTitle.split(' ').filter(w => w.length > 2));
          if (wTokens.size) {
            let overlap = 0;
            wTokens.forEach(t => { if (cTokens.has(t)) overlap++; });
            score = (overlap / wTokens.size) * 60;
          }
        }
        if (score > bestScore && score >= 55) { bestScore = score; foundRow = i; matchedBy = 'title'; }
      }
    }

    els.addRowBtn.classList.add('hidden');
    if (foundRow >= 0) {
      matchedRowNumber = foundRow + 1; // 1-indexed for A1 notation
      els.matchStatus.textContent = `Matched row ${matchedRowNumber} in "${settings.sheetName}" (by ${matchedBy}).`;
      els.matchBox.classList.remove('notfound'); els.matchBox.classList.add('found');
      els.updateOwnerBtn.disabled = false;
    } else {
      matchedRowNumber = null;
      els.matchStatus.textContent = 'No matching row found — this book may not be in your sheet yet.';
      els.matchBox.classList.remove('found'); els.matchBox.classList.add('notfound');
      els.updateOwnerBtn.disabled = true;
      els.addRowBtn.classList.remove('hidden');
    }
  } catch (err) {
    els.matchStatus.textContent = 'Could not read the sheet: ' + err.message;
    els.matchBox.classList.add('notfound');
  }
}

els.updateOwnerBtn.onclick = async () => {
  const owner = els.ownerInput.value.trim();
  if (!owner || !matchedRowNumber) return;
  els.updateOwnerBtn.disabled = true;
  els.matchStatus.textContent = 'Updating owner…';
  try {
    const ownerLetter = indexToColLetter(resolvedCols.owner);
    const cell = `${settings.sheetName}!${ownerLetter}${matchedRowNumber}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${settings.sheetId}/values/${encodeURIComponent(cell)}?valueInputOption=USER_ENTERED`;
    await authedFetch(url, { method: 'PUT', body: JSON.stringify({ values: [[owner]] }) });
    els.matchStatus.textContent = `✓ Owner updated to "${owner}"`;
    els.matchStatus.className = 'status success';
  } catch (err) {
    els.matchStatus.textContent = '✗ Update failed: ' + err.message;
    els.matchStatus.className = 'status error';
    els.updateOwnerBtn.disabled = false;
  }
};

// Fill in a brand-new row when the book wasn't found in the sheet.
els.addRowBtn.onclick = async () => {
  if (!currentBook) return;
  const owner = els.ownerInput.value.trim();
  els.addRowBtn.disabled = true;
  els.matchStatus.textContent = 'Adding new row…';
  try {
    // Build a row wide enough to cover the highest resolved column index.
    const maxIdx = Math.max(
      resolvedCols.isbn, resolvedCols.title, resolvedCols.author,
      resolvedCols.owner, resolvedCols.edition, 0
    );
    const newRow = new Array(maxIdx + 1).fill('');
    if (resolvedCols.isbn >= 0)    newRow[resolvedCols.isbn] = currentBook.isbn || '';
    if (resolvedCols.title >= 0)   newRow[resolvedCols.title] = currentBook.title || '';
    if (resolvedCols.author >= 0)  newRow[resolvedCols.author] = currentBook.authors || '';
    if (resolvedCols.edition >= 0) newRow[resolvedCols.edition] = currentBook.edition || '';
    if (resolvedCols.owner >= 0)   newRow[resolvedCols.owner] = owner || '';

    const range = `${settings.sheetName}!A:Z`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${settings.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    await authedFetch(url, { method: 'POST', body: JSON.stringify({ values: [newRow] }) });
    els.matchStatus.textContent = '✓ Added as a new book in your sheet';
    els.matchStatus.className = 'status success';
    els.addRowBtn.classList.add('hidden');
  } catch (err) {
    els.matchStatus.textContent = '✗ Could not add row: ' + err.message;
    els.matchStatus.className = 'status error';
  } finally {
    els.addRowBtn.disabled = false;
  }
};

els.scanAgainBtn.onclick = () => {
  els.resultView.classList.add('hidden');
  els.scanView.classList.remove('hidden');
  els.ownerInput.value = '';
  els.manualInput.value = '';
  els.scanStatus.className = 'status';
  lastDecoded = null;
  setMode(currentMode);
};

/* ---------- Boot ---------- */
window.addEventListener('load', () => {
  setMode('barcode');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
window.addEventListener('beforeunload', () => { stopEverything(); stopCoverCamera(); });
