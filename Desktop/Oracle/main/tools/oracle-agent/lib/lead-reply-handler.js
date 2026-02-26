/**
 * Lead Reply Handler — Reply Detection + Auto-Reply with Calendar Slots
 *
 * Mode: Gmail Polling (every 2 min) — replaces Pub/Sub which requires GCP org policy changes
 * Flow: pollNewMessages → listHistory → match lead → classify intent → auto-reply/notify
 *
 * Safety:
 * - Max 1 auto-reply per lead (autoRepliedAt field)
 * - Skip emails from visionxbrain, mailer-daemon, noreply
 * - Calendar failure → fallback text
 */

import { chat } from './claude.js';
import gmail from './gmail.js';
import { GmailClient } from './gmail.js';
import googleCalendar from './google-calendar.js';
import gateway from './gateway.js';
import { loadLeads as dbLoadLeads, saveLeads as dbSaveLeads } from './db-leads.js';

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// Watch state
let watchState = {
  historyId: null,
  pollActive: false,
  pollTimer: null,
  setupAt: null,
  lastPoll: null,
  lastWebhook: null,
  processedMessages: new Set(),
  stats: { pollCycles: 0, webhooksReceived: 0, messagesProcessed: 0, repliesDetected: 0, autoRepliesSent: 0 }
};

// Skip these senders
const SKIP_SENDERS = ['visionxbrain', 'mailer-daemon', 'noreply', 'no-reply', 'postmaster', 'googlemail'];

// ─── Leads I/O (ใช้ db-leads.js — Postgres first, file fallback) ───

async function loadLeads() {
  return dbLoadLeads();
}

async function saveLeads(data) {
  return dbSaveLeads(data);
}

// ─── Setup Watch (Polling Mode) ───

async function setupWatch() {
  try {
    if (!gmail.isConfigured()) {
      console.log('[LEAD-REPLY] Gmail not configured, skipping watch setup');
      return null;
    }

    // Get initial historyId from Gmail profile
    const token = await gmail.getAccessToken();
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!profileRes.ok) {
      throw new Error(`Gmail profile fetch failed: ${profileRes.status}`);
    }

    const profile = await profileRes.json();
    watchState.historyId = profile.historyId;
    watchState.setupAt = new Date().toISOString();

    // Start polling
    if (watchState.pollTimer) {
      clearInterval(watchState.pollTimer);
    }

    watchState.pollActive = true;
    watchState.pollTimer = setInterval(() => pollNewMessages(), POLL_INTERVAL_MS);

    console.log(`[LEAD-REPLY] ✅ Polling mode active — every ${POLL_INTERVAL_MS / 1000}s, historyId: ${watchState.historyId}`);
    return { historyId: watchState.historyId, mode: 'polling', interval: POLL_INTERVAL_MS };
  } catch (err) {
    console.error('[LEAD-REPLY] Watch setup failed:', err.message);
    return null;
  }
}

// ─── Poll for New Messages ───

async function pollNewMessages() {
  if (!watchState.historyId) return;

  try {
    watchState.stats.pollCycles++;
    const historyResult = await gmail.listHistory(watchState.historyId);

    // Handle expired history
    if (historyResult.expired) {
      console.log('[LEAD-REPLY] History expired, re-initializing...');
      const token = await gmail.getAccessToken();
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        watchState.historyId = profile.historyId;
      }
      return;
    }

    // Update historyId
    if (historyResult.historyId) {
      watchState.historyId = historyResult.historyId;
    }

    watchState.lastPoll = new Date().toISOString();

    if (!historyResult.history || historyResult.history.length === 0) {
      return;
    }

    // Extract new message IDs
    const messageIds = new Set();
    for (const entry of historyResult.history) {
      if (entry.messagesAdded) {
        for (const added of entry.messagesAdded) {
          const msgId = added.message.id;
          if (!watchState.processedMessages.has(msgId)) {
            messageIds.add(msgId);
          }
        }
      }
    }

    if (messageIds.size === 0) return;

    console.log(`[LEAD-REPLY] Poll: ${messageIds.size} new message(s)`);

    // Process each message
    for (const msgId of messageIds) {
      try {
        await processIncomingMessage(msgId);
        watchState.processedMessages.add(msgId);
        watchState.stats.messagesProcessed++;
      } catch (err) {
        console.error(`[LEAD-REPLY] Error processing ${msgId}:`, err.message);
      }
    }

    // Keep processedMessages set bounded
    if (watchState.processedMessages.size > 500) {
      const arr = [...watchState.processedMessages];
      watchState.processedMessages = new Set(arr.slice(-200));
    }
  } catch (err) {
    console.error('[LEAD-REPLY] Poll error:', err.message);
  }
}

// ─── Process Gmail Webhook (still supported if Pub/Sub works later) ───

async function processGmailWebhook(payload) {
  watchState.lastWebhook = new Date().toISOString();
  watchState.stats.webhooksReceived++;

  const newHistoryId = payload.historyId;

  if (!watchState.historyId) {
    watchState.historyId = newHistoryId;
    return { status: 'skipped', reason: 'no_previous_history' };
  }

  try {
    const historyResult = await gmail.listHistory(watchState.historyId);

    if (historyResult.expired) {
      await setupWatch();
      return { status: 'rewatch', reason: 'history_expired' };
    }

    if (historyResult.historyId) {
      watchState.historyId = historyResult.historyId;
    }

    if (!historyResult.history || historyResult.history.length === 0) {
      return { status: 'ok', newMessages: 0 };
    }

    const messageIds = new Set();
    for (const entry of historyResult.history) {
      if (entry.messagesAdded) {
        for (const added of entry.messagesAdded) {
          const msgId = added.message.id;
          if (!watchState.processedMessages.has(msgId)) {
            messageIds.add(msgId);
          }
        }
      }
    }

    if (messageIds.size === 0) {
      return { status: 'ok', newMessages: 0 };
    }

    console.log(`[LEAD-REPLY] ${messageIds.size} new message(s) to process`);

    const results = [];
    for (const msgId of messageIds) {
      try {
        const result = await processIncomingMessage(msgId);
        results.push(result);
        watchState.processedMessages.add(msgId);
        watchState.stats.messagesProcessed++;
      } catch (err) {
        console.error(`[LEAD-REPLY] Error processing ${msgId}:`, err.message);
        results.push({ msgId, error: err.message });
      }
    }

    if (watchState.processedMessages.size > 500) {
      const arr = [...watchState.processedMessages];
      watchState.processedMessages = new Set(arr.slice(-200));
    }

    return { status: 'ok', newMessages: messageIds.size, results };
  } catch (err) {
    console.error('[LEAD-REPLY] Webhook processing error:', err.message);
    return { status: 'error', error: err.message };
  }
}

// ─── Process Single Message ───

async function processIncomingMessage(msgId) {
  const msg = await gmail.getMessage(msgId, 'full');

  // Extract sender email
  const fromMatch = msg.from.match(/<([^>]+)>/);
  const senderEmail = (fromMatch ? fromMatch[1] : msg.from).toLowerCase().trim();

  // Skip our own emails and system emails
  if (SKIP_SENDERS.some(s => senderEmail.includes(s))) {
    return { msgId, status: 'skipped', reason: 'sender_filtered', sender: senderEmail };
  }

  // Match against leads — ทุก status ยกเว้น bounced/closed
  const leadsData = await loadLeads();
  const lead = leadsData.leads.find(l =>
    l.email && senderEmail.includes(l.email.toLowerCase()) &&
    !['bounced', 'closed'].includes(l.status)
  );

  if (!lead) {
    return { msgId, status: 'skipped', reason: 'not_a_lead', sender: senderEmail };
  }

  console.log(`[LEAD-REPLY] 🎯 Reply from lead: ${lead.businessName} (${senderEmail})`);
  watchState.stats.repliesDetected++;

  // Extract clean reply text
  const replyText = GmailClient.stripQuotedText(msg.body || msg.snippet || '');

  // Update lead with reply info
  lead.status = 'replied';
  lead.repliedAt = new Date().toISOString();
  lead.replyMessageId = msg.id;
  lead.replyThreadId = msg.threadId;
  lead.replySnippet = replyText.slice(0, 500);

  // Classify intent
  const intent = await classifyIntent(replyText, lead);
  lead.replyIntent = intent;

  console.log(`[LEAD-REPLY] Intent: ${intent} | ${lead.businessName}`);

  // Handle based on intent
  if (intent === 'interested') {
    // Auto-reply with calendar slots
    if (!lead.autoRepliedAt) {
      try {
        await sendAutoReply(lead, msg, replyText);
        lead.autoRepliedAt = new Date().toISOString();
        watchState.stats.autoRepliesSent++;
      } catch (err) {
        console.error(`[LEAD-REPLY] Auto-reply failed for ${lead.businessName}:`, err.message);
      }
    }
    await notifyLeadReply(lead, replyText, 'interested');
  } else if (intent === 'declined') {
    lead.status = 'closed';
    lead.closedAt = new Date().toISOString();
    lead.closeReason = 'declined_by_reply';
    // Unsubscribe จาก nurture sequence ด้วย
    if (lead.email) {
      try {
        const emailNurture = (await import('./email-nurture.js')).default;
        await emailNurture.unsubscribe(lead.email);
      } catch (e) { console.error('[LEAD-REPLY] Nurture unsubscribe error:', e.message); }
    }
    await notifyLeadReply(lead, replyText, 'declined');
  } else {
    // unclear — notify only, Tar handles manually
    await notifyLeadReply(lead, replyText, 'unclear');
  }

  await saveLeads(leadsData);
  return { msgId, status: 'processed', lead: lead.businessName, intent };
}

// ─── Intent Classification ───

async function classifyIntent(replyText, lead) {
  try {
    const response = await chat([
      {
        role: 'user',
        content: `Classify this email reply intent. The original email was a business outreach offering SEO/web services to "${lead.businessName}" (${lead.industry || 'unknown industry'}).

Reply text:
"""
${replyText.slice(0, 1000)}
"""

Classify as ONE of:
- "interested" — wants to know more, asks questions, requests meeting/call, positive tone
- "declined" — not interested, already has agency, budget issues, asks to stop emailing
- "unclear" — auto-reply, out-of-office, unrelated, ambiguous

Reply with ONLY the classification word, nothing else.`
      }
    ], {
      system: 'You classify email reply intents. Reply with exactly one word: interested, declined, or unclear.',
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 10,
      skipAutoRecall: true
    });

    const intent = response.trim().toLowerCase();
    if (['interested', 'declined', 'unclear'].includes(intent)) {
      return intent;
    }
    return 'unclear';
  } catch (err) {
    console.error('[LEAD-REPLY] Intent classification failed:', err.message);
    return 'unclear';
  }
}

// ─── Auto-Reply with Calendar Slots ───

async function sendAutoReply(lead, originalMsg, replyText) {
  // Get free slots
  let slotsText;
  try {
    slotsText = await getNextFreeSlots(3);
  } catch (err) {
    console.log('[LEAD-REPLY] Calendar unavailable, using fallback:', err.message);
    slotsText = null;
  }

  const calendarSection = slotsText
    ? `\n\nช่วงเวลาที่สะดวกนัดคุยครับ:\n${slotsText}\n\nหรือถ้ามีเวลาอื่นที่สะดวกกว่า แจ้งมาได้เลยครับ`
    : '\n\nจะแจ้งเวลาว่างให้ภายหลังนะครับ';

  // Generate personalized reply with AI
  let replyBody;
  try {
    replyBody = await chat([
      {
        role: 'user',
        content: `Write a short, professional Thai reply to a business lead who responded positively to our SEO/web outreach email.

Business: ${lead.businessName} (${lead.industry || ''})
Their reply: "${replyText.slice(0, 500)}"

Requirements:
- Thank them for replying
- Address their specific question/interest if any
- Keep it under 5 sentences
- Professional but friendly tone (not robotic)
- End with willingness to discuss further
- Do NOT include greeting or sign-off (I'll add those)
- Write in Thai`
      }
    ], {
      system: 'You write short, natural Thai business emails. No emojis. No over-selling.',
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 300,
      skipAutoRecall: true
    });
  } catch (err) {
    console.error('[LEAD-REPLY] AI reply generation failed:', err.message);
    replyBody = 'ขอบคุณที่ตอบกลับครับ ยินดีมากที่สนใจบริการของเรา';
  }

  const fullBody = `
<div style="font-family: 'Sarabun', Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.7;">
  <p>สวัสดีครับ,</p>
  <p>${replyBody.replace(/\n/g, '<br>')}</p>
  <p>${calendarSection.replace(/\n/g, '<br>')}</p>
  <br>
  <p>ขอบคุณครับ<br>
  <strong>Tanakit (Tar)</strong><br>
  VisionXBrain Agency<br>
  <a href="https://visionxbrain.com">visionxbrain.com</a></p>
</div>`.trim();

  const result = await gmail.send({
    to: lead.email,
    subject: `Re: ${originalMsg.subject}`,
    body: fullBody,
    inReplyTo: `<${originalMsg.id}@mail.gmail.com>`,
    threadId: originalMsg.threadId
  });

  lead.autoReplyMessageId = result.id;
  console.log(`[LEAD-REPLY] ✅ Auto-reply sent to ${lead.businessName} (${lead.email})`);
  return result;
}

// ─── Calendar Free Slots ───

async function getNextFreeSlots(days = 3) {
  if (!googleCalendar.isConfigured()) {
    throw new Error('Google Calendar not configured');
  }

  const slots = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);

    // Skip weekends
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    const daySlots = await googleCalendar.findFreeSlots({
      date,
      duration: 30,
      workStart: 10,
      workEnd: 17
    });

    if (daySlots.length > 0) {
      const dayName = date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });

      // Take max 3 slots per day
      const topSlots = daySlots.slice(0, 3).map(s => {
        const start = new Date(s.start);
        const end = new Date(s.end);
        return `  • ${start.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
      });

      slots.push(`📅 ${dayName}\n${topSlots.join('\n')}`);
    }
  }

  if (slots.length === 0) {
    throw new Error('No free slots found');
  }

  return slots.join('\n\n');
}

// ─── Notify Owner ───

async function notifyLeadReply(lead, replyText, intent) {
  const intentEmoji = { interested: '🔥', declined: '❌', unclear: '❓' };
  const intentLabel = { interested: 'สนใจ!', declined: 'ปฏิเสธ', unclear: 'ไม่ชัดเจน' };

  const message = `${intentEmoji[intent]} Lead Reply: ${lead.businessName}
Intent: ${intentLabel[intent]}
Email: ${lead.email}
Industry: ${lead.industry || '-'}

Reply:
"${replyText.slice(0, 300)}"

${intent === 'interested' && lead.autoRepliedAt ? '✅ Auto-reply sent with calendar slots' : ''}
${intent === 'unclear' ? '⚠️ ต้อง reply เอง' : ''}`;

  try {
    await gateway.notifyOwner(message.trim());
    console.log(`[LEAD-REPLY] Notification sent for ${lead.businessName}`);
  } catch (err) {
    console.error('[LEAD-REPLY] Notification failed:', err.message);
  }
}

// ─── Status ───

function getStatus() {
  return {
    mode: 'polling',
    pollActive: watchState.pollActive,
    pollInterval: `${POLL_INTERVAL_MS / 1000}s`,
    historyId: watchState.historyId,
    setupAt: watchState.setupAt,
    lastPoll: watchState.lastPoll,
    lastWebhook: watchState.lastWebhook,
    processedCount: watchState.processedMessages.size,
    stats: watchState.stats
  };
}

export default {
  setupWatch,
  processGmailWebhook,
  processIncomingMessage,
  pollNewMessages,
  classifyIntent,
  getStatus
};
