# Pragma & Will Group - Style Guide Reference

> บันทึกเมื่อ: 2026-02-02
> สถานะ: Verified Complete
> ไฟล์: `/Users/tanakitchaithip/Desktop/lab/web-prama/pragma-style-guide.html`

---

## สิ่งที่ต้องจำ

### เมื่อสร้าง Style Guide จาก React/Tailwind Codebase

**ต้อง scan ทุกอย่างก่อนบอกว่า "เสร็จ":**

```bash
# 1. Extract all unique typography values
grep -ohE 'text-\[[0-9a-z.]+\]|leading-\[[0-9a-z.]+\]|tracking-\[[0-9a-z.-]+\]' src/components/*.tsx | sort -u

# 2. Extract all font weights
grep -ohE 'font-(normal|medium|semibold|bold)' src/components/*.tsx | sort | uniq -c

# 3. Extract all hover patterns
grep -ohE 'hover:[a-z-]+\[[^\]]+\]|hover:[a-z-]+' src/components/*.tsx | sort -u

# 4. Check gradients in tailwind.config
cat tailwind.config.js | grep -A5 "backgroundImage"

# 5. Check for hardcoded colors
grep -ohE 'bg-\[#[A-Fa-f0-9]+\]|hover:bg-\[#[A-Fa-f0-9]+\]' src/components/*.tsx | sort -u
```

---

## Pragma Typography Patterns (Verified)

### Headings
| Class | Font Size | Weight | Line Height | Letter Spacing |
|-------|-----------|--------|-------------|----------------|
| `.heading-style-hero` | 80px @lg | 500 | 1.1 / 88px | 0 (normal) |
| `.heading-style-section` | 70px @lg | 600 | 0.92 | -0.05em |
| `.heading-style-section-alt` | 3rem @lg | 600 | 0.95 | -0.04em |
| `.heading-style-card` | 26.67px | 500 | 1.2 (32px) | -0.02em |
| `.heading-style-h1` | 3.5rem | 600 | 1.1 | -0.02em |
| `.heading-style-h2` | 2.5rem | 600 | 1.2 | -0.02em |

### Body Text
| Class | Font Size | Line Height | Use Case |
|-------|-----------|-------------|----------|
| `.text-style-body` | 16px | 1.4 (22.4px) | Standard body |
| `.text-style-body-relaxed` | 16px | 1.625 (26px) | Description |
| `.text-style-body-large` | 17px | 1.65 (28px) | Blog content |

### Taglines
| Class | Letter Spacing | Use Case |
|-------|----------------|----------|
| `.text-style-tagline` | 0.25em | Standard tagline |
| `.text-style-category` | 0.15em | Blog category |
| `.tracking-widest` | 0.2em | Stats tagline |

---

## Pragma Button Patterns (Verified)

### Base Button Values
```css
padding: 0.6875rem 1.0625rem; /* 11px 17px */
font-size: 0.875rem; /* 14px */
line-height: 1.4; /* 19.6px */
letter-spacing: -0.04em; /* -0.56px */
border-radius: 9999px;
transition: all 0.2s ease;
```

### Button Variants & Hover States
| Variant | Background | Hover Background |
|---------|------------|------------------|
| `.button-primary` | #002248 (navy) | #1A5280 (blue) |
| `.button-gold` | #FAA62A (gold) | #E89820 (gold-dark) |
| `.button-secondary` | transparent | #002248 + white text |
| `.button-white` | white | #F6F8FE (light) |
| `.button-outline-white` | white/5% | white/10% + white border |

---

## Pragma Color Schemes (Verified)

| Scheme | Background | Text | Accent |
|--------|------------|------|--------|
| 1 - Navy | #002248 | white | #FAA62A |
| 2 - Light | #F6F8FE | #002248 | #FAA62A |
| 3 - Gold | #FAA62A | #002248 | #002248 |
| 4 - Deep | #00152E | white | #FAA62A |
| 5 - Blue | #1A5280 | white | #FAA62A |
| 6 - White | #FFFFFF | #002248 | #FAA62A |

---

## Pragma Gradients (Verified)

```css
--pragma--gradient-navy: linear-gradient(135deg, #002248 0%, #0D3461 50%, #1A5280 100%);
--pragma--gradient-gold: linear-gradient(135deg, #FAA62A 0%, #FBB954 100%);
--pragma--gradient-hero: linear-gradient(to right, rgba(0,34,72,0.92), rgba(0,34,72,0.70), rgba(0,34,72,0.45));
```

---

## Form Input Patterns (Verified)

```css
/* Light background */
.input {
  border: 1px solid #D1DAE3;
  border-radius: 9999px;
  padding: 0.75rem 1rem;
}
.input:focus {
  border-color: #FAA62A;
  box-shadow: 0 0 0 3px rgba(250, 166, 42, 0.2);
}

/* Dark background */
.input-dark {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
}
.input-dark:focus {
  border-color: #FAA62A;
  box-shadow: 0 0 0 3px rgba(250, 166, 42, 0.3);
}
```

---

## Line Heights & Letter Spacing Utilities

### Line Heights
| Class | Value | Use Case |
|-------|-------|----------|
| `.leading-none` | 1 | Decorative numbers |
| `.leading-tighter` | 0.92 | Section H2 |
| `.leading-tight` | 0.95 | Alt section H2 |
| `.leading-snug` | 1.1 | Hero H1 |
| `.leading-normal` | 1.4 | Body text |
| `.leading-relaxed` | 1.625 | Description |
| `.leading-loose` | 1.65 | Blog content |

### Letter Spacing
| Class | Value | Use Case |
|-------|-------|----------|
| `.tracking-tight` | -0.02em | Default headings |
| `.tracking-tighter` | -0.03em | Blog H1 |
| `.tracking-tightest` | -0.04em | Alt headings, buttons |
| `.tracking-section` | -0.05em | Section H2 |
| `.tracking-wide` | 0.15em | Blog category |
| `.tracking-widest` | 0.2em | Stats tagline |
| `.tracking-wider` | 0.25em | Standard tagline |

---

## Lesson Learned

> เมื่อสร้าง style guide จาก existing codebase:
> 1. **Scan ทุกอย่างก่อน** ด้วย grep/search
> 2. **List ค่าทั้งหมด** ก่อน implement
> 3. **อย่าบอก "เสร็จ"** จนกว่าจะ verify ครบ
> 4. **รวม hover states** ตั้งแต่แรก ไม่ใช่เพิ่มทีหลัง
