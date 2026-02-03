/**
 * Heartbeat System
 * Handles scheduled/proactive tasks
 */

const https = require('https');
const config = require('../config.json');
const claude = require('./claude');
const line = require('./line');
const memory = require('./memory');

/**
 * Fetch market data (Gold, BTC, Fear & Greed)
 */
async function fetchMarketData() {
  const data = {
    gold: null,
    btc: null,
    fearGreed: null
  };

  try {
    // Fear & Greed Index
    const fgResponse = await fetchJSON('https://api.alternative.me/fng/?limit=1');
    if (fgResponse?.data?.[0]) {
      data.fearGreed = {
        value: fgResponse.data[0].value,
        text: fgResponse.data[0].value_classification
      };
    }
  } catch (e) {
    console.error('[HEARTBEAT] Failed to fetch Fear & Greed:', e.message);
  }

  try {
    // BTC Price from CoinGecko
    const btcResponse = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    if (btcResponse?.bitcoin) {
      data.btc = {
        price: btcResponse.bitcoin.usd,
        change: btcResponse.bitcoin.usd_24h_change?.toFixed(2)
      };
    }
  } catch (e) {
    console.error('[HEARTBEAT] Failed to fetch BTC:', e.message);
  }

  try {
    // Gold Price (approximate from free API)
    const goldResponse = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd&include_24hr_change=true');
    if (goldResponse?.['tether-gold']) {
      data.gold = {
        price: goldResponse['tether-gold'].usd,
        change: goldResponse['tether-gold'].usd_24h_change?.toFixed(2)
      };
    }
  } catch (e) {
    console.error('[HEARTBEAT] Failed to fetch Gold:', e.message);
  }

  return data;
}

/**
 * Morning Briefing - 07:00
 */
async function morningBriefing() {
  console.log('[HEARTBEAT] Generating morning briefing...');

  try {
    // Fetch market data
    const marketData = await fetchMarketData();

    // Get memory context
    const context = await memory.getContextForClaude();
    const recentConvos = await memory.getRecentConversations();

    // Build briefing data
    const briefingData = {
      date: new Date().toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      market: marketData,
      business: {
        properties: config.business.properties,
        pending_approvals: await memory.getPendingApprovals()
      },
      recent_activity: {
        conversations: recentConvos.length,
        last_contacts: recentConvos.slice(0, 3)
      }
    };

    // Generate briefing with Claude
    const briefing = await claude.generateReport('morning', briefingData);

    // Send to owner
    await line.notifyOwner(briefing);

    // Update stats
    await memory.updateStats('briefings_sent', 1);

    console.log('[HEARTBEAT] Morning briefing sent');
    return briefing;
  } catch (error) {
    console.error('[HEARTBEAT] Morning briefing failed:', error);

    // Send error notification
    await line.notifyOwner(`⚠️ Oracle Agent: Morning briefing failed\nError: ${error.message}`);
  }
}

/**
 * Evening Summary - 18:00
 */
async function eveningSummary() {
  console.log('[HEARTBEAT] Generating evening summary...');

  try {
    const mem = await memory.getAll();

    const summaryData = {
      date: new Date().toLocaleDateString('th-TH'),
      stats: mem.stats,
      conversations_today: Object.entries(mem.conversations)
        .filter(([_, conv]) => {
          const today = new Date().toDateString();
          return new Date(conv.last_message).toDateString() === today;
        })
        .map(([userId, conv]) => ({
          userId: userId.substring(0, 10) + '...',
          messages: conv.messages.slice(-4)
        })),
      pending_approvals: await memory.getPendingApprovals()
    };

    const summary = await claude.generateReport('evening', summaryData);

    await line.notifyOwner(summary);

    console.log('[HEARTBEAT] Evening summary sent');
    return summary;
  } catch (error) {
    console.error('[HEARTBEAT] Evening summary failed:', error);
  }
}

/**
 * Weekly Rank Report - Monday 09:00
 */
async function rankReport() {
  console.log('[HEARTBEAT] Generating rank report...');

  try {
    const rankings = [];

    for (const property of config.business.properties) {
      // Find place_id from rank-tracker config if available
      const trackerConfigPath = require('path').join(__dirname, '../../rank-tracker/config.json');
      let placeId = null;

      try {
        const trackerConfig = require(trackerConfigPath);
        const prop = trackerConfig.properties.find(p => p.name === property.name);
        if (prop) placeId = prop.place_id;
      } catch (e) {}

      if (placeId) {
        // Call rank tracker API
        const keywords = ['hotel pai', 'boutique hotel pai', 'where to stay pai'];
        const results = [];

        for (const keyword of keywords.slice(0, 3)) {
          try {
            const result = await fetchRanking(placeId, keyword);
            results.push({ keyword, ...result });
          } catch (e) {
            results.push({ keyword, error: e.message });
          }
          await sleep(500); // Rate limit
        }

        rankings.push({
          name: property.name,
          type: property.type,
          rankings: results
        });
      }
    }

    const reportData = {
      date: new Date().toLocaleDateString('th-TH'),
      properties: rankings
    };

    const report = await claude.generateReport('weekly', reportData);

    await line.notifyOwner(report);

    console.log('[HEARTBEAT] Rank report sent');
    return report;
  } catch (error) {
    console.error('[HEARTBEAT] Rank report failed:', error);
    await line.notifyOwner(`⚠️ Oracle Agent: Rank report failed\nError: ${error.message}`);
  }
}

/**
 * Fetch ranking from RapidAPI
 */
async function fetchRanking(placeId, keyword) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${config.apis.rank_tracker_host}/ranking-at-coordinate`);
    url.searchParams.append('query', keyword);
    url.searchParams.append('place_id', placeId);
    url.searchParams.append('lat', '19.3592');
    url.searchParams.append('lng', '98.4400');

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'x-rapidapi-host': config.apis.rank_tracker_host,
        'x-rapidapi-key': config.apis.rapidapi_key
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK') {
            resolve({
              found: result.data.found,
              rank: result.data.rank,
              total: result.data.count
            });
          } else {
            reject(new Error(result.message || 'Unknown error'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Helper: Fetch JSON from URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Helper: Sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  morningBriefing,
  eveningSummary,
  rankReport,
  fetchMarketData
};
