const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'kimiya.db');
const SCHEMA_PATH = path.resolve(__dirname, '../src/lib/db/schema.sql');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('[KIMIYA DB] Initializing database at:', DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 10000');

const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSql);

console.log('[KIMIYA DB] All 15 database tables and indexes created successfully.');
db.close();
