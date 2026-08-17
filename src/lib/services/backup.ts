import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDatabase } from '../db/db';
import { BackupRecord } from '../types';
import { getAddisAbabaTimestamp } from '../utils/id-generator';

const BACKUPS_DIR = path.resolve(process.cwd(), 'data', 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export class BackupService {
  /**
   * Take an automated snapshot of the SQLite database using SQLite's online backup API
   */
  static async createBackup(): Promise<BackupRecord> {
    const db = getDatabase();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `kimiya_backup_${timestampStr}.db`;
    const destPath = path.join(BACKUPS_DIR, fileName);

    // Perform SQLite online backup
    await db.backup(destPath);

    // Calculate SHA-256 Checksum
    const fileBuffer = fs.readFileSync(destPath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileSizeBytes = fileBuffer.length;

    // Gather record counts for verification
    const recordCounts: Record<string, number> = {};
    const tables = [
      'branches',
      'users',
      'scratch_denominations',
      'central_stock',
      'branch_stock',
      'stock_transfers',
      'incoming_stock',
      'business_sessions',
      'sales',
      'expenses',
      'stock_ledger',
      'notifications',
      'audit_logs',
      'system_settings',
    ];

    for (const table of tables) {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      recordCounts[table] = row?.count || 0;
    }

    const backupId = `BKP-${timestampStr}`;

    db.prepare(`
      INSERT INTO backups (
        id, file_name, file_size_bytes, record_counts, checksum, status, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'SUCCESS', datetime('now', '+3 hours')
      )
    `).run(
      backupId,
      fileName,
      fileSizeBytes,
      JSON.stringify(recordCounts),
      checksum
    );

    return {
      id: backupId,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      record_counts: JSON.stringify(recordCounts),
      checksum,
      status: 'SUCCESS',
      created_at: getAddisAbabaTimestamp(),
    };
  }

  /**
   * Verify a backup by restoring it into a sandbox database and running integrity checks
   */
  static verifyRestore(backupId: string): {
    verified: boolean;
    backupId: string;
    integrityCheck: string;
    foreignKeyErrors: number;
    tableCounts: Record<string, { expected: number; restored: number; match: boolean }>;
  } {
    const db = getDatabase();
    const backupRecord = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId) as
      | BackupRecord
      | undefined;

    if (!backupRecord) {
      throw new Error(`Backup record #${backupId} not found.`);
    }

    const backupFilePath = path.join(BACKUPS_DIR, backupRecord.file_name);
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file ${backupRecord.file_name} does not exist on disk.`);
    }

    // Verify SHA-256 Checksum matches recorded hash
    const fileBuffer = fs.readFileSync(backupFilePath);
    const currentChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (currentChecksum !== backupRecord.checksum) {
      throw new Error('Backup integrity error: SHA-256 checksum mismatch.');
    }

    // Open restored database in sandbox mode
    const sandboxDb = new Database(backupFilePath, { readonly: true });
    try {
      // 1. Run PRAGMA integrity_check
      const integrityRow = sandboxDb.prepare('PRAGMA integrity_check;').get() as {
        integrity_check: string;
      };
      const integrityCheck = integrityRow.integrity_check;

      // 2. Run PRAGMA foreign_key_check
      const fkRows = sandboxDb.prepare('PRAGMA foreign_key_check;').all();
      const foreignKeyErrors = fkRows.length;

      // 3. Verify table counts match snapshot
      const expectedCounts: Record<string, number> = JSON.parse(backupRecord.record_counts);
      const tableCounts: Record<string, { expected: number; restored: number; match: boolean }> = {};
      let allMatch = true;

      for (const [table, expected] of Object.entries(expectedCounts)) {
        const row = sandboxDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
          count: number;
        };
        const restored = row?.count || 0;
        const match = restored === expected;
        if (!match) allMatch = false;

        tableCounts[table] = {
          expected,
          restored,
          match,
        };
      }

      const verified = integrityCheck === 'ok' && foreignKeyErrors === 0 && allMatch;

      // Update backup status in main database
      if (verified) {
        db.prepare("UPDATE backups SET status = 'VERIFIED' WHERE id = ?").run(backupId);
      }

      return {
        verified,
        backupId,
        integrityCheck,
        foreignKeyErrors,
        tableCounts,
      };
    } finally {
      sandboxDb.close();
    }
  }

  /**
   * List all backups
   */
  static getBackups(): BackupRecord[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all() as BackupRecord[];
  }
}
