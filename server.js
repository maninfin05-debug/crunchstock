const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Database ──────────────────────────────────────────────────────────────────
const db = new DatabaseSync(path.join(__dirname, 'crunchstock.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS listings (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    fabric_type        TEXT    NOT NULL,
    gsm                INTEGER,
    content            TEXT,
    type               TEXT,
    usage              TEXT,
    machine_category   TEXT,
    job_work           TEXT,
    job_work_specify   TEXT,
    liquidation_reason TEXT,
    print_design_type  TEXT,
    color              TEXT,
    width_panna        REAL,
    quantity           REAL,
    quantity_unit      TEXT,
    asking_price       TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS swatch_requests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id     INTEGER NOT NULL,
    buyer_name     TEXT    NOT NULL,
    buyer_phone    TEXT    NOT NULL,
    buyer_address  TEXT    NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings(id)
  );
`);

// ── Seed ──────────────────────────────────────────────────────────────────────
function seed() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM listings').get();
  if (c > 0) return;

  const insert = db.prepare(`
    INSERT INTO listings
      (fabric_type, gsm, content, type, usage, machine_category,
       job_work, job_work_specify, liquidation_reason, print_design_type,
       color, width_panna, quantity, quantity_unit, asking_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rows = [
    ['Cotton Single Jersey',     180, '100% Combed Cotton',        'Fresh', 'T-shirts, Polo Shirts, Casual Innerwear',           'Circular Knitting', 'None',          null,                                  'No demand',       'Solid / Plain',                        'White',                  60, 3200, 'meters', '₹42–48/meter'],
    ['Polyester Georgette',       75, '100% Polyester',             'Lot',   'Sarees, Dupattas, Light Ethnic Wear',               'Waterjet',          'Digital Print',  null,                                  'Outdated design', 'Floral Digital Print',                 'Multi-colour',           44,  850, 'meters', '₹28–34/meter'],
    ['Viscose Lycra Blend',      220, '92% Viscose, 8% Lycra',     'Fresh', 'Leggings, Stretchable Bottoms, Activewear',         'Circular Knitting', 'None',          null,                                  'Panna shrinkage', 'Solid',                                'Black',                  58, 1500, 'meters', '₹65–75/meter'],
    ['Chanderi Silk Cotton',     120, '70% Silk, 30% Cotton',      'Lot',   'Salwar Suits, Sarees, Ethnic Occasions',            'Rapier',            'Embroidery',     null,                                  'Outdated quality','Zari Border with Butis',               'Ivory with Gold',        44,  420, 'meters', '₹110–130/meter'],
    ['Polyester Chiffon',         65, '100% Polyester',             'Fresh', 'Sarees, Dupatta, Party Wear Tops',                  'Waterjet',          'None',          null,                                  'No demand',       'Solid / Plain',                        'Baby Pink',              44, 1200, 'meters', '₹22–27/meter'],
    ['Cotton Voile',              90, '100% Cotton',                'Lot',   'Kurtas, Light Summer Wear, Scarves',                'Airjet',            'Mill Print',     null,                                  'Dyeing defect',   'Small Geometric Print',                'White with Blue Print',  44,  600, 'meters', '₹18–22/meter'],
    ['Denim Twill',              320, '98% Cotton, 2% Elastane',   'Fresh', 'Jeans, Jackets, Heavy Bottom Wear',                 'Rapier',            'None',          null,                                  'Weaving defect',  'None',                                 'Indigo Blue',            58, 2800, 'meters', '₹85–95/meter'],
    ['Polyester Warp Knit Mesh', 110, '100% Polyester',             'Lot',   'Sports Jerseys, Bags, Mesh Lining',                 'Warp Knitting',     'None',          null,                                  'No demand',       'Textured Mesh / Solid',                'Black',                  60,  980, 'meters', '₹32–38/meter'],
    ['Rayon Slub',               145, '100% Rayon Slub',            'Fresh', 'Kurtas, Kurtis, Casual Tops',                       'Airjet',            'None',          null,                                  'Outdated design', 'Vertical Stripe (yarn dyed)',           'Multicolor Stripe',      44, 1100, 'meters', '₹38–45/meter'],
    ['Net Fabric (Embroidered)',   85, '80% Nylon, 20% Polyester',  'Lot',   'Lehengas, Bridal Wear, Decorative Overlays',        'Warp Knitting',     'Embroidery',    'Heavy Zari and Sequence Embroidery',  'No demand',       'Embroidered Floral with Sequence',     'Red with Gold Embroidery',44, 340, 'meters', '₹180–220/meter'],
  ];

  db.exec('BEGIN');
  for (const r of rows) insert.run(...r);
  db.exec('COMMIT');
  console.log('Seeded 10 sample listings.');
}

seed();

// ── Helper ────────────────────────────────────────────────────────────────────
function lastId() {
  return Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);
}

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const { q, fabric_type, type, machine_category, job_work,
          liquidation_reason, quantity_unit, gsm_min, gsm_max } = req.query;

  let sql    = 'SELECT * FROM listings WHERE 1=1';
  const args = [];

  if (q) {
    sql += ` AND (fabric_type LIKE ? OR content LIKE ? OR usage LIKE ?
                  OR color LIKE ? OR print_design_type LIKE ?)`;
    const t = `%${q}%`;
    args.push(t, t, t, t, t);
  }
  if (fabric_type)        { sql += ' AND fabric_type = ?';        args.push(fabric_type); }
  if (type)               { sql += ' AND type = ?';               args.push(type); }
  if (machine_category)   { sql += ' AND machine_category = ?';   args.push(machine_category); }
  if (job_work)           { sql += ' AND job_work = ?';           args.push(job_work); }
  if (liquidation_reason) { sql += ' AND liquidation_reason = ?'; args.push(liquidation_reason); }
  if (quantity_unit)      { sql += ' AND quantity_unit = ?';      args.push(quantity_unit); }
  if (gsm_min)            { sql += ' AND gsm >= ?';               args.push(Number(gsm_min)); }
  if (gsm_max)            { sql += ' AND gsm <= ?';               args.push(Number(gsm_max)); }

  sql += ' ORDER BY created_at DESC';

  try {
    const rows = db.prepare(sql).all(...args);
    res.json({ listings: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/swatch-requests', (req, res) => {
  const { listing_id, buyer_name, buyer_phone, buyer_address } = req.body;
  if (!listing_id || !buyer_name || !buyer_phone || !buyer_address)
    return res.status(400).json({ error: 'All fields are required' });

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  db.prepare(`
    INSERT INTO swatch_requests (listing_id, buyer_name, buyer_phone, buyer_address)
    VALUES (?, ?, ?, ?)
  `).run(listing_id, buyer_name.trim(), buyer_phone.trim(), buyer_address.trim());

  res.json({ success: true, request_id: lastId(), listing });
});

// ── Admin ─────────────────────────────────────────────────────────────────────
app.get('/admin', (_req, res) => {
  const requests = db.prepare(`
    SELECT sr.id, sr.listing_id, sr.buyer_name, sr.buyer_phone, sr.buyer_address,
           sr.created_at, l.fabric_type, l.color, l.asking_price
    FROM swatch_requests sr
    JOIN listings l ON l.id = sr.listing_id
    ORDER BY sr.created_at DESC
  `).all();

  const listings = db.prepare('SELECT * FROM listings ORDER BY id').all();

  const cell = v => `<td>${v ?? '—'}</td>`;
  const tr   = cols => row => `<tr>${cols.map(c => cell(row[c])).join('')}</tr>`;

  const reqRows = requests.length
    ? requests.map(tr(['id','listing_id','fabric_type','buyer_name','buyer_phone','buyer_address','created_at'])).join('')
    : '<tr><td colspan="7" style="color:#999;padding:16px">No swatch requests yet.</td></tr>';

  const listRows = listings.map(l => {
    const badge = `<span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;
      background:${l.type==='Fresh'?'#d1fae5':'#fef3c7'};
      color:${l.type==='Fresh'?'#065f46':'#92400e'}">${l.type}</span>`;
    return `<tr>
      <td>CS-${String(l.id).padStart(4,'0')}</td>
      <td>${l.fabric_type}</td>
      <td>${badge}</td>
      <td>${l.gsm ?? '—'}</td>
      <td>${l.color ?? '—'}</td>
      <td>${l.quantity} ${l.quantity_unit}</td>
      <td>${l.machine_category}</td>
      <td>${l.asking_price}</td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>CrunchStock Admin</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 16px;color:#111827}
    h1{font-size:20px;margin-bottom:4px}
    .sub{color:#6b7280;font-size:13px;margin-bottom:28px}
    h2{font-size:15px;margin:28px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:8px 10px;background:#f3f4f6;font-weight:600;border-bottom:2px solid #e5e7eb}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    tr:hover td{background:#fafafa}
  </style></head><body>
  <h1>CrunchStock — Admin View</h1>
  <p class="sub">Local only. Supplier identity remains masked on the public site.</p>

  <h2>Swatch Requests (${requests.length})</h2>
  <table>
    <tr><th>#</th><th>Listing ID</th><th>Fabric</th><th>Buyer Name</th>
        <th>Phone</th><th>Address</th><th>Requested At</th></tr>
    ${reqRows}
  </table>

  <h2>Listings (${listings.length})</h2>
  <table>
    <tr><th>ID</th><th>Fabric</th><th>Type</th><th>GSM</th>
        <th>Color</th><th>Qty</th><th>Machine</th><th>Price</th></tr>
    ${listRows}
  </table>
  </body></html>`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nCrunchStock  →  http://localhost:${PORT}`);
  console.log(`Admin panel  →  http://localhost:${PORT}/admin\n`);
});
