/**
 * Google Search Console API Client
 * ดู SEO performance: queries, pages, clicks, impressions, position
 *
 * Scope: webmasters.readonly (authorized แล้ว)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SearchConsole {
  constructor(config = {}) {
    this.config = {
      clientId: config.clientId || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
      refreshToken: config.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || '',
      tokenPath: config.tokenPath || path.join(__dirname, '..', 'data', 'google-token.json'),
      ...config
    };

    this.accessToken = null;
    this.tokenExpiry = 0;
    this._loadToken();
  }

  isConfigured() {
    return !!(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }

  async getAccessToken() {
    if (!this.isConfigured()) {
      throw new Error('Search Console not configured');
    }

    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this._saveToken();

    return this.accessToken;
  }

  async request(url, options = {}) {
    const token = await this.getAccessToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search Console API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * List all sites (properties) in Search Console
   */
  async listSites() {
    const data = await this.request('https://searchconsole.googleapis.com/webmasters/v3/sites');
    return (data.siteEntry || []).map(site => ({
      url: site.siteUrl,
      permissionLevel: site.permissionLevel
    }));
  }

  /**
   * Search Analytics - ดู performance ของเว็บ
   * @param {string} siteUrl - URL ของเว็บ (เช่น 'https://www.example.com' หรือ 'sc-domain:example.com')
   * @param {object} options
   */
  async searchAnalytics(siteUrl, options = {}) {
    const {
      startDate = this._daysAgo(28),
      endDate = this._daysAgo(1),
      dimensions = ['query'],
      rowLimit = 20,
      startRow = 0,
      type = 'web',
      dimensionFilterGroups = []
    } = options;

    const body = {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      startRow,
      type
    };

    if (dimensionFilterGroups.length) {
      body.dimensionFilterGroups = dimensionFilterGroups;
    }

    const encodedUrl = encodeURIComponent(siteUrl);
    const data = await this.request(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedUrl}/searchAnalytics/query`,
      { method: 'POST', body: JSON.stringify(body) }
    );

    return (data.rows || []).map(row => ({
      keys: row.keys,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100, // percentage
      position: Math.round(row.position * 10) / 10
    }));
  }

  /**
   * Top queries - keywords ที่คนค้นเจอเว็บ
   */
  async topQueries(siteUrl, options = {}) {
    return this.searchAnalytics(siteUrl, {
      dimensions: ['query'],
      rowLimit: options.limit || 20,
      startDate: options.startDate,
      endDate: options.endDate
    });
  }

  /**
   * Top pages - หน้าที่ได้ traffic มากสุด
   */
  async topPages(siteUrl, options = {}) {
    return this.searchAnalytics(siteUrl, {
      dimensions: ['page'],
      rowLimit: options.limit || 20,
      startDate: options.startDate,
      endDate: options.endDate
    });
  }

  /**
   * Performance by country
   */
  async byCountry(siteUrl, options = {}) {
    return this.searchAnalytics(siteUrl, {
      dimensions: ['country'],
      rowLimit: options.limit || 10,
      startDate: options.startDate,
      endDate: options.endDate
    });
  }

  /**
   * Performance by device (MOBILE, DESKTOP, TABLET)
   */
  async byDevice(siteUrl, options = {}) {
    return this.searchAnalytics(siteUrl, {
      dimensions: ['device'],
      rowLimit: 3,
      startDate: options.startDate,
      endDate: options.endDate
    });
  }

  /**
   * Performance by date (trend)
   */
  async byDate(siteUrl, options = {}) {
    return this.searchAnalytics(siteUrl, {
      dimensions: ['date'],
      rowLimit: options.days || 28,
      startDate: options.startDate || this._daysAgo(options.days || 28),
      endDate: options.endDate
    });
  }

  /**
   * Search for specific keyword performance
   */
  async queryPerformance(siteUrl, keyword, options = {}) {
    return this.searchAnalytics(siteUrl, {
      dimensions: ['query', 'page'],
      rowLimit: options.limit || 10,
      startDate: options.startDate,
      endDate: options.endDate,
      dimensionFilterGroups: [{
        filters: [{
          dimension: 'query',
          operator: 'contains',
          expression: keyword
        }]
      }]
    });
  }

  // =========================================================================
  // URL INSPECTION API (needs webmasters scope — read-write)
  // =========================================================================

  /**
   * Inspect a URL — ดูสถานะ index, crawl, robots.txt, mobile usability
   * @param {string} siteUrl - e.g. 'sc-domain:visionxbrain.com'
   * @param {string} inspectionUrl - full URL to inspect
   */
  async inspectUrl(siteUrl, inspectionUrl) {
    const token = await this.getAccessToken();
    const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl,
        siteUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`URL Inspection error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const result = data.inspectionResult || {};
    const idx = result.indexStatusResult || {};

    return {
      url: inspectionUrl,
      verdict: idx.verdict, // PASS, NEUTRAL, FAIL
      coverageState: idx.coverageState, // "Submitted and indexed", "Crawled - currently not indexed", etc.
      robotsTxtState: idx.robotsTxtState, // ALLOWED, DISALLOWED
      indexingState: idx.indexingState, // INDEXING_ALLOWED, BLOCKED_BY_META_TAG
      pageFetchState: idx.pageFetchState, // SUCCESSFUL, SOFT_404, NOT_FOUND, etc.
      lastCrawlTime: idx.lastCrawlTime,
      crawledAs: idx.crawledAs, // DESKTOP, MOBILE
      referringUrls: idx.referringUrls,
      mobileUsability: result.mobileUsabilityResult?.verdict,
      raw: result,
    };
  }

  /**
   * Batch inspect multiple URLs (with rate limiting)
   * Google limits ~2000 requests/day for URL Inspection
   */
  async batchInspect(siteUrl, urls, delayMs = 300) {
    const results = [];
    for (const url of urls) {
      try {
        const result = await this.inspectUrl(siteUrl, url);
        results.push(result);
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      } catch (e) {
        results.push({ url, error: e.message });
      }
    }
    return results;
  }

  // =========================================================================
  // SITEMAPS API (needs webmasters scope — read-write)
  // =========================================================================

  /**
   * List all sitemaps for a site
   */
  async listSitemaps(siteUrl) {
    const encodedUrl = encodeURIComponent(siteUrl);
    const data = await this.request(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedUrl}/sitemaps`
    );
    return (data.sitemap || []).map(s => ({
      path: s.path,
      lastSubmitted: s.lastSubmitted,
      lastDownloaded: s.lastDownloaded,
      isPending: s.isPending,
      warnings: s.warnings,
      errors: s.errors,
      contents: s.contents,
    }));
  }

  /**
   * Submit a sitemap to Google (triggers re-crawl)
   */
  async submitSitemap(siteUrl, sitemapUrl) {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const encodedSitemapUrl = encodeURIComponent(sitemapUrl);
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps/${encodedSitemapUrl}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sitemap submit error (${response.status}): ${error}`);
    }

    return { success: true, sitemapUrl };
  }

  /**
   * Delete a sitemap from Search Console
   */
  async deleteSitemap(siteUrl, sitemapUrl) {
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const encodedSitemapUrl = encodeURIComponent(sitemapUrl);
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps/${encodedSitemapUrl}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sitemap delete error (${response.status}): ${error}`);
    }

    return { success: true, deleted: sitemapUrl };
  }

  /**
   * Site summary - overview ของเว็บ 28 วัน
   */
  async getSummary(siteUrl) {
    const [queries, pages, devices, trend] = await Promise.all([
      this.topQueries(siteUrl, { limit: 10 }),
      this.topPages(siteUrl, { limit: 5 }),
      this.byDevice(siteUrl),
      this.byDate(siteUrl, { days: 7 })
    ]);

    const totalClicks = trend.reduce((sum, d) => sum + d.clicks, 0);
    const totalImpressions = trend.reduce((sum, d) => sum + d.impressions, 0);

    return {
      siteUrl,
      period: '7 days',
      totalClicks,
      totalImpressions,
      avgCtr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      topQueries: queries.slice(0, 5),
      topPages: pages.slice(0, 3),
      devices,
      dailyTrend: trend
    };
  }

  _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  _loadToken() {
    try {
      if (fs.existsSync(this.config.tokenPath)) {
        const data = JSON.parse(fs.readFileSync(this.config.tokenPath, 'utf8'));
        this.accessToken = data.accessToken;
        this.tokenExpiry = data.tokenExpiry || 0;
      }
    } catch (err) { /* ignore */ }
  }

  _saveToken() {
    try {
      const dir = path.dirname(this.config.tokenPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let existing = {};
      if (fs.existsSync(this.config.tokenPath)) {
        existing = JSON.parse(fs.readFileSync(this.config.tokenPath, 'utf8'));
      }
      fs.writeFileSync(this.config.tokenPath, JSON.stringify({
        ...existing,
        accessToken: this.accessToken,
        tokenExpiry: this.tokenExpiry
      }, null, 2));
    } catch (err) { /* ignore */ }
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      hasToken: !!this.accessToken,
      tokenValid: Date.now() < this.tokenExpiry
    };
  }
}

const searchConsole = new SearchConsole();

export default searchConsole;
export { SearchConsole };
