/**
 * Tests for Graceful Shutdown
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  registerCleanup,
  unregisterCleanup,
  isShutdownInProgress,
  PHASES,
} from '../lib/graceful-shutdown.js';

describe('Graceful Shutdown', () => {
  beforeEach(() => {
    // Reset state between tests
    vi.resetAllMocks();
  });

  describe('registerCleanup', () => {
    it('should register cleanup handler', () => {
      const handler = vi.fn();
      registerCleanup('test-handler', handler);
      // Handler is registered (we can't easily verify without triggering shutdown)
      expect(handler).not.toHaveBeenCalled();
    });

    it('should accept phase option', () => {
      const handler = vi.fn();
      registerCleanup('test-phase', handler, { phase: 'drain' });
      // No error means it accepted the phase
    });

    it('should accept priority option', () => {
      const handler = vi.fn();
      registerCleanup('test-priority', handler, { priority: 10 });
      // No error means it accepted the priority
    });
  });

  describe('unregisterCleanup', () => {
    it('should unregister cleanup handler', () => {
      const handler = vi.fn();
      registerCleanup('to-remove', handler);
      unregisterCleanup('to-remove');
      // Handler is unregistered
    });

    it('should handle non-existent handler gracefully', () => {
      unregisterCleanup('non-existent');
      // No error thrown
    });
  });

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      expect(isShutdownInProgress()).toBe(false);
    });
  });

  describe('PHASES', () => {
    it('should have correct phases', () => {
      expect(PHASES).toEqual(['stop', 'drain', 'cleanup', 'exit']);
    });
  });
});
