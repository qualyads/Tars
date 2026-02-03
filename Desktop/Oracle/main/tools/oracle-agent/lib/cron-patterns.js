/**
 * Cron Patterns - Based on OpenClaw Pattern
 *
 * Natural language time patterns for scheduling.
 *
 * Supported formats:
 * - at HH:MM         → Run once at specific time
 * - every Nh        → Run every N hours
 * - every Nm        → Run every N minutes
 * - every day at HH:MM → Run daily at time
 * - cron: * * * * * → Standard cron syntax
 *
 * Examples:
 * - "at 07:00" → Morning briefing
 * - "every 15m" → Check every 15 minutes
 * - "every 1h" → Hourly check
 * - "every day at 23:00" → Daily summary
 * - "cron: 0 7 * * *" → Standard cron (7AM daily)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  timezone: 'Asia/Bangkok',
  defaultInterval: 60000, // 1 minute fallback
};

// =============================================================================
// PATTERN PARSERS
// =============================================================================

const PATTERNS = {
  // "at 07:00" or "at 7:00"
  at: /^at\s+(\d{1,2}):(\d{2})$/i,

  // "every 15m" or "every 15 minutes"
  everyMinutes: /^every\s+(\d+)\s*m(?:in(?:utes?)?)?$/i,

  // "every 2h" or "every 2 hours"
  everyHours: /^every\s+(\d+)\s*h(?:ours?)?$/i,

  // "every day at 07:00"
  dailyAt: /^every\s+day\s+at\s+(\d{1,2}):(\d{2})$/i,

  // "cron: * * * * *"
  cron: /^cron:\s*(.+)$/i,

  // Thai patterns
  thaiEveryMinutes: /^ทุก\s*(\d+)\s*นาที$/,
  thaiEveryHours: /^ทุก\s*(\d+)\s*ชั่วโมง$/,
  thaiAt: /^เวลา\s*(\d{1,2})[:.:](\d{2})$/,
};

/**
 * Parse time pattern string into schedule config
 */
function parsePattern(pattern) {
  const trimmed = pattern.trim();

  // "at HH:MM"
  let match = trimmed.match(PATTERNS.at);
  if (match) {
    return {
      type: 'at',
      hour: parseInt(match[1], 10),
      minute: parseInt(match[2], 10),
      original: pattern
    };
  }

  // "every Nm"
  match = trimmed.match(PATTERNS.everyMinutes);
  if (match) {
    return {
      type: 'interval',
      intervalMs: parseInt(match[1], 10) * 60 * 1000,
      original: pattern
    };
  }

  // "every Nh"
  match = trimmed.match(PATTERNS.everyHours);
  if (match) {
    return {
      type: 'interval',
      intervalMs: parseInt(match[1], 10) * 60 * 60 * 1000,
      original: pattern
    };
  }

  // "every day at HH:MM"
  match = trimmed.match(PATTERNS.dailyAt);
  if (match) {
    return {
      type: 'daily',
      hour: parseInt(match[1], 10),
      minute: parseInt(match[2], 10),
      original: pattern
    };
  }

  // "cron: * * * * *"
  match = trimmed.match(PATTERNS.cron);
  if (match) {
    return {
      type: 'cron',
      expression: match[1].trim(),
      original: pattern
    };
  }

  // Thai: "ทุก N นาที"
  match = trimmed.match(PATTERNS.thaiEveryMinutes);
  if (match) {
    return {
      type: 'interval',
      intervalMs: parseInt(match[1], 10) * 60 * 1000,
      original: pattern
    };
  }

  // Thai: "ทุก N ชั่วโมง"
  match = trimmed.match(PATTERNS.thaiEveryHours);
  if (match) {
    return {
      type: 'interval',
      intervalMs: parseInt(match[1], 10) * 60 * 60 * 1000,
      original: pattern
    };
  }

  // Thai: "เวลา HH:MM"
  match = trimmed.match(PATTERNS.thaiAt);
  if (match) {
    return {
      type: 'at',
      hour: parseInt(match[1], 10),
      minute: parseInt(match[2], 10),
      original: pattern
    };
  }

  return null;
}

// =============================================================================
// CRON EXPRESSION PARSER (Simplified)
// =============================================================================

/**
 * Parse cron expression (minute hour day month weekday)
 */
function parseCronExpression(expression) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4]
  };
}

/**
 * Check if cron field matches current value
 */
function cronFieldMatches(field, value) {
  if (field === '*') return true;

  // Handle ranges (e.g., "1-5")
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }

  // Handle lists (e.g., "1,3,5")
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }

  // Handle step (e.g., "*/15")
  if (field.includes('/')) {
    const [base, step] = field.split('/');
    if (base === '*') {
      return value % parseInt(step, 10) === 0;
    }
  }

  // Direct match
  return parseInt(field, 10) === value;
}

/**
 * Check if cron expression matches current time
 */
function cronMatches(expression, date = new Date()) {
  const cron = parseCronExpression(expression);
  if (!cron) return false;

  return (
    cronFieldMatches(cron.minute, date.getMinutes()) &&
    cronFieldMatches(cron.hour, date.getHours()) &&
    cronFieldMatches(cron.dayOfMonth, date.getDate()) &&
    cronFieldMatches(cron.month, date.getMonth() + 1) &&
    cronFieldMatches(cron.dayOfWeek, date.getDay())
  );
}

// =============================================================================
// SCHEDULER
// =============================================================================

/**
 * Create a scheduler from patterns
 */
function createScheduler(options = {}) {
  const timezone = options.timezone || CONFIG.timezone;
  const jobs = new Map();
  let timerId = null;
  let checkInterval = 60000; // Check every minute

  /**
   * Add a scheduled job
   */
  function addJob(name, pattern, callback) {
    const parsed = parsePattern(pattern);
    if (!parsed) {
      console.error(`[CRON] Invalid pattern: ${pattern}`);
      return false;
    }

    jobs.set(name, {
      name,
      pattern: parsed,
      callback,
      lastRun: null,
      nextRun: null
    });

    console.log(`[CRON] Added job: ${name} (${pattern})`);
    updateNextRun(name);
    return true;
  }

  /**
   * Remove a scheduled job
   */
  function removeJob(name) {
    if (jobs.has(name)) {
      jobs.delete(name);
      console.log(`[CRON] Removed job: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Calculate next run time
   */
  function updateNextRun(name) {
    const job = jobs.get(name);
    if (!job) return;

    const now = new Date();
    const pattern = job.pattern;

    switch (pattern.type) {
      case 'interval':
        job.nextRun = new Date(now.getTime() + pattern.intervalMs);
        break;

      case 'at':
      case 'daily':
        const target = new Date(now);
        target.setHours(pattern.hour, pattern.minute, 0, 0);
        if (target <= now) {
          target.setDate(target.getDate() + 1);
        }
        job.nextRun = target;
        break;

      case 'cron':
        // For cron, we check every minute
        job.nextRun = new Date(now.getTime() + 60000);
        break;
    }
  }

  /**
   * Check and run due jobs
   */
  async function tick() {
    const now = new Date();

    for (const [name, job] of jobs) {
      let shouldRun = false;

      if (job.pattern.type === 'cron') {
        // Cron: check if expression matches
        shouldRun = cronMatches(job.pattern.expression, now);
        // Prevent running multiple times in same minute
        if (shouldRun && job.lastRun) {
          const lastMinute = Math.floor(job.lastRun.getTime() / 60000);
          const nowMinute = Math.floor(now.getTime() / 60000);
          if (lastMinute === nowMinute) {
            shouldRun = false;
          }
        }
      } else if (job.nextRun && now >= job.nextRun) {
        shouldRun = true;
      }

      if (shouldRun) {
        console.log(`[CRON] Running: ${name}`);
        try {
          await job.callback();
          job.lastRun = now;
          updateNextRun(name);
        } catch (error) {
          console.error(`[CRON] Job failed: ${name}`, error.message);
        }
      }
    }
  }

  /**
   * Start the scheduler
   */
  function start() {
    if (timerId) return;

    console.log(`[CRON] Starting scheduler (${jobs.size} jobs)`);
    timerId = setInterval(tick, checkInterval);
    tick(); // Run immediately
  }

  /**
   * Stop the scheduler
   */
  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      console.log('[CRON] Scheduler stopped');
    }
  }

  /**
   * Get status of all jobs
   */
  function status() {
    return {
      running: !!timerId,
      jobs: Array.from(jobs.values()).map(job => ({
        name: job.name,
        pattern: job.pattern.original,
        lastRun: job.lastRun?.toISOString() || null,
        nextRun: job.nextRun?.toISOString() || null
      }))
    };
  }

  return {
    addJob,
    removeJob,
    start,
    stop,
    status,
    tick // For manual trigger
  };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get milliseconds until next occurrence of time
 */
function msUntilTime(hour, minute, timezone = CONFIG.timezone) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * Format duration in human readable
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  // Parsing
  parsePattern,
  parseCronExpression,
  cronMatches,
  cronFieldMatches,

  // Scheduler
  createScheduler,

  // Utilities
  msUntilTime,
  formatDuration,

  // Constants
  PATTERNS,
  CONFIG
};

export default {
  parsePattern,
  createScheduler,
  cronMatches
};
