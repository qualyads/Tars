/**
 * Workflow Executor
 * เปิด Terminal.app รัน Claude Code + Deploy Railway
 *
 * @version 1.0.0
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// CONFIGURATION
// =============================================================================

const ORACLE_URL = process.env.ORACLE_URL || 'https://oracle-agent-production-546e.up.railway.app';
const WORK_DIR = process.env.WORK_DIR || '/Users/tanakitchaithip/Desktop/Oracle';
const SCRIPTS_DIR = '/tmp/oracle-workflows';

// =============================================================================
// WORKFLOW TEMPLATES
// =============================================================================

/**
 * Generate workflow script
 */
function generateWorkflowScript(workflow) {
  const {
    id,
    projectName,
    projectPath,
    prompt,
    model = 'opus',
    deploy = true,
    notifyLine = true
  } = workflow;

  const script = `#!/bin/bash
# ============================================
# Oracle Workflow Script
# ID: ${id}
# Project: ${projectName}
# ============================================

set -e  # Exit on error

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

echo ""
echo -e "\${BLUE}╔════════════════════════════════════════════╗\${NC}"
echo -e "\${BLUE}║  🤖 Oracle Workflow - ${projectName}\${NC}"
echo -e "\${BLUE}╚════════════════════════════════════════════╝\${NC}"
echo ""

# Notify Oracle: Started
echo -e "\${YELLOW}📡 Notifying Oracle: Workflow started...\${NC}"
curl -s -X POST "${ORACLE_URL}/api/workflow/status" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"${id}","status":"started","projectName":"${projectName}"}' > /dev/null 2>&1 || true

# Step 1: Create project directory
echo ""
echo -e "\${GREEN}📁 Step 1: Creating project directory...\${NC}"
mkdir -p "${projectPath}"
cd "${projectPath}"
echo "   Created: ${projectPath}"

# Step 2: Initialize and run Claude Code
echo ""
echo -e "\${GREEN}🧠 Step 2: Running Claude Code (${model})...\${NC}"
echo "   Prompt: ${prompt.replace(/"/g, '\\"').substring(0, 100)}..."
echo ""

# Notify Oracle: Claude started
curl -s -X POST "${ORACLE_URL}/api/workflow/status" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"${id}","status":"claude_running","message":"Claude Code กำลังทำงาน..."}' > /dev/null 2>&1 || true

# Run Claude Code
cd "${WORK_DIR}"
claude --model ${model} -p "${prompt.replace(/"/g, '\\"')}" --yes --output-format text

# Check if project was created
if [ ! -d "${projectPath}" ] || [ -z "$(ls -A ${projectPath} 2>/dev/null)" ]; then
  echo -e "\${RED}❌ Error: Project directory is empty\${NC}"
  curl -s -X POST "${ORACLE_URL}/api/workflow/status" \\
    -H "Content-Type: application/json" \\
    -d '{"id":"${id}","status":"error","message":"Project directory is empty"}' > /dev/null 2>&1 || true
  exit 1
fi

echo ""
echo -e "\${GREEN}✅ Claude Code completed!\${NC}"

${deploy ? `
# Step 3: Deploy to Railway
echo ""
echo -e "\${GREEN}🚀 Step 3: Deploying to Railway...\${NC}"
cd "${projectPath}"

# Notify Oracle: Deploying
curl -s -X POST "${ORACLE_URL}/api/workflow/status" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"${id}","status":"deploying","message":"กำลัง deploy ขึ้น Railway..."}' > /dev/null 2>&1 || true

# Initialize Railway if needed
if [ ! -f "railway.json" ]; then
  echo "   Initializing Railway project..."
  railway init --name "${projectName}" 2>/dev/null || true
fi

# Deploy
railway up --detach

# Wait for deployment
echo "   Waiting for deployment..."
sleep 30

# Get deployment URL
RAILWAY_URL=$(railway status 2>/dev/null | grep -o 'https://[^ ]*' | head -1 || echo "")

if [ -z "$RAILWAY_URL" ]; then
  RAILWAY_URL="https://${projectName}.up.railway.app"
fi

echo ""
echo -e "\${GREEN}✅ Deployed successfully!\${NC}"
echo -e "   URL: \${BLUE}$RAILWAY_URL\${NC}"
` : `
RAILWAY_URL=""
echo ""
echo -e "\${YELLOW}⏭️  Skipping deployment (deploy=false)\${NC}"
`}

# Step 4: Notify completion
echo ""
echo -e "\${GREEN}📡 Step 4: Notifying Oracle...\${NC}"

${notifyLine ? `
curl -s -X POST "${ORACLE_URL}/api/workflow/complete" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"id\\": \\"${id}\\",
    \\"status\\": \\"completed\\",
    \\"projectName\\": \\"${projectName}\\",
    \\"projectPath\\": \\"${projectPath}\\",
    \\"url\\": \\"$RAILWAY_URL\\",
    \\"notifyLine\\": true
  }"
` : `
curl -s -X POST "${ORACLE_URL}/api/workflow/complete" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"${id}","status":"completed","notifyLine":false}' > /dev/null 2>&1 || true
`}

# Done
echo ""
echo -e "\${BLUE}╔════════════════════════════════════════════╗\${NC}"
echo -e "\${BLUE}║  ✅ Workflow Completed!                    \${NC}"
echo -e "\${BLUE}╚════════════════════════════════════════════╝\${NC}"
echo ""
${deploy ? 'echo -e "🔗 URL: ${BLUE}$RAILWAY_URL${NC}"' : ''}
echo ""
echo "กด Enter เพื่อปิดหน้าต่างนี้..."
read
`;

  return script;
}

/**
 * Create and save workflow script
 */
function createWorkflowScript(workflow) {
  // Ensure scripts directory exists
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }

  const scriptPath = path.join(SCRIPTS_DIR, `workflow-${workflow.id}.sh`);
  const script = generateWorkflowScript(workflow);

  fs.writeFileSync(scriptPath, script, { mode: 0o755 });

  return scriptPath;
}

/**
 * Open Terminal.app and run workflow
 */
function openTerminalWithWorkflow(scriptPath, callback) {
  // AppleScript to open Terminal and run the script
  const appleScript = `
    tell application "Terminal"
      activate
      do script "${scriptPath}"
    end tell
  `;

  exec(`osascript -e '${appleScript.replace(/'/g, "'\\''")}'`, (error, stdout, stderr) => {
    if (error) {
      console.error('[Workflow] Error opening Terminal:', error);
      callback?.(error);
      return;
    }
    console.log('[Workflow] Terminal opened with workflow script');
    callback?.(null, { success: true, scriptPath });
  });
}

/**
 * Execute a workflow
 * @param {Object} options - Workflow options
 * @returns {Object} - Workflow info
 */
function executeWorkflow(options) {
  const {
    projectName,
    prompt,
    model = 'opus',
    deploy = true,
    notifyLine = true,
    projectPath = null
  } = options;

  // Generate workflow ID
  const id = uuidv4().substring(0, 8);

  // Determine project path
  // สร้างโปรเจคที่ ~/Desktop/projects (ไม่ใช่ใน Oracle folder)
  const finalProjectPath = projectPath || `/Users/tanakitchaithip/Desktop/projects/${projectName}`;

  const workflow = {
    id,
    projectName,
    projectPath: finalProjectPath,
    prompt,
    model,
    deploy,
    notifyLine,
    createdAt: new Date().toISOString()
  };

  // Create script
  const scriptPath = createWorkflowScript(workflow);
  console.log(`[Workflow] Created script: ${scriptPath}`);

  // Open Terminal and run
  openTerminalWithWorkflow(scriptPath, (error) => {
    if (error) {
      console.error('[Workflow] Failed to start:', error);
    }
  });

  return {
    success: true,
    workflowId: id,
    scriptPath,
    message: `Workflow started! Terminal จะเปิดขึ้นมาให้ดู progress`
  };
}

/**
 * List active workflows
 */
function listWorkflows() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SCRIPTS_DIR);
  return files
    .filter(f => f.startsWith('workflow-') && f.endsWith('.sh'))
    .map(f => {
      const id = f.replace('workflow-', '').replace('.sh', '');
      const stat = fs.statSync(path.join(SCRIPTS_DIR, f));
      return {
        id,
        scriptPath: path.join(SCRIPTS_DIR, f),
        createdAt: stat.birthtime
      };
    });
}

/**
 * Clean up old workflow scripts
 */
function cleanupWorkflows(maxAgeHours = 24) {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    return 0;
  }

  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let cleaned = 0;

  const files = fs.readdirSync(SCRIPTS_DIR);
  for (const f of files) {
    const filePath = path.join(SCRIPTS_DIR, f);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      cleaned++;
    }
  }

  return cleaned;
}

export default {
  executeWorkflow,
  generateWorkflowScript,
  createWorkflowScript,
  openTerminalWithWorkflow,
  listWorkflows,
  cleanupWorkflows,
  SCRIPTS_DIR
};
