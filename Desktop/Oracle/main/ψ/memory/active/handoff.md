# Session Handoff

**From:** Session 2026-02-26 (Smolpix SEO Overhaul)
**To:** Next Session

---

## 🔔 REMINDER: เช็ค Smolpix GSC Indexing — 1-2 มี.ค. 2026

```
ทำอะไร: เช็ค indexing status ของ smolpix.co ทุก URL
วิธี: ใช้ GSC URL Inspection API (OAuth token ใน google-token.json)
คาดหวัง: Soft 404 หาย + 10 URLs indexed (จากเดิม 2/12)
ถ้ายังไม่ indexed → re-submit via Indexing API
```

---

## 🆕 Session 2026-02-26 — Smolpix SEO Overhaul (Critical Fix)

### สถานะ: ✅ ALL DEPLOYED TO RAILWAY (cheerful-peace/pixie)

### 1. SSR + Unique Metadata Fix ✅
- **ปัญหา**: ทุกหน้าใช้ homepage title/meta/canonical + blog เป็น CSR 100%
- **แก้**: แปลง blog [slug] เป็น Server Component + generateMetadata
- **Files**: layout.tsx, page.tsx, blog/layout.tsx, blog/[slug]/page.tsx (rewrite), BlogPostClient.tsx (new)

### 2. Keyword Consolidation ✅
- **36 → 11 posts** (archive 25, keep 11 unique)
- **25 redirects** (301) ใน next.config.ts
- **5 keyword groups** + 2 off-topic consolidated

### 3. Internal Links (Topic Cluster) ✅
- **Pillar**: how-to-optimize-images → links to 10/10 supporting posts
- **Supporting**: each links to pillar + 3 related (4/4 targets)
- **Total**: 37 internal links (29 inline + 8 "Keep Reading")

### 4. GSC Indexing Status (2026-02-26)
| URL | Status | Last Crawl |
|-----|--------|-----------|
| smolpix.co | ✅ Indexed | Feb 19 |
| /blog | ✅ Indexed | Feb 24 |
| how-to-optimize-images (pillar) | Soft 404 | Feb 25 |
| avif-vs-webp | Soft 404 | Feb 24 |
| best-online-compression-tools | Unknown | never |
| mastering-image-compression | Crawled not indexed | Jan 19 |
| effective-ways-to-reduce | Discovered | never |
| reduce-image-resolution | Discovered | never |
| lazy-loading-images | Crawled not indexed | Feb 23 |
| responsive-images-srcset | Alternate w/ canonical | Feb 24 |
| image-cdn | Discovered | never |
| core-web-vitals | Discovered | never |
| webp-to-jpg | Discovered | never |

→ **รอ Google recrawl 3-7 วัน** — Soft 404 + Alternate จะหายหลัง recrawl เห็น SSR content
→ **เช็คอีกที 1-2 มี.ค.** ← Tar สั่ง

### Repo & DB
- Repo: `qualyads/pixie` → cloned `/Users/tanakitchaithip/Downloads/pixie-main/`
- DB: `postgresql://postgres:glTiNRCeTuVUgQTPFdDfJyWsPSgFqMDm@switchback.proxy.rlwy.net:12890/railway`
- Railway: Project `cheerful-peace`, Service `pixie`

### Commits
1. "Fix critical SEO: SSR blog posts + unique metadata + canonical per page"
2. "Consolidate 36 blog posts → 11: archive duplicates + 301 redirects"

---

## 🆕 Session 2026-02-21 — Smolpix Auto-Blog Bug Fixes

### สถานะ: ✅ ALL DEPLOYED TO RAILWAY (cheerful-peace/pixie)

### 1. Race Condition Fix ✅
- **ปัญหา**: 2 requests พร้อมกัน → บทความซ้ำ 2 ชิ้น (13 วินาทีห่างกัน)
- **แก้ 3 ชั้น**:
  1. In-memory mutex (`isProcessing` flag + `finally` unlock)
  2. Atomic topic lock (PENDING → IN_PROGRESS ด้วย WHERE status='PENDING')
  3. Daily limit (calendar day Bangkok)
- **Error recovery**: topic revert to PENDING on failure
- **ลบซ้ำ**: `cmlvxbjaf000baruapy7a615p` (slug `-1`) ลบจาก DB แล้ว

### 2. Daily Limit Fix ✅
- **ปัญหา**: rolling 24h window → วันก่อน 17:46 block วันถัดไป 09:00
- **แก้**: calendar day Bangkok midnight (`toLocaleDateString("en-CA", {timeZone: "Asia/Bangkok"})`)

### 3. Catch-up Window Extended ✅
- **เดิม**: 3h (ถึง 12:00)
- **ใหม่**: 5h (ถึง 14:00) → `hoursPastSchedule <= 5`

### 4. SEO Rules 41+42 Enforcement ✅
- **Rule 41** (code blocks): prompt เข้มขึ้น + Fix 11 inject code block อัตโนมัติ
- **Rule 42** (brand mentions): prompt strict max 5 + Fix 10 ลด brand mentions อัตโนมัติ
- **แก้บทความวันนี้**: brand 15→8, code blocks 0→1

### 5. Full Duplicate Audit ✅
- 31 published articles — ไม่มีซ้ำ
- 10 PENDING topics พร้อม (topic แรก: "AVIF vs WebP")
- 0 stuck IN_PROGRESS topics
- 0 orphan topics

### ไฟล์ที่แก้ (pixie-main)
```
src/app/api/cron/auto-publish-topics/route.ts — mutex + atomic lock + error recovery + daily limit + catch-up 5h
src/lib/auto-blog/content-generation.ts — rules 41+42 strengthened prompts
src/lib/auto-blog/utils.ts — Fix 10 (brand reduction) + Fix 11 (code block inject)
```

### Skill File: `ψ/skills/smolpix-autoblog.md` ← อัปเดทแล้ว

---

## Session 2026-02-20 — Smolpix Auto-Blog SEO Overhaul

### สถานะ: ✅ ALL DEPLOYED TO RAILWAY (cheerful-peace/pixie)

### 1. OpenAI → Claude Migration ✅
- Article gen: Claude Sonnet 4.6 (~$0.08/บทความ)
- Image prompt + utilities: Claude Haiku 4.5 (~$0.002/บทความ)
- ประหยัด ~60% จาก OpenAI GPT-4o-mini

### 2. SEO Quality — 43 Rules ✅
| Rules | รายละเอียด |
|-------|-----------|
| 1-25 | Original: 7-section structure + AEO/GEO |
| 26-29 | Anti-repetition (ห้ามซ้ำ stats/phrases) |
| 30 | Hook patterns (stat, question, bold claim) |
| 31-34 | Conversational tone + regional examples |
| 35-39 | E-E-A-T (data sources, year citations) |
| 40 | Title ≥50 chars |
| 41 | Code block ≥1 อัน |
| 42 | Brand mention ≤5-6 ครั้ง |
| 43 | Heading format (blank lines before/after) |

### 3. Internal Links Fix ✅
- **ลบ** `generateAnchorVariants()` — สร้าง anchor แปลกๆ เช่น "Lower Photo", "Top Techniques"
- **ลบ** 70% random variant replacement logic
- **ตอนนี้** ใช้ matched keyword เป็น anchor เสมอ → ประโยคอ่านเป็นธรรมชาติ
- **แก้ 2 บทความเก่า** ใน DB (stripped 7 broken links)

### 4. Email Notifications — Gmail API ✅
- Primary: Oracle Agent Gmail API (`POST /api/gmail/send`)
- Fallback: Brevo (ถ้า Gmail ล้มเหลว)
- ส่งถึง: `vxb.visionxbrain@gmail.com`
- แก้ 4 ไฟล์: brevo.ts, auto-publish route, signup route, stripe webhook

### 5. Auto-Blog Schedule ✅
| Setting | Value |
|---------|-------|
| Schedule | 09:00 Bangkok daily |
| Catch-up Fallback | 10:00-12:00 (ถ้า 09:00 พลาด) |
| Language | English |
| Pending topics | 10 (was 28, 18 published since 2026-02-11) |
| autoBlogEnabled | true |
| Email notification | vxb.visionxbrain@gmail.com |

### 8. Sitemap Auto-Submit to Google Search Console ✅
| Item | Detail |
|------|--------|
| Google SC Property | `sc-domain:smolpix.co` (siteOwner) |
| Cron ทุก 3 วัน | `0 10 */3 * *` Bangkok via Oracle agent |
| Event-driven | หลัง auto-publish → trigger Oracle agent |
| API endpoint | `POST oracle-agent/api/seo/submit-sitemap/smolpix` |
| Check status | `GET oracle-agent/api/seo/sitemaps?site=sc-domain:smolpix.co` |
| Debounce | 1 ชม. (ป้องกัน submit ถี่เกิน) |
| Sitemap URLs | 37 URLs (dynamic จาก DB) |
| Verified | ✅ Google downloaded sitemap (2026-02-20 14:06) |
| http:// sitemap เก่า | ลบผ่าน API ไม่ได้ (Google limitation) — ไม่กระทบ |

### Skill File: `ψ/skills/smolpix-autoblog.md` ← สรุปทุกอย่างในไฟล์เดียว

### 6. Catch-up Fallback (ใหม่!) ✅
```
09:00 → ลอง publish (ปกติ)
  ❌ พลาด → catch-up window เปิด
10:00-12:00 → เช็คทุก 15 นาที
  มีบทความใน 24h → ข้าม
  ไม่มี → publish ทันที + log "CATCH-UP: Xh late"
12:01+ → หมดเวลา catch-up
```

### 7. First Articles Published ✅
- "How to Optimize Images for Your Website in 2026" (13:45 Bangkok) — auto
- "Best Online Image Compression Tools in 2026" (17:46 Bangkok) — test
- คุณภาพ 7.5-8/10 (vs ม.ค. 5/10) — readTime 13-14 min, 7 FAQs, 6-7 E-E-A-T sources

### ไฟล์ที่แก้ (pixie-main)
```
src/lib/auto-blog/content-generation.ts — 43 rules prompt
src/lib/auto-blog/utils.ts — ลบ generateAnchorVariants, fix anchor logic
src/lib/brevo.ts — Gmail API primary + Brevo fallback
src/app/api/cron/auto-publish-topics/route.ts — catch-up fallback + email fix
src/app/api/auth/signup/route.ts — email condition fix
src/app/api/stripe/webhook/route.ts — email condition fix
```

### DB (Railway Postgres)
```
Public URL: postgresql://postgres:glTiNRCeTuVUgQTPFdDfJyWsPSgFqMDm@switchback.proxy.rlwy.net:12890/railway
scheduleHour=9, scheduleMinute=0, autoBlogEnabled=true, language=en
notificationEmail=vxb.visionxbrain@gmail.com
28 pending topics remaining (~1 month content)
```

---

## 🆕 Session 2026-02-20 — API Cost Audit + Feature Flags

### สถานะ: ✅ DEPLOYED TO RAILWAY

### 1. Anthropic API Cost Audit
- **รวมค่าใช้จ่าย**: $23.23 (2 keys: vision-agi $0.82 + api-visionagi $22.41)
- **ต่อวัน (ก่อน)**: ~$2.50/day = ~$75/mo
- **ตัวกินเงินเปล่า**: Autonomous Ideas ($18/mo), API Hunter ($10.5/mo), Lead Finder ($30/mo)

### 2. Feature Flags System — ✅ LIVE
| Item | Detail |
|------|--------|
| Dashboard | `https://oracle-agent-production-546e.up.railway.app/apiset` |
| Module | `tools/oracle-agent/lib/feature-flags.js` |
| UI | `tools/oracle-agent/public/apiset.html` |
| API | `GET /api/features`, `PATCH /api/features/:key` |
| Persist | `data/feature-flags.json` (survive restart) |
| Features | 18 toggles แบ่ง 6 categories |

### Disabled by Default:
- **Autonomous Ideas** (OFF) — ประหยัด ~$18/mo
- **API Hunter** (OFF) — ประหยัด ~$10.5/mo

### หลังปิด 2 ตัว:
- **ต่อวัน**: ~$1.55/day = ~$46.5/mo (ลด 38%)
- **ตัวกินเงินเยอะสุดที่เหลือ**: Lead Finder $1.00/day ($30/mo = 65% ของ cost)

### Cron Jobs ทั้งหมด (18 ตัว) เช็ค feature flag แล้ว:
- Core: Heartbeat, Morning Briefing, Evening Summary, LINE/Terminal Summarizer
- Hotel: Daily Summary, Check-out Reminder, Hourly Revenue
- Sales: Lead Finder, Lead Reply Check
- SEO: Keyword Alert
- Weekly: Forbes, Hospitality Trends, Revenue, SEO Report
- Experimental: Autonomous Ideas (OFF), API Hunter (OFF), Self-Reflection

### ไฟล์ที่สร้าง/แก้:
- `lib/feature-flags.js` (NEW) — module เก็บ state
- `public/apiset.html` (NEW) — dashboard UI
- `server.js` — import feature flags + API routes + ทุก cron เช็ค flag

---

## Session 2026-02-19 — Prama & Will Group

---

## 🆕 Session 2026-02-19 — Prama & Will Group

### สถานะ: ✅ ALL COMPLETE & LIVE

**Site:** Prama & Will Group
**Site ID:** `698abe8e6a8ba3cee537b884`
**Locale IDs:** en-TH `6996d0546e13990dbfe7b17d` | th-TH `6996df47ac608388f91cc7b9`

---

### 1. CMS Thai Localization — ✅ COMPLETE

**CMS Collections สร้างใหม่ (8 collections):**
- Blog Posts, Categories, Departments, Job Openings, Team Members, Success Stories, Services, Legal Pages

**TOC Engine:** Custom JS script ฝังผ่าน Custom Code (Before </body>) — scroll spy + sidebar nav อัตโนมัติ

**Thai Localization (ทั้งหมด):**

| ประเภท | จำนวน | สถานะ |
|--------|--------|--------|
| Pages (static) | 11 หน้า | ✅ |
| Components | 4 (CTA, Footer, Contact Form, CMS Navbar) | ✅ |
| CMS Templates | 7 (Blog, Services, Legal, Success Stories, etc.) | ✅ |
| Categories | 6/6 items | ✅ |
| Departments | 4/4 items | ✅ |
| Team Members | 12/12 items | ✅ |
| Job Openings | 4/4 items (metadata + body-content) | ✅ |
| Services | 6/6 items (metadata + body-content) | ✅ |
| Blog Posts | 6/6 items (metadata + body-content) | ✅ |
| Success Stories | 6/6 items (metadata + body-content) | ✅ |
| Legal Pages | 3/3 items | ⚠️ Skipped — API 404 (locale ไม่รองรับ) |

**Publish:** ✅ Published to Webflow subdomain (2026-02-19) — publish 2 รอบ

### 2. Cookie Consent PDPA — ✅ LIVE ทุกหน้า

| Item | Detail |
|------|--------|
| ระบบ | PDPA/GDPR compliant cookie consent (648 บรรทัด) |
| ภาษา | **ไทยทั้งหมด** — แปลจาก EN ครบทุกจุด |
| Architecture | MCP loader (2KB inline, header) → External JS จาก Railway |
| MCP Script | `cookie_consent_pdpa` v1.0.0 — applied site-wide header |
| External JS | `oracle-agent-production-546e.up.railway.app/scripts/cookie-consent.js` |
| Local file | `tools/oracle-agent/public/scripts/cookie-consent.js` |
| Deploy | ✅ Railway deployed (2026-02-19) |
| Features | Banner + Modal + FAB + 4 categories + script blocking (`data-cookie-category`) |
| Style | Prama CI: Navy #002248, Gold #FAA62A, Inter font, rounded buttons |

**UI ภาษาไทยที่แปล:**
- Banner: เว็บไซต์นี้ใช้คุกกี้ / ตั้งค่า / ปฏิเสธ / ยอมรับทั้งหมด
- Modal: ตั้งค่าความเป็นส่วนตัว / PDPA / ปฏิเสธทั้งหมด / ยอมรับทั้งหมด
- Categories: คุกกี้ที่จำเป็น (เปิดใช้งานเสมอ) / คุกกี้วิเคราะห์ / คุกกี้การตลาด / คุกกี้ปรับแต่ง
- Footer: ยกเลิก / บันทึกการตั้งค่า
- FAB: ตั้งค่าคุกกี้

### บทเรียน
```
1. API Verify จับ bug ได้! — 18 name fields หลุดเป็นอังกฤษ (Crash-Proof Protocol ช่วย)
2. MCP inline script จำกัด 2000 chars → ใช้ loader pattern โหลด external JS จาก Railway
3. Cookie consent ต้องแปลไทยทุกจุด — banner, modal, FAB, categories, aria-labels
```

### หมายเหตุ
- Thai locale content ถูกบันทึกแล้ว แต่จะแสดงผลเมื่อ client upgrade Webflow plan ที่รองรับ locale publishing
- Legal Pages (Privacy, Terms, Cookie) ไม่สามารถแปลผ่าน API ได้ — collection อาจถูกสร้างหลัง locale setup
- Main Navbar ต้องแปลมือใน Webflow Designer (hardcoded)
- Skill files: `webflow-cms.md`, `webflow-custom-scripts.md`

### Collection IDs (Prama)
```
Blog Posts:      6996d0546e13990dbfe7b196
Categories:      6996d4c6c91472327f24e67a
Departments:     6996d58c4e4d254025077faa
Job Openings:    6996d58f1dae99324c789e10
Team Members:    6996d81f5f9fd143a3f96646
Success Stories: 6996d9895d63bce26c122e0e
Services:        6996db3024509c77110291f5
Legal Pages:     6996dfe6f8a55a33615ac856
```

---

## Session 2026-02-17 — Billing System Build

### 4. สร้างระบบ Billing System ครบ
```
✅ Task #1: Data Layer — customers.json + documents.json
✅ Task #2: template-rc.html (ใบเสร็จรับเงิน สีเขียว) — มีอยู่แล้ว
✅ Task #3: API Endpoints — lib/billing.js (625 บรรทัด)
   - Customers CRUD: GET/POST/PUT /api/customers
   - Documents: GET /api/documents, GET /api/documents/:id
   - Create: POST /api/documents/create (QT/BL/RC)
   - PDF: POST /api/documents/generate-pdf, GET /api/documents/preview/:id
   - Send: POST /api/documents/send-email (attachments, default email body)
   - Mark Paid: POST /api/documents/mark-paid
   - Revenue: GET /api/documents/revenue
   - Overdue: GET /api/documents/overdue
   - Reminder: POST /api/documents/reminder
   - Static PDF: GET /api/documents/pdf/:number
✅ Task #4: Document Dashboard (Relume UI)
   - dashboard-documents/ (Vite + React + Relume + shared components)
   - Built → public/vision/documents/
   - URL: /vision/documents/
   - Features: Revenue KPIs, Overdue Alert, Documents Table, Customers, Preview Modal
✅ Task #5: ระบบแจ้งเตือนครบกำหนด
   - Cron 09:00 ทุกวัน เช็ค overdue → LINE/Telegram
   - Dashboard กดส่ง reminder email ได้เลย
```

### ไฟล์ใหม่ที่สร้าง
- `tools/oracle-agent/lib/billing.js` — API module
- `tools/oracle-agent/dashboard-documents/` — React dashboard (7 ไฟล์)
- `tools/oracle-agent/data/customers.json` — Customer database
- `tools/oracle-agent/data/documents.json` — Document database

### ไฟล์ที่แก้
- `tools/oracle-agent/server.js` — import billing, static serve, cron
- `tools/oracle-agent/dashboard-shared/config/navigation.js` — เพิ่มเมนู "เอกสาร"
- `tools/oracle-agent/dashboard-shared/components/Icons.jsx` — เพิ่ม BiFileText icon

---

### สิ่งที่ทำก่อนหน้า (session เดียวกัน)

### 1. เปลี่ยนเลขบัญชีธนาคาร
```
เก่า: 035-1-82502-2 นาย ธนกฤต ไชยทิพย์ (ไม่ใช้แล้ว)
ใหม่: 226-3-25037-3 บจก.วิสัยทัศน์ เอ็กซ์ เบรน ✅
```
อัพเดท 6 ไฟล์:
- `ψ/skills/quotation.md` (3 จุด)
- `tools/quotation/template.html`
- `tools/quotation/template-bl.html`
- `tools/quotation/QT2026020002.html`
- `tools/quotation/BL2026020001.html`
- `ψ/memory/knowledge/personal-items.md`

### 2. Gen PDF ใหม่ + ส่ง Email ลูกค้าทีดีที
- Gen PDF ใหม่: QT2026020002.pdf + BL2026020001.pdf (เลขบัญชีใหม่)
- ไฟล์แนบ: ใช้ `bookbank update.pdf` แทน `bookbank.pdf` เดิม
- ส่งเทส natiya.nami@gmail.com → OK
- **ส่งจริง natakorn.s@vssportsthailand.com (คุณณฐกร — ทีดีที เทรดดิ้ง) ✅**
- Subject: ทีดีที เทรดดิ้ง — ใบเสนอราคา + ใบวางบิลงวดที่ 1 (อัพเดทข้อมูลบัญชีธนาคาร)
- แนบ: QT, BL, สำเนาบัตร, สมุดบัญชี (ใหม่)

### 3. อัพเดท Skill Files
- `ψ/skills/quotation.md` — เพิ่มข้อมูลลูกค้าทีดีที + อัพเดท bookbank path + บัญชีใหม่

### บทเรียน
- natiya.nami@gmail.com = Tar ใช้เทส (ไม่ใช่ลูกค้า!)
- ลูกค้าจริง ทีดีที = natakorn.s@vssportsthailand.com คุณณฐกร
- ต้อง search Gmail sent ก่อนส่ง ถ้าไม่แน่ใจอีเมลลูกค้า

---

## งานหลักระยะยาว — Task #62: Service Page SEO Overhaul

> **Skill:** `ψ/skills/service-page-seo.md` ⭐⭐⭐ ← อ่านก่อนทำ!
> **กฎงาน:** `ψ/memory/active/current-task-rules.md` ← อ่านหลัง context reset!

### Scope
ปรับปรุง **126 service pages** ทั้ง Body Text CRO + Internal Links พร้อมกัน

| งาน | ทำเสร็จ | เหลือ |
|------|---------|-------|
| Body Text CRO | **66/126** ✅ | 60 หน้า |
| Internal Links (5/หน้า) | **66/126 ✅ Published** (330 links) | 60 หน้า (300 links) |

### Session 2026-02-25 Summary
- Page 65: `/services/event-website-design` — CRO + 5 links ✅ Published
- Page 66: `/services/premium-healthy-food-website-design` — CRO + 5 links ✅ Published
- Keywords: "เว็บอาหารสุขภาพ" vol:10, "healthy food website" vol:880

### Next Page (Page 67)
```
/services/food-franchise-website-design
page_id: 687a58a8107188066712b78d
category: อาหาร & F&B
73 remaining
```

### Script หา next page
```
node /tmp/next-page.js
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

## apibooking ↔ checkin Cross-Project (2026-02-16)

| Item | Detail |
|------|--------|
| สถานะ | ✅ Checkin Status Sync LIVE — badge แสดงใน dashboard |
| apibooking | `/Users/tanakitchaithip/Desktop/apibooking/` → `git@github.com:qualyads/apibooking.git` |
| checkin | `/Users/tanakitchaithip/Desktop/checkin/` → `git@github.com:qualyads/checkin.git` |
| Skill | `ψ/skills/checkin-status-sync.md` ⭐⭐ |
| Knowledge | `ψ/memory/knowledge/checkin-system.md` section 13 |
| Features | Batch API, 📱/🖥️ badge + เวลา, auto-refresh 60s, timezone Bangkok |
| Backlog | gen booking ID + QR code สำหรับ Walk-in, ดู section 13 |
| **Fix 2026-02-16** | ✅ C10/C11 room mapping สลับกัน — แก้ checkin beds24.ts + mock-data.ts + deployed (`61b3ceb`) |

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
| **Skill** | `ψ/skills/email-marketing.md` ⭐⭐⭐⭐⭐ (v8) |
| Auto-send | ✅ ENABLED — max 20/day, priority scored |
| **Cost/mo** | **1,292 THB** ($38) — ลด 79% จากเดิม 6,178 THB |
| **SMTP Verify** | ✅ 3-layer: blacklist → MX → SMTP RCPT TO (2026-02-16) |
| **Auto Audit** | ✅ Reply → classify → interested = auto send audit report (2026-02-16) |
| **Bounce Fix** | ✅ Detect Outlook/Hotmail/generic + follow-up ไม่ส่งไป bounced (2026-02-16) |
| **ห้าม ค่ะ** | ✅ ใช้ "ครับ" เท่านั้น ทั้ง cold + follow-up (2026-02-16) |
| **Reply Domain** | ✅ ค้น reply ด้วย @domain ไม่ใช่แค่ exact email (2026-02-16) |
| **Dashboard Reply** | ✅ แสดงข้อความตอบกลับ + classification badge (2026-02-16) |
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
Service Page CRO:       66/126 ✅ (52%) → ψ/skills/service-page-seo.md
Service Page IL:        66/126 ✅ (330 links) → ψ/skills/service-page-seo.md
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
