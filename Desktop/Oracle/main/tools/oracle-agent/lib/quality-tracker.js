/**
 * Response Quality Tracker
 *
 * วัดคุณภาพคำตอบของตัวเอง
 *
 * Features:
 * - Score responses on multiple dimensions
 * - Track quality over time
 * - Identify areas for improvement
 * - Compare with previous performance
 * - Generate quality reports
 *
 * Usage:
 * - Score: tracker.score(response, context)
 * - Report: tracker.getReport()
 * - Trend: tracker.getTrend()
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Quality dimensions
 */
const DIMENSIONS = {
  RELEVANCE: 'relevance',       // ตรงประเด็น
  ACCURACY: 'accuracy',         // ถูกต้อง
  COMPLETENESS: 'completeness', // ครบถ้วน
  BREVITY: 'brevity',           // กระชับ
  CLARITY: 'clarity',           // ชัดเจน
  HELPFULNESS: 'helpfulness',   // มีประโยชน์
  TONE: 'tone'                  // น้ำเสียงเหมาะสม
};

/**
 * Score thresholds
 */
const THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  ACCEPTABLE: 60,
  NEEDS_IMPROVEMENT: 40,
  POOR: 0
};

/**
 * Quality Tracker
 */
class QualityTracker {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      storagePath: config.storagePath || path.join(__dirname, '..', 'data', 'quality.json'),
      maxRecords: config.maxRecords || 500,
      autoScore: config.autoScore || false,
      ...config
    };

    // Records storage
    this.records = [];

    // Stats
    this.stats = {
      total: 0,
      averageScore: 0,
      byDimension: {},
      grades: {
        excellent: 0,
        good: 0,
        acceptable: 0,
        needsImprovement: 0,
        poor: 0
      }
    };

    // Load from storage
    this._loadFromStorage();
  }

  /**
   * Score a response
   * @param {string} response - The response to score
   * @param {object} context - Context about the interaction
   * @param {object} feedback - Optional feedback from user
   * @returns {object} Quality score
   */
  score(response, context = {}, feedback = {}) {
    if (!this.config.enabled || !response) {
      return { score: 0, dimensions: {}, grade: 'unknown' };
    }

    const dimensions = {};

    // 1. Relevance (based on context match)
    dimensions[DIMENSIONS.RELEVANCE] = this._scoreRelevance(response, context);

    // 2. Brevity (based on length and content ratio)
    dimensions[DIMENSIONS.BREVITY] = this._scoreBrevity(response, context);

    // 3. Clarity (based on structure and readability)
    dimensions[DIMENSIONS.CLARITY] = this._scoreClarity(response);

    // 4. Completeness (based on expected elements)
    dimensions[DIMENSIONS.COMPLETENESS] = this._scoreCompleteness(response, context);

    // 5. Tone (based on patterns)
    dimensions[DIMENSIONS.TONE] = this._scoreTone(response, context);

    // 6. Apply user feedback if provided
    if (feedback.userRating !== undefined) {
      dimensions[DIMENSIONS.HELPFULNESS] = feedback.userRating * 20; // Scale 1-5 to 0-100
    } else {
      // Estimate helpfulness
      dimensions[DIMENSIONS.HELPFULNESS] = this._estimateHelpfulness(response, context);
    }

    // 7. Accuracy (if we can verify)
    if (feedback.accurate !== undefined) {
      dimensions[DIMENSIONS.ACCURACY] = feedback.accurate ? 100 : 0;
    } else {
      // Default to neutral
      dimensions[DIMENSIONS.ACCURACY] = 70;
    }

    // Calculate overall score (weighted average)
    const weights = {
      [DIMENSIONS.RELEVANCE]: 1.5,
      [DIMENSIONS.ACCURACY]: 1.5,
      [DIMENSIONS.COMPLETENESS]: 1.2,
      [DIMENSIONS.BREVITY]: 1.0,
      [DIMENSIONS.CLARITY]: 1.0,
      [DIMENSIONS.HELPFULNESS]: 1.3,
      [DIMENSIONS.TONE]: 0.8
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [dim, score] of Object.entries(dimensions)) {
      const weight = weights[dim] || 1.0;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    const overallScore = Math.round(weightedSum / totalWeight);
    const grade = this._getGrade(overallScore);

    // Create record
    const record = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      score: overallScore,
      grade,
      dimensions,
      responseLength: response.length,
      context: {
        type: context.type || 'unknown',
        topic: context.topic || 'unknown'
      },
      feedback: Object.keys(feedback).length > 0 ? feedback : null
    };

    // Store record
    this.records.unshift(record);
    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(0, this.config.maxRecords);
    }

    // Update stats
    this._updateStats(record);

    // Save to storage
    this._saveToStorage();

    console.log(`[QUALITY] Score: ${overallScore} (${grade}) - ${Object.entries(dimensions).map(([k,v]) => `${k}:${v}`).join(', ')}`);

    return {
      score: overallScore,
      grade,
      dimensions,
      record
    };
  }

  /**
   * Score relevance
   */
  _scoreRelevance(response, context) {
    let score = 70; // Base score

    // Check if response addresses the topic
    if (context.topic && response.toLowerCase().includes(context.topic.toLowerCase())) {
      score += 15;
    }

    // Check if response addresses keywords
    if (context.keywords) {
      const keywords = Array.isArray(context.keywords) ? context.keywords : [context.keywords];
      const found = keywords.filter(k => response.toLowerCase().includes(k.toLowerCase()));
      score += (found.length / keywords.length) * 15;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Score brevity
   */
  _scoreBrevity(response, context) {
    const length = response.length;
    const expectedLength = context.expectedLength || 500;

    // Perfect length = 100, too long or too short = lower
    if (length === 0) return 0;

    const ratio = length / expectedLength;

    if (ratio >= 0.5 && ratio <= 1.5) {
      return 100; // Perfect range
    } else if (ratio < 0.5) {
      return Math.round(50 + (ratio * 100)); // Too short
    } else {
      return Math.round(100 - ((ratio - 1.5) * 30)); // Too long
    }
  }

  /**
   * Score clarity
   */
  _scoreClarity(response) {
    let score = 70;

    // Check for structure (lists, headers, code blocks)
    if (/^[-*•]\s/m.test(response)) score += 10; // Has lists
    if (/^#+\s/m.test(response)) score += 5; // Has headers
    if (/```/.test(response)) score += 5; // Has code blocks

    // Penalize wall of text
    const paragraphs = response.split(/\n\n+/).length;
    if (paragraphs === 1 && response.length > 500) {
      score -= 20; // Wall of text
    }

    // Penalize very long sentences
    const sentences = response.split(/[.!?]+/);
    const avgSentenceLength = response.length / sentences.length;
    if (avgSentenceLength > 150) {
      score -= 15; // Sentences too long
    }

    return Math.max(Math.min(Math.round(score), 100), 0);
  }

  /**
   * Score completeness
   */
  _scoreCompleteness(response, context) {
    let score = 70;

    // Check for expected elements
    if (context.expectCode && /```/.test(response)) score += 15;
    if (context.expectSteps && /^[\d]+\./m.test(response)) score += 15;
    if (context.expectExplanation && response.length > 100) score += 10;

    // Check if it's a complete sentence/thought
    if (/[.!?]$/.test(response.trim())) score += 5;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Score tone
   */
  _scoreTone(response, context) {
    let score = 80;

    // Check for appropriate tone
    const formalContext = context.formal !== false;

    // Penalize excessive emoji in formal context
    if (formalContext) {
      const emojiCount = (response.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
      if (emojiCount > 2) score -= 10;
    }

    // Penalize excessive apologies
    const apologies = (response.match(/ขอโทษ|sorry|apologize/gi) || []).length;
    if (apologies > 1) score -= 10;

    // Penalize asking permission (Tars specific)
    if (/ได้ไหม|should I|shall I|can I/gi.test(response)) {
      score -= 15;
    }

    // Reward directness
    if (/^[A-Z]|^[ก-๙]/.test(response) && response.length < 500) {
      score += 5; // Direct answer
    }

    return Math.max(Math.min(Math.round(score), 100), 0);
  }

  /**
   * Estimate helpfulness
   */
  _estimateHelpfulness(response, context) {
    let score = 70;

    // Has actionable content
    if (/```|http|ทำได้โดย|step|วิธี/gi.test(response)) score += 15;

    // Has specific information
    if (/\d+|@|\.js|\.py/gi.test(response)) score += 10;

    // Is a real answer (not just "I don't know")
    if (!/ไม่ทราบ|don't know|not sure/gi.test(response)) score += 5;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Get grade from score
   */
  _getGrade(score) {
    if (score >= THRESHOLDS.EXCELLENT) return 'excellent';
    if (score >= THRESHOLDS.GOOD) return 'good';
    if (score >= THRESHOLDS.ACCEPTABLE) return 'acceptable';
    if (score >= THRESHOLDS.NEEDS_IMPROVEMENT) return 'needs_improvement';
    return 'poor';
  }

  /**
   * Update statistics
   */
  _updateStats(record) {
    this.stats.total++;

    // Update average
    const oldTotal = this.stats.averageScore * (this.stats.total - 1);
    this.stats.averageScore = Math.round((oldTotal + record.score) / this.stats.total);

    // Update by dimension
    for (const [dim, score] of Object.entries(record.dimensions)) {
      if (!this.stats.byDimension[dim]) {
        this.stats.byDimension[dim] = { total: 0, sum: 0, avg: 0 };
      }
      this.stats.byDimension[dim].total++;
      this.stats.byDimension[dim].sum += score;
      this.stats.byDimension[dim].avg = Math.round(
        this.stats.byDimension[dim].sum / this.stats.byDimension[dim].total
      );
    }

    // Update grades
    this.stats.grades[record.grade]++;
  }

  /**
   * Add user feedback to a record
   */
  addFeedback(recordId, feedback) {
    const record = this.records.find(r => r.id === recordId);
    if (record) {
      record.feedback = { ...record.feedback, ...feedback };

      // Recalculate score if rating provided
      if (feedback.userRating !== undefined) {
        record.dimensions[DIMENSIONS.HELPFULNESS] = feedback.userRating * 20;
        // Could recalculate overall score here
      }

      this._saveToStorage();
      return record;
    }
    return null;
  }

  /**
   * Get quality report
   */
  getReport() {
    const recent = this.records.slice(0, 50);

    // Calculate trend
    const oldAvg = recent.slice(25, 50).reduce((s, r) => s + r.score, 0) / 25 || 0;
    const newAvg = recent.slice(0, 25).reduce((s, r) => s + r.score, 0) / 25 || 0;
    const trend = newAvg - oldAvg;

    // Find weak areas
    const weakDimensions = Object.entries(this.stats.byDimension)
      .filter(([_, data]) => data.avg < 70)
      .map(([dim, data]) => ({ dimension: dim, average: data.avg }))
      .sort((a, b) => a.average - b.average);

    // Find strong areas
    const strongDimensions = Object.entries(this.stats.byDimension)
      .filter(([_, data]) => data.avg >= 80)
      .map(([dim, data]) => ({ dimension: dim, average: data.avg }))
      .sort((a, b) => b.average - a.average);

    return {
      summary: {
        totalResponses: this.stats.total,
        averageScore: this.stats.averageScore,
        gradeDistribution: this.stats.grades,
        trend: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
        trendValue: Math.round(trend)
      },
      dimensions: this.stats.byDimension,
      weakAreas: weakDimensions.slice(0, 3),
      strongAreas: strongDimensions.slice(0, 3),
      recommendations: this._getRecommendations(weakDimensions)
    };
  }

  /**
   * Get recommendations based on weak areas
   */
  _getRecommendations(weakDimensions) {
    const recommendations = [];

    for (const { dimension } of weakDimensions.slice(0, 3)) {
      switch (dimension) {
        case DIMENSIONS.RELEVANCE:
          recommendations.push('Focus on answering the specific question asked');
          break;
        case DIMENSIONS.BREVITY:
          recommendations.push('Keep responses concise - avoid unnecessary details');
          break;
        case DIMENSIONS.CLARITY:
          recommendations.push('Use bullet points and structure for complex answers');
          break;
        case DIMENSIONS.COMPLETENESS:
          recommendations.push('Ensure all parts of the question are addressed');
          break;
        case DIMENSIONS.TONE:
          recommendations.push('Be direct - avoid asking permission or over-apologizing');
          break;
        case DIMENSIONS.ACCURACY:
          recommendations.push('Verify information before stating - check code/files first');
          break;
        case DIMENSIONS.HELPFULNESS:
          recommendations.push('Include actionable steps or examples');
          break;
      }
    }

    return recommendations;
  }

  /**
   * Get trend data
   */
  getTrend(days = 7) {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const dailyScores = {};

    for (const record of this.records) {
      const recordDate = new Date(record.timestamp);
      const daysAgo = Math.floor((now - recordDate.getTime()) / msPerDay);

      if (daysAgo < days) {
        const dateKey = recordDate.toISOString().split('T')[0];
        if (!dailyScores[dateKey]) {
          dailyScores[dateKey] = { scores: [], count: 0 };
        }
        dailyScores[dateKey].scores.push(record.score);
        dailyScores[dateKey].count++;
      }
    }

    return Object.entries(dailyScores)
      .map(([date, data]) => ({
        date,
        average: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.count),
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get recent records
   */
  getRecent(limit = 10) {
    return this.records.slice(0, limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    return this.stats;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      totalRecords: this.records.length,
      averageScore: this.stats.averageScore,
      stats: this.stats
    };
  }

  /**
   * Load from storage
   */
  _loadFromStorage() {
    try {
      if (fs.existsSync(this.config.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.config.storagePath, 'utf8'));
        this.records = data.records || [];
        this.stats = data.stats || this.stats;
        console.log(`[QUALITY] Loaded ${this.records.length} records from storage`);
      }
    } catch (err) {
      console.error('[QUALITY] Failed to load from storage:', err.message);
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

      fs.writeFileSync(this.config.storagePath, JSON.stringify({
        records: this.records,
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('[QUALITY] Failed to save to storage:', err.message);
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.records = [];
    this.stats = {
      total: 0,
      averageScore: 0,
      byDimension: {},
      grades: {
        excellent: 0,
        good: 0,
        acceptable: 0,
        needsImprovement: 0,
        poor: 0
      }
    };
    this._saveToStorage();
  }
}

// Singleton instance
const qualityTracker = new QualityTracker();

export default qualityTracker;
export { QualityTracker, DIMENSIONS, THRESHOLDS };
