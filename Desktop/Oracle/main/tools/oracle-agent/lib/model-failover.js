/**
 * Model Failover System
 * Auto-switch between AI providers when one fails
 *
 * Supported providers:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * - Groq (Fast inference)
 */

import Anthropic from '@anthropic-ai/sdk';
import thinkingLevels from './thinking-levels.js';

/**
 * Provider configurations
 */
const PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    models: {
      'claude-sonnet-4': { aliases: ['sonnet', 'claude', 'default'] },
      'claude-3-haiku-20240307': { aliases: ['haiku', 'fast'] },
      'claude-opus-4': { aliases: ['opus', 'smart'] }
    },
    createClient: () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    isConfigured: () => !!process.env.ANTHROPIC_API_KEY
  },
  openai: {
    name: 'OpenAI',
    models: {
      'gpt-4o': { aliases: ['gpt4', 'gpt'] },
      'gpt-4o-mini': { aliases: ['gpt-mini', 'gpt-fast'] }
    },
    createClient: () => null, // Will use fetch
    isConfigured: () => !!process.env.OPENAI_API_KEY
  },
  groq: {
    name: 'Groq',
    models: {
      'llama-3.3-70b-versatile': { aliases: ['llama', 'groq'] },
      'mixtral-8x7b-32768': { aliases: ['mixtral'] }
    },
    createClient: () => null, // Will use fetch
    isConfigured: () => !!process.env.GROQ_API_KEY
  },
  google: {
    name: 'Google',
    models: {
      'gemini-2.0-flash': { aliases: ['gemini', 'flash'] },
      'gemini-1.5-pro': { aliases: ['gemini-pro'] }
    },
    createClient: () => null, // Will use fetch
    isConfigured: () => !!process.env.GOOGLE_API_KEY
  }
};

/**
 * Default fallback chain
 */
const DEFAULT_FALLBACK_CHAIN = ['anthropic', 'openai', 'groq', 'google'];

/**
 * Provider health status
 */
const providerHealth = new Map();

class ModelFailover {
  constructor(config = {}) {
    this.config = {
      fallbackChain: config.fallbackChain || DEFAULT_FALLBACK_CHAIN,
      maxRetries: config.maxRetries || 2,
      timeout: config.timeout || 30000,
      stickySession: config.stickySession !== false, // Default true
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      ...config
    };

    this.clients = {};
    this.lastSuccessfulProvider = null;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failovers: 0,
      byProvider: {}
    };

    this._initializeProviders();
  }

  /**
   * Initialize available providers
   */
  _initializeProviders() {
    for (const [providerId, provider] of Object.entries(PROVIDERS)) {
      if (provider.isConfigured()) {
        this.clients[providerId] = provider.createClient();
        providerHealth.set(providerId, {
          healthy: true,
          lastCheck: Date.now(),
          consecutiveFailures: 0,
          lastError: null
        });
        this.stats.byProvider[providerId] = { attempts: 0, successes: 0, failures: 0 };
        console.log(`[FAILOVER] Provider configured: ${provider.name}`);
      }
    }

    console.log(`[FAILOVER] Available providers: ${Object.keys(this.clients).join(', ')}`);
  }

  /**
   * Send message with automatic failover
   * @param {object} options - Request options
   * @returns {Promise<object>} Response
   */
  async send(options) {
    const {
      message,
      system,
      model,
      maxTokens = 4096,
      temperature,
      preferProvider,
      thinkingLevel,      // Explicit thinking level
      autoThinking = true // Auto-detect thinking level
    } = options;

    this.stats.totalRequests++;

    // Process thinking level
    let thinking = null;
    let processedMessage = message;
    let effectiveSystem = system;

    if (autoThinking || thinkingLevel) {
      const thinkingResult = thinkingLevels.process(
        typeof message === 'string' ? message : message[message.length - 1]?.content || '',
        { level: thinkingLevel }
      );

      thinking = {
        level: thinkingResult.level,
        budget: thinkingResult.budget,
        config: thinkingResult.config
      };

      // Build enhanced system prompt for non-Claude providers
      if (system) {
        effectiveSystem = thinkingLevels.buildSystemPrompt(system, thinkingResult.level);
      }

      console.log(`[FAILOVER] Thinking level: ${thinking.level} (budget: ${thinking.budget})`);
    }

    // Determine provider order
    let providerOrder = this._getProviderOrder(preferProvider);

    // Filter to only healthy and configured providers
    providerOrder = providerOrder.filter(p =>
      this.clients[p] !== undefined &&
      this._isProviderHealthy(p)
    );

    if (providerOrder.length === 0) {
      // All providers unhealthy, try them anyway
      providerOrder = Object.keys(this.clients);
    }

    let lastError = null;

    for (const providerId of providerOrder) {
      try {
        console.log(`[FAILOVER] Trying provider: ${providerId}`);
        this.stats.byProvider[providerId].attempts++;

        const response = await this._sendToProvider(providerId, {
          message: processedMessage,
          system: effectiveSystem,
          model,
          maxTokens,
          temperature,
          thinking
        });

        // Success!
        this._markProviderHealthy(providerId);
        this.stats.byProvider[providerId].successes++;
        this.stats.successfulRequests++;

        if (this.config.stickySession) {
          this.lastSuccessfulProvider = providerId;
        }

        return {
          ...response,
          provider: providerId,
          failoverAttempts: providerOrder.indexOf(providerId),
          thinking: thinking ? {
            level: thinking.level,
            budget: thinking.budget
          } : null
        };

      } catch (error) {
        console.error(`[FAILOVER] Provider ${providerId} failed:`, error.message);
        lastError = error;

        this._markProviderUnhealthy(providerId, error);
        this.stats.byProvider[providerId].failures++;
        this.stats.failovers++;

        // Continue to next provider
      }
    }

    // All providers failed
    throw new Error(`All providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Send to specific provider
   */
  async _sendToProvider(providerId, options) {
    const { message, system, model, maxTokens, temperature, thinking } = options;

    switch (providerId) {
      case 'anthropic':
        return this._sendToAnthropic(message, system, model, maxTokens, temperature, thinking);
      case 'openai':
        return this._sendToOpenAI(message, system, model, maxTokens, temperature, thinking);
      case 'groq':
        return this._sendToGroq(message, system, model, maxTokens, temperature, thinking);
      case 'google':
        return this._sendToGoogle(message, system, model, maxTokens, temperature, thinking);
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }

  /**
   * Send to Anthropic (Claude) with extended thinking support
   */
  async _sendToAnthropic(message, system, model, maxTokens, temperature, thinking) {
    const client = this.clients.anthropic;
    if (!client) throw new Error('Anthropic not configured');

    const resolvedModel = this._resolveModel('anthropic', model) || 'claude-sonnet-4-20250514';

    // Build request with optional extended thinking
    const request = {
      model: resolvedModel,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: Array.isArray(message) ? message : [{ role: 'user', content: message }],
      ...(temperature !== undefined && { temperature })
    };

    // Add extended thinking if budget > 0 and model supports it
    if (thinking && thinking.budget > 0) {
      // Extended thinking requires specific models and settings
      // For now, we simulate by adjusting max_tokens
      // In production, use the actual extended thinking API when available
      request.max_tokens = Math.max(maxTokens, thinking.budget + 1000);

      // Add thinking instruction to system prompt if not already there
      if (request.system && !request.system.includes('Thinking Level:')) {
        request.system = thinkingLevels.buildSystemPrompt(request.system, thinking.level);
      }
    }

    const response = await client.messages.create(request);

    // Extract thinking content if present
    let thinkingContent = null;
    let responseText = '';

    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinkingContent = block.thinking;
      } else if (block.type === 'text') {
        responseText = block.text;
      }
    }

    return {
      text: responseText || response.content[0]?.text || '',
      model: resolvedModel,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0
      },
      thinkingContent
    };
  }

  /**
   * Send to OpenAI (GPT) with thinking-aware system prompt
   */
  async _sendToOpenAI(message, system, model, maxTokens, temperature, thinking) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI not configured');

    const resolvedModel = this._resolveModel('openai', model) || 'gpt-4o';

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    if (Array.isArray(message)) {
      messages.push(...message);
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Adjust max_tokens based on thinking level for longer responses
    let effectiveMaxTokens = maxTokens;
    if (thinking && thinking.budget > 0) {
      effectiveMaxTokens = Math.max(maxTokens, Math.floor(thinking.budget / 2) + 1000);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        max_tokens: effectiveMaxTokens,
        ...(temperature !== undefined && { temperature })
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `OpenAI error: ${response.status}`);
    }

    const data = await response.json();

    return {
      text: data.choices[0]?.message?.content || '',
      model: resolvedModel,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Send to Groq with thinking-aware max_tokens
   */
  async _sendToGroq(message, system, model, maxTokens, temperature, thinking) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Groq not configured');

    const resolvedModel = this._resolveModel('groq', model) || 'llama-3.3-70b-versatile';

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    if (Array.isArray(message)) {
      messages.push(...message);
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Adjust max_tokens based on thinking level
    let effectiveMaxTokens = maxTokens;
    if (thinking && thinking.budget > 0) {
      effectiveMaxTokens = Math.max(maxTokens, Math.floor(thinking.budget / 2) + 1000);
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        max_tokens: effectiveMaxTokens,
        ...(temperature !== undefined && { temperature })
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Groq error: ${response.status}`);
    }

    const data = await response.json();

    return {
      text: data.choices[0]?.message?.content || '',
      model: resolvedModel,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Send to Google (Gemini) with thinking-aware maxOutputTokens
   */
  async _sendToGoogle(message, system, model, maxTokens, temperature, thinking) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Google not configured');

    const resolvedModel = this._resolveModel('google', model) || 'gemini-2.0-flash';

    // Gemini uses different format
    const contents = [];

    if (Array.isArray(message)) {
      for (const msg of message) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    }

    // Adjust maxOutputTokens based on thinking level
    let effectiveMaxTokens = maxTokens;
    if (thinking && thinking.budget > 0) {
      effectiveMaxTokens = Math.max(maxTokens, Math.floor(thinking.budget / 2) + 1000);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: {
            maxOutputTokens: effectiveMaxTokens,
            ...(temperature !== undefined && { temperature })
          }
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Google error: ${response.status}`);
    }

    const data = await response.json();

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model: resolvedModel,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  /**
   * Resolve model alias to actual model name
   */
  _resolveModel(providerId, modelOrAlias) {
    if (!modelOrAlias) return null;

    const provider = PROVIDERS[providerId];
    if (!provider) return modelOrAlias;

    // Check if it's already a valid model name
    if (provider.models[modelOrAlias]) {
      return modelOrAlias;
    }

    // Check aliases
    for (const [modelName, config] of Object.entries(provider.models)) {
      if (config.aliases?.includes(modelOrAlias)) {
        return modelName;
      }
    }

    return modelOrAlias;
  }

  /**
   * Get provider order based on preferences
   */
  _getProviderOrder(preferProvider) {
    let order = [...this.config.fallbackChain];

    // If sticky session and we have a last successful provider
    if (this.config.stickySession && this.lastSuccessfulProvider) {
      order = [this.lastSuccessfulProvider, ...order.filter(p => p !== this.lastSuccessfulProvider)];
    }

    // If prefer specific provider
    if (preferProvider && order.includes(preferProvider)) {
      order = [preferProvider, ...order.filter(p => p !== preferProvider)];
    }

    return order;
  }

  /**
   * Check if provider is healthy
   */
  _isProviderHealthy(providerId) {
    const health = providerHealth.get(providerId);
    if (!health) return false;

    // If too many consecutive failures, consider unhealthy
    if (health.consecutiveFailures >= 3) {
      // But check if enough time has passed to retry
      const timeSinceLastCheck = Date.now() - health.lastCheck;
      if (timeSinceLastCheck < this.config.healthCheckInterval) {
        return false;
      }
    }

    return true;
  }

  /**
   * Mark provider as healthy
   */
  _markProviderHealthy(providerId) {
    providerHealth.set(providerId, {
      healthy: true,
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      lastError: null
    });
  }

  /**
   * Mark provider as unhealthy
   */
  _markProviderUnhealthy(providerId, error) {
    const current = providerHealth.get(providerId) || { consecutiveFailures: 0 };
    providerHealth.set(providerId, {
      healthy: false,
      lastCheck: Date.now(),
      consecutiveFailures: current.consecutiveFailures + 1,
      lastError: error.message
    });
  }

  /**
   * Get status of all providers
   */
  getStatus() {
    const providers = {};

    for (const providerId of Object.keys(this.clients)) {
      const health = providerHealth.get(providerId);
      providers[providerId] = {
        configured: true,
        healthy: health?.healthy || false,
        consecutiveFailures: health?.consecutiveFailures || 0,
        lastError: health?.lastError || null,
        stats: this.stats.byProvider[providerId] || {}
      };
    }

    // Add unconfigured providers
    for (const providerId of Object.keys(PROVIDERS)) {
      if (!providers[providerId]) {
        providers[providerId] = {
          configured: false,
          healthy: false,
          reason: 'API key not set'
        };
      }
    }

    return {
      activeProvider: this.lastSuccessfulProvider,
      fallbackChain: this.config.fallbackChain,
      stickySession: this.config.stickySession,
      providers,
      stats: {
        totalRequests: this.stats.totalRequests,
        successfulRequests: this.stats.successfulRequests,
        failovers: this.stats.failovers,
        successRate: this.stats.totalRequests > 0
          ? ((this.stats.successfulRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
          : 'N/A'
      }
    };
  }

  /**
   * Get combined status including Thinking Levels
   */
  getCombinedStatus() {
    return {
      modelFailover: this.getStatus(),
      thinkingLevels: thinkingLevels.getStatus()
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failovers: 0,
      byProvider: {}
    };

    for (const providerId of Object.keys(this.clients)) {
      this.stats.byProvider[providerId] = { attempts: 0, successes: 0, failures: 0 };
    }
  }

  /**
   * Force health check on all providers
   */
  async healthCheck() {
    const results = {};

    for (const providerId of Object.keys(this.clients)) {
      try {
        await this._sendToProvider(providerId, {
          message: 'ping',
          maxTokens: 10
        });
        this._markProviderHealthy(providerId);
        results[providerId] = { healthy: true };
      } catch (error) {
        this._markProviderUnhealthy(providerId, error);
        results[providerId] = { healthy: false, error: error.message };
      }
    }

    return results;
  }
}

// Singleton instance
const modelFailover = new ModelFailover();

export default modelFailover;
export { ModelFailover, PROVIDERS };
