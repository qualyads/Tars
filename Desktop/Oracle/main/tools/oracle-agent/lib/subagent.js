/**
 * SubAgentManager - AI สร้าง AI ลูกมาช่วยทำงาน
 * Phase 5: Multi-threaded AI
 *
 * Features:
 * - Non-blocking spawn (returns immediately)
 * - Parallel execution (maxConcurrent)
 * - Timeout handling
 * - Announce protocol (results back to main)
 * - Cost optimization (Haiku for sub-agents)
 */

// Use claude.js with failover
import claude from './claude.js';
import { v4 as uuid } from 'uuid';
import PQueue from 'p-queue';

// Default configuration
const DEFAULT_CONFIG = {
  maxConcurrent: 8,
  defaultModel: 'claude-3-haiku-20240307',
  defaultTimeoutSeconds: 300, // 5 minutes
  archiveAfterMinutes: 60,
  minimalPrompt: true
};

class SubAgentManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Uses claude.js with failover (no direct Anthropic client)

    // Queue for concurrent execution
    this.queue = new PQueue({ concurrency: this.config.maxConcurrent });

    // Track active runs
    this.activeRuns = new Map();

    // Callbacks
    this.onAnnounce = null;
    this.onComplete = null;

    // Stats
    this.stats = {
      totalSpawned: 0,
      totalCompleted: 0,
      totalErrors: 0,
      totalTimeouts: 0
    };
  }

  /**
   * Set callback for announce (send results to user)
   */
  setAnnounceCallback(callback) {
    this.onAnnounce = callback;
  }

  /**
   * Set callback for completion (optional logging)
   */
  setCompleteCallback(callback) {
    this.onComplete = callback;
  }

  /**
   * Spawn a sub-agent (non-blocking)
   * @param {Object} params - Spawn parameters
   * @returns {Object} - { status: 'accepted', runId, sessionKey }
   */
  async spawn({ task, label, model, runTimeoutSeconds, cleanup }) {
    const runId = uuid();
    const sessionKey = `subagent:${runId}`;
    const startTime = Date.now();

    // Store run info
    this.activeRuns.set(runId, {
      runId,
      sessionKey,
      task,
      label: label || 'Sub-Agent Task',
      model: model || this.config.defaultModel,
      timeoutSeconds: runTimeoutSeconds || this.config.defaultTimeoutSeconds,
      cleanup: cleanup || 'archive',
      status: 'queued',
      startTime
    });

    this.stats.totalSpawned++;

    // Queue the task (non-blocking)
    this.queue.add(() => this._runSubAgent(runId));

    console.log(`[SUBAGENT] Spawned: ${runId} - "${label || task.substring(0, 50)}..."`);

    // Return immediately
    return {
      status: 'accepted',
      runId,
      sessionKey,
      queueSize: this.queue.size,
      pending: this.queue.pending
    };
  }

  /**
   * Internal: Run the sub-agent
   */
  async _runSubAgent(runId) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.status = 'running';
    const startTime = Date.now();

    try {
      // Build minimal prompt
      const systemPrompt = this._buildMinimalPrompt();

      // Create timeout promise
      const timeoutMs = run.timeoutSeconds * 1000;

      // Run with timeout
      const result = await this._runWithTimeout(
        () => this._callClaude(systemPrompt, run.task, run.model),
        timeoutMs
      );

      const runtime = Date.now() - startTime;
      run.status = 'completed';
      run.runtime = runtime;
      run.result = result;

      this.stats.totalCompleted++;

      console.log(`[SUBAGENT] Completed: ${runId} in ${Math.round(runtime/1000)}s`);

      // Announce result
      await this._announce({
        runId,
        label: run.label,
        status: 'success',
        result: result.text,
        runtime,
        tokensIn: result.usage?.input_tokens || 0,
        tokensOut: result.usage?.output_tokens || 0
      });

    } catch (error) {
      const runtime = Date.now() - startTime;
      const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timeout');

      run.status = isTimeout ? 'timeout' : 'error';
      run.runtime = runtime;
      run.error = error.message;

      if (isTimeout) {
        this.stats.totalTimeouts++;
      } else {
        this.stats.totalErrors++;
      }

      console.error(`[SUBAGENT] ${isTimeout ? 'Timeout' : 'Error'}: ${runId} - ${error.message}`);

      // Announce error
      await this._announce({
        runId,
        label: run.label,
        status: isTimeout ? 'timeout' : 'error',
        error: error.message,
        runtime
      });
    }

    // Cleanup if needed
    if (run.cleanup === 'delete') {
      this.activeRuns.delete(runId);
    }

    // Call complete callback
    if (this.onComplete) {
      this.onComplete(run);
    }
  }

  /**
   * Build minimal system prompt for sub-agent
   */
  _buildMinimalPrompt() {
    return `[Minimal prompt mode - Sub-Agent]

You are a sub-agent spawned to complete a specific task.
Focus ONLY on the task given. Be efficient and thorough.

Rules:
1. Complete the task to the best of your ability
2. Report results clearly and concisely
3. If you cannot complete the task, explain why
4. Do not ask clarifying questions - work with what you have

When finished, provide a clear summary of:
- What you found/did
- Key insights or results
- Any important notes

If there's nothing meaningful to report, respond with: ANNOUNCE_SKIP`;
  }

  /**
   * Call Claude API with failover
   */
  async _callClaude(systemPrompt, task, model) {
    const text = await claude.chat(
      [{ role: 'user', content: task }],
      { system: systemPrompt, model, max_tokens: 4096 }
    );

    return {
      text: text || '',
      usage: {} // usage not available with failover
    };
  }

  /**
   * Run with timeout
   */
  async _runWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error('Operation timed out');
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Announce results back
   */
  async _announce({ runId, label, status, result, error, runtime, tokensIn, tokensOut }) {
    // Check for ANNOUNCE_SKIP
    if (result?.trim() === 'ANNOUNCE_SKIP') {
      console.log(`[SUBAGENT] Announce skipped: ${runId}`);
      return;
    }

    // Format announce message
    const message = this._formatAnnounce({
      runId,
      label,
      status,
      result,
      error,
      runtime,
      tokensIn,
      tokensOut
    });

    // Call announce callback
    if (this.onAnnounce) {
      await this.onAnnounce(message);
    }
  }

  /**
   * Format announce message
   */
  _formatAnnounce({ runId, label, status, result, error, runtime, tokensIn, tokensOut }) {
    const statusEmoji = {
      success: '✅',
      error: '❌',
      timeout: '⏰'
    };

    let message = `[Sub-Agent: ${label}]\n\n`;
    message += `${statusEmoji[status] || '❓'} Status: ${status}\n\n`;

    if (status === 'success' && result) {
      message += `Result:\n${result}\n\n`;
    } else if (error) {
      message += `Error: ${error}\n\n`;
    }

    message += '---\n';
    message += `Runtime: ${Math.round(runtime/1000)}s`;

    if (tokensIn && tokensOut) {
      message += ` | Tokens: ${tokensIn} in / ${tokensOut} out`;
    }

    message += `\nSession: ${runId.substring(0, 8)}`;

    return message;
  }

  /**
   * Get status of all runs
   */
  getStatus() {
    const active = [];
    const completed = [];

    for (const [runId, run] of this.activeRuns) {
      if (run.status === 'running' || run.status === 'queued') {
        active.push({
          runId,
          label: run.label,
          status: run.status,
          startTime: run.startTime
        });
      } else {
        completed.push({
          runId,
          label: run.label,
          status: run.status,
          runtime: run.runtime
        });
      }
    }

    return {
      config: {
        maxConcurrent: this.config.maxConcurrent,
        defaultModel: this.config.defaultModel,
        defaultTimeoutSeconds: this.config.defaultTimeoutSeconds
      },
      queue: {
        size: this.queue.size,
        pending: this.queue.pending
      },
      active,
      completed: completed.slice(-10), // Last 10
      stats: this.stats
    };
  }

  /**
   * Get specific run
   */
  getRun(runId) {
    return this.activeRuns.get(runId);
  }

  /**
   * Stop a specific run (best effort)
   */
  stop(runId) {
    const run = this.activeRuns.get(runId);
    if (run && run.status === 'queued') {
      run.status = 'cancelled';
      return true;
    }
    // Cannot stop running tasks easily
    return false;
  }

  /**
   * Stop all queued runs
   */
  stopAll() {
    let stopped = 0;
    for (const [runId, run] of this.activeRuns) {
      if (run.status === 'queued') {
        run.status = 'cancelled';
        stopped++;
      }
    }
    this.queue.clear();
    return stopped;
  }

  /**
   * Clear completed runs
   */
  clearCompleted() {
    let cleared = 0;
    for (const [runId, run] of this.activeRuns) {
      if (run.status !== 'running' && run.status !== 'queued') {
        this.activeRuns.delete(runId);
        cleared++;
      }
    }
    return cleared;
  }
}

export default SubAgentManager;
