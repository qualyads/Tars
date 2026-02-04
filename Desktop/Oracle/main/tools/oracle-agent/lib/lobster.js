/**
 * Lobster - Deterministic Workflow Engine
 * Run predefined sequences of actions without AI hallucination
 *
 * Features:
 * - YAML/JSON workflow definitions
 * - Step-by-step execution
 * - Conditional branching
 * - Variable interpolation
 * - Error handling & retries
 *
 * Use Cases:
 * - Daily reports (deterministic)
 * - Booking confirmations
 * - Price updates
 * - Scheduled tasks
 */

/**
 * Built-in step types
 */
const STEP_TYPES = {
  // API calls
  FETCH: 'fetch',
  API: 'api',

  // Data manipulation
  SET: 'set',
  TRANSFORM: 'transform',

  // Control flow
  IF: 'if',
  LOOP: 'loop',
  WAIT: 'wait',

  // Output
  SEND: 'send',
  LOG: 'log',

  // AI (optional)
  AI: 'ai',

  // Custom
  CUSTOM: 'custom'
};

/**
 * Workflow execution context
 */
class WorkflowContext {
  constructor(initialVars = {}) {
    this.variables = { ...initialVars };
    this.results = [];
    this.logs = [];
    this.startTime = Date.now();
  }

  get(key) {
    return this.variables[key];
  }

  set(key, value) {
    this.variables[key] = value;
  }

  log(message) {
    this.logs.push({
      timestamp: Date.now(),
      message
    });
  }

  addResult(stepName, result) {
    this.results.push({
      step: stepName,
      result,
      timestamp: Date.now()
    });
  }

  // Interpolate variables in string: "Hello {{name}}"
  interpolate(str) {
    if (typeof str !== 'string') return str;

    return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const keys = path.split('.');
      let value = this.variables;
      for (const key of keys) {
        value = value?.[key];
        if (value === undefined) return match;
      }
      return value;
    });
  }
}

/**
 * Lobster Workflow Engine
 */
class Lobster {
  constructor() {
    // Registered workflows
    this.workflows = new Map();

    // Custom step handlers
    this.stepHandlers = new Map();

    // Running workflows
    this.running = new Map();

    // Stats
    this.stats = {
      totalRuns: 0,
      successful: 0,
      failed: 0
    };

    // Register built-in handlers
    this._registerBuiltinHandlers();
  }

  /**
   * Register built-in step handlers
   */
  _registerBuiltinHandlers() {
    // FETCH step
    this.stepHandlers.set(STEP_TYPES.FETCH, async (step, ctx) => {
      const url = ctx.interpolate(step.url);
      const options = {
        method: step.method || 'GET',
        headers: step.headers || {},
        ...(step.body && { body: JSON.stringify(ctx.interpolate(step.body)) })
      };

      const response = await fetch(url, options);
      const data = await response.json().catch(() => response.text());

      if (step.saveTo) {
        ctx.set(step.saveTo, data);
      }

      return data;
    });

    // SET step
    this.stepHandlers.set(STEP_TYPES.SET, async (step, ctx) => {
      const value = ctx.interpolate(step.value);
      ctx.set(step.key, value);
      return value;
    });

    // TRANSFORM step
    this.stepHandlers.set(STEP_TYPES.TRANSFORM, async (step, ctx) => {
      const input = ctx.get(step.input);
      let result;

      switch (step.operation) {
        case 'map':
          result = input.map(item => {
            const mapped = {};
            for (const [key, path] of Object.entries(step.mapping)) {
              mapped[key] = path.split('.').reduce((obj, k) => obj?.[k], item);
            }
            return mapped;
          });
          break;
        case 'filter':
          result = input.filter(item => {
            const value = step.field.split('.').reduce((obj, k) => obj?.[k], item);
            return this._evaluateCondition(value, step.condition, step.compareValue);
          });
          break;
        case 'sort':
          result = [...input].sort((a, b) => {
            const aVal = step.field.split('.').reduce((obj, k) => obj?.[k], a);
            const bVal = step.field.split('.').reduce((obj, k) => obj?.[k], b);
            return step.order === 'desc' ? bVal - aVal : aVal - bVal;
          });
          break;
        case 'first':
          result = input[0];
          break;
        case 'last':
          result = input[input.length - 1];
          break;
        case 'count':
          result = input.length;
          break;
        case 'sum':
          result = input.reduce((sum, item) => {
            const val = step.field.split('.').reduce((obj, k) => obj?.[k], item);
            return sum + (parseFloat(val) || 0);
          }, 0);
          break;
        default:
          result = input;
      }

      if (step.saveTo) {
        ctx.set(step.saveTo, result);
      }

      return result;
    });

    // WAIT step
    this.stepHandlers.set(STEP_TYPES.WAIT, async (step, ctx) => {
      const ms = step.ms || step.seconds * 1000 || 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return { waited: ms };
    });

    // LOG step
    this.stepHandlers.set(STEP_TYPES.LOG, async (step, ctx) => {
      const message = ctx.interpolate(step.message);
      ctx.log(message);
      console.log(`[LOBSTER] ${message}`);
      return message;
    });

    // IF step (conditional)
    this.stepHandlers.set(STEP_TYPES.IF, async (step, ctx) => {
      const value = ctx.interpolate(step.condition.value);
      const compare = ctx.interpolate(step.condition.compare);
      const result = this._evaluateCondition(value, step.condition.operator, compare);

      return { condition: result };
    });

    // LOOP step
    this.stepHandlers.set(STEP_TYPES.LOOP, async (step, ctx) => {
      const items = ctx.get(step.over) || [];
      const results = [];

      for (const item of items) {
        ctx.set(step.as || 'item', item);

        // Execute nested steps
        for (const nestedStep of step.steps || []) {
          const result = await this._executeStep(nestedStep, ctx);
          results.push(result);
        }
      }

      return results;
    });
  }

  /**
   * Evaluate a condition
   */
  _evaluateCondition(value, operator, compare) {
    switch (operator) {
      case 'eq':
      case '==':
        return value == compare;
      case 'neq':
      case '!=':
        return value != compare;
      case 'gt':
      case '>':
        return value > compare;
      case 'gte':
      case '>=':
        return value >= compare;
      case 'lt':
      case '<':
        return value < compare;
      case 'lte':
      case '<=':
        return value <= compare;
      case 'contains':
        return String(value).includes(compare);
      case 'startsWith':
        return String(value).startsWith(compare);
      case 'endsWith':
        return String(value).endsWith(compare);
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return !!value;
    }
  }

  /**
   * Register a workflow
   */
  register(name, workflow) {
    this.workflows.set(name, workflow);
    console.log(`[LOBSTER] Registered workflow: ${name}`);
    return this;
  }

  /**
   * Register a custom step handler
   */
  registerHandler(type, handler) {
    this.stepHandlers.set(type, handler);
    return this;
  }

  /**
   * Run a workflow
   */
  async run(name, initialVars = {}) {
    const workflow = this.workflows.get(name);
    if (!workflow) {
      throw new Error(`Workflow not found: ${name}`);
    }

    const runId = `${name}_${Date.now()}`;
    const ctx = new WorkflowContext(initialVars);

    this.stats.totalRuns++;
    this.running.set(runId, { name, ctx, status: 'running', startTime: Date.now() });

    try {
      console.log(`[LOBSTER] Starting workflow: ${name}`);

      // Execute each step
      for (const step of workflow.steps || []) {
        const result = await this._executeStep(step, ctx);
        ctx.addResult(step.name || step.type, result);

        // Handle IF step branching
        if (step.type === STEP_TYPES.IF && result.condition === false) {
          // Skip to else steps or continue
          if (step.else) {
            for (const elseStep of step.else) {
              const elseResult = await this._executeStep(elseStep, ctx);
              ctx.addResult(elseStep.name || elseStep.type, elseResult);
            }
          }
        } else if (step.type === STEP_TYPES.IF && step.then) {
          // Execute then steps
          for (const thenStep of step.then) {
            const thenResult = await this._executeStep(thenStep, ctx);
            ctx.addResult(thenStep.name || thenStep.type, thenResult);
          }
        }
      }

      this.stats.successful++;
      this.running.set(runId, { ...this.running.get(runId), status: 'completed' });

      console.log(`[LOBSTER] Workflow completed: ${name}`);

      return {
        success: true,
        runId,
        variables: ctx.variables,
        results: ctx.results,
        logs: ctx.logs,
        duration: Date.now() - ctx.startTime
      };
    } catch (err) {
      this.stats.failed++;
      this.running.set(runId, { ...this.running.get(runId), status: 'failed', error: err.message });

      console.error(`[LOBSTER] Workflow failed: ${name}`, err.message);

      return {
        success: false,
        runId,
        error: err.message,
        logs: ctx.logs,
        duration: Date.now() - ctx.startTime
      };
    }
  }

  /**
   * Execute a single step
   */
  async _executeStep(step, ctx) {
    const handler = this.stepHandlers.get(step.type);
    if (!handler) {
      throw new Error(`Unknown step type: ${step.type}`);
    }

    ctx.log(`Executing: ${step.name || step.type}`);

    // Retry logic
    const maxRetries = step.retry || 0;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await handler(step, ctx);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          ctx.log(`Retrying ${step.name || step.type} (${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  /**
   * List registered workflows
   */
  list() {
    return Array.from(this.workflows.keys());
  }

  /**
   * Get workflow definition
   */
  get(name) {
    return this.workflows.get(name);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      registeredWorkflows: this.workflows.size,
      workflows: this.list(),
      runningCount: Array.from(this.running.values()).filter(r => r.status === 'running').length,
      stats: this.stats
    };
  }
}

// Singleton instance
const lobster = new Lobster();

// Register some example workflows
lobster.register('daily-gold-report', {
  name: 'Daily Gold Report',
  description: 'Fetch gold price and create report',
  steps: [
    {
      type: 'fetch',
      name: 'fetch-gold-price',
      url: 'https://api.gold.org/prices/latest',
      saveTo: 'goldData'
    },
    {
      type: 'transform',
      name: 'extract-price',
      input: 'goldData',
      operation: 'first',
      saveTo: 'price'
    },
    {
      type: 'log',
      message: 'Gold price: {{price}}'
    }
  ]
});

export default lobster;
export { Lobster, STEP_TYPES, WorkflowContext };
