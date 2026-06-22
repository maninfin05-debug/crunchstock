const express = require('express');
const { createClient } = require('@libsql/client');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Uploads ───────────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
    },
  }),
  limits: { files: 5, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Database ──────────────────────────────────────────────────────────────────
const db = createClient({
  url:       process.env.TURSO_DATABASE_URL ?? 'file:crunchstock.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS listings (
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
       status             TEXT DEFAULT 'approved',
       supplier_phone     TEXT,
       uploaded_images    TEXT,
       created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS swatch_requests (
       id             INTEGER PRIMARY KEY AUTOINCREMENT,
       listing_id     INTEGER NOT NULL,
       buyer_name     TEXT    NOT NULL,
       buyer_phone    TEXT    NOT NULL,
       buyer_address  TEXT    NOT NULL,
       created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (listing_id) REFERENCES listings(id)
     )`,
  ], 'write');
}

async function migrateDb() {
  for (const sql of [
    "ALTER TABLE listings ADD COLUMN status TEXT DEFAULT 'approved'",
    'ALTER TABLE listings ADD COLUMN supplier_phone TEXT',
    'ALTER TABLE listings ADD COLUMN uploaded_images TEXT',
  ]) {
    try { await db.execute(sql); }
    catch (e) {
      const msg = e.message.toLowerCase();
      if (msg.includes('already has a column named') || msg.includes('duplicate column name')) continue;
      throw e;
    }
  }
  await db.execute("UPDATE listings SET status = 'approved' WHERE status IS NULL");
}

// ── Seed ──────────────────────────────────────────────────────────────────────
async function seed() {
  const res = await db.execute('SELECT COUNT(*) AS c FROM listings');
  if (Number(res.rows[0].c) > 0) return;

  const sql = `
    INSERT INTO listings
      (fabric_type, gsm, content, type, usage, machine_category,
       job_work, job_work_specify, liquidation_reason, print_design_type,
       color, width_panna, quantity, quantity_unit, asking_price, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')
  `;

  const rows = [
    ['Cotton Single Jersey',     180, '100% Combed Cotton',        'Fresh', 'T-shirts, Polo Shirts, Casual Innerwear',      'Circular Knitting', 'None',         null,                                 'No demand',        'Solid / Plain',                    'White',                   60, 3200, 'meters', '₹42–48/meter'],
    ['Polyester Georgette',       75, '100% Polyester',             'Lot',   'Sarees, Dupattas, Light Ethnic Wear',          'Waterjet',          'Digital Print', null,                                 'Outdated design',  'Floral Digital Print',             'Multi-colour',            44,  850, 'meters', '₹28–34/meter'],
    ['Viscose Lycra Blend',      220, '92% Viscose, 8% Lycra',     'Fresh', 'Leggings, Stretchable Bottoms, Activewear',    'Circular Knitting', 'None',         null,                                 'Panna shrinkage',  'Solid',                            'Black',                   58, 1500, 'meters', '₹65–75/meter'],
    ['Chanderi Silk Cotton',     120, '70% Silk, 30% Cotton',      'Lot',   'Salwar Suits, Sarees, Ethnic Occasions',       'Rapier',            'Embroidery',    null,                                 'Outdated quality', 'Zari Border with Butis',           'Ivory with Gold',         44,  420, 'meters', '₹110–130/meter'],
    ['Polyester Chiffon',         65, '100% Polyester',             'Fresh', 'Sarees, Dupatta, Party Wear Tops',             'Waterjet',          'None',         null,                                 'No demand',        'Solid / Plain',                    'Baby Pink',               44, 1200, 'meters', '₹22–27/meter'],
    ['Cotton Voile',              90, '100% Cotton',                'Lot',   'Kurtas, Light Summer Wear, Scarves',           'Airjet',            'Mill Print',    null,                                 'Dyeing defect',    'Small Geometric Print',            'White with Blue Print',   44,  600, 'meters', '₹18–22/meter'],
    ['Denim Twill',              320, '98% Cotton, 2% Elastane',   'Fresh', 'Jeans, Jackets, Heavy Bottom Wear',            'Rapier',            'None',         null,                                 'Weaving defect',   'None',                             'Indigo Blue',             58, 2800, 'meters', '₹85–95/meter'],
    ['Polyester Warp Knit Mesh', 110, '100% Polyester',             'Lot',   'Sports Jerseys, Bags, Mesh Lining',            'Warp Knitting',     'None',         null,                                 'No demand',        'Textured Mesh / Solid',            'Black',                   60,  980, 'meters', '₹32–38/meter'],
    ['Rayon Slub',               145, '100% Rayon Slub',            'Fresh', 'Kurtas, Kurtis, Casual Tops',                  'Airjet',            'None',         null,                                 'Outdated design',  'Vertical Stripe (yarn dyed)',      'Multicolor Stripe',       44, 1100, 'meters', '₹38–45/meter'],
    ['Net Fabric (Embroidered)',   85, '80% Nylon, 20% Polyester',  'Lot',   'Lehengas, Bridal Wear, Decorative Overlays',   'Warp Knitting',     'Embroidery',   'Heavy Zari and Sequence Embroidery', 'No demand',        'Embroidered Floral with Sequence', 'Red with Gold Embroidery', 44, 340, 'meters', '₹180–220/meter'],
  ];

  await db.batch(rows.map(r => ({ sql, args: r })), 'write');
  console.log('Seeded 10 sample listings.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = v => v == null ? '—' : String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Public pages ──────────────────────────────────────────────────────────────
app.get('/supplier', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'supplier.html'));
});

// ── Buyer API ─────────────────────────────────────────────────────────────────
app.get('/api/listings', async (req, res) => {
  const { q, fabric_type, type, machine_category, job_work,
          liquidation_reason, quantity_unit, gsm_min, gsm_max } = req.query;

  let sql    = "SELECT * FROM listings WHERE status = 'approved'";
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
    const result = await db.execute({ sql, args });
    res.json({ listings: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  "SELECT * FROM listings WHERE id = ? AND status = 'approved'",
      args: [req.params.id],
    });
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/swatch-requests', async (req, res) => {
  const { listing_id, buyer_name, buyer_phone, buyer_address } = req.body;
  if (!listing_id || !buyer_name || !buyer_phone || !buyer_address)
    return res.status(400).json({ error: 'All fields are required' });

  try {
    const lr = await db.execute({
      sql:  "SELECT * FROM listings WHERE id = ? AND status = 'approved'",
      args: [listing_id],
    });
    const listing = lr.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const ir = await db.execute({
      sql:  'INSERT INTO swatch_requests (listing_id, buyer_name, buyer_phone, buyer_address) VALUES (?, ?, ?, ?)',
      args: [listing_id, buyer_name.trim(), buyer_phone.trim(), buyer_address.trim()],
    });

    res.json({ success: true, request_id: Number(ir.lastInsertRowid), listing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Supplier submission ───────────────────────────────────────────────────────
app.post('/api/listings', (req, res, next) => {
  upload.array('images', 5)(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const {
    fabric_type, gsm, content, type, usage, machine_category,
    job_work, job_work_specify, liquidation_reason, print_design_type,
    color, width_panna, quantity, quantity_unit, asking_price, supplier_phone,
  } = req.body;

  if (!fabric_type || !supplier_phone)
    return res.status(400).json({ error: 'Fabric type and supplier phone are required' });

  const imagePaths = (req.files || []).map(f => `/uploads/${f.filename}`);

  try {
    const ir = await db.execute({
      sql: `INSERT INTO listings
              (fabric_type, gsm, content, type, usage, machine_category,
               job_work, job_work_specify, liquidation_reason, print_design_type,
               color, width_panna, quantity, quantity_unit, asking_price,
               supplier_phone, uploaded_images, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      args: [
        fabric_type.trim(),
        gsm         ? Number(gsm)         : null,
        content     ? content.trim()      : null,
        type        || null,
        usage       ? usage.trim()        : null,
        machine_category || null,
        job_work    || null,
        job_work_specify ? job_work_specify.trim() : null,
        liquidation_reason || null,
        print_design_type ? print_design_type.trim() : null,
        color       ? color.trim()        : null,
        width_panna ? Number(width_panna) : null,
        quantity    ? Number(quantity)    : null,
        quantity_unit || null,
        asking_price ? asking_price.trim() : null,
        supplier_phone.trim(),
        imagePaths.length ? JSON.stringify(imagePaths) : null,
      ],
    });
    res.json({ success: true, id: Number(ir.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin auth ────────────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const password = process.env.ADMIN_PASSWORD || 'crunchstock';
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colon   = decoded.indexOf(':');
    if (colon !== -1 && decoded.slice(colon + 1) === password) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="CrunchStock Admin"');
  res.status(401).send('Unauthorized');
}

// ── Admin actions ─────────────────────────────────────────────────────────────
app.post('/api/admin/listings/:id/approve', adminAuth, async (req, res) => {
  try {
    await db.execute({
      sql:  "UPDATE listings SET status = 'approved' WHERE id = ?",
      args: [req.params.id],
    });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send(esc(err.message));
  }
});

app.post('/api/admin/listings/:id/reject', adminAuth, async (req, res) => {
  try {
    const lr = await db.execute({
      sql:  'SELECT uploaded_images FROM listings WHERE id = ?',
      args: [req.params.id],
    });
    const row = lr.rows[0];
    if (row?.uploaded_images) {
      try {
        JSON.parse(row.uploaded_images).forEach(p => {
          const full = path.join(__dirname, p);
          if (fs.existsSync(full)) fs.unlinkSync(full);
        });
      } catch {}
    }
    await db.execute({ sql: 'DELETE FROM listings WHERE id = ?', args: [req.params.id] });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send(esc(err.message));
  }
});

// ── Admin page ────────────────────────────────────────────────────────────────
app.get('/admin', adminAuth, async (_req, res) => {
  try {
    const [pendingResult, reqResult, liveResult] = await Promise.all([
      db.execute("SELECT * FROM listings WHERE status = 'pending' ORDER BY created_at DESC"),
      db.execute(`
        SELECT sr.id, sr.listing_id, sr.buyer_name, sr.buyer_phone, sr.buyer_address,
               sr.created_at, l.fabric_type, l.color, l.asking_price
        FROM swatch_requests sr
        JOIN listings l ON l.id = sr.listing_id
        ORDER BY sr.created_at DESC
      `),
      db.execute("SELECT * FROM listings WHERE status = 'approved' ORDER BY id"),
    ]);

    const pending  = pendingResult.rows;
    const requests = reqResult.rows;
    const listings = liveResult.rows;

    // ── Pending listing cards ──────────────────────────────────────────────
    const pendingCards = pending.length ? pending.map(l => {
      const images = (() => { try { return l.uploaded_images ? JSON.parse(l.uploaded_images) : []; } catch { return []; } })();
      const imgStrip = images.length
        ? images.map(p => `<img src="${esc(p)}" style="height:90px;width:90px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb">`).join('')
        : '<span style="font-size:12px;color:#9ca3af">No images uploaded</span>';

      const field = (label, val) => `
        <div style="padding:8px 10px;background:#f9fafb;border-radius:6px">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">${label}</div>
          <div style="font-size:13px;font-weight:500;color:#111827">${esc(val)}</div>
        </div>`;

      return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
          <div>
            <div style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:3px">CS-${String(l.id).padStart(4,'0')} &middot; Submitted ${new Date(l.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
            <div style="font-size:20px;font-weight:800;color:#111827">${esc(l.fabric_type)}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <form method="POST" action="/api/admin/listings/${l.id}/approve">
              <button type="submit" style="background:#059669;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">Approve</button>
            </form>
            <form method="POST" action="/api/admin/listings/${l.id}/reject" onsubmit="return confirm('Reject and permanently delete this listing?')">
              <button type="submit" style="background:#fff;color:#dc2626;border:1.5px solid #dc2626;padding:8px 20px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">Reject</button>
            </form>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:14px">
          ${field('Type', l.type)}
          ${field('GSM', l.gsm)}
          ${field('Content', l.content)}
          ${field('Color', l.color)}
          ${field('Width/Panna', l.width_panna ? l.width_panna + '"' : null)}
          ${field('Quantity', l.quantity ? `${l.quantity} ${l.quantity_unit || ''}` : null)}
          ${field('Machine', l.machine_category)}
          ${field('Job Work', l.job_work ? l.job_work + (l.job_work_specify ? ' — ' + l.job_work_specify : '') : null)}
          ${field('Listing Reason', l.liquidation_reason)}
          ${field('Print / Design', l.print_design_type)}
          ${field('Usage', l.usage)}
          ${field('Asking Price', l.asking_price)}
        </div>

        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:13px;display:flex;align-items:center;gap:10px">
          <span style="font-weight:700;color:#c2410c">Supplier Phone (private):</span>
          <span style="font-family:monospace;font-size:14px;letter-spacing:.5px">${esc(l.supplier_phone)}</span>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${imgStrip}</div>
      </div>`;
    }).join('') : '<p style="color:#9ca3af;padding:12px 0;font-size:14px">No pending listings.</p>';

    // ── Swatch request rows ────────────────────────────────────────────────
    const cell    = v => `<td>${esc(v)}</td>`;
    const trReq   = r => `<tr>${['id','listing_id','fabric_type','buyer_name','buyer_phone','buyer_address','created_at'].map(c => cell(r[c])).join('')}</tr>`;
    const reqRows = requests.length
      ? requests.map(trReq).join('')
      : '<tr><td colspan="7" style="color:#9ca3af;padding:16px">No swatch requests yet.</td></tr>';

    // ── Live listing rows ──────────────────────────────────────────────────
    const listRows = listings.map(l => {
      const badge = `<span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;
        background:${l.type==='Fresh'?'#d1fae5':'#fef3c7'};
        color:${l.type==='Fresh'?'#065f46':'#92400e'}">${esc(l.type)}</span>`;
      return `<tr>
        <td>CS-${String(l.id).padStart(4,'0')}</td>
        <td>${esc(l.fabric_type)}</td>
        <td>${badge}</td>
        <td>${esc(l.gsm)}</td>
        <td>${esc(l.color)}</td>
        <td>${esc(l.quantity)} ${esc(l.quantity_unit)}</td>
        <td>${esc(l.machine_category)}</td>
        <td>${esc(l.asking_price)}</td>
      </tr>`;
    }).join('');

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>CrunchStock Admin</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#111827;background:#f9fafb}
      h1{font-size:20px;margin-bottom:4px}
      .sub{color:#6b7280;font-size:13px;margin-bottom:32px}
      h2{font-size:15px;font-weight:700;margin:32px 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;color:#111827}
      .badge-count{background:#e5e7eb;color:#374151;border-radius:20px;padding:2px 9px;font-size:12px;font-weight:600;margin-left:6px}
      .badge-pending{background:#fef3c7;color:#92400e}
      table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
      th{text-align:left;padding:10px 12px;background:#f3f4f6;font-weight:600;border-bottom:2px solid #e5e7eb;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#6b7280}
      td{padding:9px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top}
      tr:last-child td{border-bottom:none}
      tr:hover td{background:#fafafa}
    </style></head><body>

    <h1>CrunchStock — Admin</h1>
    <p class="sub">Supplier identities are masked on the public site.</p>

    <h2>Pending Listings <span class="badge-count badge-pending">${pending.length}</span></h2>
    ${pendingCards}

    <h2>Swatch Requests <span class="badge-count">${requests.length}</span></h2>
    <table>
      <tr><th>#</th><th>Listing</th><th>Fabric</th><th>Buyer Name</th><th>Phone</th><th>Address</th><th>Requested At</th></tr>
      ${reqRows}
    </table>

    <h2>Live Listings <span class="badge-count">${listings.length}</span></h2>
    <table>
      <tr><th>ID</th><th>Fabric</th><th>Type</th><th>GSM</th><th>Color</th><th>Qty</th><th>Machine</th><th>Price</th></tr>
      ${listRows}
    </table>

    </body></html>`);
  } catch (err) {
    res.status(500).send(`Error: ${esc(err.message)}`);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDb()
  .then(migrateDb)
  .then(seed)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\nCrunchStock  →  http://localhost:${PORT}`);
      console.log(`Admin panel  →  http://localhost:${PORT}/admin`);
      console.log(`Supplier     →  http://localhost:${PORT}/supplier\n`);
    });
  })
  .catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
