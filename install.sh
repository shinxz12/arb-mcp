#!/bin/bash

# ==============================================================================
# AI MAILBOX - 1-CLICK MCP INSTALLER
# Usage: curl -sL https://raw.githubusercontent.com/shinxz12/arb-mcp/main/install.sh | bash
# ==============================================================================

set -e

echo -e "\n🚀 BẮT ĐẦU CÀI ĐẶT AI MAILBOX MCP CLIENT...\n"

# 1. Thu thập thông tin từ User
read -p "🌍 Nhập Backend API URL (Mặc định: https://arb-mcp.btngoc.io.vn): " API_URL < /dev/tty
API_URL=${API_URL:-"https://arb-mcp.btngoc.io.vn"}
read -p "🔑 Nhập API Key của bạn do Admin cấp: " API_KEY < /dev/tty

echo -e "\n🔍 Đang kiểm tra API Key..."
USER_INFO=$(curl -s -H "Authorization: Bearer $API_KEY" "$API_URL/users/me")

if echo "$USER_INFO" | grep -q '"username"'; then
    USERNAME=$(echo "$USER_INFO" | grep -o '"username":"[^"]*' | cut -d'"' -f4)
    ROLE=$(echo "$USER_INFO" | grep -o '"role":"[^"]*' | cut -d'"' -f4)
    echo -e "   ✅ Xác thực thành công! Đăng nhập với tư cách: $USERNAME (Role: $ROLE)"
else
    echo -e "   ❌ Lỗi: API Key không hợp lệ hoặc Server chưa cập nhật bản mới nhất."
    exit 1
fi

# 2. Tạo thư mục cài đặt tự động ở Home Directory
INSTALL_DIR="$HOME/.ai-mailbox"
echo -e "\n📥 Đang tải mã nguồn về máy (tại $INSTALL_DIR)..."

if [ ! -d "$INSTALL_DIR" ]; then
    git clone https://github.com/shinxz12/arb-mcp.git "$INSTALL_DIR" --quiet
else
    echo "   -> Đã có sẵn mã nguồn, đang cập nhật bản mới nhất..."
    cd "$INSTALL_DIR"
    git pull origin main --quiet
fi

cd "$INSTALL_DIR"

# Lấy đường dẫn tuyệt đối file script
MCP_SCRIPT="$INSTALL_DIR/dist/index.js"

# 3. Cài đặt thư viện & Build Node.js Server
echo -e "\n📦 Đang cài đặt thư viện và Build MCP Server..."
npm install --silent
npm run build --silent

echo -e "✅ Build thành công tại: $MCP_SCRIPT"

# 4. Tạo khối JSON cấu hình MCP
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

# 5. Tự động Add vào cấu hình của các AI Client bằng JSON
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

# 5.1. Add vào Claude Desktop
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

# 5.2. Add vào Oh My Pi
if [ -f "$HOME/.omp/mcp.json" ]; then
    inject_mcp "$HOME/.omp/mcp.json"
fi

# 5.3. Add vào Codex (Config File)
if [ -f "$HOME/.codex/mcp.json" ]; then
    inject_mcp "$HOME/.codex/mcp.json"
fi

# 6. Tự động Add bằng CLI Commands (Claude Code, Codex CLI)
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
echo -e "\nĐừng quên bảo mọi người lấy file Rules trong thư mục '$INSTALL_DIR/skills/' nạp vào AI nhé!"
