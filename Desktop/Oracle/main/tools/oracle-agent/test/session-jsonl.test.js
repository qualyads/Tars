/**
 * Tests for Session JSONL Logger
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  initSessionLogger,
  logUserMessage,
  logAssistantMessage,
  logSystemEvent,
  logError,
  readSessionLog,
  listSessionLogs,
  getSessionStats,
  closeAllStreams,
  cleanupOldLogs,
  EntryType,
} from '../lib/session-jsonl.js';

const TEST_DIR = path.join(os.tmpdir(), 'oracle-test-sessions');

describe('Session JSONL Logger', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    initSessionLogger({ dir: TEST_DIR });
  });

  afterEach(() => {
    closeAllStreams();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('logUserMessage', () => {
    it('should log user message with correct format', () => {
      const sessionId = 'test-user-1';
      logUserMessage(sessionId, 'Hello, Oracle!');
      closeAllStreams();

      const entries = readSessionLog(sessionId);
      expect(entries.length).toBe(1);
      expect(entries[0].role).toBe('user');
      expect(entries[0].content).toBe('Hello, Oracle!');
      expect(entries[0].type).toBe(EntryType.MESSAGE);
    });

    it('should include metadata when provided', () => {
      const sessionId = 'test-user-2';
      logUserMessage(sessionId, 'Test message', { channel: 'line' });
      closeAllStreams();

      const entries = readSessionLog(sessionId);
      expect(entries[0].metadata.channel).toBe('line');
    });
  });

  describe('logAssistantMessage', () => {
    it('should log assistant message', () => {
      const sessionId = 'test-assistant-1';
      logAssistantMessage(sessionId, 'Hello! How can I help?');
      closeAllStreams();

      const entries = readSessionLog(sessionId);
      expect(entries[0].role).toBe('assistant');
      expect(entries[0].content).toBe('Hello! How can I help?');
    });
  });

  describe('logSystemEvent', () => {
    it('should log system event', () => {
      const sessionId = 'test-system-1';
      logSystemEvent(sessionId, 'session_start', { source: 'line' });
      closeAllStreams();

      const entries = readSessionLog(sessionId);
      expect(entries[0].type).toBe(EntryType.SYSTEM);
      expect(entries[0].content).toBe('session_start');
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', () => {
      const sessionId = 'test-error-1';
      const error = new Error('Test error');
      logError(sessionId, error, { context: 'test' });
      closeAllStreams();

      const entries = readSessionLog(sessionId);
      expect(entries[0].type).toBe(EntryType.ERROR);
      expect(entries[0].content).toBe('Test error');
      expect(entries[0].metadata.stack).toBeDefined();
    });
  });

  describe('readSessionLog', () => {
    it('should return empty array for non-existent session', () => {
      const entries = readSessionLog('non-existent');
      expect(entries).toEqual([]);
    });

    it('should support limit option', () => {
      const sessionId = 'test-limit';
      logUserMessage(sessionId, 'Message 1');
      logUserMessage(sessionId, 'Message 2');
      logUserMessage(sessionId, 'Message 3');
      closeAllStreams();

      const entries = readSessionLog(sessionId, { limit: 2 });
      expect(entries.length).toBe(2);
    });
  });

  describe('getSessionStats', () => {
    it('should return correct statistics', () => {
      const sessionId = 'test-stats';
      logUserMessage(sessionId, 'User message');
      logAssistantMessage(sessionId, 'Assistant message');
      logError(sessionId, 'An error');
      closeAllStreams();

      const stats = getSessionStats(sessionId);
      expect(stats.totalEntries).toBe(3);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(1);
      expect(stats.errors).toBe(1);
    });
  });

  describe('listSessionLogs', () => {
    it('should list all sessions', () => {
      logUserMessage('session-a', 'Hello');
      logUserMessage('session-b', 'World');
      closeAllStreams();

      const sessions = listSessionLogs();
      expect(sessions).toContain('session-a');
      expect(sessions).toContain('session-b');
    });
  });
});
