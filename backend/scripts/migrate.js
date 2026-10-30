// Runs every .sql file in migrations/ in filename order.
// Each migration is written to be safe to run more than once.
// Usage: npm run migrate
//
// There's no table tracking which migrations ran, so every file runs every
// time. When adding a migration, name it 002_..., 003_... and make it safe
// to re-run (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, etc.).
const fs = require('fs')
const path = require('path')
const pool = require('../db')

async function migrate() {
  const dir = path.join(__dirname, '..', 'migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    await pool.query(sql)
    console.log(`Applied ${file}`)
  }
}

migrate()
  .catch(error => {
    console.error('Migration failed:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
