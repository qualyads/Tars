/**
 * Terminal - Terminal Utilities จาก OpenClaw Pattern
 *
 * Features:
 * - Table rendering (flex columns, alignment)
 * - ANSI code handling (strip, visible width)
 * - Color palette (accent, success, error, etc.)
 * - Progress line (spinner, updates)
 * - Box/note formatting
 *
 * @module terminal
 */

// ============================================================
// ANSI Escape Codes
// ============================================================

/**
 * ANSI escape code regex
 */
const ANSI_REGEX = /\x1b\[[0-9;]*m|\x1b\]8;;[^\x1b]*\x1b\\|\x1b\]8;;\x1b\\/g;

/**
 * Strip ANSI codes from text
 * @param {string} text
 * @returns {string}
 */
export function stripAnsi(text) {
  if (!text) return '';
  return text.replace(ANSI_REGEX, '');
}

/**
 * Get visible width (excluding ANSI codes)
 * @param {string} text
 * @returns {number}
 */
export function visibleWidth(text) {
  return stripAnsi(text).length;
}

/**
 * Check if string contains ANSI codes
 * @param {string} text
 * @returns {boolean}
 */
export function hasAnsi(text) {
  return ANSI_REGEX.test(text);
}

// ============================================================
// Color Palette
// ============================================================

/**
 * Color codes (ANSI SGR)
 */
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * Theme colors (semantic)
 */
export const THEME = {
  accent: COLORS.cyan,
  accentBright: COLORS.brightCyan,
  success: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  info: COLORS.blue,
  muted: COLORS.gray,
  heading: COLORS.bold + COLORS.cyan,
};

/**
 * Check if terminal supports colors
 * @returns {boolean}
 */
export function isColorSupported() {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY || false;
}

/**
 * Colorize text (conditional)
 * @param {string} color - Color code
 * @param {string} text - Text to colorize
 * @returns {string}
 */
export function colorize(color, text) {
  if (!isColorSupported()) return text;
  return `${color}${text}${COLORS.reset}`;
}

/**
 * Theme helpers
 */
export const style = {
  accent: (text) => colorize(THEME.accent, text),
  success: (text) => colorize(THEME.success, text),
  warn: (text) => colorize(THEME.warn, text),
  error: (text) => colorize(THEME.error, text),
  info: (text) => colorize(THEME.info, text),
  muted: (text) => colorize(THEME.muted, text),
  heading: (text) => colorize(THEME.heading, text),
  bold: (text) => colorize(COLORS.bold, text),
  dim: (text) => colorize(COLORS.dim, text),
};

// ============================================================
// Table Rendering
// ============================================================

/**
 * Table border characters
 */
export const TABLE_BORDERS = {
  unicode: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    cross: '┼',
    topCross: '┬',
    bottomCross: '┴',
    leftCross: '├',
    rightCross: '┤',
  },
  ascii: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
    cross: '+',
    topCross: '+',
    bottomCross: '+',
    leftCross: '+',
    rightCross: '+',
  },
  none: {
    topLeft: '',
    topRight: '',
    bottomLeft: '',
    bottomRight: '',
    horizontal: '',
    vertical: '|',
    cross: '',
    topCross: '',
    bottomCross: '',
    leftCross: '',
    rightCross: '',
  },
};

/**
 * Pad cell content
 * @param {string} content - Cell content
 * @param {number} width - Target width
 * @param {string} align - Alignment (left, right, center)
 * @returns {string}
 */
function padCell(content, width, align = 'left') {
  const visible = visibleWidth(content);
  const padding = width - visible;

  if (padding <= 0) return content;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + content;
    case 'center':
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + content + ' '.repeat(right);
    default:
      return content + ' '.repeat(padding);
  }
}

/**
 * Truncate text to width
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string}
 */
function truncateToWidth(text, maxWidth) {
  const stripped = stripAnsi(text);
  if (stripped.length <= maxWidth) return text;

  // Simple truncation (doesn't preserve ANSI perfectly)
  return stripped.slice(0, maxWidth - 1) + '…';
}

/**
 * Render a table
 * @param {object} options
 * @param {string[]} options.headers - Column headers
 * @param {string[][]} options.rows - Table rows
 * @param {object} options.columns - Column config { align, minWidth, maxWidth, flex }
 * @param {string} options.borderStyle - 'unicode', 'ascii', 'none'
 * @returns {string}
 */
export function renderTable(options) {
  const { headers = [], rows = [], columns = {}, borderStyle = 'unicode' } = options;

  const borders = TABLE_BORDERS[borderStyle] || TABLE_BORDERS.unicode;

  // Calculate column widths
  const colWidths = headers.map((header, i) => {
    const colConfig = columns[i] || {};
    let width = visibleWidth(header);

    // Check all rows
    for (const row of rows) {
      if (row[i]) {
        width = Math.max(width, visibleWidth(String(row[i])));
      }
    }

    // Apply constraints
    if (colConfig.minWidth) {
      width = Math.max(width, colConfig.minWidth);
    }
    if (colConfig.maxWidth) {
      width = Math.min(width, colConfig.maxWidth);
    }

    return width;
  });

  // Build table
  const lines = [];

  // Top border
  if (borders.horizontal) {
    const top =
      borders.topLeft +
      colWidths.map((w) => borders.horizontal.repeat(w + 2)).join(borders.topCross) +
      borders.topRight;
    lines.push(top);
  }

  // Header row
  const headerCells = headers.map((h, i) => {
    const align = columns[i]?.align || 'left';
    return ' ' + padCell(h, colWidths[i], align) + ' ';
  });
  lines.push(borders.vertical + headerCells.join(borders.vertical) + borders.vertical);

  // Header separator
  if (borders.horizontal) {
    const sep =
      borders.leftCross +
      colWidths.map((w) => borders.horizontal.repeat(w + 2)).join(borders.cross) +
      borders.rightCross;
    lines.push(sep);
  }

  // Data rows
  for (const row of rows) {
    const cells = row.map((cell, i) => {
      const content = truncateToWidth(String(cell ?? ''), colWidths[i]);
      const align = columns[i]?.align || 'left';
      return ' ' + padCell(content, colWidths[i], align) + ' ';
    });
    lines.push(borders.vertical + cells.join(borders.vertical) + borders.vertical);
  }

  // Bottom border
  if (borders.horizontal) {
    const bottom =
      borders.bottomLeft +
      colWidths.map((w) => borders.horizontal.repeat(w + 2)).join(borders.bottomCross) +
      borders.bottomRight;
    lines.push(bottom);
  }

  return lines.join('\n');
}

// ============================================================
// Progress Line
// ============================================================

let activeProgressStream = null;

/**
 * Register active progress line
 * @param {NodeJS.WriteStream} stream
 */
export function registerProgressLine(stream = process.stdout) {
  activeProgressStream = stream;
}

/**
 * Clear active progress line
 */
export function clearProgressLine() {
  if (!activeProgressStream?.isTTY) return;

  activeProgressStream.write('\r\x1b[2K');
}

/**
 * Write progress line (overwrites previous)
 * @param {string} text
 */
export function writeProgressLine(text) {
  if (!activeProgressStream?.isTTY) {
    console.log(text);
    return;
  }

  activeProgressStream.write('\r\x1b[2K' + text);
}

/**
 * Unregister progress line
 */
export function unregisterProgressLine() {
  clearProgressLine();
  activeProgressStream = null;
}

/**
 * Spinner frames
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Create a spinner
 * @param {string} text - Spinner text
 * @returns {object} Spinner controller
 */
export function createSpinner(text) {
  let frameIndex = 0;
  let interval = null;
  let currentText = text;

  function render() {
    const frame = SPINNER_FRAMES[frameIndex];
    writeProgressLine(`${style.accent(frame)} ${currentText}`);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  }

  function start() {
    registerProgressLine();
    render();
    interval = setInterval(render, 80);
  }

  function stop(finalText) {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    clearProgressLine();
    if (finalText) {
      console.log(finalText);
    }
    unregisterProgressLine();
  }

  function update(newText) {
    currentText = newText;
  }

  function success(msg) {
    stop(`${style.success('✔')} ${msg || currentText}`);
  }

  function error(msg) {
    stop(`${style.error('✖')} ${msg || currentText}`);
  }

  return { start, stop, update, success, error };
}

// ============================================================
// Box/Note Formatting
// ============================================================

/**
 * Box characters
 */
const BOX_CHARS = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
};

/**
 * Wrap text to width (smart word wrap)
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
export function wrapText(text, maxWidth) {
  if (!text) return [];

  const lines = [];
  const words = text.split(/\s+/);

  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (visibleWidth(testLine) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      // Handle long words
      if (visibleWidth(word) > maxWidth) {
        let remaining = word;
        while (visibleWidth(remaining) > maxWidth) {
          lines.push(remaining.slice(0, maxWidth - 1) + '-');
          remaining = remaining.slice(maxWidth - 1);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Render a box with message
 * @param {string} message
 * @param {object} options
 * @returns {string}
 */
export function renderBox(message, options = {}) {
  const { title, width = 60, padding = 1 } = options;

  const innerWidth = width - 4; // Account for borders and padding
  const wrappedLines = wrapText(message, innerWidth);

  const lines = [];

  // Top border
  let topBorder = BOX_CHARS.topLeft + BOX_CHARS.horizontal.repeat(width - 2) + BOX_CHARS.topRight;
  if (title) {
    const titleText = ` ${title} `;
    const titlePos = Math.floor((width - visibleWidth(titleText)) / 2);
    topBorder =
      BOX_CHARS.topLeft +
      BOX_CHARS.horizontal.repeat(titlePos - 1) +
      titleText +
      BOX_CHARS.horizontal.repeat(width - titlePos - visibleWidth(titleText) - 1) +
      BOX_CHARS.topRight;
  }
  lines.push(topBorder);

  // Padding top
  for (let i = 0; i < padding; i++) {
    lines.push(BOX_CHARS.vertical + ' '.repeat(width - 2) + BOX_CHARS.vertical);
  }

  // Content
  for (const line of wrappedLines) {
    const padded = padCell(line, innerWidth, 'left');
    lines.push(BOX_CHARS.vertical + ' ' + padded + ' ' + BOX_CHARS.vertical);
  }

  // Padding bottom
  for (let i = 0; i < padding; i++) {
    lines.push(BOX_CHARS.vertical + ' '.repeat(width - 2) + BOX_CHARS.vertical);
  }

  // Bottom border
  lines.push(BOX_CHARS.bottomLeft + BOX_CHARS.horizontal.repeat(width - 2) + BOX_CHARS.bottomRight);

  return lines.join('\n');
}

/**
 * Print a note (info box)
 * @param {string} message
 * @param {string} type - 'info', 'success', 'warn', 'error'
 */
export function printNote(message, type = 'info') {
  const icons = {
    info: style.info('ℹ'),
    success: style.success('✔'),
    warn: style.warn('⚠'),
    error: style.error('✖'),
  };

  const icon = icons[type] || icons.info;
  console.log(`${icon} ${message}`);
}

// ============================================================
// Exports
// ============================================================

export default {
  // ANSI
  stripAnsi,
  visibleWidth,
  hasAnsi,

  // Colors
  COLORS,
  THEME,
  isColorSupported,
  colorize,
  style,

  // Table
  TABLE_BORDERS,
  renderTable,

  // Progress
  registerProgressLine,
  clearProgressLine,
  writeProgressLine,
  unregisterProgressLine,
  createSpinner,

  // Box
  wrapText,
  renderBox,
  printNote,
};
