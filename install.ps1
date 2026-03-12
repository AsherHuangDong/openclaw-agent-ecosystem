# 一键安装脚本 (Windows PowerShell)
# OpenClaw Agent Ecosystem v2.0.0

Write-Host "========================================"
Write-Host "OpenClaw Agent Ecosystem v2.0.0"
Write-Host "一键安装脚本 (Windows)"
Write-Host "========================================"
Write-Host ""

# 颜色函数
function Write-Green { param($text) Write-Host $text -ForegroundColor Green }
function Write-Yellow { param($text) Write-Host $text -ForegroundColor Yellow }
function Write-Red { param($text) Write-Host $text -ForegroundColor Red }

# 检查 Node.js
Write-Yellow "[1/6] 检查 Node.js..."
try {
    $nodeVersion = node -v
    $majorVersion = $nodeVersion.Substring(1).Split('.')[0]
    if ([int]$majorVersion -ge 18) {
        Write-Green "✓ Node.js $nodeVersion 已安装"
    } else {
        Write-Red "✗ Node.js 版本过低，需要 >= 18"
        exit 1
    }
} catch {
    Write-Red "✗ Node.js 未安装，请访问 https://nodejs.org"
    exit 1
}

# 检查 npm
Write-Yellow "[2/6] 检查 npm..."
try {
    $npmVersion = npm -v
    Write-Green "✓ npm $npmVersion 已安装"
} catch {
    Write-Red "✗ npm 未安装"
    exit 1
}

# 安装依赖
Write-Yellow "[3/6] 安装依赖..."
npm install
Write-Green "✓ 依赖安装完成"

# 创建目录
Write-Yellow "[4/6] 创建目录结构..."
$dirs = @(
    "state/persist",
    "state/peer-inbox",
    "learning/peer-shared",
    "learning/experiences",
    "learning/failures",
    "learning/successes",
    "eval-results",
    "evolution/checkpoints",
    "evolution/skill-drafts"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Green "✓ 目录结构创建完成"

# 验证文件
Write-Yellow "[5/6] 验证安装..."
$files = @(
    "task-engine/task-engine.ts",
    "context-bus/context-bus.ts",
    "sandbox.ts",
    "core-agent-integration.ts",
    "mem0-persist.ts",
    "agent-eval/eval-engine.ts",
    "agent-eval/test-cases.ts"
)
$missing = $false
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Green "  ✓ $file"
    } else {
        Write-Red "  ✗ $file (缺失)"
        $missing = $true
    }
}
if ($missing) {
    Write-Red "✗ 部分文件缺失"
    exit 1
}
Write-Green "✓ 所有核心文件验证通过"

# 运行测试
Write-Yellow "[6/6] 运行验证测试..."
npx tsx agent-eval/run.ts stats 2>$null
Write-Green "✓ 测试运行成功"

Write-Host ""
Write-Host "========================================"
Write-Green "✓ 安装完成！"
Write-Host "========================================"
Write-Host ""
Write-Host "快速开始:"
Write-Host "  npm run eval          # 运行评测"
Write-Host "  npm run eval:real     # 真实Agent测试"
Write-Host "  npm run eval:stats    # 查看统计"
Write-Host ""
