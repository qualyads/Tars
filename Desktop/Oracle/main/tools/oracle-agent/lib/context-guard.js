/**
 * Context Window Guard - Based on OpenClaw Pattern
 *
 * Monitors context usage and provides warnings/blocks when running low.
 * Prevents mid-response truncation disasters.
 *
 * Thresholds:
 * - Warning: < 32K tokens remaining
 * - Critical: < 16K tokens remaining (block new operations)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Token limits
  maxContextTokens: 200000,     // Claude's context window
  warningThreshold: 32000,      // Warn when less than this remaining
  criticalThreshold: 16000,     // Block when less than this remaining

  // Estimation (rough: 4 chars = 1 token for English, 2 for Thai)
  charsPerTokenEnglish: 4,
  charsPerTokenThai: 2,

  // Response buffer (reserve for response generation)
  responseBuffer: 8000,         // Tokens reserved for AI response
};

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate tokens in text (bilingual: English + Thai)
 */
function estimateTokens(text) {
  if (!text) return 0;

  // Count Thai characters
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  const otherChars = text.length - thaiChars;

  // Thai: ~2 chars per token, Other: ~4 chars per token
  return Math.ceil(thaiChars / CONFIG.charsPerTokenThai + otherChars / CONFIG.charsPerTokenEnglish);
}

/**
 * Estimate tokens in messages array
 */
function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;

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
 * Analyze current context usage
 */
function analyzeContext(messages, systemPrompt = '') {
  const systemTokens = estimateTokens(systemPrompt);
  const messagesTokens = estimateMessagesTokens(messages);
  const totalUsed = systemTokens + messagesTokens;
  const remaining = CONFIG.maxContextTokens - totalUsed - CONFIG.responseBuffer;

  const status = {
    totalUsed,
    remaining,
    maxTokens: CONFIG.maxContextTokens,
    usagePercent: Math.round((totalUsed / CONFIG.maxContextTokens) * 100),

    // Status flags
    isHealthy: remaining >= CONFIG.warningThreshold,
    isWarning: remaining < CONFIG.warningThreshold && remaining >= CONFIG.criticalThreshold,
    isCritical: remaining < CONFIG.criticalThreshold,

    // Breakdown
    breakdown: {
      system: systemTokens,
      messages: messagesTokens,
      reserved: CONFIG.responseBuffer
    },

    // Recommendations
    recommendations: []
  };

  // Add recommendations
  if (status.isCritical) {
    status.recommendations.push('CRITICAL: Context almost full. Summarize conversation immediately.');
    status.recommendations.push('Consider using /compact to summarize history.');
  } else if (status.isWarning) {
    status.recommendations.push('WARNING: Context getting low. Consider summarizing soon.');
    status.recommendations.push('Avoid loading large files or long outputs.');
  }

  return status;
}

/**
 * Check if operation should be blocked due to low context
 */
function shouldBlockOperation(messages, systemPrompt = '', operationCost = 0) {
  const analysis = analyzeContext(messages, systemPrompt);

  if (analysis.isCritical) {
    return {
      blocked: true,
      reason: 'Context window critically low',
      remaining: analysis.remaining,
      suggestion: 'Use /compact command to summarize conversation history'
    };
  }

  // Check if this operation would push us into critical
  if (analysis.remaining - operationCost < CONFIG.criticalThreshold) {
    return {
      blocked: true,
      reason: 'Operation would exceed safe context limits',
      remaining: analysis.remaining,
      operationCost,
      suggestion: 'Reduce operation size or summarize first'
    };
  }

  return { blocked: false };
}

// =============================================================================
// GUARD MIDDLEWARE
// =============================================================================

/**
 * Create guard middleware for message processing
 */
function createGuard(options = {}) {
  const config = { ...CONFIG, ...options };
  let lastWarningTime = 0;
  const WARNING_COOLDOWN = 60000; // 1 minute between warnings

  return {
    /**
     * Check before adding new message
     */
    beforeAdd(messages, newMessage, systemPrompt = '') {
      const newTokens = estimateTokens(
        typeof newMessage === 'string' ? newMessage : JSON.stringify(newMessage)
      );

      const check = shouldBlockOperation(messages, systemPrompt, newTokens);

      if (check.blocked) {
        return {
          allowed: false,
          ...check
        };
      }

      const analysis = analyzeContext(messages, systemPrompt);

      // Emit warning (with cooldown)
      const now = Date.now();
      if (analysis.isWarning && now - lastWarningTime > WARNING_COOLDOWN) {
        lastWarningTime = now;
        return {
          allowed: true,
          warning: true,
          message: `Context warning: ${analysis.remaining} tokens remaining (${analysis.usagePercent}% used)`,
          analysis
        };
      }

      return { allowed: true, analysis };
    },

    /**
     * Get current status
     */
    status(messages, systemPrompt = '') {
      return analyzeContext(messages, systemPrompt);
    },

    /**
     * Format status for display
     */
    formatStatus(messages, systemPrompt = '') {
      const status = analyzeContext(messages, systemPrompt);
      const bar = createProgressBar(status.usagePercent);

      let statusEmoji = '🟢';
      if (status.isCritical) statusEmoji = '🔴';
      else if (status.isWarning) statusEmoji = '🟡';

      return [
        `${statusEmoji} Context: ${bar} ${status.usagePercent}%`,
        `   Used: ${status.totalUsed.toLocaleString()} / ${status.maxTokens.toLocaleString()} tokens`,
        `   Remaining: ${status.remaining.toLocaleString()} tokens`,
        ...status.recommendations.map(r => `   ⚠️ ${r}`)
      ].join('\n');
    }
  };
}

/**
 * Create ASCII progress bar
 */
function createProgressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// =============================================================================
// COMPACTION TRIGGER
// =============================================================================

/**
 * Check if auto-compaction should trigger
 */
function shouldTriggerCompaction(messages, systemPrompt = '') {
  const analysis = analyzeContext(messages, systemPrompt);

  return {
    shouldCompact: analysis.isWarning || analysis.isCritical,
    urgency: analysis.isCritical ? 'critical' : analysis.isWarning ? 'warning' : 'none',
    analysis
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Core functions
  estimateTokens,
  estimateMessagesTokens,
  analyzeContext,
  shouldBlockOperation,

  // Guard
  createGuard,

  // Compaction trigger
  shouldTriggerCompaction,

  // Utilities
  createProgressBar,

  // Config
  CONFIG
};

export default {
  createGuard,
  analyzeContext,
  shouldBlockOperation
};
