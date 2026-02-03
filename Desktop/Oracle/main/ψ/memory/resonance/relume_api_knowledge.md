# Relume API Knowledge Base

> **บันทึกเมื่อ**: 2026-02-02
> **สถานะ**: Fully Reverse Engineered

---

## Authentication

```
Auth Token: rl-auth-K-4JseTEKfWemwNRZtdTL35CL3pf4tYc
Account: info@visionxbrain.com
Plan: Creator
```

---

## API Endpoints

### REST API

| Endpoint | Description |
|----------|-------------|
| `POST https://apis.relume.io/accounts/login` | Login |
| `GET https://apis.relume.io/accounts/me` | Account info |
| `GET https://apis.relume.io/blocks/projects` | List projects |
| `GET https://apis.relume.io/v1/blocks_categories` | 76 component categories |
| `GET https://apis.relume.io/v1/components` | List all components |
| `GET https://apis.relume.io/v1/components?category=Navbar` | Filter by category |
| `GET https://apis.relume.io/v1/font_family/{slug}` | Get font data |

### WebSocket (Real-time Project Data)

```
Endpoint: wss://apis.relume.io/ws/blocks/project/

Init Message:
{
  "type": "init",
  "schemaVersion": 2,
  "projectToken": "P2847929_MUqYspk2dPl0CaRu5m2rayW90bRgTmKUBSUcfA5ZZgQ",
  "userToken": "rl-auth-xxxxx",
  "oldSessionIds": [],
  "hideFromPresence": true
}

Response: Full project data including:
- Pages structure
- Style Guide (colors, fonts, design schemes)
- Components with overrides
- Text content
- Image config
```

### Component CDN (Public, No Auth)

```
URL: https://components-public.relume.io/scrambled/{component_slug}.json

Examples:
- navbar2_component.json
- section_header111.json
- section_layout486.json
- footer11_component.json
```

---

## Decode Algorithm

Component JSON จาก CDN ถูก **scramble** ด้วย algorithm นี้:

```javascript
// Scramble (Relume ใช้)
function scramble(e) {
  return "string" == typeof e
    ? e.split("").map((char, index) =>
        String.fromCharCode(char.charCodeAt(0) + 2 + index % 10)
      ).join("")
    : "boolean" == typeof e ? !e
    : "number" == typeof e ? e + 1
    : Array.isArray(e) ? e.map(scramble)
    : "object" == typeof e
      ? Object.fromEntries(Object.entries(e).map(([k, v]) => [scramble(k), scramble(v)]))
      : e;
}

// Unscramble (เราใช้ decode)
function unscramble(e) {
  return "string" == typeof e
    ? e.split("").map((char, index) =>
        String.fromCharCode(char.charCodeAt(0) - 2 - index % 10)
      ).join("")
    : "boolean" == typeof e ? !e
    : "number" == typeof e ? e - 1
    : Array.isArray(e) ? e.map(unscramble)
    : "object" == typeof e
      ? Object.fromEntries(Object.entries(e).map(([k, v]) => [unscramble(k), unscramble(v)]))
      : e;
}
```

---

## Decoded Output Format

```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      {
        "_id": "...",
        "classes": ["..."],
        "type": "NavbarWrapper",
        "tag": "div",
        "data": {...},
        "children": [...]
      }
    ],
    "styles": [...]
  }
}
```

---

## Tools Created

### Location
```
/tools/relume-chrome-ext/tools/
├── relume_api.cjs      # Main API tool
├── decode_file.cjs     # Decode scrambled JSON
└── decode_component.js # Decode functions
```

### Usage

```bash
# List categories (76 total)
node tools/relume_api.cjs categories

# List components
node tools/relume_api.cjs list Navbar

# Download & decode component
node tools/relume_api.cjs get navbar2
# Output: /tmp/navbar2_webflow.json

# Search components
node tools/relume_api.cjs search hero
```

---

## Chrome Extension Files

```
/tools/relume-chrome-ext/
├── manifest.json           # Extension manifest v3
├── background.js           # Service worker (64KB)
├── webflow_content.js      # Main logic (1.9MB) - contains decode algorithm
├── relume_content.js       # Relume site script (208KB)
└── webflow_content_window.js # Window context (62KB)
```

---

## Project Data Structure (from WebSocket)

```javascript
{
  name: "Project Name",
  locale: "en-US",

  // Style Guide
  concepts: [{
    theme: "light",
    neutral: { locked: false, tintIndex: 3 },
    chromatics: [
      { hex: "#002248", name: "Prussian Blue", locked: false },
      // ... more colors
    ],
    fontFamilies: {
      body: { slug: "G-Inter" },
      heading: { slug: "G-Raleway" }
    },
    designSchemes: [...]
  }],

  // Pages
  homePage: {
    name: "Home",
    pageType: "page",
    sections: [
      { type: "reference", id: "..." },  // Global section
      { type: "inline", value: {...} }   // Page-specific section
    ],
    subPages: [...]
  },

  // Global Sections (Navbar, Footer)
  globalSections: {
    "~id": { name: "Navbar", element: {...} }
  }
}
```

---

## Important Notes

1. **Component CDN เป็น public** - ไม่ต้อง auth
2. **Project data ต้องผ่าน WebSocket** - ต้อง auth
3. **Scramble algorithm อยู่ใน webflow_content.js** - line ที่มี `charCodeAt(0)+2+t%10`
4. **Webflow JSON format** - type: `@webflow/XscpData`

---

## Capabilities Summary

| Feature | Status |
|---------|--------|
| List 76 categories | ✅ |
| List all components | ✅ |
| Download component JSON | ✅ |
| Decode to Webflow format | ✅ |
| Get project pages | ✅ (WebSocket) |
| Get Style Guide | ✅ (WebSocket) |
| Get text overrides | ✅ (WebSocket) |
| Export to Webflow | ✅ |

---

*This is equivalent to what Relume Site Builder Import does in Webflow Designer*
