import fs from 'fs';
import path from 'path';
import { getDatabase } from './db';

export function runMigrations(): void {
  const db = getDatabase();
  const schemaPath = path.resolve(process.cwd(), 'src/lib/db/schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  // Execute schema definitions
  db.exec(schemaSql);
  console.log('[KIMIYA DB] Database migrations executed successfully.');
}
