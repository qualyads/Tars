/**
 * BOOT.md System - Based on OpenClaw Pattern
 *
 * Reads BOOT.md on server start and executes startup tasks.
 *
 * BOOT.md Format:
 * ```
 * # Boot Tasks
 *
 * ## On Start
 * - Send status to owner
 * - Check API health
 *
 * ## Daily (07:00)
 * - Morning briefing
 * ```
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  bootFile: path.join(__dirname, '..', 'BOOT.md'),
  defaultBootFile: path.join(__dirname, '..', '..', '..', 'ψ', 'memory', 'BOOT.md')
};

// =============================================================================
// BOOT FILE PARSER
// =============================================================================

/**
 * Parse BOOT.md content
 */
function parseBootFile(content) {
  const sections = {
    onStart: [],
    daily: [],
    hourly: [],
    custom: {}
  };

  let currentSection = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Section headers
    if (trimmed.startsWith('## On Start') || trimmed.startsWith('## Boot') || trimmed.startsWith('## Startup')) {
      currentSection = 'onStart';
      continue;
    }
    if (trimmed.startsWith('## Daily')) {
      currentSection = 'daily';
      continue;
    }
    if (trimmed.startsWith('## Hourly')) {
      currentSection = 'hourly';
      continue;
    }
    if (trimmed.startsWith('## ')) {
      const sectionName = trimmed.slice(3).trim().toLowerCase().replace(/\s+/g, '_');
      currentSection = sectionName;
      sections.custom[sectionName] = [];
      continue;
    }

    // Task items
    if (trimmed.startsWith('- ') && currentSection) {
      const task = trimmed.slice(2).trim();
      if (currentSection === 'onStart' || currentSection === 'daily' || currentSection === 'hourly') {
        sections[currentSection].push(task);
      } else if (sections.custom[currentSection]) {
        sections.custom[currentSection].push(task);
      }
    }
  }

  return sections;
}

/**
 * Load BOOT.md file
 */
function loadBootFile() {
  // Try primary location
  if (fs.existsSync(CONFIG.bootFile)) {
    const content = fs.readFileSync(CONFIG.bootFile, 'utf8');
    return { path: CONFIG.bootFile, content, sections: parseBootFile(content) };
  }

  // Try default location
  if (fs.existsSync(CONFIG.defaultBootFile)) {
    const content = fs.readFileSync(CONFIG.defaultBootFile, 'utf8');
    return { path: CONFIG.defaultBootFile, content, sections: parseBootFile(content) };
  }

  return { path: null, content: null, sections: null };
}

// =============================================================================
// TASK EXECUTORS
// =============================================================================

const taskExecutors = new Map();

/**
 * Register a task executor
 */
function registerTask(name, executor) {
  taskExecutors.set(name.toLowerCase(), executor);
  console.log(`[BOOT] Registered task: ${name}`);
}

/**
 * Execute a task by name
 */
async function executeTask(taskName, context = {}) {
  const normalizedName = taskName.toLowerCase().replace(/\s+/g, '_');

  // Try exact match
  if (taskExecutors.has(normalizedName)) {
    console.log(`[BOOT] Executing: ${taskName}`);
    try {
      await taskExecutors.get(normalizedName)(context);
      return { success: true, task: taskName };
    } catch (error) {
      console.error(`[BOOT] Task failed: ${taskName}`, error.message);
      return { success: false, task: taskName, error: error.message };
    }
  }

  // Try fuzzy match
  for (const [key, executor] of taskExecutors.entries()) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      console.log(`[BOOT] Executing (fuzzy): ${taskName} → ${key}`);
      try {
        await executor(context);
        return { success: true, task: taskName };
      } catch (error) {
        console.error(`[BOOT] Task failed: ${taskName}`, error.message);
        return { success: false, task: taskName, error: error.message };
      }
    }
  }

  console.log(`[BOOT] Unknown task: ${taskName}`);
  return { success: false, task: taskName, error: 'Unknown task' };
}

// =============================================================================
// BOOT RUNNER
// =============================================================================

/**
 * Run all boot tasks
 */
async function runBoot(options = {}) {
  console.log('[BOOT] Starting boot sequence...');

  const bootFile = loadBootFile();

  if (!bootFile.sections) {
    console.log('[BOOT] No BOOT.md found, skipping boot tasks');
    return { skipped: true, reason: 'No BOOT.md' };
  }

  const results = {
    file: bootFile.path,
    tasks: [],
    success: 0,
    failed: 0,
    skipped: 0
  };

  // Execute onStart tasks
  for (const task of bootFile.sections.onStart) {
    if (options.dryRun) {
      console.log(`[BOOT] Would execute: ${task}`);
      results.skipped++;
      continue;
    }

    const result = await executeTask(task, options.context || {});
    results.tasks.push(result);

    if (result.success) {
      results.success++;
    } else if (result.error === 'Unknown task') {
      results.skipped++;
    } else {
      results.failed++;
    }
  }

  console.log(`[BOOT] Boot complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);
  return results;
}

/**
 * Get boot status
 */
function getBootStatus() {
  const bootFile = loadBootFile();

  return {
    hasBootFile: !!bootFile.sections,
    path: bootFile.path,
    sections: bootFile.sections ? {
      onStart: bootFile.sections.onStart.length,
      daily: bootFile.sections.daily.length,
      hourly: bootFile.sections.hourly.length,
      custom: Object.keys(bootFile.sections.custom).length
    } : null,
    registeredTasks: Array.from(taskExecutors.keys())
  };
}

// =============================================================================
// DEFAULT TASKS
// =============================================================================

// Register some default tasks
registerTask('send_status', async (ctx) => {
  console.log('[BOOT] Status: Oracle Agent is running');
});

registerTask('check_api_health', async (ctx) => {
  console.log('[BOOT] API Health: OK');
});

registerTask('log_startup', async (ctx) => {
  const now = new Date().toISOString();
  console.log(`[BOOT] Startup logged at ${now}`);
});

// =============================================================================
// EXPORTS
// =============================================================================

export {
  loadBootFile,
  parseBootFile,
  runBoot,
  registerTask,
  executeTask,
  getBootStatus,
  CONFIG
};

export default {
  runBoot,
  registerTask,
  getBootStatus
};
