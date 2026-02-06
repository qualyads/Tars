# Goals & Task Board

> โหลดทุก boot → เก็บแค่ active!
> ทำสำเร็จ → ย้ายไป archive/completed-goals.md

---

## North Star

> **"รวยและประสบความสำเร็จที่สุดเท่าที่ทำได้"**

**Paths:** Passive Income | SaaS | Oracle Framework | AI-human collaboration

**Priority #1 ด้านโปรเจคเว็บ: SEO** — ซีเรียสมาก ใช้ Search Console API ติดตามผล

---

## Constraints

| ด้าน | รายละเอียด |
|------|-----------|
| เงินส่วนตัว | 10-20K/เดือน (จำกัด) |
| รายได้โรงแรม | 400-600K/เดือน (เงินกิจการ) |
| ค่า API | ไม่จำกัด |
| เวลา | ไม่มี → ต้อง Automate ทุกอย่าง |

---

## 📋 Task Board

> ⏳ Backlog | 🔜 Up Next | 🔄 In Progress | เสร็จ → ย้ายไป completed-goals.md

### 🔄 In Progress

| # | Task | Owner | Priority | Due | Project | Notes |
|---|------|-------|----------|-----|---------|-------|
| - | (ว่าง) | | | | | |

### ✅ Recently Completed
| # | Task | Completed | Notes |
|---|------|-----------|-------|
| 18 | Memory Recall Protocol ให้ทำงานถูก | 2026-02-06 | v7.0 Pointer + On-Demand, ลด boot 95% |
| 1 | สร้าง Google Cloud Project + OAuth2 | 2026-02-06 | Project: oracle-agent-486604, Account: info@visionxbrain.com |
| 2 | เชื่อม Gmail API | 2026-02-06 | lib/gmail.js + 9 endpoints (inbox, search, send, draft, etc.) |
| 3 | เชื่อม Calendar API | 2026-02-06 | lib/google-calendar.js + 7 endpoints (today, upcoming, create, etc.) |

### 🔜 Up Next

| # | Task | Owner | Priority | Blocked By | Project | Notes |
|---|------|-------|----------|------------|---------|-------|
| 21 | เพิ่ม Google account vxb.visionxbrain@gmail.com | Tar+Claude | 🟡 Medium | - | API Integration | test user เพิ่มแล้ว, รัน `node google-oauth.js vxb` แล้ว login |
| 22 | SEO Report อัตโนมัติ (สั่งผ่าน LINE) | Claude | 🔴 High | - | SEO | Search Console API พร้อม, สร้าง report template |
| 23 | Weekly SEO Dashboard ส่งให้ลูกค้า | Claude | 🔴 High | #22 | SEO | สรุป clicks/imp/keyword ทุกสัปดาห์ |
| 24 | Keyword Alert (แจ้งเตือนหลุดหน้าแรก) | Claude | 🟡 Medium | #22 | SEO | monitor keyword สำคัญ |
| 25 | เพิ่มเว็บลูกค้าใน Search Console | Tar | 🟡 Medium | - | SEO | ให้ลูกค้า verify แล้วเพิ่ม VXB เป็น user |

**VXB SEO - Webflow Focus**
| # | Task | Owner | Priority | Phase | Notes |
|---|------|-------|----------|-------|-------|
| 26 | ปรับ meta title/desc หน้าที่ pos 3-10 | Claude | 🔴 High | Phase 1 | Quick win: รับทำ ai search, รับทำ geo, รับทำ website saas |
| 27 | เขียนบทความ "Webflow คืออะไร" ฉบับสมบูรณ์ | Claude | 🔴 High | Phase 1 | 43 imp แต่ pos 57 = ไม่มีหน้าดีๆ ต้องสร้างใหม่ |
| 28 | เขียนหน้า "รับทำ Webflow" | Claude | 🔴 High | Phase 2 | keyword หลักของธุรกิจ แต่ยังไม่มีหน้าเลย! |
| 29 | เขียนบทความ "รับทำ UX/UI" | Claude | 🔴 High | Phase 2 | รวม 140 imp (ux 87 + ui 53) |
| 30 | เขียน "Webflow vs WordPress 2026" | Claude | 🟡 Medium | Phase 2 | 33 imp, pos 43-61 ต้องทำใหม่ |
| 31 | ตั้ง Weekly SEO Report → LINE | Claude | 🟡 Medium | Phase 3 | Search Console API พร้อม |
| 32 | Keyword Alert หลุด top 10 → LINE | Claude | 🟡 Medium | Phase 3 | monitor keyword สำคัญทุกวัน |
| 33 | Auto Blog supporting content ต่อเนื่อง | Claude | 🟡 Medium | Phase 3 | ใช้ Webflow Mapper + keyword data |

### ⏳ Backlog

**API Integration**
| # | Task | Owner | Priority | Needs | Project |
|---|------|-------|----------|-------|---------|
| 4 | Search Console API | Claude | 🔴 High | OAuth2 + เขียนโค้ด | Google APIs |
| 5 | Business Profile API | Claude | 🔴 High | OAuth2 + เขียนโค้ด | Google APIs |
| 6 | Google Ads API | Claude | 🟡 Medium | Research ก่อน | Google APIs |
| 7 | Shopify Integration | Claude | 🟡 Medium | Store URL + Admin Token | Ecommerce |
| 8 | Lazada Integration | Claude | 🟡 Medium | App Key + App Secret | Ecommerce |
| 9 | Shopee Integration | Claude | 🟡 Medium | Partner ID + Key | Ecommerce |
| 10 | LINE MyShop | Claude | 🟡 Medium | Research | Ecommerce |
| 11 | 2C2P/Omise Payment | Claude | 🟡 Medium | Account setup | Payment |
| 12 | WhatsApp Business | Claude | 🟡 Medium | Business account | Messaging |
| 13 | TikTok Shop | Claude | 🟢 Low | Research | Ecommerce |
| 14 | Facebook/IG Shop | Claude | 🟢 Low | Research | Ecommerce |

**Business Ideas**
| # | Task | Owner | Priority | Needs | Project |
|---|------|-------|----------|-------|---------|
| 15 | Domain Flipping - หา domain ดี | Claude | 🟡 Medium | Research + 600-800 บาท | Side Income |
| 16 | Ebook - ร่างเนื้อหา | Claude | 🟡 Medium | เลือกหัวข้อ | Side Income |
| 17 | Hotel Channel Manager - Research | Claude | 🟢 Low | Market research | SaaS |

**Oracle System**
| # | Task | Owner | Priority | Needs | Project |
|---|------|-------|----------|-------|---------|
| ~~18~~ | ~~ย้ายไป In Progress~~ | | | | |
| 19 | Sync stock ข้าม platforms | Claude | 🟡 Medium | Ecommerce APIs ก่อน | Automation |
| 20 | Dashboard รวมยอดขาย | Claude | 🟡 Medium | Ecommerce APIs ก่อน | Automation |

---

## Claude's Standing Duties (ทำทุกวัน)

| เวลา | งาน | Owner |
|-------|-----|-------|
| เริ่ม session | รายงานทอง + BTC + Fear & Greed | Claude |
| เริ่ม session | เช็ค task board → แนะนำว่าวันนี้ทำอะไรดี | Claude |
| ทุกวัน | Monitor algorithm changes | Claude |
| ทุกวัน | หาโอกาสธุรกิจ/passive income | Claude |
| สอดแทรก | สอน Tar เรื่องลงทุน/ธุรกิจ ทีละนิด | Claude |

---

## Someday / Maybe

> ไอเดียที่น่าสนใจแต่ยังไม่ urgent

- Forbes สรุปทุกสัปดาห์
- SaaS Millionaires case study
- Hospitality industry trends
- AI disruption preparation

---

*Last updated: 2026-02-06*
