/**
 * Media - Media Handling จาก OpenClaw Pattern
 *
 * Features:
 * - Media token parsing
 * - MIME type detection (multi-source)
 * - Filename sanitization
 * - Media storage (UUID-based)
 *
 * @module media
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

// ============================================================
// Constants
// ============================================================

/**
 * Audio extensions (voice-compatible)
 */
export const VOICE_EXTENSIONS = new Set(['.oga', '.ogg', '.opus']);

/**
 * Audio MIME types
 */
export const AUDIO_MIMES = new Set(['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/wav']);

/**
 * All audio extensions
 */
export const AUDIO_EXTENSIONS = new Set([
  '.aac',
  '.flac',
  '.m4a',
  '.mp3',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
]);

/**
 * Image extensions
 */
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']);

/**
 * Max filename length
 */
export const MAX_FILENAME_LENGTH = 60;

/**
 * Default max file size (5MB)
 */
export const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;

// ============================================================
// Media Token Parsing
// ============================================================

/**
 * Media token regex
 * Format: MEDIA: <url or path>
 */
const MEDIA_TOKEN_REGEX = /MEDIA:\s*([^\s]+)/gi;

/**
 * Code fence regex (to skip)
 */
const CODE_FENCE_REGEX = /```[\s\S]*?```|`[^`]+`/g;

/**
 * Parse media tokens from text
 * @param {string} text - Text to parse
 * @returns {object} { mediaUrls: string[], audioAsVoice: boolean, cleanText: string }
 */
export function parseMediaTokens(text) {
  if (!text) {
    return { mediaUrls: [], audioAsVoice: false, cleanText: '' };
  }

  // Find code fence positions to skip
  const fenceRanges = [];
  let match;
  while ((match = CODE_FENCE_REGEX.exec(text)) !== null) {
    fenceRanges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Check if position is inside a fence
  const isInFence = (pos) => {
    return fenceRanges.some((range) => pos >= range.start && pos < range.end);
  };

  const mediaUrls = [];
  let cleanText = text;

  // Find media tokens
  MEDIA_TOKEN_REGEX.lastIndex = 0;
  while ((match = MEDIA_TOKEN_REGEX.exec(text)) !== null) {
    if (isInFence(match.index)) {
      continue; // Skip tokens inside code blocks
    }

    const url = match[1];
    if (isValidMediaUrl(url)) {
      mediaUrls.push(url);
      cleanText = cleanText.replace(match[0], '').trim();
    }
  }

  // Check for audio_as_voice tag
  const audioAsVoice = /\[\[audio_as_voice\]\]/i.test(text);
  if (audioAsVoice) {
    cleanText = cleanText.replace(/\[\[audio_as_voice\]\]/gi, '').trim();
  }

  return { mediaUrls, audioAsVoice, cleanText };
}

/**
 * Validate media URL
 * @param {string} url
 * @returns {boolean}
 */
export function isValidMediaUrl(url) {
  if (!url || url.length > 4096) {
    return false;
  }

  // HTTP(S) URLs
  if (/^https?:\/\//i.test(url)) {
    return true;
  }

  // Local paths (only ./ allowed, no ../)
  if (url.startsWith('./') && !url.includes('..')) {
    return true;
  }

  return false;
}

// ============================================================
// MIME Type Detection
// ============================================================

/**
 * Common MIME type mappings
 */
const MIME_BY_EXTENSION = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.svg': 'image/svg+xml',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',

  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',

  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

/**
 * Magic bytes for common file types
 */
const MAGIC_BYTES = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'audio/wav' }, // RIFF header
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: 'audio/ogg' }, // OggS
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg' }, // ID3 (MP3)
  { bytes: [0xff, 0xfb], mime: 'audio/mpeg' }, // MP3 frame sync
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' }, // %PDF
];

/**
 * Detect MIME type from buffer (magic bytes)
 * @param {Buffer} buffer
 * @returns {string|undefined}
 */
export function detectMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 4) {
    return undefined;
  }

  for (const { bytes, mime } of MAGIC_BYTES) {
    let match = true;
    for (let i = 0; i < bytes.length; i++) {
      if (buffer[i] !== bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return mime;
    }
  }

  return undefined;
}

/**
 * Detect MIME type from extension
 * @param {string} filename
 * @returns {string|undefined}
 */
export function detectMimeFromExtension(filename) {
  if (!filename) return undefined;

  const ext = path.extname(filename).toLowerCase();
  return MIME_BY_EXTENSION[ext];
}

/**
 * Detect MIME type (multi-source)
 * Priority: buffer sniff > extension > content-type header
 * @param {object} params
 * @param {Buffer} params.buffer - File buffer (first bytes)
 * @param {string} params.filename - Filename
 * @param {string} params.contentType - Content-Type header
 * @returns {string} Detected MIME type
 */
export function detectMime(params) {
  const { buffer, filename, contentType } = params;

  // 1. Try buffer sniff (highest priority)
  const sniffed = detectMimeFromBuffer(buffer);
  if (sniffed) {
    return sniffed;
  }

  // 2. Try extension
  const fromExt = detectMimeFromExtension(filename);
  if (fromExt) {
    return fromExt;
  }

  // 3. Use content-type header
  if (contentType) {
    // Strip charset and params
    return contentType.split(';')[0].trim().toLowerCase();
  }

  // 4. Default
  return 'application/octet-stream';
}

// ============================================================
// Audio/Voice Detection
// ============================================================

/**
 * Check if file is voice-compatible audio
 * @param {string} filename
 * @param {string} contentType
 * @returns {boolean}
 */
export function isVoiceCompatible(filename, contentType) {
  // Check extension
  if (filename) {
    const ext = path.extname(filename).toLowerCase();
    if (VOICE_EXTENSIONS.has(ext)) {
      return true;
    }
  }

  // Check MIME
  if (contentType) {
    const mime = contentType.split(';')[0].trim().toLowerCase();
    if (mime === 'audio/ogg' || mime === 'audio/opus') {
      return true;
    }
  }

  return false;
}

/**
 * Check if MIME type is audio
 * @param {string} mime
 * @returns {boolean}
 */
export function isAudioMime(mime) {
  return mime && mime.startsWith('audio/');
}

/**
 * Check if MIME type is image
 * @param {string} mime
 * @returns {boolean}
 */
export function isImageMime(mime) {
  return mime && mime.startsWith('image/');
}

/**
 * Check if MIME type is video
 * @param {string} mime
 * @returns {boolean}
 */
export function isVideoMime(mime) {
  return mime && mime.startsWith('video/');
}

// ============================================================
// Filename Sanitization
// ============================================================

/**
 * Unsafe characters (Windows/SharePoint)
 */
const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Sanitize filename
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  if (!filename) return '';

  // Remove unsafe chars
  let safe = filename.replace(UNSAFE_CHARS, '_');

  // Remove leading/trailing dots and spaces
  safe = safe.replace(/^[\s.]+|[\s.]+$/g, '');

  // Collapse multiple underscores
  safe = safe.replace(/_+/g, '_');

  // Limit length (preserve extension)
  if (safe.length > MAX_FILENAME_LENGTH) {
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);
    const maxBase = MAX_FILENAME_LENGTH - ext.length - 1;
    safe = base.slice(0, maxBase) + ext;
  }

  return safe || 'file';
}

/**
 * Extract original filename from URL
 * @param {string} url
 * @returns {string|null}
 */
export function extractFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const filename = path.basename(pathname);

    // Remove query params from filename
    const clean = filename.split('?')[0];
    return clean || null;
  } catch {
    return null;
  }
}

// ============================================================
// Media Storage
// ============================================================

/**
 * Generate storage filename
 * @param {string} originalName
 * @returns {string}
 */
export function generateStorageFilename(originalName) {
  const uuid = crypto.randomUUID();
  const ext = path.extname(originalName || '').toLowerCase() || '';

  if (originalName) {
    const sanitized = sanitizeFilename(path.basename(originalName, ext));
    if (sanitized && sanitized !== 'file') {
      return `${sanitized}---${uuid}${ext}`;
    }
  }

  return `${uuid}${ext}`;
}

/**
 * Get default media storage directory
 * @returns {string}
 */
export function getMediaStorageDir() {
  const baseDir = process.env.ORACLE_MEDIA_DIR || path.join(os.homedir(), '.oracle', 'media');

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  }

  return baseDir;
}

/**
 * Store media file
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} subdir - Subdirectory (e.g., 'inbound', 'outbound')
 * @returns {string} Stored file path
 */
export function storeMedia(buffer, originalName, subdir = '') {
  const baseDir = getMediaStorageDir();
  const targetDir = subdir ? path.join(baseDir, subdir) : baseDir;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  }

  const filename = generateStorageFilename(originalName);
  const filepath = path.join(targetDir, filename);

  fs.writeFileSync(filepath, buffer, { mode: 0o600 });

  return filepath;
}

/**
 * Clean old media files
 * @param {number} maxAgeMs - Max age in milliseconds (default 2 minutes)
 */
export function cleanOldMedia(maxAgeMs = 2 * 60 * 1000) {
  const baseDir = getMediaStorageDir();
  if (!fs.existsSync(baseDir)) return;

  const now = Date.now();
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filepath = path.join(baseDir, entry.name);
    const stats = fs.statSync(filepath);

    if (now - stats.mtimeMs > maxAgeMs) {
      try {
        fs.unlinkSync(filepath);
      } catch (err) {
        console.error('[MEDIA] Failed to clean:', filepath, err.message);
      }
    }
  }
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  VOICE_EXTENSIONS,
  AUDIO_MIMES,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  MAX_FILENAME_LENGTH,
  DEFAULT_MAX_SIZE,

  // Parsing
  parseMediaTokens,
  isValidMediaUrl,

  // MIME detection
  detectMime,
  detectMimeFromBuffer,
  detectMimeFromExtension,

  // Type checks
  isVoiceCompatible,
  isAudioMime,
  isImageMime,
  isVideoMime,

  // Filename
  sanitizeFilename,
  extractFilenameFromUrl,
  generateStorageFilename,

  // Storage
  getMediaStorageDir,
  storeMedia,
  cleanOldMedia,
};
