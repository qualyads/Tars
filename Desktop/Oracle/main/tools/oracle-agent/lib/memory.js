/**
 * Shared Memory System v2.0
 * Persistent storage for Oracle Agent
 * Bidirectional sync between Online Agent and Terminal
 *
 * Phase 2: Intelligence - Context Awareness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_FILE = path.join(__dirname, '..', 'memory.json');

// Default memory structure
const DEFAULT_MEMORY = {
  _meta: {
    version: '2.0.0',
    last_sync: null,
    sync_source: null  // 'terminal' or 'railway'
  },

  identity: {
    name: 'Oracle Agent',
    owner: 'Tars',
    created: new Date().toISOString()
  },

  context: {
    promotions: {},
    notes: [],
    settings: {},
    // Phase 2: Additional context
    current_focus: null,      // What Tars is currently working on
    active_projects: [],      // Active SaaS/business projects
    market_alerts: [],        // Investment alerts
    hotel_status: {}          // Today's check-ins/outs/occupancy
  },

  conversations: {},

  learnings: {
    common_questions: [],
    successful_responses: [],
    // Phase 2: Pattern learning
    user_preferences: {},     // What Tars prefers
    recurring_topics: []      // Topics that come up often
  },

  pending_approvals: [],

  // Phase 2: Sync queue for offline changes
  sync_queue: [],

  stats: {
    messages_handled: 0,
    briefings_sent: 0,
    last_active: null,
    // Phase 2: More stats
    api_calls: {},
    sync_count: 0
  }
};

/**
 * Load memory from file
 */
function load() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      return { ...DEFAULT_MEMORY, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[MEMORY] Load error:', error.message);
  }
  return { ...DEFAULT_MEMORY };
}

/**
 * Save memory to file
 */
function save(memory) {
  try {
    memory.stats.last_active = new Date().toISOString();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (error) {
    console.error('[MEMORY] Save error:', error.message);
  }
}

/**
 * Get all memory
 */
async function getAll() {
  return load();
}

/**
 * Update memory with new data
 */
async function update(data) {
  const memory = load();
  Object.assign(memory.context, data);
  save(memory);
  return memory;
}

/**
 * Get conversation history for a user
 */
async function getConversation(userId) {
  const memory = load();
  return memory.conversations[userId]?.messages || [];
}

/**
 * Save a conversation exchange
 */
async function saveConversation(userId, userMessage, agentResponse) {
  const memory = load();

  if (!memory.conversations[userId]) {
    memory.conversations[userId] = {
      first_contact: new Date().toISOString(),
      messages: []
    };
  }

  memory.conversations[userId].messages.push(
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: agentResponse, timestamp: new Date().toISOString() }
  );

  memory.conversations[userId].last_message = new Date().toISOString();

  // Keep only last 50 messages per user
  if (memory.conversations[userId].messages.length > 100) {
    memory.conversations[userId].messages =
      memory.conversations[userId].messages.slice(-100);
  }

  memory.stats.messages_handled++;
  save(memory);
}

/**
 * Get recent conversations summary
 */
async function getRecentConversations() {
  const memory = load();
  const recent = [];

  for (const [userId, conv] of Object.entries(memory.conversations)) {
    const lastMessages = conv.messages.slice(-2);
    recent.push({
      userId,
      lastMessage: conv.last_message,
      preview: lastMessages.map(m => m.content.substring(0, 50)).join(' | ')
    });
  }

  return recent.sort((a, b) =>
    new Date(b.lastMessage) - new Date(a.lastMessage)
  ).slice(0, 10);
}

/**
 * Add pending approval
 */
async function addPendingApproval(type, data) {
  const memory = load();
  memory.pending_approvals.push({
    id: Date.now().toString(),
    type,
    data,
    created: new Date().toISOString(),
    status: 'pending'
  });
  save(memory);
}

/**
 * Get pending approvals
 */
async function getPendingApprovals() {
  const memory = load();
  return memory.pending_approvals.filter(a => a.status === 'pending');
}

/**
 * Resolve pending approval
 */
async function resolveApproval(id, approved, note = '') {
  const memory = load();
  const approval = memory.pending_approvals.find(a => a.id === id);
  if (approval) {
    approval.status = approved ? 'approved' : 'rejected';
    approval.resolved = new Date().toISOString();
    approval.note = note;
  }
  save(memory);
  return approval;
}

/**
 * Add a note to context
 */
async function addNote(note) {
  const memory = load();
  memory.context.notes.push({
    content: note,
    created: new Date().toISOString()
  });
  save(memory);
}

/**
 * Update stats
 */
async function updateStats(key, value) {
  const memory = load();
  if (typeof value === 'number' && typeof memory.stats[key] === 'number') {
    memory.stats[key] += value;
  } else {
    memory.stats[key] = value;
  }
  save(memory);
}

/**
 * Get context for Claude
 */
async function getContextForClaude() {
  const memory = load();
  return {
    promotions: memory.context.promotions,
    recent_notes: memory.context.notes.slice(-5),
    settings: memory.context.settings
  };
}

// =============================================================================
// PHASE 2: SYNC FUNCTIONS
// =============================================================================

/**
 * Get sync status
 */
async function getSyncStatus() {
  const memory = load();
  return {
    version: memory._meta?.version || '1.0.0',
    last_sync: memory._meta?.last_sync,
    sync_source: memory._meta?.sync_source,
    pending_changes: memory.sync_queue?.length || 0,
    stats: memory.stats
  };
}

/**
 * Full sync - merge incoming data with local
 */
async function fullSync(incomingData, source = 'terminal') {
  const memory = load();

  // Merge strategy: newer wins, append arrays
  if (incomingData.context) {
    // Merge notes (append new ones)
    if (incomingData.context.notes) {
      const existingIds = new Set(memory.context.notes.map(n => n.created));
      const newNotes = incomingData.context.notes.filter(n => !existingIds.has(n.created));
      memory.context.notes = [...memory.context.notes, ...newNotes].slice(-100);
    }

    // Merge other context (overwrite)
    if (incomingData.context.promotions) memory.context.promotions = incomingData.context.promotions;
    if (incomingData.context.settings) memory.context.settings = { ...memory.context.settings, ...incomingData.context.settings };
    if (incomingData.context.current_focus) memory.context.current_focus = incomingData.context.current_focus;
    if (incomingData.context.active_projects) memory.context.active_projects = incomingData.context.active_projects;
    if (incomingData.context.market_alerts) memory.context.market_alerts = incomingData.context.market_alerts;
    if (incomingData.context.hotel_status) memory.context.hotel_status = incomingData.context.hotel_status;
  }

  // Merge learnings
  if (incomingData.learnings) {
    if (incomingData.learnings.user_preferences) {
      memory.learnings.user_preferences = { ...memory.learnings.user_preferences, ...incomingData.learnings.user_preferences };
    }
  }

  // Update sync metadata
  memory._meta = memory._meta || {};
  memory._meta.last_sync = new Date().toISOString();
  memory._meta.sync_source = source;
  memory.stats.sync_count = (memory.stats.sync_count || 0) + 1;

  // Clear sync queue after successful sync
  memory.sync_queue = [];

  save(memory);

  return {
    success: true,
    synced_at: memory._meta.last_sync,
    source: source
  };
}

/**
 * Queue a change for later sync (when offline)
 */
async function queueChange(changeType, data) {
  const memory = load();
  memory.sync_queue = memory.sync_queue || [];
  memory.sync_queue.push({
    type: changeType,
    data: data,
    timestamp: new Date().toISOString()
  });
  save(memory);
}

/**
 * Get pending sync queue
 */
async function getSyncQueue() {
  const memory = load();
  return memory.sync_queue || [];
}

/**
 * Update hotel status (from Beds24)
 */
async function updateHotelStatus(status) {
  const memory = load();
  memory.context.hotel_status = {
    ...status,
    updated: new Date().toISOString()
  };
  save(memory);
}

/**
 * Add market alert
 */
async function addMarketAlert(alert) {
  const memory = load();
  memory.context.market_alerts = memory.context.market_alerts || [];
  memory.context.market_alerts.unshift({
    ...alert,
    created: new Date().toISOString()
  });
  // Keep only last 20 alerts
  memory.context.market_alerts = memory.context.market_alerts.slice(0, 20);
  save(memory);
}

/**
 * Set current focus
 */
async function setCurrentFocus(focus) {
  const memory = load();
  memory.context.current_focus = {
    topic: focus,
    set_at: new Date().toISOString()
  };
  save(memory);
}

/**
 * Track API call
 */
async function trackApiCall(apiName) {
  const memory = load();
  memory.stats.api_calls = memory.stats.api_calls || {};
  memory.stats.api_calls[apiName] = (memory.stats.api_calls[apiName] || 0) + 1;
  save(memory);
}

/**
 * Get full context for intelligent responses
 */
async function getIntelligentContext() {
  const memory = load();
  return {
    // Current state
    current_focus: memory.context.current_focus,
    active_projects: memory.context.active_projects,
    hotel_status: memory.context.hotel_status,

    // Recent activity
    recent_notes: memory.context.notes.slice(-5),
    market_alerts: memory.context.market_alerts?.slice(0, 3) || [],
    pending_approvals: memory.pending_approvals.filter(a => a.status === 'pending'),

    // Learnings
    user_preferences: memory.learnings.user_preferences,

    // Stats
    messages_today: memory.stats.messages_handled,
    last_active: memory.stats.last_active
  };
}

export {
  load,
  save,
  getAll,
  update,
  getConversation,
  saveConversation,
  getRecentConversations,
  addPendingApproval,
  getPendingApprovals,
  resolveApproval,
  addNote,
  updateStats,
  getContextForClaude,
  getSyncStatus,
  fullSync,
  queueChange,
  getSyncQueue,
  updateHotelStatus,
  addMarketAlert,
  setCurrentFocus,
  trackApiCall,
  getIntelligentContext
};

export default {
  load,
  save,
  getAll,
  update,
  getConversation,
  saveConversation,
  getRecentConversations,
  addPendingApproval,
  getPendingApprovals,
  resolveApproval,
  addNote,
  updateStats,
  getContextForClaude,
  getSyncStatus,
  fullSync,
  queueChange,
  getSyncQueue,
  updateHotelStatus,
  addMarketAlert,
  setCurrentFocus,
  trackApiCall,
  getIntelligentContext
};
