/**
 * Plugin System - Based on OpenClaw Pattern
 *
 * Extensible plugin architecture for Oracle with:
 * - Plugin discovery (local, workspace, global)
 * - Lifecycle hooks (before_message, after_reply, etc.)
 * - Tool registration
 * - Command registration
 * - Service registration
 *
 * Plugin Structure:
 * ```
 * plugins/
 * ├── my-plugin/
 * │   ├── oracle.plugin.json   (manifest)
 * │   └── index.js             (entry point)
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
  manifestFilename: 'oracle.plugin.json',
  entryFiles: ['index.js', 'index.mjs', 'plugin.js'],
  pluginDirs: [
    path.join(__dirname, '..', 'plugins'),           // Local plugins
    path.join(__dirname, '..', '..', '..', 'ψ', 'plugins'), // Memory plugins
  ],
};

// =============================================================================
// TYPES (in JSDoc for JavaScript)
// =============================================================================

/**
 * @typedef {Object} PluginManifest
 * @property {string} id - Unique plugin ID
 * @property {string} name - Display name
 * @property {string} [description] - Description
 * @property {string} [version] - Version string
 * @property {string[]} [triggers] - Message triggers
 * @property {Object} [config] - Plugin config schema
 */

/**
 * @typedef {Object} PluginApi
 * @property {string} id - Plugin ID
 * @property {Object} config - Global config
 * @property {Object} pluginConfig - Plugin-specific config
 * @property {Function} registerTool - Register a tool
 * @property {Function} registerHook - Register a lifecycle hook
 * @property {Function} registerCommand - Register a command
 * @property {Function} registerService - Register a background service
 * @property {Function} log - Plugin logger
 */

// =============================================================================
// PLUGIN REGISTRY
// =============================================================================

const registry = {
  plugins: new Map(),
  tools: new Map(),
  hooks: new Map(),
  commands: new Map(),
  services: new Map(),
};

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================

/**
 * Available hook names
 */
const HOOK_NAMES = [
  'before_message',      // Before processing user message
  'after_message',       // After processing user message
  'before_reply',        // Before sending reply
  'after_reply',         // After sending reply
  'on_error',            // On error
  'on_startup',          // On server startup
  'on_shutdown',         // On server shutdown
  'before_tool_call',    // Before calling a tool
  'after_tool_call',     // After calling a tool
  'session_start',       // On new session
  'session_end',         // On session end
];

/**
 * Register a hook handler
 */
function registerHook(hookName, handler, options = {}) {
  if (!HOOK_NAMES.includes(hookName)) {
    console.warn(`[PLUGIN] Unknown hook: ${hookName}`);
  }

  if (!registry.hooks.has(hookName)) {
    registry.hooks.set(hookName, []);
  }

  registry.hooks.get(hookName).push({
    handler,
    priority: options.priority || 0,
    pluginId: options.pluginId || 'unknown',
  });

  // Sort by priority (higher first)
  registry.hooks.get(hookName).sort((a, b) => b.priority - a.priority);
}

/**
 * Run hooks for a given event
 * @param {string} hookName - Hook name
 * @param {Object} event - Event data
 * @param {Object} context - Context data
 * @returns {Promise<Object|undefined>} Modified event or undefined
 */
async function runHook(hookName, event, context = {}) {
  const handlers = registry.hooks.get(hookName) || [];

  if (handlers.length === 0) return undefined;

  let result = event;

  for (const { handler, pluginId } of handlers) {
    try {
      const output = await handler(result, context);
      if (output !== undefined && output !== null) {
        result = { ...result, ...output };
      }
    } catch (error) {
      console.error(`[PLUGIN] Hook ${hookName} from ${pluginId} failed:`, error.message);
    }
  }

  return result;
}

/**
 * Run void hooks (fire-and-forget, parallel)
 */
async function runVoidHook(hookName, event, context = {}) {
  const handlers = registry.hooks.get(hookName) || [];

  await Promise.all(
    handlers.map(async ({ handler, pluginId }) => {
      try {
        await handler(event, context);
      } catch (error) {
        console.error(`[PLUGIN] Hook ${hookName} from ${pluginId} failed:`, error.message);
      }
    })
  );
}

// =============================================================================
// PLUGIN DISCOVERY
// =============================================================================

/**
 * Discover plugins from directories
 */
function discoverPlugins(extraDirs = []) {
  const candidates = [];
  const allDirs = [...CONFIG.pluginDirs, ...extraDirs];

  for (const dir of allDirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(dir, entry.name);
      const manifestPath = path.join(pluginDir, CONFIG.manifestFilename);

      // Check for manifest
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const entryFile = CONFIG.entryFiles
            .map(f => path.join(pluginDir, f))
            .find(f => fs.existsSync(f));

          if (entryFile) {
            candidates.push({
              id: manifest.id || entry.name,
              dir: pluginDir,
              manifest,
              entryFile,
            });
          }
        } catch (error) {
          console.warn(`[PLUGIN] Failed to parse manifest: ${manifestPath}`);
        }
      } else {
        // Try index.js without manifest
        const entryFile = CONFIG.entryFiles
          .map(f => path.join(pluginDir, f))
          .find(f => fs.existsSync(f));

        if (entryFile) {
          candidates.push({
            id: entry.name,
            dir: pluginDir,
            manifest: { id: entry.name, name: entry.name },
            entryFile,
          });
        }
      }
    }
  }

  return candidates;
}

// =============================================================================
// PLUGIN LOADING
// =============================================================================

/**
 * Create plugin API for a plugin
 */
function createPluginApi(pluginId, manifest, globalConfig = {}) {
  const pluginConfig = globalConfig.plugins?.[pluginId] || {};

  return {
    id: pluginId,
    name: manifest.name || pluginId,
    version: manifest.version,
    config: globalConfig,
    pluginConfig,

    /**
     * Register a tool
     */
    registerTool(tool) {
      registry.tools.set(tool.name || `${pluginId}_tool`, {
        ...tool,
        pluginId,
      });
      console.log(`[PLUGIN] ${pluginId}: Registered tool ${tool.name}`);
    },

    /**
     * Register a hook handler
     */
    registerHook(hookName, handler, options = {}) {
      registerHook(hookName, handler, { ...options, pluginId });
    },

    /**
     * Register a command (like /command)
     */
    registerCommand(command) {
      registry.commands.set(command.name, {
        ...command,
        pluginId,
      });
      console.log(`[PLUGIN] ${pluginId}: Registered command /${command.name}`);
    },

    /**
     * Register a background service
     */
    registerService(service) {
      registry.services.set(service.id || `${pluginId}_service`, {
        ...service,
        pluginId,
      });
      console.log(`[PLUGIN] ${pluginId}: Registered service ${service.id}`);
    },

    /**
     * Plugin logger
     */
    log: {
      debug: (msg) => console.log(`[PLUGIN:${pluginId}] ${msg}`),
      info: (msg) => console.log(`[PLUGIN:${pluginId}] ${msg}`),
      warn: (msg) => console.warn(`[PLUGIN:${pluginId}] ${msg}`),
      error: (msg) => console.error(`[PLUGIN:${pluginId}] ${msg}`),
    },
  };
}

/**
 * Load a single plugin
 */
async function loadPlugin(candidate, globalConfig = {}) {
  const { id, manifest, entryFile } = candidate;

  try {
    // Import the plugin module
    const mod = await import(entryFile);
    const register = mod.default?.register || mod.register || mod.default;

    if (typeof register !== 'function') {
      console.error(`[PLUGIN] ${id}: No register function found`);
      return null;
    }

    // Create API and register
    const api = createPluginApi(id, manifest, globalConfig);
    await register(api);

    // Record plugin
    const record = {
      id,
      name: manifest.name || id,
      version: manifest.version,
      description: manifest.description,
      status: 'loaded',
      entryFile,
    };

    registry.plugins.set(id, record);
    console.log(`[PLUGIN] Loaded: ${id} v${manifest.version || '0.0.0'}`);

    return record;
  } catch (error) {
    console.error(`[PLUGIN] Failed to load ${id}:`, error.message);
    registry.plugins.set(id, {
      id,
      status: 'error',
      error: error.message,
    });
    return null;
  }
}

/**
 * Load all discovered plugins
 */
async function loadAllPlugins(globalConfig = {}, extraDirs = []) {
  const candidates = discoverPlugins(extraDirs);
  const results = [];

  console.log(`[PLUGIN] Discovered ${candidates.length} plugin(s)`);

  for (const candidate of candidates) {
    // Check if enabled in config
    const pluginConfig = globalConfig.plugins?.[candidate.id];
    if (pluginConfig?.enabled === false) {
      console.log(`[PLUGIN] Skipped (disabled): ${candidate.id}`);
      continue;
    }

    const result = await loadPlugin(candidate, globalConfig);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// =============================================================================
// SERVICE MANAGEMENT
// =============================================================================

/**
 * Start all registered services
 */
async function startServices(context = {}) {
  for (const [id, service] of registry.services) {
    try {
      if (service.start) {
        await service.start(context);
        console.log(`[PLUGIN] Service started: ${id}`);
      }
    } catch (error) {
      console.error(`[PLUGIN] Service ${id} failed to start:`, error.message);
    }
  }
}

/**
 * Stop all registered services
 */
async function stopServices(context = {}) {
  for (const [id, service] of registry.services) {
    try {
      if (service.stop) {
        await service.stop(context);
        console.log(`[PLUGIN] Service stopped: ${id}`);
      }
    } catch (error) {
      console.error(`[PLUGIN] Service ${id} failed to stop:`, error.message);
    }
  }
}

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

/**
 * Execute a plugin command
 */
async function executeCommand(commandName, args, context = {}) {
  const command = registry.commands.get(commandName);

  if (!command) {
    return null; // Not a plugin command
  }

  try {
    return await command.handler({ args, ...context });
  } catch (error) {
    console.error(`[PLUGIN] Command ${commandName} failed:`, error.message);
    return { error: error.message };
  }
}

/**
 * Check if a command exists
 */
function hasCommand(commandName) {
  return registry.commands.has(commandName);
}

/**
 * List all registered commands
 */
function listCommands() {
  return Array.from(registry.commands.entries()).map(([name, cmd]) => ({
    name,
    description: cmd.description,
    pluginId: cmd.pluginId,
  }));
}

// =============================================================================
// STATUS & INFO
// =============================================================================

/**
 * Get plugin system status
 */
function getStatus() {
  return {
    plugins: Array.from(registry.plugins.values()),
    tools: Array.from(registry.tools.keys()),
    hooks: Object.fromEntries(
      Array.from(registry.hooks.entries()).map(([name, handlers]) => [
        name,
        handlers.length,
      ])
    ),
    commands: Array.from(registry.commands.keys()),
    services: Array.from(registry.services.keys()),
  };
}

/**
 * Get a specific tool
 */
function getTool(name) {
  return registry.tools.get(name);
}

/**
 * List all tools
 */
function listTools() {
  return Array.from(registry.tools.entries()).map(([name, tool]) => ({
    name,
    description: tool.description,
    pluginId: tool.pluginId,
  }));
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Discovery & Loading
  discoverPlugins,
  loadPlugin,
  loadAllPlugins,

  // Hooks
  registerHook,
  runHook,
  runVoidHook,
  HOOK_NAMES,

  // Commands
  executeCommand,
  hasCommand,
  listCommands,

  // Services
  startServices,
  stopServices,

  // Tools
  getTool,
  listTools,

  // Status
  getStatus,

  // Registry (for advanced use)
  registry,

  // Config
  CONFIG,
};

export default {
  loadAllPlugins,
  runHook,
  runVoidHook,
  executeCommand,
  getStatus,
};
