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
| 22 | SEO Report อัตโนมัติ | 2026-02-07 | Weekly report (Mon 10:30) + AI Analysis grade + LINE notification |
| 23 | Weekly SEO Dashboard | 2026-02-07 | รวมใน weekly report — clicks/imp/keyword/WoW comparison |
| 24 | Keyword Alert | 2026-02-07 | Daily 08:00, แจ้ง LINE เมื่อ keyword drop >3 pos หรือหลุด top 10 |
| 31 | Weekly SEO Report → LINE | 2026-02-07 | ทำงานอัตโนมัติแล้ว |
| 32 | Keyword Alert → LINE | 2026-02-07 | ทำงานอัตโนมัติแล้ว |
| 26 | ปรับ meta title/desc | 2026-02-07 | เขียน recommendations ใน seo-action-plan.md (ต้องใส่ใน Webflow) |
| 27 | เขียน "Webflow คืออะไร" | 2026-02-07 | เขียนเสร็จ → content/webflow-คืออะไร.md |
| 28 | เขียนหน้า "รับทำ Webflow" | 2026-02-07 | เขียนเสร็จ → content/รับทำ-webflow.md |
| 29 | เขียน "รับทำ UX/UI" | 2026-02-07 | เขียนเสร็จ → content/รับทำ-ux-ui.md |
| 30 | เขียน "Webflow vs WordPress 2026" | 2026-02-07 | เขียนเสร็จ → content/webflow-vs-wordpress-2026.md |
| - | Sitemap Audit feature | 2026-02-07 | runSitemapAudit() ใน seo-engine.js + API endpoint + weekly cron |
| 18 | Memory Recall Protocol ให้ทำงานถูก | 2026-02-06 | v7.0 Pointer + On-Demand, ลด boot 95% |
| 1 | สร้าง Google Cloud Project + OAuth2 | 2026-02-06 | Project: oracle-agent-486604, Account: info@visionxbrain.com |
| 2 | เชื่อม Gmail API | 2026-02-06 | lib/gmail.js + 9 endpoints |
| 3 | เชื่อม Calendar API | 2026-02-06 | lib/google-calendar.js + 7 endpoints |

### 🔜 Up Next

| # | Task | Owner | Priority | Blocked By | Project | Notes |
|---|------|-------|----------|------------|---------|-------|
| 21 | เพิ่ม Google account vxb.visionxbrain@gmail.com | Tar+Claude | 🟡 Medium | - | API Integration | test user เพิ่มแล้ว, รัน `node google-oauth.js vxb` แล้ว login |
| 25 | เพิ่มเว็บลูกค้าใน Search Console | Tar | 🟡 Medium | - | SEO | ให้ลูกค้า verify แล้วเพิ่ม VXB เป็น user |

**VXB SEO - Content Upload (Tar ต้องทำใน Webflow)**
| # | Task | Owner | Priority | Notes |
|---|------|-------|----------|-------|
| 26b | ใส่ meta desc ทุกหน้าใน Webflow | Tar | 🔴 High | ดู seo-action-plan.md สำหรับ copy |
| 27b | Upload "Webflow คืออะไร" ขึ้น Webflow blog | Tar | 🔴 High | content/webflow-คืออะไร.md |
| 28b | สร้างหน้า "รับทำ Webflow" ใน Webflow | Tar | 🔴 High | content/รับทำ-webflow.md |
| 29b | Upload "รับทำ UX/UI" ขึ้น Webflow blog | Tar | 🔴 High | content/รับทำ-ux-ui.md |
| 30b | Upload "Webflow vs WordPress 2026" ขึ้น blog | Tar | 🟡 Medium | content/webflow-vs-wordpress-2026.md |
| 33 | Auto Blog supporting content ต่อเนื่อง | Claude | 🟡 Medium | ใช้ Webflow Mapper + keyword data |

**VXB SEO - Technical**
| # | Task | Owner | Priority | Notes |
|---|------|-------|----------|-------|
| 34 | แก้ blog 404: /blog/blog-post-website-launch-checklist | Tar | 🔴 High | pos 1.7! redirect หรือสร้างใหม่ |
| 35b | Connect GitHub repo ใน Railway Dashboard | Tar | 🟡 Medium | Settings > Source > Connect > qualyads/Tars > Root: main/tools/oracle-agent |

### ⏳ Backlog

**API Integration**
| # | Task | Owner | Priority | Needs | Project |
|---|------|-------|----------|-------|---------|
| 4 | Search Console API | Claude | 🔴 High | OAuth2 + เขียนโค้ด | Google APIs |
| 5 | Business Profile API | Claude | 🔴 High | ✅ โค้ดพร้อม, รอ GBP API approve (Case 8-7587000040050) ~2 สัปดาห์ | Google APIs |
| 6 | Google Ads API | Claude | 🟡 Medium | Research ก่อน | Google APIs |
| 7 | Shopify Integration | Claude | 🟡 Medium | Store URL + Admin Token | Ecommerce |
| 8 | Lazada Integration | Claude | 🟡 Medium | App Key + App Secret | Ecommerce |
| 9 | Shopee Integration | Claude | 🟡 Medium | Partner ID + Key | Ecommerce |
| 10 | LINE MyShop | Claude | 🟡 Medium | Research | Ecommerce |
| 11 | 2C2P/Omise Payment | Claude | 🟡 Medium | Account setup | Payment |
| 12 | WhatsApp Business | Claude | 🟡 Medium | Business account | Messaging |
| 13 | TikTok Shop | Claude | 🟢 Low | Research | Ecommerce |
| 14 | Facebook/IG Shop | Claude | 🟢 Low | Research | Ecommerce |

**China-to-Thailand E-commerce Pipeline ⭐ (ต้องทำแน่นอน)**
| # | Task | Owner | Priority | Status | Project |
|---|------|-------|----------|--------|---------|
| 41 | สมัคร Taobao Global Open Platform | Tar | 🔴 High | ✅ รอ approve 2-3 วัน (2026-02-07) | China→TH Pipeline |
| 35 | สมัคร Lazada Open Platform | Tar | 🔴 High | ✅ รอ approve 1-3 วัน (2026-02-07) | China→TH Pipeline |
| 34 | สมัคร Shopee Seller + Open Platform | Tar | 🔴 High | ✅ ร้านเปิดแล้ว รอ KYC → ค่อยสมัคร dev | China→TH Pipeline |
| 45 | สมัคร Alibaba.com Open Platform | Tar | 🟡 Medium | ✅ รอ approve 2-5 วัน (2026-02-07) | China→TH Pipeline |
| 42 | เขียน Taobao integration module | Claude | 🔴 High | ✅ `tools/taobao/` | China→TH Pipeline |
| 43 | เขียน Lazada integration module + pipeline | Claude | 🔴 High | ✅ `tools/lazada/` | China→TH Pipeline |
| 46 | เขียน Shopee integration module + pipeline | Claude | 🔴 High | ✅ `tools/shopee/` | China→TH Pipeline |
| 47 | เขียน Alibaba.com integration module | Claude | 🟡 Medium | ✅ `tools/alibaba/` | China→TH Pipeline |
| 36 | ทดสอบ API จริง (ทุก platform) | Claude | 🔴 High | ⏳ รอ AppKey/AppSecret | China→TH Pipeline |
| 37 | End-to-end test: Taobao → แปลไทย → ลง Lazada/Shopee | Claude | 🔴 High | ⏳ รอ #36 | China→TH Pipeline |
| 38 | คำนวณ unit economics จริง (ค่าส่ง, margin) | Claude | 🟡 Medium | ⏳ รอ #37 | China→TH Pipeline |
| 39 | Price Arbitrage Engine | Claude | 🟡 Medium | ⏳ รอ #37 | China→TH Pipeline |
| 40 | Trend Scouting (scan Taobao → หา gap) | Claude | 🟡 Medium | ⏳ รอ #36 | China→TH Pipeline |

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

*Last updated: 2026-02-07*
