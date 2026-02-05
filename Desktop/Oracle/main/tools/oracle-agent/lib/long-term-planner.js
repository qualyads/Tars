/**
 * Long-term Planning System for Oracle Agent
 * Breaks down goals into actionable tasks and tracks progress
 *
 * Features:
 * - Goal decomposition into milestones
 * - Weekly/monthly planning
 * - Progress tracking
 * - Priority-based task scheduling
 */

import { query, getPool } from './db-postgres.js';

// Planning horizons
const HORIZONS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90
};

/**
 * Create a new plan from a goal
 */
export async function createPlan(goal, userId = 'tars') {
  const pool = getPool();
  if (!pool) return null;

  try {
    // Save the plan
    const result = await query(`
      INSERT INTO episodic_memory (user_id, content, memory_type, importance, context)
      VALUES ($1, $2, 'plan', 0.9, $3)
      RETURNING id
    `, [userId, goal.title, JSON.stringify({
      description: goal.description,
      milestones: goal.milestones || [],
      deadline: goal.deadline,
      status: 'active',
      progress: 0,
      createdAt: new Date().toISOString()
    })]);

    return { id: result.rows[0].id, ...goal };
  } catch (error) {
    console.error('[Planner] Error creating plan:', error);
    return null;
  }
}

/**
 * Get all active plans
 */
export async function getActivePlans(userId = 'tars') {
  const pool = getPool();
  if (!pool) return [];

  try {
    const result = await query(`
      SELECT id, content as title, context, importance, created_at
      FROM episodic_memory
      WHERE user_id = $1
        AND memory_type = 'plan'
        AND (context->>'status' = 'active' OR context->>'status' IS NULL)
      ORDER BY importance DESC, created_at DESC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      ...row.context,
      importance: row.importance,
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('[Planner] Error getting plans:', error);
    return [];
  }
}

/**
 * Update plan progress
 */
export async function updatePlanProgress(planId, progress, notes = '') {
  const pool = getPool();
  if (!pool) return false;

  try {
    await query(`
      UPDATE episodic_memory
      SET context = context || $2::jsonb,
          last_accessed = NOW()
      WHERE id = $1
    `, [planId, JSON.stringify({
      progress,
      lastUpdate: new Date().toISOString(),
      notes
    })]);

    return true;
  } catch (error) {
    console.error('[Planner] Error updating progress:', error);
    return false;
  }
}

/**
 * Generate weekly plan from active goals
 */
export async function generateWeeklyPlan(userId = 'tars') {
  const pool = getPool();
  if (!pool) return null;

  try {
    // Get high-priority goals
    const goalsResult = await query(`
      SELECT id, content, context, importance
      FROM episodic_memory
      WHERE user_id = $1
        AND memory_type IN ('goal', 'decision', 'plan')
        AND importance >= 0.7
      ORDER BY importance DESC
      LIMIT 10
    `, [userId]);

    const goals = goalsResult.rows;
    
    // Generate suggested tasks for the week
    const weeklyTasks = goals.map((g, i) => ({
      priority: i + 1,
      goal: g.content.substring(0, 100),
      importance: g.importance,
      suggestedDays: Math.ceil(g.importance * 3), // 1-3 days based on importance
      status: 'pending'
    }));

    const weekPlan = {
      weekStart: getWeekStart(),
      weekEnd: getWeekEnd(),
      totalGoals: goals.length,
      tasks: weeklyTasks,
      focusAreas: extractFocusAreas(goals)
    };

    return weekPlan;
  } catch (error) {
    console.error('[Planner] Error generating weekly plan:', error);
    return null;
  }
}

/**
 * Get tasks for today based on plans
 */
export async function getTodaysTasks(userId = 'tars') {
  const pool = getPool();
  if (!pool) return [];

  try {
    // Get high-priority items
    const result = await query(`
      SELECT id, content, context, importance, memory_type
      FROM episodic_memory
      WHERE user_id = $1
        AND memory_type IN ('goal', 'decision', 'plan')
        AND importance >= 0.8
      ORDER BY importance DESC
      LIMIT 5
    `, [userId]);

    return result.rows.map((row, i) => ({
      rank: i + 1,
      task: row.content.substring(0, 150),
      type: row.memory_type,
      importance: row.importance,
      context: row.context
    }));
  } catch (error) {
    console.error('[Planner] Error getting today tasks:', error);
    return [];
  }
}

/**
 * Check for overdue goals
 */
export async function getOverdueGoals(userId = 'tars') {
  const pool = getPool();
  if (!pool) return [];

  try {
    const result = await query(`
      SELECT id, content, context, importance, created_at
      FROM episodic_memory
      WHERE user_id = $1
        AND memory_type IN ('goal', 'plan')
        AND context->>'deadline' IS NOT NULL
        AND (context->>'deadline')::date < CURRENT_DATE
        AND (context->>'status' IS NULL OR context->>'status' = 'active')
      ORDER BY importance DESC
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error('[Planner] Error getting overdue:', error);
    return [];
  }
}

/**
 * Generate planning report
 */
export async function generatePlanningReport(userId = 'tars') {
  const plans = await getActivePlans(userId);
  const todayTasks = await getTodaysTasks(userId);
  const overdue = await getOverdueGoals(userId);
  const weeklyPlan = await generateWeeklyPlan(userId);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      activePlans: plans.length,
      todayTasks: todayTasks.length,
      overdueGoals: overdue.length
    },
    plans,
    todayTasks,
    overdueGoals: overdue,
    weeklyPlan
  };
}

// Helper functions
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

function getWeekEnd() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? 0 : 7);
  return new Date(now.setDate(diff)).toISOString().split('T')[0];
}

function extractFocusAreas(goals) {
  const areas = new Map();
  
  goals.forEach(g => {
    const content = g.content.toLowerCase();
    
    if (content.includes('api') || content.includes('integration')) {
      areas.set('API Integration', (areas.get('API Integration') || 0) + 1);
    }
    if (content.includes('revenue') || content.includes('money') || content.includes('saas')) {
      areas.set('Revenue', (areas.get('Revenue') || 0) + 1);
    }
    if (content.includes('hotel') || content.includes('booking')) {
      areas.set('Hotel Operations', (areas.get('Hotel Operations') || 0) + 1);
    }
    if (content.includes('automat')) {
      areas.set('Automation', (areas.get('Automation') || 0) + 1);
    }
  });

  return Array.from(areas.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => ({ area, goalCount: count }));
}

export default {
  createPlan,
  getActivePlans,
  updatePlanProgress,
  generateWeeklyPlan,
  getTodaysTasks,
  getOverdueGoals,
  generatePlanningReport
};
