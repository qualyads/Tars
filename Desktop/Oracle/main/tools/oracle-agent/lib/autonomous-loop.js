/**
 * Autonomous Loop System
 * Oracle คิดเอง ทำเอง โดยไม่ต้องรอคำสั่ง
 *
 * Features:
 * - Thinking Loop: คิด idea/research ทุก 30 นาที
 * - Memory Reader: อ่าน ψ/memory 100% ก่อนคิด
 * - Task Queue: เก็บงานที่ต้องทำ
 * - LINE Reporter: แจ้งผลเมื่อทำเสร็จ
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const config = require('../config.json');

// Import modules
import claude from './claude.js';
import line from './line.js';

// =============================================================================
// MEMORY PATHS
// =============================================================================

const MEMORY_BASE = '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/memory';
const TASK_QUEUE_FILE = path.join(__dirname, '../data/task-queue.json');
const THINKING_LOG_FILE = path.join(__dirname, '../data/thinking-log.json');

// =============================================================================
// MEMORY READER - อ่าน ψ/memory 100%
// =============================================================================

/**
 * Read all memory files and build context
 */
async function readAllMemory() {
  const memories = {
    core: null,
    knowledge: [],
    goals: null,
    logs: [],
    skills: []
  };

  try {
    // 1. Core memory
    const corePath = path.join(MEMORY_BASE, 'core.md');
    if (fs.existsSync(corePath)) {
      memories.core = fs.readFileSync(corePath, 'utf8');
    }

    // 2. Goals
    const goalsPath = path.join(MEMORY_BASE, 'goals.md');
    if (fs.existsSync(goalsPath)) {
      memories.goals = fs.readFileSync(goalsPath, 'utf8');
    }

    // 3. Knowledge files
    const knowledgeDir = path.join(MEMORY_BASE, 'knowledge');
    if (fs.existsSync(knowledgeDir)) {
      const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
      for (const file of files.slice(0, 20)) { // Limit to 20 files
        const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf8');
        memories.knowledge.push({ file, content: content.slice(0, 2000) }); // Truncate
      }
    }

    // 4. Recent logs (last 3)
    const logsDir = path.join(MEMORY_BASE, 'logs');
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 3);
      for (const file of files) {
        const content = fs.readFileSync(path.join(logsDir, file), 'utf8');
        memories.logs.push({ file, content: content.slice(0, 1500) });
      }
    }

    // 5. Skills
    const skillsDir = '/Users/tanakitchaithip/Desktop/Oracle/main/ψ/skills';
    if (fs.existsSync(skillsDir)) {
      const indexPath = path.join(skillsDir, '_index.md');
      if (fs.existsSync(indexPath)) {
        memories.skills.push({ file: '_index.md', content: fs.readFileSync(indexPath, 'utf8') });
      }
    }

  } catch (err) {
    console.error('[AUTONOMOUS] Memory read error:', err.message);
  }

  return memories;
}

/**
 * Build context string from memories
 */
function buildMemoryContext(memories) {
  let context = '';

  if (memories.core) {
    context += `## Core Memory:\n${memories.core.slice(0, 2000)}\n\n`;
  }

  if (memories.goals) {
    context += `## Goals:\n${memories.goals}\n\n`;
  }

  if (memories.knowledge.length > 0) {
    context += `## Knowledge (${memories.knowledge.length} files):\n`;
    for (const k of memories.knowledge.slice(0, 10)) {
      context += `### ${k.file}:\n${k.content.slice(0, 500)}\n\n`;
    }
  }

  if (memories.logs.length > 0) {
    context += `## Recent Logs:\n`;
    for (const log of memories.logs) {
      context += `### ${log.file}:\n${log.content.slice(0, 500)}\n\n`;
    }
  }

  return context;
}

// =============================================================================
// TASK QUEUE - เก็บงานที่ต้องทำ
// =============================================================================

/**
 * Load task queue
 */
function loadTaskQueue() {
  try {
    if (fs.existsSync(TASK_QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(TASK_QUEUE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[AUTONOMOUS] Task queue load error:', err.message);
  }
  return { tasks: [], completed: [] };
}

/**
 * Save task queue
 */
function saveTaskQueue(queue) {
  try {
    const dir = path.dirname(TASK_QUEUE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TASK_QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (err) {
    console.error('[AUTONOMOUS] Task queue save error:', err.message);
  }
}

/**
 * Add task to queue
 */
function addTask(task) {
  const queue = loadTaskQueue();
  const newTask = {
    id: `task_${Date.now()}`,
    ...task,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  queue.tasks.push(newTask);
  saveTaskQueue(queue);
  console.log('[AUTONOMOUS] Task added:', newTask.id, task.title);
  return newTask;
}

/**
 * Get pending tasks
 */
function getPendingTasks() {
  const queue = loadTaskQueue();
  return queue.tasks.filter(t => t.status === 'pending');
}

/**
 * Complete task
 */
function completeTask(taskId, result) {
  const queue = loadTaskQueue();
  const task = queue.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = result;
    queue.completed.push(task);
    queue.tasks = queue.tasks.filter(t => t.id !== taskId);
    saveTaskQueue(queue);
    console.log('[AUTONOMOUS] Task completed:', taskId);
  }
  return task;
}

// =============================================================================
// THINKING LOOP - คิด idea/research ทุก interval
// =============================================================================

/**
 * Save thinking result
 */
function saveThinkingLog(thought) {
  try {
    let logs = [];
    if (fs.existsSync(THINKING_LOG_FILE)) {
      logs = JSON.parse(fs.readFileSync(THINKING_LOG_FILE, 'utf8'));
    }
    logs.unshift(thought);
    logs = logs.slice(0, 100); // Keep last 100

    const dir = path.dirname(THINKING_LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(THINKING_LOG_FILE, JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('[AUTONOMOUS] Thinking log save error:', err.message);
  }
}

/**
 * Generate autonomous thought/idea
 */
async function generateThought() {
  console.log('[AUTONOMOUS] Generating thought...');

  // 1. Read all memory
  const memories = await readAllMemory();
  const memoryContext = buildMemoryContext(memories);

  // 2. Build prompt for thinking
  const thinkingPrompt = `คุณคือ Oracle Agent - Digital Partner ของ Tars

## หน้าที่ตอนนี้: คิดเอง!
คุณกำลังอยู่ใน "Thinking Loop" - คิด idea หรือ insight ใหม่ๆ โดยไม่มีใครถาม

## Memory ของคุณ:
${memoryContext.slice(0, 8000)}

## สิ่งที่ต้องทำ:
1. วิเคราะห์ข้อมูลที่มี
2. คิด 1 idea/insight ที่เป็นประโยชน์กับ Tars
3. ต้องเป็นสิ่งที่ actionable - ทำได้จริง

## Format การตอบ:
{
  "type": "business_idea" | "opportunity" | "insight" | "reminder" | "research_needed",
  "title": "หัวข้อสั้นๆ",
  "detail": "รายละเอียด 2-3 ประโยค",
  "action": "สิ่งที่ Tars ควรทำ",
  "priority": "high" | "medium" | "low",
  "notify": true | false (ควรแจ้ง LINE ไหม)
}

ตอบเป็น JSON เท่านั้น!`;

  try {
    const response = await claude.chat([
      { role: 'user', content: thinkingPrompt }
    ], {
      model: config.claude?.model || 'claude-sonnet-4-20250514',
      max_tokens: 1000
    });

    // Parse response
    const text = response.content?.[0]?.text || response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const thought = JSON.parse(jsonMatch[0]);
      thought.generatedAt = new Date().toISOString();

      // Save to log
      saveThinkingLog(thought);

      console.log('[AUTONOMOUS] Thought generated:', thought.title);

      return thought;
    }
  } catch (err) {
    console.error('[AUTONOMOUS] Thinking error:', err.message);
  }

  return null;
}

/**
 * Notify Tars via LINE about a thought
 */
async function notifyThought(thought) {
  if (!thought || !thought.notify) return;

  const priorityEmoji = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  }[thought.priority] || '💡';

  const typeEmoji = {
    business_idea: '💡',
    opportunity: '🎯',
    insight: '🧠',
    reminder: '🔔',
    research_needed: '🔍'
  }[thought.type] || '💭';

  const message = `${typeEmoji} **Oracle คิดเอง:**

${priorityEmoji} **${thought.title}**

${thought.detail}

💪 **Action:** ${thought.action}`;

  try {
    if (config.line?.owner_id) {
      await line.pushMessage(config.line.owner_id, message);
      console.log('[AUTONOMOUS] Thought sent to LINE');
    }
  } catch (err) {
    console.error('[AUTONOMOUS] LINE notify error:', err.message);
  }
}

// =============================================================================
// MAIN LOOP
// =============================================================================

let loopInterval = null;
let isThinking = false;

/**
 * Run one thinking cycle
 */
async function runThinkingCycle() {
  if (isThinking) {
    console.log('[AUTONOMOUS] Already thinking, skip...');
    return;
  }

  isThinking = true;
  console.log('[AUTONOMOUS] === Starting thinking cycle ===');

  try {
    // 1. Generate thought
    const thought = await generateThought();

    // 2. Notify if needed
    if (thought && thought.notify && thought.priority !== 'low') {
      await notifyThought(thought);
    }

    // 3. Check if thought suggests a task
    if (thought && thought.type === 'research_needed') {
      addTask({
        title: thought.title,
        description: thought.detail,
        action: thought.action,
        priority: thought.priority,
        source: 'autonomous_thinking'
      });
    }

  } catch (err) {
    console.error('[AUTONOMOUS] Cycle error:', err.message);
  }

  isThinking = false;
  console.log('[AUTONOMOUS] === Thinking cycle complete ===');
}

/**
 * Start autonomous loop
 */
function startLoop(intervalMinutes = 30) {
  console.log(`[AUTONOMOUS] Starting loop (every ${intervalMinutes} minutes)`);

  // Run immediately
  runThinkingCycle();

  // Then run on interval
  loopInterval = setInterval(() => {
    runThinkingCycle();
  }, intervalMinutes * 60 * 1000);

  return true;
}

/**
 * Stop autonomous loop
 */
function stopLoop() {
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    console.log('[AUTONOMOUS] Loop stopped');
  }
}

/**
 * Get status
 */
function getStatus() {
  const queue = loadTaskQueue();
  let recentThoughts = [];

  try {
    if (fs.existsSync(THINKING_LOG_FILE)) {
      recentThoughts = JSON.parse(fs.readFileSync(THINKING_LOG_FILE, 'utf8')).slice(0, 5);
    }
  } catch (e) {}

  return {
    loopRunning: loopInterval !== null,
    isThinking,
    pendingTasks: queue.tasks.length,
    completedTasks: queue.completed.length,
    recentThoughts
  };
}

export default {
  // Memory
  readAllMemory,
  buildMemoryContext,

  // Task Queue
  loadTaskQueue,
  addTask,
  getPendingTasks,
  completeTask,

  // Thinking
  generateThought,
  notifyThought,
  runThinkingCycle,

  // Loop Control
  startLoop,
  stopLoop,
  getStatus
};
