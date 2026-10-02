#!/bin/bash

# ==============================================================================
# AI MAILBOX - 1-CLICK MCP INSTALLER
# Usage: curl -sL https://raw.githubusercontent.com/.../install.sh | bash
# ==============================================================================

set -e

echo -e "\n🚀 BẮT ĐẦU CÀI ĐẶT AI MAILBOX MCP CLIENT...\n"

read -p "🌍 Nhập Backend API URL (Mặc định: https://arb-mcp.btngoc.io.vn): " API_URL
API_URL=${API_URL:-"https://arb-mcp.btngoc.io.vn"}

read -p "👤 Nhập Role của bạn (DEV hoặc PO): " ROLE
ROLE=${ROLE^^} # Uppercase

read -p "🏷️  Nhập Username của bạn (VD: dev_hung): " USERNAME
read -p "🔑 Nhập API Key do Admin cấp: " API_KEY

# Lấy đường dẫn tuyệt đối của thư mục hiện tại
PROJECT_DIR="$(pwd)"
MCP_SCRIPT="$PROJECT_DIR/dist/index.js"

# 2. Cài đặt thư viện & Build Node.js Server
echo -e "\n📦 Đang cài đặt thư viện và Build MCP Server..."
if [ ! -f "package.json" ]; then
    echo "❌ Lỗi: Bạn phải chạy script này bên trong thư mục chứa file package.json của AI Mailbox!"
    exit 1
fi
npm install --silent
npm run build --silent

echo -e "✅ Build thành công: $MCP_SCRIPT"

# 3. Tạo khối JSON cấu hình MCP
MCP_CONFIG=$(cat <<EOF
{
  "command": "node",
  "args": ["$MCP_SCRIPT"],
  "env": {
    "MAILBOX_API_URL": "$API_URL",
    "MAILBOX_API_KEY": "$API_KEY",
    "MAILBOX_USERNAME": "$USERNAME",
    "MAILBOX_ROLE": "$ROLE"
  }
}
EOF
)

# 4. Tự động Add vào cấu hình của các AI Client bằng JSON
echo -e "\n⚙️  Đang tự động chèn cấu hình JSON..."

inject_mcp() {
    local CONFIG_FILE=$1
    if [ -f "$CONFIG_FILE" ]; then
        echo "   -> Tìm thấy file config: $CONFIG_FILE"
        if command -v jq &> /dev/null; then
            jq ".mcpServers[\"ai-mailbox\"] = $MCP_CONFIG" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
            echo "   ✅ Đã chèn cấu hình thành công!"
        else
            echo "   ⚠️ Máy bạn chưa cài 'jq'. Vui lòng tự copy đoạn cấu hình bên dưới vào file config của bạn."
        fi
    fi
}

# 4.1. Add vào Claude Desktop
if [[ "$OSTYPE" == "darwin"* ]]; then
    CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CLAUDE_CONFIG_DIR="$HOME/.config/Claude"
else
    CLAUDE_CONFIG_DIR=""
fi

if [ -n "$CLAUDE_CONFIG_DIR" ]; then
    mkdir -p "$CLAUDE_CONFIG_DIR"
    CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
    if [ ! -f "$CLAUDE_CONFIG" ]; then
        echo '{"mcpServers": {}}' > "$CLAUDE_CONFIG"
    fi
    inject_mcp "$CLAUDE_CONFIG"
fi

# 4.2. Add vào Oh My Pi
if [ -f "$PROJECT_DIR/mcp.json" ]; then
    inject_mcp "$PROJECT_DIR/mcp.json"
elif [ -f "$HOME/.omp/mcp.json" ]; then
    inject_mcp "$HOME/.omp/mcp.json"
fi

# 4.3. Add vào Codex (Config File)
if [ -f "$HOME/.codex/mcp.json" ]; then
    inject_mcp "$HOME/.codex/mcp.json"
fi

# 5. Tự động Add bằng CLI Commands (Claude Code, Codex CLI)
echo -e "\n🤖 Đang kiểm tra các CLI Agents..."

if command -v claude &> /dev/null; then
    echo "   -> Phát hiện Claude Code CLI. Đang tự động add MCP..."
    claude mcp add ai-mailbox node "$MCP_SCRIPT" \
        -e MAILBOX_API_URL="$API_URL" \
        -e MAILBOX_API_KEY="$API_KEY" \
        -e MAILBOX_USERNAME="$USERNAME" \
        -e MAILBOX_ROLE="$ROLE"
    echo "   ✅ Đã cấu hình thành công cho Claude Code!"
fi

if command -v codex &> /dev/null; then
    echo "   -> Phát hiện Codex CLI. Đang tự động add MCP..."
    # Thử lệnh add của Codex. 
    codex mcp add ai-mailbox node "$MCP_SCRIPT" \
        -e MAILBOX_API_URL="$API_URL" \
        -e MAILBOX_API_KEY="$API_KEY" \
        -e MAILBOX_USERNAME="$USERNAME" \
        -e MAILBOX_ROLE="$ROLE" || echo "   ⚠️ Codex không hỗ trợ lệnh này, bỏ qua."
    echo "   ✅ Đã cấu hình thành công cho Codex!"
fi

echo -e "\n🎉 HOÀN TẤT! HỆ THỐNG ĐÃ SẴN SÀNG."
echo -e "Dưới đây là cấu hình JSON dự phòng (trong trường hợp bạn cần add thủ công vào Cursor / Cline / RooCode):\n"
echo "\"ai-mailbox\": $MCP_CONFIG"
echo -e "\nĐừng quên copy file Rules trong thư mục 'skills/' vào máy nhé!"
