# Session Handoff

**From:** Session 2026-02-11 (GSC Audit + Sitemap Cleanup)
**To:** Next Session

---

## งานหลักระยะยาว — Task #62: Service Page SEO Overhaul

> **Skill:** `ψ/skills/service-page-seo.md` ⭐⭐⭐ ← อ่านก่อนทำ!

### Scope
ปรับปรุง **126 service pages** ทั้ง Body Text CRO + Internal Links พร้อมกัน

| งาน | ทำเสร็จ | เหลือ |
|------|---------|-------|
| Body Text CRO | **10/126** ✅ (Hub, CMS, E-Com, Membership, Support, One-Page, Car-Rental, Multilingual, Localization, GBP) | 116 หน้า |
| Internal Links (5/หน้า) | **10/126 ✅ Published** (50 links) | 116 หน้า (584 links) |

### Workflow ต่อหน้า
```
1. switch_page → เปิดหน้า
2. get_all_elements → หา String IDs + button-group IDs
3. RapidAPI keyword research (กฎเหล็ก!)
4. เขียน CRO content → set_text ทีละ element
5. สร้าง 5 TextLinks → element_builder ใน button-groups
6. Verify → ไปหน้าถัดไป
```

### ถัดไปควรทำ
```
1. เริ่ม 121 หน้าที่เหลือ (CRO 100% + Links พร้อมกัน)
2. ใช้ Mandatory Checklist Protocol ทุกหน้า (ห้ามข้าม!)
3. ลำดับ: เริ่มจาก high-traffic pages ก่อน
```

### Execution Plan Data (พร้อมใช้)
```
Execution plan:   main/tools/oracle-agent/data/internal-link-execution.json (126 pages × 5 links)
Link map:         main/tools/oracle-agent/data/internal-link-map.json (203 pages)
```

### บทเรียนจาก session ที่ผ่านมา (ห้ามลืม!)
- **ห้ามวาง link ใน section/container ตรงๆ** → ใช้ button-group เท่านั้น
- **ห้ามวางใน section_testimonial** button-group!
- **ห้ามลิงก์ WordPress** — VXB = Webflow Agency
- **Bridge timeout บ่อย** → ทำทีละ 1 call
- **element_builder TypeError = ปกติ** → element สร้างจริงแล้ว
- **String IDs ไม่ share ข้ามหน้า** → ต้อง get_all_elements ทุกหน้า
- **MCP ไม่มี delete tool** → ลบ element ต้องทำมือใน Designer

---

## apibooking ↔ checkin Cross-Project (2026-02-09)

| Item | Detail |
|------|--------|
| สถานะ | ✅ Checkin Status Sync LIVE — badge แสดงใน dashboard |
| apibooking | `/Users/tanakitchaithip/Desktop/apibooking/` → `git@github.com:qualyads/apibooking.git` |
| checkin | `/Users/tanakitchaithip/Desktop/checkin/` → `git@github.com:qualyads/checkin.git` |
| Skill | `ψ/skills/checkin-status-sync.md` ⭐⭐ |
| Knowledge | `ψ/memory/knowledge/checkin-system.md` section 13 |
| Features | Batch API, 📱/🖥️ badge + เวลา, auto-refresh 60s, timezone Bangkok |
| Backlog | gen booking ID + QR code สำหรับ Walk-in, ดู section 13 |

---

## Smart Pricing — ✅ DEPLOYED & LIVE (อัพเดท 2026-02-12)

| Item | Detail |
|------|--------|
| Feature | ปรับราคาอัตโนมัติ AI-first + competitor data จาก Booking.com |
| Skill | `ψ/skills/smart-pricing.md` ⭐⭐⭐ |
| Files | `apibooking/src/smart-pricing.ts`, `server.ts`, `telegram.ts`, `simulate.ts` |
| Mode | Auto (ปรับเลย + แจ้ง Telegram) |
| ✅ เปิดอยู่ | `enabled: true` — LIVE แล้ว |
| Cron | 5 รอบ/วัน (8,11,14,17,20) |
| autoLookAheadDays | **4 วัน** (เดิม 2 → อัพ 12 ก.พ.) ปรับราคาล่วงหน้าทัน |
| AI Chain | Claude Sonnet (temp=0) → GPT-4o-mini → Rule-based |
| Telegram | ✅ ส่งสำเร็จ (Tar's chat: 5305207553) |
| Competitor | ✅ Booking.com RapidAPI (RAPIDAPI_KEY ตั้งบน Railway แล้ว) |
| Dashboard | `https://apibooking-production-f073.up.railway.app/` |
| Status API | `GET /api/smart-pricing/status` |
| **Last-Minute Mode** | ✅ พร้อมใช้ (ยังไม่เปิด) — `POST /api/smart-pricing/last-minute {enabled:true}` |
| Last-Minute Detail | Cron ทุก 30 นาที, เฉพาะวันนี้, maxDrop 35%, ไม่มี cooldown, ไม่มี NET_BOOST |
| ⚠️ Tar วิเคราะห์ | Last-Minute อาจไม่เหมาะกับปาย (คนไม่ walk-in, brand damage) → เก็บไว้เผื่อจำเป็น |
| Commit | `8cd905a` — deployed 2026-02-12 |

---

## ApiBooking — Hide Money Toggle ✅ DONE (2026-02-11)

| Item | Detail |
|------|--------|
| Feature | ปุ่มรูปตา (eye toggle) ใน Day Summary Modal — ซ่อนยอดเงินทั้งหมดเพื่อแคปจอส่งแม่บ้าน |
| ซ่อนอะไร | ราคาต่อคืน, รายได้รวม, หักคอมฯ, รายได้สุทธิ, ราคาห้องว่าง, Revenue loss |
| วิธี | CSS blur 10px + `data-money` attribute + localStorage จำสถานะ |
| Commit | `0fdaf75` |
| Deploy | Railway auto-deploy ✅ |

---

## ApiBooking — Early Checkout Feature ✅ DONE (2026-02-08)

| Item | Detail |
|------|--------|
| Feature | เช็คเอาท์ก่อนกำหนด (เปิดห้องขาย) สำหรับ Booking.com bookings |
| Repo | `git@github.com:qualyads/apibooking.git` |
| Local | `/Users/tanakitchaithip/Desktop/apibooking/` |
| Deploy | Railway auto-deploy (push to main) |
| Status | ✅ Pushed & deployed |
| Knowledge | `ψ/memory/knowledge/apibooking-system.md` section 19 |

---

## Dashboard Relume Sync — ✅ COMPLETE (2026-02-11)

| Item | Detail |
|------|--------|
| Feature | Sync ทุก 5 dashboards ให้ใช้ Relume UI + shared components |
| Shared Package | `dashboard-shared/` — AppSidebar, Topbar, StatCard, StatCardProgress, SectionHeader, DataTable, LoadingScreen, formatters, navigation config |
| Analytics | ✅ Import จาก @oracle/shared |
| 404 Check | ✅ Import จาก @oracle/shared |
| Growth | ✅ Converted จาก vanilla CSS → Relume |
| Email | ✅ Converted จาก vanilla CSS → Relume |
| Costs | ✅ Converted จาก inline HTML → React + Relume |
| Build | analytics ✅ built, อีก 4 อัน ยัง build ไม่ได้ (Tar reject) |
| Deploy | ยัง — ต้อง build ทุกอัน + railway up |

---

## 🚨 GSC Indexing Audit — Task #63 (2026-02-11)

> **Full Audit:** `ψ/memory/knowledge/gsc-indexing-audit.md` ⭐⭐⭐⭐
> **JSON ดิบ:** `/tmp/vxb-inspect-results.json`

| สถานะ | จำนวน |
|--------|--------|
| Indexed | 560 (73.6%) |
| NOT indexed | **201 (26.4%)** |

| Category | Index Rate | ปัญหา |
|----------|-----------|-------|
| Services | **26%** (31/118) | วิกฤต — money pages! |
| Location | **47%** (34/73) | แย่ — duplicate content |
| Blog | 88% (330/376) | 49 บทความไม่เคยถูก crawl |

### สิ่งที่ทำเสร็จ
- ✅ ลบ sitemap ขยะ 20 รายการ (เหลือ 1 อัน)
- ✅ เพิ่ม API: delete-sitemap, inspect-url, batch-inspect
- ✅ เพิ่ม deleteSitemap() ใน search-console.js
- ✅ บันทึก audit report ครบถ้วน

### สิ่งที่ต้องทำต่อ
1. ปรับ content service pages ให้ unique (ตรงกับ Task #62)
2. ปรับ content location pages
3. เพิ่ม internal linking
4. ลบ 404 + test slug + เช็ค noindex

---

## 🔴 Analytics Dashboard Redesign — Executive Level (ยังไม่เสร็จ!)

> **เป้าหมาย:** ออกแบบ dashboard ใหม่ระดับ Elon Musk — เน้น revenue/growth/funnel ไม่ใช่ vanity metrics
> **Route:** `/vision/analytics/`
> **File:** `dashboard-analytics/src/App.jsx`

### สิ่งที่ทำเสร็จแล้ว
- ✅ Icons8 migration (react-icons → Icons8 iOS 17 Outlined) ทั้ง 5 dashboards
- ✅ Icon สี CI Brand (#eb3f43) — StatCard, StatCardProgress, SectionHeader
- ✅ Build สำเร็จทุก dashboard
- ✅ Research ครบ: API endpoints ทั้งหมด, shared components, Relume patterns

### สิ่งที่ยังไม่ได้ทำ — Redesign Dashboard
**Design Concept (Tar ให้โจทย์ "ถ้ารายงาน Elon Musk"):**
1. **Hero KPIs** (above fold) — Visitors, Leads, Conversion %, Cost/Lead
2. **VXB Business Funnel** — Impressions → Clicks → Visits → Engaged → Conversions → Leads → Emails → Clicks → Replies
3. **Growth Velocity** — Trend chart (ทิศทาง ไม่ใช่ตัวเลขลอยๆ)
4. **Channel Performance** — แหล่งไหนสร้าง lead ได้
5. **Top 3 Actions** — ไม่ใช่ list 20 ปัญหา แค่ 3 สิ่งที่ต้องทำ + expected impact
6. **Google Search** — ย่อ: clicks, impressions, top 3 keywords, top 3 opportunities
7. **AI Recommendations** — Oracle ทำอะไร/แนะนำอะไร

### API ที่ใช้ได้แล้ว (ไม่ต้องสร้าง backend ใหม่)
```
GA4:     /api/ga4/summary, /api/ga4/trends, /api/ga4/landing, /api/ga4/conversions, /api/ga4/sources
GSC:     /api/search-console/summary, /api/search-console/queries
Leads:   /api/leads/stats
Email:   /api/email/stats
Costs:   /api/costs
Ideas:   /api/ideas
```

### Design Principles
- Revenue first, not pageviews
- Every number has direction (up/down, green/red)
- One screen tells the whole story
- Funnel thinking — show drop-off
- Top 3 actions only
- Cost per result always visible
- No fluff

---

## งานอื่นที่ค้าง

### Blog Content Rewrite — ✅ COMPLETE (2026-02-11)
> **381/381 บทความ** — ทุกบทความมี FAQ Schema + Article Schema + Recommended Articles + Optimized Meta
> **Session 2026-02-11:** ทำ 23 บทความสุดท้าย (16 short + 7 retry) — ทั้งหมด DONE & published
> **Verify method:** เช็ค FAQ Schema JSON-LD ใน post-body = rewrite แล้ว
> **Source of truth:** `ψ/skills/vxb-blog-rewrite.md`

| Task | สถานะ |
|------|--------|
| Blog Title+Meta | ✅ DONE |
| Blog Content Rewrite | → ดู skill file log |
| Fix 12 blog posts ไม่มีรูป | ⏳ |
| Fix 404 blog post (pos 1.7) | ✅ 301 redirect (2026-02-11) |

### Lead Finder v3 + Email Outreach + Dashboard — ✅ FULL PIPELINE LIVE
| Status | Detail |
|--------|--------|
| Deploy | Railway via `railway up` (ห้าม GitHub auto-deploy) |
| Search | Local Rank Tracker API — **25 searches/run จาก 153 queries (12 เมือง × 35 industry)** |
| Details | Local Business Data API Pro ($25/mo) → 20,000 businesses/เดือน |
| Analysis | **$0 — Local regex + heuristic** (ไม่ใช้ AI) |
| Email Gen | **Haiku 4.5** (~$0.010/call), max_tokens 8000 |
| Cron | **2 รอบ/วัน (10:00 + 15:00)** max 500 leads/day, 20 emails/day |
| **Scoring** | ✅ Priority Score 0-100 (ส่ง email ตัวดีสุดก่อน) |
| **LINE Scraper** | ✅ หา LINE ID จากเว็บอัตโนมัติ (~8% ของ leads) |
| **Email** | ✅ 24 กฎ + PDF + tracking + 2 templates + **scored sending** |
| **Dashboard** | ✅ `https://oracle-agent-production-546e.up.railway.app/vision/email/` |
| **Costs Page** | ✅ `https://oracle-agent-production-546e.up.railway.app/vision/email/costs/` |
| **Gmail Sync** | ✅ Auto-sync on startup |
| **Skill** | `ψ/skills/email-marketing.md` ⭐⭐⭐⭐⭐ (v7) |
| Auto-send | ✅ ENABLED — max 20/day, priority scored |
| **Cost/mo** | **1,292 THB** ($38) — ลด 79% จากเดิม 6,178 THB |
| **Geo-filter** | ✅ Thailand bounding box + city name in query (2026-02-10 fix) |
| **Sanitizer** | ✅ Unicode surrogate fix in claude.js (2026-02-10 fix) |
| **Real-time Reply** | ✅ Gmail Pub/Sub → auto-detect reply + AI intent + auto-reply calendar slots (2026-02-12) |
| **DGP v3** | ✅ Manual DGP proposals sent (2026-02-12) — ดูด้านล่าง |
| ถัดไป | ย้าย leads.json → DB, A/B test subject lines |

### 🆕 DGP Proposal v3 — Manual Outreach (2026-02-12)

| Item | Detail |
|------|--------|
| Feature | สร้าง DGP proposal email เฉพาะบุคคล ส่งผ่าน `/api/dgp/send` |
| ส่งแล้ว 2 ราย | 1. Duke Language School (โรงเรียนสอนภาษา) 2. Posh Home & Decor (เฟอร์นิเจอร์/โซฟาเบด) |
| Email Duke | duke.languageschool@gmail.com |
| Email Posh | natiya.nami@gmail.com |
| Subject format | "แผน[ประโยชน์]ให้ [ชื่อธุรกิจ] ครับ" |

### DGP v3 กฎที่แก้ไข (2026-02-12)
```
1. ห้ามมั่วข้อมูลเว็บลูกค้า — ห้ามอ้าง "blog แค่ 4 โพสต์" หรือ "เว็บโหลด 5 วิ" ถ้าไม่ได้ verify จริง
2. ห้ามอ้าง case study ลูกค้ารายอื่น — โฟกัสแค่ลูกค้ารายนี้
3. ใช้ข้อมูลจาก context ที่ Tar ให้เท่านั้น
4. ถ้าไม่มีข้อมูล → พูดในมุม industry opportunity ที่เป็นจริงเสมอ
5. ห้ามอ้างผลงานมั่ว (เช่น "เว็บ 80+ องค์กร" OK เพราะจริง แต่ห้ามบอก specifics ที่ไม่ได้ verify)
```

### 🆕 Lead Reply Handler — Real-time (2026-02-12)

| Item | Detail |
|------|--------|
| Feature | Gmail Pub/Sub webhook → detect lead reply → AI classify intent → auto-reply with calendar slots |
| Files | `lib/lead-reply-handler.js` (NEW), `lib/gmail.js` (3 methods added) |
| Architecture | Gmail watch() → Pub/Sub → POST /webhook/gmail → listHistory → match lead → classify → reply/notify |
| Intent | Claude Haiku classify: interested / declined / unclear |
| Auto-reply | AI-generated Thai reply + Google Calendar free slots (max 1/lead) |
| Notifications | LINE + Telegram ทันที |
| Safety | max 1 auto-reply/lead, skip system emails, calendar fallback |
| Cron | Watch renewal ทุก 6 วัน (`0 3 */6 * *`) |
| Endpoints | `GET /api/lead-reply/status`, `POST /api/lead-reply/test`, `POST /api/lead-reply/setup-watch` |
| GCloud Setup | ต้องทำเอง: สร้าง Pub/Sub topic `gmail-notifications` ใน project `oracle-agent-486604` → push sub → grant Publisher |
| Lead Fields | replyMessageId, replyThreadId, replySnippet, replyIntent, autoRepliedAt, autoReplyMessageId |
| Fallback | Cron polling เดิม (ทุก 3 ชม.) ยังทำงานอยู่ = safety net |

### Email Outreach — 24 กฎเหล็ก (สรุป)
```
Subject: ต้องมีชื่อธุรกิจ + CRO hook
Content: ห้ามพูดโรงแรม/rating, WOW tips, Action Plan 6 ข้อ
Template (มีเว็บ): Gradient bar + Screenshot เว็บ + CTA 2 ปุ่ม + Signature + PDF
Template (ไม่มีเว็บ): ไม่มี screenshot, เน้น GBP + ทำเว็บ + AI Search + Social
Voice: VXB Voice, ผม/คุณ/ครับ, ห้าม AI-ish
Automation: อ้าง auto เฉพาะ Post/Social เท่านั้น!
Dashboard: /dashboard/ — Stats + Lead Table + auto-refresh 30s
API: /api/leads/update — อัพเดท lead manual ได้
Key files: server.js, gmail.js, lead-finder.js, dashboard/
```

### Clairify™ — 🟡 MVP DONE (รอ deploy)
### Backlinks — 🟡 MEDIUM (Plan Ready, ยังไม่ execute)
- Skill: `ψ/skills/backlink-auto.md` ⭐⭐
- 4 Phases: Directories(ฟรี) → Quick Wins(5K) → Scale(15K) → Authority
- เป้า: 20-40 quality backlinks/เดือน, Tar < 30 นาที/วัน
- Tools: DataForSEO, Hunter.io, Postaga, PressPulse AI
- n8n workflows 6 ตัวต้องสร้าง

---

## SEO Progress Summary

```
Service Pages Meta:     221/246 ✅ (90%)
Showcase Content:       17/17 ✅
Showcase IL:            17/17 ✅ (55 links)
Blog Title+Meta:        381/381 ✅
Service Page CRO:       → ดู ψ/skills/service-page-seo.md
Service Page IL:        → ดู ψ/skills/service-page-seo.md
Blog Rewrite:           381/381 ✅ COMPLETE (2026-02-11)
Backlinks:              0 ⏳ (plan ready → ψ/skills/backlink-auto.md)

⚠️ ตัวเลข batch งาน = ดูจาก skill file เท่านั้น (Crash-Proof Protocol)
⚠️ เริ่ม session ใหม่ → verify กับ API จริงก่อนรายงาน
```

---

## Key Files

```
Service Page SEO skill: ψ/skills/service-page-seo.md ⭐⭐⭐
Blog rewrite skill:     ψ/skills/vxb-blog-rewrite.md ⭐⭐⭐
MCP Designer skill:     ψ/skills/webflow-mcp.md ⭐⭐
CRO copywriting:        ψ/skills/cro-copywriting.md ⭐

Email marketing skill:  ψ/skills/email-marketing.md ⭐⭐⭐⭐
Email endpoint:         main/tools/oracle-agent/server.js (line ~5380)
Gmail client:           main/tools/oracle-agent/lib/gmail.js
Lead reply handler:     main/tools/oracle-agent/lib/lead-reply-handler.js
Lead finder:            main/tools/oracle-agent/lib/lead-finder.js
PDF attachment:         main/tools/oracle-agent/data/VisionXBrain-Portfolio.pdf

IL execution plan:      main/tools/oracle-agent/data/internal-link-execution.json
IL link map:            main/tools/oracle-agent/data/internal-link-map.json
Blog ranking data:      scratchpad/blog-ranked.json
Blog full data:         scratchpad/blog-full.json

IL session log:         ψ/memory/logs/2026-02-08-internal-links.md
```

## Webflow Quick Reference

```
Site ID: 6795b56931d6597a64784934
Showcase Collection: 679c438f17066b1851083ddb
Blog Collection: 67ff5801b6766c3f294dd101
Publish: www=695e0f53df4e71c47da63ab2, non-www=695e0f52df4e71c47da63aab
EN Locale: 68808385b778cd77e3dd62c9
TH Locale: 67961db7fb0de8aa9dd25f7e
RapidAPI Key: 014d445a38msh0645e22d930fd07p17eea5jsn5c8866bfbb22
Bridge URL: https://vision-x-brain-relume.design.webflow.com?app=dc8209c65e3ec02254d15275ca056539c89f6d15741893a0adf29ad6f381eb99
```

---

### บทเรียนใหม่ (2026-02-08)
- **Mandatory Checklist Protocol** — ต้องรัน `cro_checklist_generator.py` ทุกหน้า
- Script อยู่ที่: `scratchpad/cro_checklist_generator.py`
- ต้อง verify 100% ก่อน publish (ห้ามข้าม!)
- Hub page `/services/website` ทำ 59/59 PRE-FAQ + 110 FAQ elements + 5 internal links ✅
- One-Page `/services/one-page-website-design` ทำ 142 elements + 5 internal links ✅ Published
- **VXB Voice rewrite ทั้งหน้า ~190 elements** — Published ✅
- **MCP reconnect flow:** bridge timeout → `/mcp` reconnect → switch_page → single element warmup → batch of 5
- **Batch size หลัง page switch = 5** (10 จะ TypeError)
- 🚨 **link_only class ห้ามลืม!!** — ทุก TextLink ต้องใส่ `set_style: { style_names: ["link_only"] }` เสมอ!
- ✅ One-Page 5 links แก้ link_only class แล้ว → Published
- 🚨 **CRO Anchor Text** — ห้ามใช้ชื่อบริการแห้งๆ! ต้องเพิ่ม benefit/curiosity + ปรับตามบริบทหน้า (on-the-fly)

- Car-Rental `/services/car-rental-website-design` ทำ 187 elements + 5 internal links ✅ Published
- Keyword: "รถเช่า" (14,800 vol) — niche "ทำเว็บไซต์รถเช่า" vol=0
- Button-groups: pricing(147), features(206), FAQ(680)×2, bottom CTA(722)

- Multilingual `/services/multilingual-website-development-global-reach` ทำ 183 elements + 5 internal links ✅ Published
- Keywords: แปลเว็บไซต์ (390), multilingual website (1,300), localization website (1,900)
- Button-groups: pricing(134), features(193), FAQ(666)×2, bottom CTA(708)

- Localization `/services/global-website-localization` ทำ 162 elements + 5 internal links ✅ Published
- Keywords: website localization (1,900), web localization (1,900), localization services (880), แปลเว็บไซต์ (390)
- Button-groups: pricing(138), features(199), FAQ(672), bottom CTA(714)
- Content เดิมเป็น EdTech → rewrite ทั้งหมดเป็น localization theme

- GBP `/services/google-business-profile-optimization` ทำ 187 elements + 5 internal links ✅ Published
- Keywords: ปักหมุด google map (2,900), google business (673K), ปักหมุดร้านใน google maps (480)
- Button-groups: pricing(138), features(197), FAQ(674), bottom CTA(716)
- Links: Facebook Business, Landing Page, CRO Service, LINE MyShop, Toy E-Commerce

### E-commerce Platform Onboarding (2026-02-09)

**Lazada Open Platform:**
- Profile อนุมัติแล้ว → Developer Onboarding Step 3 เสร็จ (Service Provider: VisionXBrain)
- Apply 9 App Categories (ทั้งหมด Pending):
  - Seller In-house APP ← ตัวหลัก!
  - In-house IM Chat, Lazada Logistics, LazLive
  - LazPay Open API, LazPay Openloop
  - Loyalty, Lazlike, Redmart
- รอ approve → ได้ App Key + App Secret → ใส่ `.env` → `node auth-server.js`
- Testing Tools: SDK Download, API Explorer, Loan Test Account, Create Test Case

**Taobao/AliExpress Affiliate:**
- สมัคร AliExpress Affiliate เสร็จ (2026-02-09 20:29 PST)
- Account: ae409915 user
- Under review ≤1 ชม.
- พอ approve → ไปดู Alliance ID + RID ที่ My Alliance → My Account → Basic Information
- ตอบอีเมล `tbos_union@service.taobao.com` ด้วยข้อมูล affiliate
- เทาเป่าต้องการ: Alliance ID, RID, Registration email, Taobao ID

**Next Steps:**
1. รอ AliExpress Affiliate approve (≤1hr) → ตอบอีเมลเทาเป่า
2. รอ Lazada App Categories approve (1-3 วัน) → ได้ App Key
3. ทั้ง 2 ได้ key → setup `.env` → OAuth → ทดสอบ API จริง

*Session updated: 2026-02-09 — Lazada approved + Taobao affiliate submitted*
