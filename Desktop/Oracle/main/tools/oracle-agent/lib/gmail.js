/**
 * Gmail API Client
 * Direct Gmail API access using OAuth2 refresh token
 *
 * Features:
 * - List messages (inbox, sent, etc.)
 * - Read message details
 * - Search emails
 * - Send emails
 * - Create drafts
 * - Label management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GmailClient {
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
      throw new Error('Gmail not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
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

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    this._saveToken();

    return this.accessToken;
  }

  async request(endpoint, options = {}) {
    const token = await this.getAccessToken();
    const baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';

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
      throw new Error(`Gmail API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * List messages
   * @param {object} options - { maxResults, labelIds, query }
   */
  async listMessages(options = {}) {
    const { maxResults = 10, labelIds = ['INBOX'], query = '' } = options;

    const params = new URLSearchParams({ maxResults: maxResults.toString() });
    if (query) params.set('q', query);
    if (labelIds?.length) {
      labelIds.forEach(id => params.append('labelIds', id));
    }

    const data = await this.request(`/messages?${params}`);
    if (!data.messages?.length) return [];

    // Fetch details for each message
    const messages = await Promise.all(
      data.messages.map(msg => this.getMessage(msg.id, 'metadata'))
    );

    return messages;
  }

  /**
   * Get a single message
   * @param {string} id - Message ID
   * @param {string} format - 'full', 'metadata', 'minimal', 'raw'
   */
  async getMessage(id, format = 'full') {
    const params = new URLSearchParams({ format });
    if (format === 'metadata') {
      ['Subject', 'From', 'To', 'Date', 'Cc'].forEach(h =>
        params.append('metadataHeaders', h)
      );
    }

    const data = await this.request(`/messages/${id}?${params}`);
    return this._normalizeMessage(data, format);
  }

  /**
   * Search emails
   * @param {string} query - Gmail search query (same as Gmail search bar)
   * @param {number} maxResults
   */
  async search(query, maxResults = 10) {
    return this.listMessages({ query, maxResults, labelIds: [] });
  }

  /**
   * Get unread count
   */
  async getUnreadCount() {
    const data = await this.request('/labels/INBOX');
    return {
      unread: data.messagesUnread || 0,
      total: data.messagesTotal || 0
    };
  }

  /**
   * Get recent unread messages
   */
  async getUnread(maxResults = 5) {
    return this.listMessages({ query: 'is:unread', maxResults });
  }

  /**
   * Send email
   * @param {object} options - { to, subject, body, cc, bcc, inReplyTo, threadId, attachments }
   * attachments: [{ filename, content (Buffer), mimeType }]
   */
  async send(options) {
    const { to, subject, body, cc, bcc, inReplyTo, threadId, attachments } = options;

    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    let baseHeaders = `To: ${to}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\n`;
    if (cc) baseHeaders += `Cc: ${cc}\r\n`;
    if (bcc) baseHeaders += `Bcc: ${bcc}\r\n`;
    if (inReplyTo) baseHeaders += `In-Reply-To: ${inReplyTo}\r\nReferences: ${inReplyTo}\r\n`;
    // List-Unsubscribe header (required by Gmail 2024 bulk sender guidelines)
    if (options.listUnsubscribe !== false) {
      baseHeaders += `List-Unsubscribe: <mailto:info@visionxbrain.com?subject=Unsubscribe>\r\n`;
      baseHeaders += `List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n`;
    }

    let rawMessage;

    // Helper: base64 with 76-char line breaks (RFC 2045 MIME compliance)
    const toBase64Lines = (buf) => {
      const b64 = buf.toString('base64');
      return b64.match(/.{1,76}/g).join('\r\n');
    };

    if (attachments?.length) {
      // Multipart/mixed with related HTML + attachments
      const relatedBoundary = `related_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      baseHeaders += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;

      let messageParts = `${baseHeaders}\r\n`;

      // HTML body part (inside multipart/related for inline images)
      messageParts += `--${boundary}\r\n`;
      messageParts += `Content-Type: text/html; charset=utf-8\r\n`;
      messageParts += `Content-Transfer-Encoding: base64\r\n\r\n`;
      messageParts += toBase64Lines(Buffer.from(body, 'utf-8')) + '\r\n';

      // Attachment parts
      for (const att of attachments) {
        const encodedFilename = `=?UTF-8?B?${Buffer.from(att.filename, 'utf-8').toString('base64')}?=`;
        messageParts += `--${boundary}\r\n`;
        messageParts += `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${encodedFilename}"\r\n`;
        messageParts += `Content-Disposition: attachment; filename="${encodedFilename}"\r\n`;
        messageParts += `Content-Transfer-Encoding: base64\r\n\r\n`;
        messageParts += toBase64Lines(att.content) + '\r\n';
      }
      messageParts += `--${boundary}--`;

      rawMessage = Buffer.from(messageParts).toString('base64url');
    } else {
      // Simple message without attachments
      baseHeaders += `Content-Type: text/html; charset=utf-8\r\n`;
      rawMessage = Buffer.from(`${baseHeaders}\r\n${body}`).toString('base64url');
    }

    const payload = { raw: rawMessage };
    if (threadId) payload.threadId = threadId;

    const data = await this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log(`[GMAIL] Sent email to ${to}: ${subject}${attachments?.length ? ` (${attachments.length} attachment)` : ''}`);
    return { id: data.id, threadId: data.threadId, labelIds: data.labelIds };
  }

  /**
   * Create draft
   * @param {object} options - { to, subject, body }
   */
  async createDraft(options) {
    const { to, subject, body } = options;

    const encodedSubj = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
    const headers = `To: ${to}\r\nSubject: ${encodedSubj}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n`;
    const raw = Buffer.from(`${headers}\r\n${body}`).toString('base64url');

    const data = await this.request('/drafts', {
      method: 'POST',
      body: JSON.stringify({ message: { raw } })
    });

    console.log(`[GMAIL] Draft created for ${to}: ${subject}`);
    return { id: data.id, messageId: data.message?.id };
  }

  /**
   * Get email summary for briefing
   */
  async getSummary() {
    const [unread, recent] = await Promise.all([
      this.getUnreadCount(),
      this.getUnread(5)
    ]);

    return {
      unreadCount: unread.unread,
      totalInbox: unread.total,
      recentUnread: recent.map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        date: m.date,
        snippet: m.snippet
      }))
    };
  }

  /**
   * Watch inbox for push notifications via Google Pub/Sub
   * @param {string} topicName - Full topic path e.g. projects/xxx/topics/gmail-notifications
   */
  async watchInbox(topicName) {
    const data = await this.request('/watch', {
      method: 'POST',
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX']
      })
    });
    console.log(`[GMAIL] Watch started — historyId: ${data.historyId}, expires: ${new Date(parseInt(data.expiration)).toISOString()}`);
    return { historyId: data.historyId, expiration: parseInt(data.expiration) };
  }

  /**
   * List history since a given historyId (for processing push notifications)
   * @param {string} startHistoryId
   */
  async listHistory(startHistoryId) {
    try {
      const params = new URLSearchParams({
        startHistoryId: startHistoryId.toString(),
        historyTypes: 'messageAdded',
        labelId: 'INBOX'
      });
      const data = await this.request(`/history?${params}`);
      return { history: data.history || [], historyId: data.historyId };
    } catch (err) {
      // 404 = historyId expired, need to re-watch
      if (err.message.includes('404')) {
        console.log('[GMAIL] History expired, need re-watch');
        return { history: [], historyId: null, expired: true };
      }
      throw err;
    }
  }

  /**
   * Strip quoted text from email reply — get only the new content
   * @param {string} body - Raw email body (may contain HTML)
   * @returns {string} Clean reply text
   */
  static stripQuotedText(body) {
    if (!body) return '';

    // Remove HTML tags
    let text = body
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(div|p|tr|td|li|ul|ol|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Split into lines
    const lines = text.split('\n');
    const cleanLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Stop at "On ... wrote:" pattern (English)
      if (/^On .+ wrote:$/i.test(trimmed)) break;
      // Stop at Thai quoted header
      if (/^เมื่อวันที่ .+ เขียนว่า:$/i.test(trimmed)) break;
      // Stop at Gmail separator
      if (trimmed === '---------- Forwarded message ---------') break;
      // Stop at common reply separators
      if (/^-{3,}\s*Original Message\s*-{3,}$/i.test(trimmed)) break;
      if (/^From:\s+/i.test(trimmed) && cleanLines.length > 0) break;
      // Skip quoted lines (> prefix)
      if (trimmed.startsWith('>')) continue;

      cleanLines.push(trimmed);
    }

    return cleanLines.join('\n').trim();
  }

  /**
   * Mark as read
   */
  async markAsRead(messageId) {
    return this.request(`/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
    });
  }

  /**
   * Archive message
   */
  async archive(messageId) {
    return this.request(`/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['INBOX'] })
    });
  }

  /**
   * Normalize message to friendly format
   */
  _normalizeMessage(data, format) {
    const headers = {};
    if (data.payload?.headers) {
      data.payload.headers.forEach(h => {
        headers[h.name.toLowerCase()] = h.value;
      });
    }

    const result = {
      id: data.id,
      threadId: data.threadId,
      from: headers.from || '',
      to: headers.to || '',
      cc: headers.cc || '',
      subject: headers.subject || '(no subject)',
      date: headers.date || '',
      snippet: data.snippet || '',
      labelIds: data.labelIds || [],
      isUnread: (data.labelIds || []).includes('UNREAD')
    };

    if (format === 'full' && data.payload) {
      result.body = this._extractBody(data.payload);
    }

    return result;
  }

  /**
   * Extract body from message payload
   */
  _extractBody(payload) {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      // Prefer HTML, fallback to plain
      const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
      const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
      const part = htmlPart || textPart;

      if (part?.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      // Nested multipart
      for (const p of payload.parts) {
        if (p.parts) {
          const nested = this._extractBody(p);
          if (nested) return nested;
        }
      }
    }

    return '';
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
    } catch (err) {
      console.error('[GMAIL] Failed to save token:', err.message);
    }
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      hasToken: !!this.accessToken,
      tokenValid: Date.now() < this.tokenExpiry
    };
  }
}

const gmailClient = new GmailClient();

export default gmailClient;
export { GmailClient };
