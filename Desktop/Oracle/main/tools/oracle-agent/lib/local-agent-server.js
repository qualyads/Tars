/**
 * Local Agent WebSocket Server
 * รับ connection จาก Local Agent ที่รันบนเครื่อง Tars
 *
 * @version 2.0.0
 */

import { WebSocketServer } from 'ws';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// =============================================================================
// STATE
// =============================================================================

let wss = null;
let connectedAgents = new Map();
let pendingCommands = new Map();
let commandCounter = 0;
let notifyCallback = null;

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  apiKey: process.env.LOCAL_AGENT_KEY || 'oracle-local-agent-2026',
  pingInterval: 30000,
  commandTimeout: 60000
};

// =============================================================================
// WEBSOCKET SERVER
// =============================================================================

/**
 * Initialize WebSocket server on existing HTTP server
 */
function initialize(httpServer, options = {}) {
  if (wss) {
    console.log('[LOCAL-AGENT-SERVER] Already initialized');
    return;
  }

  wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/local-agent'
  });

  wss.on('connection', handleConnection);

  console.log('[LOCAL-AGENT-SERVER] WebSocket server initialized on /ws/local-agent');

  // Ping all agents periodically
  setInterval(() => {
    connectedAgents.forEach((agent, ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    });
  }, CONFIG.pingInterval);

  return wss;
}

/**
 * Handle new WebSocket connection
 */
function handleConnection(ws, req) {
  const authHeader = req.headers['authorization'];
  const agentId = req.headers['x-agent-id'] || 'unknown';
  const agentName = req.headers['x-agent-name'] || 'Unknown Agent';

  // Authentication
  const token = authHeader?.replace('Bearer ', '');
  if (token !== CONFIG.apiKey) {
    console.log('[LOCAL-AGENT-SERVER] Auth failed for', agentId);
    ws.close(4001, 'Unauthorized');
    return;
  }

  console.log(`[LOCAL-AGENT-SERVER] Agent connected: ${agentName} (${agentId})`);

  // Store agent info
  connectedAgents.set(ws, {
    id: agentId,
    name: agentName,
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    capabilities: []
  });

  // Handle messages
  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  // Handle close
  ws.on('close', () => {
    const agent = connectedAgents.get(ws);
    console.log(`[LOCAL-AGENT-SERVER] Agent disconnected: ${agent?.name || agentId}`);
    connectedAgents.delete(ws);
  });

  // Handle error
  ws.on('error', (err) => {
    console.error('[LOCAL-AGENT-SERVER] WebSocket error:', err.message);
  });
}

/**
 * Handle message from agent
 */
function handleMessage(ws, message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (e) {
    console.error('[LOCAL-AGENT-SERVER] Invalid message:', message.slice(0, 100));
    return;
  }

  const agent = connectedAgents.get(ws);
  if (!agent) return;

  switch (data.type) {
    case 'register':
      // Update agent capabilities
      agent.capabilities = data.agent?.capabilities || [];
      agent.system = data.agent?.system || {};
      console.log(`[LOCAL-AGENT-SERVER] Agent registered: ${agent.name}`, {
        capabilities: agent.capabilities
      });
      break;

    case 'heartbeat':
      agent.lastHeartbeat = Date.now();
      break;

    case 'shell_response':
    case 'claude_code_response':
    case 'file_response':
    case 'system_info_response':
    case 'workflow_response':
    case 'open_app_response':
    case 'open_terminal_response':
      // Handle command response
      const pending = pendingCommands.get(data.id);
      if (pending) {
        pending.resolve(data.result);
        pendingCommands.delete(data.id);
      }
      break;

    default:
      console.log('[LOCAL-AGENT-SERVER] Unknown message type:', data.type);
  }
}

// =============================================================================
// COMMAND EXECUTION (SEND TO LOCAL AGENT)
// =============================================================================

/**
 * Send command to local agent and wait for response
 */
function sendCommand(type, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const { timeout = CONFIG.commandTimeout, agentId } = options;

    // Find connected agent
    let targetWs = null;
    let targetAgent = null;

    for (const [ws, agent] of connectedAgents.entries()) {
      if (!agentId || agent.id === agentId) {
        if (ws.readyState === ws.OPEN) {
          targetWs = ws;
          targetAgent = agent;
          break;
        }
      }
    }

    if (!targetWs) {
      reject(new Error('No local agent connected'));
      return;
    }

    // Create command ID
    const id = `cmd_${++commandCounter}_${Date.now()}`;

    // Store pending command
    pendingCommands.set(id, {
      resolve,
      reject,
      sentAt: Date.now()
    });

    // Send command
    targetWs.send(JSON.stringify({
      id,
      type,
      payload
    }));

    console.log(`[LOCAL-AGENT-SERVER] Command sent: ${type} → ${targetAgent.name}`);

    // Timeout handler
    setTimeout(() => {
      if (pendingCommands.has(id)) {
        pendingCommands.delete(id);
        reject(new Error(`Command timeout: ${type}`));
      }
    }, timeout);
  });
}

/**
 * Execute shell command on local agent
 */
async function executeShell(command, options = {}) {
  return sendCommand('shell', {
    command,
    cwd: options.cwd,
    timeout: options.timeout,
    approved: options.approved
  }, options);
}

/**
 * Execute Claude Code on local agent
 */
async function executeClaudeCode(prompt, options = {}) {
  return sendCommand('claude_code', {
    prompt,
    cwd: options.cwd,
    timeout: options.timeout
  }, { ...options, timeout: 300000 });
}

/**
 * File operation on local agent
 */
async function fileOperation(operation, params, options = {}) {
  return sendCommand('file', {
    operation,
    ...params
  }, options);
}

/**
 * Get system info from local agent
 */
async function getSystemInfo(options = {}) {
  return sendCommand('system_info', {}, options);
}

/**
 * Approve a pending command
 */
async function approveCommand(approvalId, options = {}) {
  return sendCommand('approve', { approvalId }, options);
}

/**
 * Reject a pending command
 */
async function rejectCommand(approvalId, options = {}) {
  return sendCommand('reject', { approvalId }, options);
}

/**
 * Execute workflow (เปิด Terminal + Claude Code + Deploy)
 */
async function executeWorkflow(workflowOptions, options = {}) {
  return sendCommand('workflow', workflowOptions, { ...options, timeout: 10000 });
}

/**
 * Open Terminal with command
 */
async function openTerminal(command, options = {}) {
  return sendCommand('open_terminal', { command }, options);
}

/**
 * Open application on Mac
 */
async function openApp(appName, options = {}) {
  return sendCommand('open_app', { appName }, options);
}

// =============================================================================
// STATUS & UTILITIES
// =============================================================================

/**
 * Get connected agents status
 */
function getStatus() {
  const agents = [];

  for (const [ws, agent] of connectedAgents.entries()) {
    agents.push({
      id: agent.id,
      name: agent.name,
      connected: ws.readyState === ws.OPEN,
      connectedAt: agent.connectedAt,
      lastHeartbeat: agent.lastHeartbeat,
      capabilities: agent.capabilities,
      system: agent.system
    });
  }

  return {
    initialized: wss !== null,
    connectedAgents: agents.length,
    agents,
    pendingCommands: pendingCommands.size
  };
}

/**
 * Check if any agent is connected
 */
function isConnected() {
  for (const [ws] of connectedAgents.entries()) {
    if (ws.readyState === ws.OPEN) {
      return true;
    }
  }
  return false;
}

/**
 * Set notification callback (for LINE alerts)
 */
function setNotifyCallback(callback) {
  notifyCallback = callback;
}

/**
 * Notify owner via callback
 */
async function notify(message) {
  if (notifyCallback) {
    await notifyCallback(message);
  }
}

/**
 * Shutdown WebSocket server
 */
function shutdown() {
  if (wss) {
    wss.close();
    wss = null;
    connectedAgents.clear();
    pendingCommands.clear();
    console.log('[LOCAL-AGENT-SERVER] Shutdown complete');
  }
}

export default {
  // Initialization
  initialize,
  shutdown,

  // Command execution
  executeShell,
  executeClaudeCode,
  fileOperation,
  getSystemInfo,
  approveCommand,
  rejectCommand,

  // Workflow (Terminal + Claude + Deploy)
  executeWorkflow,
  openTerminal,
  openApp,

  // Status
  getStatus,
  isConnected,

  // Utilities
  setNotifyCallback,
  notify
};
