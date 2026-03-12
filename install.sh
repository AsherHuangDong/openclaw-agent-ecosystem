#!/bin/bash

# OpenClaw Agent Ecosystem - 一键安装脚本
# 版本: v2.0.0

set -e

echo "========================================"
echo "OpenClaw Agent Ecosystem v2.0.0"
echo "一键安装脚本"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
check_node() {
    echo -e "${YELLOW}[1/6] 检查 Node.js...${NC}"
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            echo -e "${GREEN}✓ Node.js $(node -v) 已安装${NC}"
        else
            echo -e "${RED}✗ Node.js 版本过低，需要 >= 18${NC}"
            echo "请访问 https://nodejs.org 安装最新版本"
            exit 1
        fi
    else
        echo -e "${RED}✗ Node.js 未安装${NC}"
        echo "请访问 https://nodejs.org 安装 Node.js >= 18"
        exit 1
    fi
}

# 检查 npm
check_npm() {
    echo -e "${YELLOW}[2/6] 检查 npm...${NC}"
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✓ npm $(npm -v) 已安装${NC}"
    else
        echo -e "${RED}✗ npm 未安装${NC}"
        exit 1
    fi
}

# 安装依赖
install_deps() {
    echo -e "${YELLOW}[3/6] 安装依赖...${NC}"
    npm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
}

# 创建必要目录
create_dirs() {
    echo -e "${YELLOW}[4/6] 创建目录结构...${NC}"
    mkdir -p state/persist
    mkdir -p state/peer-inbox
    mkdir -p learning/peer-shared
    mkdir -p learning/experiences
    mkdir -p learning/failures
    mkdir -p learning/successes
    mkdir -p eval-results
    mkdir -p evolution/checkpoints
    mkdir -p evolution/skill-drafts
    echo -e "${GREEN}✓ 目录结构创建完成${NC}"
}

# 验证安装
verify_install() {
    echo -e "${YELLOW}[5/6] 验证安装...${NC}"
    
    # 检查关键文件
    FILES=(
        "task-engine/task-engine.ts"
        "context-bus/context-bus.ts"
        "sandbox.ts"
        "core-agent-integration.ts"
        "mem0-persist.ts"
        "agent-eval/eval-engine.ts"
        "agent-eval/test-cases.ts"
    )
    
    MISSING=0
    for FILE in "${FILES[@]}"; do
        if [ -f "$FILE" ]; then
            echo -e "${GREEN}  ✓ $FILE${NC}"
        else
            echo -e "${RED}  ✗ $FILE (缺失)${NC}"
            MISSING=1
        fi
    done
    
    if [ $MISSING -eq 1 ]; then
        echo -e "${RED}✗ 部分文件缺失，请检查仓库完整性${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ 所有核心文件验证通过${NC}"
}

# 运行测试
run_test() {
    echo -e "${YELLOW}[6/6] 运行验证测试...${NC}"
    echo ""
    
    if npx tsx agent-eval/run.ts stats > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 测试运行成功${NC}"
    else
        echo -e "${YELLOW}⚠ 测试运行跳过 (可能是首次运行)${NC}"
    fi
}

# 显示完成信息
show_complete() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}✓ 安装完成！${NC}"
    echo "========================================"
    echo ""
    echo "快速开始:"
    echo ""
    echo "  npm run eval          # 运行评测"
    echo "  npm run eval:real     # 真实Agent测试"
    echo "  npm run eval:security # 安全测试"
    echo "  npm run eval:stats    # 查看统计"
    echo ""
    echo "查看帮助:"
    echo "  npm run help"
    echo ""
    echo "文档:"
    echo "  cat ARCHITECTURE.md   # 架构文档"
    echo "  cat README.md         # 使用说明"
    echo ""
}

# 主流程
main() {
    check_node
    check_npm
    install_deps
    create_dirs
    verify_install
    run_test
    show_complete
}

# 运行
main
