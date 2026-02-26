/**
 * Leads Database Module — Postgres (replaces leads.json)
 *
 * ใช้ DATABASE_URL ที่มีอยู่แล้วบน Railway
 * Schema: leads table with JSONB data + indexed columns
 * Fallback: ถ้า DB ไม่พร้อม → ใช้ file เหมือนเดิม
 *
 * Interface เหมือน loadLeads/saveLeads/updateLead เดิม — เปลี่ยนแค่ storage layer
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

const { Pool } = pg;
let pool = null;
let dbReady = false;

// ============================================================
// Init
// ============================================================

async function initLeadsDB() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[DB-LEADS] No DATABASE_URL — using file fallback');
    return false;
  }

  try {
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    await pool.query('SELECT 1');

    // Try to create schema — may fail on read-only poolers (Supabase transaction mode)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id SERIAL PRIMARY KEY,
          place_id TEXT UNIQUE,
          email TEXT,
          domain TEXT,
          status TEXT DEFAULT 'new',
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS leads_meta (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
        CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
        CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);
        CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
      `);
      console.log('[DB-LEADS] ✅ Schema created/verified');
    } catch (ddlErr) {
      // DDL failed (read-only connection) — check if tables already exist
      console.log(`[DB-LEADS] ⚠️ DDL failed (${ddlErr.message.slice(0, 60)}) — checking if tables exist...`);
      try {
        await pool.query('SELECT 1 FROM leads LIMIT 1');
        await pool.query('SELECT 1 FROM leads_meta LIMIT 1');
        console.log('[DB-LEADS] ✅ Tables already exist — proceeding without DDL');
      } catch {
        // Tables really don't exist and we can't create them
        throw new Error('Tables do not exist and cannot create (read-only): ' + ddlErr.message);
      }
    }

    dbReady = true;
    console.log('[DB-LEADS] ✅ PostgreSQL leads DB ready');

    // Check DB vs file state
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM leads');
    const dbCount = parseInt(rows[0].count);

    // Check file state
    let fileCount = 0;
    try {
      const fileData = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
      fileCount = fileData.leads?.length || 0;
    } catch { /* no file */ }

    if (dbCount === 0 && fileCount > 0) {
      // DB empty, file has data → migrate JSON → DB (first time)
      await migrateFromJSON();
    } else if (dbCount > 0) {
      // DB has data → restore to file (survives deploy!)
      await restoreToFile();
    }

    return true;
  } catch (err) {
    console.error('[DB-LEADS] ❌ Init failed:', err.message);
    dbReady = false;
    return false;
  }
}

// ============================================================
// Restore: Postgres → JSON file (on deploy / startup)
// ============================================================

async function restoreToFile() {
  try {
    const [leadsResult, domainsResult, lastRunResult] = await Promise.all([
      pool.query('SELECT data FROM leads ORDER BY id'),
      pool.query("SELECT value FROM leads_meta WHERE key = 'processedDomains'"),
      pool.query("SELECT value FROM leads_meta WHERE key = 'lastRun'"),
    ]);

    const leads = leadsResult.rows.map(r => r.data);
    const processedDomains = domainsResult.rows[0]?.value || [];
    const lastRun = lastRunResult.rows[0]?.value || null;

    // Check if file has MORE leads (local changes not yet synced)
    let fileCount = 0;
    try {
      const fileData = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
      fileCount = fileData.leads?.length || 0;
    } catch { /* no file */ }

    if (fileCount > leads.length) {
      console.log(`[DB-LEADS] ⚠️ File has ${fileCount} leads, DB has ${leads.length} — keeping file (local has more)`);
      // Sync file → DB instead
      await migrateFromJSON();
      return;
    }

    const data = { leads, processedDomains, lastRun };
    const content = JSON.stringify(data, null, 2);

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const fd = fs.openSync(LEADS_FILE, 'w');
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    console.log(`[DB-LEADS] ✅ Restored ${leads.length} leads from Postgres to leads.json`);
  } catch (err) {
    console.error('[DB-LEADS] ❌ Restore to file failed:', err.message);
  }
}

// ============================================================
// Migration: JSON → Postgres (one-time)
// ============================================================

async function migrateFromJSON() {
  try {
    if (!fs.existsSync(LEADS_FILE)) {
      console.log('[DB-LEADS] No leads.json to migrate');
      return;
    }

    const fileData = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    const leads = fileData.leads || [];
    if (leads.length === 0) {
      console.log('[DB-LEADS] leads.json is empty, nothing to migrate');
      return;
    }

    console.log(`[DB-LEADS] 🔄 Migrating ${leads.length} leads from JSON to Postgres...`);

    let migrated = 0;
    const batchSize = 50;

    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      for (let j = 0; j < batch.length; j++) {
        const lead = batch[j];
        const offset = j * 5;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        values.push(
          lead.place_id || `auto_${Date.now()}_${i + j}`,
          lead.email || null,
          lead.domain || null,
          lead.status || 'new',
          JSON.stringify(lead)
        );
      }

      await pool.query(`
        INSERT INTO leads (place_id, email, domain, status, data)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (place_id) DO UPDATE SET
          data = EXCLUDED.data,
          email = EXCLUDED.email,
          domain = EXCLUDED.domain,
          status = EXCLUDED.status,
          updated_at = NOW()
      `, values);

      migrated += batch.length;
    }

    // Save processedDomains to meta
    if (fileData.processedDomains?.length) {
      await pool.query(`
        INSERT INTO leads_meta (key, value, updated_at)
        VALUES ('processedDomains', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      `, [JSON.stringify(fileData.processedDomains)]);
    }

    // Save lastRun to meta
    if (fileData.lastRun) {
      await pool.query(`
        INSERT INTO leads_meta (key, value, updated_at)
        VALUES ('lastRun', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      `, [JSON.stringify(fileData.lastRun)]);
    }

    console.log(`[DB-LEADS] ✅ Migrated ${migrated} leads to Postgres`);
  } catch (err) {
    console.error('[DB-LEADS] ❌ Migration failed:', err.message);
  }
}

// ============================================================
// Core CRUD — same interface as file-based
// ============================================================

/**
 * Load all leads (replaces JSON loadLeads)
 * @returns {{ leads: Array, processedDomains: Array, lastRun: string|null }}
 */
async function loadLeads() {
  if (!dbReady) return loadLeadsFile();

  try {
    const [leadsResult, domainsResult, lastRunResult] = await Promise.all([
      pool.query('SELECT data FROM leads ORDER BY id'),
      pool.query("SELECT value FROM leads_meta WHERE key = 'processedDomains'"),
      pool.query("SELECT value FROM leads_meta WHERE key = 'lastRun'"),
    ]);

    return {
      leads: leadsResult.rows.map(r => r.data),
      processedDomains: domainsResult.rows[0]?.value || [],
      lastRun: lastRunResult.rows[0]?.value || null,
    };
  } catch (err) {
    console.error('[DB-LEADS] loadLeads error, falling back to file:', err.message);
    return loadLeadsFile();
  }
}

/**
 * Save all leads (replaces JSON saveLeads)
 * @param {{ leads: Array, processedDomains?: Array, lastRun?: string }} data
 */
async function saveLeads(data) {
  if (!dbReady) {
    saveLeadsFile(data);
    return;
  }

  try {
    const leads = data.leads || [];

    // Batch upsert leads in chunks
    const batchSize = 50;
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      for (let j = 0; j < batch.length; j++) {
        const lead = batch[j];
        const offset = j * 5;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        values.push(
          lead.place_id || `auto_${Date.now()}_${i + j}`,
          lead.email || null,
          lead.domain || null,
          lead.status || 'new',
          JSON.stringify(lead)
        );
      }

      if (placeholders.length > 0) {
        await pool.query(`
          INSERT INTO leads (place_id, email, domain, status, data)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (place_id) DO UPDATE SET
            data = EXCLUDED.data,
            email = EXCLUDED.email,
            domain = EXCLUDED.domain,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, values);
      }
    }

    // Save meta
    if (data.processedDomains) {
      await pool.query(`
        INSERT INTO leads_meta (key, value, updated_at)
        VALUES ('processedDomains', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      `, [JSON.stringify(data.processedDomains)]);
    }

    if (data.lastRun !== undefined) {
      await pool.query(`
        INSERT INTO leads_meta (key, value, updated_at)
        VALUES ('lastRun', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
      `, [JSON.stringify(data.lastRun)]);
    }
  } catch (err) {
    console.error('[DB-LEADS] saveLeads error, falling back to file:', err.message);
    saveLeadsFile(data);
  }
}

/**
 * Update a single lead (efficient — doesn't rewrite all leads)
 * @param {string} identifier - place_id, domain, or email
 * @param {object} updates - fields to merge
 * @returns {boolean}
 */
async function updateLead(identifier, updates) {
  if (!dbReady) return updateLeadFile(identifier, updates);

  try {
    // Find the lead
    const { rows } = await pool.query(`
      SELECT id, data FROM leads
      WHERE place_id = $1 OR domain = $1 OR email = $1
      LIMIT 1
    `, [identifier]);

    if (rows.length === 0) return false;

    const lead = { ...rows[0].data, ...updates };

    await pool.query(`
      UPDATE leads SET
        data = $1,
        email = $2,
        domain = $3,
        status = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [JSON.stringify(lead), lead.email || null, lead.domain || null, lead.status || 'new', rows[0].id]);

    return true;
  } catch (err) {
    console.error('[DB-LEADS] updateLead error:', err.message);
    return updateLeadFile(identifier, updates);
  }
}

/**
 * Save a single lead (upsert by place_id)
 */
async function saveLead(lead) {
  if (!dbReady) return;

  try {
    const placeId = lead.place_id || `auto_${Date.now()}`;
    await pool.query(`
      INSERT INTO leads (place_id, email, domain, status, data)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (place_id) DO UPDATE SET
        data = $5,
        email = $2,
        domain = $3,
        status = $4,
        updated_at = NOW()
    `, [placeId, lead.email || null, lead.domain || null, lead.status || 'new', JSON.stringify(lead)]);
  } catch (err) {
    console.error('[DB-LEADS] saveLead error:', err.message);
  }
}

/**
 * Check if domain is already processed
 */
async function isDomainProcessed(domain) {
  if (!dbReady) return false;

  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM leads WHERE domain = $1 LIMIT 1',
      [domain]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get leads count by status
 */
async function getLeadStats() {
  if (!dbReady) return null;

  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*) as count FROM leads GROUP BY status
    `);
    const stats = {};
    rows.forEach(r => { stats[r.status] = parseInt(r.count); });
    return stats;
  } catch {
    return null;
  }
}

// ============================================================
// File fallback — เหมือนเดิมทุกประการ
// ============================================================

function loadLeadsFile() {
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  } catch {
    return { leads: [], processedDomains: [], lastRun: null };
  }
}

function saveLeadsFile(data) {
  const content = JSON.stringify(data, null, 2);
  const fd = fs.openSync(LEADS_FILE, 'w');
  fs.writeSync(fd, content);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

function updateLeadFile(identifier, updates) {
  const data = loadLeadsFile();
  const idx = data.leads.findIndex(l =>
    (l.place_id && l.place_id === identifier) ||
    (l.domain && l.domain === identifier) ||
    (l.email && l.email === identifier)
  );
  if (idx >= 0) {
    Object.assign(data.leads[idx], updates);
    saveLeadsFile(data);
    return true;
  }
  return false;
}

// ============================================================
// Status
// ============================================================

function isDBReady() {
  return dbReady;
}

function getStatus() {
  return {
    dbReady,
    hasPool: !!pool,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  };
}

export {
  initLeadsDB,
  loadLeads,
  saveLeads,
  saveLead,
  updateLead,
  isDomainProcessed,
  getLeadStats,
  migrateFromJSON,
  isDBReady,
  getStatus,
};

export default {
  initLeadsDB,
  loadLeads,
  saveLeads,
  saveLead,
  updateLead,
  isDomainProcessed,
  getLeadStats,
  migrateFromJSON,
  isDBReady,
  getStatus,
};
