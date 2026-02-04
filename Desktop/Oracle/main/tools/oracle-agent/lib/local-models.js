/**
 * Local Models Support
 * Connect to local LLM servers (Ollama, LM Studio, vLLM)
 *
 * Benefits:
 * - No API costs
 * - Works offline
 * - Privacy (data stays local)
 * - Can be used as failover
 *
 * Supported:
 * - Ollama (http://localhost:11434)
 * - LM Studio (http://localhost:1234)
 * - vLLM (OpenAI-compatible)
 * - Any OpenAI-compatible endpoint
 */

/**
 * Default endpoints for local providers
 */
const LOCAL_PROVIDERS = {
  ollama: {
    name: 'Ollama',
    baseURL: 'http://localhost:11434',
    apiPath: '/api/generate',
    chatPath: '/api/chat',
    modelsPath: '/api/tags',
    defaultModel: 'llama3.2'
  },
  lmstudio: {
    name: 'LM Studio',
    baseURL: 'http://localhost:1234',
    apiPath: '/v1/chat/completions',
    modelsPath: '/v1/models',
    defaultModel: 'local-model',
    openaiCompatible: true
  },
  vllm: {
    name: 'vLLM',
    baseURL: 'http://localhost:8000',
    apiPath: '/v1/chat/completions',
    modelsPath: '/v1/models',
    defaultModel: 'default',
    openaiCompatible: true
  },
  custom: {
    name: 'Custom',
    baseURL: '',
    apiPath: '/v1/chat/completions',
    modelsPath: '/v1/models',
    openaiCompatible: true
  }
};

/**
 * Local Models Manager
 */
class LocalModels {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      providers: { ...LOCAL_PROVIDERS, ...config.providers },
      timeout: config.timeout || 60000, // Local models can be slow
      retries: config.retries || 1,
      ...config
    };

    // Track provider health
    this.health = new Map();

    // Stats
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      byProvider: {}
    };
  }

  /**
   * Check if a local provider is available
   */
  async checkHealth(providerKey) {
    const provider = this.config.providers[providerKey];
    if (!provider) {
      return { healthy: false, error: 'Unknown provider' };
    }

    try {
      const url = `${provider.baseURL}${provider.modelsPath || '/health'}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        this.health.set(providerKey, { healthy: true, lastCheck: Date.now(), models: data.models || data.data });
        return { healthy: true, models: data.models || data.data };
      }

      this.health.set(providerKey, { healthy: false, lastCheck: Date.now(), error: `HTTP ${response.status}` });
      return { healthy: false, error: `HTTP ${response.status}` };
    } catch (err) {
      this.health.set(providerKey, { healthy: false, lastCheck: Date.now(), error: err.message });
      return { healthy: false, error: err.message };
    }
  }

  /**
   * List available models from a provider
   */
  async listModels(providerKey) {
    const provider = this.config.providers[providerKey];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerKey}`);
    }

    try {
      const url = `${provider.baseURL}${provider.modelsPath}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Ollama returns { models: [...] }
      if (data.models) {
        return data.models.map(m => ({
          id: m.name,
          size: m.size,
          modified: m.modified_at
        }));
      }

      // OpenAI-compatible returns { data: [...] }
      if (data.data) {
        return data.data.map(m => ({
          id: m.id,
          owned_by: m.owned_by
        }));
      }

      return [];
    } catch (err) {
      console.error(`[LOCAL] Failed to list models from ${providerKey}:`, err.message);
      return [];
    }
  }

  /**
   * Send message to local model
   */
  async send(options) {
    const {
      provider = 'ollama',
      model,
      message,
      system,
      maxTokens = 4096,
      temperature = 0.7,
      stream = false
    } = options;

    this.stats.totalRequests++;

    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Initialize stats for provider
    if (!this.stats.byProvider[provider]) {
      this.stats.byProvider[provider] = { attempts: 0, successes: 0, failures: 0 };
    }
    this.stats.byProvider[provider].attempts++;

    try {
      let result;

      if (providerConfig.openaiCompatible) {
        result = await this._sendOpenAICompatible(providerConfig, {
          model: model || providerConfig.defaultModel,
          message,
          system,
          maxTokens,
          temperature,
          stream
        });
      } else if (provider === 'ollama') {
        result = await this._sendOllama(providerConfig, {
          model: model || providerConfig.defaultModel,
          message,
          system,
          maxTokens,
          temperature,
          stream
        });
      } else {
        throw new Error(`No handler for provider: ${provider}`);
      }

      this.stats.byProvider[provider].successes++;
      this.stats.successfulRequests++;

      return {
        ...result,
        provider,
        local: true
      };
    } catch (err) {
      this.stats.byProvider[provider].failures++;
      throw err;
    }
  }

  /**
   * Send to Ollama native API
   */
  async _sendOllama(providerConfig, options) {
    const { model, message, system, maxTokens, temperature, stream } = options;

    // Use chat endpoint for conversation
    const url = `${providerConfig.baseURL}${providerConfig.chatPath}`;

    const messages = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    if (Array.isArray(message)) {
      messages.push(...message);
    } else {
      messages.push({ role: 'user', content: message });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false, // For now, non-streaming
        options: {
          num_predict: maxTokens,
          temperature
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Ollama error: ${response.status}`);
    }

    const data = await response.json();

    return {
      text: data.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0
      },
      duration: data.total_duration ? data.total_duration / 1e9 : null // nanoseconds to seconds
    };
  }

  /**
   * Send to OpenAI-compatible endpoint
   */
  async _sendOpenAICompatible(providerConfig, options) {
    const { model, message, system, maxTokens, temperature } = options;

    const url = `${providerConfig.baseURL}${providerConfig.apiPath}`;

    const messages = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    if (Array.isArray(message)) {
      messages.push(...message);
    } else {
      messages.push({ role: 'user', content: message });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      text: data.choices?.[0]?.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Configure a custom provider
   */
  addProvider(key, config) {
    this.config.providers[key] = {
      name: config.name || key,
      baseURL: config.baseURL,
      apiPath: config.apiPath || '/v1/chat/completions',
      modelsPath: config.modelsPath || '/v1/models',
      defaultModel: config.defaultModel || 'default',
      openaiCompatible: config.openaiCompatible !== false,
      ...config
    };

    return this.config.providers[key];
  }

  /**
   * Get first available local provider
   */
  async getAvailableProvider() {
    for (const key of Object.keys(this.config.providers)) {
      if (key === 'custom') continue; // Skip custom if not configured

      const health = await this.checkHealth(key);
      if (health.healthy) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get status
   */
  getStatus() {
    const providerStatus = {};
    for (const [key, health] of this.health) {
      providerStatus[key] = health;
    }

    return {
      enabled: this.config.enabled,
      providers: Object.keys(this.config.providers),
      health: providerStatus,
      stats: this.stats
    };
  }

  /**
   * Get all providers
   */
  getProviders() {
    return this.config.providers;
  }

  /**
   * Set enabled
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    return this.config.enabled;
  }
}

// Singleton instance
const localModels = new LocalModels();

export default localModels;
export { LocalModels, LOCAL_PROVIDERS };
