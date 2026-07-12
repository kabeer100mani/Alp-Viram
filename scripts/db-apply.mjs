// Apply a single SQL migration file to the database, transactionally.
// Usage: PGHOST=... PGPASSWORD=... node scripts/db-apply.mjs <path-to-sql>
// Connection is passed via PG* env vars (object config) so passwords with
// special characters like '#' are handled literally (no URL parsing).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const rel = process.argv[2]
if (!rel) {
  console.error('usage: node scripts/db-apply.mjs <migration.sql>')
  process.exit(1)
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, rel), 'utf8')

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  await client.query('begin')
  await client.query(sql)
  await client.query('commit')
  console.log('✅ applied ' + rel)
} catch (err) {
  await client.query('rollback')
  console.error('❌ failed, rolled back:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
