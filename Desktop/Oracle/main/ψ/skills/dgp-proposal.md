# Skill: DGP Proposal Email — Digital Growth Partner

> หลังโทรคุยกับลูกค้าแล้ว → ใช้ skill นี้สร้าง + ส่ง proposal email อัตโนมัติ
> แยกจากระบบ cold email (lead finder) โดยสิ้นเชิง
> ใช้คู่กับ: `vxb-voice.md` + `cro-copywriting.md`

---

## API Endpoints (Standalone — ไม่ผูก lead finder)

### 1. Generate Proposal
```
POST /api/dgp/generate
Body: {
  "bizName": "Duke Language School",          // ชื่อธุรกิจ (required)
  "industry": "โรงเรียนสอนภาษาไทย",          // ประเภทธุรกิจ
  "domain": "dukelanguage.com",               // เว็บไซต์
  "email": "min.i@dukelanguage.com",          // email ที่จะส่ง
  "context": "ตามที่คุยกัน เน้น ED Visa..."   // บริบทจากที่โทรคุย
}
Response: { subject, htmlPreview, customParts, trackingId }
```

### 2. Send Proposal
```
POST /api/dgp/send
Body: {
  "bizName": "Duke Language School",
  "email": "min.i@dukelanguage.com",
  "subject": "...",
  "customParts": { subject, opening, problemROI, landingPageDesc, seoAutopilotDesc, recommendation },
  "industry": "...",
  "domain": "..."
}
Response: { success, to, subject, trackingId, bizName, attachment }
```

### 3. Check Sent History
```
GET /api/dgp/sent
Response: [ { bizName, email, subject, trackingId, sentAt, industry, domain } ]
```

### Duplicate Protection
- generate + send ทั้ง 2 endpoint เช็ค `dgp-sent.json` ก่อน
- ถ้าส่งแล้ว (same email + bizName) → return 409 `alreadySent: true`
- ป้องกันส่งซ้ำ

---

## AI Generate — 6 Custom Parts

AI (Claude) generate 6 ส่วนจาก context ที่ให้:

| # | Field | คืออะไร |
|---|-------|---------|
| 1 | `subject` | หัวข้อ email — ต้องมีชื่อธุรกิจ ห้าม emoji |
| 2 | `opening` | 1 paragraph เปิดเรื่อง อ้างอิงการคุย |
| 3 | `problemROI` | 2 paragraphs — ปัญหา/โอกาส + ROI คำนวณ |
| 4 | `landingPageDesc` | 2 paragraphs — Landing Page CRO ปรับตาม industry |
| 5 | `seoAutopilotDesc` | 3 paragraphs — SEO Autopilot + bridge |
| 6 | `recommendation` | 1 paragraph — แนะนำแพ็คไหน เหตุผลจาก target |

**ส่วนที่ Fixed (ไม่เปลี่ยน):**
- Pricing Cards 3 แพ็ค (DGP_PRICING_HTML)
- โปรโมชั่น + ไม่ผูกมัด (DGP_PROMO_HTML)
- CTA ปุ่มคู่ (DGP_CTA_HTML)
- Signature VXB (DGP_SIGNATURE_HTML)

---

## Template Structure

```
1. Gradient bar แดง-ม่วง (3px)
2. "สวัสดีครับ"
3. [opening] — เปิดเรื่อง
4. [problemROI] — ปัญหา + ROI
5. Section 1: Landing Page CRO (border-left แดง) + [landingPageDesc]
6. Section 2: VXB SEO Autopilot (border-left ม่วง) + [seoAutopilotDesc]
7. Pricing Cards 3 แพ็ค ← FIXED
8. โปรโมชั่น + ไม่ผูกมัด ← FIXED
9. [recommendation]
10. CTA ปุ่มคู่ ← FIXED
11. Signature VXB ← FIXED
12. Tracking pixel (invisible)
```

---

## Pricing Model (Fixed — ห้ามเปลี่ยน)

| แพ็ค | ภาษา | Setup (ปกติ → โปร) | รายเดือน (ปกติ → โปร) |
|------|------|--------------------|-----------------------|
| Basic | TH + EN | 33,000 → **19,900** | 20,000 → **9,900** |
| Growth | TH+EN+CN | 41,000 → **25,900** | 25,000 → **12,900** |
| Full | TH+EN+CN+JP | 49,000 → **29,900** | 30,000 → **15,900** |

**ค่าเพิ่ม:**
- Hosting: ~700-800 บาท/เดือน (จ่ายตรง Webflow)
- ระบบภาษาเพิ่ม: 350 บาท/เดือน (จ่ายตรง Webflow)

---

## Voice Rules (กฎเหล็ก)

```
✅ ทำ:
- เขียนเหมือน Tar คุยกับลูกค้าตัวต่อตัว
- มั่นใจ แต่ไม่ตะโกน
- ตรง แต่ไม่หยาบ
- ให้ผลงานและตัวเลขพูดแทน พูดครั้งเดียวให้ชัด
- ประโยคสั้นยาวสลับ อ่านแล้วเหมือนคนพิมพ์
- ใช้ "ผม" "คุณ" "ครับ"

❌ ห้าม:
- emoji
- ตะโกน (!!!) / "ด่วน" "ก่อนสาย" "รีบ"
- ซ้ำตัวเลข/คำเดิมหลายจุด
- คำ AI: crucial, leverage, landscape, ข้อเสนอแนะ
- เขียนเหมือน ad copy / brochure / copywriter AI
- อ้างเคสลูกค้าอื่น (SiamTak, Keystone, Prime Host)
- มั่วข้อมูลเว็บลูกค้าที่ไม่ได้เช็คจริง
- claim เกินจริง
```

---

## กฎห้ามมั่ว — สำคัญมาก!

```
- ห้ามอ้างข้อมูลเว็บลูกค้าที่ไม่ได้อยู่ใน context
  (จำนวน blog, ranking, จำนวนหน้า, speed score)
- ถ้า context ไม่ได้บอก → ห้ามแต่งขึ้นมาเอง
- ใช้เหตุผล industry-level ที่เป็นจริงเสมอ:
  ✅ "ธุรกิจ X ส่วนใหญ่ยังพึ่ง walk-in/referral"
  ✅ "คนค้นหาบริการแบบนี้บน Google เยอะ"
  ❌ "เว็บคุณมี blog แค่ 4 โพสต์" (ไม่ได้เช็คจริง!)
  ❌ "เว็บคุณโหลด 5 วินาที" (ไม่ได้วัดจริง!)
```

---

## Features ที่ส่ง

- HTML email branded VXB (gradient bar, pricing cards, CTA)
- PDF Portfolio แนบ (VisionXBrain-Portfolio.pdf)
- Tracking pixel — ติดตามว่าเปิดอ่านไหม
- Click tracking — ติดตาม link clicks
- Notification ถึง Tar ผ่าน LINE + Telegram

---

## VXB Brand Elements (ห้ามเปลี่ยน)

```css
VXB Red: #eb3f43
VXB Purple: #6e49f3
Text Dark: #1b1c1b
Text Light: #666
Background: #fafafa, #f8f7f5

Font: 'Helvetica Neue', Arial, sans-serif
Max-width: 640px
Line-height: 1.8
```

---

## Workflow

```
1. Tar โทรคุยกับลูกค้าจบ
2. บอก Oracle: "ส่ง DGP ให้ [ชื่อธุรกิจ] ไป [email]"
   + ให้ context: industry, เว็บ, สิ่งที่คุยกัน
3. Oracle → POST /api/dgp/generate (AI customize 6 parts)
4. Review content → ถ้า OK → POST /api/dgp/send
5. ระบบ: ส่ง email + แนบ PDF + tracking + notify Tar
6. บันทึกลง dgp-sent.json (ห้ามส่งซ้ำ)
```

---

## Files

| File | หน้าที่ |
|------|---------|
| `tools/oracle-agent/server.js` | Backend: buildDgpTemplate(), generate, send endpoints |
| `tools/oracle-agent/data/dgp-sent.json` | ประวัติที่ส่งแล้ว (duplicate protection) |
| `tools/oracle-agent/public/email/dgp-proposal-duke.html` | Reference template (Duke = first DGP) |

---

## Sent History

| Date | Business | Email | Status |
|------|----------|-------|--------|
| 2026-02-12 | Duke Language School | min.i@dukelanguage.com | Sent |

---

*Created: 2026-02-12*
*Updated: 2026-02-12 — Added API endpoints, duplicate protection, voice rules, กฎห้ามมั่ว*
