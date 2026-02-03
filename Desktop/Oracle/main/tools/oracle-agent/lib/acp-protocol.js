/**
 * ACP Protocol - Agent Communication Protocol จาก OpenClaw Pattern
 *
 * Features:
 * - Request/Response/Event frames
 * - Session management with abort controllers
 * - Delta streaming tracking
 * - Tool call phases
 *
 * @module acp-protocol
 */

import crypto from 'crypto';

// ============================================================
// Protocol Constants
// ============================================================

/**
 * Protocol version
 */
export const PROTOCOL_VERSION = 1;

/**
 * Frame types
 */
export const FRAME_TYPES = {
  REQUEST: 'req',
  RESPONSE: 'res',
  EVENT: 'event',
  HELLO: 'hello',
  HELLO_OK: 'hello-ok',
};

/**
 * Session update types
 */
export const SESSION_UPDATE_TYPES = {
  AGENT_MESSAGE_CHUNK: 'agent_message_chunk',
  TOOL_CALL: 'tool_call',
  TOOL_CALL_UPDATE: 'tool_call_update',
  AVAILABLE_COMMANDS: 'available_commands_update',
};

/**
 * Tool kinds
 */
export const TOOL_KINDS = {
  READ: 'read',
  EDIT: 'edit',
  DELETE: 'delete',
  MOVE: 'move',
  SEARCH: 'search',
  EXECUTE: 'execute',
  FETCH: 'fetch',
  OTHER: 'other',
};

/**
 * Chat states
 */
export const CHAT_STATES = {
  DELTA: 'delta',
  FINAL: 'final',
  ABORTED: 'aborted',
  ERROR: 'error',
};

// ============================================================
// Frame Builders
// ============================================================

/**
 * Create request frame
 * @param {string} method
 * @param {object} params
 * @returns {object}
 */
export function createRequestFrame(method, params = {}) {
  return {
    type: FRAME_TYPES.REQUEST,
    id: crypto.randomUUID(),
    method,
    params,
  };
}

/**
 * Create response frame
 * @param {string} id - Request ID
 * @param {boolean} ok
 * @param {object} payload - Result if ok
 * @param {object} error - Error if not ok
 * @returns {object}
 */
export function createResponseFrame(id, ok, payload, error) {
  const frame = {
    type: FRAME_TYPES.RESPONSE,
    id,
    ok,
  };

  if (ok) {
    frame.payload = payload;
  } else {
    frame.error = error;
  }

  return frame;
}

/**
 * Create event frame
 * @param {string} event - Event name
 * @param {object} payload
 * @param {number} seq - Sequence number
 * @returns {object}
 */
export function createEventFrame(event, payload, seq) {
  return {
    type: FRAME_TYPES.EVENT,
    event,
    payload,
    seq,
  };
}

/**
 * Create error shape
 * @param {string} code
 * @param {string} message
 * @param {object} options
 * @returns {object}
 */
export function createError(code, message, options = {}) {
  return {
    code,
    message,
    details: options.details,
    retryable: options.retryable ?? false,
    retryAfterMs: options.retryAfterMs,
  };
}

// ============================================================
// Session Store
// ============================================================

/**
 * Create in-memory session store
 * @returns {object} Session store API
 */
export function createSessionStore() {
  const sessions = new Map();
  const runIdToSessionId = new Map();

  /**
   * Create new session
   * @param {object} params
   * @returns {object}
   */
  function createSession(params) {
    const {
      sessionId = crypto.randomUUID(),
      sessionKey,
      cwd = process.cwd(),
      metadata = {},
    } = params;

    const session = {
      sessionId,
      sessionKey,
      cwd,
      createdAt: Date.now(),
      abortController: null,
      activeRunId: null,
      metadata,
    };

    sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId
   * @returns {object|undefined}
   */
  function getSession(sessionId) {
    return sessions.get(sessionId);
  }

  /**
   * Get session by run ID
   * @param {string} runId
   * @returns {object|undefined}
   */
  function getSessionByRunId(runId) {
    const sessionId = runIdToSessionId.get(runId);
    return sessionId ? sessions.get(sessionId) : undefined;
  }

  /**
   * Get session by key
   * @param {string} sessionKey
   * @returns {object|undefined}
   */
  function getSessionByKey(sessionKey) {
    for (const session of sessions.values()) {
      if (session.sessionKey === sessionKey) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Set active run
   * @param {string} sessionId
   * @param {string} runId
   * @param {AbortController} abortController
   */
  function setActiveRun(sessionId, runId, abortController) {
    const session = sessions.get(sessionId);
    if (!session) return false;

    session.activeRunId = runId;
    session.abortController = abortController;
    runIdToSessionId.set(runId, sessionId);
    return true;
  }

  /**
   * Clear active run
   * @param {string} sessionId
   */
  function clearActiveRun(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return false;

    if (session.activeRunId) {
      runIdToSessionId.delete(session.activeRunId);
    }
    session.activeRunId = null;
    session.abortController = null;
    return true;
  }

  /**
   * Cancel active run
   * @param {string} sessionId
   * @returns {boolean}
   */
  function cancelActiveRun(sessionId) {
    const session = sessions.get(sessionId);
    if (!session?.abortController) return false;

    session.abortController.abort();
    clearActiveRun(sessionId);
    return true;
  }

  /**
   * Delete session
   * @param {string} sessionId
   */
  function deleteSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      if (session.activeRunId) {
        runIdToSessionId.delete(session.activeRunId);
      }
      sessions.delete(sessionId);
    }
  }

  /**
   * List all sessions
   * @returns {object[]}
   */
  function listSessions() {
    return Array.from(sessions.values()).map(s => ({
      sessionId: s.sessionId,
      sessionKey: s.sessionKey,
      createdAt: s.createdAt,
      hasActiveRun: !!s.activeRunId,
    }));
  }

  return {
    createSession,
    getSession,
    getSessionByRunId,
    getSessionByKey,
    setActiveRun,
    clearActiveRun,
    cancelActiveRun,
    deleteSession,
    listSessions,
  };
}

// ============================================================
// Delta Streaming Tracker
// ============================================================

/**
 * Create delta tracker for streaming
 * @returns {object} Tracker API
 */
export function createDeltaTracker() {
  const state = new Map();

  /**
   * Track and extract new content
   * @param {string} key - Session or run ID
   * @param {string} fullText - Complete text so far
   * @returns {string|null} New text to send
   */
  function track(key, fullText) {
    const sentSoFar = state.get(key) || 0;

    if (fullText.length > sentSoFar) {
      const newText = fullText.slice(sentSoFar);
      state.set(key, fullText.length);
      return newText;
    }

    return null;
  }

  /**
   * Reset tracking for key
   * @param {string} key
   */
  function reset(key) {
    state.delete(key);
  }

  /**
   * Get sent length
   * @param {string} key
   * @returns {number}
   */
  function getSentLength(key) {
    return state.get(key) || 0;
  }

  /**
   * Clear all
   */
  function clear() {
    state.clear();
  }

  return {
    track,
    reset,
    getSentLength,
    clear,
  };
}

// ============================================================
// Tool Call Management
// ============================================================

/**
 * Infer tool kind from name
 * @param {string} name
 * @returns {string}
 */
export function inferToolKind(name) {
  if (!name) return TOOL_KINDS.OTHER;

  const n = name.toLowerCase();

  if (n.includes('read') || n.includes('get') || n.includes('view')) {
    return TOOL_KINDS.READ;
  }
  if (n.includes('write') || n.includes('edit') || n.includes('update') || n.includes('set')) {
    return TOOL_KINDS.EDIT;
  }
  if (n.includes('delete') || n.includes('remove')) {
    return TOOL_KINDS.DELETE;
  }
  if (n.includes('move') || n.includes('rename')) {
    return TOOL_KINDS.MOVE;
  }
  if (n.includes('search') || n.includes('find') || n.includes('grep') || n.includes('glob')) {
    return TOOL_KINDS.SEARCH;
  }
  if (n.includes('exec') || n.includes('run') || n.includes('bash') || n.includes('shell')) {
    return TOOL_KINDS.EXECUTE;
  }
  if (n.includes('fetch') || n.includes('http') || n.includes('web') || n.includes('request')) {
    return TOOL_KINDS.FETCH;
  }

  return TOOL_KINDS.OTHER;
}

/**
 * Create tool call tracker
 * @returns {object} Tracker API
 */
export function createToolCallTracker() {
  const activeCalls = new Map(); // toolCallId → info
  const sessionCalls = new Map(); // sessionId → Set<toolCallId>

  /**
   * Start tool call
   * @param {object} params
   */
  function startCall(params) {
    const { toolCallId, sessionId, name, args, startedAt = Date.now() } = params;

    activeCalls.set(toolCallId, {
      toolCallId,
      sessionId,
      name,
      args,
      kind: inferToolKind(name),
      startedAt,
      status: 'in_progress',
    });

    if (!sessionCalls.has(sessionId)) {
      sessionCalls.set(sessionId, new Set());
    }
    sessionCalls.get(sessionId).add(toolCallId);
  }

  /**
   * Complete tool call
   * @param {string} toolCallId
   * @param {object} result
   * @param {boolean} isError
   */
  function completeCall(toolCallId, result, isError = false) {
    const call = activeCalls.get(toolCallId);
    if (!call) return null;

    call.result = result;
    call.isError = isError;
    call.status = isError ? 'failed' : 'completed';
    call.completedAt = Date.now();
    call.durationMs = call.completedAt - call.startedAt;

    // Remove from active
    activeCalls.delete(toolCallId);
    const sessionSet = sessionCalls.get(call.sessionId);
    if (sessionSet) {
      sessionSet.delete(toolCallId);
    }

    return call;
  }

  /**
   * Get active calls for session
   * @param {string} sessionId
   * @returns {object[]}
   */
  function getActiveCalls(sessionId) {
    const callIds = sessionCalls.get(sessionId);
    if (!callIds) return [];

    return Array.from(callIds).map(id => activeCalls.get(id)).filter(Boolean);
  }

  /**
   * Has active calls
   * @param {string} sessionId
   * @returns {boolean}
   */
  function hasActiveCalls(sessionId) {
    const callIds = sessionCalls.get(sessionId);
    return callIds ? callIds.size > 0 : false;
  }

  /**
   * Cancel all calls for session
   * @param {string} sessionId
   */
  function cancelSessionCalls(sessionId) {
    const callIds = sessionCalls.get(sessionId);
    if (!callIds) return;

    for (const toolCallId of callIds) {
      completeCall(toolCallId, { cancelled: true }, true);
    }
    sessionCalls.delete(sessionId);
  }

  return {
    startCall,
    completeCall,
    getActiveCalls,
    hasActiveCalls,
    cancelSessionCalls,
  };
}

// ============================================================
// Available Commands
// ============================================================

/**
 * Default available commands
 */
export const DEFAULT_COMMANDS = [
  { name: 'help', description: 'Show help and common commands' },
  { name: 'status', description: 'Show current status' },
  { name: 'context', description: 'Show context usage' },
  { name: 'think', description: 'Set thinking level (off|low|medium|high)' },
  { name: 'model', description: 'Select model' },
  { name: 'reset', description: 'Reset session' },
  { name: 'stop', description: 'Stop current run' },
];

/**
 * Create commands registry
 * @param {object[]} initial
 * @returns {object} Registry API
 */
export function createCommandsRegistry(initial = DEFAULT_COMMANDS) {
  const commands = new Map();

  for (const cmd of initial) {
    commands.set(cmd.name, cmd);
  }

  return {
    add: (name, description) => commands.set(name, { name, description }),
    remove: (name) => commands.delete(name),
    get: (name) => commands.get(name),
    list: () => Array.from(commands.values()),
    has: (name) => commands.has(name),
  };
}

// ============================================================
// Metadata Helpers
// ============================================================

/**
 * Read string from meta with fallback keys
 * @param {object} meta
 * @param {string[]} keys
 * @returns {string|undefined}
 */
export function readMetaString(meta, keys) {
  if (!meta) return undefined;

  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Read boolean from meta
 * @param {object} meta
 * @param {string[]} keys
 * @returns {boolean|undefined}
 */
export function readMetaBool(meta, keys) {
  if (!meta) return undefined;

  for (const key of keys) {
    if (typeof meta[key] === 'boolean') {
      return meta[key];
    }
  }
  return undefined;
}

/**
 * Read number from meta
 * @param {object} meta
 * @param {string[]} keys
 * @returns {number|undefined}
 */
export function readMetaNumber(meta, keys) {
  if (!meta) return undefined;

  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  PROTOCOL_VERSION,
  FRAME_TYPES,
  SESSION_UPDATE_TYPES,
  TOOL_KINDS,
  CHAT_STATES,
  DEFAULT_COMMANDS,

  // Frame builders
  createRequestFrame,
  createResponseFrame,
  createEventFrame,
  createError,

  // Session
  createSessionStore,

  // Streaming
  createDeltaTracker,

  // Tool calls
  inferToolKind,
  createToolCallTracker,

  // Commands
  createCommandsRegistry,

  // Meta helpers
  readMetaString,
  readMetaBool,
  readMetaNumber,
};
