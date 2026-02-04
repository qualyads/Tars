/**
 * OpenTelemetry Integration
 * Enterprise-grade observability for Oracle Agent
 *
 * Features:
 * - Metrics tracking (tokens, latency, errors)
 * - Distributed tracing
 * - Export to any OTLP backend
 * - Cost tracking
 *
 * Compatible with:
 * - Datadog
 * - New Relic
 * - Grafana
 * - Jaeger
 * - Any OTLP backend
 */

/**
 * Metric types
 */
const METRIC_TYPES = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram'
};

/**
 * Default metrics to track
 */
const DEFAULT_METRICS = {
  // Token metrics
  'oracle.tokens.input': { type: METRIC_TYPES.COUNTER, description: 'Total input tokens' },
  'oracle.tokens.output': { type: METRIC_TYPES.COUNTER, description: 'Total output tokens' },
  'oracle.tokens.thinking': { type: METRIC_TYPES.COUNTER, description: 'Thinking tokens used' },

  // Request metrics
  'oracle.requests.total': { type: METRIC_TYPES.COUNTER, description: 'Total requests' },
  'oracle.requests.success': { type: METRIC_TYPES.COUNTER, description: 'Successful requests' },
  'oracle.requests.error': { type: METRIC_TYPES.COUNTER, description: 'Failed requests' },

  // Latency metrics
  'oracle.latency.request': { type: METRIC_TYPES.HISTOGRAM, description: 'Request latency (ms)' },
  'oracle.latency.thinking': { type: METRIC_TYPES.HISTOGRAM, description: 'Thinking time (ms)' },
  'oracle.latency.tool': { type: METRIC_TYPES.HISTOGRAM, description: 'Tool execution time (ms)' },

  // Queue metrics
  'oracle.queue.depth': { type: METRIC_TYPES.GAUGE, description: 'Current queue depth' },
  'oracle.queue.wait_time': { type: METRIC_TYPES.HISTOGRAM, description: 'Queue wait time (ms)' },

  // Provider metrics
  'oracle.provider.requests': { type: METRIC_TYPES.COUNTER, description: 'Requests by provider' },
  'oracle.provider.failovers': { type: METRIC_TYPES.COUNTER, description: 'Provider failovers' },

  // Cost metrics
  'oracle.cost.estimated': { type: METRIC_TYPES.COUNTER, description: 'Estimated cost (USD)' }
};

/**
 * Simple span for tracing
 */
class Span {
  constructor(name, parentId = null) {
    this.traceId = Span.generateId();
    this.spanId = Span.generateId();
    this.parentId = parentId;
    this.name = name;
    this.startTime = Date.now();
    this.endTime = null;
    this.status = 'ok';
    this.attributes = {};
    this.events = [];
  }

  static generateId() {
    return Math.random().toString(36).substring(2, 18);
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  setAttributes(attrs) {
    Object.assign(this.attributes, attrs);
    return this;
  }

  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
    return this;
  }

  setStatus(status, message = null) {
    this.status = status;
    if (message) {
      this.attributes['error.message'] = message;
    }
    return this;
  }

  end() {
    this.endTime = Date.now();
    return this;
  }

  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentId: this.parentId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : null,
      status: this.status,
      attributes: this.attributes,
      events: this.events
    };
  }
}

/**
 * OpenTelemetry Manager
 */
class OpenTelemetry {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      serviceName: config.serviceName || 'oracle-agent',
      endpoint: config.endpoint || null, // OTLP endpoint
      headers: config.headers || {},
      exportInterval: config.exportInterval || 60000, // 1 minute
      ...config
    };

    // Metric values
    this.metrics = new Map();
    this.histograms = new Map();

    // Traces
    this.traces = [];
    this.maxTraces = 1000;

    // Active spans
    this.activeSpans = new Map();

    // Initialize default metrics
    this._initializeMetrics();

    // Start export interval if endpoint configured
    if (this.config.endpoint) {
      this._startExporter();
    }
  }

  /**
   * Initialize default metrics
   */
  _initializeMetrics() {
    for (const [name, config] of Object.entries(DEFAULT_METRICS)) {
      if (config.type === METRIC_TYPES.COUNTER) {
        this.metrics.set(name, 0);
      } else if (config.type === METRIC_TYPES.GAUGE) {
        this.metrics.set(name, 0);
      } else if (config.type === METRIC_TYPES.HISTOGRAM) {
        this.histograms.set(name, []);
      }
    }
  }

  /**
   * Increment a counter
   */
  increment(name, value = 1, attributes = {}) {
    if (!this.config.enabled) return;

    const key = this._getKey(name, attributes);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  gauge(name, value, attributes = {}) {
    if (!this.config.enabled) return;

    const key = this._getKey(name, attributes);
    this.metrics.set(key, value);
  }

  /**
   * Record a histogram value
   */
  histogram(name, value, attributes = {}) {
    if (!this.config.enabled) return;

    const key = this._getKey(name, attributes);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }

    const values = this.histograms.get(key);
    values.push({ value, timestamp: Date.now() });

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Get metric key with attributes
   */
  _getKey(name, attributes) {
    if (Object.keys(attributes).length === 0) {
      return name;
    }
    const attrStr = Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${attrStr}}`;
  }

  /**
   * Start a new span
   */
  startSpan(name, parentSpan = null) {
    if (!this.config.enabled) {
      return new Span(name); // Return dummy span
    }

    const span = new Span(name, parentSpan?.spanId);
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  /**
   * End and record a span
   */
  endSpan(span) {
    if (!this.config.enabled) return;

    span.end();
    this.activeSpans.delete(span.spanId);

    // Add to traces
    this.traces.push(span.toJSON());

    // Trim traces
    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }

    // Record latency metric
    if (span.endTime && span.startTime) {
      this.histogram('oracle.latency.request', span.endTime - span.startTime, {
        operation: span.name
      });
    }
  }

  /**
   * Convenience: Time an async function
   */
  async time(name, fn, attributes = {}) {
    const span = this.startSpan(name);
    span.setAttributes(attributes);

    try {
      const result = await fn();
      span.setStatus('ok');
      return result;
    } catch (err) {
      span.setStatus('error', err.message);
      throw err;
    } finally {
      this.endSpan(span);
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(options) {
    const {
      inputTokens = 0,
      outputTokens = 0,
      thinkingTokens = 0,
      latency = 0,
      provider = 'unknown',
      success = true,
      cost = 0
    } = options;

    this.increment('oracle.requests.total');
    this.increment(success ? 'oracle.requests.success' : 'oracle.requests.error');

    this.increment('oracle.tokens.input', inputTokens);
    this.increment('oracle.tokens.output', outputTokens);
    this.increment('oracle.tokens.thinking', thinkingTokens);

    this.histogram('oracle.latency.request', latency);

    this.increment('oracle.provider.requests', 1, { provider });

    if (cost > 0) {
      this.increment('oracle.cost.estimated', cost);
    }
  }

  /**
   * Record failover
   */
  recordFailover(fromProvider, toProvider) {
    this.increment('oracle.provider.failovers', 1, {
      from: fromProvider,
      to: toProvider
    });
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const result = {
      counters: {},
      gauges: {},
      histograms: {}
    };

    for (const [key, value] of this.metrics) {
      const metricName = key.split('{')[0];
      const config = DEFAULT_METRICS[metricName];

      if (config?.type === METRIC_TYPES.COUNTER) {
        result.counters[key] = value;
      } else if (config?.type === METRIC_TYPES.GAUGE) {
        result.gauges[key] = value;
      } else {
        result.counters[key] = value; // Default to counter
      }
    }

    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;

      const sorted = values.map(v => v.value).sort((a, b) => a - b);
      result.histograms[key] = {
        count: values.length,
        sum: sorted.reduce((a, b) => a + b, 0),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: sorted.reduce((a, b) => a + b, 0) / sorted.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }

    return result;
  }

  /**
   * Get recent traces
   */
  getTraces(limit = 50) {
    return this.traces.slice(-limit);
  }

  /**
   * Start OTLP exporter
   */
  _startExporter() {
    this.exportInterval = setInterval(() => {
      this._export();
    }, this.config.exportInterval);
  }

  /**
   * Export metrics to OTLP endpoint
   */
  async _export() {
    if (!this.config.endpoint) return;

    try {
      const metrics = this.getMetrics();

      await fetch(`${this.config.endpoint}/v1/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify({
          resourceMetrics: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: this.config.serviceName } }
              ]
            },
            scopeMetrics: [{
              metrics: this._formatMetricsForOTLP(metrics)
            }]
          }]
        })
      });
    } catch (err) {
      console.error('[OTEL] Export failed:', err.message);
    }
  }

  /**
   * Format metrics for OTLP
   */
  _formatMetricsForOTLP(metrics) {
    const result = [];

    for (const [name, value] of Object.entries(metrics.counters)) {
      result.push({
        name,
        sum: {
          dataPoints: [{ asInt: value, timeUnixNano: Date.now() * 1e6 }],
          isMonotonic: true
        }
      });
    }

    for (const [name, value] of Object.entries(metrics.gauges)) {
      result.push({
        name,
        gauge: {
          dataPoints: [{ asDouble: value, timeUnixNano: Date.now() * 1e6 }]
        }
      });
    }

    return result;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      serviceName: this.config.serviceName,
      endpoint: this.config.endpoint ? 'configured' : 'not configured',
      activeSpans: this.activeSpans.size,
      tracesCount: this.traces.length,
      metricsCount: this.metrics.size + this.histograms.size
    };
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
    }
    // Final export
    this._export();
  }
}

// Singleton instance
const otel = new OpenTelemetry();

export default otel;
export { OpenTelemetry, Span, METRIC_TYPES, DEFAULT_METRICS };
