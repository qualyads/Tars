/**
 * Browser CDP - Chrome DevTools Protocol จาก OpenClaw Pattern
 *
 * Features:
 * - CDP WebSocket connection
 * - Screenshot capture (full page, viewport)
 * - Page navigation with waiting
 * - Content extraction (DOM, text)
 * - Browser detection and launch
 *
 * @module browser-cdp
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// ============================================================
// CDP Connection
// ============================================================

/**
 * Default CDP port
 */
export const DEFAULT_CDP_PORT = 9222;

/**
 * Normalize CDP WebSocket URL
 * @param {string} url
 * @returns {string}
 */
export function normalizeCdpWsUrl(url) {
  if (!url) return url;

  // Convert http/https to ws/wss
  let wsUrl = url
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:');

  // Add /devtools/browser path if not present
  if (!wsUrl.includes('/devtools/')) {
    wsUrl = wsUrl.replace(/\/?$/, '/devtools/browser');
  }

  return wsUrl;
}

/**
 * Create CDP connection
 * @param {object} options
 * @returns {Promise<object>} CDP client
 */
export async function createCdpClient(options = {}) {
  const {
    host = 'localhost',
    port = DEFAULT_CDP_PORT,
    wsUrl,
    timeout = 5000,
  } = options;

  // Get WebSocket URL
  let url = wsUrl;
  if (!url) {
    // Fetch from Chrome
    const versionUrl = `http://${host}:${port}/json/version`;
    const response = await fetch(versionUrl, {
      signal: AbortSignal.timeout(timeout),
    });
    const data = await response.json();
    url = data.webSocketDebuggerUrl;
  }

  url = normalizeCdpWsUrl(url);

  // Create WebSocket connection
  const ws = new WebSocket(url);
  let messageId = 0;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('CDP connection timeout'));
    }, timeout);

    ws.onopen = () => {
      clearTimeout(timer);
      resolve();
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(err);
    };
  });

  // Handle messages
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.id !== undefined) {
        const resolver = pending.get(msg.id);
        if (resolver) {
          pending.delete(msg.id);
          if (msg.error) {
            resolver.reject(new Error(msg.error.message));
          } else {
            resolver.resolve(msg.result);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  };

  /**
   * Send CDP command
   * @param {string} method
   * @param {object} params
   * @returns {Promise<object>}
   */
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++messageId;

      pending.set(id, { resolve, reject });

      ws.send(JSON.stringify({ id, method, params }));

      // Timeout
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, timeout);
    });
  }

  /**
   * Close connection
   */
  function close() {
    ws.close();
    pending.clear();
  }

  return {
    send,
    close,
    ws,
    url,
  };
}

// ============================================================
// Screenshot
// ============================================================

/**
 * Capture screenshot
 * @param {object} cdp - CDP client
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
export async function captureScreenshot(cdp, options = {}) {
  const {
    format = 'png',
    quality = 80,
    fullPage = false,
    clip,
  } = options;

  const params = {
    format,
    quality: format === 'jpeg' ? quality : undefined,
  };

  // Full page: get layout metrics
  if (fullPage) {
    const metrics = await cdp.send('Page.getLayoutMetrics');
    const { width, height } = metrics.contentSize || metrics.cssContentSize;

    params.clip = {
      x: 0,
      y: 0,
      width,
      height,
      scale: 1,
    };
  } else if (clip) {
    params.clip = clip;
  }

  const result = await cdp.send('Page.captureScreenshot', params);
  return Buffer.from(result.data, 'base64');
}

/**
 * Optimize screenshot (resize + compress)
 * @param {Buffer} buffer
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
export async function optimizeScreenshot(buffer, options = {}) {
  const {
    maxBytes = 5 * 1024 * 1024, // 5MB
    maxSide = 2000,
  } = options;

  // Check if optimization needed
  if (buffer.length <= maxBytes) {
    return buffer;
  }

  // Note: Real implementation would use sharp or jimp
  // This is a simplified version that just returns original
  console.warn('[CDP] Screenshot optimization requires image library');
  return buffer;
}

// ============================================================
// Navigation & Waiting
// ============================================================

/**
 * Navigate to URL
 * @param {object} cdp - CDP client
 * @param {string} url
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function navigate(cdp, url, options = {}) {
  const { timeout = 30000 } = options;

  // Enable page events
  await cdp.send('Page.enable');

  // Navigate
  const result = await cdp.send('Page.navigate', { url });

  if (result.errorText) {
    throw new Error(`Navigation failed: ${result.errorText}`);
  }

  // Wait for load
  await waitFor(cdp, { loadState: 'load', timeout });

  return {
    url: result.url || url,
    frameId: result.frameId,
  };
}

/**
 * Wait for condition
 * @param {object} cdp - CDP client
 * @param {object} condition
 * @returns {Promise<void>}
 */
export async function waitFor(cdp, condition = {}) {
  const {
    timeMs,
    text,
    textGone,
    selector,
    loadState,
    fn,
    timeout = 20000,
  } = condition;

  // Normalize timeout
  const normalizedTimeout = Math.max(500, Math.min(120000, timeout));

  // Time-based wait
  if (timeMs) {
    await new Promise(resolve => setTimeout(resolve, timeMs));
    return;
  }

  // Load state wait
  if (loadState) {
    await waitForLoadState(cdp, loadState, normalizedTimeout);
    return;
  }

  // Text visibility wait
  if (text) {
    await waitForText(cdp, text, false, normalizedTimeout);
    return;
  }

  // Text gone wait
  if (textGone) {
    await waitForText(cdp, textGone, true, normalizedTimeout);
    return;
  }

  // Selector wait
  if (selector) {
    await waitForSelector(cdp, selector, normalizedTimeout);
    return;
  }

  // Custom function wait
  if (fn) {
    await waitForFunction(cdp, fn, normalizedTimeout);
    return;
  }
}

/**
 * Wait for load state
 * @param {object} cdp
 * @param {string} state - 'load' | 'domcontentloaded' | 'networkidle'
 * @param {number} timeout
 */
async function waitForLoadState(cdp, state, timeout) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });

    const readyState = result.result?.value;

    if (state === 'domcontentloaded' && readyState !== 'loading') {
      return;
    }

    if (state === 'load' && readyState === 'complete') {
      return;
    }

    if (state === 'networkidle' && readyState === 'complete') {
      // Additional wait for network idle
      await new Promise(r => setTimeout(r, 500));
      return;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  throw new Error(`Timeout waiting for ${state}`);
}

/**
 * Wait for text visibility
 * @param {object} cdp
 * @param {string} text
 * @param {boolean} gone - Wait for disappearance
 * @param {number} timeout
 */
async function waitForText(cdp, text, gone, timeout) {
  const start = Date.now();
  const escapedText = text.replace(/'/g, "\\'");

  while (Date.now() - start < timeout) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('${escapedText}')`,
      returnByValue: true,
    });

    const found = result.result?.value === true;

    if (gone && !found) return;
    if (!gone && found) return;

    await new Promise(r => setTimeout(r, 100));
  }

  throw new Error(`Timeout waiting for text ${gone ? 'gone' : 'visible'}: ${text}`);
}

/**
 * Wait for selector
 * @param {object} cdp
 * @param {string} selector
 * @param {number} timeout
 */
async function waitForSelector(cdp, selector, timeout) {
  const start = Date.now();
  const escapedSelector = selector.replace(/'/g, "\\'");

  while (Date.now() - start < timeout) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('${escapedSelector}') !== null`,
      returnByValue: true,
    });

    if (result.result?.value === true) return;

    await new Promise(r => setTimeout(r, 100));
  }

  throw new Error(`Timeout waiting for selector: ${selector}`);
}

/**
 * Wait for custom function
 * @param {object} cdp
 * @param {string} fn - JavaScript function string
 * @param {number} timeout
 */
async function waitForFunction(cdp, fn, timeout) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(${fn})()`,
      returnByValue: true,
    });

    if (result.result?.value === true) return;

    await new Promise(r => setTimeout(r, 100));
  }

  throw new Error('Timeout waiting for function');
}

// ============================================================
// Content Extraction
// ============================================================

/**
 * Get page text
 * @param {object} cdp
 * @param {object} options
 * @returns {Promise<string>}
 */
export async function getPageText(cdp, options = {}) {
  const { selector, maxChars = 200000 } = options;

  let expression;
  if (selector) {
    const escaped = selector.replace(/'/g, "\\'");
    expression = `document.querySelector('${escaped}')?.innerText || ''`;
  } else {
    expression = 'document.body.innerText';
  }

  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  let text = result.result?.value || '';

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n[...TRUNCATED]';
  }

  return text;
}

/**
 * Get page HTML
 * @param {object} cdp
 * @param {object} options
 * @returns {Promise<string>}
 */
export async function getPageHtml(cdp, options = {}) {
  const { selector, maxChars = 200000 } = options;

  let expression;
  if (selector) {
    const escaped = selector.replace(/'/g, "\\'");
    expression = `document.querySelector('${escaped}')?.outerHTML || ''`;
  } else {
    expression = 'document.documentElement.outerHTML';
  }

  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });

  let html = result.result?.value || '';

  if (html.length > maxChars) {
    html = html.slice(0, maxChars) + '\n<!-- TRUNCATED -->';
  }

  return html;
}

/**
 * Query selector and get elements
 * @param {object} cdp
 * @param {string} selector
 * @param {object} options
 * @returns {Promise<object[]>}
 */
export async function querySelector(cdp, selector, options = {}) {
  const { maxResults = 20, maxTextLength = 500 } = options;

  const escaped = selector.replace(/'/g, "\\'");

  const result = await cdp.send('Runtime.evaluate', {
    expression: `
      Array.from(document.querySelectorAll('${escaped}')).slice(0, ${maxResults}).map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        text: (el.innerText || '').slice(0, ${maxTextLength}),
        href: el.href || null,
        value: el.value || null,
        type: el.type || null,
      }))
    `,
    returnByValue: true,
  });

  return result.result?.value || [];
}

/**
 * Execute JavaScript
 * @param {object} cdp
 * @param {string} expression
 * @returns {Promise<any>}
 */
export async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }

  return result.result?.value;
}

// ============================================================
// Browser Detection
// ============================================================

/**
 * Common Chrome executable paths by platform
 */
export const CHROME_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/brave-browser',
    '/usr/bin/microsoft-edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
};

/**
 * Find Chrome executable
 * @returns {string|null}
 */
export function findChromeExecutable() {
  const platform = process.platform;
  const paths = CHROME_PATHS[platform] || [];

  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Check if Chrome is reachable
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export async function isChromeReachable(port = DEFAULT_CDP_PORT) {
  try {
    const response = await fetch(`http://localhost:${port}/json/version`, {
      signal: AbortSignal.timeout(500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================
// Browser Launch
// ============================================================

/**
 * Launch Chrome with CDP
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function launchChrome(options = {}) {
  const {
    port = DEFAULT_CDP_PORT,
    headless = false,
    userDataDir,
    executable,
  } = options;

  const exe = executable || findChromeExecutable();
  if (!exe) {
    throw new Error('Chrome executable not found');
  }

  const args = [
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-background-networking',
  ];

  if (userDataDir) {
    args.push(`--user-data-dir=${userDataDir}`);
  }

  if (headless) {
    args.push('--headless=new', '--disable-gpu');
  }

  const proc = spawn(exe, args, {
    stdio: 'ignore',
    detached: false,
  });

  // Wait for Chrome to be ready
  const startTime = Date.now();
  const maxWait = 15000;

  while (Date.now() - startTime < maxWait) {
    if (await isChromeReachable(port)) {
      return {
        pid: proc.pid,
        port,
        executable: exe,
        process: proc,
        headless,
      };
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Kill if not ready
  proc.kill('SIGKILL');
  throw new Error('Chrome failed to start');
}

/**
 * Stop Chrome
 * @param {object} chrome - From launchChrome
 */
export async function stopChrome(chrome) {
  if (!chrome?.process) return;

  chrome.process.kill('SIGTERM');

  // Wait for graceful shutdown
  const startTime = Date.now();
  const maxWait = 2500;

  while (Date.now() - startTime < maxWait) {
    if (!(await isChromeReachable(chrome.port))) {
      return;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Force kill
  chrome.process.kill('SIGKILL');
}

// ============================================================
// Exports
// ============================================================

export default {
  // Constants
  DEFAULT_CDP_PORT,
  CHROME_PATHS,

  // Connection
  normalizeCdpWsUrl,
  createCdpClient,

  // Screenshot
  captureScreenshot,
  optimizeScreenshot,

  // Navigation
  navigate,
  waitFor,

  // Content
  getPageText,
  getPageHtml,
  querySelector,
  evaluate,

  // Browser
  findChromeExecutable,
  isChromeReachable,
  launchChrome,
  stopChrome,
};
