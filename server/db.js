// src/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// <<< THIS IS THE FIX <<<
const dbDir = path.join(__dirname, '../db');
const storageDir = path.join(__dirname, '../storage');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created missing folder: ./db');
}
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
  console.log('Created missing folder: ./storage');
}
// >>>>>>>>>>>>>>>>>>>>>>>>

const dbPath = path.join(dbDir, 'files.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite connection error:', err);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database:', dbPath);
  }
});

db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL;`);        // important for concurrency
  db.run(`PRAGMA synchronous = NORMAL;`);

db.run(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    path TEXT NOT NULL UNIQUE
  )
`);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      quota_bytes INTEGER DEFAULT 1073741824,  -- 1 GB
      used_bytes INTEGER DEFAULT 0
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_user ON files(user_id)`);
});

module.exports = db;