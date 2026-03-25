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
      name       TEXT    NOT NULL,
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
    "ALTER TABLE sales     ADD COLUMN notes    TEXT DEFAULT ''",
    // Indexes for performance
    "CREATE INDEX IF NOT EXISTS idx_sales_date    ON sales(date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(payment)",
    "CREATE INDEX IF NOT EXISTS idx_sales_udhaar  ON sales(udhaar_paid) WHERE payment='udhaar'",
    "CREATE INDEX IF NOT EXISTS idx_inv_name      ON inventory(name)",
    "CREATE INDEX IF NOT EXISTS idx_inv_stock     ON inventory(stock)",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }

  // Remove UNIQUE constraint on name — allow same part from different companies
  // SQLite doesn't support DROP CONSTRAINT, so we recreate the table
  try {
    const info = await db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='inventory'");
    const ddl  = String((info.rows[0] as Record<string, unknown>)?.sql || '');
    if (ddl.includes('UNIQUE') && ddl.toUpperCase().includes('NAME')) {
      await db.executeMultiple(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE IF NOT EXISTS inventory_new (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL,
          sku        TEXT    DEFAULT '',
          category   TEXT    DEFAULT '',
          stock      INTEGER NOT NULL DEFAULT 0,
          price      REAL    NOT NULL DEFAULT 0,
          buy_price  REAL    NOT NULL DEFAULT 0,
          company    TEXT    NOT NULL DEFAULT '',
          created_at TEXT    DEFAULT (datetime('now','localtime'))
        );
        INSERT OR IGNORE INTO inventory_new SELECT * FROM inventory;
        DROP TABLE inventory;
        ALTER TABLE inventory_new RENAME TO inventory;
        PRAGMA foreign_keys=ON;
      `);
    }
  } catch { /* already migrated */ }
}

export default db;
