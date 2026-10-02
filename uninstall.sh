#!/bin/bash

# ==============================================================================
# AI MAILBOX - 1-CLICK MCP UNINSTALLER
# ==============================================================================

set -e

echo -e "\n🗑️  BẮT ĐẦU GỠ CÀI ĐẶT AI MAILBOX MCP CLIENT...\n"

read -p "⚠️  Bạn có chắc chắn muốn gỡ cấu hình AI Mailbox khỏi các AI Client không? (y/n): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Đã huỷ thao tác."
    exit 0
fi

echo -e "\n⚙️  Đang dọn dẹp cấu hình JSON..."

remove_mcp() {
    local CONFIG_FILE=$1
    if [ -f "$CONFIG_FILE" ]; then
        echo "   -> Kiểm tra file config: $CONFIG_FILE"
        if command -v jq &> /dev/null; then
            # Kiểm tra xem key "ai-mailbox" có tồn tại không
            if jq -e ".mcpServers[\"ai-mailbox\"]" "$CONFIG_FILE" > /dev/null 2>&1; then
                jq 'del(.mcpServers["ai-mailbox"])' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
                echo "   ✅ Đã gỡ cấu hình thành công!"
            else
                echo "   ℹ️ Không tìm thấy cấu hình AI Mailbox trong file này."
            fi
        else
            echo "   ⚠️ Máy bạn chưa cài 'jq'. Vui lòng tự mở file và xoá cấu hình bằng tay."
        fi
    fi
}

# 1. Gỡ khỏi Claude Desktop
if [[ "$OSTYPE" == "darwin"* ]]; then
    CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CLAUDE_CONFIG="$HOME/.config/Claude/claude_desktop_config.json"
else
    CLAUDE_CONFIG=""
fi

if [ -n "$CLAUDE_CONFIG" ]; then
    remove_mcp "$CLAUDE_CONFIG"
fi

# 2. Gỡ khỏi Oh My Pi
PROJECT_DIR="$(pwd)"
if [ -f "$PROJECT_DIR/mcp.json" ]; then
    remove_mcp "$PROJECT_DIR/mcp.json"
fi
if [ -f "$HOME/.omp/mcp.json" ]; then
    remove_mcp "$HOME/.omp/mcp.json"
fi

# 3. Gỡ khỏi Codex (Config File)
if [ -f "$HOME/.codex/mcp.json" ]; then
    remove_mcp "$HOME/.codex/mcp.json"
fi

# 4. Tự động Gỡ bằng CLI Commands (Claude Code, Codex CLI)
echo -e "\n🤖 Đang kiểm tra và gỡ khỏi các CLI Agents..."

if command -v claude &> /dev/null; then
    echo "   -> Phát hiện Claude Code CLI. Đang gỡ MCP..."
    claude mcp remove ai-mailbox || echo "   ℹ️ Không tìm thấy ai-mailbox trong Claude Code."
    echo "   ✅ Đã gỡ khỏi Claude Code!"
fi

if command -v codex &> /dev/null; then
    echo "   -> Phát hiện Codex CLI. Đang gỡ MCP..."
    codex mcp remove ai-mailbox || echo "   ℹ️ Không tìm thấy ai-mailbox trong Codex."
    echo "   ✅ Đã gỡ khỏi Codex!"
fi

echo -e "\n🎉 ĐÃ GỠ CÀI ĐẶT HOÀN TẤT!"
echo "Lưu ý: Mã nguồn (source code) và thư mục skills vẫn được giữ lại. Nếu muốn, bạn có thể tự xoá thư mục này."
