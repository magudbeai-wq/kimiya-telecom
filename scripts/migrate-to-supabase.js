const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ytcroarqlmzwblrsbijb.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Q6p7VFz-Bfwnr_kUGyiJZg_cXj5uHBi';

const DB_PATH = path.resolve(__dirname, '../data/kimiya.db');

async function migrateData() {
  console.log('================================================================');
  console.log('KIMIYA TELECOM -> SUPABASE POSTGRESQL ZERO-DATA-LOSS MIGRATION');
  console.log('================================================================\n');

  console.log(`[INFO] Connecting to Supabase at: ${SUPABASE_URL}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const sqlite = new Database(DB_PATH);

  // Migration mapping (local table -> remote Supabase table)
  const migrationMap = [
    { sqliteTable: 'scratch_denominations', supabaseTable: 'scratch_denominations', pk: 'id' },
    { sqliteTable: 'branches', supabaseTable: 'branches', pk: 'id' },
    { sqliteTable: 'users', supabaseTable: 'users', pk: 'id' },
    { sqliteTable: 'central_stock', supabaseTable: 'central_stock', pk: 'id' },
    { sqliteTable: 'branch_stock', supabaseTable: 'branch_stock', pk: 'id' },
    { sqliteTable: 'incoming_stock', supabaseTable: 'stock_incoming', pk: 'id' },
    { sqliteTable: 'stock_transfers', supabaseTable: 'stock_transfers', pk: 'id' },
    { sqliteTable: 'stock_ledger', supabaseTable: 'stock_ledger', pk: 'id' },
    { sqliteTable: 'business_sessions', supabaseTable: 'business_sessions', pk: 'id' },
    { sqliteTable: 'sales', supabaseTable: 'sales', pk: 'id' },
    { sqliteTable: 'expenses', supabaseTable: 'expenses', pk: 'id' },
    { sqliteTable: 'notifications', supabaseTable: 'system_notifications', pk: 'id' },
    { sqliteTable: 'audit_logs', supabaseTable: 'audit_logs', pk: 'id' },
    { sqliteTable: 'database_backups', supabaseTable: 'database_backups', pk: 'id' },
  ];

  let totalMigratedRows = 0;

  for (const m of migrationMap) {
    let rows = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM ${m.sqliteTable}`).all();
    } catch (e) {
      console.log(`[SKIP] Local table '${m.sqliteTable}' does not exist or has 0 rows.`);
      continue;
    }

    console.log(`[MIGRATING] '${m.sqliteTable}' -> Supabase '${m.supabaseTable}' (${rows.length} rows)...`);

    if (rows.length === 0) {
      console.log(`  -> 0 rows to transfer.`);
      continue;
    }

    // Format boolean and json fields
    const formattedRows = rows.map((r) => {
      const copy = { ...r };
      if (m.supabaseTable === 'scratch_denominations' && typeof copy.is_active === 'number') {
        copy.is_active = Boolean(copy.is_active);
      }
      if (m.supabaseTable === 'system_notifications' && typeof copy.is_read === 'number') {
        copy.is_read = Boolean(copy.is_read);
      }
      if (m.supabaseTable === 'audit_logs') {
        if (copy.old_values && typeof copy.old_values === 'string') {
          try { copy.old_values = JSON.parse(copy.old_values); } catch (e) {}
        }
        if (copy.new_values && typeof copy.new_values === 'string') {
          try { copy.new_values = JSON.parse(copy.new_values); } catch (e) {}
        }
      }
      return copy;
    });

    // Batch upsert into Supabase in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < formattedRows.length; i += chunkSize) {
      const chunk = formattedRows.slice(i, i + chunkSize);
      const { error } = await supabase.from(m.supabaseTable).upsert(chunk, { onConflict: m.pk });

      if (error) {
        console.error(`  [ERROR] Upsert failed for '${m.supabaseTable}':`, error.message);
      } else {
        totalMigratedRows += chunk.length;
        console.log(`  -> Successfully upserted ${chunk.length} rows into Supabase '${m.supabaseTable}'`);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`MIGRATION SUMMARY: Transferred ${totalMigratedRows} total records to Supabase.`);
  console.log('================================================================\n');

  sqlite.close();
}

migrateData().catch(console.error);
