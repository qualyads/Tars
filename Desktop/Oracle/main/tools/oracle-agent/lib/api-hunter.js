/**
 * API Hunter - Oracle หา API, ทดสอบ, วิเคราะห์โอกาส
 *
 * Features:
 * - Web research จริง (fetch websites)
 * - API discovery จาก multiple sources
 * - API testing (actually call endpoints)
 * - Opportunity analysis
 *
 * @version 1.0.0
 */

import claude from './claude.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Data storage
  dataFile: path.join(__dirname, '../data/api-discoveries.json'),

  // API Sources to explore
  sources: {
    publicApis: 'https://api.publicapis.org/entries',
    rapidApi: 'https://rapidapi.com/categories',
    githubTrending: 'https://api.github.com/search/repositories?q=api+created:>2024-01-01&sort=stars&order=desc',
  },

  // Categories to focus on
  focusCategories: [
    'finance',
    'cryptocurrency',
    'travel',
    'booking',
    'weather',
    'ai',
    'automation',
    'data',
    'social',
    'ecommerce'
  ],

  // Max APIs to discover per cycle
  maxApisPerCycle: 10,

  // Timeout for API calls
  timeout: 10000,

  // User agent for requests
  userAgent: 'Oracle-API-Hunter/1.0 (Research Bot)'
};

// =============================================================================
// DATA STORAGE
// =============================================================================

function loadDiscoveries() {
  try {
    if (fs.existsSync(CONFIG.dataFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
    }
  } catch (e) {
    console.error('[API-HUNTER] Error loading discoveries:', e.message);
  }
  return {
    apis: [],
    tested: [],
    opportunities: [],
    lastHunt: null,
    stats: { totalDiscovered: 0, totalTested: 0, totalOpportunities: 0 }
  };
}

function saveDiscoveries(data) {
  try {
    const dir = path.dirname(CONFIG.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[API-HUNTER] Error saving discoveries:', e.message);
  }
}

// =============================================================================
// WEB FETCHER - ดึงข้อมูลจากเว็บจริง
// =============================================================================

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/json',
        ...options.headers
      }
    });
    clearTimeout(timeout);
    return response;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function fetchJson(url) {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (e) {
    console.error(`[API-HUNTER] Fetch error for ${url}:`, e.message);
    return null;
  }
}

async function fetchHtml(url) {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { 'Accept': 'text/html' }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (e) {
    console.error(`[API-HUNTER] Fetch error for ${url}:`, e.message);
    return null;
  }
}

// =============================================================================
// API DISCOVERY - หา API จากหลายแหล่ง
// =============================================================================

/**
 * Discover APIs from Public APIs directory
 */
async function discoverFromPublicApis() {
  console.log('[API-HUNTER] Discovering from Public APIs...');

  const apis = [];

  try {
    // Get random APIs
    const data = await fetchJson('https://api.publicapis.org/random?count=20');

    if (data && data.entries) {
      for (const entry of data.entries) {
        apis.push({
          source: 'publicapis',
          name: entry.API,
          description: entry.Description,
          category: entry.Category,
          url: entry.Link,
          auth: entry.Auth || 'none',
          https: entry.HTTPS,
          cors: entry.Cors,
          discoveredAt: new Date().toISOString()
        });
      }
    }
  } catch (e) {
    console.error('[API-HUNTER] Public APIs error:', e.message);
  }

  // Also get by category
  for (const category of CONFIG.focusCategories.slice(0, 3)) {
    try {
      const catData = await fetchJson(`https://api.publicapis.org/entries?category=${category}`);
      if (catData && catData.entries) {
        for (const entry of catData.entries.slice(0, 5)) {
          if (!apis.find(a => a.name === entry.API)) {
            apis.push({
              source: 'publicapis',
              name: entry.API,
              description: entry.Description,
              category: entry.Category,
              url: entry.Link,
              auth: entry.Auth || 'none',
              https: entry.HTTPS,
              cors: entry.Cors,
              discoveredAt: new Date().toISOString()
            });
          }
        }
      }
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } catch (e) {
      // Continue with next category
    }
  }

  console.log(`[API-HUNTER] Found ${apis.length} APIs from Public APIs`);
  return apis;
}

/**
 * Discover trending API repos from GitHub
 */
async function discoverFromGitHub() {
  console.log('[API-HUNTER] Discovering from GitHub...');

  const apis = [];

  try {
    // Search for API-related repos
    const searches = [
      'api+wrapper+language:javascript',
      'api+client+language:typescript',
      'rest+api+template'
    ];

    for (const query of searches) {
      const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=5`;
      const data = await fetchJson(url);

      if (data && data.items) {
        for (const repo of data.items) {
          apis.push({
            source: 'github',
            name: repo.name,
            description: repo.description || 'No description',
            category: 'github-trending',
            url: repo.html_url,
            stars: repo.stargazers_count,
            language: repo.language,
            topics: repo.topics || [],
            discoveredAt: new Date().toISOString()
          });
        }
      }
      await new Promise(r => setTimeout(r, 1000)); // GitHub rate limit
    }
  } catch (e) {
    console.error('[API-HUNTER] GitHub error:', e.message);
  }

  console.log(`[API-HUNTER] Found ${apis.length} repos from GitHub`);
  return apis;
}

/**
 * Discover free/freemium APIs that could be useful
 */
async function discoverFreeApis() {
  console.log('[API-HUNTER] Discovering free APIs...');

  // Curated list of interesting free APIs to check
  const freeApis = [
    {
      name: 'OpenWeatherMap',
      description: 'Weather data API - current, forecast, historical',
      category: 'weather',
      url: 'https://openweathermap.org/api',
      testEndpoint: 'https://api.openweathermap.org/data/2.5/weather?q=Bangkok&appid=demo',
      potential: 'Weather-based recommendations, travel planning'
    },
    {
      name: 'CoinGecko',
      description: 'Cryptocurrency data - prices, market cap, exchanges',
      category: 'cryptocurrency',
      url: 'https://www.coingecko.com/en/api',
      testEndpoint: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=thb',
      potential: 'Crypto portfolio tracker, price alerts, trading signals'
    },
    {
      name: 'ExchangeRate-API',
      description: 'Currency exchange rates',
      category: 'finance',
      url: 'https://www.exchangerate-api.com/',
      testEndpoint: 'https://open.er-api.com/v6/latest/USD',
      potential: 'Currency converter, forex tracking'
    },
    {
      name: 'REST Countries',
      description: 'Country data - population, languages, currencies',
      category: 'data',
      url: 'https://restcountries.com/',
      testEndpoint: 'https://restcountries.com/v3.1/name/thailand',
      potential: 'Travel app, localization, educational tools'
    },
    {
      name: 'JSONPlaceholder',
      description: 'Fake REST API for testing and prototyping',
      category: 'development',
      url: 'https://jsonplaceholder.typicode.com/',
      testEndpoint: 'https://jsonplaceholder.typicode.com/posts/1',
      potential: 'Template for building similar mock APIs'
    },
    {
      name: 'Dog CEO',
      description: 'Random dog images API',
      category: 'fun',
      url: 'https://dog.ceo/dog-api/',
      testEndpoint: 'https://dog.ceo/api/breeds/image/random',
      potential: 'Fun apps, social media bots, mood boosters'
    },
    {
      name: 'Quotable',
      description: 'Random quotes API',
      category: 'content',
      url: 'https://github.com/lukePeavey/quotable',
      testEndpoint: 'https://api.quotable.io/random',
      potential: 'Daily inspiration apps, social media content'
    },
    {
      name: 'Open Library',
      description: 'Book data - search, covers, details',
      category: 'books',
      url: 'https://openlibrary.org/developers/api',
      testEndpoint: 'https://openlibrary.org/api/books?bibkeys=ISBN:0451526538&format=json',
      potential: 'Book recommendation, reading tracker'
    },
    {
      name: 'IP-API',
      description: 'IP geolocation - country, city, ISP',
      category: 'geolocation',
      url: 'http://ip-api.com/',
      testEndpoint: 'http://ip-api.com/json/',
      potential: 'Visitor analytics, localized content'
    },
    {
      name: 'PokeAPI',
      description: 'Pokemon data - all pokemon info',
      category: 'games',
      url: 'https://pokeapi.co/',
      testEndpoint: 'https://pokeapi.co/api/v2/pokemon/pikachu',
      potential: 'Pokemon apps, game guides, fan sites'
    }
  ];

  const apis = freeApis.map(api => ({
    ...api,
    source: 'curated-free',
    discoveredAt: new Date().toISOString()
  }));

  console.log(`[API-HUNTER] Loaded ${apis.length} curated free APIs`);
  return apis;
}

// =============================================================================
// API TESTER - ทดสอบ API จริง
// =============================================================================

/**
 * Test an API endpoint
 */
async function testApi(api) {
  console.log(`[API-HUNTER] Testing API: ${api.name}`);

  const result = {
    name: api.name,
    testedAt: new Date().toISOString(),
    success: false,
    responseTime: 0,
    statusCode: null,
    sampleData: null,
    error: null
  };

  const testUrl = api.testEndpoint || api.url;

  // Skip if no testable URL
  if (!testUrl || !testUrl.startsWith('http')) {
    result.error = 'No testable endpoint';
    return result;
  }

  try {
    const startTime = Date.now();
    const response = await fetchWithTimeout(testUrl);
    result.responseTime = Date.now() - startTime;
    result.statusCode = response.status;

    if (response.ok) {
      result.success = true;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        // Store sample (truncated)
        result.sampleData = JSON.stringify(data).slice(0, 500);
      } else {
        const text = await response.text();
        result.sampleData = text.slice(0, 500);
      }
    } else {
      result.error = `HTTP ${response.status}`;
    }
  } catch (e) {
    result.error = e.message;
  }

  console.log(`[API-HUNTER] Test result: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.responseTime}ms)`);
  return result;
}

/**
 * Test multiple APIs
 */
async function testApis(apis, limit = 5) {
  const results = [];

  for (const api of apis.slice(0, limit)) {
    const result = await testApi(api);
    results.push({ api, testResult: result });
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }

  return results;
}

// =============================================================================
// OPPORTUNITY ANALYZER - วิเคราะห์โอกาสจาก API
// =============================================================================

/**
 * Analyze API for business opportunities
 */
async function analyzeOpportunity(api, testResult) {
  console.log(`[API-HUNTER] Analyzing opportunity: ${api.name}`);

  const analysisPrompt = `วิเคราะห์ API นี้สำหรับโอกาสทำธุรกิจ:

API: ${api.name}
Description: ${api.description}
Category: ${api.category}
URL: ${api.url}
Auth Required: ${api.auth || 'unknown'}
Test Success: ${testResult?.success || 'not tested'}
Response Time: ${testResult?.responseTime || 'N/A'}ms
Sample Data: ${testResult?.sampleData?.slice(0, 200) || 'N/A'}

Context ของ Tars (เจ้าของ):
- มีโรงแรมใน Pai (The Arch Casa, Betel Palm Village)
- สนใจ: Gold, Bitcoin, Crypto, Automation
- Tech: Next.js, Railway, AI
- ต้องการ passive income, low maintenance

วิเคราะห์:
1. API นี้ใช้ทำอะไรได้บ้าง?
2. มีโอกาสทำเงินอย่างไร?
3. เหมาะกับ Tars ไหม?
4. ทำ MVP ได้เร็วแค่ไหน?

ตอบเป็น JSON:
{
  "useCases": ["use case 1", "use case 2"],
  "monetization": ["วิธีทำเงิน 1", "วิธีทำเงิน 2"],
  "projectIdea": {
    "name": "ชื่อโปรเจค",
    "description": "รายละเอียด",
    "features": ["feature 1", "feature 2"],
    "estimatedHours": 8-24,
    "revenueModel": "subscription/ads/freemium"
  },
  "score": {
    "relevance": 0-100,
    "feasibility": 0-100,
    "profitPotential": 0-100,
    "tarsFit": 0-100,
    "total": 0-100
  },
  "recommendation": "BUILD / SKIP / MAYBE",
  "reasoning": "เหตุผล"
}

ตอบ JSON เท่านั้น:`;

  try {
    const response = await claude.chat([{ role: 'user', content: analysisPrompt }], {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500
    });

    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        api: api.name,
        category: api.category,
        analysis,
        analyzedAt: new Date().toISOString()
      };
    }
  } catch (e) {
    console.error('[API-HUNTER] Analysis error:', e.message);
  }

  return {
    api: api.name,
    analysis: null,
    error: 'Could not analyze',
    analyzedAt: new Date().toISOString()
  };
}

// =============================================================================
// MAIN HUNT CYCLE
// =============================================================================

/**
 * Run a full API hunting cycle
 */
async function runHuntCycle(config) {
  console.log('\n========================================');
  console.log('[API-HUNTER] 🔍 Starting API Hunt Cycle');
  console.log('========================================\n');

  const data = loadDiscoveries();
  const cycleStart = new Date().toISOString();

  try {
    // 1. Discover APIs from multiple sources
    console.log('[API-HUNTER] Step 1: Discovering APIs...');
    const allApis = [];

    // Public APIs
    const publicApis = await discoverFromPublicApis();
    allApis.push(...publicApis);

    // GitHub trending
    const githubApis = await discoverFromGitHub();
    allApis.push(...githubApis);

    // Curated free APIs
    const freeApis = await discoverFreeApis();
    allApis.push(...freeApis);

    console.log(`[API-HUNTER] Total discovered: ${allApis.length} APIs`);

    // 2. Filter out already discovered
    const newApis = allApis.filter(api =>
      !data.apis.find(a => a.name === api.name)
    );
    console.log(`[API-HUNTER] New APIs: ${newApis.length}`);

    // 3. Test promising APIs
    console.log('[API-HUNTER] Step 2: Testing APIs...');
    const apisToTest = newApis.filter(api => api.testEndpoint).slice(0, 5);
    const testResults = await testApis(apisToTest);

    // 4. Analyze opportunities for working APIs
    console.log('[API-HUNTER] Step 3: Analyzing opportunities...');
    const opportunities = [];

    for (const { api, testResult } of testResults) {
      if (testResult.success) {
        const opportunity = await analyzeOpportunity(api, testResult);
        opportunities.push(opportunity);
        await new Promise(r => setTimeout(r, 1000)); // Rate limit
      }
    }

    // 5. Save results
    data.apis = [...newApis, ...data.apis].slice(0, 100); // Keep last 100
    data.tested = [...testResults.map(t => t.testResult), ...data.tested].slice(0, 50);
    data.opportunities = [...opportunities, ...data.opportunities].slice(0, 30);
    data.lastHunt = cycleStart;
    data.stats.totalDiscovered += newApis.length;
    data.stats.totalTested += testResults.length;
    data.stats.totalOpportunities += opportunities.length;

    saveDiscoveries(data);

    // 6. Find best opportunity
    const bestOpportunity = opportunities
      .filter(o => o.analysis?.score?.total)
      .sort((a, b) => (b.analysis?.score?.total || 0) - (a.analysis?.score?.total || 0))[0];

    console.log('\n[API-HUNTER] Hunt cycle complete!');
    console.log(`- Discovered: ${newApis.length} new APIs`);
    console.log(`- Tested: ${testResults.length} APIs`);
    console.log(`- Opportunities: ${opportunities.length}`);
    if (bestOpportunity) {
      console.log(`- Best: ${bestOpportunity.api} (${bestOpportunity.analysis?.score?.total}/100)`);
    }

    return {
      success: true,
      discovered: newApis.length,
      tested: testResults.length,
      opportunities: opportunities.length,
      bestOpportunity,
      allOpportunities: opportunities
    };

  } catch (error) {
    console.error('[API-HUNTER] Hunt cycle error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get hunt status
 */
function getStatus() {
  const data = loadDiscoveries();
  return {
    totalApis: data.apis.length,
    totalTested: data.tested.length,
    totalOpportunities: data.opportunities.length,
    lastHunt: data.lastHunt,
    stats: data.stats,
    topOpportunities: data.opportunities
      .filter(o => o.analysis?.score?.total)
      .sort((a, b) => (b.analysis?.score?.total || 0) - (a.analysis?.score?.total || 0))
      .slice(0, 5)
      .map(o => ({
        api: o.api,
        score: o.analysis?.score?.total,
        recommendation: o.analysis?.recommendation,
        projectIdea: o.analysis?.projectIdea?.name
      }))
  };
}

/**
 * Get all discoveries
 */
function getDiscoveries() {
  return loadDiscoveries();
}

/**
 * Force a hunt cycle now
 */
async function huntNow(config) {
  return runHuntCycle(config);
}

/**
 * Search for specific API type
 */
async function searchApis(query) {
  console.log(`[API-HUNTER] Searching for: ${query}`);

  try {
    const data = await fetchJson(`https://api.publicapis.org/entries?title=${encodeURIComponent(query)}`);
    if (data && data.entries) {
      return data.entries.map(entry => ({
        name: entry.API,
        description: entry.Description,
        category: entry.Category,
        url: entry.Link,
        auth: entry.Auth
      }));
    }
  } catch (e) {
    console.error('[API-HUNTER] Search error:', e.message);
  }

  return [];
}

export default {
  // Main cycle
  runHuntCycle,
  huntNow,

  // Discovery
  discoverFromPublicApis,
  discoverFromGitHub,
  discoverFreeApis,
  searchApis,

  // Testing
  testApi,
  testApis,

  // Analysis
  analyzeOpportunity,

  // Status
  getStatus,
  getDiscoveries,

  // Config
  CONFIG
};
