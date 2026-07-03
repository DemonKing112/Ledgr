/* ──────────────────────────────────────────────────────────────
   DATABASE SCHEMA
   Sets up all the tables Ledgr needs.  Uses SQLite via sql.js
   (pure WebAssembly — no C++ compiler required).
   Structured so it can be swapped to Postgres later.

   The module exports an object with the same .prepare() / .exec()
   API as better-sqlite3, so route files work unchanged.
   Call db.initDb() once at startup before handling requests.
   ────────────────────────────────────────────────────────────── */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/* Resolve DB_PATH relative to the backend directory, not the cwd */
const backendDir = path.join(__dirname, '..');
const rawDbPath = process.env.DB_PATH || './ledgr.db';
const DB_PATH = path.isAbsolute(rawDbPath) ? rawDbPath : path.join(backendDir, rawDbPath);

/* ── Internal state ──────────────────────────────────────────── */
let rawDb = null;   // The sql.js Database instance
let dbPath = null;  // Where to save the file

/* ── Persist the in-memory database to disk ──────────────────── */
let autoSave = true;

function saveToDisk() {
  if (!autoSave || !dbPath) return;
  const data = rawDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function forceSave() {
  if (!dbPath || !rawDb) return;
  const data = rawDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

/* ── Statement wrapper ───────────────────────────────────────
   Mimics better-sqlite3's prepared-statement API so that
   route files can call .run(), .get(), and .all() the same way. */

class StatementWrapper {
  constructor(sql) {
    this.sql = sql;
  }

  /* Execute an INSERT / UPDATE / DELETE and return metadata */
  run(...params) {
    rawDb.run(this.sql, params);
    const idResult = rawDb.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowid = idResult.length > 0 ? idResult[0].values[0][0] : 0;
    const changes = rawDb.getRowsModified();
    saveToDisk();
    return { lastInsertRowid, changes };
  }

  /* Execute a SELECT and return the first row (or undefined) */
  get(...params) {
    const stmt = rawDb.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    let result;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  /* Execute a SELECT and return all rows as an array */
  all(...params) {
    const stmt = rawDb.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

/* ── Public API (matches better-sqlite3's interface) ─────────── */
const db = {
  /* Call this once before the server starts accepting requests */
  async initDb() {
    const SQL = await initSqlJs();
    dbPath = DB_PATH;

    /* Load existing DB file if one exists, otherwise start fresh */
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      rawDb = new SQL.Database(buffer);
    } else {
      rawDb = new SQL.Database();
    }

    /* Turn on foreign-key constraints */
    rawDb.run('PRAGMA foreign_keys = ON');

    /* ── Create tables ─────────────────────────────────────── */

    /* Users — every registered account.  Passwords are stored
       as bcrypt hashes, never in plain text.                   */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT    NOT NULL UNIQUE,
        name          TEXT    NOT NULL,
        password_hash TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    /* Categories — each user has their own set of expense
       categories (e.g. "Software", "Travel").                  */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT    NOT NULL,
        color      TEXT    NOT NULL DEFAULT '#8B5CF6',
        icon       TEXT    NOT NULL DEFAULT 'tag',
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    /* Projects — group expenses under client projects so
       freelancers know exactly how much each gig costs.        */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT    NOT NULL,
        client_name TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    /* Expenses — the main table, every dollar spent.           */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
        category_id INTEGER          REFERENCES categories(id)  ON DELETE SET NULL,
        project_id  INTEGER          REFERENCES projects(id)    ON DELETE SET NULL,
        amount      REAL    NOT NULL,
        description TEXT    NOT NULL,
        date        TEXT    NOT NULL,
        receipt_url TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    /* Refresh tokens — keeps users logged in between sessions. */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT    NOT NULL,
        expires_at TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    /* Password reset tokens — single-use, short-lived. There's no
       email service wired up, so the token is returned directly
       in the API response instead of being emailed.              */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT    NOT NULL,
        expires_at TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `);

    /* Budgets — one optional monthly limit per category. */
    rawDb.run(`
      CREATE TABLE IF NOT EXISTS budgets (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
        category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        monthly_limit REAL    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, category_id)
      )
    `);

    saveToDisk();
  },

  /* Return a statement wrapper with .run() / .get() / .all() */
  prepare(sql) {
    return new StatementWrapper(sql);
  },

  /* Run raw SQL (DDL, multi-statement, etc.) */
  exec(sql) {
    rawDb.run(sql);
    saveToDisk();
  },

  /* No-op for unsupported pragmas */
  pragma(str) {
    try { rawDb.run(`PRAGMA ${str}`); } catch { /* sql.js ignores some pragmas */ }
  },

  /* Batch mode: disable auto-save for bulk inserts */
  set batchMode(val) { autoSave = !val; },

  /* Force a save to disk */
  save: forceSave,
};

module.exports = db;
