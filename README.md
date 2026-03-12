# OpenClaw Agent Ecosystem

**版本**: v2.0.0  
**状态**: 生产就绪

一个完整的 Agent 生态系统，包含核心引擎、持久化层、评测体系、安全防护等完整基础设施。

---

## 特性

- 🚀 **高性能核心引擎**: TaskEngine (100万/秒)、ContextBus (250万/秒)、Sandbox (500万/秒)
- 💾 **完整持久化**: Mem0 持久化层 + 多Agent经验共享
- 📊 **评测体系**: 6维度评测 + 10基准测试用例 + CI/CD 集成
- 🛡️ **安全防护**: 5层 Guardrail 级联保护
- 🔄 **自我进化**: 自动学习 + 自我优化 + 经验共享

---

## 一键安装

### 方式一: 自动安装脚本

```bash
# 克隆仓库
git clone https://github.com/yourusername/openclaw-agent-ecosystem.git
cd openclaw-agent-ecosystem

# 运行安装脚本
./install.sh
```

### 方式二: 手动安装

```bash
# 1. 安装依赖
npm install

# 2. 运行测试验证
npm test

# 3. 查看帮助
npm run help
```

---

## 快速开始

```typescript
import { getCoreAgentIntegration } from './core-agent-integration';
import { runRealAgentTests } from './agent-eval/real-agent-test';

// 初始化
const agent = getCoreAgentIntegration();

// 运行评测
const report = await runRealAgentTests();
console.log('Score:', report.summary.overall_score);
```

---

## 项目结构

```
openclaw-agent-ecosystem/
├── task-engine/           # TaskEngine 任务状态管理
├── context-bus/           # ContextBus 上下文总线
├── sandbox/               # Sandbox 资源限制沙箱
├── learning/              # 学习系统
├── agent-eval/            # 评测体系
├── skills/                # 技能模块
├── memory/                # 记忆存储
├── state/                 # 运行时状态
├── core-agent-integration.ts  # 集成层
├── mem0-persist.ts        # 持久化层
├── ARCHITECTURE.md        # 架构文档
├── install.sh             # 安装脚本
└── package.json           # 项目配置
```

---

## 运行评测

```bash
# 模拟测试
npm run eval

# 真实Agent测试
npm run eval:real

# 安全测试
npm run eval:security

# 查看统计
npm run eval:stats
```

---

## 文档

- [架构文档](ARCHITECTURE.md)
- [评测框架](agent-eval/SKILL.md)
- [TaskEngine](task-engine/SKILL.md)
- [ContextBus](context-bus/SKILL.md)
- [Sandbox](sandbox/SKILL.md)

---

## 依赖

- Node.js >= 18
- TypeScript >= 5.0
- tsx (运行时)

---

## 许可证

MIT License
