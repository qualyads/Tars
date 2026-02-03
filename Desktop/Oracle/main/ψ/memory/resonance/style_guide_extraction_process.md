# Style Guide Extraction Process

> วิธีสร้าง Style Guide จาก React/Tailwind Codebase ให้ครบ 100%
> ใช้ได้กับทุกโปรเจค

---

## Phase 1: Scan ทั้งหมดก่อน (ห้ามข้าม)

### 1.1 หา tailwind.config.js
```bash
cat tailwind.config.js
```
ดึงข้อมูล:
- Custom colors
- Custom fonts
- backgroundImage (gradients)
- Custom shadows
- Extended spacing

### 1.2 หา layout.tsx / globals.css
```bash
cat src/app/layout.tsx
cat src/app/globals.css
```
ดึงข้อมูล:
- Font imports (Google Fonts)
- Font weights ที่ใช้จริง
- CSS variables ที่กำหนดไว้

### 1.3 Extract Typography Patterns
```bash
# ค่า text size, line-height, letter-spacing ทั้งหมด
grep -rohE 'text-\[[0-9a-z.]+\]|leading-\[[0-9a-z.]+\]|tracking-\[[0-9a-z.-]+\]' src/components/*.tsx | sort -u

# Font weights
grep -ohE 'font-(normal|medium|semibold|bold|light|extrabold)' src/components/*.tsx | sort | uniq -c
```

### 1.4 Extract Button Patterns
```bash
# หา button components
grep -l "Button\|button\|btn" src/components/*.tsx

# ดู class ของ buttons
grep -A2 "<Button\|<button" src/components/*.tsx | grep "className"
```

### 1.5 Extract Hover States
```bash
# ทุก hover pattern
grep -ohE 'hover:[a-z:-]+\[[^\]]+\]|hover:[a-z-]+' src/components/*.tsx | sort -u

# Hover ที่เป็น hardcoded color
grep -ohE 'hover:bg-\[#[A-Fa-f0-9]+\]' src/components/*.tsx | sort -u
```

### 1.6 Extract Border Radius
```bash
grep -ohE 'rounded-[a-z0-9]+' src/components/*.tsx | sort | uniq -c | sort -rn
```

### 1.7 Extract Shadows & Effects
```bash
grep -ohE 'shadow-[a-z]+|backdrop-blur[a-z-]*' src/components/*.tsx | sort -u
```

### 1.8 Extract Form Input Patterns
```bash
grep -B2 -A5 "Input\|Textarea\|input\|textarea" src/components/*.tsx | grep -E "className|focus:"
```

### 1.9 Check for Hardcoded Colors
```bash
grep -ohE 'bg-\[#[A-Fa-f0-9]+\]|text-\[#[A-Fa-f0-9]+\]|border-\[#[A-Fa-f0-9]+\]' src/components/*.tsx | sort -u
```

---

## Phase 2: List ค่าทั้งหมดก่อน Implement

สร้าง checklist จากผลลัพธ์ Phase 1:

```markdown
## Typography
- [ ] Heading sizes: ___
- [ ] Heading weights: ___
- [ ] Heading line-heights: ___
- [ ] Heading letter-spacing: ___
- [ ] Body sizes: ___
- [ ] Body line-heights: ___
- [ ] Tagline styles: ___

## Colors
- [ ] Primary: ___
- [ ] Secondary: ___
- [ ] Accent: ___
- [ ] Neutrals: ___
- [ ] Gradients: ___

## Buttons
- [ ] Variants: ___
- [ ] Sizes: ___
- [ ] Hover states: ___

## Forms
- [ ] Input styles: ___
- [ ] Focus states: ___
- [ ] Dark variant: ___

## Effects
- [ ] Shadows: ___
- [ ] Border radius: ___
- [ ] Transitions: ___
- [ ] Card hover: ___
- [ ] Image hover: ___
```

---

## Phase 3: Implement Style Guide

### โครงสร้าง Relume-compatible:

```html
<!DOCTYPE html>
<html data-wf-page="style-guide" data-wf-site="project-name">
<head>
  <!-- 1. Google Fonts -->
  <!-- 2. CSS Variables (:root) -->
  <!-- 3. Base Styles -->
  <!-- 4. Typography Classes -->
  <!-- 5. Button Classes (with :hover) -->
  <!-- 6. Form Classes (with :focus) -->
  <!-- 7. Effect Classes -->
  <!-- 8. Utility Classes -->
</head>
<body>
  <div class="page-wrapper">
    <!-- global-styles > style-overrides (w-embed) -->
    <!-- global-styles > color-schemes (w-embed) -->

    <!-- Visual sections for preview -->
  </div>
</body>
</html>
```

---

## Phase 4: Verify (ห้ามข้าม)

### 4.1 Cross-check ทุกค่า
```bash
# นับ unique values จาก codebase
grep -rohE 'tracking-\[[^\]]+\]' src/components/*.tsx | sort -u | wc -l

# นับ tracking classes ใน style guide
grep -c "letter-spacing:" style-guide.html
```

### 4.2 Test hover states
เปิด style guide ใน browser แล้ว hover ทุกปุ่ม

### 4.3 Checklist สุดท้าย
- [ ] ทุก heading style มี responsive sizes
- [ ] ทุก button มี :hover
- [ ] ทุก input มี :focus
- [ ] Color schemes remapping ถูกต้อง
- [ ] Gradients ครบ
- [ ] Transitions ครบ

---

## Common Patterns ที่มักลืม

1. **Hero H1 ≠ Section H2**
   - Hero มักใช้ `font-medium` (500) ไม่ใช่ `font-semibold` (600)
   - Hero มักใช้ `tracking-normal` ไม่ใช่ negative

2. **Button letter-spacing**
   - มักเป็น `-0.04em` หรือ `-0.56px` at 14px

3. **Taglines มีหลายแบบ**
   - `0.25em` (standard)
   - `0.2em` (stats)
   - `0.15em` (category)

4. **Line-height มีหลายค่า**
   - `0.92` (section headings)
   - `0.95` (alt headings)
   - `1.1` (hero)
   - `1.4` (body)
   - `1.625` (relaxed body)

5. **Dark card styles**
   - `bg-white/[0.04]`
   - `border-white/10`
   - `backdrop-blur`
   - `hover:border-accent/30`

6. **Form focus states**
   - `focus:border-accent`
   - `focus:ring-2`
   - `focus:ring-accent/20`

---

## Output Checklist

ก่อนบอก "เสร็จ" ต้องมี:

- [ ] CSS Variables ครบ (colors, shadows, radius, gradients, transitions)
- [ ] 6 Color Schemes + remapping
- [ ] Typography (headings, body, taglines, utilities)
- [ ] Buttons (all variants + all hover states)
- [ ] Forms (input, textarea, dark variants, focus states)
- [ ] Cards (hover effects, dark variants)
- [ ] Image effects (zoom on hover)
- [ ] Link effects (arrow animation)
- [ ] Letter-spacing utilities
- [ ] Line-height utilities
- [ ] Responsive breakpoints for headings

---

*Process นี้ใช้ได้กับทุก React/Tailwind project*
