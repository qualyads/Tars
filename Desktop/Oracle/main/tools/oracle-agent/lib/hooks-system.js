/**
 * Hooks System - Event-Driven Hooks จาก OpenClaw Pattern
 *
 * Features:
 * - Event registry (Map-based)
 * - Register/Unregister hooks
 * - Trigger events with error resilience
 * - Hook discovery from HOOK.md files
 * - Eligibility checking (env, config)
 *
 * @module hooks-system
 */

import fs from 'fs';
import path from 'path';

// ============================================================
// Constants
// ============================================================

/**
 * Event types ที่รองรับ
 */
export const EVENT_TYPES = {
  // Command events
  COMMAND: 'command',
  COMMAND_NEW: 'command:new',
  COMMAND_HELP: 'command:help',

  // Session events
  SESSION: 'session',
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  SESSION_COMPACT: 'session:compact',

  // Message events
  MESSAGE: 'message',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_SEND: 'message:send',
  MESSAGE_ERROR: 'message:error',

  // Agent events
  AGENT: 'agent',
  AGENT_BOOT: 'agent:boot',
  AGENT_SHUTDOWN: 'agent:shutdown',
  AGENT_ERROR: 'agent:error',

  // Tool events
  TOOL: 'tool',
  TOOL_CALL: 'tool:call',
  TOOL_RESULT: 'tool:result',
  TOOL_ERROR: 'tool:error',

  // LINE events
  LINE: 'line',
  LINE_WEBHOOK: 'line:webhook',
  LINE_PUSH: 'line:push',
  LINE_REPLY: 'line:reply',

  // Autonomy events
  AUTONOMY: 'autonomy',
  AUTONOMY_TRIGGER: 'autonomy:trigger',
  AUTONOMY_ACTION: 'autonomy:action',
  AUTONOMY_APPROVAL: 'autonomy:approval',
};

// ============================================================
// Hook Registry
// ============================================================

/**
 * Registry: Map<eventKey, handlers[]>
 * @type {Map<string, Function[]>}
 */
const hookRegistry = new Map();

/**
 * Hook metadata storage
 * @type {Map<string, object>}
 */
const hookMetadata = new Map();

// ============================================================
// Core Functions
// ============================================================

/**
 * Register a hook handler
 * @param {string} eventKey - Event key (e.g., 'message:receive')
 * @param {Function} handler - Handler function
 * @param {object} options - Options (priority, name)
 */
export function registerHook(eventKey, handler, options = {}) {
  if (typeof handler !== 'function') {
    throw new Error(`Handler must be a function, got ${typeof handler}`);
  }

  const { name = 'anonymous', priority = 0 } = options;

  if (!hookRegistry.has(eventKey)) {
    hookRegistry.set(eventKey, []);
  }

  const handlers = hookRegistry.get(eventKey);

  // Store with metadata
  const entry = {
    handler,
    name,
    priority,
    registeredAt: Date.now(),
  };

  handlers.push(entry);

  // Sort by priority (higher first)
  handlers.sort((a, b) => b.priority - a.priority);

  console.log(`[HOOKS] Registered "${name}" for event "${eventKey}"`);
  return () => unregisterHook(eventKey, handler);
}

/**
 * Unregister a hook handler
 * @param {string} eventKey - Event key
 * @param {Function} handler - Handler function to remove
 */
export function unregisterHook(eventKey, handler) {
  if (!hookRegistry.has(eventKey)) {
    return false;
  }

  const handlers = hookRegistry.get(eventKey);
  const index = handlers.findIndex((entry) => entry.handler === handler);

  if (index !== -1) {
    const removed = handlers.splice(index, 1)[0];
    console.log(`[HOOKS] Unregistered "${removed.name}" from event "${eventKey}"`);
    return true;
  }

  return false;
}

/**
 * Clear all hooks for an event (or all events)
 * @param {string} eventKey - Optional event key
 */
export function clearHooks(eventKey) {
  if (eventKey) {
    hookRegistry.delete(eventKey);
    console.log(`[HOOKS] Cleared all hooks for event "${eventKey}"`);
  } else {
    hookRegistry.clear();
    console.log(`[HOOKS] Cleared all hooks`);
  }
}

/**
 * Get registered event keys
 * @returns {string[]} List of event keys
 */
export function getRegisteredEvents() {
  return Array.from(hookRegistry.keys());
}

/**
 * Get handlers for an event
 * @param {string} eventKey - Event key
 * @returns {object[]} List of handler entries
 */
export function getHandlers(eventKey) {
  return hookRegistry.get(eventKey) || [];
}

// ============================================================
// Event Triggering
// ============================================================

/**
 * Create a hook event
 * @param {string} type - Event type
 * @param {string} action - Event action
 * @param {object} context - Event context
 * @returns {object} Hook event
 */
export function createEvent(type, action, context = {}) {
  return {
    type,
    action,
    key: `${type}:${action}`,
    context,
    timestamp: new Date(),
    messages: [], // Hooks can push messages back
    cancelled: false, // Hooks can cancel event
  };
}

/**
 * Trigger hooks for an event
 * Error resilient - continues even if a handler fails
 *
 * @param {object} event - Hook event
 * @returns {Promise<object>} Event with messages from hooks
 */
export async function triggerHook(event) {
  const { type, action, key } = event;

  // Collect handlers: type handlers + specific handlers
  const typeHandlers = hookRegistry.get(type) || [];
  const specificHandlers = hookRegistry.get(key) || [];
  const allHandlers = [...typeHandlers, ...specificHandlers];

  if (allHandlers.length === 0) {
    return event;
  }

  console.log(`[HOOKS] Triggering "${key}" (${allHandlers.length} handlers)`);

  for (const entry of allHandlers) {
    if (event.cancelled) {
      console.log(`[HOOKS] Event "${key}" was cancelled`);
      break;
    }

    try {
      await entry.handler(event);
    } catch (err) {
      console.error(`[HOOKS] Error in handler "${entry.name}" for "${key}":`, err.message);
      // Continue with other handlers - error resilient
    }
  }

  return event;
}

/**
 * Shorthand: trigger event by type and action
 * @param {string} type - Event type
 * @param {string} action - Event action
 * @param {object} context - Event context
 * @returns {Promise<object>} Event result
 */
export async function emit(type, action, context = {}) {
  const event = createEvent(type, action, context);
  return triggerHook(event);
}

// ============================================================
// Hook Discovery
// ============================================================

/**
 * Parse HOOK.md frontmatter
 * @param {string} content - File content
 * @returns {object} Parsed metadata
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  try {
    // Simple YAML-like parsing
    const yaml = match[1];
    const metadata = {};

    // Parse key: value pairs
    const lines = yaml.split('\n');
    let currentKey = null;

    for (const line of lines) {
      const keyMatch = line.match(/^(\w+):\s*(.*)$/);
      if (keyMatch) {
        const [, key, value] = keyMatch;
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value;
          }
        } else if (value === '') {
          currentKey = key;
          metadata[key] = {};
        } else {
          metadata[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }

    return metadata;
  } catch (err) {
    console.warn('[HOOKS] Failed to parse frontmatter:', err.message);
    return {};
  }
}

/**
 * Check if hook is eligible (requirements met)
 * @param {object} metadata - Hook metadata
 * @param {object} context - Current context (env, config)
 * @returns {object} Eligibility result
 */
function checkEligibility(metadata, context = {}) {
  const requires = metadata.requires || {};
  const missing = [];

  // Check required environment variables
  if (requires.env) {
    for (const envVar of requires.env) {
      if (!process.env[envVar]) {
        missing.push(`env:${envVar}`);
      }
    }
  }

  // Check required config values
  if (requires.config && context.config) {
    for (const configKey of requires.config) {
      const value = configKey.split('.').reduce((obj, key) => obj?.[key], context.config);
      if (value === undefined) {
        missing.push(`config:${configKey}`);
      }
    }
  }

  return {
    eligible: missing.length === 0,
    missing,
  };
}

/**
 * Discover hooks from a directory
 * @param {string} hooksDir - Directory to scan
 * @param {object} context - Context for eligibility checking
 * @returns {Promise<object[]>} Discovered hooks
 */
export async function discoverHooks(hooksDir, context = {}) {
  const discovered = [];

  if (!fs.existsSync(hooksDir)) {
    console.log(`[HOOKS] Directory not found: ${hooksDir}`);
    return discovered;
  }

  const entries = fs.readdirSync(hooksDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const hookDir = path.join(hooksDir, entry.name);
    const hookMdPath = path.join(hookDir, 'HOOK.md');
    const handlerPath = path.join(hookDir, 'handler.js');

    // Must have HOOK.md
    if (!fs.existsSync(hookMdPath)) {
      continue;
    }

    try {
      // Parse metadata
      const content = fs.readFileSync(hookMdPath, 'utf-8');
      const metadata = parseFrontmatter(content);

      // Check eligibility
      const eligibility = checkEligibility(metadata, context);

      const hookInfo = {
        id: entry.name,
        name: metadata.name || entry.name,
        description: metadata.description || '',
        events: metadata.events || [],
        path: hookDir,
        handlerPath: fs.existsSync(handlerPath) ? handlerPath : null,
        metadata,
        eligibility,
      };

      discovered.push(hookInfo);
    } catch (err) {
      console.warn(`[HOOKS] Failed to read hook "${entry.name}":`, err.message);
    }
  }

  console.log(`[HOOKS] Discovered ${discovered.length} hooks in ${hooksDir}`);
  return discovered;
}

/**
 * Load and register hooks from a directory
 * @param {string} hooksDir - Directory to scan
 * @param {object} context - Context for eligibility checking
 * @returns {Promise<object[]>} Loaded hooks
 */
export async function loadHooks(hooksDir, context = {}) {
  const discovered = await discoverHooks(hooksDir, context);
  const loaded = [];

  for (const hook of discovered) {
    // Skip ineligible hooks
    if (!hook.eligibility.eligible) {
      console.log(`[HOOKS] Skipping "${hook.id}" - missing: ${hook.eligibility.missing.join(', ')}`);
      continue;
    }

    // Skip hooks without handler
    if (!hook.handlerPath) {
      console.log(`[HOOKS] Skipping "${hook.id}" - no handler.js`);
      continue;
    }

    try {
      // Load handler module
      const handlerUrl = `file://${hook.handlerPath}?t=${Date.now()}`; // Cache busting
      const module = await import(handlerUrl);
      const handler = module.default || module.handler || module;

      if (typeof handler !== 'function') {
        console.warn(`[HOOKS] Hook "${hook.id}" has no valid handler function`);
        continue;
      }

      // Register for each event
      for (const eventKey of hook.events) {
        registerHook(eventKey, handler, { name: hook.id });
      }

      // Store metadata
      hookMetadata.set(hook.id, hook);
      loaded.push(hook);

      console.log(`[HOOKS] Loaded "${hook.id}" for events: ${hook.events.join(', ')}`);
    } catch (err) {
      console.error(`[HOOKS] Failed to load hook "${hook.id}":`, err.message);
    }
  }

  return loaded;
}

// ============================================================
// Status & Debugging
// ============================================================

/**
 * Get hooks status
 * @returns {object} Status report
 */
export function getHooksStatus() {
  const events = getRegisteredEvents();
  const status = {
    totalEvents: events.length,
    totalHandlers: 0,
    events: {},
  };

  for (const eventKey of events) {
    const handlers = getHandlers(eventKey);
    status.totalHandlers += handlers.length;
    status.events[eventKey] = handlers.map((h) => ({
      name: h.name,
      priority: h.priority,
      registeredAt: new Date(h.registeredAt).toISOString(),
    }));
  }

  return status;
}

/**
 * Print hooks status to console
 */
export function printHooksStatus() {
  const status = getHooksStatus();
  console.log('\n=== Hooks Status ===');
  console.log(`Total Events: ${status.totalEvents}`);
  console.log(`Total Handlers: ${status.totalHandlers}`);
  console.log('\nRegistered Events:');

  for (const [eventKey, handlers] of Object.entries(status.events)) {
    console.log(`  ${eventKey}: ${handlers.length} handler(s)`);
    for (const h of handlers) {
      console.log(`    - ${h.name} (priority: ${h.priority})`);
    }
  }
  console.log('');
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Register hooks for common events
 */
export function onMessage(handler, options) {
  return registerHook(EVENT_TYPES.MESSAGE, handler, options);
}

export function onMessageReceive(handler, options) {
  return registerHook(EVENT_TYPES.MESSAGE_RECEIVE, handler, options);
}

export function onMessageSend(handler, options) {
  return registerHook(EVENT_TYPES.MESSAGE_SEND, handler, options);
}

export function onSessionStart(handler, options) {
  return registerHook(EVENT_TYPES.SESSION_START, handler, options);
}

export function onSessionEnd(handler, options) {
  return registerHook(EVENT_TYPES.SESSION_END, handler, options);
}

export function onAgentBoot(handler, options) {
  return registerHook(EVENT_TYPES.AGENT_BOOT, handler, options);
}

export function onToolCall(handler, options) {
  return registerHook(EVENT_TYPES.TOOL_CALL, handler, options);
}

export function onAutonomyTrigger(handler, options) {
  return registerHook(EVENT_TYPES.AUTONOMY_TRIGGER, handler, options);
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  EVENT_TYPES,

  // Core functions
  registerHook,
  unregisterHook,
  clearHooks,
  getRegisteredEvents,
  getHandlers,

  // Event functions
  createEvent,
  triggerHook,
  emit,

  // Discovery
  discoverHooks,
  loadHooks,

  // Status
  getHooksStatus,
  printHooksStatus,

  // Convenience
  onMessage,
  onMessageReceive,
  onMessageSend,
  onSessionStart,
  onSessionEnd,
  onAgentBoot,
  onToolCall,
  onAutonomyTrigger,
};
