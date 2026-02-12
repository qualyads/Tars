# CLAUDE.md - Oracle Memory System v7.1 (Crash-Proof)

## Auto-Save Protocol

เมื่อเรียนรู้สิ่งใหม่/ทำงานสำเร็จ/ก่อนจบ session → บันทึก 2 ที่:

**1. Local file (ก่อน):**
| Tar พูดถึง | บันทึกลง |
|------------|----------|
| เป้าหมาย, ธุรกิจใหม่ | `main/ψ/memory/goals.md` |
| how-to, API key, credentials | `main/ψ/memory/OPERATIONS.md` |
| ความรู้เฉพาะทาง | `main/ψ/memory/knowledge/*.md` |
| skill ใหม่ | `main/ψ/skills/*.md` + อัพเดท `_index.md` |

**2. Supabase (backup):** ใช้ `oracle_remember` หรือ:
```bash
curl -s -X POST -H "X-API-Key: oracle-memory-secret-2026" \
  -H "Content-Type: application/json" \
  -d '{"content":"...","user_id":"tars","importance":0.8}' \
  "https://oracle-agent-production-546e.up.railway.app/api/memory/save"
```

## 🚨 Crash-Proof Protocol — ห้ามลืม!

### กฎ 1: Single Source of Truth (ห้าม duplicate ตัวเลข)
```
handoff.md = pointer ชี้ไปหา skill file เท่านั้น
ห้ามเก็บตัวเลข progress ซ้ำใน handoff!
ตัวเลขจริงอยู่ที่:
  - Blog Rewrite  → ψ/skills/vxb-blog-rewrite.md (Completed Articles Log)
  - Service Page  → ψ/skills/service-page-seo.md
  - goals.md      → อ้างอิงจาก skill file เดียวกัน
```

### กฎ 2: Progressive Checkpoint (บันทึกระหว่างทำ)
```
งาน batch (blog rewrite, service page CRO, etc.):
→ ทุก 10 items ที่ทำเสร็จ → อัพเดท skill file log ทันที
→ ห้ามรอจบ session! คอมดับเมื่อไหร่ก็ไม่เสียข้อมูล
→ skill file log = source of truth ที่อัพเดทล่าสุดเสมอ
```

### กฎ 3: Verify API ตอนเริ่ม session
```
เริ่ม session ใหม่ + Tar ถามสถานะ:
→ ห้ามเชื่อ handoff/goals ตัวเลข 100%!
→ ต้อง verify จาก API จริง (Webflow CMS, etc.) ก่อนรายงาน
→ Blog: เช็ค FAQ Schema JSON-LD = rewrite แล้ว
→ Service Page: เช็คจาก MCP/API
→ ถ้าตัวเลขไม่ตรง → แก้ file ให้ตรงทันที
```

## Anti-Forgetting

- ทุก 30 messages → เขียน `main/ψ/memory/active/checkpoint.md`
- ก่อนจบ session → เขียน `main/ψ/memory/active/handoff.md`
- **งาน batch → ทุก 10 items อัพเดท skill file log** (Crash-Proof)

## Auto-Documentation

เมื่อสร้าง feature/แก้ไขสำคัญ → อัพเดท handoff.md + OPERATIONS.md (ถ้าเป็น how-to ใหม่)
