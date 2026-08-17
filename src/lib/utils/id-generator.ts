import { getDatabase } from '../db/db';

/**
 * Generates an Africa/Addis_Ababa formatted date string YYYYMMDD
 */
export function getAddisAbabaDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 'en-CA' outputs YYYY-MM-DD
  const formatted = formatter.format(date);
  return formatted.replace(/-/g, '');
}

/**
 * Returns current timestamp formatted as ISO in Africa/Addis_Ababa (+03:00)
 */
export function getAddisAbabaTimestamp(): string {
  const now = new Date();
  // Compute local Addis Ababa time (+03:00 offset)
  const addisOffsetMs = 3 * 60 * 60 * 1000;
  const localTime = new Date(now.getTime() + addisOffsetMs + now.getTimezoneOffset() * 60000);
  return localTime.toISOString().replace('Z', '+03:00').replace('T', ' ').substring(0, 19);
}

/**
 * Formats a Date to YYYY-MM-DD for business dates
 */
export function getAddisAbabaBusinessDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Atomic generator for sequential human-readable IDs:
 * - IN-SIM-YYYYMMDD-XXXX
 * - IN-SC-YYYYMMDD-XXXX
 * - SIM-TR-YYYYMMDD-XXXX
 * - SC-TR-YYYYMMDD-XXXX
 * - SALE-YYYYMMDD-XXXX
 * - EXP-YYYYMMDD-XXXX
 * - SESSION-YYYYMMDD-BRCODE-XXXX
 */
export function generateTransactionId(
  prefix: 'IN-SIM' | 'IN-SC' | 'SIM-TR' | 'SC-TR' | 'SALE' | 'EXP' | 'SESSION',
  branchCode?: string
): string {
  const db = getDatabase();
  const dateStr = getAddisAbabaDateString();

  let searchPrefix = `${prefix}-${dateStr}`;
  if (prefix === 'SESSION' && branchCode) {
    const cleanCode = branchCode.toUpperCase().substring(0, 4);
    searchPrefix = `SESSION-${dateStr}-${cleanCode}`;
  }

  // Count existing records matching this prefix for today to get next sequential number
  let count = 0;
  if (prefix === 'IN-SIM' || prefix === 'IN-SC') {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM incoming_stock WHERE id LIKE ?')
      .get(`${searchPrefix}-%`) as { count: number };
    count = row?.count || 0;
  } else if (prefix === 'SIM-TR' || prefix === 'SC-TR') {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM stock_transfers WHERE id LIKE ?')
      .get(`${searchPrefix}-%`) as { count: number };
    count = row?.count || 0;
  } else if (prefix === 'SALE') {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM sales WHERE id LIKE ?')
      .get(`${searchPrefix}-%`) as { count: number };
    count = row?.count || 0;
  } else if (prefix === 'EXP') {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM expenses WHERE id LIKE ?')
      .get(`${searchPrefix}-%`) as { count: number };
    count = row?.count || 0;
  } else if (prefix === 'SESSION') {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM business_sessions WHERE id LIKE ?')
      .get(`${searchPrefix}-%`) as { count: number };
    count = row?.count || 0;
  }

  const nextSeq = String(count + 1).padStart(4, '0');
  return `${searchPrefix}-${nextSeq}`;
}
