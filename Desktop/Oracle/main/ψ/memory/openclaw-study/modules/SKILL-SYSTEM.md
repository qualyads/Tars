# OpenClaw Skill System - Deep Analysis

> เป้าหมาย: เข้าใจ Skill System เพื่อ implement ใน Oracle
> Status: ✅ Core understanding complete

## 1. Skill Directory Structure

```
skills/
├── skill-name/
│   ├── SKILL.md          ← Required: frontmatter + instructions
│   ├── scripts/          ← Optional: executable code
│   ├── references/       ← Optional: documentation
│   └── assets/           ← Optional: templates, files
```

## 2. Skill Loading Priority

```
extra < bundled < managed < workspace
(ต่ำสุด)                    (สูงสุด)
```

| Source | Path | Description |
|--------|------|-------------|
| Bundled | `<package>/skills/` | มากับ OpenClaw |
| Managed | `~/.openclaw/skills/` | User installed |
| Workspace | `<project>/skills/` | Project-specific |
| Extra | Config defined | Additional dirs |
| Plugin | Extensions | From plugins |

## 3. SKILL.md Frontmatter

```yaml
---
name: skill-name
description: What it does and when to use it
user-invocable: true           # Can user call /<skill-name>?
disable-model-invocation: false # Can AI trigger this automatically?
metadata: |
  {
    "openclaw": {
      "always": false,           # Always load?
      "emoji": "🔧",
      "homepage": "https://...",
      "skillKey": "unique-key",
      "primaryEnv": "SOME_API_KEY",
      "os": ["macos", "linux"],
      "requires": {
        "bins": ["git", "node"],
        "anyBins": ["python", "python3"],
        "env": ["GITHUB_TOKEN"],
        "config": ["github.token"]
      },
      "install": [
        { "kind": "brew", "formula": "git" },
        { "kind": "node", "package": "typescript" }
      ]
    }
  }
---
# Skill Name

Instructions for using this skill...
```

## 4. Key Functions

### loadSkillEntries()
```typescript
// Load skills from all sources
function loadSkillEntries(workspaceDir, opts) {
  const bundled = loadSkillsFromDir({ dir: bundledSkillsDir });
  const managed = loadSkillsFromDir({ dir: managedSkillsDir });
  const workspace = loadSkillsFromDir({ dir: workspaceSkillsDir });

  // Merge with precedence
  const merged = new Map();
  for (const skill of bundled) merged.set(skill.name, skill);
  for (const skill of managed) merged.set(skill.name, skill);
  for (const skill of workspace) merged.set(skill.name, skill);

  return Array.from(merged.values()).map(skill => ({
    skill,
    frontmatter: parseFrontmatter(skill.filePath),
    metadata: resolveOpenClawMetadata(frontmatter),
    invocation: resolveSkillInvocationPolicy(frontmatter)
  }));
}
```

### buildWorkspaceSkillsPrompt()
```typescript
// Generate prompt for AI with skill instructions
function buildWorkspaceSkillsPrompt(workspaceDir, opts) {
  const entries = loadSkillEntries(workspaceDir, opts);
  const eligible = filterSkillEntries(entries, config);

  // Filter out skills that disable model invocation
  const promptEntries = eligible.filter(
    entry => entry.invocation?.disableModelInvocation !== true
  );

  return formatSkillsForPrompt(promptEntries.map(e => e.skill));
}
```

## 5. Skill Eligibility

Skills can be filtered based on:
- OS compatibility (`os: ["macos"]`)
- Required binaries (`requires.bins`)
- Required environment variables (`requires.env`)
- Config values (`requires.config`)
- Agent skill filter (per-agent config)

## 6. Implementation for Oracle

### Step 1: Create skill directory structure
```
ψ/skills/
├── beds24/
│   ├── SKILL.md
│   └── scripts/
│       └── check-bookings.js
├── tm30/
│   ├── SKILL.md
│   └── scripts/
│       └── submit-form.js
└── crypto-alert/
    └── SKILL.md
```

### Step 2: Implement skill loader
```javascript
// oracle-agent/lib/skills.js
function loadOracleSkills(skillsDir) {
  const skills = [];
  for (const dir of fs.readdirSync(skillsDir)) {
    const skillMd = path.join(skillsDir, dir, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      skills.push({
        name: frontmatter.name || dir,
        description: frontmatter.description,
        instructions: body,
        scriptsDir: path.join(skillsDir, dir, 'scripts')
      });
    }
  }
  return skills;
}
```

### Step 3: Generate skill prompt
```javascript
function generateSkillPrompt(skills) {
  let prompt = '# Available Skills\n\n';
  for (const skill of skills) {
    prompt += `## ${skill.name}\n`;
    prompt += `${skill.description}\n\n`;
  }
  return prompt;
}
```

### Step 4: Progressive disclosure
- Load only skill names + descriptions initially
- Load full instructions only when skill is triggered

## 7. Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/agents/skills/workspace.ts` | Skill loading & merging | 441 |
| `src/agents/skills/frontmatter.ts` | Parse SKILL.md frontmatter | 173 |
| `src/agents/skills/config.ts` | Skill configuration | ~100 |
| `src/agents/skills/types.ts` | Type definitions | ~50 |

---
*Analyzed: 2026-02-03*
