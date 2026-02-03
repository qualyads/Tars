/**
 * Smart Chunking - Based on OpenClaw Pattern
 *
 * Intelligent message splitting that:
 * - Respects markdown code blocks (fences)
 * - Breaks at paragraph boundaries
 * - Doesn't break inside parentheses (URLs)
 * - Configurable per-provider limits
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Default chunk limit (LINE: 5000, WhatsApp: 4096, Telegram: 4096)
  defaultLimit: 4000,

  // Provider-specific limits
  providerLimits: {
    line: 5000,
    whatsapp: 4096,
    telegram: 4096,
    discord: 2000,
    sms: 160,
  },

  // Chunk modes
  modes: {
    length: 'length',      // Split only on length limit
    newline: 'newline',    // Split on paragraph boundaries
  },
};

// =============================================================================
// FENCE DETECTION
// =============================================================================

/**
 * Parse markdown fence spans (code blocks)
 * Returns array of { start, end, marker, indent, openLine }
 */
function parseFenceSpans(text) {
  const spans = [];
  const fenceRegex = /^([ \t]*)(```|~~~)([^\n]*)\n/gm;
  let match;

  while ((match = fenceRegex.exec(text)) !== null) {
    const indent = match[1];
    const marker = match[2];
    const openLine = match[0].trimEnd();
    const start = match.index;

    // Find closing fence
    const closeRegex = new RegExp(`^${indent}${marker}\\s*$`, 'm');
    const remaining = text.slice(start + match[0].length);
    const closeMatch = remaining.match(closeRegex);

    if (closeMatch && closeMatch.index !== undefined) {
      const end = start + match[0].length + closeMatch.index + closeMatch[0].length;
      spans.push({ start, end, marker, indent, openLine });
      fenceRegex.lastIndex = end;
    }
  }

  return spans;
}

/**
 * Check if index is safe to break (not inside fence)
 */
function isSafeFenceBreak(spans, index) {
  for (const span of spans) {
    if (index > span.start && index < span.end) {
      return false;
    }
  }
  return true;
}

/**
 * Find fence span containing index
 */
function findFenceSpanAt(spans, index) {
  return spans.find(span => index > span.start && index < span.end) || null;
}

// =============================================================================
// BASIC CHUNKING
// =============================================================================

/**
 * Chunk text by length, preferring natural breaks
 */
function chunkText(text, limit) {
  if (!text) return [];
  if (limit <= 0) return [text];
  if (text.length <= limit) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);

    // Find best break point (newline > whitespace > hard break)
    const { lastNewline, lastWhitespace } = scanBreakpoints(window);
    let breakIdx = lastNewline > 0 ? lastNewline : lastWhitespace;

    // Fallback: hard break at limit
    if (breakIdx <= 0) {
      breakIdx = limit;
    }

    const chunk = remaining.slice(0, breakIdx).trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Skip separator if we broke on whitespace/newline
    const brokeOnSeparator = breakIdx < remaining.length && /\s/.test(remaining[breakIdx]);
    const nextStart = Math.min(remaining.length, breakIdx + (brokeOnSeparator ? 1 : 0));
    remaining = remaining.slice(nextStart).trimStart();
  }

  if (remaining.length) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Scan for break points, respecting parentheses
 */
function scanBreakpoints(window) {
  let lastNewline = -1;
  let lastWhitespace = -1;
  let depth = 0;

  for (let i = 0; i < window.length; i++) {
    const char = window[i];

    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')' && depth > 0) {
      depth--;
      continue;
    }

    // Only consider break points outside parentheses
    if (depth !== 0) continue;

    if (char === '\n') {
      lastNewline = i;
    } else if (/\s/.test(char)) {
      lastWhitespace = i;
    }
  }

  return { lastNewline, lastWhitespace };
}

// =============================================================================
// MARKDOWN-AWARE CHUNKING
// =============================================================================

/**
 * Chunk markdown text, respecting code fences
 */
function chunkMarkdownText(text, limit) {
  if (!text) return [];
  if (limit <= 0) return [text];
  if (text.length <= limit) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > limit) {
    const spans = parseFenceSpans(remaining);
    const window = remaining.slice(0, limit);

    // Find safe break point
    const { lastNewline, lastWhitespace } = scanBreakpointsSafe(window, spans);
    let breakIdx = lastNewline > 0 ? lastNewline : lastWhitespace > 0 ? lastWhitespace : limit;

    // Check if we're inside a fence
    const fenceAtBreak = findFenceSpanAt(spans, breakIdx);

    let rawChunk = remaining.slice(0, breakIdx);
    let next = remaining.slice(breakIdx);

    // If inside fence, close it and reopen in next chunk
    if (fenceAtBreak) {
      const closeLine = `${fenceAtBreak.indent}${fenceAtBreak.marker}`;
      rawChunk = rawChunk.endsWith('\n')
        ? `${rawChunk}${closeLine}`
        : `${rawChunk}\n${closeLine}`;
      next = `${fenceAtBreak.openLine}\n${next}`;
    } else {
      next = next.replace(/^\n+/, '');
    }

    chunks.push(rawChunk);
    remaining = next;
  }

  if (remaining.length) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Scan breakpoints, respecting both parentheses and fences
 */
function scanBreakpointsSafe(window, spans) {
  let lastNewline = -1;
  let lastWhitespace = -1;
  let depth = 0;

  for (let i = 0; i < window.length; i++) {
    // Skip if inside fence
    if (!isSafeFenceBreak(spans, i)) continue;

    const char = window[i];

    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')' && depth > 0) {
      depth--;
      continue;
    }

    if (depth !== 0) continue;

    if (char === '\n') {
      lastNewline = i;
    } else if (/\s/.test(char)) {
      lastWhitespace = i;
    }
  }

  return { lastNewline, lastWhitespace };
}

// =============================================================================
// PARAGRAPH-AWARE CHUNKING
// =============================================================================

/**
 * Chunk by paragraph boundaries (blank lines)
 */
function chunkByParagraph(text, limit, options = {}) {
  if (!text) return [];
  if (limit <= 0) return [text];

  const splitLongParagraphs = options.splitLongParagraphs !== false;

  // Normalize newlines
  const normalized = text.replace(/\r\n?/g, '\n');

  // Check for paragraph breaks
  const paragraphBreak = /\n[\t ]*\n+/;
  if (!paragraphBreak.test(normalized)) {
    if (normalized.length <= limit) return [normalized];
    if (!splitLongParagraphs) return [normalized];
    return chunkText(normalized, limit);
  }

  // Split on paragraph breaks
  const spans = parseFenceSpans(normalized);
  const parts = [];
  const regex = /\n[\t ]*\n+/g;
  let lastIndex = 0;

  for (const match of normalized.matchAll(regex)) {
    const idx = match.index ?? 0;

    // Don't split inside fences
    if (!isSafeFenceBreak(spans, idx)) continue;

    parts.push(normalized.slice(lastIndex, idx));
    lastIndex = idx + match[0].length;
  }
  parts.push(normalized.slice(lastIndex));

  // Build chunks from paragraphs
  const chunks = [];
  for (const part of parts) {
    const paragraph = part.replace(/\s+$/g, '');
    if (!paragraph.trim()) continue;

    if (paragraph.length <= limit) {
      chunks.push(paragraph);
    } else if (splitLongParagraphs) {
      chunks.push(...chunkText(paragraph, limit));
    } else {
      chunks.push(paragraph);
    }
  }

  return chunks;
}

// =============================================================================
// UNIFIED CHUNKING
// =============================================================================

/**
 * Chunk text with mode selection
 */
function chunkTextWithMode(text, limit, mode = 'length') {
  if (mode === 'newline') {
    return chunkByParagraph(text, limit);
  }
  return chunkText(text, limit);
}

/**
 * Chunk markdown with mode selection
 */
function chunkMarkdownWithMode(text, limit, mode = 'length') {
  if (mode === 'newline') {
    const paragraphs = chunkByParagraph(text, limit, { splitLongParagraphs: false });
    const out = [];
    for (const chunk of paragraphs) {
      out.push(...chunkMarkdownText(chunk, limit));
    }
    return out;
  }
  return chunkMarkdownText(text, limit);
}

/**
 * Get chunk limit for provider
 */
function getChunkLimit(provider) {
  if (!provider) return CONFIG.defaultLimit;
  const normalized = provider.toLowerCase();
  return CONFIG.providerLimits[normalized] || CONFIG.defaultLimit;
}

/**
 * High-level chunk function
 */
function smartChunk(text, options = {}) {
  const limit = options.limit || getChunkLimit(options.provider);
  const mode = options.mode || 'length';
  const markdown = options.markdown !== false; // Default: true

  if (markdown) {
    return chunkMarkdownWithMode(text, limit, mode);
  }
  return chunkTextWithMode(text, limit, mode);
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Main function
  smartChunk,

  // Basic chunking
  chunkText,
  chunkTextWithMode,

  // Markdown-aware
  chunkMarkdownText,
  chunkMarkdownWithMode,

  // Paragraph-aware
  chunkByParagraph,

  // Fence utilities
  parseFenceSpans,
  isSafeFenceBreak,
  findFenceSpanAt,

  // Provider limits
  getChunkLimit,

  // Config
  CONFIG,
};

export default {
  smartChunk,
  chunkMarkdownText,
  getChunkLimit,
};
