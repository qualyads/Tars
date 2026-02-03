/**
 * Inline Directives - Based on OpenClaw Pattern
 *
 * Extract directives from user messages and apply to request.
 *
 * Supported:
 * - /think [level]      - Set thinking level (off/minimal/low/medium/high)
 * - /verbose [on/off]   - Toggle verbose output
 * - /status             - Show status
 * - /model [name]       - Switch model
 * - /compact            - Trigger compaction
 * - /new                - New session
 */

// =============================================================================
// DIRECTIVE TYPES
// =============================================================================

const THINK_LEVELS = ['off', 'minimal', 'low', 'medium', 'high'];

const VERBOSE_LEVELS = ['off', 'on', 'full'];

// =============================================================================
// NORMALIZERS
// =============================================================================

/**
 * Normalize thinking level string
 */
function normalizeThinkLevel(raw) {
  if (!raw) return undefined;

  const key = raw.toLowerCase().trim();

  const mappings = {
    'off': 'off',
    'on': 'low',
    'enable': 'low',
    'min': 'minimal',
    'minimal': 'minimal',
    'low': 'low',
    'mid': 'medium',
    'medium': 'medium',
    'high': 'high',
    'max': 'high',
    'think': 'minimal',
  };

  return mappings[key] || undefined;
}

/**
 * Normalize verbose level
 */
function normalizeVerboseLevel(raw) {
  if (!raw) return undefined;

  const key = raw.toLowerCase().trim();

  if (['off', 'false', 'no', '0'].includes(key)) return 'off';
  if (['full', 'all'].includes(key)) return 'full';
  if (['on', 'true', 'yes', '1'].includes(key)) return 'on';

  return undefined;
}

// =============================================================================
// DIRECTIVE EXTRACTORS
// =============================================================================

/**
 * Extract a level directive from message body
 * Returns: { cleaned, level, hasDirective }
 */
function extractLevelDirective(body, names, normalize) {
  if (!body) {
    return { cleaned: '', hasDirective: false };
  }

  const namePattern = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(?:^|\\s)\\/(?:${namePattern})(?:$|\\s|:)\\s*([A-Za-z-]*)?`, 'i');
  const match = body.match(regex);

  if (!match) {
    return { cleaned: body.trim(), hasDirective: false };
  }

  const rawLevel = match[1]?.trim() || undefined;
  const level = normalize(rawLevel);

  // Remove directive from body
  const cleaned = body.replace(regex, ' ').replace(/\s+/g, ' ').trim();

  return {
    cleaned,
    level,
    rawLevel,
    hasDirective: true,
  };
}

/**
 * Extract simple directive (no level argument)
 */
function extractSimpleDirective(body, names) {
  if (!body) {
    return { cleaned: '', hasDirective: false };
  }

  const namePattern = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(?:^|\\s)\\/(?:${namePattern})(?:$|\\s|:)(?:\\s*:\\s*)?`, 'i');
  const match = body.match(regex);

  const cleaned = match
    ? body.replace(regex, ' ').replace(/\s+/g, ' ').trim()
    : body.trim();

  return {
    cleaned,
    hasDirective: Boolean(match),
  };
}

// =============================================================================
// PUBLIC EXTRACTORS
// =============================================================================

/**
 * Extract /think or /thinking directive
 */
function extractThinkDirective(body) {
  const result = extractLevelDirective(body, ['thinking', 'think', 't'], normalizeThinkLevel);
  return {
    cleaned: result.cleaned,
    thinkLevel: result.level,
    rawLevel: result.rawLevel,
    hasDirective: result.hasDirective,
  };
}

/**
 * Extract /verbose directive
 */
function extractVerboseDirective(body) {
  const result = extractLevelDirective(body, ['verbose', 'v'], normalizeVerboseLevel);
  return {
    cleaned: result.cleaned,
    verboseLevel: result.level,
    rawLevel: result.rawLevel,
    hasDirective: result.hasDirective,
  };
}

/**
 * Extract /status directive
 */
function extractStatusDirective(body) {
  return extractSimpleDirective(body, ['status', 'stat']);
}

/**
 * Extract /compact directive
 */
function extractCompactDirective(body) {
  return extractSimpleDirective(body, ['compact', 'summarize']);
}

/**
 * Extract /new or /reset directive
 */
function extractNewSessionDirective(body) {
  return extractSimpleDirective(body, ['new', 'reset', 'clear']);
}

/**
 * Extract /model directive with model name
 */
function extractModelDirective(body) {
  if (!body) {
    return { cleaned: '', hasDirective: false };
  }

  const regex = /(?:^|\s)\/model(?:\s+|:)(\S+)/i;
  const match = body.match(regex);

  if (!match) {
    return { cleaned: body.trim(), hasDirective: false };
  }

  const modelName = match[1]?.trim();
  const cleaned = body.replace(regex, ' ').replace(/\s+/g, ' ').trim();

  return {
    cleaned,
    modelName,
    hasDirective: true,
  };
}

// =============================================================================
// ALL-IN-ONE PROCESSOR
// =============================================================================

/**
 * Process all directives from a message body
 */
function processAllDirectives(body) {
  let text = body || '';
  const directives = {
    hasAnyDirective: false,
    thinkLevel: undefined,
    verboseLevel: undefined,
    showStatus: false,
    triggerCompact: false,
    newSession: false,
    switchModel: undefined,
  };

  // Extract /think
  const think = extractThinkDirective(text);
  if (think.hasDirective) {
    text = think.cleaned;
    directives.hasAnyDirective = true;
    directives.thinkLevel = think.thinkLevel;
  }

  // Extract /verbose
  const verbose = extractVerboseDirective(text);
  if (verbose.hasDirective) {
    text = verbose.cleaned;
    directives.hasAnyDirective = true;
    directives.verboseLevel = verbose.verboseLevel;
  }

  // Extract /status
  const status = extractStatusDirective(text);
  if (status.hasDirective) {
    text = status.cleaned;
    directives.hasAnyDirective = true;
    directives.showStatus = true;
  }

  // Extract /compact
  const compact = extractCompactDirective(text);
  if (compact.hasDirective) {
    text = compact.cleaned;
    directives.hasAnyDirective = true;
    directives.triggerCompact = true;
  }

  // Extract /new
  const newSession = extractNewSessionDirective(text);
  if (newSession.hasDirective) {
    text = newSession.cleaned;
    directives.hasAnyDirective = true;
    directives.newSession = true;
  }

  // Extract /model
  const model = extractModelDirective(text);
  if (model.hasDirective) {
    text = model.cleaned;
    directives.hasAnyDirective = true;
    directives.switchModel = model.modelName;
  }

  return {
    cleanedBody: text,
    ...directives,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Individual extractors
  extractThinkDirective,
  extractVerboseDirective,
  extractStatusDirective,
  extractCompactDirective,
  extractNewSessionDirective,
  extractModelDirective,

  // All-in-one
  processAllDirectives,

  // Normalizers
  normalizeThinkLevel,
  normalizeVerboseLevel,

  // Constants
  THINK_LEVELS,
  VERBOSE_LEVELS,
};

export default {
  processAllDirectives,
  extractThinkDirective,
  extractVerboseDirective,
};
