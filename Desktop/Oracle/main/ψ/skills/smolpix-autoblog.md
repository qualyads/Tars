# Smolpix Auto-Blog — Skill File

> ระบบ auto-publish บทความ SEO สำหรับ smolpix.co
> Location: `/Users/tanakitchaithip/Downloads/pixie-main/`
> Knowledge Base: `ψ/memory/knowledge/smolpix-project.md`

---

## Quick Reference

| Item | Value |
|------|-------|
| **Domain** | smolpix.co |
| **Railway** | Project: cheerful-peace, Service: pixie |
| **Railway ID** | `aeddc4d8-9e59-4078-8728-1c13d29dfa2d` |
| **DB** | Railway Postgres (`DATABASE_URL` env) |
| **Google SC** | `sc-domain:smolpix.co` (siteOwner) |
| **Auto-blog schedule** | 09:00 Bangkok (ทุกวัน, 1 บทความ) |
| **Catch-up** | 5 ชม. หลัง schedule (10:00-14:00) |
| **Daily limit** | 1 บทความ/calendar day (Bangkok midnight) |
| **Race protection** | 3 ชั้น: in-memory mutex + atomic topic lock + daily limit |
| **DB Public URL** | `postgresql://postgres:glTi...@switchback.proxy.rlwy.net:12890/railway` |
| **AI model** | Claude Sonnet 4.6 (content), Claude Haiku 4.5 (prompts) |
| **Image gen** | Kie.ai (nano-banana-pro) |
| **Cost** | ~$0.085/บทความ (~3 บาท) |

---

## Architecture

```
Cron (*/15 * * * * Bangkok)
  → auto-publish-topics/route.ts
    → IN-MEMORY MUTEX CHECK (isProcessing)
    → getAutoBlogSettings()
    → DAILY LIMIT CHECK (calendar day Bangkok midnight)
    → isScheduledTime() OR catch-up (5h window, 10:00-14:00)
    → ATOMIC TOPIC LOCK (PENDING → IN_PROGRESS, WHERE status=PENDING)
    → getKeywordInsights() (RapidAPI)
    → generateArticleContent() (Claude Sonnet, 43 rules)
    → generateFeaturedImage() (Kie.ai)
    → processContentImages() (up to 3 inline)
    → processInternalLinks() (keyword matching, max 7)
    → removeCompetitorLinks() (19 domains)
    → cleanupGeneratedContent() (11 fixes, incl. brand limit + code block inject)
    → prisma.blogArticle.create()
    → prisma.contentTopic.update(COMPLETED)
    → Gmail notification (Oracle Agent → Brevo fallback)
    → Sitemap submit (Oracle Agent → Google SC)
    → finally: isProcessing = false
  ON ERROR:
    → Revert topic status to PENDING (retry next cycle)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auto-blog/content-generation.ts` | 43-rule system prompt, Claude Sonnet |
| `src/lib/auto-blog/image-generation.ts` | Kie.ai + Claude Haiku prompts |
| `src/lib/auto-blog/utils.ts` | Internal links, slug, scheduling, cleanup |
| `src/lib/auto-blog/settings.ts` | Admin settings, API keys, callClaude() |
| `src/lib/scheduler.ts` | node-cron: */15 auto-publish, */5 scheduled, */30 heartbeat |
| `src/lib/brevo.ts` | Gmail API (Oracle Agent) primary + Brevo fallback |
| `src/lib/keyword-insight.ts` | Google Keyword Insight via RapidAPI |
| `src/app/api/cron/auto-publish-topics/route.ts` | Main cron endpoint |
| `src/app/sitemap.ts` | Dynamic sitemap from DB |

---

## 43 SEO Rules (content-generation.ts)

### Core (1-25)
- 7-section structure: intro → key points → step-by-step → pro tips → mistakes → FAQ → conclusion
- AEO/GEO optimization (Answer Capsule, structured data)
- Min 2000 words, max 12 tags, max 3 images, max 7 FAQ

### Oracle Techniques (26-39)
- Anti-repetition (26-29): ห้ามซ้ำคำ/วลี/โครงสร้าง
- Hook patterns (30): 8 patterns หมุนเวียน
- Conversational tone (31-34): natural, ไม่ formal เกินไป
- E-E-A-T credibility (35-39): ตัวเลข/แหล่งอ้างอิง

### Quality Enforcement (40-43) + Post-Processing
- Rule 40: SEO title ≥50, ≤60 chars
- Rule 41: Code block ≥2 (```html/css) — 🚨 CRITICAL, MANDATORY
- Rule 42: Brand mention ≤5 ครั้ง — 🚨 STRICT MAX 5
- Rule 43: ## heading ต้อง blank line ก่อน/หลัง

### Post-Processing Safety Net (utils.ts cleanupGeneratedContent)
- Fix 1-9: sitemap URLs, double bullets, CTA links, fragments, etc.
- Fix 10: Brand mention reduction (keep first 2 + last 2, replace middle)
- Fix 11: Code block injection if AI forgot (picture element example)

---

## Internal Links

```typescript
// utils.ts — processInternalLinks()
// 1. ดึง published articles จาก DB
// 2. extractLinkableKeywords() → keyword scoring:
//    - title match: +10, word match: +3, tag match: +5, category: +8
// 3. Scan content → regex match keywords
// 4. Always use matched keyword as anchor text (ห้าม variant)
// 5. Max 7 inline links, min 300 chars apart
// 6. Skip self-link (same slug)
```

---

## Sitemap Auto-Submit

| ช่องทาง | Schedule | Endpoint |
|---------|----------|----------|
| **Cron ทุก 3 วัน** | `0 10 */3 * *` Bangkok | Oracle agent cron |
| **Event-driven** | หลัง publish บทความ | `POST oracle-agent/api/seo/submit-sitemap/smolpix` |
| **Manual** | เรียกเมื่อไหร่ก็ได้ | `POST oracle-agent/api/seo/submit-sitemap/smolpix` |
| **Debounce** | 1 ชม. (ป้องกัน submit ถี่เกิน) | `lastSmolpixSitemapSubmit` variable |

### Oracle Agent Code (server.js)
```javascript
// submitSmolpixSitemap(reason) → searchConsole.submitSitemap('sc-domain:smolpix.co', 'https://smolpix.co/sitemap.xml')
// cron.schedule('0 10 */3 * *', ...) — ทุก 3 วัน 10:00 Bangkok
// POST /api/seo/submit-sitemap/smolpix — API endpoint
// GET /api/seo/sitemaps?site=sc-domain:smolpix.co — ดูสถานะ sitemap
```

### Auto-publish trigger (route.ts)
```typescript
// หลัง publish สำเร็จ → POST oracle-agent/api/seo/submit-sitemap/smolpix
// ใช้ ORACLE_AGENT_URL + ORACLE_API_KEY env vars
```

---

## Competitor Blocklist (19 domains)

tinypng, squoosh, imageoptim, shortpixel, imagify, optimole, cloudinary, imgix, sirv, uploadcare, kraken.io, compressor.io, compressjpeg, iloveimg, picresize, ezgif, bulkresizephotos, photopea, canva

---

## Email Notifications

```
Gmail API (primary):
  POST oracle-agent/api/gmail/send {to, subject, body}
  ส่งจาก vxb.visionxbrain@gmail.com

Brevo (fallback):
  POST api.brevo.com/v3/smtp/email
  ใช้ BREVO_API_KEY จาก AdminSettings
```

Notification types:
1. **Article Started** — เริ่มเขียนบทความ
2. **Article Published** — publish สำเร็จ (single)
3. **Batch Published** — publish หลายบทความ

---

## Deploy Commands

```bash
# ต้อง verify project ก่อน deploy เสมอ!
cd /Users/tanakitchaithip/Downloads/pixie-main
railway status  # ต้องเห็น: cheerful-peace / pixie / production

# Build + Deploy
npm run build && railway up --detach

# ดู logs
railway logs --lines 50
```

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|--------|---------|
| Cron ไม่ fire | เช็ค scheduler.ts boot, ดู railway logs |
| บทความซ้ำ 2 ตัว/วัน | ป้องกัน 3 ชั้น: mutex + atomic lock + daily limit (calendar day) |
| ไม่โพสวันนี้ (daily limit) | เช็คว่าใช้ calendar day Bangkok ไม่ใช่ rolling 24h |
| ไม่โพส (catch-up หมด) | catch-up window 5h (ถึง 14:00) — ขยายได้ใน route.ts line 92 |
| Race condition ซ้ำ | mutex `isProcessing` + atomic PENDING→IN_PROGRESS + error revert |
| Brand mention > 5 | Fix 10 ใน utils.ts cleanupGeneratedContent ลดอัตโนมัติ |
| ไม่มี code block | Fix 11 inject picture element อัตโนมัติ |
| Internal link anchor แปลก | ต้องใช้ matched keyword เท่านั้น (ห้าม variant) |
| Image gen fail | Kie.ai retry 3 ครั้ง, 90s timeout, ดู logs |
| Sitemap not submitted | เช็ค Oracle agent logs `[SMOLPIX-SEO]`, debounce 1h |
| DB connection fail | Railway Postgres อาจ restart, retry ได้ |
| Google indexed: 0 | ปกติสำหรับเว็บใหม่ รอ Google crawl |

---

## DB Access

```bash
# Public URL (ใช้จาก local ได้)
DATABASE_URL="postgresql://postgres:glTiNRCeTuVUgQTPFdDfJyWsPSgFqMDm@switchback.proxy.rlwy.net:12890/railway"

# ใช้กับ Prisma
cd /Users/tanakitchaithip/Downloads/pixie-main
DATABASE_URL="..." node -e 'const {PrismaClient}=require("@prisma/client"); ...'

# หรือดึงจาก Railway
cd /Users/tanakitchaithip/Downloads/pixie-main
railway variables --service Postgres --json | python3 -c "import sys,json; print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])"
```

---

## Verified Status (2026-02-21)

- [x] Auto-publish ทุกวัน 09:00 (+ catch-up 5h ถึง 14:00)
- [x] Daily limit 1 บทความ/calendar day (Bangkok midnight)
- [x] Race condition protection 3 ชั้น (mutex + atomic lock + daily limit)
- [x] Error recovery: revert topic to PENDING on failure
- [x] 43 SEO rules + post-processing Fix 10 (brand limit) + Fix 11 (code block inject)
- [x] Internal links ใช้ matched keyword (no broken anchors)
- [x] Sitemap submit ทุก 3 วัน + event-driven
- [x] Gmail + Brevo email notifications
- [x] Google SC property verified (siteOwner)
- [x] 31 published articles, 10 pending topics, 0 duplicates
- [x] Full duplicate audit passed (2026-02-21)
