import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import type { Dream, Interpretation, InterpretationSymbol, PatternItem } from './types';
import { daysAgo, toISODate } from './dates';

export const DB_NAME = 'dreampattern.db';
const SCHEMA_VERSION = 1;

/** Runs on app start via <SQLiteProvider onInit>. Each version step is applied once. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE dreams (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        dream_date TEXT NOT NULL,
        mood INTEGER,
        lucid INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX dreams_date_idx ON dreams (dream_date DESC);

      CREATE TABLE interpretations (
        dream_id TEXT PRIMARY KEY NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        symbols TEXT NOT NULL,
        emotions TEXT NOT NULL,
        tone TEXT NOT NULL,
        pattern_callback TEXT,
        created_at TEXT NOT NULL
      );

      -- One row per element found in a dream; powers the Patterns screen.
      CREATE TABLE elements (
        dream_id TEXT NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        dream_date TEXT NOT NULL,
        PRIMARY KEY (dream_id, name, kind)
      );
      CREATE INDEX elements_date_idx ON elements (dream_date);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

type DreamRow = {
  id: string;
  title: string;
  body: string;
  dream_date: string;
  mood: number | null;
  lucid: number;
  tags: string;
  created_at: string;
  updated_at: string;
};

const toDream = (r: DreamRow): Dream => ({
  id: r.id,
  title: r.title,
  body: r.body,
  dreamDate: r.dream_date,
  mood: r.mood,
  lucid: r.lucid === 1,
  tags: JSON.parse(r.tags),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type DreamInput = Pick<Dream, 'title' | 'body' | 'dreamDate' | 'mood' | 'lucid' | 'tags'>;

export async function createDream(db: SQLiteDatabase, input: DreamInput): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO dreams (id, title, body, dream_date, mood, lucid, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, input.title.trim(), input.body.trim(), input.dreamDate, input.mood,
    input.lucid ? 1 : 0, JSON.stringify(input.tags), now, now,
  );
  return id;
}

export async function updateDream(db: SQLiteDatabase, id: string, input: DreamInput): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE dreams SET title = ?, body = ?, dream_date = ?, mood = ?, lucid = ?, tags = ?, updated_at = ?
       WHERE id = ?`,
      input.title.trim(), input.body.trim(), input.dreamDate, input.mood,
      input.lucid ? 1 : 0, JSON.stringify(input.tags), new Date().toISOString(), id,
    );
    await db.runAsync('UPDATE elements SET dream_date = ? WHERE dream_id = ?', input.dreamDate, id);
  });
}

export async function setDreamTitle(db: SQLiteDatabase, id: string, title: string): Promise<void> {
  await db.runAsync('UPDATE dreams SET title = ? WHERE id = ?', title, id);
}

export async function deleteDream(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM dreams WHERE id = ?', id);
}

export async function deleteAllData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM elements; DELETE FROM interpretations; DELETE FROM dreams; DELETE FROM settings;');
}

export async function getDream(db: SQLiteDatabase, id: string): Promise<Dream | null> {
  const r = await db.getFirstAsync<DreamRow>('SELECT * FROM dreams WHERE id = ?', id);
  return r ? toDream(r) : null;
}

export interface DreamFilter {
  search?: string;
  tag?: string;
  element?: string;
  month?: string; // YYYY-MM
  limit?: number;
}

export async function listDreams(db: SQLiteDatabase, f: DreamFilter = {}): Promise<Dream[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.search?.trim()) {
    where.push('(d.title LIKE ? OR d.body LIKE ? OR d.tags LIKE ?)');
    const q = `%${f.search.trim()}%`;
    params.push(q, q, q);
  }
  if (f.tag) {
    where.push('d.tags LIKE ?');
    params.push(`%${JSON.stringify(f.tag)}%`);
  }
  if (f.element) {
    where.push('EXISTS (SELECT 1 FROM elements e WHERE e.dream_id = d.id AND e.name = ?)');
    params.push(f.element);
  }
  if (f.month) {
    where.push('d.dream_date LIKE ?');
    params.push(`${f.month}-%`);
  }
  const sql = `SELECT d.* FROM dreams d ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY d.dream_date DESC, d.created_at DESC ${f.limit ? `LIMIT ${Math.floor(f.limit)}` : ''}`;
  const rows = await db.getAllAsync<DreamRow>(sql, ...params);
  return rows.map(toDream);
}

export async function countDreams(db: SQLiteDatabase): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM dreams');
  return r?.n ?? 0;
}

export async function allTags(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ tags: string }>('SELECT tags FROM dreams');
  const set = new Set<string>();
  rows.forEach((r) => (JSON.parse(r.tags) as string[]).forEach((t) => set.add(t)));
  return [...set].sort();
}

/** Consecutive days (ending today or yesterday) with at least one entry. */
export async function currentStreak(db: SQLiteDatabase): Promise<number> {
  const rows = await db.getAllAsync<{ dream_date: string }>(
    'SELECT DISTINCT dream_date FROM dreams ORDER BY dream_date DESC LIMIT 400',
  );
  const dates = new Set(rows.map((r) => r.dream_date));
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to still count if today's entry isn't logged yet.
  if (!dates.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- interpretations ----------

type InterpRow = {
  dream_id: string;
  summary: string;
  symbols: string;
  emotions: string;
  tone: string;
  pattern_callback: string | null;
  created_at: string;
};

export async function getInterpretation(db: SQLiteDatabase, dreamId: string): Promise<Interpretation | null> {
  const r = await db.getFirstAsync<InterpRow & { title: string }>(
    `SELECT i.*, d.title FROM interpretations i JOIN dreams d ON d.id = i.dream_id WHERE i.dream_id = ?`,
    dreamId,
  );
  if (!r) return null;
  return {
    dreamId: r.dream_id,
    title: r.title,
    summary: r.summary,
    symbols: JSON.parse(r.symbols),
    emotions: JSON.parse(r.emotions),
    tone: r.tone,
    patternCallback: r.pattern_callback,
    createdAt: r.created_at,
  };
}

export async function saveInterpretation(
  db: SQLiteDatabase,
  dream: Dream,
  i: Omit<Interpretation, 'dreamId' | 'createdAt'>,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO interpretations (dream_id, summary, symbols, emotions, tone, pattern_callback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      dream.id, i.summary, JSON.stringify(i.symbols), JSON.stringify(i.emotions), i.tone,
      i.patternCallback, new Date().toISOString(),
    );
    if (!dream.title && i.title) await setDreamTitle(db, dream.id, i.title);
    await db.runAsync('DELETE FROM elements WHERE dream_id = ?', dream.id);
    const seen = new Set<string>();
    const add = async (name: string, kind: string) => {
      const n = normalize(name);
      const key = `${kind}:${n}`;
      if (!n || seen.has(key)) return;
      seen.add(key);
      await db.runAsync(
        'INSERT OR IGNORE INTO elements (dream_id, name, kind, dream_date) VALUES (?, ?, ?, ?)',
        dream.id, n, kind, dream.dreamDate,
      );
    };
    for (const s of i.symbols as InterpretationSymbol[]) await add(s.name, s.kind);
    for (const e of i.emotions) await add(e, 'emotion');
  });
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// ---------- patterns ----------

/** Top elements in the last `days`, with counts from the previous window of equal length for the trend arrow. */
export async function topElements(db: SQLiteDatabase, days: number, limit = 20): Promise<PatternItem[]> {
  const start = daysAgo(days);
  const prevStart = daysAgo(days * 2);
  const rows = await db.getAllAsync<{ name: string; kind: PatternItem['kind']; count: number; prev: number }>(
    `SELECT name, kind,
            SUM(CASE WHEN dream_date > ? THEN 1 ELSE 0 END) AS count,
            SUM(CASE WHEN dream_date > ? AND dream_date <= ? THEN 1 ELSE 0 END) AS prev
     FROM elements
     WHERE dream_date > ?
     GROUP BY name, kind
     HAVING count > 0
     ORDER BY count DESC, name ASC
     LIMIT ?`,
    start, prevStart, start, prevStart, limit,
  );
  return rows.map((r) => ({ name: r.name, kind: r.kind, count: r.count, previousCount: r.prev }));
}

export async function interpretedDreamCount(db: SQLiteDatabase, sinceDays?: number): Promise<number> {
  const r = sinceDays
    ? await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM interpretations i JOIN dreams d ON d.id = i.dream_id WHERE d.dream_date > ?',
        daysAgo(sinceDays),
      )
    : await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM interpretations');
  return r?.n ?? 0;
}

/** Recurring elements (2+ dreams) excluding one dream; sent to the AI for the pattern callback. */
export async function recurringElements(db: SQLiteDatabase, excludeDreamId: string, limit = 12) {
  return db.getAllAsync<{ name: string; kind: string; count: number }>(
    `SELECT name, kind, COUNT(*) AS count FROM elements
     WHERE dream_id != ? GROUP BY name, kind HAVING count >= 2
     ORDER BY count DESC LIMIT ?`,
    excludeDreamId, limit,
  );
}

// ---------- settings ----------

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}
