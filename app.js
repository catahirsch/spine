/* ---------- Settings persistence ---------- */
const SETTINGS_KEY = 'spine_settings_v1';

function loadSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

let settings = loadSettings();

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
  els.clientId.value  = settings.clientId  || '';
  els.sheetId.value   = settings.sheetId   || '';
  els.sheetName.value = settings.sheetName || 'Library';
  els.colIsbn.value   = settings.colIsbn   || 'A';
  els.colTitle.value  = settings.colTitle  || 'B';
  els.colOwner.value  = settings.colOwner  || 'Dueño';
  els.colAuthor.value = settings.colAuthor || 'C';
  els.colEdition.value= settings.colEdition|| '';
  els.booksKey.value  = settings.booksKey  || '';
}
fillSettingsForm();

els.settingsBtn.onclick = () => {
  els.settingsPanel.classList.toggle('hidden');
  els.scanView.classList.toggle('hidden');
  els.resultView.classList.add('hidden');
};

els.saveSettings.onclick = () => {
  settings = {
    clientId: els.clientId.value.trim(),
    sheetId: els.sheetId.value.trim(),
    sheetName: els.sheetName.value.trim() || 'Library',
    colIsbn: els.colIsbn.value.trim() || 'A',
    colTitle: els.colTitle.value.trim() || 'B',
    colOwner: els.colOwner.value.trim() || 'Dueño',
    colAuthor: els.colAuthor.value.trim() || '',
    colEdition: els.colEdition.value.trim() || '',
    booksKey: els.booksKey.value.trim(),
  };
  saveSettings(settings);
  els.authStatus.textContent = 'Saved.';
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
  stopEverything();
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
    formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.UPC_A ],
    verbose: false,
  });
  try {
    scanning = true;
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 160 } },
      (decodedText) => onIsbnDecoded(decodedText),
      () => {} // ignore per-frame scan failures
    );
  } catch (err) {
    els.scanStatus.textContent = 'Camera error: ' + err;
  }
}

function stopEverything(){
  if (html5QrCode && scanning) {
    html5QrCode.stop().catch(()=>{});
    scanning = false;
  }
  const region = document.getElementById('qrRegion');
  if (region) region.style.display = 'none';
  els.video.style.display = 'block';
}

let lastDecoded = null;
function onIsbnDecoded(text){
  if (text === lastDecoded) return; // debounce repeat frames
  lastDecoded = text;
  const isbn = text.replace(/[^0-9Xx]/g, '');
  els.scanStatus.textContent = 'Found barcode: ' + isbn;
  stopEverything();
  lookupByIsbn(isbn);
}

/* ---------- Cover camera (plain getUserMedia, for OCR mode) ---------- */
let coverStream = null;
async function startCoverCamera(){
  stopEverything();
  els.scanStatus.textContent = 'Frame the title & author, then capture.';
  coverStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  els.video.srcObject = coverStream;
  els.video.style.display = 'block';
  await els.video.play();
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
  stopCoverCamera();
  lastDecoded = null;
  if (mode === 'barcode') startBarcodeScan();
  else startCoverCamera();
}

els.captureBtn.onclick = async () => {
  if (currentMode !== 'cover') return;
  els.scanStatus.textContent = 'Reading text from the cover…';
  const canvas = els.hiddenCanvas;
  canvas.width = els.video.videoWidth;
  canvas.height = els.video.videoHeight;
  canvas.getContext('2d').drawImage(els.video, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  try {
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng');
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      els.scanStatus.textContent = 'Could not read any text — try a closer, well-lit shot.';
      return;
    }
    els.scanStatus.textContent = 'Read: "' + cleaned.slice(0, 60) + '…" — searching Google Books…';
    lookupByText(cleaned);
  } catch (err) {
    els.scanStatus.textContent = 'OCR failed: ' + err.message;
  }
};

/* ---------- Google Books lookup ---------- */
async function lookupByIsbn(isbn){
  const key = settings.booksKey ? '&key=' + encodeURIComponent(settings.booksKey) : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`;
  const res = await fetch(url);
  const json = await res.json();
  handleBooksResult(json, isbn);
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
    els.scanStatus.textContent = 'No match found in Google Books. Try again or use the other mode.';
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

    let foundRow = -1;
    for (let i = 1; i < rows.length; i++) { // skip header row
      const row = rows[i];
      const cellIsbn = resolvedCols.isbn >= 0 ? (row[resolvedCols.isbn] || '').replace(/[^0-9Xx]/g, '') : '';
      const cellTitle = resolvedCols.title >= 0 ? (row[resolvedCols.title] || '').toLowerCase().trim() : '';
      if (book.isbn && cellIsbn && cellIsbn === book.isbn) { foundRow = i; break; }
      if (foundRow < 0 && book.title && cellTitle && cellTitle === book.title.toLowerCase().trim()) { foundRow = i; break; }
    }

    els.addRowBtn.classList.add('hidden');
    if (foundRow >= 0) {
      matchedRowNumber = foundRow + 1; // 1-indexed for A1 notation
      els.matchStatus.textContent = `Matched row ${matchedRowNumber} in "${settings.sheetName}".`;
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
    els.matchStatus.textContent = `Owner updated to "${owner}" ✓`;
  } catch (err) {
    els.matchStatus.textContent = 'Update failed: ' + err.message;
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
    els.matchStatus.textContent = 'Added as a new book in your sheet ✓';
    els.addRowBtn.classList.add('hidden');
  } catch (err) {
    els.matchStatus.textContent = 'Could not add row: ' + err.message;
  } finally {
    els.addRowBtn.disabled = false;
  }
};

els.scanAgainBtn.onclick = () => {
  els.resultView.classList.add('hidden');
  els.scanView.classList.remove('hidden');
  els.ownerInput.value = '';
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
