/**
 * Config Loader - ระบบโหลด Config จาก OpenClaw Pattern
 *
 * Features:
 * - Path resolution (หลายตำแหน่ง)
 * - Environment variable substitution (${VAR})
 * - $include directive (รวมหลายไฟล์)
 * - Config caching (200ms default)
 * - Config backup (5 versions)
 *
 * @module config-loader
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================
// Constants
// ============================================================

const CONFIG_FILENAME = 'oracle-config.json';
const CONFIG_BACKUP_COUNT = 5;
const DEFAULT_CACHE_MS = 200;
const MAX_INCLUDE_DEPTH = 10;

// ============================================================
// Path Resolution
// ============================================================

/**
 * หาตำแหน่ง config file
 * ลำดับ: env var → workspace → home dir
 */
export function resolveConfigPath(workspaceDir = process.cwd()) {
  const candidates = [
    // 1. Environment variable override
    process.env.ORACLE_CONFIG_PATH,

    // 2. Workspace config
    path.join(workspaceDir, CONFIG_FILENAME),

    // 3. Oracle state dir
    process.env.ORACLE_STATE_DIR
      ? path.join(process.env.ORACLE_STATE_DIR, CONFIG_FILENAME)
      : null,

    // 4. Home directory
    path.join(os.homedir(), '.oracle', CONFIG_FILENAME),

    // 5. Legacy location
    path.join(os.homedir(), '.oracle-agent', CONFIG_FILENAME),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Default to workspace (will be created if needed)
  return path.join(workspaceDir, CONFIG_FILENAME);
}

/**
 * หาตำแหน่ง state directory
 */
export function resolveStateDir() {
  const candidates = [
    process.env.ORACLE_STATE_DIR,
    path.join(os.homedir(), '.oracle'),
    path.join(os.homedir(), '.oracle-agent'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Default
  return path.join(os.homedir(), '.oracle');
}

// ============================================================
// Environment Variable Substitution
// ============================================================

/**
 * แทนที่ ${VAR} ด้วยค่าจริงจาก environment
 * รองรับ escape: $${VAR} → ${VAR}
 */
export function substituteEnvVars(obj, env = process.env, visited = new Set()) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Check for escaped: $${VAR}
    if (obj.includes('$${')) {
      obj = obj.replace(/\$\$\{([^}]+)\}/g, '${$1}');
    }

    // Substitute ${VAR}
    return obj.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (match, varName) => {
      const value = env[varName];
      if (value === undefined) {
        console.warn(`[CONFIG] Warning: Environment variable ${varName} not found`);
        return match; // Keep original if not found
      }
      return value;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvVars(item, env, visited));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value, env, visited);
    }
    return result;
  }

  return obj;
}

// ============================================================
// Include Resolution
// ============================================================

/**
 * Deep merge สอง objects
 * - Arrays: concatenate
 * - Objects: recursive merge
 * - Primitives: source wins
 */
export function deepMerge(target, source) {
  if (source === null || source === undefined) {
    return target;
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }

  if (typeof target === 'object' && typeof source === 'object') {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (key in result) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return source;
}

/**
 * Resolve $include directives
 */
export function resolveIncludes(config, basePath, depth = 0) {
  if (depth > MAX_INCLUDE_DEPTH) {
    throw new Error(`[CONFIG] Maximum include depth (${MAX_INCLUDE_DEPTH}) exceeded - possible circular include`);
  }

  if (!config || typeof config !== 'object') {
    return config;
  }

  // Check for $include
  if (config.$include) {
    const includes = Array.isArray(config.$include) ? config.$include : [config.$include];
    const baseDir = path.dirname(basePath);

    let merged = {};
    for (const includePath of includes) {
      const fullPath = path.resolve(baseDir, includePath);

      if (!fs.existsSync(fullPath)) {
        console.warn(`[CONFIG] Include file not found: ${fullPath}`);
        continue;
      }

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(content);
        const resolved = resolveIncludes(parsed, fullPath, depth + 1);
        merged = deepMerge(merged, resolved);
      } catch (err) {
        console.error(`[CONFIG] Error reading include file ${fullPath}:`, err.message);
      }
    }

    // Merge with rest of config (excluding $include)
    const { $include, ...rest } = config;
    return deepMerge(merged, resolveIncludes(rest, basePath, depth));
  }

  // Recursively process nested objects
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = resolveIncludes(value, basePath, depth);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================
// Config Caching
// ============================================================

let configCache = null;

function getCacheMs() {
  if (process.env.ORACLE_DISABLE_CONFIG_CACHE === 'true') {
    return 0;
  }
  return parseInt(process.env.ORACLE_CONFIG_CACHE_MS || String(DEFAULT_CACHE_MS), 10);
}

function isCacheValid() {
  if (!configCache) return false;
  const cacheMs = getCacheMs();
  if (cacheMs <= 0) return false;
  return Date.now() < configCache.expiresAt;
}

export function clearConfigCache() {
  configCache = null;
}

// ============================================================
// Config Backup
// ============================================================

/**
 * Backup config file ก่อน save
 */
export function backupConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return;
  }

  const dir = path.dirname(configPath);
  const base = path.basename(configPath);

  // Rotate existing backups
  for (let i = CONFIG_BACKUP_COUNT - 1; i >= 1; i--) {
    const oldPath = path.join(dir, `${base}.bak.${i}`);
    const newPath = path.join(dir, `${base}.bak.${i + 1}`);
    if (fs.existsSync(oldPath)) {
      if (i === CONFIG_BACKUP_COUNT - 1) {
        fs.unlinkSync(oldPath); // Delete oldest
      } else {
        fs.renameSync(oldPath, newPath);
      }
    }
  }

  // Move current .bak to .bak.1
  const bakPath = path.join(dir, `${base}.bak`);
  if (fs.existsSync(bakPath)) {
    fs.renameSync(bakPath, path.join(dir, `${base}.bak.1`));
  }

  // Backup current config
  fs.copyFileSync(configPath, bakPath);
}

// ============================================================
// Main Functions
// ============================================================

/**
 * โหลด config file
 * @param {string} workspaceDir - workspace directory
 * @param {object} options - options
 * @returns {object} loaded config
 */
export function loadConfig(workspaceDir = process.cwd(), options = {}) {
  const { skipCache = false, skipValidation = false } = options;

  // Check cache
  if (!skipCache && isCacheValid()) {
    return configCache.config;
  }

  const configPath = resolveConfigPath(workspaceDir);

  // If no config file, return empty
  if (!fs.existsSync(configPath)) {
    console.log(`[CONFIG] No config file found at ${configPath}`);
    return {};
  }

  try {
    // 1. Read raw JSON
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // 2. Resolve $include directives
    const included = resolveIncludes(parsed, configPath);

    // 3. Apply config.env to process.env (if present)
    if (included.env && typeof included.env === 'object') {
      for (const [key, value] of Object.entries(included.env)) {
        if (process.env[key] === undefined) {
          process.env[key] = String(value);
        }
      }
    }

    // 4. Substitute ${VAR}
    const substituted = substituteEnvVars(included);

    // 5. Validate (basic)
    if (!skipValidation) {
      const validation = validateConfig(substituted);
      if (!validation.ok) {
        console.error('[CONFIG] Validation errors:', validation.errors);
        // Return partial config instead of failing completely
      }
      if (validation.warnings.length > 0) {
        console.warn('[CONFIG] Warnings:', validation.warnings);
      }
    }

    // 6. Cache
    const cacheMs = getCacheMs();
    if (cacheMs > 0) {
      configCache = {
        configPath,
        config: substituted,
        expiresAt: Date.now() + cacheMs,
      };
    }

    console.log(`[CONFIG] Loaded from ${configPath}`);
    return substituted;
  } catch (err) {
    console.error(`[CONFIG] Error loading config:`, err.message);
    return {};
  }
}

/**
 * Save config file
 */
export function saveConfig(config, workspaceDir = process.cwd(), options = {}) {
  const { backup = true, pretty = true } = options;

  const configPath = resolveConfigPath(workspaceDir);
  const dir = path.dirname(configPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Backup before save
  if (backup) {
    backupConfig(configPath);
  }

  // Add metadata
  const toSave = {
    ...config,
    meta: {
      ...config.meta,
      lastSavedAt: new Date().toISOString(),
      version: process.env.npm_package_version || '3.5.0',
    },
  };

  // Write
  const content = pretty ? JSON.stringify(toSave, null, 2) : JSON.stringify(toSave);
  fs.writeFileSync(configPath, content, 'utf-8');

  // Clear cache
  clearConfigCache();

  console.log(`[CONFIG] Saved to ${configPath}`);
  return configPath;
}

// ============================================================
// Validation
// ============================================================

/**
 * Basic validation
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (config.api) {
    if (!config.api.anthropic && !config.api.openai) {
      warnings.push('No API keys configured - some features may not work');
    }
  }

  // Check for deprecated fields
  const deprecatedFields = ['old_field', 'legacy_option'];
  for (const field of deprecatedFields) {
    if (config[field] !== undefined) {
      warnings.push(`Deprecated field "${field}" found - please migrate`);
    }
  }

  // Check paths
  if (config.paths) {
    for (const [key, value] of Object.entries(config.paths)) {
      if (typeof value === 'string' && value.startsWith('~')) {
        warnings.push(`Path "${key}" uses ~ - should use absolute path or $HOME`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  resolveConfigPath,
  resolveStateDir,
  loadConfig,
  saveConfig,
  validateConfig,
  substituteEnvVars,
  deepMerge,
  resolveIncludes,
  clearConfigCache,
  backupConfig,
};
