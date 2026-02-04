/**
 * Self-Reflection System
 *
 * ระบบตรวจสอบคำตอบก่อนส่ง
 *
 * Features:
 * - Check response against guidelines
 * - Detect potential mistakes
 * - Suggest improvements
 * - Filter inappropriate content
 * - Verify facts before claiming
 *
 * Usage:
 * - Before sending: reflection.check(response, context)
 * - Get suggestions: reflection.suggest(response)
 * - Auto-improve: reflection.improve(response)
 */

/**
 * Check categories
 */
const CHECKS = {
  TONE: 'tone',               // น้ำเสียงเหมาะสม
  ACCURACY: 'accuracy',       // ความถูกต้อง
  COMPLETENESS: 'completeness', // ตอบครบ
  BREVITY: 'brevity',         // กระชับ
  HELPFULNESS: 'helpfulness', // มีประโยชน์
  SAFETY: 'safety',           // ปลอดภัย
  PERMISSION: 'permission',   // ไม่ถามมากเกิน
  ASSUMPTION: 'assumption'    // ไม่คาดเดา
};

/**
 * Issue severity
 */
const SEVERITY = {
  INFO: 'info',       // Just a note
  WARNING: 'warning', // Should consider
  ERROR: 'error',     // Must fix
  BLOCK: 'block'      // Cannot send
};

/**
 * Patterns to detect issues
 */
const PATTERNS = {
  // Permission patterns (Tars hates being asked)
  askingPermission: [
    /ได้ไหม\s*[?？]/gi,
    /ขออนุญาต/gi,
    /จะทำได้ไหม/gi,
    /can I\s*\?/gi,
    /should I\s*\?/gi,
    /may I\s*\?/gi,
    /would you like me to/gi,
    /do you want me to/gi,
    /shall I/gi
  ],

  // Overclaiming patterns
  overclaiming: [
    /ผมทำเสร็จแล้วทุกอย่าง/gi,
    /ทำครบหมดแล้ว/gi,
    /100%/gi,
    /everything is done/gi,
    /all complete/gi,
    /fully implemented/gi
  ],

  // Assumption patterns
  assumptions: [
    /น่าจะ.*มี/gi,
    /คิดว่า.*ไม่มี/gi,
    /probably has/gi,
    /I think it doesn't/gi,
    /I assume/gi,
    /should have/gi
  ],

  // Verbose patterns
  verbose: [
    /ดังนั้นจึง/gi,
    /ในทางกลับกัน/gi,
    /อย่างไรก็ตาม/gi,
    /สรุปได้ว่า/gi,
    /however,/gi,
    /in conclusion/gi,
    /furthermore/gi,
    /additionally/gi
  ],

  // Unsafe patterns
  unsafe: [
    /password\s*[=:]/gi,
    /api[_-]?key\s*[=:]/gi,
    /secret\s*[=:]/gi,
    /token\s*[=:]/gi
  ]
};

/**
 * Self-Reflection System
 */
class SelfReflection {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      autoFix: config.autoFix || false,
      strictMode: config.strictMode || false,
      maxLength: config.maxLength || 2000,
      minLength: config.minLength || 10,
      ...config
    };

    // Track reflections
    this.reflections = [];
    this.stats = {
      checked: 0,
      issues: 0,
      blocked: 0,
      improved: 0
    };

    // Custom rules
    this.customRules = [];
  }

  /**
   * Check response before sending
   * @param {string} response - The response to check
   * @param {object} context - Context about the conversation
   * @returns {object} Check result with issues and suggestions
   */
  check(response, context = {}) {
    if (!this.config.enabled || !response) {
      return { ok: true, issues: [], suggestions: [] };
    }

    this.stats.checked++;
    const issues = [];
    const suggestions = [];

    // 1. Check length
    if (response.length > this.config.maxLength) {
      issues.push({
        type: CHECKS.BREVITY,
        severity: SEVERITY.WARNING,
        message: `Response too long (${response.length} chars, max ${this.config.maxLength})`,
        suggestion: 'ตอบให้กระชับกว่านี้'
      });
    }

    if (response.length < this.config.minLength) {
      issues.push({
        type: CHECKS.COMPLETENESS,
        severity: SEVERITY.WARNING,
        message: `Response too short (${response.length} chars)`,
        suggestion: 'ตอบให้ครบถ้วนกว่านี้'
      });
    }

    // 2. Check permission patterns
    for (const pattern of PATTERNS.askingPermission) {
      if (pattern.test(response)) {
        issues.push({
          type: CHECKS.PERMISSION,
          severity: SEVERITY.ERROR,
          message: 'กำลังจะถาม permission - Tars ไม่ชอบ!',
          suggestion: 'ทำเลย ไม่ต้องถาม',
          match: response.match(pattern)?.[0]
        });
        break; // One is enough
      }
    }

    // 3. Check overclaiming patterns
    for (const pattern of PATTERNS.overclaiming) {
      if (pattern.test(response)) {
        issues.push({
          type: CHECKS.ACCURACY,
          severity: SEVERITY.WARNING,
          message: 'กำลังจะ overclaim - เช็คข้อมูลก่อน!',
          suggestion: 'เช็ค ls / grep ก่อนบอกว่าทำครบ',
          match: response.match(pattern)?.[0]
        });
        break;
      }
    }

    // 4. Check assumption patterns
    for (const pattern of PATTERNS.assumptions) {
      if (pattern.test(response)) {
        issues.push({
          type: CHECKS.ASSUMPTION,
          severity: SEVERITY.WARNING,
          message: 'กำลังจะ assume - เช็คข้อมูลก่อน!',
          suggestion: 'ดูโค้ดจริงก่อนบอกว่ามี/ไม่มี',
          match: response.match(pattern)?.[0]
        });
        break;
      }
    }

    // 5. Check verbose patterns
    let verboseCount = 0;
    for (const pattern of PATTERNS.verbose) {
      const matches = response.match(pattern);
      if (matches) verboseCount += matches.length;
    }
    if (verboseCount >= 3) {
      issues.push({
        type: CHECKS.BREVITY,
        severity: SEVERITY.INFO,
        message: `Too many filler words (${verboseCount} found)`,
        suggestion: 'ตัดคำฟุ่มเฟือยออก'
      });
    }

    // 6. Check unsafe patterns (secrets)
    for (const pattern of PATTERNS.unsafe) {
      if (pattern.test(response)) {
        issues.push({
          type: CHECKS.SAFETY,
          severity: SEVERITY.BLOCK,
          message: 'กำลังจะ expose secrets!',
          suggestion: 'ลบ credentials ออก',
          match: response.match(pattern)?.[0]
        });
        break;
      }
    }

    // 7. Check custom rules
    for (const rule of this.customRules) {
      const result = rule.check(response, context);
      if (result) {
        issues.push(result);
      }
    }

    // 8. Context-specific checks
    if (context.previousMistake) {
      // About to repeat previous mistake
      issues.push({
        type: CHECKS.ACCURACY,
        severity: SEVERITY.ERROR,
        message: `About to repeat mistake: ${context.previousMistake}`,
        suggestion: 'หยุด! เคยพลาดเรื่องนี้มาแล้ว'
      });
    }

    // Generate suggestions
    if (issues.length > 0) {
      this.stats.issues += issues.length;

      // Group by severity
      const errors = issues.filter(i => i.severity === SEVERITY.ERROR || i.severity === SEVERITY.BLOCK);
      const warnings = issues.filter(i => i.severity === SEVERITY.WARNING);

      if (errors.length > 0) {
        suggestions.push('🛑 STOP! แก้ปัญหาก่อนส่ง');
      }

      // Add unique suggestions
      const uniqueSuggestions = [...new Set(issues.map(i => i.suggestion))];
      suggestions.push(...uniqueSuggestions);
    }

    // Determine if blocked
    const blocked = issues.some(i => i.severity === SEVERITY.BLOCK);
    if (blocked) {
      this.stats.blocked++;
    }

    // Store reflection
    const reflection = {
      id: `ref_${Date.now()}`,
      timestamp: new Date().toISOString(),
      responseLength: response.length,
      issues,
      suggestions,
      blocked,
      context
    };
    this.reflections.unshift(reflection);

    // Keep only recent reflections
    if (this.reflections.length > 100) {
      this.reflections = this.reflections.slice(0, 100);
    }

    return {
      ok: issues.length === 0,
      blocked,
      issues,
      suggestions,
      reflection
    };
  }

  /**
   * Suggest improvements for a response
   */
  suggest(response) {
    const result = this.check(response);
    return result.suggestions;
  }

  /**
   * Auto-improve response (basic)
   */
  improve(response) {
    if (!this.config.autoFix) {
      return response;
    }

    let improved = response;

    // Remove verbose filler words
    const fillers = [
      [/อย่างไรก็ตาม,?\s*/gi, ''],
      [/ในทางกลับกัน,?\s*/gi, ''],
      [/ดังนั้นจึง\s*/gi, ''],
      [/however,?\s*/gi, ''],
      [/furthermore,?\s*/gi, ''],
      [/additionally,?\s*/gi, '']
    ];

    for (const [pattern, replacement] of fillers) {
      improved = improved.replace(pattern, replacement);
    }

    // Remove permission questions
    const permissionFixes = [
      [/ได้ไหม\s*[?？]/gi, '.'],
      [/shall I\s*\?/gi, '.'],
      [/do you want me to\s*\?/gi, '.']
    ];

    for (const [pattern, replacement] of permissionFixes) {
      improved = improved.replace(pattern, replacement);
    }

    if (improved !== response) {
      this.stats.improved++;
    }

    return improved;
  }

  /**
   * Add custom rule
   */
  addRule(name, checkFn) {
    this.customRules.push({
      name,
      check: checkFn
    });
  }

  /**
   * Remove custom rule
   */
  removeRule(name) {
    this.customRules = this.customRules.filter(r => r.name !== name);
  }

  /**
   * Get recent reflections
   */
  getRecent(limit = 10) {
    return this.reflections.slice(0, limit);
  }

  /**
   * Get common issues
   */
  getCommonIssues() {
    const counts = {};

    for (const ref of this.reflections) {
      for (const issue of ref.issues) {
        counts[issue.type] = (counts[issue.type] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      customRules: this.customRules.length,
      recentReflections: this.reflections.length,
      commonIssues: this.getCommonIssues().slice(0, 5)
    };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      autoFix: this.config.autoFix,
      strictMode: this.config.strictMode,
      stats: this.stats,
      customRules: this.customRules.map(r => r.name)
    };
  }

  /**
   * Clear reflections
   */
  clear() {
    this.reflections = [];
    this.stats = {
      checked: 0,
      issues: 0,
      blocked: 0,
      improved: 0
    };
  }
}

// Singleton instance
const selfReflection = new SelfReflection();

// Add Tars-specific rules
selfReflection.addRule('no-emoji-unless-asked', (response, context) => {
  if (!context.emojiAllowed && /[\u{1F600}-\u{1F64F}]/u.test(response)) {
    return {
      type: CHECKS.TONE,
      severity: SEVERITY.INFO,
      message: 'Using emoji without being asked',
      suggestion: 'ไม่ต้องใส่ emoji ถ้าไม่ได้ถูกขอ'
    };
  }
  return null;
});

selfReflection.addRule('no-excessive-apologies', (response) => {
  const apologies = (response.match(/ขอโทษ|sorry|apologize/gi) || []).length;
  if (apologies >= 2) {
    return {
      type: CHECKS.TONE,
      severity: SEVERITY.WARNING,
      message: 'Too many apologies',
      suggestion: 'ขอโทษครั้งเดียวพอ แล้วแก้ปัญหา'
    };
  }
  return null;
});

export default selfReflection;
export { SelfReflection, CHECKS, SEVERITY, PATTERNS };
