#!/usr/bin/env node
/**
 * Memory Sync Script
 *
 * Usage:
 *   node scripts/memory-sync.js sync     - Sync all files
 *   node scripts/memory-sync.js search "query"  - Search memory
 *   node scripts/memory-sync.js status   - Show status
 */

import dotenv from 'dotenv';
dotenv.config();

import memory from '../lib/memory-db.js';

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  switch (command) {
    case 'sync':
      console.log('Starting memory sync...\n');
      const result = await memory.syncAll();
      console.log('\nSync complete:', result);
      break;

    case 'search':
      if (!arg) {
        console.log('Usage: node scripts/memory-sync.js search "your query"');
        process.exit(1);
      }
      console.log(`Searching for: "${arg}"\n`);
      const results = await memory.search(arg);

      if (results.length === 0) {
        console.log('No results found.');
      } else {
        console.log(`Found ${results.length} results:\n`);
        for (const r of results) {
          console.log(`--- ${r.citation} (score: ${r.score.toFixed(3)}) ---`);
          console.log(r.snippet);
          console.log('');
        }
      }
      break;

    case 'status':
      const status = memory.getStatus();
      console.log('Memory System Status:');
      console.log('---------------------');
      console.log(`Database: ${status.dbPath}`);
      console.log(`Total chunks: ${status.totalChunks}`);
      console.log(`With embeddings: ${status.withEmbeddings}`);
      console.log(`Cache size: ${status.cacheSize}`);
      console.log(`Vector search: ${status.vectorEnabled ? 'enabled' : 'disabled (no OPENAI_API_KEY)'}`);
      console.log(`Sources:`, status.sources);
      break;

    default:
      console.log('Oracle Memory System');
      console.log('====================\n');
      console.log('Commands:');
      console.log('  sync              - Sync all memory files to database');
      console.log('  search "query"    - Search memory');
      console.log('  status            - Show system status');
      console.log('\nExample:');
      console.log('  node scripts/memory-sync.js sync');
      console.log('  node scripts/memory-sync.js search "TM30 cloudflare"');
      console.log('\nNote: Set OPENAI_API_KEY in .env for vector search');
  }
}

main().catch(console.error);
