#!/bin/bash
#
# Oracle Local Agent - Cloudflare Tunnel Setup
# ตั้งค่า Cloudflare Tunnel สำหรับ secure connection
#
# Usage:
#   ./setup-tunnel.sh install    # ติดตั้ง cloudflared
#   ./setup-tunnel.sh login      # Login to Cloudflare
#   ./setup-tunnel.sh create     # สร้าง tunnel
#   ./setup-tunnel.sh run        # รัน tunnel
#   ./setup-tunnel.sh service    # ติดตั้งเป็น service
#

set -e

TUNNEL_NAME="oracle-local-agent"
LOCAL_PORT=8765

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Oracle Local Agent - Tunnel Setup${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ติดตั้ง cloudflared
install_cloudflared() {
    echo "Installing cloudflared..."

    if command -v cloudflared &> /dev/null; then
        print_success "cloudflared already installed"
        cloudflared --version
        return
    fi

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install cloudflare/cloudflare/cloudflared
        else
            print_error "Homebrew not found. Please install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared.deb
        rm cloudflared.deb
    else
        print_error "Unsupported OS: $OSTYPE"
        exit 1
    fi

    print_success "cloudflared installed successfully"
    cloudflared --version
}

# Login to Cloudflare
login_cloudflare() {
    echo "Logging in to Cloudflare..."
    echo "A browser window will open. Please authorize the connection."
    cloudflared tunnel login
    print_success "Logged in to Cloudflare"
}

# สร้าง tunnel
create_tunnel() {
    echo "Creating tunnel: $TUNNEL_NAME..."

    # Check if tunnel exists
    if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
        print_warning "Tunnel '$TUNNEL_NAME' already exists"
        cloudflared tunnel info "$TUNNEL_NAME"
        return
    fi

    cloudflared tunnel create "$TUNNEL_NAME"
    print_success "Tunnel created: $TUNNEL_NAME"

    # Get tunnel ID
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo "Tunnel ID: $TUNNEL_ID"

    # Create config
    CONFIG_DIR="$HOME/.cloudflared"
    mkdir -p "$CONFIG_DIR"

    cat > "$CONFIG_DIR/config.yml" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CONFIG_DIR/$TUNNEL_ID.json

ingress:
  - hostname: oracle-local.your-domain.com
    service: http://localhost:$LOCAL_PORT
  - service: http_status:404
EOF

    print_success "Config created at $CONFIG_DIR/config.yml"
    echo ""
    echo "Next steps:"
    echo "1. Update 'oracle-local.your-domain.com' in $CONFIG_DIR/config.yml with your domain"
    echo "2. Create DNS record: cloudflared tunnel route dns $TUNNEL_NAME oracle-local.your-domain.com"
    echo "3. Run: ./setup-tunnel.sh run"
}

# รัน tunnel
run_tunnel() {
    echo "Starting tunnel: $TUNNEL_NAME..."

    # Check if config exists
    if [[ ! -f "$HOME/.cloudflared/config.yml" ]]; then
        print_error "Config not found. Run './setup-tunnel.sh create' first"
        exit 1
    fi

    print_warning "Press Ctrl+C to stop"
    cloudflared tunnel run "$TUNNEL_NAME"
}

# รัน tunnel แบบ quick-tunnel (ไม่ต้อง login)
run_quick_tunnel() {
    echo "Starting quick tunnel (temporary URL)..."
    echo "This will give you a temporary URL that expires when stopped"
    echo ""

    print_warning "Press Ctrl+C to stop"
    cloudflared tunnel --url http://localhost:$LOCAL_PORT
}

# ติดตั้งเป็น service (launchd on macOS)
install_service() {
    echo "Installing as service..."

    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_error "Service install only supported on macOS for now"
        exit 1
    fi

    # Check if config exists
    if [[ ! -f "$HOME/.cloudflared/config.yml" ]]; then
        print_error "Config not found. Run './setup-tunnel.sh create' first"
        exit 1
    fi

    cloudflared service install
    print_success "Service installed"

    echo ""
    echo "Commands:"
    echo "  Start:   sudo launchctl start com.cloudflare.cloudflared"
    echo "  Stop:    sudo launchctl stop com.cloudflare.cloudflared"
    echo "  Status:  sudo launchctl list | grep cloudflare"
}

# แสดงสถานะ
show_status() {
    echo "Checking tunnel status..."
    echo ""

    if ! command -v cloudflared &> /dev/null; then
        print_error "cloudflared not installed"
        exit 1
    fi

    echo "Installed version:"
    cloudflared --version
    echo ""

    echo "Available tunnels:"
    cloudflared tunnel list || echo "No tunnels or not logged in"
    echo ""

    if [[ -f "$HOME/.cloudflared/config.yml" ]]; then
        echo "Config file:"
        cat "$HOME/.cloudflared/config.yml"
    else
        print_warning "No config file found"
    fi
}

# Help
show_help() {
    echo "Usage: ./setup-tunnel.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install    Install cloudflared"
    echo "  login      Login to Cloudflare"
    echo "  create     Create a named tunnel"
    echo "  run        Run the named tunnel"
    echo "  quick      Run quick tunnel (temporary URL, no login needed)"
    echo "  service    Install as system service"
    echo "  status     Show tunnel status"
    echo "  help       Show this help"
    echo ""
    echo "Quick Start (no domain needed):"
    echo "  ./setup-tunnel.sh install"
    echo "  ./setup-tunnel.sh quick"
    echo ""
    echo "Full Setup (with custom domain):"
    echo "  ./setup-tunnel.sh install"
    echo "  ./setup-tunnel.sh login"
    echo "  ./setup-tunnel.sh create"
    echo "  ./setup-tunnel.sh run"
}

# Main
print_header

case "${1:-help}" in
    install)
        install_cloudflared
        ;;
    login)
        login_cloudflare
        ;;
    create)
        create_tunnel
        ;;
    run)
        run_tunnel
        ;;
    quick)
        run_quick_tunnel
        ;;
    service)
        install_service
        ;;
    status)
        show_status
        ;;
    help|*)
        show_help
        ;;
esac
