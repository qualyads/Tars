/**
 * Coding Agent Orchestrator
 * Spawn and control external AI coding agents
 *
 * Supported agents:
 * - Codex CLI (OpenAI)
 * - Claude Code (Anthropic)
 * - Custom agents
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

/**
 * Supported coding agents
 */
const AGENTS = {
  CODEX: 'codex',
  CLAUDE_CODE: 'claude',
  CUSTOM: 'custom'
};

/**
 * Agent status
 */
const STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
};

class CodingOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
    this.outputs = new Map();
    this.maxConcurrent = 4;
    this.defaultTimeout = 600000; // 10 minutes
  }

  /**
   * Spawn a coding agent
   * @param {object} options - Spawn options
   * @returns {object} { runId, status }
   */
  async spawn(options) {
    const {
      agent = AGENTS.CLAUDE_CODE,
      task,
      workdir = process.cwd(),
      timeout = this.defaultTimeout,
      background = true,
      args = []
    } = options;

    const runId = uuid();
    const startTime = Date.now();

    // Build command based on agent
    let command, commandArgs;

    switch (agent) {
      case AGENTS.CODEX:
        command = 'codex';
        commandArgs = ['exec', '--full-auto', task, ...args];
        break;

      case AGENTS.CLAUDE_CODE:
        command = 'claude';
        commandArgs = ['-p', task, '--yes', ...args];
        break;

      case AGENTS.CUSTOM:
        command = options.command;
        commandArgs = options.commandArgs || [];
        break;

      default:
        throw new Error(`Unknown agent: ${agent}`);
    }

    console.log(`[ORCHESTRATOR] Spawning ${agent}: ${runId}`);
    console.log(`[ORCHESTRATOR] Command: ${command} ${commandArgs.join(' ')}`);

    // Store process info
    const processInfo = {
      runId,
      agent,
      task,
      command,
      commandArgs,
      workdir,
      status: STATUS.QUEUED,
      startTime,
      timeout,
      output: '',
      error: ''
    };

    this.processes.set(runId, processInfo);
    this.outputs.set(runId, []);

    // Spawn process
    try {
      const proc = spawn(command, commandArgs, {
        cwd: workdir,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      processInfo.pid = proc.pid;
      processInfo.status = STATUS.RUNNING;
      processInfo.process = proc;

      // Collect output
      proc.stdout.on('data', (data) => {
        const text = data.toString();
        processInfo.output += text;
        this.outputs.get(runId).push({ type: 'stdout', text, timestamp: Date.now() });
        this.emit('output', { runId, type: 'stdout', text });
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        processInfo.error += text;
        this.outputs.get(runId).push({ type: 'stderr', text, timestamp: Date.now() });
        this.emit('output', { runId, type: 'stderr', text });
      });

      // Handle completion
      proc.on('close', (code) => {
        processInfo.exitCode = code;
        processInfo.endTime = Date.now();
        processInfo.runtime = processInfo.endTime - processInfo.startTime;
        processInfo.status = code === 0 ? STATUS.COMPLETED : STATUS.ERROR;
        delete processInfo.process;

        console.log(`[ORCHESTRATOR] ${runId} completed with code ${code}`);
        this.emit('complete', {
          runId,
          status: processInfo.status,
          exitCode: code,
          runtime: processInfo.runtime
        });
      });

      proc.on('error', (error) => {
        processInfo.status = STATUS.ERROR;
        processInfo.error = error.message;
        processInfo.endTime = Date.now();
        delete processInfo.process;

        console.error(`[ORCHESTRATOR] ${runId} error: ${error.message}`);
        this.emit('error', { runId, error: error.message });
      });

      // Set timeout
      if (timeout > 0) {
        setTimeout(() => {
          if (processInfo.status === STATUS.RUNNING) {
            this.stop(runId);
            processInfo.status = STATUS.TIMEOUT;
            this.emit('timeout', { runId });
          }
        }, timeout);
      }

      return {
        runId,
        status: STATUS.RUNNING,
        pid: proc.pid,
        agent,
        task: task.substring(0, 100)
      };

    } catch (error) {
      processInfo.status = STATUS.ERROR;
      processInfo.error = error.message;

      return {
        runId,
        status: STATUS.ERROR,
        error: error.message
      };
    }
  }

  /**
   * Send input to a running process
   * @param {string} runId - Run ID
   * @param {string} input - Input to send
   */
  sendInput(runId, input) {
    const processInfo = this.processes.get(runId);
    if (!processInfo || !processInfo.process) {
      throw new Error(`Process not found or not running: ${runId}`);
    }

    processInfo.process.stdin.write(input + '\n');
    this.outputs.get(runId).push({ type: 'stdin', text: input, timestamp: Date.now() });
  }

  /**
   * Stop a running process
   * @param {string} runId - Run ID
   */
  stop(runId) {
    const processInfo = this.processes.get(runId);
    if (!processInfo || !processInfo.process) {
      return false;
    }

    processInfo.process.kill('SIGTERM');
    processInfo.status = STATUS.CANCELLED;
    processInfo.endTime = Date.now();

    console.log(`[ORCHESTRATOR] Stopped: ${runId}`);
    return true;
  }

  /**
   * Stop all running processes
   */
  stopAll() {
    let stopped = 0;
    for (const [runId, processInfo] of this.processes) {
      if (processInfo.status === STATUS.RUNNING && processInfo.process) {
        this.stop(runId);
        stopped++;
      }
    }
    return stopped;
  }

  /**
   * Get process info
   * @param {string} runId - Run ID
   */
  getProcess(runId) {
    const processInfo = this.processes.get(runId);
    if (!processInfo) return null;

    return {
      runId: processInfo.runId,
      agent: processInfo.agent,
      task: processInfo.task,
      status: processInfo.status,
      pid: processInfo.pid,
      startTime: processInfo.startTime,
      endTime: processInfo.endTime,
      runtime: processInfo.runtime,
      exitCode: processInfo.exitCode,
      outputLength: processInfo.output.length,
      errorLength: processInfo.error.length
    };
  }

  /**
   * Get process output
   * @param {string} runId - Run ID
   * @param {object} options - Options (tail, type)
   */
  getOutput(runId, options = {}) {
    const processInfo = this.processes.get(runId);
    if (!processInfo) return null;

    const outputs = this.outputs.get(runId) || [];

    if (options.tail) {
      return outputs.slice(-options.tail);
    }

    if (options.type) {
      return outputs.filter(o => o.type === options.type);
    }

    return outputs;
  }

  /**
   * Get all active processes
   */
  getActive() {
    const active = [];
    for (const [runId, processInfo] of this.processes) {
      if (processInfo.status === STATUS.RUNNING) {
        active.push(this.getProcess(runId));
      }
    }
    return active;
  }

  /**
   * Get status summary
   */
  getStatus() {
    let running = 0, completed = 0, errors = 0;

    for (const processInfo of this.processes.values()) {
      if (processInfo.status === STATUS.RUNNING) running++;
      else if (processInfo.status === STATUS.COMPLETED) completed++;
      else if (processInfo.status === STATUS.ERROR || processInfo.status === STATUS.TIMEOUT) errors++;
    }

    return {
      totalProcesses: this.processes.size,
      running,
      completed,
      errors,
      maxConcurrent: this.maxConcurrent,
      supportedAgents: Object.values(AGENTS)
    };
  }

  /**
   * Clear completed processes
   */
  clearCompleted() {
    let cleared = 0;
    for (const [runId, processInfo] of this.processes) {
      if (processInfo.status !== STATUS.RUNNING && processInfo.status !== STATUS.QUEUED) {
        this.processes.delete(runId);
        this.outputs.delete(runId);
        cleared++;
      }
    }
    return cleared;
  }
}

// Singleton
const codingOrchestrator = new CodingOrchestrator();

export default codingOrchestrator;
export { CodingOrchestrator, AGENTS, STATUS };
