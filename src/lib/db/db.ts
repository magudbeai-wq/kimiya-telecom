import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'kimiya.db');
const BACKUPS_DIR = path.join(DB_DIR, 'backups');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Global database instance caching for Next.js hot reload in development
declare global {
  // eslint-disable-next-line no-var
  var __kimiya_db: Database.Database | undefined;
}

export function getDatabase(): Database.Database {
  if (global.__kimiya_db) {
    return global.__kimiya_db;
  }

  const db = new Database(DB_PATH, {
    // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Critical SQLite Pragmas for High Concurrency, ACID safety, and Integrity
  // In Vercel serverless / build trace, avoid -shm/-wal transient files with DELETE mode
  const journalMode = process.env.VERCEL ? 'DELETE' : 'WAL';
  db.pragma(`journal_mode = ${journalMode}`);
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 10000'); // 10 seconds wait on concurrent locks

  if (process.env.NODE_ENV !== 'production') {
    global.__kimiya_db = db;
  }

  return db;
}

export const db = getDatabase();

/**
 * Execute an immediate atomic transaction.
 * In SQLite, 'BEGIN IMMEDIATE' acquires the write lock right away,
 * preventing deadlock / race conditions between simultaneous writers.
 */
export function runImmediateTransaction<T>(callback: (dbInstance: Database.Database) => T): T {
  const instance = getDatabase();
  return instance.transaction(() => {
    return callback(instance);
  }).immediate();
}

export default db;
