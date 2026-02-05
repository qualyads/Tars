# Hospitality Knowledge

> Beds24, Hotel Operations, Best Hotel Pai

---

## Best Hotel Pai

- **Website**: besthotelpai.com
- **Location**: ปาย, แม่ฮ่องสอน
- **Target**: คู่รัก, remote workers, คนรักความสงบ

### ที่พัก 5 แห่ง

| ชื่อ | ประเภท | ห้อง | Beds24 |
|------|--------|------|--------|
| The Arch Casa | Design Boutique Hotel | **11 ห้อง** | ✅ |
| Betel Palm Village | Boutique Hotel | 4 ห้อง | ❌ |
| Paddy Fields Haven | Bamboo Glamping | 3 ห้อง | ❌ |
| 365 Vila | Family Villa | 1 ห้อง | ❌ |
| Eden Villa | Villa | - | ❌ |

**หมายเหตุ:** ข้อมูล Beds24 API มีแค่ The Arch Casa เท่านั้น

---

## Beds24 API

### Tokens Location
- **File**: `tools/.env`
- Contains: BEDS24_ACCESS_TOKEN, BEDS24_REFRESH_TOKEN

### API Client
- **Path**: `~/Desktop/Oracle/main/tools/apibooking`
- **Reference**: `/Users/tanakitchaithip/Desktop/OD/checkin/src/lib/beds24.ts`

---

## The Arch Casa - Room Mapping

| Beds24 roomId | Room Code | Room Name |
|---------------|-----------|-----------|
| 642555 | A01 | Executive Suite |
| 642557 | A02 | Studio Garden View |
| 642556 | A03 | Standard Studio |
| 642561 | A04 | Suite Mountain View |
| 642553 | A05 | Deluxe Double Room with Bath |
| 642560 | A06 | Suite Garden View |
| 642562 | B07 | Superior Studio |
| 642558 | B08 | Studio Mountain View |
| 642559 | B09 | Studio Terrace |
| 642552 | C10 | Classic Quadruple |
| 642554 | C11 | Deluxe King Studio |

---

## SEO Keywords

### Design Boutique Hotel
- boutique hotel, design hotel, luxury hotel, romantic hotel

### Boutique Hotel
- small hotel, cozy hotel, peaceful hotel, charming hotel

---

## Daily Operations

### Hotel Report Script
- **Path**: `~/scripts/daily-hotel-report.sh`
- **Schedule**: 09:00 ทุกวัน
- **Content**: Check-in/out + ห้องว่าง

---

## Sublease Business Model

- **กลยุทธ์**: เช่าช่วงที่พัก/บ้าน/รีสอร์ทในปาย
- **Return**: 4-7x profit
- **แหล่งหาดีล**: https://www.facebook.com/groups/203572704968779
- **โอกาส**: หาที่พักใหม่ → เช่าช่วง → ทำกำไร

---

## TM30 (Immigration Report)

> แบบแจ้งที่พักอาศัยของคนต่างด้าว - ยุ่งยากมาก!

### ความยุ่งยาก
- ต้องแจ้ง ตม. ภายใน 24 ชม. หลังแขกต่างชาติ check-in
- ถ้าไม่แจ้ง → โดนปรับ 800-2,000 บาท/คน
- มีที่พัก 5 แห่ง = ยุ่งยาก x5

### ข้อมูลที่ต้องกรอก
- ชื่อ-นามสกุล (ตาม passport)
- เลข passport
- สัญชาติ
- วันเกิด
- Visa type & เลขที่
- วันที่เข้าพัก / ออก
- ที่อยู่ที่พัก

### Cloudflare Protection
- เว็บมี Cloudflare Managed Challenge
- ใช้ curl/cloudscraper ไม่ผ่าน
- ต้องใช้ CapSolver หรือ puppeteer-real-browser

### Project Files
- **Path**: `/Users/tanakitchaithip/Desktop/Oracle/main/tools/tm30`
- `login.mjs` - puppeteer-real-browser script
- `capsolver-login.mjs` - CapSolver API script

### Credentials
→ apis.md#tm30

### TODO (เมื่อกลับมาทำต่อ)
1. เข้า CapSolver dashboard → เช็ค/regenerate API key
2. ทดสอบ CapSolver balance
3. ถ้า CapSolver ไม่ work → ใช้ puppeteer-real-browser
4. Login สำเร็จ → สำรวจ API endpoints
5. สร้าง auto-fill script
6. เชื่อม Beds24 → ดึง foreign guests

### เป้าหมาย: ระบบ Auto TM30
- รับข้อมูลจาก booking (Beds24/manual)
- กรอก TM30 อัตโนมัติ
- แจ้งเตือนเมื่อมีแขกต่างชาติ check-in

---

## Vision (อนาคต)

- สร้างโมเดลที่ดีที่สุดสำหรับทุกที่พัก (5 แห่ง)
- ระบบที่ scale ได้
- AI-powered pricing & marketing
- เป้าหมาย: Maximize revenue อัตโนมัติ

### Wishlist
- Google Business API
- Booking.com API (ปิดรับสมัครอยู่)
- Hotel Channel Manager SaaS

---

*Last updated: 2026-02-04*
