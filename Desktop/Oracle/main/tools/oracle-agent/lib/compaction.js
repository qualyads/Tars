/**
 * Auto-Compaction System - Based on OpenClaw Pattern
 *
 * Automatically summarizes conversation history when context gets too long.
 * Preserves: decisions, TODOs, open questions, key facts.
 * Removes: verbose explanations, repeated information.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Context limits
  maxContextTokens: 100000,     // Max before compaction
  targetContextTokens: 60000,   // Target after compaction
  warningThreshold: 0.8,        // Warn at 80%
  compactionThreshold: 0.9,     // Compact at 90%

  // Chunking
  chunkRatio: 0.4,              // Process 40% of context at a time
  minChunkRatio: 0.15,          // Minimum 15%
  safetyMargin: 1.2,            // 20% buffer for estimation

  // Preservation rules
  preserveLastN: 5,             // Always keep last N messages
  preservePatterns: [
    /decision:|decided:|ตัดสินใจ:/i,
    /todo:|task:|ต้องทำ:/i,
    /question:|คำถาม:|ถาม:/i,
    /important:|สำคัญ:|key:/i,
    /error:|bug:|ปัญหา:/i,
    /\[ \]|\[x\]/i,  // Checkboxes
  ]
};

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate tokens in text (~4 chars per token for English, ~2 for Thai)
 */
function estimateTokens(text) {
  if (!text) return 0;

  // Count Thai characters
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const otherChars = text.length - thaiChars;

  // Thai: ~2 chars per token, Other: ~4 chars per token
  return Math.ceil(thaiChars / 2 + otherChars / 4);
}

/**
 * Estimate tokens in messages array
 */
function estimateMessagesTokens(messages) {
  return messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    return sum + estimateTokens(content) + 10; // +10 for message overhead
  }, 0);
}

// =============================================================================
// CONTEXT ANALYSIS
// =============================================================================

/**
 * Analyze context usage
 */
function analyzeContext(messages, maxTokens = CONFIG.maxContextTokens) {
  const tokens = estimateMessagesTokens(messages);
  const usage = tokens / maxTokens;

  return {
    tokens,
    maxTokens,
    usage,
    usagePercent: Math.round(usage * 100),
    shouldWarn: usage >= CONFIG.warningThreshold,
    shouldCompact: usage >= CONFIG.compactionThreshold,
    messagesCount: messages.length
  };
}

/**
 * Check if a message should be preserved
 */
function shouldPreserve(message) {
  const content = typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content);

  return CONFIG.preservePatterns.some(pattern => pattern.test(content));
}

// =============================================================================
// COMPACTION
// =============================================================================

/**
 * Extract important content from messages
 */
function extractImportant(messages) {
  const important = [];

  for (const msg of messages) {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);

    // Check each line
    const lines = content.split('\n');
    const preservedLines = [];

    for (const line of lines) {
      if (CONFIG.preservePatterns.some(p => p.test(line))) {
        preservedLines.push(line);
      }
    }

    if (preservedLines.length > 0) {
      important.push({
        role: msg.role,
        content: preservedLines.join('\n'),
        preserved: true
      });
    }
  }

  return important;
}

/**
 * Generate summary of messages
 */
function generateSummaryPrompt(messages) {
  const content = messages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    return `${role}: ${text}`;
  }).join('\n\n');

  return `Summarize this conversation, preserving:
- All decisions made
- All TODOs and tasks
- All open questions
- Key facts and numbers
- Error messages and solutions

Be concise but complete. Output in the same language as the input.

---
${content}
---

Summary:`;
}

/**
 * Compact messages array
 */
async function compactMessages(messages, options = {}) {
  const analysis = analyzeContext(messages, options.maxTokens);

  if (!analysis.shouldCompact && !options.force) {
    return {
      compacted: false,
      reason: 'Below threshold',
      analysis
    };
  }

  console.log(`[COMPACTION] Starting compaction (${analysis.usagePercent}% usage)`);

  // Always preserve last N messages
  const preserved = messages.slice(-CONFIG.preserveLastN);
  const toCompact = messages.slice(0, -CONFIG.preserveLastN);

  if (toCompact.length === 0) {
    return {
      compacted: false,
      reason: 'Not enough messages to compact',
      analysis
    };
  }

  // Extract important content
  const important = extractImportant(toCompact);

  // Generate summary prompt (to be sent to Claude)
  const summaryPrompt = generateSummaryPrompt(toCompact);

  // If no summarizer provided, return the prompt for manual summarization
  if (!options.summarize) {
    return {
      compacted: false,
      reason: 'No summarizer provided',
      summaryPrompt,
      important,
      preserved,
      analysis
    };
  }

  // Call summarizer
  try {
    const summary = await options.summarize(summaryPrompt);

    // Build compacted messages
    const compactedMessages = [
      {
        role: 'system',
        content: `Previous conversation summary:\n\n${summary}\n\nImportant items preserved:\n${important.map(i => i.content).join('\n')}`
      },
      ...preserved
    ];

    const newAnalysis = analyzeContext(compactedMessages, options.maxTokens);

    console.log(`[COMPACTION] Complete: ${analysis.tokens} → ${newAnalysis.tokens} tokens`);

    return {
      compacted: true,
      messages: compactedMessages,
      summary,
      important,
      before: analysis,
      after: newAnalysis,
      savedTokens: analysis.tokens - newAnalysis.tokens
    };
  } catch (error) {
    console.error('[COMPACTION] Failed:', error.message);
    return {
      compacted: false,
      reason: error.message,
      analysis
    };
  }
}

/**
 * Smart chunk splitting for large contexts
 */
function splitMessagesByTokenShare(messages, parts = 2) {
  const totalTokens = estimateMessagesTokens(messages);
  const targetTokens = totalTokens / parts;

  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const msg of messages) {
    const msgTokens = estimateTokens(
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    );

    if (currentTokens + msgTokens > targetTokens && current.length > 0) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }

    current.push(msg);
    currentTokens += msgTokens;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Analysis
  estimateTokens,
  estimateMessagesTokens,
  analyzeContext,
  shouldPreserve,

  // Compaction
  compactMessages,
  extractImportant,
  generateSummaryPrompt,
  splitMessagesByTokenShare,

  // Config
  CONFIG
};

export default {
  analyzeContext,
  compactMessages,
  estimateTokens
};
