/**
 * 404 Checker - Scan GSC indexed URLs, find 404s, auto-match redirects
 *
 * Flow: scanGSC → fetchSitemap → fetchCMSSlugs → matchRedirects → validateTargets → generateCSV
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import searchConsole from './search-console.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '..', 'data', '404check-results.json');

// Manual redirect overrides (known mappings)
const MANUAL_REDIRECTS = {
  '/blog/what-is-webflow': '/blog/webflow-คืออะไร',
  '/blog/webflow-vs-wordpress': '/blog/webflow-vs-wordpress-2026',
};

// In-memory job state
let currentJob = null;

/**
 * Scan GSC indexed pages → HEAD check → find 404s
 */
async function scanGSC(siteUrl = 'sc-domain:visionxbrain.com') {
  currentJob = { status: 'scanning', progress: 0, total: 0, startedAt: new Date().toISOString() };

  try {
    // Step 1: Get all indexed pages from GSC (using searchAnalytics with page dimension)
    const pages = await searchConsole.searchAnalytics(siteUrl, {
      dimensions: ['page'],
      rowLimit: 1000,
      startDate: daysAgo(90),
      endDate: daysAgo(1),
    });

    const urls = pages.map(p => p.keys[0]);
    currentJob.total = urls.length;
    currentJob.status = 'checking';

    // Step 2: HEAD check each URL
    const errors404 = [];
    const healthy = [];

    for (let i = 0; i < urls.length; i++) {
      currentJob.progress = i + 1;
      try {
        const resp = await fetch(urls[i], { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10000) });
        if (resp.status === 404 || resp.status === 410) {
          errors404.push({ url: urls[i], status: resp.status, gscClicks: pages[i].clicks, gscImpressions: pages[i].impressions });
        } else {
          healthy.push({ url: urls[i], status: resp.status });
        }
      } catch (e) {
        // Network error → treat as potential 404
        errors404.push({ url: urls[i], status: 'error', error: e.message, gscClicks: pages[i].clicks, gscImpressions: pages[i].impressions });
      }

      // Rate limit: 5 req/sec
      if (i % 5 === 4) await sleep(200);
    }

    currentJob.status = 'done';
    currentJob.finishedAt = new Date().toISOString();

    const result = {
      siteUrl,
      scannedAt: currentJob.finishedAt,
      totalPages: urls.length,
      errors404,
      healthyCount: healthy.length,
      redirects: [],
      validated: false,
    };

    saveResults(result);
    return result;
  } catch (err) {
    currentJob.status = 'error';
    currentJob.error = err.message;
    throw err;
  }
}

/**
 * Fetch sitemap.xml → parse all <loc> URLs
 */
async function fetchSitemap(siteUrl = 'https://www.visionxbrain.com') {
  const sitemapUrl = `${siteUrl}/sitemap.xml`;
  const resp = await fetch(sitemapUrl, { signal: AbortSignal.timeout(15000) });
  const xml = await resp.text();

  // Parse <loc> tags (simple regex — no need for heavy XML parser)
  const urls = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }

  // Also check for nested sitemaps
  const sitemapRefs = [];
  const sitemapRegex = /<sitemap>\s*<loc>(.*?)<\/loc>/g;
  while ((match = sitemapRegex.exec(xml)) !== null) {
    sitemapRefs.push(match[1].trim());
  }

  // Fetch nested sitemaps
  for (const nestedUrl of sitemapRefs) {
    try {
      const nestedResp = await fetch(nestedUrl, { signal: AbortSignal.timeout(10000) });
      const nestedXml = await nestedResp.text();
      const nestedLocRegex = /<loc>(.*?)<\/loc>/g;
      while ((match = nestedLocRegex.exec(nestedXml)) !== null) {
        const u = match[1].trim();
        if (!urls.includes(u)) urls.push(u);
      }
    } catch { /* skip failed nested sitemaps */ }
  }

  return urls;
}

/**
 * Fetch CMS slugs from Webflow CMS API (blog collection)
 */
async function fetchCMSSlugs() {
  const token = process.env.WEBFLOW_API_TOKEN;
  const siteId = process.env.WEBFLOW_SITE_ID || '64dbb1bea24a18e209e3b195';

  if (!token) {
    // Fallback: read from cached webflow pages
    const cachePath = path.join(__dirname, '..', 'data', 'webflow-all-pages.json');
    if (fs.existsSync(cachePath)) {
      const pages = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      return pages.map(p => ({
        slug: p.slug,
        url: p.url || `https://www.visionxbrain.com/${p.slug}`,
        title: p.title || p.name,
      }));
    }
    return [];
  }

  try {
    // Get collections
    const colResp = await fetch(`https://api.webflow.com/v2/sites/${siteId}/collections`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const colData = await colResp.json();
    const blogCol = (colData.collections || []).find(c => c.slug === 'blog' || c.slug === 'posts' || c.displayName?.toLowerCase().includes('blog'));

    if (!blogCol) return [];

    // Get all items
    const itemsResp = await fetch(`https://api.webflow.com/v2/collections/${blogCol.id}/items?limit=100`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const itemsData = await itemsResp.json();

    return (itemsData.items || []).map(item => ({
      slug: item.fieldData?.slug || item.slug,
      url: `https://www.visionxbrain.com/blog/${item.fieldData?.slug || item.slug}`,
      title: item.fieldData?.name || item.fieldData?.title || '',
    }));
  } catch (err) {
    console.error('[404-checker] CMS fetch error:', err.message);
    return [];
  }
}

/**
 * 3-tier matching: manual → exact slug → fuzzy
 */
async function matchRedirects(errors404 = null) {
  const data = errors404 ? { errors404 } : loadResults();
  if (!data?.errors404?.length) return { redirects: [], unmatched: 0 };

  // Get valid targets
  const [sitemapUrls, cmsSlugs] = await Promise.all([
    fetchSitemap(),
    fetchCMSSlugs(),
  ]);

  const allValidUrls = new Set(sitemapUrls);
  cmsSlugs.forEach(s => allValidUrls.add(s.url));

  const redirects = [];

  for (const err of data.errors404) {
    const errPath = new URL(err.url).pathname;

    // Tier 1: Manual override
    if (MANUAL_REDIRECTS[errPath]) {
      redirects.push({
        source: err.url,
        sourcePath: errPath,
        target: `https://www.visionxbrain.com${MANUAL_REDIRECTS[errPath]}`,
        matchType: 'manual',
        confidence: 1.0,
        status: 'matched',
      });
      continue;
    }

    // Tier 2: Exact slug match in CMS
    const errSlug = errPath.split('/').filter(Boolean).pop()?.toLowerCase();
    const exactMatch = cmsSlugs.find(s => s.slug.toLowerCase() === errSlug);
    if (exactMatch) {
      redirects.push({
        source: err.url,
        sourcePath: errPath,
        target: exactMatch.url,
        matchType: 'exact',
        confidence: 1.0,
        status: 'matched',
      });
      continue;
    }

    // Tier 3: Fuzzy match
    const bestMatch = fuzzyMatch(errSlug, cmsSlugs, sitemapUrls);
    if (bestMatch && bestMatch.score >= 0.4) {
      redirects.push({
        source: err.url,
        sourcePath: errPath,
        target: bestMatch.url,
        matchType: 'fuzzy',
        confidence: Math.round(bestMatch.score * 100) / 100,
        status: bestMatch.score >= 0.7 ? 'matched' : 'review',
      });
      continue;
    }

    // No match → homepage redirect
    redirects.push({
      source: err.url,
      sourcePath: errPath,
      target: 'https://www.visionxbrain.com/',
      matchType: 'homepage',
      confidence: 0,
      status: 'unmatched',
    });
  }

  // Save to results
  const results = loadResults() || {};
  results.redirects = redirects;
  results.matchedAt = new Date().toISOString();
  saveResults(results);

  return {
    redirects,
    matched: redirects.filter(r => r.status === 'matched').length,
    review: redirects.filter(r => r.status === 'review').length,
    unmatched: redirects.filter(r => r.status === 'unmatched').length,
    homepage: redirects.filter(r => r.matchType === 'homepage').length,
  };
}

/**
 * Fuzzy string matching (Dice coefficient — no external deps needed)
 */
function fuzzyMatch(slug, cmsSlugs, sitemapUrls) {
  if (!slug) return null;

  let bestScore = 0;
  let bestUrl = null;

  // Match against CMS slugs
  for (const cms of cmsSlugs) {
    const score = diceCoefficient(slug, cms.slug.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      bestUrl = cms.url;
    }
  }

  // Match against sitemap paths
  for (const url of sitemapUrls) {
    try {
      const urlSlug = new URL(url).pathname.split('/').filter(Boolean).pop()?.toLowerCase();
      if (!urlSlug) continue;
      const score = diceCoefficient(slug, urlSlug);
      if (score > bestScore) {
        bestScore = score;
        bestUrl = url;
      }
    } catch { /* skip invalid URLs */ }
  }

  return bestScore > 0 ? { url: bestUrl, score: bestScore } : null;
}

/**
 * Dice coefficient for string similarity (no external deps)
 */
function diceCoefficient(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const bigrams = (str) => {
    const set = new Set();
    for (let i = 0; i < str.length - 1; i++) {
      set.add(str.slice(i, i + 2));
    }
    return set;
  };

  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  let intersection = 0;

  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++;
  }

  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

/**
 * Validate all redirect targets exist (HEAD check)
 */
async function validateTargets(redirects = null) {
  const data = redirects ? { redirects } : loadResults();
  if (!data?.redirects?.length) return { valid: 0, invalid: 0, results: [] };

  const results = [];
  for (let i = 0; i < data.redirects.length; i++) {
    const r = data.redirects[i];
    try {
      const resp = await fetch(r.target, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
      const valid = resp.status >= 200 && resp.status < 400;
      results.push({ ...r, targetValid: valid, targetStatus: resp.status });
      data.redirects[i].targetValid = valid;
      data.redirects[i].targetStatus = resp.status;
    } catch (e) {
      results.push({ ...r, targetValid: false, targetStatus: 'error' });
      data.redirects[i].targetValid = false;
      data.redirects[i].targetStatus = 'error';
    }

    if (i % 5 === 4) await sleep(200);
  }

  data.validated = true;
  data.validatedAt = new Date().toISOString();
  saveResults(data);

  return {
    valid: results.filter(r => r.targetValid).length,
    invalid: results.filter(r => !r.targetValid).length,
    results,
  };
}

/**
 * Generate CSV string for redirect import
 */
function generateCSV(redirects = null) {
  const data = redirects || loadResults()?.redirects;
  if (!data?.length) return '';

  const lines = ['Old URL,New URL,Status Code'];
  for (const r of data) {
    const sourcePath = r.sourcePath || new URL(r.source).pathname;
    const targetPath = r.target.startsWith('http') ? new URL(r.target).pathname : r.target;
    lines.push(`${sourcePath},${targetPath},301`);
  }

  return lines.join('\n');
}

/**
 * Update a single redirect mapping
 */
function updateRedirect(index, target) {
  const data = loadResults();
  if (!data?.redirects?.[index]) return null;

  data.redirects[index].target = target;
  data.redirects[index].matchType = 'manual';
  data.redirects[index].status = 'matched';
  data.redirects[index].confidence = 1.0;
  data.redirects[index].targetValid = undefined; // needs re-validation
  saveResults(data);

  return data.redirects[index];
}

/**
 * Get job status
 */
function getJobStatus() {
  if (!currentJob) return { status: 'idle' };
  return { ...currentJob };
}

/**
 * Persistence
 */
function saveResults(data) {
  try {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[404-checker] Save error:', err.message);
  }
}

function loadResults() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('[404-checker] Load error:', err.message);
  }
  return null;
}

// Helpers
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export default {
  scanGSC,
  fetchSitemap,
  fetchCMSSlugs,
  matchRedirects,
  validateTargets,
  generateCSV,
  updateRedirect,
  getJobStatus,
  saveResults,
  loadResults,
};
