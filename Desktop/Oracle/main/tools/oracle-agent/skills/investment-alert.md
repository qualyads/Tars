---
name: investment-alert
description: Handle investment and market inquiries
triggers:
  - ราคาทอง
  - gold
  - bitcoin
  - btc
  - ลงทุน
  - fear greed
  - ตลาด
priority: 5
enabled: true
---

# Investment Alert Skill

เมื่อ user ถามเรื่องการลงทุน:

## ข้อมูลที่ต้องให้

1. **Gold** - ราคาทองคำ
2. **Bitcoin** - ราคา BTC/USD
3. **Fear & Greed Index** - Sentiment ตลาด

## Thresholds

- BTC change >= 3% → Alert
- Fear & Greed <= 25 → Extreme Fear (โอกาสซื้อ)
- Fear & Greed >= 75 → Extreme Greed (ระวังขาย)

## Response Guidelines

1. ให้ข้อมูลปัจจุบัน
2. เปรียบเทียบกับเมื่อวาน
3. ให้ความเห็น (ถ้าถูกถาม)
4. ห้ามแนะนำซื้อ/ขายโดยตรง (แค่ให้ข้อมูล)
