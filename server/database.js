import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) throw new Error('DATABASE_URL must be set to a PostgreSQL connection string')

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

const legacyStoreFile = path.resolve('data', 'store.json')

export async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
  )`)
  await pool.query('CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)')
  await pool.query(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )`)
  await pool.query('CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects (user_id, updated_at DESC)')
  await pool.query(`CREATE TABLE IF NOT EXISTS app_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['planning-report-legacy-store-import'])
    const migration = await client.query('SELECT 1 FROM app_migrations WHERE name = $1', ['legacy_json_store_import'])
    if (migration.rowCount) {
      await client.query('COMMIT')
      return
    }

    if (fs.existsSync(legacyStoreFile)) {
      const store = JSON.parse(fs.readFileSync(legacyStoreFile, 'utf8'))
      const userIds = new Map()

      for (const user of store.users || []) {
        const email = String(user.email || '').trim().toLowerCase()
        const existing = await client.query('SELECT id FROM users WHERE id = $1 OR email = $2 LIMIT 1', [user.id, email])
        let userId = existing.rows[0]?.id
        if (!userId) {
          const inserted = await client.query(
            'INSERT INTO users (id, name, email, password_hash, salt, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [user.id, user.name, email, user.passwordHash, user.salt, user.createdAt || Date.now()],
          )
          userId = inserted.rows[0].id
        }
        userIds.set(user.id, userId)
      }

      for (const session of store.sessions || []) {
        const userId = userIds.get(session.userId)
        if (!userId || Number(session.expiresAt) <= Date.now()) continue
        await client.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [session.token, userId, session.expiresAt])
      }

      for (const project of store.projects || []) {
        const userId = userIds.get(project.userId)
        if (!userId) continue
        await client.query(
          'INSERT INTO projects (id, user_id, name, report, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6) ON CONFLICT DO NOTHING',
          [project.id, userId, project.name || 'Untitled planning report', JSON.stringify(project.report || {}), project.createdAt || Date.now(), project.updatedAt || Date.now()],
        )
      }
    }

    await client.query('INSERT INTO app_migrations (name) VALUES ($1)', ['legacy_json_store_import'])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}