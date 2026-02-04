/**
 * Google Calendar Integration
 *
 * Sync กับ Google Calendar ของ Tars
 *
 * Features:
 * - View upcoming events
 * - Create events
 * - Check availability
 * - Notify before events
 * - Block busy times
 *
 * Setup:
 * 1. Create Google Cloud Project
 * 2. Enable Calendar API
 * 3. Create OAuth2 credentials
 * 4. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Event colors (Google Calendar color IDs)
 */
const COLORS = {
  LAVENDER: '1',
  SAGE: '2',
  GRAPE: '3',
  FLAMINGO: '4',
  BANANA: '5',
  TANGERINE: '6',
  PEACOCK: '7',
  GRAPHITE: '8',
  BLUEBERRY: '9',
  BASIL: '10',
  TOMATO: '11'
};

/**
 * Google Calendar Client
 */
class GoogleCalendar {
  constructor(config = {}) {
    this.config = {
      clientId: config.clientId || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '',
      refreshToken: config.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || '',
      calendarId: config.calendarId || 'primary',
      timezone: config.timezone || 'Asia/Bangkok',
      tokenPath: config.tokenPath || path.join(__dirname, '..', 'data', 'google-token.json'),
      ...config
    };

    this.accessToken = null;
    this.tokenExpiry = 0;

    // Load saved token
    this._loadToken();
  }

  /**
   * Check if configured
   */
  isConfigured() {
    return !!(this.config.clientId && this.config.clientSecret && this.config.refreshToken);
  }

  /**
   * Get access token (refresh if needed)
   */
  async getAccessToken() {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    }

    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    // Refresh token
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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    this._saveToken();

    return this.accessToken;
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const token = await this.getAccessToken();
    const baseUrl = 'https://www.googleapis.com/calendar/v3';

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Calendar API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Get upcoming events
   * @param {object} options
   */
  async getEvents(options = {}) {
    const {
      maxResults = 10,
      timeMin = new Date().toISOString(),
      timeMax = null,
      query = null
    } = options;

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      timeMin,
      singleEvents: 'true',
      orderBy: 'startTime'
    });

    if (timeMax) params.set('timeMax', timeMax);
    if (query) params.set('q', query);

    const data = await this.request(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events?${params}`
    );

    return (data.items || []).map(event => this._normalizeEvent(event));
  }

  /**
   * Get today's events
   */
  async getToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    return this.getEvents({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 50
    });
  }

  /**
   * Get events for next N days
   */
  async getNextDays(days = 7) {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    return this.getEvents({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 100
    });
  }

  /**
   * Create an event
   */
  async createEvent(options) {
    const {
      title,
      description = '',
      startTime,
      endTime,
      location = '',
      attendees = [],
      reminders = null,
      colorId = null
    } = options;

    const event = {
      summary: title,
      description,
      location,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: this.config.timezone
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: this.config.timezone
      }
    };

    if (attendees.length > 0) {
      event.attendees = attendees.map(email => ({ email }));
    }

    if (reminders) {
      event.reminders = {
        useDefault: false,
        overrides: reminders.map(minutes => ({
          method: 'popup',
          minutes
        }))
      };
    }

    if (colorId) {
      event.colorId = colorId;
    }

    const data = await this.request(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events`,
      {
        method: 'POST',
        body: JSON.stringify(event)
      }
    );

    console.log(`[CALENDAR] Created event: ${title}`);

    return this._normalizeEvent(data);
  }

  /**
   * Quick add event (natural language)
   */
  async quickAdd(text) {
    const data = await this.request(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events/quickAdd?text=${encodeURIComponent(text)}`,
      { method: 'POST' }
    );

    console.log(`[CALENDAR] Quick added: ${text}`);

    return this._normalizeEvent(data);
  }

  /**
   * Update an event
   */
  async updateEvent(eventId, updates) {
    const data = await this.request(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }
    );

    console.log(`[CALENDAR] Updated event: ${eventId}`);

    return this._normalizeEvent(data);
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    await this.request(
      `/calendars/${encodeURIComponent(this.config.calendarId)}/events/${eventId}`,
      { method: 'DELETE' }
    );

    console.log(`[CALENDAR] Deleted event: ${eventId}`);

    return true;
  }

  /**
   * Check availability (free/busy)
   */
  async checkAvailability(startTime, endTime) {
    const data = await this.request('/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: new Date(startTime).toISOString(),
        timeMax: new Date(endTime).toISOString(),
        items: [{ id: this.config.calendarId }]
      })
    });

    const busy = data.calendars?.[this.config.calendarId]?.busy || [];
    return {
      free: busy.length === 0,
      busyPeriods: busy.map(period => ({
        start: period.start,
        end: period.end
      }))
    };
  }

  /**
   * Find free slots
   */
  async findFreeSlots(options = {}) {
    const {
      date = new Date(),
      duration = 60, // minutes
      workStart = 9,
      workEnd = 18
    } = options;

    // Get day's events
    const start = new Date(date);
    start.setHours(workStart, 0, 0, 0);

    const end = new Date(date);
    end.setHours(workEnd, 0, 0, 0);

    const events = await this.getEvents({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: 50
    });

    // Find gaps
    const slots = [];
    let currentTime = start.getTime();

    for (const event of events) {
      const eventStart = new Date(event.startTime).getTime();
      const gap = eventStart - currentTime;

      if (gap >= duration * 60 * 1000) {
        slots.push({
          start: new Date(currentTime).toISOString(),
          end: new Date(eventStart).toISOString(),
          durationMinutes: Math.floor(gap / 60000)
        });
      }

      currentTime = Math.max(currentTime, new Date(event.endTime).getTime());
    }

    // Check remaining time
    if (end.getTime() - currentTime >= duration * 60 * 1000) {
      slots.push({
        start: new Date(currentTime).toISOString(),
        end: end.toISOString(),
        durationMinutes: Math.floor((end.getTime() - currentTime) / 60000)
      });
    }

    return slots;
  }

  /**
   * Get next event
   */
  async getNextEvent() {
    const events = await this.getEvents({ maxResults: 1 });
    return events[0] || null;
  }

  /**
   * Normalize event to standard format
   */
  _normalizeEvent(event) {
    return {
      id: event.id,
      title: event.summary || '(No title)',
      description: event.description || '',
      location: event.location || '',
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      isAllDay: !!event.start?.date,
      attendees: (event.attendees || []).map(a => ({
        email: a.email,
        name: a.displayName,
        status: a.responseStatus
      })),
      htmlLink: event.htmlLink,
      status: event.status,
      created: event.created,
      updated: event.updated
    };
  }

  /**
   * Get calendar summary for today
   */
  async getDailySummary() {
    const events = await this.getToday();
    const next = await this.getNextEvent();

    return {
      date: new Date().toLocaleDateString('th-TH'),
      totalEvents: events.length,
      events: events.map(e => ({
        title: e.title,
        time: new Date(e.startTime).toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: this.config.timezone
        }),
        location: e.location
      })),
      nextEvent: next ? {
        title: next.title,
        startsIn: this._formatTimeDiff(new Date(next.startTime).getTime() - Date.now())
      } : null
    };
  }

  /**
   * Format time difference
   */
  _formatTimeDiff(ms) {
    if (ms < 0) return 'now';

    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} ชั่วโมง ${minutes % 60} นาที`;
    }
    return `${minutes} นาที`;
  }

  /**
   * Load saved token
   */
  _loadToken() {
    try {
      if (fs.existsSync(this.config.tokenPath)) {
        const data = JSON.parse(fs.readFileSync(this.config.tokenPath, 'utf8'));
        this.accessToken = data.accessToken;
        this.tokenExpiry = data.tokenExpiry;
      }
    } catch (err) {
      // Ignore
    }
  }

  /**
   * Save token
   */
  _saveToken() {
    try {
      const dir = path.dirname(this.config.tokenPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.config.tokenPath, JSON.stringify({
        accessToken: this.accessToken,
        tokenExpiry: this.tokenExpiry
      }));
    } catch (err) {
      console.error('[CALENDAR] Failed to save token:', err.message);
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      hasToken: !!this.accessToken,
      tokenValid: Date.now() < this.tokenExpiry,
      calendarId: this.config.calendarId
    };
  }
}

// Singleton instance
const googleCalendar = new GoogleCalendar();

export default googleCalendar;
export { GoogleCalendar, COLORS };
