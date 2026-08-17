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

  const tables = [
    { name: 'scratch_denominations', pk: 'id' },
    { name: 'branches', pk: 'id' },
    { name: 'users', pk: 'id' },
    { name: 'central_stock', pk: 'id' },
    { name: 'branch_stock', pk: 'id' },
    { name: 'stock_incoming', pk: 'id' },
    { name: 'stock_transfers', pk: 'id' },
    { name: 'stock_ledger', pk: 'id' },
    { name: 'business_sessions', pk: 'id' },
    { name: 'sales', pk: 'id' },
    { name: 'expenses', pk: 'id' },
    { name: 'system_notifications', pk: 'id' },
    { name: 'audit_logs', pk: 'id' },
    { name: 'database_backups', pk: 'id' },
  ];

  let totalMigratedRows = 0;

  for (const t of tables) {
    const rows = sqlite.prepare(`SELECT * FROM ${t.name}`).all();
    console.log(`[MIGRATING] Table '${t.name}': Found ${rows.length} rows in SQLite...`);

    if (rows.length === 0) {
      console.log(`  -> 0 rows to transfer.`);
      continue;
    }

    // Format boolean and json fields if necessary
    const formattedRows = rows.map((r) => {
      const copy = { ...r };
      if (t.name === 'scratch_denominations' && typeof copy.is_active === 'number') {
        copy.is_active = Boolean(copy.is_active);
      }
      if (t.name === 'system_notifications' && typeof copy.is_read === 'number') {
        copy.is_read = Boolean(copy.is_read);
      }
      if (t.name === 'audit_logs') {
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
      const { data, error } = await supabase.from(t.name).upsert(chunk, { onConflict: t.pk });

      if (error) {
        console.error(`  [ERROR] Upsert failed for table '${t.name}':`, error.message);
        console.error('  Details:', error);
      } else {
        totalMigratedRows += chunk.length;
        console.log(`  -> Successfully upserted ${chunk.length} rows into Supabase '${t.name}'`);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`MIGRATION SUMMARY: Transferred ${totalMigratedRows} total records to Supabase.`);
  console.log('================================================================\n');

  sqlite.close();
}

migrateData().catch(console.error);
