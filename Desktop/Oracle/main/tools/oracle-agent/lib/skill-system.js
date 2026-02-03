/**
 * Skill System - Based on OpenClaw Pattern
 *
 * Skills are modular capabilities that can be loaded on-demand.
 * Each skill is defined in a SKILL.md file with frontmatter.
 *
 * Example SKILL.md:
 * ```
 * ---
 * name: hotel-booking
 * description: Handle hotel booking inquiries
 * triggers:
 *   - จองห้อง
 *   - ห้องว่าง
 *   - ราคาห้อง
 * ---
 *
 * # Hotel Booking Skill
 *
 * When user asks about booking, check availability first...
 * ```
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  skillsDir: path.join(__dirname, '..', 'skills'),
  cacheEnabled: true
};

// =============================================================================
// SKILL REGISTRY
// =============================================================================

const skillRegistry = new Map();
const skillCache = new Map();

/**
 * Parse SKILL.md frontmatter
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const frontmatter = match[1];
  const body = match[2];

  // Simple YAML-like parser
  const metadata = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();

    // Array item
    if (trimmed.startsWith('- ') && currentKey) {
      if (!currentArray) {
        currentArray = [];
        metadata[currentKey] = currentArray;
      }
      currentArray.push(trimmed.slice(2).trim());
      continue;
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      currentKey = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value) {
        metadata[currentKey] = value;
        currentArray = null;
      } else {
        // Might be array start
        currentArray = null;
      }
    }
  }

  return { metadata, body };
}

/**
 * Load a single skill from file
 */
function loadSkill(filePath) {
  if (skillCache.has(filePath)) {
    return skillCache.get(filePath);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { metadata, body } = parseFrontmatter(content);

    const skill = {
      path: filePath,
      name: metadata.name || path.basename(filePath, '.md'),
      description: metadata.description || '',
      triggers: metadata.triggers || [],
      priority: parseInt(metadata.priority) || 0,
      enabled: metadata.enabled !== 'false',
      body: body.trim()
    };

    if (CONFIG.cacheEnabled) {
      skillCache.set(filePath, skill);
    }

    return skill;
  } catch (error) {
    console.error(`[SKILL] Failed to load ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Discover all skills in the skills directory
 */
function discoverSkills() {
  skillRegistry.clear();

  if (!fs.existsSync(CONFIG.skillsDir)) {
    fs.mkdirSync(CONFIG.skillsDir, { recursive: true });
    console.log('[SKILL] Created skills directory:', CONFIG.skillsDir);
    return;
  }

  const files = fs.readdirSync(CONFIG.skillsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(CONFIG.skillsDir, file);
    const skill = loadSkill(filePath);

    if (skill && skill.enabled) {
      skillRegistry.set(skill.name, skill);
      console.log(`[SKILL] Loaded: ${skill.name} (${skill.triggers.length} triggers)`);
    }
  }

  console.log(`[SKILL] Total skills loaded: ${skillRegistry.size}`);
}

/**
 * Find matching skills for a message
 */
function findMatchingSkills(message) {
  const matches = [];
  const lowerMessage = message.toLowerCase();

  for (const skill of skillRegistry.values()) {
    for (const trigger of skill.triggers) {
      if (lowerMessage.includes(trigger.toLowerCase())) {
        matches.push({
          skill,
          trigger,
          priority: skill.priority
        });
        break; // One match per skill is enough
      }
    }
  }

  // Sort by priority (higher first)
  return matches.sort((a, b) => b.priority - a.priority);
}

/**
 * Get skill instructions for Claude prompt
 */
function getSkillInstructions(message) {
  const matches = findMatchingSkills(message);

  if (matches.length === 0) {
    return null;
  }

  const instructions = matches.map(m => {
    return `## Skill: ${m.skill.name}\n\n${m.skill.body}`;
  }).join('\n\n---\n\n');

  return {
    skills: matches.map(m => m.skill.name),
    instructions
  };
}

/**
 * Get all registered skills
 */
function getAllSkills() {
  return Array.from(skillRegistry.values());
}

/**
 * Get a specific skill by name
 */
function getSkill(name) {
  return skillRegistry.get(name);
}

/**
 * Reload all skills
 */
function reloadSkills() {
  skillCache.clear();
  discoverSkills();
}

/**
 * Create a new skill file
 */
function createSkill(name, options = {}) {
  const filePath = path.join(CONFIG.skillsDir, `${name}.md`);

  if (fs.existsSync(filePath)) {
    throw new Error(`Skill ${name} already exists`);
  }

  const content = `---
name: ${name}
description: ${options.description || ''}
triggers:
${(options.triggers || []).map(t => `  - ${t}`).join('\n') || '  - '}
priority: ${options.priority || 0}
enabled: true
---

# ${name}

${options.body || 'Add skill instructions here...'}
`;

  fs.writeFileSync(filePath, content);
  reloadSkills();

  return filePath;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Auto-discover skills on import
discoverSkills();

// =============================================================================
// EXPORTS
// =============================================================================

export {
  discoverSkills,
  findMatchingSkills,
  getSkillInstructions,
  getAllSkills,
  getSkill,
  reloadSkills,
  createSkill,
  loadSkill,
  parseFrontmatter,
  CONFIG
};

export default {
  discoverSkills,
  findMatchingSkills,
  getSkillInstructions,
  getAllSkills,
  getSkill,
  reloadSkills,
  createSkill
};
