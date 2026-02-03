/**
 * Config Defaults - Default Values และ Merging จาก OpenClaw Pattern
 *
 * Features:
 * - Multi-layer defaults (apply*Defaults chaining)
 * - Model aliases (opus, sonnet, gpt)
 * - Non-mutating apply functions
 *
 * @module config-defaults
 */

// ============================================================
// Model Defaults
// ============================================================

/**
 * Model aliases - ใช้ชื่อสั้นแทน full model ID
 */
export const MODEL_ALIASES = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-5-20250514',
  haiku: 'claude-3-5-haiku-20241022',
  gpt: 'gpt-4o',
  'gpt-mini': 'gpt-4o-mini',
};

/**
 * Default model settings
 */
export const DEFAULT_MODEL = {
  primary: 'sonnet',
  fallback: 'haiku',
  maxTokens: 8192,
  temperature: 0.7,
  topP: 0.9,
};

/**
 * Resolve model alias → full ID
 */
export function resolveModelAlias(modelName) {
  return MODEL_ALIASES[modelName] || modelName;
}

/**
 * Apply model defaults
 */
export function applyModelDefaults(config) {
  const model = config.model || {};
  return {
    ...config,
    model: {
      primary: model.primary || DEFAULT_MODEL.primary,
      fallback: model.fallback || DEFAULT_MODEL.fallback,
      maxTokens: model.maxTokens ?? DEFAULT_MODEL.maxTokens,
      temperature: model.temperature ?? DEFAULT_MODEL.temperature,
      topP: model.topP ?? DEFAULT_MODEL.topP,
    },
  };
}

// ============================================================
// Agent Defaults
// ============================================================

export const DEFAULT_AGENT = {
  maxConcurrent: 3,
  subagentMaxConcurrent: 2,
  maxTurns: 50,
  timeout: 300000, // 5 minutes
};

/**
 * Apply agent defaults
 */
export function applyAgentDefaults(config) {
  const agent = config.agent || {};
  return {
    ...config,
    agent: {
      maxConcurrent: agent.maxConcurrent ?? DEFAULT_AGENT.maxConcurrent,
      subagentMaxConcurrent: agent.subagentMaxConcurrent ?? DEFAULT_AGENT.subagentMaxConcurrent,
      maxTurns: agent.maxTurns ?? DEFAULT_AGENT.maxTurns,
      timeout: agent.timeout ?? DEFAULT_AGENT.timeout,
    },
  };
}

// ============================================================
// Session Defaults
// ============================================================

export const DEFAULT_SESSION = {
  persistence: true,
  maxHistory: 100,
  compaction: {
    mode: 'safeguard',
    threshold: 0.7, // 70% of context
  },
};

/**
 * Apply session defaults
 */
export function applySessionDefaults(config) {
  const session = config.session || {};
  const compaction = session.compaction || {};

  return {
    ...config,
    session: {
      persistence: session.persistence ?? DEFAULT_SESSION.persistence,
      maxHistory: session.maxHistory ?? DEFAULT_SESSION.maxHistory,
      compaction: {
        mode: compaction.mode || DEFAULT_SESSION.compaction.mode,
        threshold: compaction.threshold ?? DEFAULT_SESSION.compaction.threshold,
      },
    },
  };
}

// ============================================================
// Context Pruning Defaults
// ============================================================

export const DEFAULT_CONTEXT_PRUNING = {
  mode: 'cache-ttl',
  ttl: '1h',
  minTokens: 16000,
  warningThreshold: 32000,
};

/**
 * Apply context pruning defaults
 */
export function applyContextPruningDefaults(config) {
  const pruning = config.contextPruning || {};
  return {
    ...config,
    contextPruning: {
      mode: pruning.mode || DEFAULT_CONTEXT_PRUNING.mode,
      ttl: pruning.ttl || DEFAULT_CONTEXT_PRUNING.ttl,
      minTokens: pruning.minTokens ?? DEFAULT_CONTEXT_PRUNING.minTokens,
      warningThreshold: pruning.warningThreshold ?? DEFAULT_CONTEXT_PRUNING.warningThreshold,
    },
  };
}

// ============================================================
// Heartbeat Defaults
// ============================================================

export const DEFAULT_HEARTBEAT = {
  enabled: true,
  every: '30m',
  morningBriefing: '07:00',
  eveningReport: '21:00',
};

/**
 * Apply heartbeat defaults
 */
export function applyHeartbeatDefaults(config) {
  const heartbeat = config.heartbeat || {};
  return {
    ...config,
    heartbeat: {
      enabled: heartbeat.enabled ?? DEFAULT_HEARTBEAT.enabled,
      every: heartbeat.every || DEFAULT_HEARTBEAT.every,
      morningBriefing: heartbeat.morningBriefing || DEFAULT_HEARTBEAT.morningBriefing,
      eveningReport: heartbeat.eveningReport || DEFAULT_HEARTBEAT.eveningReport,
    },
  };
}

// ============================================================
// Logging Defaults
// ============================================================

export const DEFAULT_LOGGING = {
  level: 'info',
  redactSensitive: 'tools',
  console: true,
  file: true,
  maxFileSize: '10mb',
  maxFiles: 5,
};

/**
 * Apply logging defaults
 */
export function applyLoggingDefaults(config) {
  const logging = config.logging || {};
  return {
    ...config,
    logging: {
      level: logging.level || DEFAULT_LOGGING.level,
      redactSensitive: logging.redactSensitive || DEFAULT_LOGGING.redactSensitive,
      console: logging.console ?? DEFAULT_LOGGING.console,
      file: logging.file ?? DEFAULT_LOGGING.file,
      maxFileSize: logging.maxFileSize || DEFAULT_LOGGING.maxFileSize,
      maxFiles: logging.maxFiles ?? DEFAULT_LOGGING.maxFiles,
    },
  };
}

// ============================================================
// Message Defaults
// ============================================================

export const DEFAULT_MESSAGE = {
  ackReactionScope: 'group-mentions',
  maxLength: 5000,
  chunkSize: 4000,
  debounceMs: 300,
};

/**
 * Apply message defaults
 */
export function applyMessageDefaults(config) {
  const message = config.message || {};
  return {
    ...config,
    message: {
      ackReactionScope: message.ackReactionScope || DEFAULT_MESSAGE.ackReactionScope,
      maxLength: message.maxLength ?? DEFAULT_MESSAGE.maxLength,
      chunkSize: message.chunkSize ?? DEFAULT_MESSAGE.chunkSize,
      debounceMs: message.debounceMs ?? DEFAULT_MESSAGE.debounceMs,
    },
  };
}

// ============================================================
// LINE Defaults
// ============================================================

export const DEFAULT_LINE = {
  enabled: true,
  richMenu: true,
  flexMessages: true,
  pushNotifications: true,
  maxMessageLength: 5000,
};

/**
 * Apply LINE defaults
 */
export function applyLineDefaults(config) {
  const line = config.line || {};
  return {
    ...config,
    line: {
      enabled: line.enabled ?? DEFAULT_LINE.enabled,
      richMenu: line.richMenu ?? DEFAULT_LINE.richMenu,
      flexMessages: line.flexMessages ?? DEFAULT_LINE.flexMessages,
      pushNotifications: line.pushNotifications ?? DEFAULT_LINE.pushNotifications,
      maxMessageLength: line.maxMessageLength ?? DEFAULT_LINE.maxMessageLength,
    },
  };
}

// ============================================================
// Autonomy Defaults
// ============================================================

export const DEFAULT_AUTONOMY = {
  enabled: true,
  monitoringInterval: '15m',
  approvalRequired: {
    investment: true,
    promotion: true,
    pricing: true,
  },
  levels: {
    personal: 'high',
    hotel: 'medium',
    investment: 'low',
    saas: 'medium',
  },
};

/**
 * Apply autonomy defaults
 */
export function applyAutonomyDefaults(config) {
  const autonomy = config.autonomy || {};
  const approval = autonomy.approvalRequired || {};
  const levels = autonomy.levels || {};

  return {
    ...config,
    autonomy: {
      enabled: autonomy.enabled ?? DEFAULT_AUTONOMY.enabled,
      monitoringInterval: autonomy.monitoringInterval || DEFAULT_AUTONOMY.monitoringInterval,
      approvalRequired: {
        investment: approval.investment ?? DEFAULT_AUTONOMY.approvalRequired.investment,
        promotion: approval.promotion ?? DEFAULT_AUTONOMY.approvalRequired.promotion,
        pricing: approval.pricing ?? DEFAULT_AUTONOMY.approvalRequired.pricing,
      },
      levels: {
        personal: levels.personal || DEFAULT_AUTONOMY.levels.personal,
        hotel: levels.hotel || DEFAULT_AUTONOMY.levels.hotel,
        investment: levels.investment || DEFAULT_AUTONOMY.levels.investment,
        saas: levels.saas || DEFAULT_AUTONOMY.levels.saas,
      },
    },
  };
}

// ============================================================
// Apply All Defaults
// ============================================================

/**
 * Apply all defaults แบบ chaining (non-mutating)
 */
export function applyAllDefaults(config) {
  return applyAutonomyDefaults(
    applyLineDefaults(
      applyMessageDefaults(
        applyLoggingDefaults(
          applyHeartbeatDefaults(
            applyContextPruningDefaults(
              applySessionDefaults(applyAgentDefaults(applyModelDefaults(config)))
            )
          )
        )
      )
    )
  );
}

// ============================================================
// Create Default Config
// ============================================================

/**
 * สร้าง config ใหม่พร้อม defaults ทั้งหมด
 */
export function createDefaultConfig(overrides = {}) {
  const base = applyAllDefaults({});

  // Deep merge overrides
  return deepMergeConfig(base, overrides);
}

/**
 * Deep merge สอง configs
 */
function deepMergeConfig(target, source) {
  if (!source) return target;

  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepMergeConfig(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Aliases
  MODEL_ALIASES,
  resolveModelAlias,

  // Defaults
  DEFAULT_MODEL,
  DEFAULT_AGENT,
  DEFAULT_SESSION,
  DEFAULT_CONTEXT_PRUNING,
  DEFAULT_HEARTBEAT,
  DEFAULT_LOGGING,
  DEFAULT_MESSAGE,
  DEFAULT_LINE,
  DEFAULT_AUTONOMY,

  // Apply functions
  applyModelDefaults,
  applyAgentDefaults,
  applySessionDefaults,
  applyContextPruningDefaults,
  applyHeartbeatDefaults,
  applyLoggingDefaults,
  applyMessageDefaults,
  applyLineDefaults,
  applyAutonomyDefaults,
  applyAllDefaults,

  // Utilities
  createDefaultConfig,
};
