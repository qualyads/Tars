# Jarvis 3D Development Log

**Date:** 2026-02-02
**Project:** AI Avatar with 3D VRM/GLB + Claude Integration

---

## Summary

สร้างระบบ AI Avatar 3D ที่สามารถ:
- โหลด VRM/GLB models
- พูดคุยผ่าน Claude CLI
- TTS หลายแบบ (OpenAI HD, Edge TTS, Fish Audio)
- ขยับตา ปาก และร่างกายอัตโนมัติ

---

## Technical Implementation

### 1. Core Stack
- **Backend:** FastAPI + Python
- **3D Engine:** Three.js + @pixiv/three-vrm
- **AI Brain:** Claude CLI (full power mode)
- **TTS:** OpenAI TTS-HD, Edge TTS, Fish Audio
- **STT:** OpenAI Whisper

### 2. File Location
```
/Users/tanakitchaithip/Desktop/make-money/ai-avatar/
├── jarvis_3d.py          # Main application
├── jarvis_3d.log         # Server logs
├── models/
│   └── avatar.glb        # Current avatar model
└── output/               # TTS audio files
```

### 3. Key Features Implemented

#### A. Model Loading
- Auto-detect VRM vs GLB format
- Auto-scale models to fit viewport
- Auto-center and position camera
- Support for both rigged and static meshes

#### B. Animation System

**For Rigged Models (VRM/GLB with bones):**
- Bone-based animation
- VRM expression manager for face
- Idle breathing/swaying
- Talking gestures

**For Static Meshes (no bones):**
- Vertex deformation for eyes/mouth
- Face region detection by vertex position
- Direct vertex manipulation for:
  - Eye movement (look around)
  - Blinking
  - Mouth opening (lip sync)

#### C. Face Deformation Algorithm
```javascript
// Detect face vertices by position
- Head region: top 20% of model height
- Eye region: ~12% from top, left/right of center
- Mouth region: ~18% from top, center

// Animation
- Eyes: move vertices based on eyeCurrentX/Y
- Blink: move eye vertices down periodically
- Mouth: move lower lip down based on audio amplitude
```

#### D. Audio Analysis
- Real-time FFT analysis of speech
- Focus on voice frequencies (85-255 Hz)
- Smooth interpolation for natural movement

### 4. Voice Options
| Provider | Voice | Quality |
|----------|-------|---------|
| OpenAI | Nova, Shimmer, Alloy, Fable | HD Movie Quality |
| Edge TTS | th-TH-PremwadeeNeural | Thai Native |
| Fish Audio | Anime voices | Japanese Style |

### 5. API Endpoints
- `GET /` - Main UI
- `POST /api/chat` - Text chat
- `POST /api/voice` - Voice input
- `GET /upload` - Upload new avatar
- `POST /api/upload-avatar` - Handle avatar upload

---

## Issues & Solutions

### Issue 1: Model Not Visible
**Problem:** GLB loaded but not visible
**Solution:** Auto-scale based on bounding box, auto-position camera

### Issue 2: T-Pose
**Problem:** Rigged models stuck in T-pose
**Solution:** Detect bones and apply relaxed pose rotation

### Issue 3: Static Mesh Can't Animate
**Problem:** Model has no bones or morph targets
**Solution:** Vertex deformation - find face vertices and manipulate directly

### Issue 4: Browser Cache
**Problem:** Old HTML cached, wrong URLs requested
**Solution:** Add no-cache headers to HTML response

---

## Model Requirements

**Ideal Model:**
- VRM format with full rigging
- Blend shapes for face expressions
- Humanoid bone structure

**Minimum:**
- Any GLB with visible mesh
- Will use vertex deformation for face

**For Full Rigging:**
- Use Mixamo.com to auto-rig static models
- Export as FBX, convert to GLB

---

## Running the Server

```bash
cd /Users/tanakitchaithip/Desktop/make-money/ai-avatar
python3 jarvis_3d.py
# Access: http://localhost:8006
```

---

## Next Steps (Potential)

1. [ ] Better face vertex detection using ML
2. [ ] Lip sync with phoneme detection
3. [ ] Full body motion capture
4. [ ] Multiple avatar support
5. [ ] WebSocket for real-time streaming

---

*Auto-logged by Oracle Framework*
