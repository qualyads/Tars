# OpenClaw Memory System - Deep Analysis

> เป้าหมาย: เข้าใจ Memory System เพื่อ implement ใน Oracle
> Status: ✅ Core understanding complete

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MemoryIndexManager                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Memory    │    │  Sessions   │    │   Extra     │    │
│  │   Files     │    │ Transcripts │    │   Paths     │    │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Chunking (Markdown)                    │  │
│  │   - chunk_tokens: 400                               │  │
│  │   - chunk_overlap: 80                               │  │
│  └────────────────────────┬────────────────────────────┘  │
│                           ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           Embedding Provider                        │  │
│  │   - OpenAI (text-embedding-3-small)                │  │
│  │   - Gemini (gemini-embedding-001)                  │  │
│  │   - Local (node-llama)                             │  │
│  └────────────────────────┬────────────────────────────┘  │
│                           ▼                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            SQLite Database                          │  │
│  │   - chunks_vec (vector table with sqlite-vec)      │  │
│  │   - chunks_fts (FTS5 full-text search)            │  │
│  │   - embedding_cache                                │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

## 2. Configuration

```typescript
type ResolvedMemorySearchConfig = {
  enabled: boolean;
  sources: Array<"memory" | "sessions">;
  extraPaths: string[];

  // Embedding provider
  provider: "openai" | "local" | "gemini" | "auto";
  fallback: "openai" | "gemini" | "local" | "none";
  model: string;

  // Storage
  store: {
    driver: "sqlite";
    path: string;
    vector: { enabled: boolean; extensionPath?: string };
  };

  // Chunking
  chunking: {
    tokens: number;    // default 400
    overlap: number;   // default 80
  };

  // Search
  query: {
    maxResults: number;    // default 6
    minScore: number;      // default 0.35
    hybrid: {
      enabled: boolean;
      vectorWeight: number;  // default 0.7
      textWeight: number;    // default 0.3
      candidateMultiplier: number;  // default 4
    };
  };

  // Sync
  sync: {
    onSessionStart: boolean;
    onSearch: boolean;
    watch: boolean;
    watchDebounceMs: number;
    intervalMinutes: number;
  };
};
```

## 3. Hybrid Search Algorithm

```
Final Score = (vectorWeight × vectorScore) + (textWeight × textScore)
            = (0.7 × semantic_similarity) + (0.3 × keyword_match)
```

### Vector Search
- Uses embeddings (OpenAI/Gemini/local)
- Cosine similarity
- Semantic understanding

### Keyword Search (FTS5)
```sql
SELECT * FROM chunks_fts
WHERE chunks_fts MATCH '"token1" AND "token2" AND "token3"'
ORDER BY bm25(chunks_fts)
```

### Merge Results
```typescript
function mergeHybridResults(vector, keyword, weights) {
  const byId = new Map();

  // Add vector results
  for (const r of vector) {
    byId.set(r.id, { ...r, vectorScore: r.score, textScore: 0 });
  }

  // Add/merge keyword results
  for (const r of keyword) {
    if (byId.has(r.id)) {
      byId.get(r.id).textScore = r.score;
    } else {
      byId.set(r.id, { ...r, vectorScore: 0, textScore: r.score });
    }
  }

  // Calculate final scores
  return Array.from(byId.values())
    .map(e => ({
      ...e,
      score: weights.vector * e.vectorScore + weights.text * e.textScore
    }))
    .sort((a, b) => b.score - a.score);
}
```

## 4. Key Components

### MemoryIndexManager
```typescript
class MemoryIndexManager implements MemorySearchManager {
  // Database
  private db: DatabaseSync;

  // Providers
  private provider: EmbeddingProvider;
  private openAi?: OpenAiEmbeddingClient;
  private gemini?: GeminiEmbeddingClient;

  // State
  private dirty = false;
  private syncing: Promise<void> | null = null;
  private watcher: FSWatcher | null = null;

  // Methods
  async search(query, opts): Promise<MemorySearchResult[]>;
  async sync(params): Promise<void>;
  status(): MemoryProviderStatus;
}
```

### MemorySearchResult
```typescript
type MemorySearchResult = {
  path: string;       // File path
  startLine: number;  // Chunk start line
  endLine: number;    // Chunk end line
  score: number;      // Hybrid score
  snippet: string;    // Text snippet
  source: "memory" | "sessions";
  citation?: string;
};
```

## 5. Implementation for Oracle

### Step 1: Install dependencies
```bash
npm install better-sqlite3
npm install @anthropic-ai/sdk  # For embeddings via Claude
```

### Step 2: Create memory database
```javascript
// oracle-agent/lib/memory-db.js
import Database from 'better-sqlite3';

class OracleMemory {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.ensureSchema();
  }

  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        path TEXT,
        start_line INTEGER,
        end_line INTEGER,
        content TEXT,
        embedding BLOB,
        source TEXT,
        created_at INTEGER
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
      USING fts5(content, content='chunks', content_rowid='rowid');

      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
    `);
  }

  async addChunk(chunk) {
    const embedding = await this.getEmbedding(chunk.content);
    this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, path, start_line, end_line, content, embedding, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      chunk.id,
      chunk.path,
      chunk.startLine,
      chunk.endLine,
      chunk.content,
      embedding,
      chunk.source,
      Date.now()
    );
  }

  async search(query, maxResults = 6) {
    // Keyword search
    const keywordResults = this.db.prepare(`
      SELECT id, path, start_line, end_line, content, bm25(chunks_fts) as score
      FROM chunks_fts
      WHERE chunks_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `).all(this.buildFtsQuery(query), maxResults * 4);

    // TODO: Vector search (requires embedding API)

    return keywordResults.map(r => ({
      path: r.path,
      startLine: r.start_line,
      endLine: r.end_line,
      snippet: r.content.slice(0, 500),
      score: 1 / (1 + Math.abs(r.score))
    }));
  }

  buildFtsQuery(raw) {
    const tokens = raw.match(/[A-Za-z0-9_]+/g) || [];
    return tokens.map(t => `"${t}"`).join(' AND ');
  }
}
```

### Step 3: Integrate with Oracle
```javascript
// In oracle-agent/lib/autonomy.js
const memory = new OracleMemory('/path/to/oracle-memory.db');

// When processing message
async function getRelevantContext(message) {
  const results = await memory.search(message, 5);
  return results.map(r => r.snippet).join('\n\n---\n\n');
}
```

## 6. Costs & Trade-offs

| Approach | Pros | Cons |
|----------|------|------|
| OpenAI Embeddings | High quality | $0.00002/1K tokens |
| Gemini Embeddings | Free tier available | Less accurate? |
| Local (node-llama) | Free, private | Slower, setup required |
| FTS5 Only | Free, fast | No semantic understanding |

**Recommendation for Oracle:**
1. Start with FTS5 only (free, fast)
2. Add OpenAI embeddings later for semantic search
3. Use hybrid search for best results

## 7. Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/memory/manager.ts` | Main memory manager | 1,500+ |
| `src/memory/hybrid.ts` | Hybrid search merge | 116 |
| `src/memory/types.ts` | Type definitions | 81 |
| `src/memory/embeddings.ts` | Embedding providers | ~200 |
| `src/memory/internal.ts` | Chunking, file ops | ~200 |

---
*Analyzed: 2026-02-03*
