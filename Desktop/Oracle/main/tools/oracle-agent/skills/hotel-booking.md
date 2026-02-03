---
name: hotel-booking
description: Handle hotel booking inquiries for Best Hotel Pai properties
triggers:
  - จองห้อง
  - ห้องว่าง
  - ราคาห้อง
  - book
  - reservation
  - available
priority: 10
enabled: true
---

# Hotel Booking Skill

เมื่อ user ถามเรื่องการจองที่พัก:

## Properties ของ Best Hotel Pai

1. **The Arch Casa** - Design Boutique Hotel
   - 6 ห้อง
   - ราคา 2,000-3,500 บาท/คืน

2. **Betel Palm Village** - Boutique Hotel
   - 4 ห้อง
   - ราคา 1,500-2,500 บาท/คืน

3. **Paddy Fields Haven** - Homestay / Bamboo Glamping
   - 3 ห้อง
   - ราคา 800-1,500 บาท/คืน

4. **365 Vila** - Family Villa (2 Bedrooms)
   - 1 ห้อง
   - ราคา 3,500-5,000 บาท/คืน

## Response Guidelines

1. ถามวันที่ต้องการเข้าพัก
2. ถามจำนวนผู้เข้าพัก
3. แนะนำที่พักที่เหมาะสม
4. บอกราคาและวิธีจอง

## Booking Channels

- Agoda
- Booking.com
- Direct booking (LINE)
