/**
 * Email Nurture Engine — SEO Audit Lead Follow-up
 *
 * Day 0: ใช้ outreach email logic 100% — AI generate 5 Action Steps + screenshot + PDF
 * Day 2: Deep-dive ปัญหา + วิธีแก้ Action Plan
 * Day 5: 5 เทคนิค SEO ทำเองได้ + service page link
 * Day 8: Case study จริง + CTA นัดคุย
 *
 * Cost: Day 0 = Haiku API call (~$0.001) | Day 2-8 = $0 (template)
 * Created: 2026-02-25
 */

import { loadLeads, saveLeads, saveLead } from './db-leads.js';
import { getAudit } from './seo-audit.js';
import { randomUUID } from 'crypto';

// Day 0 uses the EXACT same outreach email logic as lead-finder
let sendOutreachEmail = null; // set via setSendOutreachEmail()

let gmailClient = null;
const BASE_URL = 'https://oracle-agent-production-546e.up.railway.app';
const DAILY_CAP = 20;
let sentToday = 0;
let lastResetDate = '';

// Schedule: [step, daysAfterPrevious]
const SCHEDULE = [
  [1, 0],  // Day 0: immediate
  [2, 2],  // Day 2
  [3, 3],  // Day 5 (3 days after step 2)
  [4, 3],  // Day 8 (3 days after step 3)
];

function setGmailClient(client) {
  gmailClient = client;
}

function setSendOutreachEmail(fn) {
  sendOutreachEmail = fn;
}

function resetDailyCounter() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastResetDate !== today) {
    sentToday = 0;
    lastResetDate = today;
  }
}

// ==================== EMAIL TEMPLATES ====================
// VXB Professional Template — ตาม email-marketing.md + vxb-voice.md
// Template: Gradient bar + Action Plan boxes + CTA + Full Signature
// Voice: มั่นใจ ตรง ให้ผลงานพูดแทน เขียนเหมือน Tar คุยกับลูกค้า

function buildSignature() {
  return `
  <table style="margin-top:32px;border-top:1px solid #eee;padding-top:20px;width:100%;">
    <tr>
      <td style="padding-right:16px;vertical-align:top;">
        <div style="width:4px;height:60px;background:linear-gradient(180deg,#eb3f43,#6e49f3);border-radius:2px;"></div>
      </td>
      <td style="font-size:13px;color:#666;line-height:1.7;">
        <strong style="color:#1b1c1b;font-size:15px;">Tanakit Chaithip (ต้าร์)</strong><br>
        Founder & Creative Director — <span style="color:#eb3f43;font-weight:bold;">VisionXBrain</span><br>
        บริษัท วิสัยทัศน์ เอ็กซ์ เบรน จำกัด<br>
        80+ ลูกค้า 6 ประเทศ | Clutch 5.0<br>
        <a href="tel:0971536565" style="color:#1b1c1b;text-decoration:none;font-weight:bold;">097-153-6565</a> — โทรปรึกษาฟรีครับ<br>
        <a href="https://www.visionxbrain.com" style="color:#eb3f43;text-decoration:none;">www.visionxbrain.com</a>
      </td>
    </tr>
  </table>`;
}

function wrapEmail(content, trackingId) {
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;color:#1b1c1b;line-height:1.8;background:#fff;padding:0 20px;">
  <div style="height:3px;background:linear-gradient(90deg,#eb3f43,#6e49f3);border-radius:2px;margin-bottom:28px;"></div>
  ${content}
  ${buildSignature()}
  <img src="${BASE_URL}/api/email/track/${trackingId}.png" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" alt="">
  <p style="color:#bbb;font-size:11px;margin-top:24px;text-align:center;">ไม่ต้องการรับ email จากเรา? ตอบกลับว่า "ยกเลิก" ได้เลยครับ</p>
</div>`;
}

function ctaButton(text, href) {
  return `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#eb3f43,#d63337);color:#fff;padding:14px 36px;border-radius:100px;text-decoration:none;font-size:15px;font-weight:bold;box-shadow:0 4px 12px rgba(235,63,67,0.3);">${text}</a>`;
}

function actionBox(title, impact, detail) {
  return `
  <div style="background:#fafafa;border-left:4px solid #eb3f43;padding:16px 20px;margin:14px 0;border-radius:0 8px 8px 0;">
    <strong style="color:#1b1c1b;font-size:15px;">${title}</strong>
    ${impact ? `<p style="margin:6px 0 4px;color:#eb3f43;font-weight:bold;font-size:14px;">${impact}</p>` : ''}
    <p style="margin:4px 0 0;font-size:14px;color:#444;line-height:1.7;">${detail}</p>
  </div>`;
}

function buildDay0(lead, audit) {
  const biz = audit?.businessName || lead.businessName || lead.domain;
  const score = audit?.score || lead.websiteScore || '?';
  const grade = audit?.grade || '';
  const reportUrl = lead.auditId ? `${BASE_URL}/tools/seo-audit/report/${lead.auditId}` : `${BASE_URL}/tools/seo-audit/`;
  const topIssues = (lead.websiteIssues || []).slice(0, 3);

  const issuesHtml = topIssues.length > 0
    ? topIssues.map((issue, i) => actionBox(
        `ปัญหาที่ ${i + 1}: ${issue}`,
        null,
        'ปัญหานี้ส่งผลโดยตรงต่ออันดับ Google — ยิ่งแก้เร็ว ยิ่งกลับมาติดอันดับเร็ว'
      )).join('')
    : '';

  const scoreColor = score >= 70 ? '#027a48' : score >= 50 ? '#b54708' : '#b42318';

  const subject = `ผลตรวจ SEO ของ ${biz} — Score ${score}/100`;
  const content = `
    <p style="font-size:16px;">สวัสดีครับ</p>
    <p>ผมตรวจ SEO เว็บไซต์ <strong>${biz}</strong> เสร็จแล้วครับ สรุปสั้นๆ ก่อน:</p>

    <div style="background:#f7f7f7;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
      <div style="font-size:48px;font-weight:bold;color:${scoreColor};">${score}<span style="font-size:20px;color:#666;">/100</span></div>
      <div style="color:#666;font-size:14px;margin-top:4px;">เกรด ${grade}</div>
    </div>

    <p>คะแนนนี้หมายความว่า Google ยังไม่เห็นเว็บคุณอย่างที่ควรจะเป็น ลูกค้าที่ค้นหาสินค้า/บริการของคุณตอนนี้ ส่วนใหญ่ไปเจอคู่แข่งก่อน</p>

    ${issuesHtml ? `<p style="font-size:15px;"><strong>ปัญหาหลักที่พบ:</strong></p>${issuesHtml}` : ''}

    <p>ทุกข้อมีคำแนะนำวิธีแก้ไขเป็นภาษาไทย — ดูรายงานเต็มได้เลยครับ</p>

    <div style="text-align:center;margin:28px 0;">
      ${ctaButton('ดูรายงานเต็ม + วิธีแก้ไข', reportUrl)}
    </div>

    <p style="font-size:14px;color:#666;">มีคำถามอะไร ตอบกลับ email นี้ได้เลยครับ ผมตอบเองทุกข้อความ ไม่มีข้อผูกมัดใดๆ</p>
  `;

  return { subject, html: content };
}

function buildDay2(lead, audit) {
  const biz = audit?.businessName || lead.businessName || lead.domain;
  const score = audit?.score || lead.websiteScore || '?';
  const grade = audit?.grade || '';
  const reportUrl = lead.auditId ? `${BASE_URL}/tools/seo-audit/report/${lead.auditId}` : `${BASE_URL}/tools/seo-audit/`;
  const topIssues = (lead.websiteIssues || []).slice(0, 3);

  // สร้าง action boxes แบบ deep-dive — อธิบายจริงๆ ว่าทำไมถึงสำคัญ + วิธีแก้
  const issueBoxes = topIssues.map((issue, i) => {
    const explanations = {
      'ไม่พบ Meta Description': {
        impact: 'Google แสดงข้อความมั่วๆ แทน — CTR ตก 30-50%',
        detail: 'Meta Description คือข้อความที่โชว์ใต้ชื่อเว็บใน Google เปรียบเหมือน ad copy ฟรี ถ้าไม่ใส่ Google จะดึงข้อความจากหน้าเว็บมาแสดงแทน ซึ่งมักจะอ่านไม่รู้เรื่อง วิธีแก้: เขียน 155 ตัวอักษร ใส่ keyword หลัก + benefit + CTA'
      },
      'ไม่พบ H1 Tag': {
        impact: 'Google ไม่รู้ว่าหน้านี้เกี่ยวกับอะไร',
        detail: 'H1 คือ "หัวข้อหลัก" ของหน้า — Google ใช้ H1 เป็นตัวตัดสินว่าจะ rank หน้านี้สำหรับ keyword อะไร ไม่มี H1 = เสียโอกาสติดอันดับ วิธีแก้: ใส่ H1 ที่มี keyword หลัก 1 ตัว ต่อหน้า'
      },
    };
    const match = explanations[issue];
    return actionBox(
      `Step ${i + 1}: แก้ ${issue}`,
      match ? `Impact: ${match.impact}` : 'Impact: ส่งผลต่ออันดับ Google โดยตรง',
      match ? match.detail : `ปัญหานี้ทำให้ Google ไม่เข้าใจเนื้อหาเว็บ ส่งผลให้คู่แข่งที่แก้แล้วขึ้นอันดับแทน แก้ได้ไม่ยากครับ ดูวิธีแก้ละเอียดในรายงาน`
    );
  }).join('');

  const subject = `${biz} — 3 จุดที่ต้องแก้ก่อน ถ้าอยากขึ้นหน้าแรก Google`;
  const content = `
    <p style="font-size:16px;">สวัสดีครับ</p>
    <p>เมื่อ 2 วันก่อนผมตรวจ SEO ให้ <strong>${biz}</strong> ได้ ${score}/100 (${grade})</p>

    <p>วันนี้ขอลงรายละเอียดว่า <strong>ทำไมปัญหาเหล่านี้ถึงสำคัญ</strong> + วิธีแก้เบื้องต้นครับ:</p>

    ${issueBoxes || actionBox('เว็บมีจุดที่ต้องปรับปรุง', 'Impact: ส่งผลต่ออันดับ Google', 'ดูรายละเอียดทั้งหมดในรายงานครับ — มีคำแนะนำวิธีแก้ทุกข้อ')}

    <p>ทุกข้อข้างบนแก้ได้ด้วยตัวเอง ไม่ต้องเขียนโค้ด ดูวิธีแก้ละเอียดในรายงานครับ</p>

    <div style="text-align:center;margin:28px 0;">
      ${ctaButton('ดูวิธีแก้ทั้งหมด', reportUrl)}
    </div>

    <p style="font-size:14px;color:#666;">ตอบกลับ email นี้ได้เลยครับ ผมยินดีอธิบายเพิ่มเติมทุกข้อ</p>
  `;

  return { subject, html: content };
}

function buildDay5(lead) {
  const biz = lead.businessName || lead.domain;
  const subject = `Action Plan สำหรับ ${biz} — 5 ขั้นตอนที่ทำเองได้เลยวันนี้`;
  const content = `
    <p style="font-size:16px;">สวัสดีครับ</p>
    <p>หลังจากวิเคราะห์เว็บ <strong>${biz}</strong> ผมสรุป Action Plan 5 ขั้นตอนที่ทำเองได้เลย ไม่ต้องจ้างใคร ไม่ต้องเขียนโค้ดครับ:</p>

    ${actionBox(
      'Step 1: ปรับ Title Tag ทุกหน้า',
      'Impact: เพิ่ม CTR จาก Google 20-30%',
      'Title คือสิ่งแรกที่ Google + คนอ่านเห็น ใส่ keyword ที่ลูกค้าค้นหาจริง + ชื่อแบรนด์ ภายใน 60 ตัวอักษร ตัวอย่าง: "รับทำเว็บไซต์ Webflow | VisionXBrain" ไม่ใช่ "หน้าแรก | บริษัทเอบีซี"'
    )}

    ${actionBox(
      'Step 2: เขียน Meta Description ให้น่าคลิก',
      'Impact: ลูกค้าเห็นแล้วอยากคลิก แทนที่จะเลื่อนผ่าน',
      'เขียน 155 ตัวอักษร ขึ้นต้นด้วยปัญหาของลูกค้า ตามด้วย solution + ตัวเลข social proof + CTA เช่น "เว็บโหลดช้าเสีย SEO? Webflow โหลดไว 0.9 วิ Core Web Vitals 90+ ผลงาน 80+ ลูกค้า ปรึกษาฟรี"'
    )}

    ${actionBox(
      'Step 3: เพิ่ม Schema Markup (Structured Data)',
      'Impact: ได้ Rich Snippets ใน Google + ติด AI Search (ChatGPT, Gemini)',
      'Schema บอก Google ว่าเว็บคุณเป็นอะไร — ธุรกิจ, บริการ, FAQ, รีวิว ฯลฯ เว็บที่มี Schema มีโอกาสแสดง rich results สูงกว่า 2-3 เท่า และ AI search engines ดึงข้อมูลจาก Schema โดยตรง ใช้ Google Rich Results Test เช็คได้ฟรี'
    )}

    ${actionBox(
      'Step 4: สร้าง Internal Links อย่างน้อย 3 ลิงก์ต่อหน้า',
      'Impact: Google crawl ทั่วเว็บ + กระจาย authority',
      'ลิงก์ภายในช่วยให้ Google เข้าใจโครงสร้างเว็บ ว่าหน้าไหนสำคัญ หน้าไหนเกี่ยวข้องกัน ทุกหน้าควรมีลิงก์ไปหน้าบริการหลัก + บล็อกที่เกี่ยวข้อง anchor text ต้องเป็น keyword ไม่ใช่ "คลิกที่นี่"'
    )}

    ${actionBox(
      'Step 5: โพสต์ Google Business Profile ทุกสัปดาห์',
      'Impact: ขึ้นอันดับ Local Search + Google Maps',
      'คนส่วนใหญ่ไม่รู้ว่า Google Business มี "โพสต์" ได้เหมือน Social Media ธุรกิจที่โพสต์สม่ำเสมอ Google จะมองว่า active → เพิ่มโอกาสขึ้น Map Pack (3 อันดับแรกบน Maps) โพสต์โปรโมชั่น, ผลงาน, หรือ tips สัปดาห์ละครั้งก็พอ'
    )}

    <p>ทั้ง 5 ข้อทำเองได้เลยวันนี้ ไม่ต้องใช้เงิน ไม่ต้องเขียนโค้ด</p>

    <p>แต่ถ้าอยากให้ช่วยจัดการทั้งหมด ตอบกลับ email นี้ หรือโทร <strong>097-153-6565</strong> ได้เลยครับ ปรึกษาฟรี เราดูแลลูกค้ากว่า 80 รายใน 6 ประเทศ</p>

    <div style="background:#f8f7f5;border-radius:12px;padding:18px 24px;margin:24px 0;">
      <p style="margin:0 0 4px;font-size:14px;color:#666;">บริการที่เกี่ยวข้องกับธุรกิจของคุณครับ:</p>
      <p style="margin:0;font-size:14px;">
        <a href="https://www.visionxbrain.com/services/seo" style="color:#eb3f43;text-decoration:none;font-weight:bold;">www.visionxbrain.com/services/seo</a>
      </p>
    </div>
  `;

  return { subject, html: content };
}

function buildDay8(lead) {
  const biz = lead.businessName || lead.domain;
  const score = lead.websiteScore || '?';
  const subject = `Case Study จริง — ธุรกิจท่องเที่ยวจาก page 5 ขึ้น page 1 ใน 3 เดือน`;
  const content = `
    <p style="font-size:16px;">สวัสดีครับ</p>
    <p>นี่เป็น email สุดท้ายในซีรีส์ครับ วันนี้อยากแชร์ case study จริง ไม่ใช่ตัวเลขแต่ง เป็นผลลัพธ์ที่วัดได้จาก Google Analytics:</p>

    <div style="background:#f7f7f7;border-radius:12px;padding:24px;margin:20px 0;">
      <p style="margin:0 0 12px;font-size:17px;font-weight:bold;color:#1b1c1b;">ลูกค้า: ธุรกิจท่องเที่ยว — Keystone Property</p>

      ${actionBox('Organic Traffic', '+312% ใน 90 วัน', 'จาก 800 visitors/เดือน เป็น 3,300+ visitors/เดือน โดยไม่ได้ยิงแอดสักบาท ทั้งหมดมาจาก Google organic')}

      ${actionBox('Keywords หน้าแรก Google', '47 คำ ติด Top 10', 'จากเดิมไม่มี keyword ใดติด top 10 เลย ตอนนี้ 47 คำค้นหาอยู่หน้าแรก Google ทั้งภาษาไทยและอังกฤษ')}

      ${actionBox('สิ่งที่ทำ', 'ระยะเวลา 3 เดือน', 'ปรับ on-page SEO ทุกหน้า (Title, Meta, H1, Schema) + เขียน content ใหม่ตาม keyword research + สร้าง internal linking ทั้งเว็บ + แก้ technical issues (ความเร็ว, mobile, Core Web Vitals)')}
    </div>

    <p>เว็บ <strong>${biz}</strong> ตอนนี้ได้ score ${score}/100 — เห็นโอกาสปรับขึ้นได้อีกมากครับ ปัญหาที่พบส่วนใหญ่คล้ายกับ case นี้ก่อนเริ่มทำ</p>

    <p>ผมไม่ได้รับทุกงาน รับเฉพาะที่เชื่อว่าจะเห็นผลจริง ถ้าสนใจให้ช่วยวิเคราะห์เชิงลึก ปรึกษาฟรีครับ ไม่มีข้อผูกมัด</p>

    <div style="text-align:center;margin:28px 0;">
      ${ctaButton('นัดคุยฟรี 30 นาที', 'mailto:info@visionxbrain.com?subject=' + encodeURIComponent(`สนใจบริการ SEO — ${biz}`))}
      <div style="margin-top:12px;">
        <a href="tel:0971536565" style="display:inline-block;background:#fff;color:#eb3f43;padding:12px 32px;border-radius:100px;text-decoration:none;font-size:15px;font-weight:bold;border:2px solid #eb3f43;">โทร 097-153-6565</a>
      </div>
      <p style="color:#999;font-size:13px;margin-top:10px;">หรือตอบกลับ email นี้ได้เลยครับ</p>
    </div>

    <p style="font-size:14px;color:#666;">นี่เป็น email สุดท้ายในซีรีส์ครับ ตอบกลับได้ทุกเมื่อ ผมตอบเองทุกข้อความ</p>
  `;

  return { subject, html: content };
}

// Day 0 uses outreach email (not template) — BUILDERS สำหรับ Day 2-8 เท่านั้น
const BUILDERS = [null, null, buildDay2, buildDay5, buildDay8];

// ==================== DAY-0 IMMEDIATE SEND ====================
// ใช้ outreach email logic 100% — เหมือน Mediqueen Clinic email เป๊ะ
// AI generate 5 Action Steps + screenshot + PDF + VXB template

async function sendDay0(lead, audit) {
  if (!lead.email) return;

  // ต้องมี sendOutreachEmail — ถ้าไม่มี fallback ไม่ส่ง
  if (!sendOutreachEmail) {
    console.error('[NURTURE] Day-0 skipped: sendOutreachEmail not configured');
    return;
  }

  try {
    // Guard: เช็คว่า email นี้เคยถูกส่ง cold outreach ไปแล้วหรือยัง
    // ป้องกัน duplicate — ลูกค้าที่ได้ cold email แล้วคลิก "ดู Report" → กรอก email ใน Clairify
    const leadsData = await loadLeads();
    const existingLead = leadsData.leads.find(l =>
      l.email === lead.email && l.emailSentAt && l.source !== 'seo-audit'
    );
    if (existingLead) {
      console.log(`[NURTURE] Day-0 skipped: ${lead.email} already received cold outreach (${existingLead.emailSentAt})`);
      return;
    }

    // Guard: เช็คว่า email นี้เคยได้ nurture Day-0 ไปแล้วหรือยัง (audit ซ้ำ)
    const existingNurture = leadsData.leads.find(l =>
      l.email === lead.email && l.nurture && l.nurture.step >= 1
    );
    if (existingNurture) {
      console.log(`[NURTURE] Day-0 skipped: ${lead.email} already in nurture sequence (step ${existingNurture.nurture.step})`);
      return;
    }

    // สร้าง lead object แบบที่ outreach system ต้องการ
    const outreachLead = {
      email: lead.email,
      businessName: audit?.businessName || lead.businessName || lead.domain,
      businessNameEn: lead.businessNameEn || '',
      domain: lead.domain,
      type: lead.type || lead.industry || '',
      websiteIssues: lead.websiteIssues || [],
      hasWebsite: true, // เขาเพิ่ง audit เว็บ = มีเว็บแน่นอน
      place_id: lead.place_id || `audit_${Date.now()}`,
    };

    // Verify email ก่อนส่ง Day-0 — ป้องกัน bounce จาก email ปลอมใน audit form
    try {
      const { verifyEmail, isConfigured: isEmailVerifyConfigured } = await import('./email-verifier.js');
      if (isEmailVerifyConfigured()) {
        const check = await verifyEmail(lead.email);
        if (!check.valid) {
          console.log(`[NURTURE] Day-0 ⛔ Skip ${lead.email} — failed verification: ${check.status}`);
          return;
        }
      }
    } catch (verifyErr) {
      console.error('[NURTURE] Day-0 verify error (blocking send):', verifyErr.message);
      return;
    }

    console.log(`[NURTURE] Day-0 sending outreach email: ${lead.email} (${lead.domain})`);

    const result = await sendOutreachEmail(outreachLead);

    if (!result || !result.success) {
      console.error(`[NURTURE] Day-0 outreach failed: ${result?.error || 'unknown'}`);
      return;
    }

    // Initialize nurture state on lead + save
    lead.nurture = {
      step: 1,
      history: [{
        step: 1,
        sentAt: new Date().toISOString(),
        trackingId: result.trackingId || randomUUID(),
        subject: result.subject,
      }],
      nextSendAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      unsubscribed: false,
      completedAt: null,
    };
    await saveLead(lead);

    console.log(`[NURTURE] Day-0 sent (outreach): ${lead.email} (${lead.domain}) — ${result.subject}`);
  } catch (e) {
    console.error(`[NURTURE] Day-0 error: ${lead.email}:`, e.message);
  }
}

// ==================== DAILY QUEUE PROCESSOR ====================

async function processNurtureQueue() {
  if (!gmailClient) return { sent: 0, skipped: 0, error: 'Gmail not configured' };

  resetDailyCounter();
  const results = { sent: 0, skipped: 0, errors: 0 };
  const now = Date.now();

  try {
    const leadsData = await loadLeads();
    let changed = false;

    for (const lead of leadsData.leads) {
      if (sentToday >= DAILY_CAP) break;
      if (lead.source !== 'seo-audit') continue;
      if (!lead.email) continue;
      if (!lead.nurture) continue;
      if (lead.nurture.unsubscribed) continue;
      if (lead.nurture.step >= 4) continue;
      // หยุด nurture ถ้า lead ตอบแล้วหรือปิดไปแล้ว
      if (['replied', 'closed', 'audit_sent'].includes(lead.status)) continue;

      // Check if it's time for next email
      const nextSendAt = lead.nurture.nextSendAt ? new Date(lead.nurture.nextSendAt).getTime() : 0;
      if (now < nextSendAt) {
        results.skipped++;
        continue;
      }

      const nextStep = lead.nurture.step + 1;
      const builder = BUILDERS[nextStep];
      if (!builder) continue;

      try {
        // Load audit data for context
        let audit = null;
        if (lead.auditId) {
          audit = getAudit(lead.auditId);
        }

        // Verify email ก่อนส่ง — ป้องกัน bounce
        try {
          const { verifyEmail, isConfigured: isEmailVerifyConfigured } = await import('./email-verifier.js');
          if (isEmailVerifyConfigured()) {
            const check = await verifyEmail(lead.email);
            if (!check.valid) {
              console.log(`[NURTURE] ⛔ Skip ${lead.email} — failed verification: ${check.status}`);
              continue;
            }
          }
        } catch (verifyErr) {
          console.error('[NURTURE] Verify error (blocking send):', verifyErr.message);
          continue;
        }

        const trackingId = randomUUID();
        const { subject, html } = builder(lead, audit);
        const fullHtml = wrapEmail(html, trackingId);

        await gmailClient.send({
          to: lead.email,
          subject,
          body: fullHtml,
        });

        // Update nurture state
        lead.nurture.step = nextStep;
        lead.nurture.history.push({ step: nextStep, sentAt: new Date().toISOString(), trackingId });

        // Schedule next or mark complete
        const nextSchedule = SCHEDULE.find(s => s[0] === nextStep + 1);
        if (nextSchedule) {
          lead.nurture.nextSendAt = new Date(now + nextSchedule[1] * 24 * 60 * 60 * 1000).toISOString();
        } else {
          lead.nurture.completedAt = new Date().toISOString();
        }

        changed = true;
        sentToday++;
        results.sent++;

        console.log(`[NURTURE] Step ${nextStep} sent: ${lead.email} (${lead.domain})`);

        // 3s delay between sends
        await new Promise(r => setTimeout(r, 3000));
      } catch (e) {
        console.error(`[NURTURE] Error sending step ${nextStep} to ${lead.email}:`, e.message);
        results.errors++;
      }
    }

    if (changed) {
      await saveLeads(leadsData);
    }
  } catch (e) {
    console.error('[NURTURE] Queue error:', e.message);
    results.errors++;
  }

  return results;
}

// ==================== UNSUBSCRIBE ====================

async function unsubscribe(email) {
  try {
    const leadsData = await loadLeads();
    const lead = leadsData.leads.find(l => l.email === email && l.source === 'seo-audit');
    if (lead && lead.nurture) {
      lead.nurture.unsubscribed = true;
      lead.nurture.completedAt = new Date().toISOString();
      await saveLeads(leadsData);
      await saveLead(lead);
      console.log(`[NURTURE] Unsubscribed: ${email}`);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[NURTURE] Unsubscribe error:', e.message);
    return false;
  }
}

// ==================== STATS ====================

async function getStats() {
  try {
    const leadsData = await loadLeads();
    const auditLeads = leadsData.leads.filter(l => l.source === 'seo-audit' && l.email);
    let waiting = 0, inProgress = 0, completed = 0, unsubscribed = 0;

    for (const l of auditLeads) {
      if (!l.nurture) { waiting++; continue; }
      if (l.nurture.unsubscribed) { unsubscribed++; continue; }
      if (l.nurture.completedAt) { completed++; continue; }
      inProgress++;
    }

    return { total: auditLeads.length, waiting, inProgress, completed, unsubscribed, sentToday };
  } catch {
    return { total: 0, waiting: 0, inProgress: 0, completed: 0, unsubscribed: 0, sentToday: 0 };
  }
}

export default { sendDay0, processNurtureQueue, unsubscribe, getStats, setGmailClient, setSendOutreachEmail };
export { sendDay0, processNurtureQueue, unsubscribe, getStats, setGmailClient, setSendOutreachEmail };
