/**
 * Broadcast Groups Manager
 * Multiple AI agents respond to the same message
 *
 * Strategies:
 * - parallel: All agents respond at once
 * - sequential: Each agent sees previous responses
 */

import Anthropic from '@anthropic-ai/sdk';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../config.json');

/**
 * Broadcast strategies
 */
const STRATEGIES = {
  PARALLEL: 'parallel',
  SEQUENTIAL: 'sequential'
};

/**
 * Default agent personas
 */
const DEFAULT_AGENTS = {
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    model: 'claude-3-haiku-20240307',
    systemPrompt: 'You are an analytical AI. Focus on data, facts, and logical analysis. Be objective and thorough.'
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    model: 'claude-3-haiku-20240307',
    systemPrompt: 'You are a creative AI. Think outside the box, suggest innovative ideas, and explore possibilities.'
  },
  critic: {
    id: 'critic',
    name: 'Critic',
    model: 'claude-3-haiku-20240307',
    systemPrompt: 'You are a critical AI. Find potential problems, risks, and weaknesses. Play devil\'s advocate.'
  },
  advisor: {
    id: 'advisor',
    name: 'Advisor',
    model: 'claude-3-haiku-20240307',
    systemPrompt: 'You are an advisory AI. Give practical recommendations and actionable advice based on context.'
  }
};

/**
 * Default broadcast groups
 */
const DEFAULT_GROUPS = {
  'decision-panel': {
    id: 'decision-panel',
    name: 'Decision Panel',
    description: 'Multiple perspectives for decision making',
    agents: ['analyst', 'creative', 'critic'],
    strategy: STRATEGIES.PARALLEL
  },
  'code-review': {
    id: 'code-review',
    name: 'Code Review Panel',
    description: 'Security, performance, and style review',
    agents: ['analyst', 'critic'],
    strategy: STRATEGIES.PARALLEL
  },
  'debate': {
    id: 'debate',
    name: 'Debate',
    description: 'Structured debate with different viewpoints',
    agents: ['creative', 'critic', 'advisor'],
    strategy: STRATEGIES.SEQUENTIAL
  }
};

class BroadcastManager {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.agents = { ...DEFAULT_AGENTS, ...(config.broadcast?.agents || {}) };
    this.groups = { ...DEFAULT_GROUPS, ...(config.broadcast?.groups || {}) };
  }

  /**
   * Broadcast message to a group
   * @param {string} groupId - Group ID
   * @param {string} message - Message to broadcast
   * @param {object} options - Additional options
   * @returns {Promise<object[]>} Array of responses from each agent
   */
  async broadcast(groupId, message, options = {}) {
    const group = this.groups[groupId];
    if (!group) {
      throw new Error(`Unknown broadcast group: ${groupId}`);
    }

    const agentIds = group.agents;
    const strategy = group.strategy || STRATEGIES.PARALLEL;

    console.log(`[BROADCAST] Group: ${groupId}, Strategy: ${strategy}, Agents: ${agentIds.join(', ')}`);

    if (strategy === STRATEGIES.PARALLEL) {
      return this._broadcastParallel(agentIds, message, options);
    } else {
      return this._broadcastSequential(agentIds, message, options);
    }
  }

  /**
   * Parallel broadcast - all agents respond simultaneously
   */
  async _broadcastParallel(agentIds, message, options = {}) {
    const promises = agentIds.map(agentId => this._getAgentResponse(agentId, message, options));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          agentId: agentIds[index],
          error: result.reason.message,
          status: 'error'
        };
      }
    });
  }

  /**
   * Sequential broadcast - each agent sees previous responses
   */
  async _broadcastSequential(agentIds, message, options = {}) {
    const responses = [];
    let context = message;

    for (const agentId of agentIds) {
      // Build context with previous responses
      if (responses.length > 0) {
        context = `Original message: ${message}\n\nPrevious responses:\n`;
        responses.forEach(r => {
          context += `\n[${r.agentName}]: ${r.response}\n`;
        });
        context += `\nNow provide your perspective:`;
      }

      const response = await this._getAgentResponse(agentId, context, options);
      responses.push(response);
    }

    return responses;
  }

  /**
   * Get response from a single agent
   */
  async _getAgentResponse(agentId, message, options = {}) {
    const agent = this.agents[agentId];
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    const startTime = Date.now();

    try {
      const response = await this.anthropic.messages.create({
        model: agent.model,
        max_tokens: options.maxTokens || 1024,
        system: agent.systemPrompt,
        messages: [
          { role: 'user', content: message }
        ]
      });

      const responseText = response.content[0]?.text || '';
      const runtime = Date.now() - startTime;

      return {
        agentId: agent.id,
        agentName: agent.name,
        response: responseText,
        model: agent.model,
        runtime,
        tokensIn: response.usage?.input_tokens || 0,
        tokensOut: response.usage?.output_tokens || 0,
        status: 'success'
      };
    } catch (error) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        error: error.message,
        runtime: Date.now() - startTime,
        status: 'error'
      };
    }
  }

  /**
   * Format broadcast responses for display
   */
  formatResponses(responses, options = {}) {
    const separator = options.separator || '\n---\n';
    let output = '';

    for (const r of responses) {
      if (r.status === 'success') {
        output += `**[${r.agentName}]**\n${r.response}${separator}`;
      } else {
        output += `**[${r.agentName}]** Error: ${r.error}${separator}`;
      }
    }

    return output.trim();
  }

  /**
   * Add a custom agent
   */
  addAgent(agentConfig) {
    this.agents[agentConfig.id] = agentConfig;
  }

  /**
   * Add a custom group
   */
  addGroup(groupConfig) {
    this.groups[groupConfig.id] = groupConfig;
  }

  /**
   * Get list of available groups
   */
  getGroups() {
    return Object.values(this.groups).map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      agents: g.agents,
      strategy: g.strategy
    }));
  }

  /**
   * Get list of available agents
   */
  getAgents() {
    return Object.values(this.agents).map(a => ({
      id: a.id,
      name: a.name,
      model: a.model
    }));
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      enabled: config.broadcast?.enabled || true,
      agentCount: Object.keys(this.agents).length,
      groupCount: Object.keys(this.groups).length,
      agents: this.getAgents(),
      groups: this.getGroups()
    };
  }
}

// Singleton
const broadcastManager = new BroadcastManager();

export default broadcastManager;
export { BroadcastManager, STRATEGIES, DEFAULT_AGENTS, DEFAULT_GROUPS };
