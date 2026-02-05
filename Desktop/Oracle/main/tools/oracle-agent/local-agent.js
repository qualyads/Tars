#!/usr/bin/env node
/**
 * Oracle Local Agent v2.0
 * รันบนเครื่อง Tars เพื่อ execute commands จาก LINE/Telegram
 *
 * Features:
 * - WebSocket connection to Oracle (Railway)
 * - Shell command execution
 * - File operations
 * - Claude Code integration
 * - Security layers (whitelist, path restriction)
 * - Approval flow for dangerous commands
 *
 * Usage:
 *   node local-agent.js
 *   LOCAL_AGENT_KEY=xxx node local-agent.js
 *
 * @version 2.0.0
 */

import WebSocket from 'ws';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamic import for local-security
let security;
try {
  security = (await import('./lib/local-security.js')).default;
} catch (e) {
  console.error('Warning: Could not load security module:', e.message);
  // Fallback security
  security = {
    validateCommand: () => ({ allowed: true }),
    sanitizeOutput: (o) => o,
    getSecurityStatus: () => ({})
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Oracle WebSocket URL
  oracleWsUrl: process.env.ORACLE_WS_URL || 'wss://oracle-agent-production-546e.up.railway.app/ws/local-agent',

  // Fallback to HTTP if WebSocket not available
  oracleHttpUrl: process.env.ORACLE_URL || 'https://oracle-agent-production-546e.up.railway.app',

  // Authentication
  apiKey: process.env.LOCAL_AGENT_KEY || 'oracle-local-agent-2026',

  // Agent info
  agentId: process.env.AGENT_ID || `mac-${os.hostname()}`,
  agentName: process.env.AGENT_NAME || 'Tars Mac',

  // Execution limits
  commandTimeout: parseInt(process.env.COMMAND_TIMEOUT) || 60000,  // 1 minute
  maxOutputSize: parseInt(process.env.MAX_OUTPUT_SIZE) || 10000,   // 10KB

  // Working directory
  workDir: process.env.WORK_DIR || '/Users/tanakitchaithip/Desktop/Oracle',

  // Reconnection
  reconnectInterval: 5000,   // 5 seconds
  maxReconnectAttempts: 100, // Give up after ~8 minutes

  // Heartbeat
  heartbeatInterval: 30000,  // 30 seconds

  // Log file
  logFile: path.join(__dirname, 'data/local-agent.log')
};

// =============================================================================
// LOGGING
// =============================================================================

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...data };

  const color = {
    INFO: '\x1b[36m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    SUCCESS: '\x1b[32m'
  }[level] || '\x1b[0m';

  console.log(`${color}[${timestamp}] [${level}]\x1b[0m ${message}`,
    Object.keys(data).length > 0 ? JSON.stringify(data) : '');

  // Append to log file
  try {
    const dir = path.dirname(CONFIG.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(CONFIG.logFile, JSON.stringify(logEntry) + '\n');
  } catch (e) { }
}

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

/**
 * Execute shell command with security checks
 */
async function executeShell(command, options = {}) {
  const { cwd = CONFIG.workDir, timeout = CONFIG.commandTimeout, approved = false } = options;

  log('INFO', 'Executing shell command', { command, cwd });

  // Security validation
  const validation = security.validateCommand(command, {
    targetPath: cwd,
    bypassApproval: approved
  });

  if (!validation.allowed) {
    return {
      success: false,
      error: `Security: ${validation.reason}`,
      blocked: true
    };
  }

  if (validation.requiresApproval) {
    return {
      success: false,
      requiresApproval: true,
      reason: validation.reason,
      command
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PATH: process.env.PATH }
    });

    const output = security.sanitizeOutput(stdout);
    const truncated = output.length > CONFIG.maxOutputSize
      ? output.slice(0, CONFIG.maxOutputSize) + '\n... [truncated]'
      : output;

    return {
      success: true,
      stdout: truncated,
      stderr: stderr ? security.sanitizeOutput(stderr.slice(0, 1000)) : ''
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout ? security.sanitizeOutput(err.stdout.slice(0, 5000)) : '',
      stderr: err.stderr ? security.sanitizeOutput(err.stderr.slice(0, 1000)) : ''
    };
  }
}

/**
 * Execute Claude Code
 */
async function executeClaudeCode(prompt, options = {}) {
  const { cwd = CONFIG.workDir, timeout = 300000 } = options;  // 5 min default

  log('INFO', 'Executing Claude Code', { prompt: prompt.slice(0, 100) });

  return new Promise((resolve) => {
    const args = ['-p', prompt, '--yes'];

    const proc = spawn('claude', args, {
      cwd,
      timeout,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.slice(0, CONFIG.maxOutputSize),
        stderr: stderr.slice(0, 1000),
        exitCode: code
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    // Timeout handler
    setTimeout(() => {
      proc.kill();
      resolve({
        success: false,
        error: 'Claude Code timeout',
        stdout: stdout.slice(0, CONFIG.maxOutputSize)
      });
    }, timeout);
  });
}

/**
 * File operations
 */
async function fileOperation(op, params) {
  const { filePath, content, encoding = 'utf8' } = params;

  // Security: check path
  if (!security.isPathAllowed(filePath)) {
    return {
      success: false,
      error: `Path '${filePath}' is not allowed`
    };
  }

  try {
    switch (op) {
      case 'read':
        const data = fs.readFileSync(filePath, encoding);
        return {
          success: true,
          content: data.slice(0, CONFIG.maxOutputSize)
        };

      case 'write':
        fs.writeFileSync(filePath, content, encoding);
        return {
          success: true,
          message: `Written to ${filePath}`
        };

      case 'append':
        fs.appendFileSync(filePath, content, encoding);
        return {
          success: true,
          message: `Appended to ${filePath}`
        };

      case 'exists':
        return {
          success: true,
          exists: fs.existsSync(filePath)
        };

      case 'mkdir':
        fs.mkdirSync(filePath, { recursive: true });
        return {
          success: true,
          message: `Created directory ${filePath}`
        };

      case 'list':
        const files = fs.readdirSync(filePath);
        return {
          success: true,
          files
        };

      case 'stat':
        const stat = fs.statSync(filePath);
        return {
          success: true,
          stat: {
            size: stat.size,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            modified: stat.mtime,
            created: stat.birthtime
          }
        };

      default:
        return {
          success: false,
          error: `Unknown file operation: ${op}`
        };
    }
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get system info
 */
function getSystemInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
      free: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB'
    },
    uptime: Math.round(os.uptime() / 3600) + ' hours',
    user: os.userInfo().username,
    homeDir: os.homedir()
  };
}

// =============================================================================
// APPROVAL QUEUE
// =============================================================================

const pendingApprovals = new Map();

function addPendingApproval(id, command, callback) {
  pendingApprovals.set(id, { command, callback, createdAt: Date.now() });

  // Auto-expire after 5 minutes
  setTimeout(() => {
    if (pendingApprovals.has(id)) {
      pendingApprovals.delete(id);
      callback({ success: false, error: 'Approval expired' });
    }
  }, 5 * 60 * 1000);
}

function approveCommand(id) {
  const pending = pendingApprovals.get(id);
  if (!pending) return { success: false, error: 'No pending approval found' };

  pendingApprovals.delete(id);
  return { approved: true, command: pending.command };
}

function rejectCommand(id) {
  const pending = pendingApprovals.get(id);
  if (!pending) return { success: false, error: 'No pending approval found' };

  pendingApprovals.delete(id);
  pending.callback({ success: false, error: 'Command rejected by user' });
  return { rejected: true };
}

// =============================================================================
// WEBSOCKET CLIENT
// =============================================================================

let ws = null;
let reconnectAttempts = 0;
let heartbeatTimer = null;
let isConnected = false;

/**
 * Handle incoming message from Oracle
 */
async function handleMessage(message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (e) {
    log('ERROR', 'Invalid message format', { message });
    return;
  }

  const { id, type, payload } = data;
  log('INFO', `Received: ${type}`, { id });

  let result;

  try {
    switch (type) {
      case 'ping':
        result = { pong: true, timestamp: Date.now() };
        break;

      case 'shell':
        result = await executeShell(payload.command, {
          cwd: payload.cwd,
          timeout: payload.timeout,
          approved: payload.approved
        });
        break;

      case 'claude_code':
        result = await executeClaudeCode(payload.prompt, {
          cwd: payload.cwd,
          timeout: payload.timeout
        });
        break;

      case 'file':
        result = await fileOperation(payload.operation, payload);
        break;

      case 'system_info':
        result = {
          success: true,
          info: getSystemInfo(),
          security: security.getSecurityStatus()
        };
        break;

      case 'approve':
        result = approveCommand(payload.approvalId);
        if (result.approved) {
          // Re-execute with approval
          result = await executeShell(result.command, { approved: true });
        }
        break;

      case 'reject':
        result = rejectCommand(payload.approvalId);
        break;

      default:
        result = { success: false, error: `Unknown type: ${type}` };
    }
  } catch (err) {
    log('ERROR', `Error handling ${type}`, { error: err.message });
    result = { success: false, error: err.message };
  }

  // Send response
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      id,
      type: `${type}_response`,
      result
    }));
  }
}

/**
 * Connect to Oracle via WebSocket
 */
function connect() {
  log('INFO', 'Connecting to Oracle...', { url: CONFIG.oracleWsUrl });

  ws = new WebSocket(CONFIG.oracleWsUrl, {
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'X-Agent-Id': CONFIG.agentId,
      'X-Agent-Name': CONFIG.agentName
    }
  });

  ws.on('open', () => {
    log('SUCCESS', 'Connected to Oracle!');
    isConnected = true;
    reconnectAttempts = 0;

    // Send registration
    ws.send(JSON.stringify({
      type: 'register',
      agent: {
        id: CONFIG.agentId,
        name: CONFIG.agentName,
        capabilities: ['shell', 'file', 'claude_code', 'system_info'],
        system: getSystemInfo()
      }
    }));

    // Start heartbeat
    startHeartbeat();
  });

  ws.on('message', (data) => {
    handleMessage(data.toString());
  });

  ws.on('close', (code, reason) => {
    log('WARN', 'Disconnected from Oracle', { code, reason: reason.toString() });
    isConnected = false;
    stopHeartbeat();
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    log('ERROR', 'WebSocket error', { error: err.message });
  });
}

/**
 * Heartbeat to keep connection alive
 */
function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now(),
        agent: CONFIG.agentId
      }));
    }
  }, CONFIG.heartbeatInterval);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Reconnection logic
 */
function scheduleReconnect() {
  if (reconnectAttempts >= CONFIG.maxReconnectAttempts) {
    log('ERROR', 'Max reconnect attempts reached. Giving up.');
    process.exit(1);
  }

  reconnectAttempts++;
  const delay = Math.min(CONFIG.reconnectInterval * reconnectAttempts, 30000);

  log('INFO', `Reconnecting in ${delay / 1000}s...`, { attempt: reconnectAttempts });

  setTimeout(() => {
    connect();
  }, delay);
}

// =============================================================================
// HTTP FALLBACK (if WebSocket not available)
// =============================================================================

async function httpFallbackLoop() {
  log('INFO', 'Starting HTTP fallback mode...');

  while (true) {
    try {
      // Poll for tasks
      const response = await fetch(`${CONFIG.oracleHttpUrl}/api/local-agent/tasks`, {
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'X-Agent-Id': CONFIG.agentId
        }
      });

      if (response.ok) {
        const { tasks } = await response.json();

        for (const task of tasks || []) {
          const result = await handleMessage(JSON.stringify(task));

          // Report result
          await fetch(`${CONFIG.oracleHttpUrl}/api/local-agent/result`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${CONFIG.apiKey}`
            },
            body: JSON.stringify({ taskId: task.id, result })
          });
        }
      }
    } catch (err) {
      log('ERROR', 'HTTP poll error', { error: err.message });
    }

    // Wait before next poll
    await new Promise(r => setTimeout(r, 5000));
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\x1b[36m========================================\x1b[0m');
  console.log('\x1b[36m  Oracle Local Agent v2.0\x1b[0m');
  console.log('\x1b[36m========================================\x1b[0m');
  console.log(`Agent ID: ${CONFIG.agentId}`);
  console.log(`Agent Name: ${CONFIG.agentName}`);
  console.log(`Oracle URL: ${CONFIG.oracleWsUrl}`);
  console.log(`Work Dir: ${CONFIG.workDir}`);
  console.log('\x1b[36m========================================\x1b[0m');
  console.log('');
  console.log('Security Status:');
  const secStatus = security.getSecurityStatus();
  console.log(`  Allowed Commands: ${secStatus.allowedCommands || 'N/A'}`);
  console.log(`  Blocked Commands: ${secStatus.blockedCommands || 'N/A'}`);
  console.log(`  Allowed Paths: ${(secStatus.allowedPaths || []).join(', ')}`);
  console.log('');

  // Try WebSocket first
  try {
    connect();
  } catch (err) {
    log('WARN', 'WebSocket not available, falling back to HTTP', { error: err.message });
    await httpFallbackLoop();
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\x1b[33m[Local Agent] Shutting down...\x1b[0m');
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
