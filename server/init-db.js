import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const DB_PATH = process.env.DATABASE_URL || './data/app.db';

async function main() {
  fs.mkdirSync('./data', { recursive: true });
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hotel_name TEXT NOT NULL,
      hotel_code TEXT NOT NULL,
      report_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      total_count INTEGER DEFAULT 0,
      received_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      s3_key TEXT NOT NULL,
      captured_at_iso TEXT NOT NULL,
      overlay_text TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );
  `);
  console.log('Database initialized at', DB_PATH);
  await db.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
