import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const DB_PATH = process.env.DATABASE_URL || './data/app.db';
const STATIC_HOTEL_PATH = process.env.STATIC_HOTEL_PATH || './client-hotel';
const STATIC_SECURITY_PATH = process.env.STATIC_SECURITY_PATH || './client-security';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  }
}));

// Ensure dirs
fs.mkdirSync('./data', { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// DB
let db;
async function getDb() {
  if (!db) db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  return db;
}

// Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { hotelCode, reportDate } = req.body;
    const dir = path.join(UPLOAD_DIR, (reportDate || 'unknown'), (hotelCode || 'unknown'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, fname);
  }
});
const upload = multer({ storage });

// Health
app.get('/api/v1/health', (req, res) => res.json({ ok: true }));

// Begin report
app.post('/api/v1/reports/begin', async (req, res) => {
  try {
    const { hotelCode, hotelName, reportDate } = req.body;
    if (!hotelCode || !hotelName || !reportDate) return res.status(400).json({ error: 'hotelCode, hotelName, reportDate required' });
    const dbh = await getDb();
    const existing = await dbh.get('SELECT * FROM reports WHERE hotel_code=? AND report_date=?', [hotelCode, reportDate]);
    if (existing) {
      return res.json({ reportId: existing.id, status: existing.status });
    }
    const r = await dbh.run('INSERT INTO reports(hotel_name, hotel_code, report_date, status, received_at) VALUES(?,?,?,?,datetime("now"))',
      [hotelName, hotelCode, reportDate, 'Pending']);
    res.json({ reportId: r.lastID, status: 'Pending' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Upload image
app.post('/api/v1/images', upload.single('image'), async (req, res) => {
  try {
    const { reportId, hotelCode, reportDate, capturedAtISO, overlayText } = req.body;
    if (!req.file) return res.status(400).json({ error: 'image required' });
    if (!reportId || !hotelCode || !reportDate || !capturedAtISO || !overlayText) {
      return res.status(400).json({ error: 'missing fields' });
    }
    const overlayRe = /^\d{1,2}:\d{2}\s(AM|PM)\s–\s[A-Za-z]+,\s\d{1,2}\s[A-Za-z]{3}\s\d{4}$/;
    if (!overlayRe.test(overlayText)) {
      return res.status(400).json({ error: 'invalid overlayText format', overlayText });
    }
    const dbh = await getDb();
    const rep = await dbh.get('SELECT * FROM reports WHERE id=? AND hotel_code=? AND report_date=?', [reportId, hotelCode, reportDate]);
    if (!rep) return res.status(404).json({ error: 'report not found for hotel/date' });
    const relPath = path.relative('.', req.file.path).replaceAll('\\', '/');
    const r = await dbh.run('INSERT INTO images(report_id, s3_key, captured_at_iso, overlay_text, size_bytes) VALUES(?,?,?,?,?)',
      [reportId, relPath, capturedAtISO, overlayText, req.file.size]);
    res.json({ imageId: r.lastID, path: '/' + relPath });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Finalize
app.post('/api/v1/reports/finalize', async (req, res) => {
  try {
    const { reportId } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId required' });
    const dbh = await getDb();
    const count = await dbh.get('SELECT COUNT(*) as c FROM images WHERE report_id=?', [reportId]);
    await dbh.run('UPDATE reports SET status=?, total_count=? WHERE id=?', ['Complete', count.c, reportId]);
    res.json({ status: 'Complete', totalCount: count.c, reportId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// List
app.get('/api/v1/reports', async (req, res) => {
  try {
    const { date, hotelCode } = req.query;
    const dbh = await getDb();
    let q = 'SELECT * FROM reports WHERE 1=1';
    const params = [];
    if (date) { q += ' AND report_date=?'; params.push(date); }
    if (hotelCode) { q += ' AND hotel_code=?'; params.push(hotelCode); }
    q += ' ORDER BY report_date DESC, id DESC';
    const rows = await dbh.all(q, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Detail
app.get('/api/v1/reports/:id', async (req, res) => {
  try {
    const dbh = await getDb();
    const report = await dbh.get('SELECT * FROM reports WHERE id=?', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'not_found' });
    const images = await dbh.all('SELECT id, s3_key, captured_at_iso, overlay_text, size_bytes FROM images WHERE report_id=? ORDER BY id', [req.params.id]);
    res.json({ report, images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Manifest
app.get('/api/v1/reports/:id/manifest', async (req, res) => {
  try {
    const dbh = await getDb();
    const report = await dbh.get('SELECT * FROM reports WHERE id=?', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'not_found' });
    const images = await dbh.all('SELECT id, s3_key, captured_at_iso, overlay_text, size_bytes FROM images WHERE report_id=? ORDER BY id', [req.params.id]);
    res.json({ report, images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Static serving (demo)
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/hotel', express.static(STATIC_HOTEL_PATH));
app.use('/security', express.static(STATIC_SECURITY_PATH));

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><meta charset="utf-8"><title>Hotel ID Security</title></head>
      <body style="font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu; padding:24px">
        <h1>Hotel ID Security (MVP)</h1>
        <p><a href="/hotel">Hotel App</a> | <a href="/security">Security Dashboard</a></p>
        <p>Health: <code>/api/v1/health</code></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
