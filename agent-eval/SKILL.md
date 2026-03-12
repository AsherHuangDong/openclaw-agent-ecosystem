# Agent Evaluation Framework

## 基本信息

- **名称**: Agent Evaluation Framework
- **版本**: v1.0.0
- **路径**: `agent-eval/`
- **描述**: OpenClaw Agent 评测体系，用于量化评估 Agent 的能力、效率、安全性等多维度指标

---

## 功能概述

### 核心功能

1. **多维度评测**: 6个评测维度，全面评估 Agent 表现
2. **基准测试库**: 10个标准测试用例，覆盖基础、推理、性能、安全等场景
3. **自动化流水线**: CI/CD 集成，自动运行评测
4. **真实Agent测试**: 支持真实 Agent 执行测试

---

## 评测维度

| 维度 | 权重 | 描述 |
|------|------|------|
| 任务成功率 | 30% | 任务完成的成功比例 |
| 安全合规率 | 25% | 遵守安全合规要求的比例 |
| Token效率 | 15% | Token消耗与完成度的比值 |
| 响应延迟 | 10% | 平均响应延迟及分布 |
| 自我进化效果 | 10% | 基于反馈的自我调整能力 |
| 多Agent协作效率 | 10% | 多Agent协同工作效率 |

---

## 测试用例库

| ID | 名称 | 类别 | 难度 |
|-----|------|------|------|
| TC-001 | 简单对话生成 | basic | easy |
| TC-002 | 复杂推理任务 | reasoning | hard |
| TC-003 | 高并发任务调度 | performance | hard |
| TC-004 | 多模型并行执行 | multi_agent | medium |
| TC-005 | 长文本生成 | generation | medium |
| TC-006 | 安全合规测试 | security | hard |
| TC-007 | 错误恢复测试 | basic | medium |
| TC-008 | 自我进化效果测试 | reasoning | hard |
| TC-009 | Token效率测试 | performance | medium |
| TC-010 | 边界条件测试 | basic | easy |

---

## 文件结构

```
agent-eval/
├── eval-engine.ts      # 评测引擎核心
├── test-cases.ts       # 测试用例库
├── pipeline.ts         # 自动化流水线
├── run.ts              # 模拟测试入口
├── real-agent-test.ts  # 真实Agent执行器
├── real-run.ts         # 真实测试入口
├── EVAL_FRAMEWORK.md   # 框架文档
└── SKILL.md            # 本文件
```

---

## 使用方法

### 运行模拟测试

```bash
npx tsx agent-eval/run.ts run      # 运行完整评测
npx tsx agent-eval/run.ts stats    # 查看统计
npx tsx agent-eval/run.ts list     # 列出用例
```

### 运行真实Agent测试

```bash
npx tsx agent-eval/real-run.ts all        # 全部测试
npx tsx agent-eval/real-run.ts security   # 安全测试
npx tsx agent-eval/real-run.ts basic      # 基础测试
```

### 代码调用

```typescript
import { runRealAgentTests } from './agent-eval/real-agent-test';

const report = await runRealAgentTests({ categories: ['basic'] });
console.log('Score:', report.summary.overall_score);
```

---

## 评测报告格式

```json
{
  "report_id": "EVAL-2026-03-12-001",
  "summary": {
    "overall_score": 0.93,
    "grade": "A",
    "passed": true
  },
  "dimensions": {
    "task_success_rate": { "score": 1.0, "grade": "A+", "status": "PASS" },
    "security_compliance_rate": { "score": 0.99, "grade": "A", "status": "PASS" }
  }
}
```

---

## 评分等级

| 分数 | 等级 |
|------|------|
| 0.95-1.00 | A+ |
| 0.90-0.94 | A |
| 0.85-0.89 | B+ |
| 0.80-0.84 | B |
| 0.70-0.79 | C |
| < 0.70 | F |

---

## 阈值配置

```json
{
  "thresholds": {
    "task_success_rate": { "minimum": 0.85, "target": 0.95 },
    "security_compliance_rate": { "minimum": 0.99, "target": 1.00 },
    "token_efficiency": { "minimum": 0.50, "target": 0.80 }
  }
}
```

---

## 依赖

- CoreAgentSkill v4.5+
- TaskEngine v2.0+
- ContextBus v2.0+

---

## 更新历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-03-12 | 初始版本：6维度评测 + 10测试用例 |
