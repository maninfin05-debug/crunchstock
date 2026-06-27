/* ── Fabric colour map ────────────────────────────────────────────────── */
const PALETTE = {
  'Cotton Single Jersey':    ['#E8D5C0','#C4956A'],
  'Polyester Georgette':     ['#E8D5F5','#9B59B6'],
  'Viscose Lycra Blend':     ['#2D2D3E','#1A1A2E'],
  'Chanderi Silk Cotton':    ['#FFF8DC','#C8A84B'],
  'Polyester Chiffon':       ['#FFE4EE','#F48FB1'],
  'Cotton Voile':            ['#DCEEFB','#5BA4CF'],
  'Denim Twill':             ['#2C3E7A','#1A237E'],
  'Polyester Warp Knit Mesh':['#2D2D2D','#111111'],
  'Rayon Slub':              ['#FFF3E0','#E8954A'],
  'Net Fabric (Embroidered)':['#8B1A1A','#C0392B'],
};

function thumbGradient(f) {
  const c = PALETTE[f] || ['#64748B','#475569'];
  return `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 100%)`;
}

function fmtId(id) { return `CS-${String(id).padStart(4,'0')}`; }

function esc(str) {
  if (str == null) return '—';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function $(id) { return document.getElementById(id); }

/* ── API ──────────────────────────────────────────────────────────────── */
async function apiFetch(url) {
  const res  = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

/* ── Card HTML ────────────────────────────────────────────────────────── */
function cardHTML(l) {
  const bc  = l.type === 'Fresh' ? 'badge-fresh' : 'badge-lot';
  const qty = l.quantity ? `${Number(l.quantity).toLocaleString()} ${l.quantity_unit}` : '—';
  const bg  = thumbGradient(l.fabric_type);

  let thumbContent;
  try {
    const imgs = l.uploaded_images ? JSON.parse(l.uploaded_images) : [];
    thumbContent = imgs.length
      ? `<img src="${esc(imgs[0])}" alt="${esc(l.fabric_type)}" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<span class="thumb-label">${esc(l.fabric_type)}</span>`;
  } catch {
    thumbContent = `<span class="thumb-label">${esc(l.fabric_type)}</span>`;
  }

  return `
  <article class="card" data-id="${l.id}">
    <div class="card-thumb" style="background:${bg}">${thumbContent}</div>
    <div class="card-body">
      <div class="card-id">${fmtId(l.id)}</div>
      <div class="card-title">${esc(l.fabric_type)}</div>
      <div class="chips">
        ${l.gsm         ? `<span class="chip">${l.gsm} GSM</span>` : ''}
        ${l.color       ? `<span class="chip">${esc(l.color)}</span>` : ''}
        ${l.width_panna ? `<span class="chip">${l.width_panna}"</span>` : ''}
        <span class="badge ${bc}">${esc(l.type)}</span>
      </div>
      <div class="card-meta">
        <div class="meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          ${esc(l.machine_category)}
        </div>
        <div class="meta-row">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          ${qty}
        </div>
      </div>
      <div class="card-price">${esc(l.asking_price)}</div>
      <button class="btn btn-primary btn-full swatch-btn" data-id="${l.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Request Swatch
      </button>
    </div>
  </article>`;
}

function attachCardListeners(grid) {
  grid.querySelectorAll('.swatch-btn').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openSwatch(btn.dataset.id); })
  );
  grid.querySelectorAll('.card').forEach(card =>
    card.addEventListener('click', () => openDetail(card.dataset.id))
  );
}

/* ── Load listings ────────────────────────────────────────────────────── */
let activeType = 'Fresh'; // track current tab

async function loadListings(type, extraParams = {}) {
  activeType = type;

  // Update tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  $('loading').classList.remove('hidden');
  $('grid').innerHTML = '';
  $('empty').classList.add('hidden');

  try {
    const url = new URL('/api/listings', location.origin);
    if (type) url.searchParams.set('type', type);
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v !== '' && v != null) url.searchParams.set(k, v);
    });

    const data = await apiFetch(url);
    $('loading').classList.add('hidden');

    const hasFilters = type !== '' || Object.values(extraParams).some(Boolean);
    const label = type === 'Fresh' ? 'Fresh' : type === 'Lot' ? 'Lot / Surplus' : '';

    if (!data.listings.length) {
      $('empty').classList.remove('hidden');
      $('resultsCount').innerHTML = '';
      $('clearTop').classList.add('hidden');
      return;
    }

    $('resultsCount').innerHTML = label
      ? `Showing <strong>${data.total}</strong> ${label} listing${data.total !== 1 ? 's' : ''}`
      : `Showing <strong>${data.total}</strong> listing${data.total !== 1 ? 's' : ''}`;

    $('clearTop').classList.toggle('hidden', !hasFilters || type !== '');
    $('grid').innerHTML = data.listings.map(cardHTML).join('');
    attachCardListeners($('grid'));
  } catch {
    $('loading').classList.add('hidden');
    $('empty').classList.remove('hidden');
  }
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    loadListings(btn.dataset.type, gatherFilterParams());
  });
});

/* ── Hero buttons → instant tab switch ───────────────────────────────── */
$('heroFreshBtn').addEventListener('click', () => {
  window.scrollTo({ top: document.querySelector('.tab-bar').offsetTop - 116, behavior: 'smooth' });
  setTimeout(() => loadListings('Fresh'), 100);
});

$('heroLotBtn').addEventListener('click', () => {
  window.scrollTo({ top: document.querySelector('.tab-bar').offsetTop - 116, behavior: 'smooth' });
  setTimeout(() => loadListings('Lot'), 100);
});

/* ── Search ───────────────────────────────────────────────────────────── */
function gatherFilterParams() {
  return {
    q:                $('searchInput').value.trim(),
    machine_category: $('f_machine').value,
    job_work:         $('f_job').value,
    quantity_unit:    $('f_unit').value,
    gsm_min:          $('f_gsm_min').value,
    gsm_max:          $('f_gsm_max').value,
  };
}

function doSearch() {
  loadListings(activeType, gatherFilterParams());
}

function clearAll() {
  $('searchInput').value = '';
  ['f_machine','f_job','f_unit'].forEach(id => $(id).value = '');
  ['f_gsm_min','f_gsm_max'].forEach(id => $(id).value = '');
  loadListings(activeType);
}

$('searchBtn').addEventListener('click', doSearch);
$('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
$('applyFilters').addEventListener('click', doSearch);
$('clearFilters').addEventListener('click', clearAll);
$('clearTop').addEventListener('click', clearAll);

/* ── Filters toggle ───────────────────────────────────────────────────── */
let filtersOpen = false;
$('toggleFilters').addEventListener('click', () => {
  filtersOpen = !filtersOpen;
  $('filtersPanel').classList.toggle('open', filtersOpen);
  $('filterLabel').textContent = filtersOpen ? 'Hide Filters' : 'Filters';
});

/* ── Detail panel ─────────────────────────────────────────────────────── */
async function openDetail(id) {
  try {
    const l  = await apiFetch(`/api/listings/${id}`);
    const bg = thumbGradient(l.fabric_type);
    const bc = l.type === 'Fresh' ? 'badge-fresh' : 'badge-lot';
    const dt = $('detailThumb');

    try {
      const imgs = l.uploaded_images ? JSON.parse(l.uploaded_images) : [];
      if (imgs.length) {
        dt.style.background = bg;
        dt.style.height = 'auto';
        dt.innerHTML = `<img src="${esc(imgs[0])}" style="width:100%;height:200px;object-fit:cover;display:block;">` +
          (imgs.length > 1
            ? `<div style="display:flex;gap:6px;padding:8px;background:#f9fafb;border-top:1px solid #e5e7eb;overflow-x:auto">` +
              imgs.slice(1).map(u => `<img src="${esc(u)}" style="height:64px;width:64px;object-fit:cover;border-radius:6px;flex-shrink:0;">`).join('') +
              `</div>`
            : '');
      } else {
        dt.innerHTML = '';
        dt.style.background = bg;
        dt.style.height = '200px';
      }
    } catch {
      dt.innerHTML = '';
      dt.style.background = bg;
      dt.style.height = '200px';
    }

    $('detailBody').innerHTML = `
      <div class="detail-id">${fmtId(l.id)}</div>
      <div class="detail-title">${esc(l.fabric_type)}</div>
      <span class="badge ${bc}">${esc(l.type)}</span>
      <div class="detail-price">${esc(l.asking_price)}</div>
      <table class="detail-table">
        <tr><td>Content</td><td>${esc(l.content)}</td></tr>
        <tr><td>GSM</td><td>${l.gsm ?? '—'}</td></tr>
        <tr><td>Color</td><td>${esc(l.color)}</td></tr>
        <tr><td>Width / Panna</td><td>${l.width_panna ? l.width_panna + '"' : '—'}</td></tr>
        <tr><td>Quantity</td><td>${l.quantity ? Number(l.quantity).toLocaleString() + ' ' + l.quantity_unit : '—'}</td></tr>
        <tr><td>Machine</td><td>${esc(l.machine_category)}</td></tr>
        <tr><td>Job Work</td><td>${esc(l.job_work)}${l.job_work_specify ? ' — ' + esc(l.job_work_specify) : ''}</td></tr>
        <tr><td>Usage</td><td>${esc(l.usage)}</td></tr>
        <tr><td>Print / Design</td><td>${esc(l.print_design_type)}</td></tr>
        <tr><td>Listing Reason</td><td>${esc(l.liquidation_reason)}</td></tr>
        <tr><td>Listed</td><td>${new Date(l.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td></tr>
      </table>
      <div class="notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Supplier identity fully masked — no company or contact info shown publicly.
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:8px"
              onclick="openSwatch(${l.id}); closeDetail();">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        Request a Swatch
      </button>`;

    $('detailPanel').classList.add('open');
    $('detailOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) { console.error(err); }
}

function closeDetail() {
  $('detailPanel').classList.remove('open');
  $('detailOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Swatch modal ─────────────────────────────────────────────────────── */
let _cachedListing = null;

function openSwatch(id) {
  _cachedListing = null;
  $('swatchId').value = id;
  $('swatchRef').textContent = `Listing ${fmtId(id)}`;
  $('swatchOverlay').classList.add('open');
  setTimeout(() => $('buyerName').focus(), 80);
  fetch(`/api/listings/${id}`)
    .then(r => r.ok ? r.json() : null)
    .then(l => { if (l) _cachedListing = l; })
    .catch(() => {});
}

function closeSwatch() {
  $('swatchOverlay').classList.remove('open');
  $('swatchForm').reset();
  const btn = document.querySelector('#swatchForm [type=submit]');
  btn.disabled = false;
  btn.innerHTML = SUBMIT_BTN_HTML;
}

function buildWaMessage(id, name, phone, address) {
  const l = _cachedListing || {};
  return encodeURIComponent(
    `Hi CrunchStock,\n\nSwatch request:\n` +
    `Listing: ${fmtId(id)}\n` +
    (l.fabric_type  ? `Fabric: ${l.fabric_type}\n`  : '') +
    (l.color        ? `Color: ${l.color}\n`          : '') +
    (l.gsm          ? `GSM: ${l.gsm}\n`              : '') +
    (l.asking_price ? `Price: ${l.asking_price}\n`   : '') +
    `\nBuyer:\nName: ${name}\nPhone: ${phone}\nAddress: ${address}` +
    `\n\nPlease send the swatch. Thank you.`
  );
}

$('swatchForm').addEventListener('submit', e => {
  e.preventDefault();
  const id      = $('swatchId').value;
  const name    = $('buyerName').value.trim();
  const phone   = $('buyerPhone').value.trim();
  const address = $('buyerAddress').value.trim();
  if (!name || !phone || !address) return;

  const btn = e.submitter;
  btn.disabled = true;
  btn.innerHTML = `<svg class="spin" width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Opening WhatsApp…`;

  fetch('/api/swatch-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listing_id: id, buyer_name: name, buyer_phone: phone, buyer_address: address })
  }).catch(() => {});

  closeSwatch();
  window.open(`https://wa.me/447553683413?text=${buildWaMessage(id, name, phone, address)}`, '_blank');
});

/* ── Event listeners ──────────────────────────────────────────────────── */
$('detailClose').addEventListener('click', closeDetail);
$('detailOverlay').addEventListener('click', closeDetail);
$('swatchClose').addEventListener('click', closeSwatch);
$('swatchCancel').addEventListener('click', closeSwatch);
$('swatchOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeSwatch(); });

/* ── Stat counter ─────────────────────────────────────────────────────── */
async function updateStatTotal() {
  try {
    const data = await apiFetch('/api/listings');
    const el = $('statTotal');
    if (el) el.textContent = data.total + '+';
  } catch {}
}

/* ── Boot ─────────────────────────────────────────────────────────────── */
const SUBMIT_BTN_HTML = document.querySelector('#swatchForm [type=submit]').innerHTML;
loadListings('Fresh');
updateStatTotal();
