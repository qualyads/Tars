/**
 * Oracle Agent - Module Index
 *
 * Export all lib modules for easy importing.
 *
 * Usage:
 *   import { compaction, bootSystem, contextGuard } from './lib/index.js';
 */

// Core Systems
export * as compaction from './compaction.js';
export * as bootSystem from './boot-system.js';
export * as contextGuard from './context-guard.js';

// LINE Integration
export * as lineDirectives from './line-directives.js';
export * as lineMultiAccount from './line-multi-account.js';
export * as lineCore from './line-core.js';
export * as flexBuilder from './flex-builder.js';

// Scheduling
export * as cronPatterns from './cron-patterns.js';

// Skills
export * as skillSystem from './skill-system.js';

// Auto-Reply Patterns (from OpenClaw)
export * as inlineDirectives from './inline-directives.js';
export * as smartChunking from './smart-chunking.js';
export * as inboundDebounce from './inbound-debounce.js';
export * as statusBuilder from './status-builder.js';
export * as contextBuilder from './context-builder.js';
export * as replyQueue from './reply-queue.js';

// Plugin System (from OpenClaw)
export * as pluginSystem from './plugin-system.js';

// Config System (from OpenClaw)
export * as configLoader from './config-loader.js';
export * as configDefaults from './config-defaults.js';

// Hooks System (from OpenClaw)
export * as hooksSystem from './hooks-system.js';

// Infrastructure (from OpenClaw)
export * as logger from './logger.js';
export * as retry from './retry.js';
export * as dedupe from './dedupe.js';

// Routing & Sessions (from OpenClaw)
export * as routing from './routing.js';
export * as sessionManager from './session-manager.js';
export * as messageRouter from './message-router.js';
export * as channelManager from './channel-manager.js';

// Channels & Media (from OpenClaw)
export * as channels from './channels.js';
export * as media from './media.js';

// Security (from OpenClaw)
export * as security from './security.js';

// Markdown & Utils (from OpenClaw)
export * as markdown from './markdown.js';
export * as utils from './utils.js';

// Terminal (from OpenClaw)
export * as terminal from './terminal.js';
export * as tuiCore from './tui-core.js';

// Process Management (from OpenClaw)
export * as process from './process.js';

// ACP Protocol (from OpenClaw)
export * as acpProtocol from './acp-protocol.js';

// Browser CDP (from OpenClaw)
export * as browserCdp from './browser-cdp.js';

// Memory System (from OpenClaw)
export * as memoryIndex from './memory-index.js';
export * as embeddings from './embeddings.js';

// Re-export commonly used functions
export { analyzeContext, compactMessages } from './compaction.js';
export { runBoot, registerTask, getBootStatus } from './boot-system.js';
export { createGuard, shouldBlockOperation } from './context-guard.js';
export { processForLine, processDirectives } from './line-directives.js';
export { parsePattern, createScheduler } from './cron-patterns.js';
export { discoverSkills, findMatchingSkills } from './skill-system.js';
export { registerAccount, routeWebhook, createLineClient } from './line-multi-account.js';

// LINE Core exports
export { validateSignature, createWebhookMiddleware, LINE_LIMITS } from './line-core.js';
export { chunkText, splitForDelivery, getUserProfile, createQuickReply, attachQuickReply } from './line-core.js';
export { createTextMessage, createImageMessage, processMarkdownForLine, normalizeTarget } from './line-core.js';

// Flex Builder exports
export { createInfoCard, createListCard, createImageCard, createKeyValueCard } from './flex-builder.js';
export { createCarousel, createButtonCard, createConfirmCard, wrapFlexMessage } from './flex-builder.js';
export { createBookingCard, createOccupancyCard } from './flex-builder.js';

// Auto-Reply exports
export { processAllDirectives, extractThinkDirective } from './inline-directives.js';
export { smartChunk, chunkMarkdownText } from './smart-chunking.js';
export { createMessageDebouncer, createInboundDebouncer } from './inbound-debounce.js';
export { buildStatusMessage, buildContextStatus } from './status-builder.js';

// Context Builder exports
export { createMsgContext, finalizeContext, applyTemplate, formatEnvelope } from './context-builder.js';
export { formatInboundWithEnvelope, getHumanDelay, sleepHumanDelay, createContextFromLineEvent } from './context-builder.js';

// Reply Queue exports
export { DISPATCH_KINDS, createReplyDispatcher, createDispatcherWithTyping, deliverChunks } from './reply-queue.js';

// Memory Index exports
export { createMemoryIndex, chunkMarkdown, hashText, MEMORY_SOURCES } from './memory-index.js';

// Embeddings exports
export { createEmbedder, createEmbeddingCache, PROVIDERS as EMBEDDING_PROVIDERS } from './embeddings.js';
export { createOpenAIEmbedder, createGeminiEmbedder, cosineSimilarity, normalizeVector } from './embeddings.js';

// Config exports
export { loadConfig, saveConfig, resolveConfigPath, substituteEnvVars } from './config-loader.js';
export { applyAllDefaults, createDefaultConfig, MODEL_ALIASES, resolveModelAlias } from './config-defaults.js';

// Hooks exports
export { registerHook, triggerHook, emit, loadHooks, EVENT_TYPES } from './hooks-system.js';
export { onMessage, onMessageReceive, onSessionStart, onAgentBoot } from './hooks-system.js';

// Infrastructure exports
export { info, warn, error, debug, createSubsystemLogger, setLevel } from './logger.js';
export { retryAsync, withRetry, isTransientError, sleep } from './retry.js';
export { createDedupeCache, createMessageDedupeCache, withDedupe } from './dedupe.js';

// Routing exports
export { resolveRoute, generateSessionKey, parseSessionKey, createBinding } from './routing.js';
export { getSession, updateSession, resolveSendPolicy, setModelOverride } from './session-manager.js';

// Message Router exports
export { generateSessionKey as createSessionKey, parseSessionKey as decodeSessionKey } from './message-router.js';
export { createRouteResolver, resolveTarget, DM_SCOPES, MATCH_PRIORITY } from './message-router.js';

// Channel Manager exports
export { createChannelManager, CHANNEL_STATES, deliverBatch, createBroadcaster } from './channel-manager.js';

// Channels exports
export { normalizeChatType, resolveSenderLabel, isCommandAllowed, shouldSendAck } from './channels.js';
export { parseMediaTokens, detectMime, storeMedia, sanitizeFilename } from './media.js';

// Security exports
export { runSecurityAudit, wrapExternalContent, hasSuspiciousContent, isPathSafe } from './security.js';

// Markdown exports
export { findCodeFences, extractFrontmatter, findSafeSplitPoint } from './markdown.js';

// Utils exports
export { formatRelativeTime, parseBoolean, createManagedQueue, processDirectiveTags } from './utils.js';
export { truncate, deepClone, isEmpty, elideText } from './utils.js';

// Terminal exports
export { renderTable, createSpinner, renderBox, style, stripAnsi } from './terminal.js';

// TUI Core exports
export { ACTIVITY_STATUS, CONNECTION_STATUS, createActivityTracker } from './tui-core.js';
export { parseCommand, getInputType, createStreamAssembler, createWaitingAnimation } from './tui-core.js';
export { filterItems, createInputHistory, buildFooter } from './tui-core.js';

// Process exports
export { COMMAND_LANES, createCommandQueue, runWithTimeout, runExec } from './process.js';
export { spawnWithFallback, commandExists, killProcessTree, waitForExit, createProcessPool } from './process.js';

// ACP Protocol exports
export { FRAME_TYPES, TOOL_KINDS, CHAT_STATES, createRequestFrame, createResponseFrame } from './acp-protocol.js';
export { createSessionStore, createDeltaTracker, createToolCallTracker, inferToolKind } from './acp-protocol.js';

// Browser CDP exports
export { createCdpClient, captureScreenshot, navigate, waitFor } from './browser-cdp.js';
export { getPageText, getPageHtml, querySelector, evaluate } from './browser-cdp.js';
export { findChromeExecutable, launchChrome, stopChrome } from './browser-cdp.js';

/**
 * Initialize all systems
 */
export async function initializeAll(options = {}) {
  const results = {
    boot: null,
    skills: null,
    lineAccounts: null,
    scheduler: null
  };

  // Boot system
  if (options.boot !== false) {
    const { runBoot } = await import('./boot-system.js');
    results.boot = await runBoot(options.bootOptions || {});
  }

  // Skill discovery
  if (options.skills !== false) {
    const { discoverSkills } = await import('./skill-system.js');
    results.skills = await discoverSkills(options.skillsPath);
  }

  // LINE multi-account
  if (options.lineMultiAccount !== false) {
    const { initFromEnv } = await import('./line-multi-account.js');
    initFromEnv();
    results.lineAccounts = true;
  }

  // Scheduler
  if (options.scheduler) {
    const { createScheduler } = await import('./cron-patterns.js');
    const scheduler = createScheduler(options.schedulerOptions || {});

    // Add jobs from options
    if (options.jobs) {
      for (const [name, config] of Object.entries(options.jobs)) {
        scheduler.addJob(name, config.pattern, config.callback);
      }
    }

    scheduler.start();
    results.scheduler = scheduler;
  }

  console.log('[ORACLE] All systems initialized');
  return results;
}

export default {
  initializeAll
};
