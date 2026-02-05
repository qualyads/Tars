#!/usr/bin/env node
/**
 * Oracle Memory MCP Server
 * Provides memory tools for Claude Code integration
 *
 * Tools:
 * - oracle_remember: Save information to memory
 * - oracle_recall: Search memories semantically
 * - oracle_context: Get full context for session
 * - oracle_learn: Record mistakes and lessons
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const ORACLE_API_URL = process.env.ORACLE_API_URL || 'https://oracle-agent-production.up.railway.app/api/memory';
const ORACLE_API_KEY = process.env.ORACLE_API_KEY || '';

/**
 * Make API request to Oracle Memory API
 */
async function callOracleAPI(endpoint, method = 'GET', body = null) {
  const url = `${ORACLE_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': ORACLE_API_KEY
  };

  try {
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[MCP] API call failed: ${endpoint}`, error.message);
    throw error;
  }
}

/**
 * Tool definitions
 */
const TOOLS = [
  {
    name: 'oracle_remember',
    description: 'Save information to Oracle\'s unified memory. Use this to store important facts, preferences, decisions, or anything that should be remembered across sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The information to remember'
        },
        type: {
          type: 'string',
          enum: ['fact', 'preference', 'decision', 'learning', 'conversation'],
          description: 'Type of memory',
          default: 'fact'
        },
        importance: {
          type: 'number',
          description: 'Importance level 0-1 (higher = more important)',
          default: 0.5
        }
      },
      required: ['content']
    }
  },
  {
    name: 'oracle_recall',
    description: 'Search through Oracle\'s memory using semantic search. Use this to find relevant past conversations, facts, or decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 5
        }
      },
      required: ['query']
    }
  },
  {
    name: 'oracle_context',
    description: 'Get full context including user profile, recent memories, mistakes to avoid, and semantic knowledge. Call this at the start of important tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'string',
          description: 'User ID to get context for',
          default: 'tars'
        }
      }
    }
  },
  {
    name: 'oracle_learn',
    description: 'Record a mistake or lesson learned. This helps Oracle avoid repeating errors and improve over time.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['mistake', 'learning', 'pattern'],
          description: 'Type of learning'
        },
        category: {
          type: 'string',
          description: 'Category (e.g., "assumption", "permission", "technical")'
        },
        description: {
          type: 'string',
          description: 'What happened'
        },
        lesson: {
          type: 'string',
          description: 'What was learned / how to avoid this'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'oracle_self_model',
    description: 'Get Oracle\'s self-model including identity, capabilities, performance metrics, and goals.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Handle tool calls
 */
async function handleToolCall(name, args) {
  switch (name) {
    case 'oracle_remember':
      return await callOracleAPI('/save', 'POST', {
        content: args.content,
        memory_type: args.type || 'fact',
        importance: args.importance || 0.5,
        context: { source: 'claude_code' }
      });

    case 'oracle_recall':
      return await callOracleAPI(`/search?q=${encodeURIComponent(args.query)}&limit=${args.limit || 5}`);

    case 'oracle_context':
      return await callOracleAPI(`/context?user_id=${args.user_id || 'tars'}`);

    case 'oracle_learn':
      return await callOracleAPI('/learn', 'POST', {
        type: args.type || 'learning',
        category: args.category,
        description: args.description,
        lesson: args.lesson,
        context: { source: 'claude_code' }
      });

    case 'oracle_self_model':
      return await callOracleAPI('/self-model');

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Create and run MCP server
 */
async function main() {
  const server = new Server(
    {
      name: 'oracle-memory',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] Oracle Memory server started');
}

main().catch(console.error);
