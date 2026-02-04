/**
 * Memory Sync - Dual Master Architecture
 *
 * Both Terminal and Railway are Masters:
 * - Terminal stores in ψ/memory/ (git tracked, permanent)
 * - Railway stores in memory.json (cloud, always-on)
 * - Both sync bidirectionally
 * - Either can work independently
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For JSON imports
const require = createRequire(import.meta.url);

// Paths - use local PSI memory if available, otherwise use data/ folder (Railway)
const CONFIG_PATH = path.join(__dirname, '..', 'shared-config.json');
const LOCAL_PSI_PATH = '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory';
const RAILWAY_DATA_PATH = path.join(__dirname, '..', 'data', 'memory');
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT || !fs.existsSync(LOCAL_PSI_PATH);
const PSI_MEMORY_PATH = IS_RAILWAY ? RAILWAY_DATA_PATH : LOCAL_PSI_PATH;

// Ensure Railway data directory exists
if (IS_RAILWAY && !fs.existsSync(RAILWAY_DATA_PATH)) {
  fs.mkdirSync(RAILWAY_DATA_PATH, { recursive: true });
}

const MASTER_MEMORY_FILE = path.join(PSI_MEMORY_PATH, 'oracle-memory.json');
const CONVERSATIONS_FILE = path.join(PSI_MEMORY_PATH, 'logs', 'conversations.jsonl');
const KNOWLEDGE_FILE = path.join(PSI_MEMORY_PATH, 'resonance', 'knowledge.json');

// Load config
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.log('[SYNC] No shared-config.json, using defaults');
}

const RAILWAY_URL = config.railway?.url || 'https://oracle-agent-production-546e.up.railway.app';

// In-memory state
let memory = null;
let lastSyncTime = 0;

// =============================================================================
// FILE OPERATIONS (Local Master)
// =============================================================================

/**
 * Ensure directories exist
 */
function ensureDirectories() {
  const dirs = [
    PSI_MEMORY_PATH,
    path.join(PSI_MEMORY_PATH, 'logs'),
    path.join(PSI_MEMORY_PATH, 'resonance')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Load memory from local files (Terminal Master)
 */
function loadLocalMemory() {
  ensureDirectories();

  try {
    if (fs.existsSync(MASTER_MEMORY_FILE)) {
      memory = JSON.parse(fs.readFileSync(MASTER_MEMORY_FILE, 'utf8'));
      console.log('[MEMORY] Loaded from local:', MASTER_MEMORY_FILE);
      return memory;
    }
  } catch (e) {
    console.error('[MEMORY] Load error:', e.message);
  }

  // Initialize default memory
  memory = {
    _meta: {
      version: '2.0.0',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: 'terminal'
    },
    identity: {
      name: 'Oracle Agent',
      owner: 'Tars'
    },
    conversations: {},
    learnings: {
      patterns: [],
      preferences: {},
      topics: {}
    },
    knowledge: [],
    context: {
      current_focus: null,
      active_projects: [],
      notes: [],
      promotions: {},
      settings: {},
      market_alerts: [],
      hotel_status: {},
      pending_approvals: [],
      last_briefing: null,
      last_monitor: null
    },
    stats: {
      messages_handled: 0,
      sync_count: 0,
      last_active: null
    }
  };

  saveLocalMemory();
  return memory;
}

/**
 * Save memory to local files (Terminal Master)
 */
function saveLocalMemory() {
  ensureDirectories();

  try {
    memory._meta.lastModified = new Date().toISOString();
    fs.writeFileSync(MASTER_MEMORY_FILE, JSON.stringify(memory, null, 2));
    console.log('[MEMORY] Saved to local');
    return true;
  } catch (e) {
    console.error('[MEMORY] Save error:', e.message);
    return false;
  }
}

// =============================================================================
// RAILWAY SYNC (Cloud Master)
// =============================================================================

/**
 * Make request to Railway
 */
function railwayRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, RAILWAY_URL);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Sync with Railway (Bidirectional)
 */
async function syncWithRailway() {
  if (!memory) loadLocalMemory();

  try {
    console.log('[SYNC] Starting bidirectional sync...');

    // Push local to Railway
    const pushResult = await railwayRequest('/api/sync', 'POST', {
      action: 'full_sync',
      data: memory,
      source: 'terminal'
    });

    if (pushResult.status === 200 && pushResult.data.success) {
      // Merge Railway's response back (it may have newer data)
      if (pushResult.data.memory) {
        mergeMemory(pushResult.data.memory);
      }

      lastSyncTime = Date.now();
      memory.stats.sync_count = (memory.stats.sync_count || 0) + 1;
      saveLocalMemory();

      console.log('[SYNC] Bidirectional sync successful');
      return true;
    }

    console.log('[SYNC] Railway sync failed:', pushResult.data);
    return false;
  } catch (e) {
    console.log('[SYNC] Railway unavailable:', e.message);
    console.log('[SYNC] Working in offline mode (Terminal only)');
    return false;
  }
}

/**
 * Merge remote memory with local (newer wins)
 */
function mergeMemory(remoteMemory) {
  if (!remoteMemory) return;

  // Merge conversations (keep all, dedupe by timestamp)
  if (remoteMemory.conversations) {
    for (const [userId, conv] of Object.entries(remoteMemory.conversations)) {
      if (!memory.conversations[userId]) {
        memory.conversations[userId] = conv;
      } else {
        // Merge messages
        const localMsgs = memory.conversations[userId].messages || [];
        const remoteMsgs = conv.messages || [];

        // Simple merge by timestamp
        const allMsgs = [...localMsgs, ...remoteMsgs];
        const uniqueMsgs = allMsgs.filter((msg, idx, self) =>
          idx === self.findIndex(m => m.timestamp === msg.timestamp)
        );

        memory.conversations[userId].messages = uniqueMsgs.slice(-100);
        memory.conversations[userId].last_message =
          uniqueMsgs[uniqueMsgs.length - 1]?.timestamp || conv.last_message;
      }
    }
  }

  // Merge learnings (combine)
  if (remoteMemory.learnings?.preferences) {
    memory.learnings.preferences = {
      ...memory.learnings.preferences,
      ...remoteMemory.learnings.preferences
    };
  }

  // Merge knowledge (append unique)
  if (remoteMemory.knowledge) {
    const existingTimestamps = new Set(memory.knowledge.map(k => k.timestamp));
    const newKnowledge = remoteMemory.knowledge.filter(k => !existingTimestamps.has(k.timestamp));
    memory.knowledge = [...memory.knowledge, ...newKnowledge].slice(-500);
  }

  // Merge context (remote wins for active state)
  if (remoteMemory.context) {
    memory.context = {
      ...memory.context,
      ...remoteMemory.context
    };
  }

  // Stats: take max
  if (remoteMemory.stats) {
    memory.stats.messages_handled = Math.max(
      memory.stats.messages_handled || 0,
      remoteMemory.stats.messages_handled || 0
    );
  }
}

// =============================================================================
// CONVERSATION & LEARNING
// =============================================================================

/**
 * Save conversation (to both masters)
 */
async function saveConversation(userId, userMessage, botResponse, userName = null) {
  if (!memory) loadLocalMemory();

  // Initialize user if needed
  if (!memory.conversations[userId]) {
    memory.conversations[userId] = {
      name: userName || userId,
      first_contact: new Date().toISOString(),
      messages: []
    };
  }

  // Add message
  const entry = {
    timestamp: new Date().toISOString(),
    user: userMessage,
    bot: botResponse.substring(0, 2000)
  };

  memory.conversations[userId].messages.push(entry);
  memory.conversations[userId].last_message = entry.timestamp;

  // Keep last 100
  if (memory.conversations[userId].messages.length > 100) {
    memory.conversations[userId].messages =
      memory.conversations[userId].messages.slice(-100);
  }

  // Update stats
  memory.stats.messages_handled = (memory.stats.messages_handled || 0) + 1;
  memory.stats.last_active = new Date().toISOString();

  // Extract learnings
  extractLearnings(userId, userMessage);

  // Append to JSONL log (backup)
  appendToConversationLog(userId, entry);

  // Auto-extract knowledge from conversation
  autoExtractKnowledge(userMessage, botResponse, { userId, userName });

  // Save locally
  saveLocalMemory();

  // Async sync to Railway
  syncWithRailway().catch(() => {});

  return entry;
}

/**
 * Append to conversation log (JSONL format - append only)
 */
function appendToConversationLog(userId, entry) {
  try {
    const logEntry = { userId, ...entry };
    fs.appendFileSync(CONVERSATIONS_FILE, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    console.error('[LOG] Append error:', e.message);
  }
}

/**
 * Extract learnings from message
 */
function extractLearnings(userId, message) {
  const msg = message.toLowerCase();

  memory.learnings.preferences[userId] = memory.learnings.preferences[userId] || {
    interests: [],
    topics: {},
    active_hours: {}
  };

  const prefs = memory.learnings.preferences[userId];

  // Topic detection
  const topicKeywords = {
    gold: ['ทอง', 'gold', 'ราคาทอง'],
    crypto: ['bitcoin', 'btc', 'crypto', 'เหรียญ'],
    hotel: ['ห้อง', 'ที่พัก', 'hotel', 'booking', 'แขก', 'check-in'],
    investment: ['ลงทุน', 'หุ้น', 'stock', 'invest'],
    saas: ['keyforge', 'saas', 'project'],
    business: ['ธุรกิจ', 'business']
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => msg.includes(k))) {
      if (!prefs.interests.includes(topic)) {
        prefs.interests.push(topic);
      }
      prefs.topics[topic] = (prefs.topics[topic] || 0) + 1;
    }
  }

  // Time pattern
  const hour = new Date().getHours();
  prefs.active_hours[hour] = (prefs.active_hours[hour] || 0) + 1;
}

/**
 * Add knowledge entry
 */
function addKnowledge(topic, content, source = 'manual', metadata = {}) {
  if (!memory) loadLocalMemory();

  const entry = {
    timestamp: new Date().toISOString(),
    topic,
    content,
    source,
    ...metadata
  };

  memory.knowledge.push(entry);

  // Keep last 500
  if (memory.knowledge.length > 500) {
    memory.knowledge = memory.knowledge.slice(-500);
  }

  saveLocalMemory();
  syncWithRailway().catch(() => {});

  // Also save to knowledge.json
  try {
    let knowledgeFile = [];
    if (fs.existsSync(KNOWLEDGE_FILE)) {
      knowledgeFile = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
    }
    knowledgeFile.push(entry);
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledgeFile, null, 2));
  } catch (e) {}

  console.log(`[KNOWLEDGE] Saved: ${topic} - ${content.substring(0, 50)}...`);
  return entry;
}

// =============================================================================
// KNOWLEDGE CATEGORIES (Auto-capture)
// =============================================================================

const KNOWLEDGE_CATEGORIES = {
  api: { keywords: ['api', 'endpoint', 'token', 'authentication', 'webhook'], priority: 'high' },
  business: { keywords: ['revenue', 'profit', 'opportunity', 'ธุรกิจ', 'โอกาส', 'ขาย'], priority: 'high' },
  technical: { keywords: ['error', 'fix', 'bug', 'solution', 'code', 'deploy'], priority: 'medium' },
  preference: { keywords: ['ชอบ', 'ไม่ชอบ', 'prefer', 'style', 'อยาก'], priority: 'medium' },
  contact: { keywords: ['email', 'phone', 'line', 'contact', 'ติดต่อ'], priority: 'high' },
  price: { keywords: ['ราคา', 'price', 'cost', 'บาท', '$', 'thb'], priority: 'medium' },
  hotel: { keywords: ['booking', 'check-in', 'guest', 'room', 'ห้อง', 'แขก'], priority: 'medium' }
};

/**
 * Auto-detect and save knowledge from conversation
 */
function autoExtractKnowledge(message, response, context = {}) {
  if (!memory) loadLocalMemory();

  const combinedText = `${message} ${response}`.toLowerCase();
  const extracted = [];

  // Check each category
  for (const [category, config] of Object.entries(KNOWLEDGE_CATEGORIES)) {
    const matchedKeywords = config.keywords.filter(k => combinedText.includes(k));

    if (matchedKeywords.length >= 2 || (config.priority === 'high' && matchedKeywords.length >= 1)) {
      // Extract potential knowledge
      const knowledge = extractKnowledgeContent(message, response, category, matchedKeywords);

      if (knowledge && knowledge.length > 10) {
        extracted.push({
          category,
          content: knowledge,
          keywords: matchedKeywords,
          priority: config.priority
        });
      }
    }
  }

  // Save extracted knowledge
  for (const item of extracted) {
    // Check if similar knowledge already exists (avoid duplicates)
    const isDuplicate = memory.knowledge.some(k =>
      k.topic === item.category &&
      similarity(k.content, item.content) > 0.8
    );

    if (!isDuplicate) {
      addKnowledge(item.category, item.content, 'auto-extract', {
        keywords: item.keywords,
        priority: item.priority,
        context: context.userId || 'unknown'
      });
    }
  }

  return extracted;
}

/**
 * Extract knowledge content from message/response
 */
function extractKnowledgeContent(message, response, category, keywords) {
  // For API category, look for endpoints/tokens
  if (category === 'api') {
    const urlMatch = response.match(/https?:\/\/[^\s"']+/g);
    if (urlMatch) {
      return `API Endpoint: ${urlMatch[0]}`;
    }
    const endpointMatch = response.match(/\/api\/[^\s"']+/g);
    if (endpointMatch) {
      return `Endpoint: ${endpointMatch[0]}`;
    }
  }

  // For business, extract opportunity descriptions
  if (category === 'business') {
    const lines = response.split('\n').filter(l =>
      keywords.some(k => l.toLowerCase().includes(k))
    );
    if (lines.length > 0) {
      return lines.slice(0, 3).join(' | ');
    }
  }

  // For price, extract numbers with currency
  if (category === 'price') {
    const priceMatch = response.match(/[\d,]+\s*(บาท|thb|\$|usd)/gi);
    if (priceMatch) {
      return `Price info: ${priceMatch.join(', ')}`;
    }
  }

  // Default: extract sentences containing keywords
  const sentences = response.split(/[.!?。]/);
  const relevant = sentences.filter(s =>
    keywords.some(k => s.toLowerCase().includes(k))
  ).slice(0, 2);

  return relevant.join('. ').trim();
}

/**
 * Simple similarity check (Jaccard)
 */
function similarity(str1, str2) {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

/**
 * Manually save important knowledge (called by Claude)
 */
function saveImportantKnowledge(topic, content, reason = '') {
  return addKnowledge(topic, content, 'manual-important', {
    reason,
    priority: 'high',
    savedBy: 'oracle'
  });
}

/**
 * Get knowledge by category
 */
function getKnowledgeByCategory(category) {
  if (!memory) loadLocalMemory();
  return memory.knowledge.filter(k => k.topic === category);
}

/**
 * Search knowledge
 */
function searchKnowledge(query) {
  if (!memory) loadLocalMemory();
  const q = query.toLowerCase();
  return memory.knowledge.filter(k =>
    k.content.toLowerCase().includes(q) ||
    k.topic.toLowerCase().includes(q) ||
    (k.keywords && k.keywords.some(kw => kw.includes(q)))
  );
}

// =============================================================================
// GETTERS
// =============================================================================

function getMemory() {
  if (!memory) loadLocalMemory();
  return memory;
}

function getConversations(userId = null, limit = 10) {
  if (!memory) loadLocalMemory();

  if (userId) {
    return memory.conversations[userId]?.messages?.slice(-limit) || [];
  }
  return memory.conversations;
}

function getLearnings(userId = null) {
  if (!memory) loadLocalMemory();

  if (userId) {
    return memory.learnings.preferences[userId] || {};
  }
  return memory.learnings;
}

function getKnowledge(topic = null) {
  if (!memory) loadLocalMemory();

  if (topic) {
    return memory.knowledge.filter(k => k.topic === topic);
  }
  return memory.knowledge;
}

function getContext() {
  if (!memory) loadLocalMemory();
  return memory.context;
}

function setContext(key, value) {
  if (!memory) loadLocalMemory();
  memory.context[key] = value;
  saveLocalMemory();
}

function getStats() {
  if (!memory) loadLocalMemory();
  return {
    ...memory.stats,
    lastSync: lastSyncTime ? new Date(lastSyncTime).toISOString() : null,
    localFile: MASTER_MEMORY_FILE,
    railwayUrl: RAILWAY_URL
  };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function initialize() {
  console.log('[MEMORY] Initializing Dual Master Memory System...');
  console.log('[MEMORY] Local Master:', MASTER_MEMORY_FILE);
  console.log('[MEMORY] Cloud Master:', RAILWAY_URL);

  loadLocalMemory();
  await syncWithRailway();

  // Auto-sync every 5 minutes
  setInterval(() => {
    syncWithRailway().catch(() => {});
  }, 5 * 60 * 1000);

  console.log('[MEMORY] Initialized successfully');
  return memory;
}

// =============================================================================
// EXPORTS
// =============================================================================

const paths = {
  memory: MASTER_MEMORY_FILE,
  conversations: CONVERSATIONS_FILE,
  knowledge: KNOWLEDGE_FILE,
  psiMemory: PSI_MEMORY_PATH
};

export {
  initialize,
  loadLocalMemory,
  saveLocalMemory,
  syncWithRailway,
  saveConversation,
  addKnowledge,
  getMemory,
  getConversations,
  getLearnings,
  getKnowledge,
  getContext,
  setContext,
  getStats,
  config,
  autoExtractKnowledge,
  saveImportantKnowledge,
  getKnowledgeByCategory,
  searchKnowledge,
  KNOWLEDGE_CATEGORIES,
  paths
};

export default {
  initialize,
  loadLocalMemory,
  saveLocalMemory,
  syncWithRailway,
  saveConversation,
  addKnowledge,
  getMemory,
  getConversations,
  getLearnings,
  getKnowledge,
  getContext,
  setContext,
  getStats,
  config,
  autoExtractKnowledge,
  saveImportantKnowledge,
  getKnowledgeByCategory,
  searchKnowledge,
  KNOWLEDGE_CATEGORIES,
  paths
};
