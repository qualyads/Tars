/**
 * Mistake Tracker - Self-Learning from Errors
 *
 * ระบบติดตามความผิดพลาดของ Oracle เพื่อไม่ทำซ้ำ
 *
 * Features:
 * - Log mistakes with context
 * - Store corrections from Tars
 * - Identify root causes
 * - Prevention rules
 * - Check before responding (prevent repeat)
 * - Pattern detection
 *
 * Usage:
 * - Record: tracker.record({ mistake, correction, cause })
 * - Check: tracker.checkBeforeResponding(intent)
 * - Learn: tracker.getPreventionRules()
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mistake categories
 */
const CATEGORIES = {
  ASSUMPTION: 'assumption',      // คิดเอาเองไม่ได้เช็ค
  MEMORY: 'memory',              // จำผิด/ลืม
  OVERCLAIM: 'overclaim',        // อ้างเกินจริง
  UNDERCLAIM: 'underclaim',      // ประเมินต่ำเกินไป
  PERMISSION: 'permission',      // ถาม permission เกินไป
  VERBOSE: 'verbose',            // พูดมากเกินไป
  MISSED_CONTEXT: 'missed_context', // ไม่เข้าใจ context
  WRONG_TONE: 'wrong_tone',      // น้ำเสียงไม่เหมาะ
  TECHNICAL: 'technical',        // ข้อมูลทางเทคนิคผิด
  OTHER: 'other'
};

/**
 * Severity levels
 */
const SEVERITY = {
  LOW: 'low',           // Minor, easily corrected
  MEDIUM: 'medium',     // Noticeable, caused confusion
  HIGH: 'high',         // Significant, wasted time
  CRITICAL: 'critical'  // Major trust impact
};

/**
 * Mistake Tracker Class
 */
class MistakeTracker {
  constructor(config = {}) {
    this.config = {
      storagePath: config.storagePath || path.join(__dirname, '..', 'data', 'mistakes.json'),
      maxMistakes: config.maxMistakes || 500,
      enableAutoCheck: config.enableAutoCheck !== false,
      ...config
    };

    // In-memory store
    this.mistakes = [];
    this.preventionRules = [];
    this.patterns = [];
    this.neverRepeat = new Set();

    // Stats
    this.stats = {
      totalMistakes: 0,
      byCategory: {},
      bySeverity: {},
      repeatedMistakes: 0,
      preventedMistakes: 0
    };

    // Load from storage
    this._loadFromStorage();
  }

  /**
   * Record a mistake
   * @param {object} mistake
   */
  record(mistake) {
    const {
      description,           // What I said/did wrong
      correction,            // What Tars corrected
      category = CATEGORIES.OTHER,
      severity = SEVERITY.MEDIUM,
      context = {},          // Additional context
      rootCause = '',        // Why it happened
      prevention = '',       // How to prevent
      neverRepeat = false    // Add to never-repeat list
    } = mistake;

    const entry = {
      id: `m_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      description,
      correction,
      category,
      severity,
      context,
      rootCause,
      prevention,
      repeated: this._checkIfRepeated(description, category),
      correctedBy: 'Tars'
    };

    // Add to mistakes list
    this.mistakes.unshift(entry);

    // Trim if too many
    if (this.mistakes.length > this.config.maxMistakes) {
      this.mistakes = this.mistakes.slice(0, this.config.maxMistakes);
    }

    // Update stats
    this._updateStats(entry);

    // Add prevention rule if provided
    if (prevention) {
      this.addPreventionRule({
        trigger: category,
        rule: prevention,
        fromMistake: entry.id
      });
    }

    // Add to never-repeat if flagged
    if (neverRepeat) {
      this.neverRepeat.add(description.toLowerCase().trim());
    }

    // Detect patterns
    this._detectPatterns();

    // Save to storage
    this._saveToStorage();

    console.log(`[MISTAKE] Recorded: ${description.substring(0, 50)}... (${category}/${severity})`);

    return entry;
  }

  /**
   * Check if a similar mistake was made before
   */
  _checkIfRepeated(description, category) {
    const similar = this.mistakes.find(m =>
      m.category === category &&
      this._similarity(m.description, description) > 0.7
    );

    if (similar) {
      this.stats.repeatedMistakes++;
      return true;
    }
    return false;
  }

  /**
   * Simple similarity check (Jaccard index)
   */
  _similarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  /**
   * Update statistics
   */
  _updateStats(entry) {
    this.stats.totalMistakes++;
    this.stats.byCategory[entry.category] = (this.stats.byCategory[entry.category] || 0) + 1;
    this.stats.bySeverity[entry.severity] = (this.stats.bySeverity[entry.severity] || 0) + 1;
  }

  /**
   * Add a prevention rule
   */
  addPreventionRule(rule) {
    const { trigger, rule: ruleText, fromMistake } = rule;

    // Check for duplicate
    const exists = this.preventionRules.some(r =>
      r.trigger === trigger && r.rule === ruleText
    );

    if (!exists) {
      this.preventionRules.push({
        id: `pr_${Date.now()}`,
        trigger,
        rule: ruleText,
        fromMistake,
        createdAt: new Date().toISOString(),
        timesApplied: 0
      });

      console.log(`[MISTAKE] Added prevention rule: ${ruleText.substring(0, 50)}...`);
    }
  }

  /**
   * Check before responding - returns warnings if about to repeat mistake
   * @param {object} intent - What I'm about to do
   * @returns {object} Warnings and rules to follow
   */
  checkBeforeResponding(intent) {
    if (!this.config.enableAutoCheck) {
      return { ok: true, warnings: [] };
    }

    const {
      action = '',          // What action I'm taking
      topic = '',           // What topic
      claiming = '',        // What I'm claiming
      askingPermission = false
    } = intent;

    const warnings = [];
    const rulesToFollow = [];

    // Check never-repeat list
    const claimLower = claiming.toLowerCase();
    for (const neverItem of this.neverRepeat) {
      if (claimLower.includes(neverItem)) {
        warnings.push({
          type: 'never_repeat',
          message: `ห้ามพูดเรื่องนี้อีก: "${neverItem}"`,
          severity: SEVERITY.CRITICAL
        });
      }
    }

    // Check if asking permission (Tars hates this)
    if (askingPermission) {
      const permissionMistakes = this.mistakes.filter(m => m.category === CATEGORIES.PERMISSION);
      if (permissionMistakes.length > 0) {
        warnings.push({
          type: 'permission_pattern',
          message: 'Tars ไม่ชอบถูกถาม permission - ทำเลย!',
          severity: SEVERITY.HIGH,
          previousMistakes: permissionMistakes.length
        });
      }
    }

    // Check for assumption pattern (claiming without checking)
    if (claiming && action === 'claim') {
      const assumptionMistakes = this.mistakes.filter(m => m.category === CATEGORIES.ASSUMPTION);
      if (assumptionMistakes.length > 0) {
        warnings.push({
          type: 'assumption_pattern',
          message: 'เช็คข้อมูลก่อนอ้าง - เคยผิดมาแล้ว!',
          severity: SEVERITY.HIGH,
          rule: 'ls lib/ หรือ grep ก่อนบอกว่ามี/ไม่มี'
        });
      }
    }

    // Get relevant prevention rules
    const relevantRules = this.preventionRules.filter(r => {
      if (r.trigger === topic) return true;
      if (r.trigger === action) return true;
      return false;
    });

    for (const rule of relevantRules) {
      rulesToFollow.push(rule.rule);
      rule.timesApplied++;
    }

    // Track if we prevented a mistake
    if (warnings.length > 0) {
      this.stats.preventedMistakes++;
    }

    return {
      ok: warnings.length === 0,
      warnings,
      rulesToFollow,
      suggestion: warnings.length > 0 ?
        'หยุดคิดก่อน! เช็คข้อมูลให้แน่ใจ' :
        null
    };
  }

  /**
   * Detect patterns in mistakes
   */
  _detectPatterns() {
    // Count by category
    const categoryCounts = {};
    for (const m of this.mistakes.slice(0, 50)) { // Recent 50
      categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
    }

    // Find patterns (categories with 3+ occurrences)
    this.patterns = Object.entries(categoryCounts)
      .filter(([_, count]) => count >= 3)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / Math.min(50, this.mistakes.length)) * 100),
        recentExamples: this.mistakes
          .filter(m => m.category === category)
          .slice(0, 3)
          .map(m => m.description.substring(0, 50))
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get my weak areas (patterns)
   */
  getWeakAreas() {
    return this.patterns;
  }

  /**
   * Get prevention rules
   */
  getPreventionRules() {
    return this.preventionRules;
  }

  /**
   * Get recent mistakes
   */
  getRecent(limit = 10) {
    return this.mistakes.slice(0, limit);
  }

  /**
   * Get mistakes by category
   */
  getByCategory(category) {
    return this.mistakes.filter(m => m.category === category);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      patterns: this.patterns,
      preventionRulesCount: this.preventionRules.length,
      neverRepeatCount: this.neverRepeat.size,
      topWeakness: this.patterns[0]?.category || 'none'
    };
  }

  /**
   * Get summary for context loading
   */
  getSummaryForContext() {
    const recentMistakes = this.mistakes.slice(0, 5);
    const topPatterns = this.patterns.slice(0, 3);

    return {
      recentMistakes: recentMistakes.map(m => ({
        what: m.description,
        correction: m.correction,
        prevention: m.prevention
      })),
      weakAreas: topPatterns.map(p => p.category),
      criticalRules: this.preventionRules
        .filter(r => r.timesApplied > 0)
        .slice(0, 5)
        .map(r => r.rule),
      neverRepeat: Array.from(this.neverRepeat).slice(0, 10)
    };
  }

  /**
   * Clear all mistakes (reset)
   */
  clear() {
    this.mistakes = [];
    this.preventionRules = [];
    this.patterns = [];
    this.neverRepeat.clear();
    this.stats = {
      totalMistakes: 0,
      byCategory: {},
      bySeverity: {},
      repeatedMistakes: 0,
      preventedMistakes: 0
    };
    this._saveToStorage();
    console.log('[MISTAKE] All data cleared');
  }

  /**
   * Load from storage
   */
  _loadFromStorage() {
    try {
      if (fs.existsSync(this.config.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.config.storagePath, 'utf8'));
        this.mistakes = data.mistakes || [];
        this.preventionRules = data.preventionRules || [];
        this.patterns = data.patterns || [];
        this.neverRepeat = new Set(data.neverRepeat || []);
        this.stats = data.stats || this.stats;
        console.log(`[MISTAKE] Loaded ${this.mistakes.length} mistakes from storage`);
      }
    } catch (err) {
      console.error('[MISTAKE] Failed to load from storage:', err.message);
    }
  }

  /**
   * Save to storage
   */
  _saveToStorage() {
    try {
      const dir = path.dirname(this.config.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        mistakes: this.mistakes,
        preventionRules: this.preventionRules,
        patterns: this.patterns,
        neverRepeat: Array.from(this.neverRepeat),
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      };

      fs.writeFileSync(this.config.storagePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[MISTAKE] Failed to save to storage:', err.message);
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: true,
      totalMistakes: this.mistakes.length,
      preventionRules: this.preventionRules.length,
      neverRepeatItems: this.neverRepeat.size,
      patterns: this.patterns.length,
      stats: this.stats
    };
  }
}

// Singleton instance
const mistakeTracker = new MistakeTracker();

// Only add initial prevention rules if they don't exist yet
// (Check if already loaded from storage)
if (mistakeTracker.preventionRules.length === 0) {
  console.log('[MISTAKE] Adding initial prevention rules...');

  mistakeTracker.addPreventionRule({
    trigger: CATEGORIES.ASSUMPTION,
    rule: 'เช็คโค้ดจริงก่อนพูด - ls, grep, head ก่อนอ้าง'
  });

  mistakeTracker.addPreventionRule({
    trigger: CATEGORIES.UNDERCLAIM,
    rule: 'นับไฟล์จริง ls | wc -l ก่อนบอกจำนวน'
  });

  mistakeTracker.addPreventionRule({
    trigger: CATEGORIES.PERMISSION,
    rule: 'Tars ไม่ชอบถูกถาม - ทำเลย ไม่ต้องขออนุญาต'
  });
}

export default mistakeTracker;
export { MistakeTracker, CATEGORIES, SEVERITY };
