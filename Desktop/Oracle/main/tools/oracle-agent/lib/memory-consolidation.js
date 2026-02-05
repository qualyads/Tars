/**
 * Memory Consolidation System
 *
 * รวมและสรุป memories เก่า ให้จำได้ดีขึ้น
 *
 * Features:
 * - Summarize old conversations
 * - Extract key learnings
 * - Merge similar memories
 * - Create knowledge graphs
 * - Forget unimportant details
 *
 * Inspired by how human memory works:
 * - Short-term → Long-term consolidation
 * - Pattern extraction
 * - Forgetting curve
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Memory types
 */
const MEMORY_TYPES = {
  CONVERSATION: 'conversation',  // Chat history
  LEARNING: 'learning',          // Things learned
  PATTERN: 'pattern',            // Repeated patterns
  FACT: 'fact',                  // Specific facts
  PREFERENCE: 'preference',      // User preferences
  DECISION: 'decision',          // Decisions made
  MISTAKE: 'mistake'             // Mistakes to avoid
};

/**
 * Importance levels
 */
const IMPORTANCE = {
  TRIVIAL: 1,
  LOW: 2,
  NORMAL: 3,
  HIGH: 4,
  CRITICAL: 5
};

/**
 * Memory Consolidation System
 */
class MemoryConsolidation {
  constructor(config = {}) {
    this.config = {
      storagePath: config.storagePath || path.join(__dirname, '..', 'data', 'consolidated-memory.json'),
      shortTermPath: config.shortTermPath || path.join(__dirname, '..', 'data', 'short-term-memory.json'),
      consolidationThreshold: config.consolidationThreshold || 24 * 60 * 60 * 1000, // 24 hours
      maxShortTermItems: config.maxShortTermItems || 100,
      maxLongTermItems: config.maxLongTermItems || 1000,
      ...config
    };

    // Short-term memory (recent, detailed)
    this.shortTerm = [];

    // Long-term memory (consolidated, summarized)
    this.longTerm = {
      learnings: [],
      patterns: [],
      facts: [],
      preferences: [],
      decisions: [],
      mistakes: []
    };

    // Knowledge graph (relationships)
    this.knowledgeGraph = {
      entities: {},  // name -> { type, mentions, lastSeen, importance }
      relations: []  // { from, to, type, weight }
    };

    // Stats
    this.stats = {
      shortTermCount: 0,
      longTermCount: 0,
      consolidations: 0,
      lastConsolidation: null
    };

    // Load from storage
    this._loadFromStorage();
  }

  /**
   * Add to short-term memory
   */
  addShortTerm(item) {
    const {
      type = MEMORY_TYPES.CONVERSATION,
      content,
      context = {},
      importance = IMPORTANCE.NORMAL,
      entities = [],
      tags = []
    } = item;

    const memory = {
      id: `stm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      content,
      context,
      importance,
      entities,
      tags,
      timestamp: Date.now(),
      consolidated: false
    };

    this.shortTerm.unshift(memory);
    this.stats.shortTermCount++;

    // Extract entities for knowledge graph
    this._extractEntities(memory);

    // Trim if too many
    if (this.shortTerm.length > this.config.maxShortTermItems) {
      // Consolidate old items before removing
      this._consolidateOldItems();
    }

    this._saveShortTerm();

    return memory;
  }

  /**
   * Add learning directly to long-term
   */
  addLearning(learning) {
    const {
      topic,
      insight,
      source = 'conversation',
      importance = IMPORTANCE.NORMAL,
      tags = []
    } = learning;

    const entry = {
      id: `ltm_${Date.now()}`,
      topic,
      insight,
      source,
      importance,
      tags,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: null
    };

    // Check for duplicate/similar
    const existing = this.longTerm.learnings.find(l =>
      l.topic === topic && this._similarity(l.insight, insight) > 0.8
    );

    if (existing) {
      // Merge: increase importance, update insight if newer is better
      existing.importance = Math.max(existing.importance, importance);
      existing.accessCount++;
      existing.lastAccessed = Date.now();
      console.log(`[MEMORY] Merged learning: ${topic}`);
    } else {
      this.longTerm.learnings.unshift(entry);
      this.stats.longTermCount++;
      console.log(`[MEMORY] Added learning: ${topic}`);
    }

    this._saveLongTerm();

    return entry;
  }

  /**
   * Add pattern
   */
  addPattern(pattern) {
    const {
      name,
      description,
      occurrences = 1,
      examples = [],
      tags = []
    } = pattern;

    const existing = this.longTerm.patterns.find(p => p.name === name);

    if (existing) {
      existing.occurrences += occurrences;
      existing.examples.push(...examples);
      existing.examples = existing.examples.slice(-10); // Keep last 10
      existing.lastSeen = Date.now();
    } else {
      this.longTerm.patterns.push({
        id: `pat_${Date.now()}`,
        name,
        description,
        occurrences,
        examples,
        tags,
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }

    this._saveLongTerm();
  }

  /**
   * Add preference
   */
  addPreference(preference) {
    const { key, value, confidence = 0.8, source = 'inferred' } = preference;

    const existing = this.longTerm.preferences.find(p => p.key === key);

    if (existing) {
      // Update if confidence is higher
      if (confidence > existing.confidence) {
        existing.value = value;
        existing.confidence = confidence;
        existing.source = source;
        existing.updatedAt = Date.now();
      }
    } else {
      this.longTerm.preferences.push({
        id: `pref_${Date.now()}`,
        key,
        value,
        confidence,
        source,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    this._saveLongTerm();
  }

  /**
   * Add fact
   */
  addFact(fact) {
    const { subject, predicate, object, confidence = 1.0, source = 'stated' } = fact;

    const key = `${subject}:${predicate}`;
    const existing = this.longTerm.facts.find(f =>
      f.subject === subject && f.predicate === predicate
    );

    if (existing) {
      // Update
      existing.object = object;
      existing.confidence = confidence;
      existing.updatedAt = Date.now();
    } else {
      this.longTerm.facts.push({
        id: `fact_${Date.now()}`,
        subject,
        predicate,
        object,
        confidence,
        source,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    // Also add to knowledge graph
    this._addRelation(subject, object, predicate);

    this._saveLongTerm();
  }

  /**
   * Consolidate old short-term memories
   * @param {object} options - { force: boolean } - force consolidate all items regardless of age
   */
  async consolidate(options = {}) {
    console.log('[MEMORY] Starting consolidation...');

    const now = Date.now();
    const threshold = now - this.config.consolidationThreshold;

    // Get items to consolidate
    let toConsolidate;
    if (options.force) {
      // Force: consolidate all unconsolidated items
      toConsolidate = this.shortTerm.filter(m => !m.consolidated);
      console.log(`[MEMORY] Force mode: ${toConsolidate.length} items`);
    } else {
      // Normal: only old items
      toConsolidate = this.shortTerm.filter(m =>
        !m.consolidated && m.timestamp < threshold
      );
    }

    if (toConsolidate.length === 0) {
      console.log('[MEMORY] Nothing to consolidate');
      return { consolidated: 0, summaries: 0 };
    }

    // Group by type
    const grouped = {};
    for (const memory of toConsolidate) {
      if (!grouped[memory.type]) {
        grouped[memory.type] = [];
      }
      grouped[memory.type].push(memory);
    }

    // Consolidate each type
    const summaries = [];

    for (const [type, memories] of Object.entries(grouped)) {
      const summary = this._summarizeMemories(type, memories);
      if (summary) {
        summaries.push(summary);

        // Mark as consolidated
        for (const m of memories) {
          m.consolidated = true;
        }
      }
    }

    // Store summaries as learnings
    for (const summary of summaries) {
      this.addLearning({
        topic: `${summary.type} summary`,
        insight: summary.summary,
        source: 'consolidation',
        importance: summary.avgImportance,
        tags: summary.tags
      });
    }

    // Remove very old consolidated items from short-term
    const veryOldThreshold = now - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.shortTerm = this.shortTerm.filter(m =>
      m.timestamp > veryOldThreshold || !m.consolidated
    );

    this.stats.consolidations++;
    this.stats.lastConsolidation = now;

    this._saveShortTerm();
    this._saveLongTerm();

    console.log(`[MEMORY] Consolidated ${toConsolidate.length} items into ${summaries.length} summaries`);

    return {
      consolidated: toConsolidate.length,
      summaries: summaries.length
    };
  }

  /**
   * Summarize a group of memories
   */
  _summarizeMemories(type, memories) {
    if (memories.length === 0) return null;

    // Extract key information
    const contents = memories.map(m => m.content);
    const allTags = [...new Set(memories.flatMap(m => m.tags))];
    const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;

    // Simple summary (in production, use AI for better summarization)
    let summary;
    if (memories.length === 1) {
      summary = contents[0];
    } else {
      // For now, just take highlights
      const important = memories
        .filter(m => m.importance >= IMPORTANCE.HIGH)
        .map(m => m.content);

      if (important.length > 0) {
        summary = `Key points (${memories.length} items): ${important.slice(0, 3).join('; ')}`;
      } else {
        summary = `${memories.length} ${type} items from ${new Date(memories[memories.length - 1].timestamp).toLocaleDateString()} to ${new Date(memories[0].timestamp).toLocaleDateString()}`;
      }
    }

    return {
      type,
      summary,
      itemCount: memories.length,
      avgImportance: Math.round(avgImportance),
      tags: allTags,
      timeRange: {
        from: memories[memories.length - 1].timestamp,
        to: memories[0].timestamp
      }
    };
  }

  /**
   * Extract entities from memory
   */
  _extractEntities(memory) {
    for (const entity of memory.entities) {
      const name = entity.name || entity;
      const type = entity.type || 'unknown';

      if (!this.knowledgeGraph.entities[name]) {
        this.knowledgeGraph.entities[name] = {
          type,
          mentions: 0,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          importance: IMPORTANCE.NORMAL
        };
      }

      const e = this.knowledgeGraph.entities[name];
      e.mentions++;
      e.lastSeen = Date.now();

      // Increase importance with mentions
      if (e.mentions > 10) e.importance = IMPORTANCE.HIGH;
      if (e.mentions > 50) e.importance = IMPORTANCE.CRITICAL;
    }
  }

  /**
   * Add relation to knowledge graph
   */
  _addRelation(from, to, type) {
    const existing = this.knowledgeGraph.relations.find(r =>
      r.from === from && r.to === to && r.type === type
    );

    if (existing) {
      existing.weight++;
      existing.lastSeen = Date.now();
    } else {
      this.knowledgeGraph.relations.push({
        from,
        to,
        type,
        weight: 1,
        createdAt: Date.now(),
        lastSeen: Date.now()
      });
    }
  }

  /**
   * Query long-term memory
   */
  query(options = {}) {
    const { type, tags, minImportance, search, limit = 10 } = options;

    let results = [];

    // Search all types if not specified
    const types = type ? [type] : Object.keys(this.longTerm);

    for (const t of types) {
      const items = this.longTerm[t] || [];
      results.push(...items.map(item => ({ ...item, memoryType: t })));
    }

    // Filter
    if (tags && tags.length > 0) {
      results = results.filter(r =>
        r.tags?.some(t => tags.includes(t))
      );
    }

    if (minImportance) {
      results = results.filter(r => (r.importance || IMPORTANCE.NORMAL) >= minImportance);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(r => {
        const content = JSON.stringify(r).toLowerCase();
        return content.includes(searchLower);
      });
    }

    // Sort by recency/importance
    results.sort((a, b) => {
      const importanceDiff = (b.importance || 0) - (a.importance || 0);
      if (importanceDiff !== 0) return importanceDiff;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    return results.slice(0, limit);
  }

  /**
   * Get related entities
   */
  getRelated(entity) {
    const relations = this.knowledgeGraph.relations.filter(r =>
      r.from === entity || r.to === entity
    );

    return relations.map(r => ({
      entity: r.from === entity ? r.to : r.from,
      relation: r.type,
      direction: r.from === entity ? 'outgoing' : 'incoming',
      weight: r.weight
    })).sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get preferences
   */
  getPreferences() {
    return this.longTerm.preferences;
  }

  /**
   * Get preference value
   */
  getPreference(key, defaultValue = null) {
    const pref = this.longTerm.preferences.find(p => p.key === key);
    return pref ? pref.value : defaultValue;
  }

  /**
   * Simple string similarity (Jaccard)
   */
  _similarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  /**
   * Consolidate old items
   */
  _consolidateOldItems() {
    const threshold = Date.now() - this.config.consolidationThreshold;
    const old = this.shortTerm.filter(m => m.timestamp < threshold && !m.consolidated);

    if (old.length > 20) {
      this.consolidate();
    }
  }

  /**
   * Get context for AI
   */
  getContextForAI(topic = null) {
    const context = {
      recentLearnings: this.longTerm.learnings.slice(0, 10),
      preferences: this.longTerm.preferences,
      recentPatterns: this.longTerm.patterns.slice(0, 5),
      recentMistakes: this.longTerm.mistakes?.slice(0, 5) || []
    };

    if (topic) {
      // Add topic-specific memories
      context.relevant = this.query({ search: topic, limit: 5 });
    }

    return context;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      shortTermCount: this.shortTerm.length,
      longTermCount: Object.values(this.longTerm).reduce((sum, arr) => sum + arr.length, 0),
      entitiesCount: Object.keys(this.knowledgeGraph.entities).length,
      relationsCount: this.knowledgeGraph.relations.length
    };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      shortTerm: this.shortTerm.length,
      longTerm: {
        learnings: this.longTerm.learnings.length,
        patterns: this.longTerm.patterns.length,
        facts: this.longTerm.facts.length,
        preferences: this.longTerm.preferences.length
      },
      knowledgeGraph: {
        entities: Object.keys(this.knowledgeGraph.entities).length,
        relations: this.knowledgeGraph.relations.length
      },
      stats: this.stats
    };
  }

  /**
   * Load from storage
   */
  _loadFromStorage() {
    try {
      // Short term
      if (fs.existsSync(this.config.shortTermPath)) {
        const data = JSON.parse(fs.readFileSync(this.config.shortTermPath, 'utf8'));
        this.shortTerm = data.items || [];
      }

      // Long term
      if (fs.existsSync(this.config.storagePath)) {
        const data = JSON.parse(fs.readFileSync(this.config.storagePath, 'utf8'));
        this.longTerm = data.longTerm || this.longTerm;
        this.knowledgeGraph = data.knowledgeGraph || this.knowledgeGraph;
        this.stats = data.stats || this.stats;
      }

      // Load seed data if no long-term memory exists
      const seedPath = path.join(__dirname, '..', 'data', 'seed-memory.json');
      if (this.getStats().longTermCount === 0 && fs.existsSync(seedPath)) {
        console.log('[MEMORY] Loading seed data...');
        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

        // Add seed learnings
        if (seedData.learnings) {
          for (const learning of seedData.learnings) {
            this.addLearning(learning);
          }
        }

        // Add seed facts
        if (seedData.facts) {
          for (const fact of seedData.facts) {
            this.addFact(fact);
          }
        }

        // Add seed preferences
        if (seedData.preferences) {
          for (const pref of seedData.preferences) {
            this.addPreference(pref);
          }
        }

        console.log(`[MEMORY] Seed data loaded: ${seedData.learnings?.length || 0} learnings, ${seedData.facts?.length || 0} facts, ${seedData.preferences?.length || 0} prefs`);
      }

      console.log(`[MEMORY] Loaded: ${this.shortTerm.length} short-term, ${this.getStats().longTermCount} long-term`);
    } catch (err) {
      console.error('[MEMORY] Failed to load:', err.message);
    }
  }

  /**
   * Save short-term
   */
  _saveShortTerm() {
    try {
      const dir = path.dirname(this.config.shortTermPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.config.shortTermPath, JSON.stringify({
        items: this.shortTerm,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('[MEMORY] Failed to save short-term:', err.message);
    }
  }

  /**
   * Save long-term
   */
  _saveLongTerm() {
    try {
      const dir = path.dirname(this.config.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.config.storagePath, JSON.stringify({
        longTerm: this.longTerm,
        knowledgeGraph: this.knowledgeGraph,
        stats: this.stats,
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('[MEMORY] Failed to save long-term:', err.message);
    }
  }

  /**
   * Clear all
   */
  clear() {
    this.shortTerm = [];
    this.longTerm = {
      learnings: [],
      patterns: [],
      facts: [],
      preferences: [],
      decisions: [],
      mistakes: []
    };
    this.knowledgeGraph = { entities: {}, relations: [] };
    this.stats = {
      shortTermCount: 0,
      longTermCount: 0,
      consolidations: 0,
      lastConsolidation: null
    };
    this._saveShortTerm();
    this._saveLongTerm();
  }
}

// Singleton instance
const memoryConsolidation = new MemoryConsolidation();

export default memoryConsolidation;
export { MemoryConsolidation, MEMORY_TYPES, IMPORTANCE };
