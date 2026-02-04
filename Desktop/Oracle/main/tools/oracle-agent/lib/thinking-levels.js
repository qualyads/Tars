/**
 * Thinking Levels Manager
 * Control AI reasoning depth based on question complexity
 *
 * Features:
 * - Multiple thinking levels (off → xhigh)
 * - Auto-detect question complexity
 * - Token budget management
 * - Cost optimization (40-50% savings)
 *
 * Levels:
 * - off: No extended thinking, instant response
 * - minimal: ~500 tokens thinking
 * - low: ~1000 tokens thinking
 * - medium: ~2000 tokens thinking (default)
 * - high: ~4000 tokens thinking
 * - xhigh: ~8000 tokens thinking
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Thinking levels configuration
 */
const LEVELS = {
  off: {
    name: 'Off',
    budget: 0,
    description: 'No extended thinking - instant response',
    useCase: 'Simple questions, FAQs, greetings'
  },
  minimal: {
    name: 'Minimal',
    budget: 500,
    description: 'Brief consideration',
    useCase: 'Basic lookups, simple calculations'
  },
  low: {
    name: 'Low',
    budget: 1000,
    description: 'Light reasoning',
    useCase: 'Standard questions, explanations'
  },
  medium: {
    name: 'Medium',
    budget: 2000,
    description: 'Moderate reasoning',
    useCase: 'Complex questions, analysis'
  },
  high: {
    name: 'High',
    budget: 4000,
    description: 'Deep reasoning',
    useCase: 'Difficult problems, strategy'
  },
  xhigh: {
    name: 'Extra High',
    budget: 8000,
    description: 'Maximum reasoning',
    useCase: 'Research, comprehensive analysis'
  }
};

/**
 * Complexity indicators for auto-detection
 */
const COMPLEXITY_PATTERNS = {
  // Simple questions (off/minimal)
  simple: [
    /^(hi|hello|สวัสดี|หวัดดี)/i,
    /^(yes|no|ใช่|ไม่)/i,
    /^(ok|okay|โอเค|ได้)/i,
    /^(thanks|ขอบคุณ|thx)/i,
    /\?$.*(\d{1,2})\s*(บาท|thb|฿)/i,  // Simple price questions
    /ห้องว่าง(ไหม|มั้ย)/i,
    /เปิด.*กี่โมง/i,
    /อยู่ที่ไหน/i,
    /เบอร์โทร/i,
    /^what('s| is) (the )?(time|date|weather)/i,
  ],

  // Basic questions (low)
  basic: [
    /ราคา.*เท่าไ(ร|หร่)/i,
    /how much/i,
    /check.*availability/i,
    /booking.*status/i,
    /แนะนำ.*ห้อง/i,
    /recommend/i,
    /difference between/i,
    /ต่างกันยังไง/i,
  ],

  // Moderate questions (medium)
  moderate: [
    /compare|เปรียบเทียบ/i,
    /explain|อธิบาย/i,
    /why|ทำไม/i,
    /how (does|do|can)|ทำยังไง/i,
    /pros and cons|ข้อดี.*ข้อเสีย/i,
    /should (i|we)|ควร/i,
    /summary|สรุป/i,
  ],

  // Complex questions (high)
  complex: [
    /analyze|วิเคราะห์/i,
    /strategy|กลยุทธ์/i,
    /optimize|ปรับปรุง/i,
    /revenue|รายได้/i,
    /forecast|พยากรณ์/i,
    /trend|แนวโน้ม/i,
    /investment|ลงทุน/i,
    /business plan|แผนธุรกิจ/i,
    /competitive.*analysis/i,
  ],

  // Very complex questions (xhigh)
  veryComplex: [
    /comprehensive|ครอบคลุม/i,
    /in-depth|เชิงลึก/i,
    /research|วิจัย/i,
    /market study/i,
    /feasibility/i,
    /long-term/i,
    /strategic planning/i,
    /multiple scenarios/i,
    /full analysis/i,
  ]
};

/**
 * Cost per 1K tokens (approximate)
 */
const COSTS = {
  'claude-sonnet-4': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-opus-4': { input: 0.015, output: 0.075 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
};

class ThinkingLevels {
  constructor(config = {}) {
    this.config = {
      defaultLevel: config.defaultLevel || 'medium',
      autoDetect: config.autoDetect !== false,
      showReasoning: config.showReasoning || false,
      costTracking: config.costTracking !== false,
      ...config
    };

    this.stats = {
      totalRequests: 0,
      byLevel: {},
      tokensUsed: 0,
      tokensSaved: 0,
      estimatedCostSaved: 0
    };

    // Initialize level stats
    for (const level of Object.keys(LEVELS)) {
      this.stats.byLevel[level] = 0;
    }

    // Current reasoning visibility
    this.reasoningVisible = this.config.showReasoning;
  }

  /**
   * Detect appropriate thinking level for a message
   * @param {string} message - User message
   * @param {object} context - Additional context
   * @returns {string} Thinking level
   */
  detectLevel(message, context = {}) {
    if (!this.config.autoDetect) {
      return this.config.defaultLevel;
    }

    // Check for explicit level in message
    const explicitLevel = this._extractExplicitLevel(message);
    if (explicitLevel) {
      return explicitLevel;
    }

    // Check context hints
    if (context.forceLevel) {
      return context.forceLevel;
    }

    // Auto-detect based on patterns
    const messageText = message.toLowerCase();
    const wordCount = message.split(/\s+/).length;

    // Very short messages (< 5 words) → likely simple
    if (wordCount < 5) {
      for (const pattern of COMPLEXITY_PATTERNS.simple) {
        if (pattern.test(message)) {
          return 'off';
        }
      }
      return 'minimal';
    }

    // Check patterns from most complex to simplest
    for (const pattern of COMPLEXITY_PATTERNS.veryComplex) {
      if (pattern.test(message)) {
        return 'xhigh';
      }
    }

    for (const pattern of COMPLEXITY_PATTERNS.complex) {
      if (pattern.test(message)) {
        return 'high';
      }
    }

    for (const pattern of COMPLEXITY_PATTERNS.moderate) {
      if (pattern.test(message)) {
        return 'medium';
      }
    }

    for (const pattern of COMPLEXITY_PATTERNS.basic) {
      if (pattern.test(message)) {
        return 'low';
      }
    }

    for (const pattern of COMPLEXITY_PATTERNS.simple) {
      if (pattern.test(message)) {
        return 'off';
      }
    }

    // Long messages (> 50 words) → likely complex
    if (wordCount > 50) {
      return 'high';
    }

    // Medium length → default to medium
    if (wordCount > 20) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Extract explicit level from message
   * e.g., "/think high" or "ใช้ thinking level สูง"
   */
  _extractExplicitLevel(message) {
    // Command format: /think <level>
    const commandMatch = message.match(/\/think\s+(off|minimal|low|medium|high|xhigh)/i);
    if (commandMatch) {
      return commandMatch[1].toLowerCase();
    }

    // Thai format
    const thaiMatch = message.match(/thinking\s*(level)?\s*(off|minimal|low|medium|high|xhigh|ปิด|ต่ำ|กลาง|สูง|สูงมาก)/i);
    if (thaiMatch) {
      const levelMap = {
        'ปิด': 'off',
        'ต่ำ': 'low',
        'กลาง': 'medium',
        'สูง': 'high',
        'สูงมาก': 'xhigh'
      };
      return levelMap[thaiMatch[2]] || thaiMatch[2].toLowerCase();
    }

    return null;
  }

  /**
   * Get thinking configuration for API call
   * @param {string} level - Thinking level
   * @returns {object} API configuration
   */
  getConfig(level) {
    const levelConfig = LEVELS[level] || LEVELS[this.config.defaultLevel];

    return {
      level,
      budget: levelConfig.budget,
      // For Claude API
      thinking: levelConfig.budget > 0 ? {
        type: 'enabled',
        budget_tokens: levelConfig.budget
      } : undefined,
      // For display
      description: levelConfig.description,
      useCase: levelConfig.useCase
    };
  }

  /**
   * Build system prompt with thinking instructions
   * @param {string} basePrompt - Base system prompt
   * @param {string} level - Thinking level
   * @returns {string} Enhanced system prompt
   */
  buildSystemPrompt(basePrompt, level) {
    const levelConfig = LEVELS[level];

    if (level === 'off') {
      return basePrompt + '\n\nRespond directly and concisely. No need for extended reasoning.';
    }

    const thinkingInstructions = `

## Thinking Level: ${levelConfig.name}
Budget: ~${levelConfig.budget} tokens for reasoning
Use case: ${levelConfig.useCase}

${level === 'xhigh' ? `
For this response, provide comprehensive analysis:
- Consider multiple perspectives
- Evaluate pros and cons
- Provide detailed reasoning
- Include relevant data and examples
` : ''}

${level === 'high' ? `
For this response, provide thorough analysis:
- Break down the problem
- Consider key factors
- Explain your reasoning
` : ''}

${this.reasoningVisible ? 'Show your thinking process before the final answer.' : ''}`;

    return basePrompt + thinkingInstructions;
  }

  /**
   * Process a request with appropriate thinking level
   * @param {string} message - User message
   * @param {object} options - Options
   * @returns {object} Processing result with level info
   */
  process(message, options = {}) {
    // Detect level
    const level = options.level || this.detectLevel(message, options.context);
    const levelConfig = LEVELS[level];

    // Track stats
    this.stats.totalRequests++;
    this.stats.byLevel[level]++;

    // Calculate potential savings
    const defaultBudget = LEVELS[this.config.defaultLevel].budget;
    const actualBudget = levelConfig.budget;
    const savedTokens = Math.max(0, defaultBudget - actualBudget);

    this.stats.tokensUsed += actualBudget;
    this.stats.tokensSaved += savedTokens;

    // Estimate cost saved (using Claude Sonnet as baseline)
    const costPerToken = COSTS['claude-sonnet-4']?.output || 0.015;
    this.stats.estimatedCostSaved += (savedTokens / 1000) * costPerToken;

    return {
      level,
      budget: actualBudget,
      config: this.getConfig(level),
      savedTokens,
      message: level === 'off'
        ? message
        : message.replace(/\/think\s+\w+\s*/i, '').trim()
    };
  }

  /**
   * Toggle reasoning visibility
   */
  toggleReasoning() {
    this.reasoningVisible = !this.reasoningVisible;
    return this.reasoningVisible;
  }

  /**
   * Set reasoning visibility
   */
  setReasoning(visible) {
    this.reasoningVisible = visible;
    return this.reasoningVisible;
  }

  /**
   * Get all available levels
   */
  getLevels() {
    return Object.entries(LEVELS).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * Get status and stats
   */
  getStatus() {
    const totalWithDefault = this.stats.totalRequests;
    const defaultBudget = LEVELS[this.config.defaultLevel].budget;
    const wouldHaveUsed = totalWithDefault * defaultBudget;

    return {
      config: {
        defaultLevel: this.config.defaultLevel,
        autoDetect: this.config.autoDetect,
        showReasoning: this.reasoningVisible
      },
      levels: LEVELS,
      stats: {
        ...this.stats,
        savingsPercentage: wouldHaveUsed > 0
          ? ((this.stats.tokensSaved / wouldHaveUsed) * 100).toFixed(1) + '%'
          : '0%',
        estimatedCostSaved: '$' + this.stats.estimatedCostSaved.toFixed(4)
      },
      levelDistribution: Object.entries(this.stats.byLevel)
        .filter(([_, count]) => count > 0)
        .map(([level, count]) => ({
          level,
          count,
          percentage: ((count / this.stats.totalRequests) * 100).toFixed(1) + '%'
        }))
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      byLevel: {},
      tokensUsed: 0,
      tokensSaved: 0,
      estimatedCostSaved: 0
    };

    for (const level of Object.keys(LEVELS)) {
      this.stats.byLevel[level] = 0;
    }
  }

  /**
   * Estimate cost for a message
   */
  estimateCost(message, model = 'claude-sonnet-4') {
    const level = this.detectLevel(message);
    const budget = LEVELS[level].budget;
    const modelCosts = COSTS[model] || COSTS['claude-sonnet-4'];

    // Estimate input tokens (rough: 1 token ≈ 4 chars)
    const inputTokens = Math.ceil(message.length / 4);

    // Estimate output tokens (assume 2x input for response)
    const outputTokens = inputTokens * 2;

    // Calculate costs
    const inputCost = (inputTokens / 1000) * modelCosts.input;
    const outputCost = (outputTokens / 1000) * modelCosts.output;
    const thinkingCost = (budget / 1000) * modelCosts.output;

    return {
      level,
      thinkingBudget: budget,
      estimatedTokens: {
        input: inputTokens,
        output: outputTokens,
        thinking: budget
      },
      estimatedCost: {
        input: '$' + inputCost.toFixed(6),
        output: '$' + outputCost.toFixed(6),
        thinking: '$' + thinkingCost.toFixed(6),
        total: '$' + (inputCost + outputCost + thinkingCost).toFixed(6)
      }
    };
  }
}

// Singleton instance
const thinkingLevels = new ThinkingLevels();

export default thinkingLevels;
export { ThinkingLevels, LEVELS, COMPLEXITY_PATTERNS, COSTS };
