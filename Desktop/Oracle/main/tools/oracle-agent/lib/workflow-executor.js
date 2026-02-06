/**
 * Workflow Executor v7.0
 * รัน Claude foreground + background paste commands
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const ORACLE_URL = process.env.ORACLE_URL || 'https://oracle-agent-production-546e.up.railway.app';
const WORK_DIR = '/Users/tanakitchaithip/Desktop/Oracle';
const SCRIPTS_DIR = '/tmp/oracle-workflows';

function generateWorkflowScript(workflow) {
  const { id, projectName, projectPath, prompt, model = 'opus', deploy = true, notifyLine = true } = workflow;

  const escapedPrompt = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');

  const script = `#!/bin/bash
# Oracle Workflow v8.0 - Direct prompt injection
# ID: ${id}

clear
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🤖 Oracle Workflow - ${projectName}"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Notify Oracle
curl -s -X POST "${ORACLE_URL}/api/workflow/status" -H "Content-Type: application/json" -d '{"id":"${id}","status":"started"}' > /dev/null 2>&1

# Step 1: Create project
echo "━━━ Step 1: Creating project directory ━━━"
mkdir -p "${projectPath}"
echo "✓ Created: ${projectPath}"
echo ""

# Step 2: Launch Claude with initial prompt
echo "━━━ Step 2: Launching Claude Code (${model}) ━━━"
echo "📍 Working dir: ${WORK_DIR}"
echo "📝 Project: ${projectPath}"
echo "📋 Task: ${escapedPrompt}"
echo ""

cd "${WORK_DIR}"

echo "🚀 Starting Claude Code with initial prompt..."
echo ""

# Run Claude in interactive mode with initial prompt using heredoc
# The prompt argument starts the session with this message
claude --model ${model} --dangerously-skip-permissions "\$(cat <<'PROMPT'
load memory

หลังจาก load memory แล้ว ให้ทำ task นี้:
สร้างโปรเจคที่ ${projectPath}

${escapedPrompt}
PROMPT
)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Claude session ended"
echo ""

# Check if files were created
echo "━━━ Checking results ━━━"
if [ -z "\$(ls -A ${projectPath} 2>/dev/null)" ]; then
    echo "⚠️ No files in project directory"
    FILES_CREATED="false"
else
    echo "✅ Files created:"
    ls -la "${projectPath}"
    FILES_CREATED="true"
fi

${deploy ? `
if [ "\$FILES_CREATED" = "true" ]; then
    echo ""
    echo "━━━ Step 3: Deploying to Railway ━━━"
    cd "${projectPath}"

    curl -s -X POST "${ORACLE_URL}/api/workflow/status" -H "Content-Type: application/json" -d '{"id":"${id}","status":"deploying"}' > /dev/null 2>&1

    if [ ! -f "railway.json" ]; then
        echo "Initializing Railway..."
        railway init --name "${projectName}"
    fi

    echo "Deploying..."
    railway up

    RAILWAY_URL=\$(railway status 2>/dev/null | grep -oE 'https://[^ ]+' | head -1)
    if [ -z "\$RAILWAY_URL" ]; then
        RAILWAY_URL="https://${projectName}.up.railway.app"
    fi
    echo "✅ URL: \$RAILWAY_URL"
else
    RAILWAY_URL=""
    echo "⏭️ Skipping deploy (no files)"
fi
` : `
RAILWAY_URL=""
echo "⏭️ Skipping deployment"
`}

# Notify completion
echo ""
echo "━━━ Notifying Oracle ━━━"
${notifyLine ? `
curl -s -X POST "${ORACLE_URL}/api/workflow/complete" -H "Content-Type: application/json" -d '{"id":"${id}","status":"completed","projectName":"${projectName}","projectPath":"${projectPath}","url":"'\$RAILWAY_URL'","notifyLine":true}'
echo "✓ LINE notified"
` : `
curl -s -X POST "${ORACLE_URL}/api/workflow/complete" -H "Content-Type: application/json" -d '{"id":"${id}","status":"completed"}' > /dev/null 2>&1
`}

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Workflow Completed!                                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
${deploy ? 'echo "🔗 URL: $RAILWAY_URL"' : ''}
echo ""
echo "Press Enter to close..."
read
`;

  return script;
}

function createWorkflowScript(workflow) {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
  const scriptPath = path.join(SCRIPTS_DIR, `workflow-${workflow.id}.sh`);
  fs.writeFileSync(scriptPath, generateWorkflowScript(workflow), { mode: 0o755 });
  return scriptPath;
}

function openTerminalWithWorkflow(scriptPath, callback) {
  // Use Warp terminal instead of Terminal.app for better automation support
  exec(`open -a Warp "${scriptPath}"`, (error) => {
    if (error) {
      // Fallback to Terminal if Warp not available
      console.log('[Workflow] Warp not found, trying Terminal...');
      exec(`open -a Terminal "${scriptPath}"`, (error2) => {
        if (error2) {
          console.error('[Workflow] Error:', error2);
          callback?.(error2);
          return;
        }
        console.log('[Workflow] Terminal opened');
        callback?.(null, { success: true, scriptPath });
      });
      return;
    }
    console.log('[Workflow] Warp opened');
    callback?.(null, { success: true, scriptPath });
  });
}

function executeWorkflow(options) {
  const { projectName, prompt, model = 'opus', deploy = true, notifyLine = true, projectPath = null } = options;

  const id = uuidv4().substring(0, 8);
  const finalProjectPath = projectPath || `/Users/tanakitchaithip/Desktop/projects/${projectName}`;

  const workflow = { id, projectName, projectPath: finalProjectPath, prompt, model, deploy, notifyLine };
  const scriptPath = createWorkflowScript(workflow);

  console.log(`[Workflow] Created: ${scriptPath}`);
  openTerminalWithWorkflow(scriptPath);

  return { success: true, workflowId: id, scriptPath, message: 'Workflow started!' };
}

function listWorkflows() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  return fs.readdirSync(SCRIPTS_DIR).filter(f => f.startsWith('workflow-')).map(f => ({
    id: f.replace('workflow-', '').replace(/\.(sh|exp)$/, ''),
    scriptPath: path.join(SCRIPTS_DIR, f)
  }));
}

function cleanupWorkflows(maxAgeHours = 24) {
  if (!fs.existsSync(SCRIPTS_DIR)) return 0;
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let cleaned = 0;
  for (const f of fs.readdirSync(SCRIPTS_DIR)) {
    const p = path.join(SCRIPTS_DIR, f);
    if (Date.now() - fs.statSync(p).mtimeMs > maxAge) { fs.unlinkSync(p); cleaned++; }
  }
  return cleaned;
}

export default { executeWorkflow, createWorkflowScript, openTerminalWithWorkflow, listWorkflows, cleanupWorkflows, SCRIPTS_DIR };
