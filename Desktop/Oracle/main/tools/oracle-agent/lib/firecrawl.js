/**
 * Firecrawl Integration
 * Web scraping that bypasses anti-bot protection
 *
 * Features:
 * - Bypass Cloudflare, bot detection
 * - JavaScript rendering
 * - Automatic retry with fallback
 * - Caching for repeated requests
 *
 * Flow:
 * 1. Try direct fetch
 * 2. If blocked → use Firecrawl
 * 3. Cache successful results
 */

/**
 * Detection patterns for blocked requests
 */
const BLOCKED_PATTERNS = [
  /cloudflare/i,
  /captcha/i,
  /robot/i,
  /blocked/i,
  /access denied/i,
  /403 forbidden/i,
  /rate limit/i,
  /too many requests/i,
  /please verify/i,
  /security check/i
];

/**
 * Firecrawl Manager
 */
class Firecrawl {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      apiKey: config.apiKey || process.env.FIRECRAWL_API_KEY,
      baseURL: config.baseURL || 'https://api.firecrawl.dev',
      timeout: config.timeout || 30000,
      cacheEnabled: config.cacheEnabled !== false,
      cacheTTL: config.cacheTTL || 15 * 60 * 1000, // 15 minutes
      ...config
    };

    // Cache for results
    this.cache = new Map();

    // Stats
    this.stats = {
      totalRequests: 0,
      directSuccess: 0,
      firecrawlSuccess: 0,
      failures: 0,
      cacheHits: 0
    };
  }

  /**
   * Fetch URL with automatic fallback to Firecrawl
   * @param {string} url - URL to fetch
   * @param {object} options - Fetch options
   */
  async fetch(url, options = {}) {
    this.stats.totalRequests++;

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this._getFromCache(url);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, fromCache: true };
      }
    }

    // Try direct fetch first
    try {
      const result = await this._directFetch(url, options);

      // Check if response looks blocked
      if (this._isBlocked(result.text)) {
        console.log(`[FIRECRAWL] Direct fetch blocked, trying Firecrawl...`);
        return this._firecrawlFetch(url, options);
      }

      this.stats.directSuccess++;
      this._addToCache(url, result);
      return { ...result, method: 'direct' };
    } catch (err) {
      console.log(`[FIRECRAWL] Direct fetch failed: ${err.message}`);

      // Try Firecrawl as fallback
      if (this.config.apiKey) {
        return this._firecrawlFetch(url, options);
      }

      this.stats.failures++;
      throw err;
    }
  }

  /**
   * Direct fetch attempt
   */
  async _directFetch(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
        ...options.headers
      },
      signal: AbortSignal.timeout(this.config.timeout),
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    return {
      url,
      text,
      status: response.status,
      contentType: response.headers.get('content-type')
    };
  }

  /**
   * Fetch using Firecrawl API
   */
  async _firecrawlFetch(url, options = {}) {
    if (!this.config.apiKey) {
      throw new Error('Firecrawl API key not configured');
    }

    console.log(`[FIRECRAWL] Using Firecrawl for: ${url}`);

    const response = await fetch(`${this.config.baseURL}/v0/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        pageOptions: {
          onlyMainContent: options.onlyMainContent !== false,
          includeHtml: options.includeHtml || false,
          screenshot: options.screenshot || false,
          waitFor: options.waitFor || 0
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      this.stats.failures++;
      throw new Error(error.message || `Firecrawl error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      this.stats.failures++;
      throw new Error(data.error || 'Firecrawl failed');
    }

    const result = {
      url,
      text: data.data?.markdown || data.data?.content || '',
      html: data.data?.html,
      title: data.data?.metadata?.title,
      description: data.data?.metadata?.description,
      screenshot: data.data?.screenshot,
      status: 200
    };

    this.stats.firecrawlSuccess++;
    this._addToCache(url, result);

    return { ...result, method: 'firecrawl' };
  }

  /**
   * Crawl multiple pages from a starting URL
   */
  async crawl(startUrl, options = {}) {
    if (!this.config.apiKey) {
      throw new Error('Firecrawl API key required for crawling');
    }

    const {
      maxPages = 10,
      includePaths = [],
      excludePaths = [],
      maxDepth = 2
    } = options;

    const response = await fetch(`${this.config.baseURL}/v0/crawl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: startUrl,
        crawlerOptions: {
          includes: includePaths,
          excludes: excludePaths,
          maxDepth,
          limit: maxPages
        },
        pageOptions: {
          onlyMainContent: true
        }
      }),
      signal: AbortSignal.timeout(this.config.timeout * 3) // Longer timeout for crawl
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Crawl error: ${response.status}`);
    }

    const data = await response.json();

    // Crawl returns a job ID, need to poll for results
    if (data.jobId) {
      return this._pollCrawlJob(data.jobId);
    }

    return data;
  }

  /**
   * Poll crawl job for results
   */
  async _pollCrawlJob(jobId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const response = await fetch(`${this.config.baseURL}/v0/crawl/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.status === 'completed') {
        return data.data;
      }

      if (data.status === 'failed') {
        throw new Error('Crawl job failed');
      }
    }

    throw new Error('Crawl job timed out');
  }

  /**
   * Check if response appears to be blocked
   */
  _isBlocked(text) {
    if (!text) return false;

    const lowerText = text.toLowerCase();
    return BLOCKED_PATTERNS.some(pattern => pattern.test(lowerText));
  }

  /**
   * Get from cache
   */
  _getFromCache(url) {
    const cached = this.cache.get(url);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(url);
      return null;
    }

    return cached.data;
  }

  /**
   * Add to cache
   */
  _addToCache(url, data) {
    if (!this.config.cacheEnabled) return;

    this.cache.set(url, {
      data,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      hasApiKey: !!this.config.apiKey,
      cacheSize: this.cache.size,
      stats: this.stats
    };
  }

  /**
   * Set API key
   */
  setApiKey(apiKey) {
    this.config.apiKey = apiKey;
    return !!apiKey;
  }
}

// Singleton instance
const firecrawl = new Firecrawl();

export default firecrawl;
export { Firecrawl, BLOCKED_PATTERNS };
