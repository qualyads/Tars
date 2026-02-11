/**
 * Google Analytics 4 (GA4) Data API Client
 * ดึง traffic, users, pageviews, sources, conversions
 *
 * Scope: analytics.readonly (authorized แล้ว)
 * API: https://analyticsdata.googleapis.com/v1beta
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://analyticsdata.googleapis.com/v1beta';

class GoogleAnalytics {
  constructor(config = {}) {
    this.config = {
      clientId: config.clientId || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
      refreshToken: config.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || '',
      propertyId: config.propertyId || process.env.GA4_PROPERTY_ID || '',
      tokenPath: config.tokenPath || path.join(__dirname, '..', 'data', 'google-token.json'),
      ...config
    };

    this.accessToken = null;
    this.tokenExpiry = 0;
    this._loadToken();
  }

  isConfigured() {
    return !!(this.config.clientId && this.config.clientSecret && this.config.refreshToken && this.config.propertyId);
  }

  async getAccessToken() {
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) {
      throw new Error('GA4 not configured — missing OAuth credentials');
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

  /**
   * Run a GA4 report (core method)
   */
  async runReport(options = {}) {
    if (!this.config.propertyId) throw new Error('GA4_PROPERTY_ID not set');

    const token = await this.getAccessToken();
    const url = `${BASE_URL}/properties/${this.config.propertyId}:runReport`;

    const body = {
      dateRanges: options.dateRanges || [{ startDate: '28daysAgo', endDate: 'today' }],
      dimensions: options.dimensions || [],
      metrics: options.metrics || [{ name: 'sessions' }],
      limit: options.limit || 100,
      offset: options.offset || 0
    };

    body.metricAggregations = ['TOTAL'];
    if (options.orderBys) body.orderBys = options.orderBys;
    if (options.dimensionFilter) body.dimensionFilter = options.dimensionFilter;
    if (options.metricFilter) body.metricFilter = options.metricFilter;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GA4 API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return this._parseReport(data);
  }

  /**
   * Traffic summary — sessions, users, pageviews, bounce rate
   */
  async getTrafficSummary(options = {}) {
    const { startDate = '28daysAgo', endDate = 'today' } = options;

    const data = await this.runReport({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'engagementRate' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'eventCount' }
      ]
    });

    const totals = Object.keys(data.totals || {}).length > 0 ? data.totals : (data.rows[0] || {});
    return { period: { startDate, endDate }, totals };
  }

  /**
   * Traffic sources — source/medium breakdown
   */
  async getTrafficSources(options = {}) {
    const { startDate = '7daysAgo', endDate = 'today', limit = 20 } = options;

    return this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagementRate' },
        { name: 'bounceRate' }
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit
    });
  }

  /**
   * Top pages — most viewed pages
   */
  async getTopPages(options = {}) {
    const { startDate = '7daysAgo', endDate = 'today', limit = 20 } = options;

    return this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' }
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit
    });
  }

  /**
   * Daily trends — sessions/users per day
   */
  async getDailyTrends(options = {}) {
    const { startDate = '28daysAgo', endDate = 'today' } = options;

    return this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      limit: 90
    });
  }

  /**
   * Conversions — key events
   */
  async getConversions(options = {}) {
    const { startDate = '7daysAgo', endDate = 'today', limit = 20 } = options;

    return this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit
    });
  }

  /**
   * Traffic by country
   */
  async getByCountry(options = {}) {
    const { startDate = '7daysAgo', endDate = 'today', limit = 10 } = options;

    return this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit
    });
  }

  /**
   * Traffic by device (desktop/mobile/tablet)
   */
  async getByDevice(options = {}) {
    const { startDate = '7daysAgo', endDate = 'today' } = options;

    return this.runReport({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 3
    });
  }

  /**
   * Full summary — all key data combined
   */
  async getSummary(options = {}) {
    const { startDate = '7daysAgo', endDate = 'today' } = options;
    const opts = { startDate, endDate };

    const [traffic, sources, pages, devices, country] = await Promise.all([
      this.getTrafficSummary(opts),
      this.getTrafficSources({ ...opts, limit: 5 }),
      this.getTopPages({ ...opts, limit: 5 }),
      this.getByDevice(opts),
      this.getByCountry({ ...opts, limit: 5 })
    ]);

    return {
      propertyId: this.config.propertyId,
      period: { startDate, endDate },
      traffic: traffic.totals,
      topSources: sources.rows || [],
      topPages: pages.rows || [],
      devices: devices.rows || [],
      countries: country.rows || []
    };
  }

  // --- Internal ---

  _parseReport(data) {
    const dimHeaders = (data.dimensionHeaders || []).map(h => h.name);
    const metricHeaders = (data.metricHeaders || []).map(h => h.name);

    const rows = (data.rows || []).map(row => {
      const obj = {};
      (row.dimensionValues || []).forEach((v, i) => { obj[dimHeaders[i]] = v.value; });
      (row.metricValues || []).forEach((v, i) => { obj[metricHeaders[i]] = parseFloat(v.value) || 0; });
      return obj;
    });

    const totals = {};
    if (data.totals && data.totals.length > 0) {
      (data.totals[0].metricValues || []).forEach((v, i) => {
        totals[metricHeaders[i]] = parseFloat(v.value) || 0;
      });
    }

    return { rows, totals, rowCount: data.rowCount || rows.length };
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
      propertyId: this.config.propertyId || 'NOT SET',
      hasToken: !!this.accessToken,
      tokenValid: Date.now() < this.tokenExpiry
    };
  }
}

const ga4 = new GoogleAnalytics();

export default ga4;
export { GoogleAnalytics };
