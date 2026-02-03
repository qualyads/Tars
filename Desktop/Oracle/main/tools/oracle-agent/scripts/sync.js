#!/usr/bin/env node
/**
 * Oracle Agent - Terminal Sync Script
 * Syncs local memory with Railway-deployed Oracle Agent
 *
 * Usage:
 *   node scripts/sync.js status     - Check sync status
 *   node scripts/sync.js pull       - Pull from Railway
 *   node scripts/sync.js push       - Push to Railway
 *   node scripts/sync.js full       - Full bidirectional sync
 *   node scripts/sync.js focus "topic" - Set current focus
 *   node scripts/sync.js note "text"   - Add a note
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Railway URL - Update this after deployment
const RAILWAY_URL = process.env.ORACLE_AGENT_URL || 'https://oracle-agent-production.up.railway.app';
const LOCAL_MEMORY = path.join(__dirname, '..', 'memory.json');

/**
 * Make HTTP request to Railway
 */
function request(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, RAILWAY_URL);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Load local memory
 */
function loadLocalMemory() {
  try {
    if (fs.existsSync(LOCAL_MEMORY)) {
      return JSON.parse(fs.readFileSync(LOCAL_MEMORY, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading local memory:', e.message);
  }
  return null;
}

/**
 * Save local memory
 */
function saveLocalMemory(data) {
  fs.writeFileSync(LOCAL_MEMORY, JSON.stringify(data, null, 2));
}

/**
 * Commands
 */
const commands = {
  async status() {
    console.log('\n📡 Checking Oracle Agent status...\n');

    try {
      const status = await request('/api/sync/status');
      console.log('═══════════════════════════════════');
      console.log('  ORACLE AGENT SYNC STATUS');
      console.log('═══════════════════════════════════');
      console.log(`  Version:        ${status.version}`);
      console.log(`  Last Sync:      ${status.last_sync || 'Never'}`);
      console.log(`  Sync Source:    ${status.sync_source || 'N/A'}`);
      console.log(`  Pending:        ${status.pending_changes} changes`);
      console.log(`  Total Syncs:    ${status.stats?.sync_count || 0}`);
      console.log(`  Messages:       ${status.stats?.messages_handled || 0}`);
      console.log('═══════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Cannot connect to Railway:', error.message);
      console.log('   Make sure ORACLE_AGENT_URL is set correctly');
    }
  },

  async pull() {
    console.log('\n⬇️  Pulling from Railway...\n');

    try {
      const result = await request('/api/sync', 'POST', {
        action: 'get_status'
      });

      if (result.context) {
        const localMemory = loadLocalMemory() || {};
        localMemory.context = { ...localMemory.context, ...result.context };
        localMemory._meta = {
          ...localMemory._meta,
          last_sync: new Date().toISOString(),
          sync_source: 'railway'
        };
        saveLocalMemory(localMemory);
        console.log('✅ Pulled successfully');
        console.log(`   Last active: ${result.context.last_active}`);
        console.log(`   Pending approvals: ${result.pending_approvals?.length || 0}`);
      }
    } catch (error) {
      console.error('❌ Pull failed:', error.message);
    }
  },

  async push() {
    console.log('\n⬆️  Pushing to Railway...\n');

    try {
      const localMemory = loadLocalMemory();
      if (!localMemory) {
        console.log('⚠️  No local memory to push');
        return;
      }

      const result = await request('/api/sync', 'POST', {
        action: 'full_sync',
        data: localMemory,
        source: 'terminal'
      });

      if (result.success) {
        console.log('✅ Pushed successfully');
        console.log(`   Synced at: ${result.synced_at}`);
      }
    } catch (error) {
      console.error('❌ Push failed:', error.message);
    }
  },

  async full() {
    console.log('\n🔄 Full bidirectional sync...\n');

    try {
      const localMemory = loadLocalMemory() || {};

      const result = await request('/api/sync', 'POST', {
        action: 'full_sync',
        data: localMemory,
        source: 'terminal'
      });

      if (result.success && result.memory) {
        saveLocalMemory(result.memory);
        console.log('✅ Full sync completed');
        console.log(`   Synced at: ${result.synced_at}`);
      }
    } catch (error) {
      console.error('❌ Sync failed:', error.message);
    }
  },

  async focus(topic) {
    if (!topic) {
      console.log('Usage: sync.js focus "topic"');
      return;
    }

    console.log(`\n🎯 Setting focus: ${topic}\n`);

    try {
      const result = await request('/api/sync', 'POST', {
        action: 'set_focus',
        data: { focus: topic }
      });

      if (result.success) {
        console.log('✅ Focus set successfully');
      }
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
  },

  async note(text) {
    if (!text) {
      console.log('Usage: sync.js note "text"');
      return;
    }

    console.log(`\n📝 Adding note...\n`);

    try {
      const result = await request('/api/sync', 'POST', {
        action: 'add_note',
        data: { note: text }
      });

      if (result.success) {
        console.log('✅ Note added successfully');
      }
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
  },

  async hotel() {
    console.log('\n🏨 Getting hotel status...\n');

    try {
      const status = await request('/api/hotel/today');
      console.log('═══════════════════════════════════');
      console.log('  TODAY\'S HOTEL STATUS');
      console.log('═══════════════════════════════════');
      console.log(`  Date: ${status.date}`);
      console.log(`  Check-ins: ${JSON.stringify(status.check_ins, null, 2)}`);
      console.log(`  Check-outs: ${JSON.stringify(status.check_outs, null, 2)}`);
      console.log('═══════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
  }
};

// Main
const [,, command, ...args] = process.argv;

if (!command || !commands[command]) {
  console.log(`
╔═══════════════════════════════════════════════╗
║         ORACLE AGENT - TERMINAL SYNC          ║
╠═══════════════════════════════════════════════╣
║  Commands:                                    ║
║    status     Check sync status               ║
║    pull       Pull from Railway               ║
║    push       Push to Railway                 ║
║    full       Full bidirectional sync         ║
║    focus      Set current focus               ║
║    note       Add a note                      ║
║    hotel      Get today's hotel status        ║
╚═══════════════════════════════════════════════╝

  Example:
    node scripts/sync.js status
    node scripts/sync.js focus "Working on KeyForge"
    node scripts/sync.js note "Remember to check gold price"
`);
  process.exit(0);
}

commands[command](...args);
