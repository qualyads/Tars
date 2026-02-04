/**
 * Tests for Prompt Loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  initPromptLoader,
  setVersion,
  getVersion,
  listVersions,
  loadPrompt,
  renderPrompt,
  composePrompts,
  savePrompt,
  listPrompts,
  createVersion,
  clearCache,
} from '../lib/prompt-loader.js';

const TEST_DIR = path.join(os.tmpdir(), 'oracle-test-prompts');

describe('Prompt Loader', () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(path.join(TEST_DIR, 'v1.0'), { recursive: true });

    // Create test prompts
    fs.writeFileSync(
      path.join(TEST_DIR, 'v1.0', 'greeting.md'),
      'Hello {{name}}! Welcome to {{service}}.'
    );
    fs.writeFileSync(
      path.join(TEST_DIR, 'v1.0', 'farewell.md'),
      'Goodbye {{name}}!'
    );

    initPromptLoader({ dir: TEST_DIR, version: 'v1.0' });
  });

  afterEach(() => {
    clearCache();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('loadPrompt', () => {
    it('should load prompt from file', () => {
      const content = loadPrompt('greeting');
      expect(content).toContain('Hello {{name}}');
    });

    it('should return null for non-existent prompt', () => {
      const content = loadPrompt('non-existent');
      expect(content).toBeNull();
    });

    it('should cache loaded prompts', () => {
      loadPrompt('greeting');
      // Modify file
      fs.writeFileSync(
        path.join(TEST_DIR, 'v1.0', 'greeting.md'),
        'Modified content'
      );
      // Should still return cached content
      const content = loadPrompt('greeting');
      expect(content).toContain('Hello {{name}}');
    });
  });

  describe('renderPrompt', () => {
    it('should substitute variables', () => {
      const rendered = renderPrompt('greeting', {
        name: 'Tars',
        service: 'Oracle',
      });
      expect(rendered).toBe('Hello Tars! Welcome to Oracle.');
    });

    it('should handle missing variables gracefully', () => {
      const rendered = renderPrompt('greeting', { name: 'Tars' });
      expect(rendered).toContain('{{service}}');
    });
  });

  describe('composePrompts', () => {
    it('should combine multiple prompts', () => {
      const composed = composePrompts(['greeting', 'farewell'], { name: 'Tars' });
      expect(composed).toContain('Hello Tars!');
      expect(composed).toContain('Goodbye Tars!');
    });
  });

  describe('version management', () => {
    it('should get current version', () => {
      expect(getVersion()).toBe('v1.0');
    });

    it('should list available versions', () => {
      const versions = listVersions();
      expect(versions).toContain('v1.0');
    });

    it('should create new version from existing', () => {
      createVersion('v2.0', 'v1.0');
      const versions = listVersions();
      expect(versions).toContain('v2.0');

      // New version should have same prompts
      setVersion('v2.0');
      const prompts = listPrompts();
      expect(prompts).toContain('greeting');
    });
  });

  describe('savePrompt', () => {
    it('should save new prompt', () => {
      savePrompt('custom', 'Custom content here');
      clearCache();
      const content = loadPrompt('custom');
      expect(content).toBe('Custom content here');
    });
  });

  describe('listPrompts', () => {
    it('should list all prompts in version', () => {
      const prompts = listPrompts();
      expect(prompts).toContain('greeting');
      expect(prompts).toContain('farewell');
    });
  });
});
