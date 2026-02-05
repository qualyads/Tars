/**
 * Claude API Wrapper with Auto-Failover
 * Handles communication with AI APIs with automatic failover
 *
 * v2.0: Added failover to OpenAI/Groq when Claude fails
 */

import Anthropic from '@anthropic-ai/sdk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../config.json');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Failover state
let currentProvider = 'anthropic';
let failoverNotified = false;
let lastFailoverTime = null;
const FAILOVER_NOTIFY_COOLDOWN = 3600000; // 1 hour

// LINE notification callback (set by server.js)
let notifyCallback = null;

/**
 * Set notification callback for failover alerts
 */
function setNotifyCallback(callback) {
  notifyCallback = callback;
}

/**
 * Get current provider status
 */
function getProviderStatus() {
  return {
    currentProvider,
    failoverNotified,
    lastFailoverTime
  };
}

/**
 * Send to Anthropic (Claude)
 */
async function sendToAnthropic(messages, options) {
  const response = await anthropic.messages.create({
    model: options.model || config.claude.model,
    max_tokens: options.max_tokens || config.claude.max_tokens,
    system: options.system || '',
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  });

  return response.content[0].text;
}

/**
 * Send to OpenAI (GPT)
 */
async function sendToOpenAI(messages, options) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const systemContent = options.system || '';
  const openaiMessages = [];

  if (systemContent) {
    openaiMessages.push({ role: 'system', content: systemContent });
  }

  openaiMessages.push(...messages.map(m => ({
    role: m.role,
    content: m.content
  })));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: openaiMessages,
      max_tokens: options.max_tokens || 4096
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Send to Groq (fast inference)
 */
async function sendToGroq(messages, options) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key not configured');

  const systemContent = options.system || '';
  const groqMessages = [];

  if (systemContent) {
    groqMessages.push({ role: 'system', content: systemContent });
  }

  groqMessages.push(...messages.map(m => ({
    role: m.role,
    content: m.content
  })));

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages,
      max_tokens: options.max_tokens || 4096
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Groq error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Check if error is credit/billing related
 */
function isCreditError(error) {
  const msg = error.message?.toLowerCase() || '';
  return (
    msg.includes('credit') ||
    msg.includes('billing') ||
    msg.includes('insufficient') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    error.status === 402 ||
    error.status === 429
  );
}

/**
 * Notify about failover via LINE
 */
async function notifyFailover(fromProvider, toProvider, reason) {
  // Check cooldown
  if (lastFailoverTime && Date.now() - lastFailoverTime < FAILOVER_NOTIFY_COOLDOWN) {
    console.log('[CLAUDE] Failover notification skipped (cooldown)');
    return;
  }

  const message = `⚠️ **AI Provider Switched**

❌ ${fromProvider.toUpperCase()} ไม่พร้อมใช้งาน
Reason: ${reason}

✅ กำลังใช้ **${toProvider.toUpperCase()}** แทน

${toProvider === 'openai' ? '🤖 ตอนนี้ใช้ ChatGPT (GPT-4o)' : '⚡ ตอนนี้ใช้ Groq (Llama)'}

${isCreditError({ message: reason }) ? '\n💳 **Token หมดแล้ว!** กรุณาเติม credit ที่ console.anthropic.com' : ''}`;

  console.log('[CLAUDE] Sending failover notification:', message.substring(0, 100));

  if (notifyCallback) {
    try {
      await notifyCallback(message);
      failoverNotified = true;
      lastFailoverTime = Date.now();
    } catch (e) {
      console.error('[CLAUDE] Failed to send failover notification:', e.message);
    }
  }
}

/**
 * Send a chat message with automatic failover
 * @param {Array} messages - Array of {role, content} objects
 * @param {Object} options - Additional options (system prompt, etc.)
 * @returns {string} - AI response
 */
async function chat(messages, options = {}) {
  const providers = ['anthropic', 'openai', 'groq'];
  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`[CLAUDE] Trying provider: ${provider}`);

      let response;
      switch (provider) {
        case 'anthropic':
          response = await sendToAnthropic(messages, options);
          break;
        case 'openai':
          response = await sendToOpenAI(messages, options);
          break;
        case 'groq':
          response = await sendToGroq(messages, options);
          break;
      }

      // Success!
      if (currentProvider !== provider) {
        console.log(`[CLAUDE] Failover: ${currentProvider} -> ${provider}`);

        // Notify about failover
        if (provider !== 'anthropic' && currentProvider === 'anthropic') {
          await notifyFailover('anthropic', provider, lastError?.message || 'Unknown error');
        }

        currentProvider = provider;
      }

      return response;

    } catch (error) {
      console.error(`[CLAUDE] Provider ${provider} failed:`, error.message);
      lastError = error;

      // Check if it's a configuration error (skip to next)
      if (error.message.includes('not configured')) {
        continue;
      }

      // For credit errors, skip Anthropic immediately
      if (provider === 'anthropic' && isCreditError(error)) {
        console.log('[CLAUDE] Credit error detected, switching to backup provider');
        continue;
      }
    }
  }

  // All providers failed
  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
}

/**
 * Think and decide what action to take
 */
async function think(situation, options = []) {
  const prompt = `
สถานการณ์: ${situation}

ตัวเลือกที่มี:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

คิดวิเคราะห์และเลือกตัวเลือกที่ดีที่สุด พร้อมเหตุผล
ตอบในรูปแบบ JSON: { "choice": <number>, "reasoning": "<explanation>", "action": "<specific action to take>" }
`;

  const response = await chat([{ role: 'user', content: prompt }], {
    system: 'คุณเป็น Oracle Agent ที่ต้องตัดสินใจอย่างฉลาดเพื่อประโยชน์ของธุรกิจ Best Hotel Pai'
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[CLAUDE] Failed to parse decision:', e);
  }

  return { choice: 0, reasoning: response, action: 'none' };
}

/**
 * Generate a summary or report
 */
async function generateReport(type, data) {
  const prompts = {
    morning: `สร้าง Morning Briefing สำหรับ Tars จากข้อมูลนี้:
${JSON.stringify(data, null, 2)}

รูปแบบ:
- เริ่มด้วย emoji และทักทาย
- สรุป Gold, BTC, Fear & Greed (ถ้ามี)
- สรุป bookings วันนี้
- สิ่งที่ต้องสนใจ
- กระชับ อ่านง่าย`,

    evening: `สร้าง Evening Summary สำหรับ Tars จากข้อมูลนี้:
${JSON.stringify(data, null, 2)}

รูปแบบ:
- สรุปสิ่งที่เกิดขึ้นวันนี้
- Conversations ที่มี
- Actions ที่ทำไป
- สิ่งที่ต้องติดตามพรุ่งนี้`,

    weekly: `สร้าง Weekly Rank Report จากข้อมูลนี้:
${JSON.stringify(data, null, 2)}

รูปแบบ:
- สรุป ranking แต่ละที่พัก
- เปรียบเทียบกับสัปดาห์ก่อน
- วิเคราะห์สาเหตุการเปลี่ยนแปลง
- แนะนำ actions`
  };

  return chat([{ role: 'user', content: prompts[type] || prompts.morning }], {
    system: 'คุณเป็น Oracle Agent สร้าง report ที่กระชับ ชัดเจน เป็นประโยชน์'
  });
}

// Export client for legacy compatibility
const client = anthropic;

export { chat, think, generateReport, setNotifyCallback, getProviderStatus, client };
export default { chat, think, generateReport, setNotifyCallback, getProviderStatus, client };
