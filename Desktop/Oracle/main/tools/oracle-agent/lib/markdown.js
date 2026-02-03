/**
 * Markdown - Markdown Processing จาก OpenClaw Pattern
 *
 * Features:
 * - Code fence detection
 * - Frontmatter parsing (YAML-like)
 * - Span tracking (styles + links)
 * - Safe chunking (fence-aware)
 *
 * @module markdown
 */

// ============================================================
// Code Fence Detection
// ============================================================

/**
 * Code fence regex
 * Matches: ``` or ~~~ with optional language
 */
const FENCE_OPEN_REGEX = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/**
 * Find code fence spans in text
 * @param {string} text
 * @returns {object[]} Array of { start, end, lang }
 */
export function findCodeFences(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const fences = [];
  let openFence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(FENCE_OPEN_REGEX);

    if (!openFence) {
      // Looking for opening fence
      if (match) {
        openFence = {
          startLine: i,
          markerChar: match[2][0],
          markerLen: match[2].length,
          indent: match[1].length,
          lang: match[3].trim(),
        };
      }
    } else {
      // Looking for closing fence
      if (match) {
        const closeChar = match[2][0];
        const closeLen = match[2].length;

        if (closeChar === openFence.markerChar && closeLen >= openFence.markerLen) {
          // Found closing fence
          fences.push({
            startLine: openFence.startLine,
            endLine: i,
            lang: openFence.lang,
          });
          openFence = null;
        }
      }
    }
  }

  // Handle unclosed fence (extends to end)
  if (openFence) {
    fences.push({
      startLine: openFence.startLine,
      endLine: lines.length - 1,
      lang: openFence.lang,
      unclosed: true,
    });
  }

  return fences;
}

/**
 * Check if line index is inside a code fence
 * @param {object[]} fences - Fence spans
 * @param {number} lineIndex - Line index
 * @returns {boolean}
 */
export function isInsideFence(fences, lineIndex) {
  return fences.some((f) => lineIndex >= f.startLine && lineIndex <= f.endLine);
}

/**
 * Get character positions of fences
 * @param {string} text
 * @returns {object[]} Array of { start, end }
 */
export function getFenceCharPositions(text) {
  const lines = text.split('\n');
  const fences = findCodeFences(text);
  const positions = [];

  let charPos = 0;
  const lineStarts = [0];

  for (let i = 0; i < lines.length; i++) {
    charPos += lines[i].length + 1; // +1 for newline
    lineStarts.push(charPos);
  }

  for (const fence of fences) {
    positions.push({
      start: lineStarts[fence.startLine],
      end: lineStarts[fence.endLine + 1] || text.length,
      lang: fence.lang,
    });
  }

  return positions;
}

// ============================================================
// Frontmatter Parsing
// ============================================================

/**
 * Frontmatter regex
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Extract frontmatter from text
 * @param {string} text
 * @returns {object} { frontmatter, content }
 */
export function extractFrontmatter(text) {
  if (!text) {
    return { frontmatter: null, content: text };
  }

  const match = text.match(FRONTMATTER_REGEX);
  if (!match) {
    return { frontmatter: null, content: text };
  }

  const frontmatterBlock = match[1];
  const content = text.slice(match[0].length).trim();

  // Try line-based parsing first
  const frontmatter = parseLineBasedFrontmatter(frontmatterBlock);

  return { frontmatter, content };
}

/**
 * Parse line-based frontmatter (simple key: value)
 * @param {string} block
 * @returns {object}
 */
function parseLineBasedFrontmatter(block) {
  const result = {};
  const lines = block.split('\n');

  let currentKey = null;
  let currentValue = [];

  for (const line of lines) {
    // Check for new key: value
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);

    if (keyMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      // Save previous key if exists
      if (currentKey) {
        result[currentKey] = currentValue.join('\n').trim();
      }

      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();

      // Check if it's a JSON value
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          result[currentKey] = JSON.parse(value);
          currentKey = null;
          currentValue = [];
          continue;
        } catch {
          // Not valid JSON, treat as string
        }
      }

      currentValue = value ? [value] : [];
    } else if (currentKey && (line.startsWith(' ') || line.startsWith('\t'))) {
      // Continuation of multiline value
      currentValue.push(line.trim());
    }
  }

  // Save last key
  if (currentKey) {
    result[currentKey] = currentValue.join('\n').trim();
  }

  return result;
}

/**
 * Serialize frontmatter to string
 * @param {object} frontmatter
 * @returns {string}
 */
export function serializeFrontmatter(frontmatter) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return '';
  }

  const lines = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

// ============================================================
// Safe Text Operations
// ============================================================

/**
 * Find safe split point (not inside fence)
 * @param {string} text
 * @param {number} targetPos - Target position
 * @param {number} searchRange - Range to search
 * @returns {number} Safe split position
 */
export function findSafeSplitPoint(text, targetPos, searchRange = 100) {
  const fences = getFenceCharPositions(text);

  // Check if target is inside a fence
  for (const fence of fences) {
    if (targetPos > fence.start && targetPos < fence.end) {
      // Inside fence - move to after fence
      return Math.min(fence.end, text.length);
    }
  }

  // Not inside fence - find nearest newline
  const searchStart = Math.max(0, targetPos - searchRange);
  const searchEnd = Math.min(text.length, targetPos + searchRange);

  // Prefer splitting at paragraph break
  const paragraphBreak = text.lastIndexOf('\n\n', targetPos);
  if (paragraphBreak > searchStart) {
    return paragraphBreak + 2;
  }

  // Fall back to line break
  const lineBreak = text.lastIndexOf('\n', targetPos);
  if (lineBreak > searchStart) {
    return lineBreak + 1;
  }

  return targetPos;
}

// ============================================================
// Inline Code Detection
// ============================================================

/**
 * Find inline code spans
 * @param {string} text
 * @returns {object[]} Array of { start, end }
 */
export function findInlineCode(text) {
  if (!text) return [];

  const spans = [];
  const regex = /`([^`]+)`/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    });
  }

  return spans;
}

/**
 * Check if position is inside inline code
 * @param {object[]} codeSpans
 * @param {number} pos
 * @returns {boolean}
 */
export function isInsideInlineCode(codeSpans, pos) {
  return codeSpans.some((s) => pos > s.start && pos < s.end);
}

// ============================================================
// Exports
// ============================================================

export default {
  // Fences
  findCodeFences,
  isInsideFence,
  getFenceCharPositions,

  // Frontmatter
  extractFrontmatter,
  serializeFrontmatter,

  // Safe operations
  findSafeSplitPoint,

  // Inline code
  findInlineCode,
  isInsideInlineCode,
};
