/**
 * Prompt Loader - Versioned Prompt Management
 *
 * จาก OpenClaw Discussion: Prompt versioning ช่วยให้ย้อนกลับได้, A/B test ได้
 *
 * Features:
 * - Version-based prompt loading
 * - Template variable substitution
 * - Fallback to previous version
 * - Prompt composition
 *
 * @module prompt-loader
 */

import fs from 'fs';
import path from 'path';
import { createSubsystemLogger } from './logger.js';

const log = createSubsystemLogger('prompt');

// ============================================================
// Constants
// ============================================================

const DEFAULT_PROMPTS_DIR = 'prompts';
const DEFAULT_VERSION = 'v1.0';

// ============================================================
// State
// ============================================================

let promptsDir = DEFAULT_PROMPTS_DIR;
let currentVersion = DEFAULT_VERSION;
let promptCache = new Map();

// ============================================================
// Initialization
// ============================================================

/**
 * Initialize prompt loader
 * @param {object} options
 * @param {string} [options.dir] - Prompts directory
 * @param {string} [options.version] - Current version to use
 */
export function initPromptLoader(options = {}) {
  if (options.dir) {
    promptsDir = options.dir;
  }
  if (options.version) {
    currentVersion = options.version;
  }

  // Validate prompts directory exists
  const versionDir = path.join(promptsDir, currentVersion);
  if (!fs.existsSync(versionDir)) {
    log.warn(`Prompts directory not found: ${versionDir}, creating...`);
    fs.mkdirSync(versionDir, { recursive: true });
  }

  log.info(`Prompt loader initialized: ${promptsDir} (${currentVersion})`);
}

/**
 * Set current prompt version
 * @param {string} version
 */
export function setVersion(version) {
  const versionDir = path.join(promptsDir, version);
  if (!fs.existsSync(versionDir)) {
    log.error(`Version not found: ${version}`);
    return false;
  }

  currentVersion = version;
  promptCache.clear();
  log.info(`Switched to prompt version: ${version}`);
  return true;
}

/**
 * Get current version
 * @returns {string}
 */
export function getVersion() {
  return currentVersion;
}

/**
 * List available versions
 * @returns {string[]}
 */
export function listVersions() {
  if (!fs.existsSync(promptsDir)) {
    return [];
  }

  return fs.readdirSync(promptsDir)
    .filter((f) => {
      const fullPath = path.join(promptsDir, f);
      return fs.statSync(fullPath).isDirectory() && f.startsWith('v');
    })
    .sort();
}

// ============================================================
// Prompt Loading
// ============================================================

/**
 * Load a prompt file
 * @param {string} name - Prompt name (without extension)
 * @param {string} [version] - Specific version (defaults to current)
 * @returns {string|null} Prompt content
 */
export function loadPrompt(name, version = currentVersion) {
  const cacheKey = `${version}:${name}`;

  // Check cache
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey);
  }

  // Try to load from version directory
  const filePath = path.join(promptsDir, version, `${name}.md`);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    promptCache.set(cacheKey, content);
    log.debug(`Loaded prompt: ${name} (${version})`);
    return content;
  }

  // Fallback to previous version
  const versions = listVersions();
  const currentIdx = versions.indexOf(version);

  if (currentIdx > 0) {
    const prevVersion = versions[currentIdx - 1];
    log.warn(`Prompt ${name} not found in ${version}, falling back to ${prevVersion}`);
    return loadPrompt(name, prevVersion);
  }

  log.error(`Prompt not found: ${name}`);
  return null;
}

/**
 * Load and render a prompt with variables
 * @param {string} name - Prompt name
 * @param {object} variables - Variables to substitute
 * @param {string} [version] - Specific version
 * @returns {string|null} Rendered prompt
 */
export function renderPrompt(name, variables = {}, version = currentVersion) {
  const template = loadPrompt(name, version);
  if (!template) return null;

  // Substitute variables: {{variable_name}}
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(pattern, String(value));
  }

  // Warn about unsubstituted variables
  const remaining = rendered.match(/\{\{\s*\w+\s*\}\}/g);
  if (remaining) {
    log.warn(`Unsubstituted variables in ${name}: ${remaining.join(', ')}`);
  }

  return rendered;
}

/**
 * Compose multiple prompts
 * @param {string[]} names - Prompt names to compose
 * @param {object} variables - Variables for all prompts
 * @param {string} [separator] - Separator between prompts
 * @returns {string} Composed prompt
 */
export function composePrompts(names, variables = {}, separator = '\n\n---\n\n') {
  const rendered = names
    .map((name) => renderPrompt(name, variables))
    .filter(Boolean);

  return rendered.join(separator);
}

// ============================================================
// Prompt Management
// ============================================================

/**
 * Save a prompt
 * @param {string} name - Prompt name
 * @param {string} content - Prompt content
 * @param {string} [version] - Version to save to
 */
export function savePrompt(name, content, version = currentVersion) {
  const versionDir = path.join(promptsDir, version);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  const filePath = path.join(versionDir, `${name}.md`);
  fs.writeFileSync(filePath, content);

  // Invalidate cache
  promptCache.delete(`${version}:${name}`);

  log.info(`Saved prompt: ${name} (${version})`);
}

/**
 * List prompts in a version
 * @param {string} [version]
 * @returns {string[]} Prompt names
 */
export function listPrompts(version = currentVersion) {
  const versionDir = path.join(promptsDir, version);
  if (!fs.existsSync(versionDir)) {
    return [];
  }

  return fs.readdirSync(versionDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace('.md', ''));
}

/**
 * Create a new version by copying from existing
 * @param {string} newVersion - New version name
 * @param {string} [fromVersion] - Source version
 */
export function createVersion(newVersion, fromVersion = currentVersion) {
  const sourceDir = path.join(promptsDir, fromVersion);
  const targetDir = path.join(promptsDir, newVersion);

  if (fs.existsSync(targetDir)) {
    log.error(`Version already exists: ${newVersion}`);
    return false;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // Copy all prompts
  if (fs.existsSync(sourceDir)) {
    const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      fs.copyFileSync(
        path.join(sourceDir, file),
        path.join(targetDir, file)
      );
    }
    log.info(`Created version ${newVersion} with ${files.length} prompts from ${fromVersion}`);
  } else {
    log.info(`Created empty version: ${newVersion}`);
  }

  return true;
}

/**
 * Clear prompt cache
 */
export function clearCache() {
  promptCache.clear();
  log.debug('Prompt cache cleared');
}

// ============================================================
// Exports
// ============================================================

export default {
  // Init
  initPromptLoader,

  // Version
  setVersion,
  getVersion,
  listVersions,

  // Loading
  loadPrompt,
  renderPrompt,
  composePrompts,

  // Management
  savePrompt,
  listPrompts,
  createVersion,
  clearCache,
};
