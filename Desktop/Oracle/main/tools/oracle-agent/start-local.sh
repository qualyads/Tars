#!/bin/bash
# Oracle Local Services Starter v2.0
# รัน Local Agent + Local Claude Server + Cloudflare Tunnel

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🚀 ORACLE LOCAL SERVICES v2.0                              ║"
echo "║   Starting all local services for FREE AI                   ║"
echo "║   Using Cloudflare Tunnel (more stable!)                    ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

cd ~/Desktop/Oracle/main/tools/oracle-agent

# Load environment variables (properly handle special chars)
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "       ✅ Loaded .env (LINE_CHANNEL_TOKEN: ${LINE_CHANNEL_TOKEN:0:15}...)"
fi

# Kill existing processes
echo "[1/4] Cleaning up old processes..."
pkill -f "local-claude-server.js" 2>/dev/null
pkill -f "local-agent.js" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
pkill -f "localtunnel" 2>/dev/null
sleep 1

# Start Local Claude Server (background)
echo "[2/4] Starting Local Claude Server (port 3457)..."
node local-claude-server.js > /tmp/oracle-local-claude.log 2>&1 &
LOCAL_CLAUDE_PID=$!
echo "       PID: $LOCAL_CLAUDE_PID"
sleep 2

# Check if started
if ! kill -0 $LOCAL_CLAUDE_PID 2>/dev/null; then
    echo "       ❌ Failed to start! Check /tmp/oracle-local-claude.log"
    cat /tmp/oracle-local-claude.log | tail -5
    exit 1
fi
echo "       ✅ Running"

# Start Cloudflare Tunnel (background)
echo "[3/4] Starting Cloudflare Tunnel..."
~/bin/cloudflared tunnel --url http://localhost:3457 > /tmp/oracle-cloudflare.log 2>&1 &
TUNNEL_PID=$!
echo "       PID: $TUNNEL_PID"
sleep 6

# Get tunnel URL
TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/oracle-cloudflare.log | head -1)
if [ -z "$TUNNEL_URL" ]; then
    echo "       ❌ Failed to get tunnel URL!"
    cat /tmp/oracle-cloudflare.log | tail -10
    exit 1
fi
echo "       ✅ URL: $TUNNEL_URL"

# Auto-update Railway (if railway CLI available)
if command -v railway &> /dev/null; then
    echo ""
    echo "       🔄 Updating Railway LOCAL_TUNNEL_URL..."
    railway variables --set "LOCAL_TUNNEL_URL=$TUNNEL_URL" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "       ✅ Railway updated automatically!"
    else
        echo "       ⚠️  Railway update failed (manual update needed)"
    fi
fi

# Start Local Agent (background)
echo "[4/4] Starting Local Agent (WebSocket)..."
node local-agent.js > /tmp/oracle-local-agent.log 2>&1 &
AGENT_PID=$!
echo "       PID: $AGENT_PID"
sleep 2
echo "       ✅ Running"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ✅ ALL SERVICES STARTED                                    ║"
echo "║                                                              ║"
echo "║   Local Claude:  http://localhost:3457                       ║"
echo "║   Tunnel URL:    $TUNNEL_URL"
echo "║                                                              ║"
echo "║   📋 Railway AUTO-UPDATED (if CLI available)                 ║"
echo "║                                                              ║"
echo "║   📊 Check logs:                                             ║"
echo "║   - Local Claude: tail -f /tmp/oracle-local-claude.log       ║"
echo "║   - Tunnel:       tail -f /tmp/oracle-cloudflare.log         ║"
echo "║   - Local Agent:  tail -f /tmp/oracle-local-agent.log        ║"
echo "║                                                              ║"
echo "║   🛑 Stop all:    pkill -f 'local-claude\|cloudflared'       ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Keep script running and show combined logs
echo "📋 Showing combined logs (Ctrl+C to stop watching, services continue)..."
echo ""
tail -f /tmp/oracle-local-claude.log /tmp/oracle-cloudflare.log /tmp/oracle-local-agent.log
