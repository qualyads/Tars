/**
 * Goal Tracker System for Oracle Agent
 * Tracks goals from Supabase and triggers reminders/actions
 *
 * Features:
 * - Fetches active goals from episodic_memory (type: decision, goal)
 * - Checks for overdue or upcoming goals
 * - Triggers proactive reminders
 * - Executes autonomous actions when possible
 */

import { query, getPool, isVectorEnabled } from './db-postgres.js';
import { generateEmbedding } from './embedding.js';

// Goal categories and their priority multipliers
const GOAL_CATEGORIES = {
  api_integration: 1.5,  // API goals are high priority
  revenue: 1.5,
  automation: 1.3,
  learning: 1.0,
  maintenance: 0.8
};

/**
 * Get all active goals from Supabase
 */
export async function getActiveGoals(userId = 'tars') {
  const pool = getPool();
  if (!pool) {
    console.log('[GoalTracker] No database connection');
    return [];
  }

  try {
    const result = await query(`
      SELECT id, content, context, memory_type, importance, created_at
      FROM episodic_memory
      WHERE user_id = $1
        AND memory_type IN ('decision', 'goal', 'commitment')
        AND importance >= 0.7
      ORDER BY importance DESC, created_at DESC
      LIMIT 20
    `, [userId]);

    return result.rows.map(row => ({
      ...row,
      category: detectCategory(row.content),
      priority: calculatePriority(row)
    }));
  } catch (error) {
    console.error('[GoalTracker] Error fetching goals:', error);
    return [];
  }
}

/**
 * Get pending API integration goals
 */
export async function getPendingApiGoals(userId = 'tars') {
  const pool = getPool();
  if (!pool) return [];

  try {
    // Search for API-related goals
    const result = await query(`
      SELECT id, content, context, importance, created_at
      FROM episodic_memory
      WHERE user_id = $1
        AND (
          content ILIKE '%api%' OR
          content ILIKE '%google%' OR
          content ILIKE '%shopify%' OR
          content ILIKE '%lazada%' OR
          content ILIKE '%shopee%' OR
          content ILIKE '%integration%'
        )
        AND importance >= 0.8
      ORDER BY importance DESC
      LIMIT 10
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error('[GoalTracker] Error fetching API goals:', error);
    return [];
  }
}

/**
 * Get goals that need reminder (haven't been worked on recently)
 */
export async function getStaleGoals(userId = 'tars', daysStale = 7) {
  const pool = getPool();
  if (!pool) return [];

  try {
    const result = await query(`
      SELECT id, content, context, importance, created_at, last_accessed
      FROM episodic_memory
      WHERE user_id = $1
        AND memory_type IN ('decision', 'goal')
        AND importance >= 0.8
        AND last_accessed < NOW() - INTERVAL '${daysStale} days'
      ORDER BY importance DESC
      LIMIT 5
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error('[GoalTracker] Error fetching stale goals:', error);
    return [];
  }
}

/**
 * Search goals by semantic similarity
 */
export async function searchGoalsByContext(context, userId = 'tars', limit = 5) {
  const pool = getPool();
  if (!pool || !isVectorEnabled()) return [];

  try {
    const embedding = await generateEmbedding(context);
    if (!embedding) return [];

    const result = await query(`
      SELECT id, content, context, importance,
             1 - (embedding <=> $1::vector) as similarity
      FROM episodic_memory
      WHERE user_id = $2
        AND memory_type IN ('decision', 'goal', 'commitment')
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `, [`[${embedding.join(',')}]`, userId, limit]);

    return result.rows.filter(r => r.similarity > 0.3);
  } catch (error) {
    console.error('[GoalTracker] Error searching goals:', error);
    return [];
  }
}

/**
 * Mark goal as accessed (to prevent spam reminders)
 */
export async function touchGoal(goalId) {
  const pool = getPool();
  if (!pool) return;

  try {
    await query(`
      UPDATE episodic_memory
      SET last_accessed = NOW()
      WHERE id = $1
    `, [goalId]);
  } catch (error) {
    console.error('[GoalTracker] Error touching goal:', error);
  }
}

/**
 * Add progress update to a goal
 */
export async function updateGoalProgress(goalId, progress) {
  const pool = getPool();
  if (!pool) return;

  try {
    await query(`
      UPDATE episodic_memory
      SET context = context || $2::jsonb,
          last_accessed = NOW()
      WHERE id = $1
    `, [goalId, JSON.stringify({ progress, updatedAt: new Date().toISOString() })]);
  } catch (error) {
    console.error('[GoalTracker] Error updating goal progress:', error);
  }
}

/**
 * Detect category from goal content
 */
function detectCategory(content) {
  const lower = content.toLowerCase();

  if (lower.includes('api') || lower.includes('integration') || lower.includes('google') ||
      lower.includes('shopify') || lower.includes('lazada') || lower.includes('shopee')) {
    return 'api_integration';
  }
  if (lower.includes('revenue') || lower.includes('money') || lower.includes('passive') ||
      lower.includes('saas') || lower.includes('รายได้')) {
    return 'revenue';
  }
  if (lower.includes('automat') || lower.includes('auto-') || lower.includes('schedule')) {
    return 'automation';
  }
  if (lower.includes('learn') || lower.includes('study') || lower.includes('เรียน')) {
    return 'learning';
  }

  return 'maintenance';
}

/**
 * Calculate priority score
 */
function calculatePriority(goal) {
  const category = detectCategory(goal.content);
  const categoryMultiplier = GOAL_CATEGORIES[category] || 1.0;

  // Base priority from importance
  let priority = (goal.importance || 0.5) * 10;

  // Apply category multiplier
  priority *= categoryMultiplier;

  // Boost for older goals (they've been waiting)
  const ageInDays = (Date.now() - new Date(goal.created_at)) / (1000 * 60 * 60 * 24);
  if (ageInDays > 7) {
    priority *= 1.1;
  }
  if (ageInDays > 30) {
    priority *= 1.2;
  }

  return Math.round(priority * 10) / 10;
}

/**
 * Generate goal reminder message
 */
export function formatGoalReminder(goals) {
  if (!goals || goals.length === 0) return null;

  const lines = ['🎯 **Goal Reminder**\n'];

  goals.forEach((goal, i) => {
    const emoji = goal.category === 'api_integration' ? '🔌' :
                  goal.category === 'revenue' ? '💰' :
                  goal.category === 'automation' ? '⚙️' : '📌';

    lines.push(`${i + 1}. ${emoji} ${goal.content.substring(0, 150)}...`);
    lines.push(`   Priority: ${goal.priority} | Importance: ${goal.importance}`);
    lines.push('');
  });

  lines.push('\n💡 พิจารณาทำงานเหล่านี้วันนี้');

  return lines.join('\n');
}

/**
 * Run goal check (called by heartbeat)
 */
export async function runGoalCheck(userId = 'tars') {
  console.log('[GoalTracker] Running goal check...');

  const result = {
    activeGoals: 0,
    apiGoals: 0,
    staleGoals: 0,
    reminder: null,
    topGoals: []
  };

  try {
    // Get active goals
    const activeGoals = await getActiveGoals(userId);
    result.activeGoals = activeGoals.length;
    result.topGoals = activeGoals.slice(0, 3);

    // Get API integration goals specifically
    const apiGoals = await getPendingApiGoals(userId);
    result.apiGoals = apiGoals.length;

    // Get stale goals (need reminder)
    const staleGoals = await getStaleGoals(userId, 7);
    result.staleGoals = staleGoals.length;

    // Generate reminder if there are stale high-priority goals
    if (staleGoals.length > 0) {
      result.reminder = formatGoalReminder(staleGoals);
    }

    console.log(`[GoalTracker] Found: ${result.activeGoals} active, ${result.apiGoals} API, ${result.staleGoals} stale`);
  } catch (error) {
    console.error('[GoalTracker] Error in goal check:', error);
  }

  return result;
}

export default {
  getActiveGoals,
  getPendingApiGoals,
  getStaleGoals,
  searchGoalsByContext,
  touchGoal,
  updateGoalProgress,
  formatGoalReminder,
  runGoalCheck
};
