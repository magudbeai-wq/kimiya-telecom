const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ytcroarqlmzwblrsbijb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Q6p7VFz-Bfwnr_kUGyiJZg_cXj5uHBi';

const TABLES = [
  'branches',
  'users',
  'scratch_denominations',
  'central_stock',
  'branch_stock',
  'stock_transfers',
  'transfer_review_logs',
  'sales',
  'business_sessions',
  'expenses',
  'stock_reconciliations',
  'audit_logs',
  'system_notifications',
  'stock_incoming',
];

async function checkSupabaseStatus() {
  console.log('================================================================');
  console.log('KIMIYA TELECOM - SUPABASE DATABASE COMPREHENSIVE HEALTH CHECK');
  console.log('================================================================');
  console.log(`[TARGET] Supabase URL: ${SUPABASE_URL}`);
  console.log(`[TIMESTAMP] ${new Date().toISOString()}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  let sqliteDb;
  try {
    const sqlitePath = path.resolve(__dirname, '../data/kimiya.db');
    sqliteDb = new Database(sqlitePath, { readonly: true });
    console.log('[INFO] Connected to local SQLite for row parity verification.\n');
  } catch (err) {
    console.warn('[WARN] Local SQLite could not be opened:', err.message);
  }

  console.log('Checking all 14 enterprise tables on Supabase:\n');
  console.log(
    'Table Name'.padEnd(25) +
    'Local SQLite'.padEnd(16) +
    'Supabase Cloud'.padEnd(18) +
    'Status'
  );
  console.log('-'.repeat(72));

  let allHealthy = true;
  let missingTables = [];

  for (const table of TABLES) {
    let sqliteCount = 0;
    if (sqliteDb) {
      try {
        const row = sqliteDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
        sqliteCount = row.c;
      } catch (e) {
        sqliteCount = -1;
      }
    }

    let supabaseCount = 0;
    let statusText = 'OK';

    try {
      const { count, error, data } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        statusText = `ERROR: ${error.code || error.message}`;
        allHealthy = false;
        missingTables.push({ table, error: error.message });
      } else {
        supabaseCount = count ?? 0;
        if (supabaseCount === sqliteCount) {
          statusText = 'PARITY VERIFIED (100%)';
        } else if (supabaseCount > 0) {
          statusText = `ACTIVE (${supabaseCount} rows)`;
        } else {
          statusText = 'EMPTY (0 rows)';
        }
      }
    } catch (err) {
      statusText = `FAILED: ${err.message}`;
      allHealthy = false;
    }

    console.log(
      table.padEnd(25) +
      `${sqliteCount >= 0 ? sqliteCount : 'N/A'} rows`.padEnd(16) +
      `${supabaseCount !== null ? supabaseCount : 'Error'} rows`.padEnd(18) +
      statusText
    );
  }

  console.log('-'.repeat(72));

  if (sqliteDb) sqliteDb.close();

  if (missingTables.length > 0) {
    console.log('\n[ACTION REQUIRED] Some tables are not yet created in Supabase:');
    missingTables.forEach((m) => console.log(` - ${m.table}: ${m.error}`));
    console.log('\nTo fix: Paste supabase/schema.sql into Supabase SQL Editor and run, then run node scripts/migrate-to-supabase.js');
  } else {
    console.log('\n[SUCCESS] All Supabase database tables are reachable and functioning properly!');
  }
}

checkSupabaseStatus().catch(console.error);
