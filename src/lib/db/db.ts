import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Global database instance caching for Next.js hot reload in development
declare global {
  // eslint-disable-next-line no-var
  var __kimiya_db: Database.Database | undefined;
}

function resolveDbPath(): string {
  // Check if running in a serverless read-only environment (e.g., Vercel)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = '/tmp';
    const tmpDbPath = path.join(tmpDir, 'kimiya.db');

    if (!fs.existsSync(tmpDbPath)) {
      const localDb = path.resolve(process.cwd(), 'data', 'kimiya.db');
      if (fs.existsSync(localDb)) {
        try {
          fs.copyFileSync(localDb, tmpDbPath);
        } catch (err) {
          console.error('[KIMIYA DB] Failed to copy bundled database to /tmp:', err);
        }
      }
    }
    return tmpDbPath;
  }

  const dbDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const backupsDir = path.join(dbDir, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    return path.join(dbDir, 'kimiya.db');
  } catch {
    return path.join('/tmp', 'kimiya.db');
  }
}

export function getDatabase(): Database.Database {
  if (global.__kimiya_db) {
    return global.__kimiya_db;
  }

  const dbPath = resolveDbPath();
  const dbInstance = new Database(dbPath);

  // Critical SQLite Pragmas for High Concurrency, ACID safety, and Integrity
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const journalMode = isServerless ? 'DELETE' : 'WAL';
  dbInstance.pragma(`journal_mode = ${journalMode}`);
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 10000'); // 10 seconds wait on concurrent locks

  // Auto-initialize schema & root admin user if database is newly initialized
  try {
    const userTableCheck = dbInstance
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get();

    if (!userTableCheck) {
      const schemaPath = path.resolve(process.cwd(), 'src/lib/db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        dbInstance.exec(schemaSql);
      }
    }

    const adminUser = dbInstance
      .prepare("SELECT * FROM users WHERE LOWER(username) = 'kimiya.telecom'")
      .get();

    if (!adminUser) {
      const defaultHash = bcrypt.hashSync('Kimiya@112233', 10);
      dbInstance.prepare(`
        INSERT OR REPLACE INTO users (
          id, username, full_name, email, password_hash, role, branch_id, status, created_at
        ) VALUES (
          'USER-ADMIN-01', 'Kimiya.telecom', 'Kimiya Telecom Administrator',
          'admin@kimiya.com', ?, 'ADMIN', NULL, 'ACTIVE', datetime('now', '+3 hours')
        )
      `).run(defaultHash);
    }
  } catch (initErr) {
    console.error('[KIMIYA DB] Initialization verification error:', initErr);
  }

  if (process.env.NODE_ENV !== 'production') {
    global.__kimiya_db = dbInstance;
  }

  return dbInstance;
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
