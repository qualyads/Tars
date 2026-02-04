/**
 * Claude API Wrapper
 * Handles communication with Anthropic's Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../config.json');

// Initialize client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Send a chat message to Claude
 * @param {Array} messages - Array of {role, content} objects
 * @param {Object} options - Additional options (system prompt, etc.)
 * @returns {string} - Claude's response
 */
async function chat(messages, options = {}) {
  try {
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
  } catch (error) {
    console.error('[CLAUDE] API Error:', error.message);
    throw error;
  }
}

/**
 * Think and decide what action to take
 * @param {string} situation - Current situation description
 * @param {Array} options - Available actions
 * @returns {Object} - Decision and reasoning
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
    // Extract JSON from response
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
 * @param {string} type - Type of report (morning, evening, weekly)
 * @param {Object} data - Data to summarize
 * @returns {string} - Formatted report
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

export { chat, think, generateReport };
export default { chat, think, generateReport };
