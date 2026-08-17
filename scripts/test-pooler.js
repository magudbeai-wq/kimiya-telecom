const { Client } = require('pg');

const regions = [
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-south-1',
  'me-central-1',
  'sa-east-1',
  'ca-central-1',
  'af-south-1',
];

async function findActivePooler() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connStr = `postgresql://postgres.ytcroarqlmzwblrsbijb:Kimiya.1122@${host}:6543/postgres`;
    console.log(`[TESTING] Checking region: ${region} (${host})...`);

    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 4000,
    });

    try {
      await client.connect();
      console.log(`\n>>> [SUCCESS] Connected successfully to pooler in region: ${region}!`);
      console.log(`>>> Connection string: ${connStr}\n`);
      await client.end();
      return connStr;
    } catch (err) {
      // failed or timeout
    }
  }
  console.log('[INFO] Pooler search finished.');
}

findActivePooler().catch(console.error);
