import { createClient, type Client } from '@libsql/client';
import path from 'path';

declare global { var _db: Client | undefined; }

function makeClient(): Client {
  if (process.env.NODE_ENV !== 'production') {
    return createClient({ url: `file:${path.join(process.cwd(), 'garagebook.db')}` });
  }
  if (!process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL missing');
  if (!process.env.TURSO_AUTH_TOKEN)   throw new Error('TURSO_AUTH_TOKEN missing');
  return createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
}

const db: Client = global._db ?? makeClient();
if (process.env.NODE_ENV !== 'production') global._db = db;

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS inventory (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      sku        TEXT    DEFAULT '',
      category   TEXT    DEFAULT '',
      stock      INTEGER NOT NULL DEFAULT 0,
      price      REAL    NOT NULL DEFAULT 0,
      buy_price  REAL    NOT NULL DEFAULT 0,
      company    TEXT    NOT NULL DEFAULT '',
      created_at TEXT    DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT DEFAULT '',
      address    TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS sales (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
      item_name   TEXT    NOT NULL,
      qty         INTEGER NOT NULL,
      amount      REAL    NOT NULL,
      buy_price   REAL    NOT NULL DEFAULT 0,
      payment     TEXT    NOT NULL CHECK(payment IN ('cash','online','udhaar')),
      customer    TEXT    DEFAULT 'Walk-in',
      phone       TEXT    DEFAULT '',
      date        TEXT    DEFAULT (datetime('now','localtime')),
      udhaar_paid INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS returns (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id   INTEGER REFERENCES sales(id) ON DELETE SET NULL,
      item_id   INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
      item_name TEXT    NOT NULL,
      qty       INTEGER NOT NULL,
      amount    REAL    NOT NULL,
      reason    TEXT    DEFAULT '',
      date      TEXT    DEFAULT (datetime('now','localtime'))
    );
  `);
  // Safe migrations
  const migrations = [
    "ALTER TABLE inventory ADD COLUMN company  TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE inventory ADD COLUMN sku      TEXT DEFAULT ''",
    "ALTER TABLE inventory ADD COLUMN category TEXT DEFAULT ''",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
}

export default db;
