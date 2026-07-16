import fs from 'fs';
import path from 'path';
import pg from 'pg';

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const envPath = path.join(projectRoot, '.env');
const chunkDir = path.join(projectRoot, 'prisma/seed_chunks');
const batchDir = path.join(projectRoot, 'seed_batches');

function loadEnv() {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.slice('DATABASE_URL='.length).replace(/\?.*$/, '');
    }
  }
  throw new Error('DATABASE_URL not found');
}

async function main() {
  const client = new pg.Client({ connectionString: loadEnv(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  const results = [];

  // Chunk 00: original multi-statement file
  const chunk00 = fs.readFileSync(path.join(chunkDir, '00.sql'), 'utf8');
  try {
    await client.query(chunk00);
    results.push({ chunk: '00', status: 'OK', error: null });
  } catch (e) {
    results.push({ chunk: '00', status: 'FAIL', error: e.message });
  }

  // Chunks 01-17: batched files
  for (let n = 1; n <= 17; n++) {
    const prefix = `${String(n).padStart(2, '0')}_`;
    const files = fs.readdirSync(batchDir).filter((f) => f.startsWith(prefix) && f.endsWith('.sql')).sort();
    let chunkFailed = false;
    let chunkError = null;
    for (const file of files) {
      const sql = fs.readFileSync(path.join(batchDir, file), 'utf8');
      try {
        await client.query(sql);
      } catch (e) {
        chunkFailed = true;
        chunkError = `${file}: ${e.message}`;
        break;
      }
    }
    results.push({ chunk: String(n).padStart(2, '0'), status: chunkFailed ? 'FAIL' : 'OK', error: chunkError });
  }

  const countRes = await client.query(`
    SELECT (SELECT count(*) FROM users) as users,
           (SELECT count(*) FROM assets) as assets,
           (SELECT count(*) FROM asset_prices) as prices,
           (SELECT count(*) FROM portfolio_daily_snapshots) as snaps,
           (SELECT count(*) FROM analysis_insights) as insights;
  `);
  await client.end();

  const out = { results, counts: countRes.rows[0] };
  fs.writeFileSync(path.join(projectRoot, 'seed_results.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
