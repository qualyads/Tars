# CLAUDE.md - Oracle Memory System v7.0 (Pointer + On-Demand)

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

## Anti-Forgetting

- ทุก 30 messages → เขียน `main/ψ/memory/active/checkpoint.md`
- ก่อนจบ session → เขียน `main/ψ/memory/active/handoff.md`

## Auto-Documentation

เมื่อสร้าง feature/แก้ไขสำคัญ → อัพเดท handoff.md + OPERATIONS.md (ถ้าเป็น how-to ใหม่)
