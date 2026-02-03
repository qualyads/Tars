/**
 * Status Builder - Based on OpenClaw Pattern
 *
 * Build comprehensive status messages showing:
 * - Model info
 * - Context usage
 * - Session info
 * - Queue status
 * - Options (think level, verbose, etc.)
 */

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Format token count (e.g., 1500 -> "1.5K")
 */
function formatTokenCount(count) {
  if (count == null) return '?';
  if (count < 1000) return String(count);
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Format context usage
 */
function formatContextUsage(used, total) {
  const usedLabel = formatTokenCount(used);
  const totalLabel = formatTokenCount(total);
  const pct = total ? Math.round((used / total) * 100) : null;
  return pct !== null
    ? `${usedLabel}/${totalLabel} (${pct}%)`
    : `${usedLabel}/${totalLabel}`;
}

/**
 * Format age from timestamp
 */
function formatAge(ms) {
  if (!ms || ms < 0) return 'unknown';

  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Format duration in ms
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

/**
 * Format USD cost
 */
function formatUsd(cost) {
  if (cost == null) return '?';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

// =============================================================================
// PROGRESS BAR
// =============================================================================

/**
 * Create ASCII progress bar
 */
function createProgressBar(percent, width = 20) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// =============================================================================
// STATUS BUILDER
// =============================================================================

/**
 * Build status message from args
 */
function buildStatusMessage(args = {}) {
  const lines = [];

  // Version line
  const version = args.version || 'Oracle v3.3.0';
  lines.push(`🦞 ${version}`);

  // Time line (optional)
  if (args.timeLine) {
    lines.push(args.timeLine);
  }

  // Model line
  const provider = args.provider || 'anthropic';
  const model = args.model || 'claude-3-5-sonnet';
  const modelLabel = `${provider}/${model}`;
  const authLabel = args.authMode ? ` · 🔑 ${args.authMode}` : '';
  lines.push(`🧠 Model: ${modelLabel}${authLabel}`);

  // Usage/cost line
  if (args.inputTokens != null || args.outputTokens != null) {
    const inputLabel = formatTokenCount(args.inputTokens);
    const outputLabel = formatTokenCount(args.outputTokens);
    let usageLine = `🧮 Tokens: ${inputLabel} in / ${outputLabel} out`;

    if (args.cost != null) {
      usageLine += ` · 💵 ${formatUsd(args.cost)}`;
    }
    lines.push(usageLine);
  }

  // Context line
  const contextUsed = args.contextUsed || 0;
  const contextMax = args.contextMax || 200000;
  const compactionCount = args.compactionCount || 0;
  lines.push(`📚 Context: ${formatContextUsage(contextUsed, contextMax)} · 🧹 Compactions: ${compactionCount}`);

  // Session line
  const sessionKey = args.sessionKey || 'unknown';
  const updatedAt = args.updatedAt;
  const now = args.now || Date.now();
  const ageLabel = updatedAt ? `updated ${formatAge(now - updatedAt)}` : 'no activity';
  lines.push(`🧵 Session: ${sessionKey} • ${ageLabel}`);

  // Options line
  const optionParts = [];
  optionParts.push(`Think: ${args.thinkLevel || 'off'}`);
  if (args.verboseLevel && args.verboseLevel !== 'off') {
    optionParts.push(`Verbose: ${args.verboseLevel}`);
  }
  lines.push(`⚙️ ${optionParts.join(' · ')}`);

  // Queue line (if provided)
  if (args.queueMode) {
    let queueLine = `🪢 Queue: ${args.queueMode}`;
    if (args.queueDepth != null) {
      queueLine += ` (depth ${args.queueDepth})`;
    }
    lines.push(queueLine);
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Build help message
 */
function buildHelpMessage() {
  return `ℹ️ Help

Session
  /new  |  /reset  |  /compact  |  /stop

Options
  /think <level>  |  /model <id>  |  /verbose on|off

Status
  /status  |  /context

Skills
  /skill <name> [input]

More: /commands for full list`;
}

/**
 * Build context status
 */
function buildContextStatus(args = {}) {
  const used = args.used || 0;
  const max = args.max || 200000;
  const percent = Math.round((used / max) * 100);
  const bar = createProgressBar(percent);

  let statusEmoji = '🟢';
  if (percent >= 90) statusEmoji = '🔴';
  else if (percent >= 80) statusEmoji = '🟡';

  const lines = [
    `${statusEmoji} Context: ${bar} ${percent}%`,
    `   Used: ${formatTokenCount(used)} / ${formatTokenCount(max)} tokens`,
    `   Remaining: ${formatTokenCount(max - used)} tokens`,
  ];

  if (percent >= 90) {
    lines.push('   ⚠️ CRITICAL: Consider using /compact');
  } else if (percent >= 80) {
    lines.push('   ⚠️ WARNING: Context getting full');
  }

  return lines.join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Formatters
  formatTokenCount,
  formatContextUsage,
  formatAge,
  formatDuration,
  formatUsd,

  // Progress bar
  createProgressBar,

  // Status builders
  buildStatusMessage,
  buildHelpMessage,
  buildContextStatus,
};

export default {
  buildStatusMessage,
  buildHelpMessage,
  buildContextStatus,
  formatTokenCount,
};
