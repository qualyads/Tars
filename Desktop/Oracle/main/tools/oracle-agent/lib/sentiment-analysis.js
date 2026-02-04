/**
 * Sentiment Analysis
 *
 * ตรวจจับอารมณ์ของ user จากข้อความ
 *
 * Features:
 * - Detect mood (happy, angry, sad, neutral, etc.)
 * - Urgency detection
 * - Frustration detection
 * - Adjust response style based on mood
 * - Track mood over conversation
 *
 * Usage:
 * - Analyze: sentiment.analyze(message)
 * - Get mood: sentiment.getMood(userId)
 * - Adjust: sentiment.getResponseStyle(mood)
 */

/**
 * Mood categories
 */
const MOODS = {
  HAPPY: 'happy',
  EXCITED: 'excited',
  NEUTRAL: 'neutral',
  CONFUSED: 'confused',
  FRUSTRATED: 'frustrated',
  ANGRY: 'angry',
  SAD: 'sad',
  URGENT: 'urgent',
  STRESSED: 'stressed'
};

/**
 * Urgency levels
 */
const URGENCY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Thai and English sentiment patterns
 */
const PATTERNS = {
  happy: {
    patterns: [
      /สุดยอด|เยี่ยม|ดีมาก|ขอบคุณ|เก่ง|ประทับใจ|พอใจ|ชอบ|รัก/gi,
      /great|awesome|perfect|thanks|love|excellent|amazing|wonderful/gi,
      /55+|haha|lol|😀|😊|🥰|❤️|👍|🎉/gi
    ],
    weight: 1.0
  },

  excited: {
    patterns: [
      /เร็ว|ลุย|ทำเลย|เดี๋ยวนี้|รีบ|ตื่นเต้น/gi,
      /quick|now|asap|let's go|excited|can't wait/gi,
      /!!+|🔥|🚀|⚡/gi
    ],
    weight: 1.0
  },

  frustrated: {
    patterns: [
      /ทำไม|ไม่เข้าใจ|ไม่ได้|ยังไง|อีกแล้ว|เหนื่อย|หงุดหงิด/gi,
      /why|again|still|not working|broken|confused|frustrated/gi,
      /😤|😠|🤦|💢/gi
    ],
    weight: 1.2 // Higher weight - need attention
  },

  angry: {
    patterns: [
      /โกรธ|เวร|บ้า|เซ็ง|กาก|ห่วย|แย่มาก/gi,
      /angry|terrible|awful|worst|hate|stupid|ridiculous/gi,
      /🤬|😡|💀/gi
    ],
    weight: 1.5 // Highest priority
  },

  sad: {
    patterns: [
      /เศร้า|เสียใจ|ผิดหวัง|ท้อ|หดหู่/gi,
      /sad|disappointed|sorry|down|depressed/gi,
      /😢|😭|💔|😔/gi
    ],
    weight: 1.0
  },

  confused: {
    patterns: [
      /งง|ไม่เข้าใจ|อะไร|ยังไง|หมายความว่า|แปลว่า/gi,
      /confused|what|how|don't understand|unclear|lost/gi,
      /🤔|❓|😕/gi
    ],
    weight: 0.9
  },

  urgent: {
    patterns: [
      /ด่วน|เร่ง|ทันที|ตอนนี้|ต้องการ|help/gi,
      /urgent|asap|emergency|immediately|now|critical/gi,
      /🆘|⚠️|🚨/gi
    ],
    weight: 1.5
  },

  stressed: {
    patterns: [
      /เครียด|กดดัน|ยุ่ง|ไม่มีเวลา|deadline/gi,
      /stressed|busy|overwhelmed|deadline|pressure/gi,
      /😵|🤯|😰/gi
    ],
    weight: 1.1
  }
};

/**
 * Response style recommendations
 */
const RESPONSE_STYLES = {
  [MOODS.HAPPY]: {
    tone: 'friendly',
    brevity: 'normal',
    emoji: 'allowed',
    tips: ['Match their positive energy', 'Keep momentum']
  },
  [MOODS.EXCITED]: {
    tone: 'energetic',
    brevity: 'short',
    emoji: 'allowed',
    tips: ['Be quick', 'Match enthusiasm', 'Action-oriented']
  },
  [MOODS.FRUSTRATED]: {
    tone: 'calm',
    brevity: 'concise',
    emoji: 'minimal',
    tips: ['Acknowledge frustration', 'Focus on solution', 'No fluff']
  },
  [MOODS.ANGRY]: {
    tone: 'professional',
    brevity: 'very_short',
    emoji: 'none',
    tips: ['Stay calm', 'Apologize once', 'Fix immediately', 'No excuses']
  },
  [MOODS.SAD]: {
    tone: 'empathetic',
    brevity: 'normal',
    emoji: 'supportive',
    tips: ['Show understanding', 'Be supportive', 'Offer help']
  },
  [MOODS.CONFUSED]: {
    tone: 'clear',
    brevity: 'detailed',
    emoji: 'none',
    tips: ['Be very clear', 'Step by step', 'Ask clarifying questions']
  },
  [MOODS.URGENT]: {
    tone: 'direct',
    brevity: 'very_short',
    emoji: 'none',
    tips: ['Act immediately', 'Skip pleasantries', 'Solution first']
  },
  [MOODS.STRESSED]: {
    tone: 'supportive',
    brevity: 'concise',
    emoji: 'minimal',
    tips: ['Be efficient', 'Reduce cognitive load', 'Handle complexity']
  },
  [MOODS.NEUTRAL]: {
    tone: 'professional',
    brevity: 'normal',
    emoji: 'minimal',
    tips: ['Standard response', 'Clear and helpful']
  }
};

/**
 * Sentiment Analyzer
 */
class SentimentAnalysis {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      trackHistory: config.trackHistory !== false,
      historyLength: config.historyLength || 20,
      ...config
    };

    // Track mood per user
    // userId -> [{ mood, timestamp, message }]
    this.history = new Map();

    // Stats
    this.stats = {
      analyzed: 0,
      moods: {}
    };
  }

  /**
   * Analyze message sentiment
   * @param {string} message - The message to analyze
   * @param {string} userId - Optional user ID for tracking
   * @returns {object} Sentiment analysis result
   */
  analyze(message, userId = 'default') {
    if (!this.config.enabled || !message) {
      return { mood: MOODS.NEUTRAL, confidence: 0, urgency: URGENCY.LOW };
    }

    this.stats.analyzed++;
    const scores = {};
    let totalScore = 0;

    // Check all patterns
    for (const [mood, config] of Object.entries(PATTERNS)) {
      let moodScore = 0;

      for (const pattern of config.patterns) {
        const matches = message.match(pattern);
        if (matches) {
          moodScore += matches.length * config.weight;
        }
      }

      scores[mood] = moodScore;
      totalScore += moodScore;
    }

    // Determine primary mood
    let primaryMood = MOODS.NEUTRAL;
    let highestScore = 0;

    for (const [mood, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        primaryMood = mood;
      }
    }

    // Calculate confidence (0-1)
    const confidence = totalScore > 0 ? Math.min(highestScore / (totalScore || 1), 1) : 0;

    // Determine urgency
    let urgency = URGENCY.LOW;
    if (scores.urgent > 0 || scores.angry > 0) {
      urgency = URGENCY.HIGH;
    } else if (scores.frustrated > 0 || scores.stressed > 0) {
      urgency = URGENCY.MEDIUM;
    }

    // Adjust for message length and punctuation
    if (message.includes('!!!') || message.toUpperCase() === message) {
      urgency = URGENCY.HIGH;
    }

    // Get response style
    const style = RESPONSE_STYLES[primaryMood] || RESPONSE_STYLES[MOODS.NEUTRAL];

    const result = {
      mood: primaryMood,
      confidence: Math.round(confidence * 100) / 100,
      urgency,
      scores,
      style,
      timestamp: new Date().toISOString()
    };

    // Track history
    if (this.config.trackHistory && userId) {
      this._trackHistory(userId, result, message);
    }

    // Update stats
    this.stats.moods[primaryMood] = (this.stats.moods[primaryMood] || 0) + 1;

    console.log(`[SENTIMENT] ${userId}: ${primaryMood} (${Math.round(confidence * 100)}%) urgency=${urgency}`);

    return result;
  }

  /**
   * Track mood history for a user
   */
  _trackHistory(userId, result, message) {
    if (!this.history.has(userId)) {
      this.history.set(userId, []);
    }

    const userHistory = this.history.get(userId);
    userHistory.unshift({
      mood: result.mood,
      confidence: result.confidence,
      urgency: result.urgency,
      timestamp: result.timestamp,
      preview: message.substring(0, 50)
    });

    // Limit history length
    if (userHistory.length > this.config.historyLength) {
      userHistory.length = this.config.historyLength;
    }
  }

  /**
   * Get current mood for a user (considers recent history)
   */
  getMood(userId) {
    const userHistory = this.history.get(userId);

    if (!userHistory || userHistory.length === 0) {
      return { mood: MOODS.NEUTRAL, trend: 'stable' };
    }

    // Get recent moods (last 5)
    const recent = userHistory.slice(0, 5);

    // Count moods
    const moodCounts = {};
    for (const entry of recent) {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
    }

    // Find dominant mood
    let dominantMood = MOODS.NEUTRAL;
    let maxCount = 0;
    for (const [mood, count] of Object.entries(moodCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    }

    // Determine trend
    let trend = 'stable';
    if (recent.length >= 2) {
      const negativeMoods = [MOODS.ANGRY, MOODS.FRUSTRATED, MOODS.SAD, MOODS.STRESSED];
      const positiveMoods = [MOODS.HAPPY, MOODS.EXCITED];

      const recentNegative = negativeMoods.includes(recent[0].mood);
      const previousNegative = negativeMoods.includes(recent[1].mood);
      const recentPositive = positiveMoods.includes(recent[0].mood);
      const previousPositive = positiveMoods.includes(recent[1].mood);

      if (recentNegative && !previousNegative) {
        trend = 'declining';
      } else if (recentPositive && !previousPositive) {
        trend = 'improving';
      }
    }

    return {
      mood: dominantMood,
      trend,
      recentHistory: recent.slice(0, 3)
    };
  }

  /**
   * Get response style recommendation
   */
  getResponseStyle(mood) {
    return RESPONSE_STYLES[mood] || RESPONSE_STYLES[MOODS.NEUTRAL];
  }

  /**
   * Get mood history for a user
   */
  getHistory(userId, limit = 10) {
    return (this.history.get(userId) || []).slice(0, limit);
  }

  /**
   * Check if user seems frustrated/angry
   */
  isUpset(userId) {
    const { mood } = this.getMood(userId);
    return [MOODS.ANGRY, MOODS.FRUSTRATED, MOODS.STRESSED].includes(mood);
  }

  /**
   * Check if urgent response needed
   */
  needsUrgentResponse(message) {
    const result = this.analyze(message);
    return result.urgency === URGENCY.HIGH || result.urgency === URGENCY.CRITICAL;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      trackedUsers: this.history.size,
      totalHistory: Array.from(this.history.values()).reduce((sum, h) => sum + h.length, 0)
    };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      trackHistory: this.config.trackHistory,
      stats: this.stats,
      trackedUsers: this.history.size
    };
  }

  /**
   * Clear history for a user
   */
  clearHistory(userId) {
    if (userId) {
      this.history.delete(userId);
    } else {
      this.history.clear();
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.history.clear();
    this.stats = {
      analyzed: 0,
      moods: {}
    };
  }
}

// Singleton instance
const sentimentAnalysis = new SentimentAnalysis();

export default sentimentAnalysis;
export { SentimentAnalysis, MOODS, URGENCY, RESPONSE_STYLES };
