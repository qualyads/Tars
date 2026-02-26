# Skill: เอกสารธุรกิจ (Business Documents)

> เรียนรู้จาก 28 ใบเสนอราคาของ VXB (2022-2025) + Webflow template
> ใช้ skill นี้เมื่อ Tar บอกให้เขียน ใบเสนอราคา / ใบวางบิล / ใบเสร็จรับเงิน

## ประเภทเอกสาร

| ประเภท | Prefix | Template | สี Accent | ใช้เมื่อ |
|--------|--------|----------|-----------|---------|
| ใบเสนอราคา | QT | `template.html` | ส้ม `#e79b4d` | เสนอราคาลูกค้า |
| ใบวางบิล | BL | `template-bl.html` | น้ำเงิน `#4d7ae7` | เรียกเก็บเงินตามงวด |
| ใบเสร็จรับเงิน | RC | `template-rc.html` | เขียว `#4daa54` | ยืนยันรับชำระเงิน |

### Flow ปกติ
```
QT (เสนอราคา) → ลูกค้า OK → BL (วางบิลงวดที่ 1) → ลูกค้าจ่าย → RC (ใบเสร็จงวดที่ 1)
                                BL (วางบิลงวดที่ 2) → ลูกค้าจ่าย → RC (ใบเสร็จงวดที่ 2)
```

### Number Format
```
{PREFIX}{YYYY}{MM}{XXXX}

QT2026020002 = ใบเสนอราคา ปี 2026 เดือน 02 ลำดับ 0002
BL2026020001 = ใบวางบิล ปี 2026 เดือน 02 ลำดับ 0001
RC2026020001 = ใบเสร็จ ปี 2026 เดือน 02 ลำดับ 0001
```

> แต่ละประเภทรันเลขแยกกัน — ดู `qt-tracker.json`

---

## ข้อมูลบริษัท (ล่าสุด 2025)

```
VISION X BRAIN CO., LTD
104 หมู่ 6 ตำบลเวียงใต้ อำเภอปาย จังหวัดแม่ฮ่องสอน 58130
เลขประจำตัวผู้เสียภาษี: 0585564000175
เบอร์มือถือ: 097-153-6565
ผู้ขาย: Tanakit Chaithip
เว็บ: www.visionxbrain.com
```

### บัญชีธนาคาร
```
ธนาคารกสิกรไทย สาขาปาย
บัญชีออมทรัพย์ 226-3-25037-3
บจก.วิสัยทัศน์ เอ็กซ์ เบรน
```
> ⚠️ บัญชีเก่า (035-1-82502-2 นาย ธนกฤต ไชยทิพย์) ไม่ใช้แล้ว
> ⚠️ บัญชีบริษัท (153-8-29407-8) ปิดแล้ว
> ยืนยันโดย Tar: 2026-02-17

---

## ปัญหาที่พบจาก 28 ใบเสนอราคาเดิม

### 1. ชื่อบริษัท/ที่อยู่ไม่คงที่
| ช่วง | ชื่อ | ที่อยู่ |
|------|------|--------|
| 2022 | VISION X BRAIN | 769 หมู่ 8 |
| 2023 | VISION X BRAIN (สำนักงานใหญ่) | 769 หมู่ 8 |
| 2024 บาง QT | นาย ธนกฤต ไชยทิพย์ | 201 หมู่ 2 ต.ดอนแก้ว |
| 2025 | VISION X BRAIN CO., LTD | 104 หมู่ 6 |

**แก้:** ใช้ "VISION X BRAIN CO., LTD" + ที่อยู่ 104 หมู่ 6 เสมอ

### 2. ภาษาสลับไปมา
- 2022-2023: ส่วนใหญ่ภาษาอังกฤษ
- 2024: ผสม
- 2025: ส่วนใหญ่ภาษาไทย

**แก้:** ถ้าลูกค้าไทย → ใช้ไทย | ลูกค้าต่างชาติ → ใช้อังกฤษ ห้ามผสม

### 3. Payment Terms ไม่เป็นมาตรฐาน
- บาง QT: 50/50
- บาง QT: 30/30/40
- บาง QT: 100% ก่อนเริ่ม
- บาง QT: เขียนผิดแล้วหมายเหตุ "เขียนผิดนะอย่าลืมกลับมาแก้"

**แก้:** ดูตาราง Payment Terms ด้านล่าง

### 4. รายละเอียดงานบางที่ละเอียด บางที่สั้นมาก
- ฿120K (Workpoint) = 1 บรรทัด
- ฿100K (NGG) = 5 หัวข้อ detail มาก

**แก้:** ใช้ Standard Structure 5 หัวข้อเสมอ

### 6. เลขภาษี/บัญชีธนาคาร ห้าม AI gen!

> **CRITICAL:** เลขภาษีและเลขบัญชีต้องถูกต้อง 100%
> ห้าม gen จากความจำ — ต้องอ้างจากไฟล์หรือ Tar ยืนยัน
> ถ้าไม่แน่ใจ → ถาม Tar ก่อนใส่

**ที่ยืนยันได้จาก PDF จริง:**
- เลขภาษี VXB: `0585564000175` (ตรงทุกใบ 2025)
- บัญชี: `226-3-25037-3` กสิกร สาขาปาย บจก.วิสัยทัศน์ เอ็กซ์ เบรน ✅ (Tar ยืนยัน 2026-02-17)
- ⚠️ บัญชีเก่า `035-1-82502-2` นาย ธนกฤต ไชยทิพย์ — ไม่ใช้แล้ว!
- ⚠️ บัญชีบริษัท `153-8-29407-8` ปิดแล้ว — ห้ามใช้!

### 5. ไม่มี Warranty/MA ในใบเก่า
- 2022-2023: ไม่มีเลย
- 2025: มี 6 เดือน + Training ฟรี

**แก้:** ใส่ทุกใบ (เป็นจุดขาย)

### 6. ใช้คำที่ทำให้ลูกค้าเข้าใจผิด / ทำตัวเองลำบาก
**แก้:** ดู "กฎป้องกันปัญหา" ด้านล่าง

---

## กฎป้องกันปัญหา (บังคับ!)

### 1. ห้ามใช้คำที่ทำให้ลูกค้าเข้าใจผิด
| คำที่ห้ามใช้ | ปัญหา | ใช้แทน |
|-------------|-------|--------|
| "SEO" (ลอยๆ) | ลูกค้าคิดว่าเราทำ SEO ให้ | "ตั้งค่า Meta/OG/Sitemap เบื้องต้น" |
| "SEO On-page Setup" | ยังคลุมเครือ | "ตั้งค่าพื้นฐานสำหรับ SEO (Meta Title, Description, OG Image, Sitemap, Robots.txt)" |
| "ติดตามยอดขาย" | ถ้า platform ทำไม่ได้ native จะลำบาก | ต้อง research ก่อนว่า platform รองรับไหม |
| "คอมมิชชั่นอัตโนมัติ" | อาจต้องใช้ app เสริม (มีค่าใช้จ่าย) | ระบุชัดว่าใช้ app อะไร + ลูกค้าจ่ายค่า app เอง |

### 2. ห้ามสัญญาสิ่งที่ทำให้ตัวเองลำบาก
| สิ่งที่ห้ามเขียน | เหตุผล | ใช้แทน |
|-----------------|--------|--------|
| "คู่มือ PDF + Video" | ขี้เกียจทำ video | **"คู่มือการใช้งาน (PDF)"** เท่านั้น |
| "Workshop ไม่จำกัด" | เสียเวลา | "Workshop 1 ครั้ง" |
| "แก้ไขไม่จำกัดรอบ" | วนลูปไม่จบ | "แก้ไขตาม scope ที่ตกลง" |

### 3. ค่าบริการภายนอก — ลูกค้าจ่ายเอง (ระบุในหมายเหตุ)
| บริการ | ตัวอย่าง | ระบุว่า |
|--------|---------|--------|
| Hosting | Webflow, Shopify, Vercel | "ค่าบริการ {Platform} ลูกค้าชำระโดยตรง" |
| Server/Infra | Railway, AWS, Supabase | "ค่าบริการ Server ลูกค้าชำระโดยตรง" |
| Third-party Apps | Shopify apps, Linguise | "ค่าบริการ App เสริม ({ชื่อ}) ลูกค้าชำระโดยตรง" |
| Domain | GoDaddy, Cloudflare | "ค่า Domain ลูกค้าชำระโดยตรง" |

### 4. อ้างอิงเอกสารลูกค้า
> ถ้าลูกค้าส่งเอกสาร requirement มา (Google Docs, PDF, Slides) → **ต้องอ้างอิงในใบเสนอราคา**

```
ตัวอย่าง:
"ขอบเขตงานตามเอกสาร Website Function ที่ลูกค้าจัดทำ
และรายละเอียดเพิ่มเติมตามที่ตกลงร่วมกัน"
```

ใส่ในหมายเหตุ หรือใต้ชื่องาน

### 5. Research ก่อนเขียนทุกครั้ง
> ถ้างานใช้ platform ที่ไม่แน่ใจ (Shopify, WordPress, etc.) → **ต้อง research ว่า feature ที่จะเขียนในใบ ทำได้จริงไหม**

ตัวอย่าง Shopify:
- Affiliate → ไม่มี native (ต้องใช้ app หรือเขียนเอง)
- Loyalty → ไม่มี native (ต้องใช้ app หรือเขียนเอง)
- 2 ภาษา → ต้องใช้ app (Langify, Weglot, etc.)

> **หมายเหตุ:** Tar เขียน affiliate/loyalty เองได้ (custom dev)
> ถ้าเขียนเอง → ใช้คำว่า "พัฒนาระบบ" (ไม่ใช่ "ติดตั้ง App")
> ถ้าใช้ app → ระบุว่าลูกค้าจ่ายค่า app เอง

---

## Standard Structure (ใช้ทุกใบ)

### Header
```
ใบเสนอราคา
VISION X BRAIN CO., LTD
104 หมู่ 6 ตำบลเวียงใต้ อำเภอปาย จังหวัดแม่ฮ่องสอน 58130
เลขประจำตัวผู้เสียภาษี 0585564000175
เบอร์มือถือ 097-153-6565

เลขที่: QT{YYYY}{MM}{XXXX}
วันที่: DD/MM/YYYY
ผู้ขาย: Tanakit Chaithip
ชื่องาน: {ชื่อโปรเจค}
```

### ข้อมูลลูกค้า
```
ลูกค้า: {ชื่อบริษัท} ({สำนักงานใหญ่/สาขา})
ที่อยู่: {ที่อยู่เต็ม}
เลขประจำตัวผู้เสียภาษี: {เลข 13 หลัก}
ผู้ติดต่อ: {ชื่อ}
เบอร์โทร: {เบอร์}
อีเมล: {อีเมล}
```

### รายการ (5 หัวข้อมาตรฐาน สำหรับ Webflow)

| # | หัวข้อ | รายละเอียด | ราคา |
|---|--------|-----------|------|
| 1 | **Creative Direction & UX/UI Strategy** | ออกแบบ UX/UI, โครงสร้างเว็บ, Responsive | {ราคา} |
| 2 | **Webflow Development & CMS Integration** | พัฒนา Webflow, Client-First System, CMS, ตั้งค่า Meta/OG/Sitemap | {ราคา} |
| 3 | **Brand Visual Design & AI-Driven Imagery** | Mood Board, ภาพ AI, ฟอนต์ลิขสิทธิ์ | {ราคา} |
| 4 | **Knowledge Transfer & Training** | Workshop 1 ครั้ง + คู่มือ PDF | **ฟรี** |
| 5 | **Quality Assurance & Support** | รับประกัน 6 เดือน, MA เสริมได้ | **ฟรี** |

> หมายเหตุ: ปรับหัวข้อตามประเภทงาน (ดู Templates ด้านล่าง)

### Payment Terms (มาตรฐาน)

| ยอดรวม | เงื่อนไข |
|--------|---------|
| ต่ำกว่า ฿30K | 100% ก่อนเริ่มงาน |
| ฿30K - ฿100K | 50% ก่อนเริ่ม / 50% หลังส่งมอบ |
| ฿100K - ฿200K | 30% ก่อนเริ่ม / 40% เมื่อคืบหน้า 80% / 30% หลังส่งมอบ |
| มากกว่า ฿200K | 30% ก่อนเริ่ม / 30% เมื่อคืบหน้า 50% / 40% หลังส่งมอบ |

### Timeline (มาตรฐาน)

| ขอบเขต | ระยะเวลา |
|--------|---------|
| Landing Page เดียว | 7-14 วัน |
| Website 5-10 หน้า | 14-30 วัน |
| Website + CMS + Blog | 21-45 วัน |
| E-commerce / Complex | 30-60 วัน |
| Add-on เล็กๆ | 3-7 วัน |

### หมายเหตุ (ใส่ทุกใบ)
```
- ราคานี้ยังไม่รวมภาษีมูลค่าเพิ่ม (VAT 7%)
- ค่าบริการ {Platform} ลูกค้าชำระโดยตรง
- ค่าบริการ App เสริม/Server ภายนอก (ถ้ามี) ลูกค้าชำระโดยตรง
- Vision X Brain จะเป็นผู้ดูแลการตั้งค่าและการใช้งานระบบทั้งหมด
- ขอบเขตงานตามเอกสาร {ชื่อเอกสาร} ที่ลูกค้าจัดทำ (ถ้ามี)
- ระยะเวลาดำเนินงาน: {X} วัน (ขึ้นอยู่กับความเร็วในการให้ Feedback)
- ใบเสนอราคามีอายุ 30 วันนับจากวันที่ออก
```

### Footer (ลงนาม)
```
ในนาม {ชื่อบริษัทลูกค้า}        ในนาม VISION X BRAIN CO., LTD

{วันที่}
ผู้สั่งซื้อสินค้า     วันที่     ผู้อนุมัติ     วันที่
```

---

## Pricing Reference (จากใบเก่า)

| ประเภทงาน | ราคา | ตัวอย่าง |
|-----------|------|---------|
| Landing Page | ฿30K-50K | Waanx, แมวขยันดี |
| Corporate Website (Webflow) | ฿80K-140K | Safety Training, Hi-End Electrical |
| Website + CMS + Blog | ฿100K-150K | NGG, สถาบัน Finn |
| E-commerce Website | ฿100K-150K | GYM-X, Mergeofficial |
| Game Website (Wiki+CMS) | ฿240K | Alpaca Story (Workpoint) |
| UI/UX Design Only (Figma) | ฿8K-30K | TalentSphere, Quantum Trading |
| Add-on Function | ฿7K-28K | Linguise, CDN, Analytics |
| Google Ads Management | ฿5.7K/เดือน | The Legacy Wedding |
| Maintenance Package | ฿15K/เดือน | Huasenghong |
| SEO Blog Writing | ฿30K-50K | สถาบัน Finn Blog |
| Enterprise Account Registration | ฿120K | Workpoint (Stream, Google Play, Apple) |

---

## Templates ตามประเภทงาน

### Template A: Website Webflow (ใช้บ่อยสุด)
1. Creative Direction & UX/UI Strategy
2. Webflow Development & CMS Integration
3. Brand Visual Design & AI-Driven Imagery
4. Knowledge Transfer & Training — ฟรี
5. Quality Assurance & Support — ฟรี

### Template B: Add-on / Technical
1. {ชื่องาน + scope ชัดเจน}
- รายการ 1 บรรทัดก็ได้ถ้า scope ชัด

### Template C: Monthly Service (Ads/MA)
1. ค่าบริการ {Platform} (งบ + VAT)
2. ค่าบริหารจัดการการตลาด

### Template D: Design Only (Figma)
1. UX/UI Design
2. Color Code & Theme Guide
3. Final Presentation & File Delivery

### Template E: SAP/Workflow Integration (ใหม่!)
1. Discovery & Requirements Analysis
2. Workflow Design & Configuration
3. API Integration & Testing
4. Training & Documentation — ฟรี
5. Support & Maintenance (6 เดือน) — ฟรี

---

## QT Number Format

```
QT{YYYY}{MM}{XXXX}

ตัวอย่าง:
QT2025090001 = ปี 2025, เดือน 09, ลำดับ 0001
```

### Tracker (บังคับ!)
> **ก่อนสร้าง QT ใหม่ → ต้อง Read `tools/quotation/qt-tracker.json` ก่อนเสมอ**
> แล้วอัพเดทหลังสร้างเสร็จ

ไฟล์: `main/tools/quotation/qt-tracker.json`

วิธีรันเลข:
1. Read qt-tracker.json → ดู `last_qt`
2. เลขใหม่ = เดือนปัจจุบัน + ลำดับถัดไป
3. ถ้าเดือนเดียวกัน → +1 (เช่น 0001 → 0002)
4. ถ้าเดือนใหม่ → reset เป็น 0001
5. สร้าง QT เสร็จ → อัพเดท qt-tracker.json ทันที

---

## Checklist ก่อนส่งใบเสนอราคา

- [ ] ชื่อบริษัท/ที่อยู่ถูกต้อง (ทั้ง VXB และลูกค้า)
- [ ] เลข Tax ID ถูกต้อง
- [ ] ภาษาเดียวตลอดทั้งใบ (ไทยหรืออังกฤษ)
- [ ] Payment terms ตรงตามมาตรฐาน
- [ ] ระบุ "ไม่รวม VAT 7%"
- [ ] ระบุ "Hosting ลูกค้าชำระเอง"
- [ ] มี Training ฟรี + QA 6 เดือน
- [ ] ระยะเวลาดำเนินงานชัดเจน
- [ ] ตัวเลขรวมถูกต้อง (ไม่เขียนผิด!)
- [ ] QT Number ไม่ซ้ำ

---

## ลูกค้าประจำ

| ลูกค้า | จำนวน QT | ประเภทงาน |
|--------|---------|-----------|
| บ. สยามตาก | 3 ใบ | Webflow, CDN, Linguise |
| บ. แพร็กมา แอนด์ วิลล์ กรุ๊ป | 4 ใบ | Webflow, Figma, Voice Demo |
| บ. เวิร์คพอยท์ (มหาชน) | 3 ใบ | Account, Game Website |
| บ. วาฬ เอ็กเชนจ์ | 2 ใบ | Landing Page, Trading UI |
| บ. แมวขยันดี | 2 ใบ | Website, Analytics |
| บ. ทีดีที เทรดดิ้ง | 1 ใบ (QT2026020002) | Shopify Custom Theme E-commerce |
| บ. เอเวอร์สกิน เมดิคอล | 1 ใบ (QT2026020003) | Webflow คลินิกความงาม 2 ภาษา |

### ข้อมูลลูกค้า — เอเวอร์สกิน เมดิคอล (EY Clinic)
```
บริษัท เอเวอร์สกิน เมดิคอล จำกัด
152/2-3 ซอยสะพานยาว ถนนสี่พระยา แขวงสี่พระยา เขตบางรัก กรุงเทพฯ 10500
Tax ID: 0105563072991
ผู้ติดต่อ: คุณ Pete
Email: everskinmedical@gmail.com
QT: QT2026020003 (90,000 บาท) — Webflow คลินิกความงาม 2 ภาษา (TH/EN)
BL: BL2026020002 (งวดที่ 1 — 27,000 บาท, ครบกำหนด 04/03/2026)
Email ส่ง QT แล้ว: 25/02/2026
```

### ข้อมูลลูกค้า — ทีดีที เทรดดิ้ง
```
บริษัท ทีดีที เทรดดิ้ง จำกัด (สำนักงานใหญ่)
111/1 อาคารนวสร ชั้น 14 ห้อง 1405 ถ.พระราม 3 แขวงบางคอแหลม เขตบางคอแหลม กรุงเทพฯ 10120
Tax ID: 0105562188359
ผู้ติดต่อ: คุณณฐกร
โทร: 084-346-0391
Email: natakorn.s@vssportsthailand.com
QT: QT2026020002 (230,000 บาท) — Shopify Custom Theme 2 ภาษา + Affiliate & Loyalty
BL: BL2026020001 (งวดที่ 1 — 115,000 บาท)
```

---

## PDF Generation

### ไฟล์ที่เกี่ยวข้อง
```
main/tools/quotation/
├── template.html          # QT ใบเสนอราคา (ส้ม #e79b4d)
├── template-bl.html       # BL ใบวางบิล (น้ำเงิน #4d7ae7)
├── template-rc.html       # RC ใบเสร็จรับเงิน (เขียว #4daa54)
├── qt-tracker.json        # ติดตามเลข QT/BL/RC ล่าสุด
├── QT2026020002.html      # ตัวอย่างจริง (ทีดีที เทรดดิ้ง)
└── QT2026020002.pdf       # PDF ที่สร้างจาก HTML
```

### Design (v3 — Webflow-based, print-optimized)
- **ฟอนต์:** FCVision (โหลดจาก Webflow CDN) — เหมือนเว็บ visionxbrain.com
- **พื้นหลัง:** `#f5f5f5` (เทาอ่อน)
- **แถบส้ม:** `#e79b4d` — 1 แถบ divider หลัก
- **เส้นบาง:** `rgba(22,22,22,0.12)` — คั่นระหว่าง items
- **สีตัวอักษร:** `#000` หัวข้อ, `#686868` รายละเอียด/meta
- **"ฟรี":** สีเขียว `#2e7d32`
- **หมายเหตุสำคัญ:** สีแดง `#c62828`
- **Logo:** SVG embed ตรง (gradient แดง→ม่วง + สีเทา), width 220px
- **จบใน 1 หน้า A4** (`.page { height: 297mm; overflow: hidden; }`)

### Font Sizes (print-optimized)
| Element | Size |
|---------|------|
| ชื่อเอกสาร (heading-style-h5) | 18px |
| หัวข้อ items (heading-style-h6) | 12px |
| ตัวเลขยอดรวม | 16px |
| body base | 11px |
| meta/doc_box | 10px |
| รายละเอียด/notes | 10px |
| label | 8px |

### Layout Structure
```
.page (210mm x 297mm, padding 14mm 16mm)
├── Logo (SVG 220px)
├── Header (flex: company ซ้าย / doc meta ขวา)
├── Orange Divider (1 แถบ)
├── Content (.qt_flex_auto, flex: 1)
│   ├── Customer Section (grid 1fr 1fr)
│   ├── Divider thin
│   └── Items (.doc_qt_grid: 1fr 120px) × N
│       ├── qt_space _01 (ชื่อ + รายละเอียด)
│       └── qt_space _02 (ราคา ชิดขวา)
└── Bottom (.bottom-section)
    ├── Payment + Total (.doc_qt_grid)
    │   ├── _01: terms + bank info
    │   └── _02: รวมเป็นเงิน + บาทอ่าน
    └── Notes + Signature (.doc_qt_grid)
        ├── _01: notes
        └── _02: ลงนาม + เส้น
```

### Placeholders ใน template.html
| Placeholder | คำอธิบาย |
|-------------|---------|
| `{{QT_NUMBER}}` | เลข QT เช่น QT2026020002 |
| `{{DATE}}` | วันที่ DD/MM/YYYY |
| `{{DEADLINE}}` | ส่งมอบภายใน เช่น Q1/2026 |
| `{{CUSTOMER_NAME}}` | ชื่อบริษัทลูกค้า (เต็ม) |
| `{{CUSTOMER_SHORT}}` | ชื่อสั้นสำหรับ title |
| `{{CUSTOMER_ADDRESS}}` | ที่อยู่ลูกค้า (กระชับ — รวมบรรทัดได้) |
| `{{CUSTOMER_TAX_ID}}` | เลข Tax ID 13 หลัก |
| `{{CUSTOMER_PHONE}}` | เบอร์โทร |
| `{{PROJECT_NAME}}` | ชื่อโปรเจค |
| `{{PROJECT_DESCRIPTION}}` | รายละเอียดโปรเจค (กระชับ) |
| `{{ITEMS}}` | HTML blocks ของรายการ (ดู Item Format ด้านล่าง) |
| `{{TOTAL_AMOUNT}}` | ยอดรวม เช่น 230,000.00 |
| `{{TOTAL_TEXT}}` | ตัวอักษร เช่น สองแสนสามหมื่นบาทถ้วน |
| `{{PAYMENT_TERMS}}` | ข้อความงวดชำระ (plain text + `<br>`) |
| `{{PLATFORM}}` | Webflow / Shopify |
| `{{EXTRA_NOTES}}` | หมายเหตุเพิ่มเติม (text + `<br>`) |

### Item Format (ใช้แทน {{ITEMS}})
```html
<!-- Item มีราคา -->
<div class="doc_qt_grid">
  <div class="qt_space _01">
    <h1 class="heading-style-h6">ชื่อหัวข้อ</h1>
    <p class="item-desc">– รายละเอียด 1<br>– รายละเอียด 2</p>
  </div>
  <div class="qt_space _02">
    <h1 class="heading-style-h6">55,000.00 บาท</h1>
  </div>
</div>
<div class="doc_divider_qt none"></div>

<!-- Item ฟรี -->
<div class="doc_qt_grid">
  <div class="qt_space _01">
    <h1 class="heading-style-h6">Knowledge Transfer & Training</h1>
    <p class="item-desc">– Workshop 1 ครั้ง + คู่มือ PDF</p>
  </div>
  <div class="qt_space _02">
    <h1 class="heading-style-h6 free-tag">ฟรี</h1>
  </div>
</div>
<div class="doc_divider_qt none"></div>
```

### Tips ให้ลง 1 หน้า
- รายละเอียด items กระชับ (รวมข้อที่ใกล้กัน ใช้ `|` คั่น)
- ที่อยู่ลูกค้ารวมบรรทัด (ใช้ `|` แทน line break)
- Bank info → 1 บรรทัด (ใช้ `|` คั่น)
- Notes ใช้ `<br>` เดียว ไม่ใช่ `<br><br>`
- ถ้า items เยอะ (6+) → อาจต้องลด font อีกเล็กน้อย

### วิธีสร้าง PDF
```bash
# 1. Copy template.html → {QT_NUMBER}.html
# 2. แทน placeholders ด้วยข้อมูลจริง
# 3. แปลง HTML → PDF ด้วย Chrome headless
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox \
  --no-pdf-header-footer \
  --print-to-pdf="main/tools/quotation/{QT_NUMBER}.pdf" \
  "file:///absolute/path/to/main/tools/quotation/{QT_NUMBER}.html"
```

> **สำคัญ:** ใช้ `file:///` + absolute path เท่านั้น ไม่งั้น Chrome จะหา font ไม่เจอ

---

## ใบวางบิล (Billing Note — BL)

### เมื่อไหร่ใช้
- หลังลูกค้า OK ใบเสนอราคา → ออกใบวางบิลเรียกเก็บเงินตามงวด
- อ้างอิง QT number เดิมเสมอ

### ขั้นตอนบังคับก่อนสร้าง BL
```
1. Read QT HTML ของลูกค้าก่อน (บังคับ!)
2. Copy items ทั้งหมดจาก QT มาวางใน BL (ราคาเต็ม)
3. Copy Notes จาก QT มาวางใน BL (เปลี่ยน 2 บรรทัดสุดท้าย)
4. ใส่ยอดรวม 2 ชั้น (ยอดรวมทั้งหมด + เรียกเก็บงวดนี้)
5. เทียบ BL กับ QT อีกครั้งก่อน gen PDF
```
> ห้ามสร้าง BL จากความจำ — ต้อง Read QT จริงเสมอ!

### กฎสำคัญ: BL ต้องตรงกับ QT ทุกอย่าง!
> **CRITICAL:** ใบวางบิลต้อง **เหมือนใบเสนอราคาทุกประการ**:
> - **Items**: ราคาเต็มเหมือน QT (ห้ามหาร % ตามงวด!) + รายละเอียดเดียวกัน
> - **Notes**: ดึงจาก QT มาทั้งหมด แล้วเปลี่ยน 2 บรรทัดสุดท้ายเป็น "อ้างอิง QT" + "กรุณาชำระภายในวันครบกำหนด"
> - **ยอดรวม**: แสดง 2 ชั้น: "ยอดรวมทั้งหมด" + "เรียกเก็บงวดนี้"
>
> **หลักการ:** QT กับ BL ต้องอ่านแล้วข้อมูลสอดคล้องกัน 100% — ต่างกันแค่ประเภทเอกสาร + ยอดเรียกเก็บ

### Template: `template-bl.html`
- สี accent: น้ำเงิน `#4d7ae7` (class: `doc_divider_bl`)
- Title: "ใบวางบิล"

### Placeholders เฉพาะ BL
| Placeholder | คำอธิบาย |
|-------------|---------|
| `{{BL_NUMBER}}` | เลข BL เช่น BL2026020001 |
| `{{DUE_DATE}}` | วันครบกำหนดชำระ |
| `{{REF_QT_NUMBER}}` | อ้างอิงเลข QT เดิม |
| `{{BILLING_DESCRIPTION}}` | รายละเอียดการวางบิล (งวดไหน, สำหรับอะไร) |
| `{{GRAND_TOTAL}}` | ยอดรวมทั้งหมดตาม QT เช่น 230,000.00 |
| `{{INSTALLMENT_AMOUNT}}` | ยอดเรียกเก็บงวดนี้ เช่น 115,000.00 |
| `{{INSTALLMENT_TEXT}}` | ตัวอักษร เช่น หนึ่งแสนหนึ่งหมื่นห้าพันบาทถ้วน |

> Placeholders อื่นๆ เหมือน QT: `{{DATE}}`, `{{CUSTOMER_NAME}}`, `{{ITEMS}}` ฯลฯ
> **Items ต้องเหมือน QT ทุกประการ** (ราคาเต็ม ห้ามหาร % ตามงวด!)

### Item Format สำหรับ BL
> Items เหมือน QT ทุกประการ (ราคาเต็ม + รายละเอียดเดียวกัน)
> ดู Item Format ของ QT ด้านบน — ใช้แบบเดียวกัน แค่เปลี่ยน divider เป็น `doc_divider_bl`

### ยอดรวมแสดง 2 ชั้น
```html
<div class="qt_space _02">
  <div class="heading-style-h6">ยอดรวมทั้งหมด</div>
  <div class="heading-style-h6">230,000.00 บาท</div>
  <div class="heading-style-h6" style="margin-top:6px;">เรียกเก็บงวดนี้</div>
  <div class="heading-style-h6" style="font-size:16px;">115,000.00</div>
  <div class="heading-style-h6">บาท</div>
  <p class="item-desc">(หนึ่งแสนหนึ่งหมื่นห้าพันบาทถ้วน)</p>
</div>
```

### Notes ของ BL
```
* ราคานี้ยังไม่รวม VAT 7%
* อ้างอิงตามใบเสนอราคา {QT_NUMBER}
* กรุณาชำระเงินภายในวันครบกำหนด
```

---

## ใบเสร็จรับเงิน (Receipt — RC)

### เมื่อไหร่ใช้
- หลังลูกค้าชำระเงิน → ออกใบเสร็จยืนยัน
- อ้างอิง QT/BL number

### Template: `template-rc.html`
- สี accent: เขียว `#4daa54` (class: `doc_divider_rc`)
- Title: "ใบเสร็จรับเงิน"
- มี **"ชำระแล้ว"** tag สีเขียว
- มี Payment Method box (พื้นเขียวอ่อน)

### Placeholders เฉพาะ RC
| Placeholder | คำอธิบาย |
|-------------|---------|
| `{{RC_NUMBER}}` | เลข RC เช่น RC2026020001 |
| `{{REF_NUMBER}}` | อ้างอิง QT/BL เดิม |
| `{{PAYMENT_DATE}}` | วันที่ชำระจริง |
| `{{PAYMENT_METHOD}}` | วิธีชำระ: โอนธนาคาร / เช็ค / เงินสด |

> Placeholders อื่นๆ เหมือน QT: `{{DATE}}`, `{{CUSTOMER_NAME}}`, `{{ITEMS}}`, `{{TOTAL_AMOUNT}}` ฯลฯ

### Item Format สำหรับ RC
```html
<div class="doc_qt_grid">
  <div class="qt_space _01">
    <h1 class="heading-style-h6">งวดที่ 1 — 50% ก่อนเริ่มงาน</h1>
    <p class="item-desc">ตาม QT2026020002 | Creative Direction + Webflow Development</p>
  </div>
  <div class="qt_space _02">
    <h1 class="heading-style-h6">115,000.00 บาท</h1>
  </div>
</div>
<div class="doc_divider_rc none"></div>
```

### Notes ของ RC
```
* ราคานี้ยังไม่รวม VAT 7%
* อ้างอิงตามใบเสนอราคา {QT/BL_NUMBER}
* ออกให้เป็นหลักฐานการรับชำระเงิน
```

### ความแตกต่างจาก BL
- ไม่มี bank info (ชำระแล้ว)
- มี payment method box แทน
- ลงนาม "ผู้รับเงิน" (ไม่ใช่ "ผู้อนุมัติ")
- ไม่มี "ครบกำหนดชำระ" (จ่ายแล้ว)

---

## Tracker (qt-tracker.json)

ติดตามเลขล่าสุดของ **ทั้ง 3 ประเภท**:
```json
{
  "last_qt": "QT2026020002",
  "last_bl": null,
  "last_rc": null,
  "history": [...]
}
```

> แต่ละประเภทรันเลขแยกกัน
> เดือนใหม่ → reset เป็น 0001

---

---

## อีเมลส่งเอกสาร (Email Templates)

> เรียนรู้จากอีเมลจริง 3 ฉบับของ Tar (Pragma & Will, Hi-End Electrical, NGG Thailand)

### Subject Format
| สถานการณ์ | Format | ตัวอย่าง |
|-----------|--------|---------|
| QT + BL แรก | `[ลูกค้า] — [Action] (แนบ QT/BL)` | `ทีดีที เทรดดิ้ง — ใบเสนอราคา + ใบวางบิลงวดที่ 1 (แนบ QT/BL)` |
| BL เท่านั้น | `วางบิลงวดที่ N — [โปรเจค] — [แบรนด์]` | `วางบิลงวดที่ 2 — Shopify Custom Theme — ทีดีที` |
| RC | `ใบเสร็จรับเงิน — [โปรเจค] — [แบรนด์]` | `ใบเสร็จรับเงิน — Shopify Custom Theme — ทีดีที` |

### โครงสร้างอีเมล
```
1. ทักทาย: "เรียน คุณ{ชื่อ} ที่เคารพครับ" หรือ "สวัสดีครับ คุณ{ชื่อ}"
2. ขอบคุณ: "ขอขอบพระคุณที่ไว้วางใจให้ทีมงานดูแลครับ"
3. สรุปรายละเอียด:
   - โปรเจค / ขอบเขตงาน
   - ยอดรวม / งวดที่เรียกเก็บ
   - วิธีชำระ + ข้อมูลบัญชี
4. เอกสารแนบ:
   - ใบเสนอราคา / ใบวางบิล (PDF)
   - สำเนาบัตรประชาชน
   - สำเนาสมุดบัญชี
5. CTA: "เมื่อโอนแล้ว รบกวนส่งสลิปมาทาง LINE/Email ครับ"
6. ปิด: "ขอบคุณครับ" + Signature
```

### Tone & Style
- ใช้ **"ทีมงาน/เรา"** ไม่ใช่ "ผม"
- ลงท้ายทุกประโยค **"ครับ"**
- Professional Thai — สุภาพแต่ไม่ทางการเกินไป
- **ห้ามใช้ emoji ในอีเมล** — ดูไม่มืออาชีพ

### Signature
```
Tanakit Chaithip (ต้าร์)
Project Manager / Founder
VISION X BRAIN CO., LTD
Tel: 097-153-6565
Email: vxb.visionxbrain@gmail.com
Web: www.visionxbrain.com
```

### เอกสารที่แนบทุกครั้ง
| เอกสาร | เมื่อส่ง QT | เมื่อส่ง BL | เมื่อส่ง RC |
|--------|:---------:|:---------:|:---------:|
| ใบเสนอราคา (QT) | ✅ | ✅ (ให้อ้างอิง) | ❌ |
| ใบวางบิล (BL) | ❌ | ✅ | ❌ |
| ใบเสร็จรับเงิน (RC) | ❌ | ❌ | ✅ |
| สำเนาบัตรประชาชน | ❌ | ✅ | ❌ |
| สำเนาสมุดบัญชี | ❌ | ✅ | ❌ |

### ตัวอย่างอีเมล BL (Template)
```
Subject: [ลูกค้า] — ใบวางบิลงวดที่ {N} (แนบ QT/BL)

เรียน คุณ{ชื่อ} ที่เคารพครับ

ขอขอบพระคุณที่ไว้วางใจให้ทีมงานดูแลโปรเจค {ชื่อโปรเจค} ครับ

สรุปรายละเอียด
• โปรเจค: {ชื่อโปรเจค}
• ยอดรวมทั้งหมด: {ยอดรวม} บาท (ไม่รวม VAT)
• งวดที่ {N}: {จำนวน} บาท ({เงื่อนไข})

เอกสารแนบ
1. ใบเสนอราคา {QT_NUMBER}
2. ใบวางบิล {BL_NUMBER}
3. สำเนาบัตรประชาชน
4. สำเนาสมุดบัญชี

การชำระเงิน
ธนาคารกสิกรไทย สาขาปาย
บัญชีออมทรัพย์ 226-3-25037-3
ชื่อบัญชี บจก.วิสัยทัศน์ เอ็กซ์ เบรน

เมื่อโอนเรียบร้อยแล้ว รบกวนส่งหลักฐานการโอนมาทาง Email หรือ LINE ครับ
ทีมงานจะเริ่มดำเนินงานทันทีหลังได้รับการยืนยันครับ

ขอบคุณครับ

--
Tanakit Chaithip (ต้าร์)
Project Manager / Founder
VISION X BRAIN CO., LTD
Tel: 097-153-6565
Email: vxb.visionxbrain@gmail.com
Web: www.visionxbrain.com
```

### แจ้งเตือน LINE หลังส่งอีเมล (บังคับ!)

> **ทุกครั้ง**ที่ส่งอีเมลเอกสาร (QT/BL/RC) ให้ลูกค้า → ต้องแจ้ง Tar ใน LINE ทันที

```
Format:
ส่ง{ประเภท} {เลขเอกสาร} ให้ {ลูกค้า} แล้ว
- ยอด: {จำนวน} บาท ({งวดที่/รายละเอียด})
- อีเมล: {email ผู้รับ}
- แนบ: {รายการไฟล์}
```

วิธีส่ง LINE:
```bash
curl -s -X POST "https://oracle-agent-production-546e.up.railway.app/api/line/push" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: oracle-memory-secret-2026" \
  -d '{"message":"..."}'
```

> รวมถึงการกระทำอื่นที่เกี่ยวข้อง เช่น สร้างเอกสารเสร็จ, ลูกค้าตอบกลับ, ฯลฯ

---

### วิธีส่งอีเมลผ่าน Gmail API (Node.js)

```
1. Refresh token:
   POST https://oauth2.googleapis.com/token
   - client_id, client_secret จาก main/tools/oracle-agent/.env
   - refresh_token จาก main/tools/oracle-agent/data/google-token.json

2. สร้าง MIME multipart/mixed:
   - Subject ภาษาไทย → encode =?UTF-8?B?{base64}?=
   - Body: text/plain + base64
   - Attachments: application/pdf + base64 (fs.readFileSync)

3. แปลง MIME → URL-safe base64 (+ → - / → _ ตัด =)

4. POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
   Header: Authorization: Bearer {access_token}
   Body: { "raw": "{base64string}" }
```

### ไฟล์แนบมาตรฐาน (path)

| ไฟล์ | Path |
|------|------|
| QT/BL/RC PDF | `main/tools/quotation/{NUMBER}.pdf` |
| สำเนาบัตรประชาชน | `main/ข้อมูลสำหรับอีเมล์/ID card.pdf` |
| สำเนาสมุดบัญชี | `main/ข้อมูลสำหรับอีเมล์/bookbank update.pdf` |
| Company Profile | `main/ข้อมูลสำหรับอีเมล์/Vision resumé.pdf` |

> ส่งจาก: vxb.visionxbrain@gmail.com

---

*Created: 2026-02-06*
*Updated: 2026-02-06 (v6 — เพิ่มวิธีส่ง Gmail API + path ไฟล์แนบ)*
*Source: 28 quotation PDFs (2022-2025) + Webflow live template + Gmail analysis*
*ใช้ skill นี้ทุกครั้งที่เขียน ใบเสนอราคา / ใบวางบิล / ใบเสร็จรับเงิน / อีเมลส่งเอกสาร*
