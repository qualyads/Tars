/**
 * Local Security Layer
 * ป้องกันการ execute commands อันตราย
 *
 * @version 2.0.0
 */

import path from 'path';

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

/**
 * Allowed commands (whitelist)
 */
const ALLOWED_COMMANDS = [
  // File operations
  'ls', 'cat', 'head', 'tail', 'find', 'grep', 'wc',
  'mkdir', 'touch', 'cp', 'mv',

  // Git
  'git',

  // Development
  'node', 'npm', 'npx', 'pnpm', 'bun', 'bunx',
  'python', 'python3', 'pip', 'pip3',
  'cargo', 'go',

  // Claude Code
  'claude',

  // System info (read-only)
  'pwd', 'whoami', 'date', 'uptime', 'df', 'du',
  'which', 'echo', 'printf',

  // macOS - open applications/files
  'open',
  'osascript',  // AppleScript for Terminal control

  // Network (read-only)
  'curl', 'wget', 'ping',

  // Process
  'ps', 'top', 'htop',

  // Railway
  'railway'
];

/**
 * Blocked commands (blacklist - override whitelist)
 */
const BLOCKED_COMMANDS = [
  'sudo', 'su', 'doas',
  'rm', 'rmdir', 'unlink',  // Delete requires approval
  'chmod', 'chown', 'chgrp',
  'kill', 'killall', 'pkill',
  'shutdown', 'reboot', 'halt',
  'dd', 'mkfs', 'fdisk', 'parted',
  'iptables', 'ufw', 'firewall-cmd'
];

/**
 * Dangerous patterns (regex)
 */
const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[\/~]/i,  // rm -rf /
  />\s*\/dev\//i,                       // > /dev/sda
  /curl.*\|\s*(ba)?sh/i,                // curl | bash
  /wget.*\|\s*(ba)?sh/i,                // wget | bash
  /:\(\)\s*\{\s*:\|:&\s*\}/,            // Fork bomb
  /\bsudo\b/i,                          // sudo anywhere
  /\bsu\s+-?\s*$/i,                     // su
  />\s*\/etc\//i,                       // Write to /etc
  />\s*\/usr\//i,                       // Write to /usr
  />\s*\/var\//i,                       // Write to /var
  /\$\(.*\)/,                           // Command substitution (risky)
  /`.*`/,                               // Backtick execution
  /;\s*rm\b/i,                          // Chained rm
  /&&\s*rm\b/i,                         // Chained rm
  /\|\s*rm\b/i                          // Piped rm
];

/**
 * Allowed paths (user can only operate in these)
 */
const ALLOWED_PATHS = [
  '/Users/tanakitchaithip/Desktop',
  '/Users/tanakitchaithip/Desktop/projects',  // สำหรับ workflow projects
  '/Users/tanakitchaithip/Documents',
  '/Users/tanakitchaithip/Downloads',
  '/Users/tanakitchaithip/projects',
  '/tmp'
];

/**
 * Commands that require approval before execution
 */
const REQUIRE_APPROVAL = [
  'rm',           // Any delete
  'git push',     // Push to remote
  'git reset',    // Reset changes
  'npm publish',  // Publish package
  'railway up',   // Deploy
  'mv'            // Move (can overwrite)
];

// =============================================================================
// SECURITY FUNCTIONS
// =============================================================================

/**
 * Extract base command from full command string
 */
function extractBaseCommand(command) {
  // Remove leading whitespace and env vars
  const cleaned = command.trim().replace(/^(\w+=\S+\s+)+/, '');

  // Get first word (the actual command)
  const parts = cleaned.split(/\s+/);
  const baseCmd = parts[0];

  // Handle path-based commands
  return path.basename(baseCmd);
}

/**
 * Check if command is in whitelist
 */
function isAllowedCommand(command) {
  const baseCmd = extractBaseCommand(command);
  return ALLOWED_COMMANDS.includes(baseCmd);
}

/**
 * Check if command is blocked
 */
function isBlockedCommand(command) {
  const baseCmd = extractBaseCommand(command);
  return BLOCKED_COMMANDS.includes(baseCmd);
}

/**
 * Check if command matches dangerous patterns
 */
function matchesDangerousPattern(command) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { dangerous: true, pattern: pattern.toString() };
    }
  }
  return { dangerous: false };
}

/**
 * Check if path is allowed
 */
function isPathAllowed(targetPath) {
  if (!targetPath) return true;

  const resolved = path.resolve(targetPath);

  return ALLOWED_PATHS.some(allowed =>
    resolved.startsWith(allowed) || resolved === allowed
  );
}

/**
 * Check if command requires approval
 */
function requiresApproval(command) {
  const lowerCmd = command.toLowerCase();

  for (const pattern of REQUIRE_APPROVAL) {
    if (lowerCmd.includes(pattern)) {
      return { required: true, reason: `Command contains '${pattern}'` };
    }
  }

  return { required: false };
}

/**
 * Validate a command for execution
 * Returns: { allowed: boolean, reason?: string, requiresApproval?: boolean }
 */
function validateCommand(command, options = {}) {
  const { targetPath, bypassApproval = false } = options;

  // 1. Check blocked commands first
  if (isBlockedCommand(command)) {
    return {
      allowed: false,
      reason: `Command '${extractBaseCommand(command)}' is blocked for security`
    };
  }

  // 2. Check dangerous patterns
  const dangerCheck = matchesDangerousPattern(command);
  if (dangerCheck.dangerous) {
    return {
      allowed: false,
      reason: `Command matches dangerous pattern: ${dangerCheck.pattern}`
    };
  }

  // 3. Check whitelist
  if (!isAllowedCommand(command)) {
    return {
      allowed: false,
      reason: `Command '${extractBaseCommand(command)}' is not in whitelist`
    };
  }

  // 4. Check path restrictions
  if (targetPath && !isPathAllowed(targetPath)) {
    return {
      allowed: false,
      reason: `Path '${targetPath}' is outside allowed directories`
    };
  }

  // 5. Check if approval required
  const approval = requiresApproval(command);
  if (approval.required && !bypassApproval) {
    return {
      allowed: true,
      requiresApproval: true,
      reason: approval.reason
    };
  }

  return { allowed: true };
}

/**
 * Sanitize command output (remove sensitive info)
 */
function sanitizeOutput(output) {
  if (!output) return output;

  // Patterns to redact
  const sensitivePatterns = [
    /password[=:]\s*\S+/gi,
    /api[_-]?key[=:]\s*\S+/gi,
    /secret[=:]\s*\S+/gi,
    /token[=:]\s*\S+/gi,
    /Bearer\s+\S+/gi
  ];

  let sanitized = output;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Get security status summary
 */
function getSecurityStatus() {
  return {
    allowedCommands: ALLOWED_COMMANDS.length,
    blockedCommands: BLOCKED_COMMANDS.length,
    dangerousPatterns: DANGEROUS_PATTERNS.length,
    allowedPaths: ALLOWED_PATHS,
    requireApproval: REQUIRE_APPROVAL
  };
}

export default {
  // Validation
  validateCommand,
  isAllowedCommand,
  isBlockedCommand,
  isPathAllowed,
  requiresApproval,
  matchesDangerousPattern,

  // Utilities
  extractBaseCommand,
  sanitizeOutput,
  getSecurityStatus,

  // Constants (for reference)
  ALLOWED_COMMANDS,
  BLOCKED_COMMANDS,
  ALLOWED_PATHS,
  REQUIRE_APPROVAL
};
