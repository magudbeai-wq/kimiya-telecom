const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:Kimiya.1122@db.ytcroarqlmzwblrsbijb.supabase.co:5432/postgres';

async function initSupabaseDb() {
  console.log('================================================================');
  console.log('INITIALIZING SUPABASE POSTGRESQL PRODUCTION DATABASE SCHEMA');
  console.log('================================================================\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    console.log('[INFO] Connected to Supabase PostgreSQL successfully.');
    
    const schemaSqlPath = path.resolve(__dirname, '../supabase/schema.sql');
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');

    console.log('[INFO] Executing schema DDL (15 tables & indexes)...');
    await client.query(sql);
    console.log('[SUCCESS] Schema successfully executed on Supabase!\n');

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);

    console.log(`[VERIFICATION] Found ${res.rows.length} public tables in Supabase:`);
    res.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.table_name}`);
    });
  } catch (err) {
    console.error('[ERROR] Failed to initialize Supabase database:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initSupabaseDb().catch(console.error);
