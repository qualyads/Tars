/**
 * Oracle Session Memory
 *
 * จัดการ session persistence เพื่อไม่ให้ "ลืม" ข้าม session
 *
 * Pattern จาก OpenClaw:
 * 1. SessionEntry (preferences) → oracle-session.json
 * 2. Learnings (accumulated) → session-learnings.md
 * 3. Auto-summarize → เพิ่ม learnings หลัง session สำคัญ
 */

import fs from 'fs';
import path from 'path';

const MEMORY_BASE = '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory';
const SESSION_FILE = path.join(MEMORY_BASE, 'oracle-session.json');
const LEARNINGS_FILE = path.join(MEMORY_BASE, 'resonance/session-learnings.md');

/**
 * Load current session state
 */
export function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('[SESSION] Error loading session:', error.message);
  }
  return null;
}

/**
 * Save session state
 */
export function saveSession(session) {
  try {
    session.lastUpdated = Date.now();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log('[SESSION] Saved session state');
    return true;
  } catch (error) {
    console.error('[SESSION] Error saving session:', error.message);
    return false;
  }
}

/**
 * Update specific preference
 */
export function updatePreference(key, value) {
  const session = loadSession();
  if (!session) return false;

  if (!session.preferences) session.preferences = {};
  session.preferences[key] = value;

  return saveSession(session);
}

/**
 * Add a learning to session
 */
export function addLearning(category, learning) {
  const session = loadSession();
  if (!session) return false;

  if (!session.learnings) session.learnings = {};
  if (!session.learnings[category]) session.learnings[category] = [];

  // Avoid duplicates
  if (!session.learnings[category].includes(learning)) {
    session.learnings[category].push(learning);
  }

  return saveSession(session);
}

/**
 * Update context (current focus, recent topics, etc.)
 */
export function updateContext(updates) {
  const session = loadSession();
  if (!session) return false;

  if (!session.context) session.context = {};
  Object.assign(session.context, updates);

  return saveSession(session);
}

/**
 * Record a session summary to learnings file
 * Call this at the end of important sessions
 */
export function recordSessionSummary({
  date = new Date().toISOString().split('T')[0],
  title,
  keyDecisions = [],
  keyLearnings = [],
  openQuestions = [],
  nextActions = []
}) {
  try {
    const entry = `
### ${date}: ${title}

**Key Decisions:**
${keyDecisions.map(d => `- ${d}`).join('\n')}

**Key Learnings:**
${keyLearnings.map(l => `- ${l}`).join('\n')}

**Open Questions:**
${openQuestions.map(q => `- [ ] ${q}`).join('\n')}

**Next Actions:**
${nextActions.map(a => `- [ ] ${a}`).join('\n')}

---
`;

    // Read existing file
    let content = '';
    if (fs.existsSync(LEARNINGS_FILE)) {
      content = fs.readFileSync(LEARNINGS_FILE, 'utf-8');
    }

    // Find the "## 📚 Session Logs" section and append after it
    const sessionLogsMarker = '## 📚 Session Logs';
    const insertIndex = content.indexOf(sessionLogsMarker);

    if (insertIndex !== -1) {
      const afterMarker = content.indexOf('\n', insertIndex) + 1;
      content = content.slice(0, afterMarker) + entry + content.slice(afterMarker);
    } else {
      // Append at end if section not found
      content += '\n' + entry;
    }

    // Update last updated timestamp
    content = content.replace(
      /\*Last Updated:.*\*/,
      `*Last Updated: ${new Date().toISOString()}*`
    );

    fs.writeFileSync(LEARNINGS_FILE, content);
    console.log('[SESSION] Recorded session summary');
    return true;

  } catch (error) {
    console.error('[SESSION] Error recording summary:', error.message);
    return false;
  }
}

/**
 * Get context for new session start
 * Returns relevant info to include in AI prompt
 */
export function getSessionContext() {
  const session = loadSession();
  if (!session) return null;

  return {
    owner: session.owner,
    preferences: session.preferences,
    recentTopics: session.context?.recentTopics || [],
    currentFocus: session.context?.currentFocus,
    openQuestions: session.context?.openQuestions || [],
    keyLearnings: Object.values(session.learnings || {}).flat().slice(-10) // Last 10 learnings
  };
}

/**
 * Generate a summary prompt for AI to summarize a session
 */
export function generateSummaryPrompt(conversationHistory) {
  return `
Please summarize this conversation session. Extract:

1. **Key Decisions** - What was decided? What direction was chosen?
2. **Key Learnings** - What new knowledge or insights emerged?
3. **Open Questions** - What remains unanswered or needs follow-up?
4. **Next Actions** - What should be done next?

Format as JSON:
{
  "title": "Brief session title",
  "keyDecisions": ["decision 1", "decision 2"],
  "keyLearnings": ["learning 1", "learning 2"],
  "openQuestions": ["question 1", "question 2"],
  "nextActions": ["action 1", "action 2"]
}

Conversation:
${conversationHistory}
`;
}

// CLI interface
if (process.argv[1].includes('session-memory.js')) {
  const command = process.argv[2];

  switch (command) {
    case 'load':
      console.log(JSON.stringify(loadSession(), null, 2));
      break;

    case 'context':
      console.log(JSON.stringify(getSessionContext(), null, 2));
      break;

    case 'add-learning':
      const category = process.argv[3];
      const learning = process.argv[4];
      if (category && learning) {
        addLearning(category, learning);
        console.log(`Added learning to ${category}`);
      } else {
        console.log('Usage: node session-memory.js add-learning <category> <learning>');
      }
      break;

    case 'record-summary':
      // Example usage
      recordSessionSummary({
        title: 'Example Session',
        keyDecisions: ['Decision 1'],
        keyLearnings: ['Learning 1'],
        openQuestions: ['Question 1'],
        nextActions: ['Action 1']
      });
      break;

    default:
      console.log(`
Oracle Session Memory

Commands:
  load           - Load current session state
  context        - Get context for new session
  add-learning   - Add a learning (category, text)
  record-summary - Record a session summary

Example:
  node session-memory.js load
  node session-memory.js add-learning communication "Tars likes concise answers"
`);
  }
}

export default {
  loadSession,
  saveSession,
  updatePreference,
  addLearning,
  updateContext,
  recordSessionSummary,
  getSessionContext,
  generateSummaryPrompt
};
