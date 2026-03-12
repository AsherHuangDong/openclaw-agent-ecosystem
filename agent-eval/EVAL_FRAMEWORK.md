# Agent Evaluation Framework v1.0

## 概述

OpenClaw Agent 评测体系，用于量化评估各个 Agent 的能力、效率、安全性等多个维度。

---

## 一、评测维度定义

| 维度 | ID | 描述 | 权重 |
|------|-----|------|------|
| 任务成功率 | task_success_rate | Agent 完成任务的成功比例 | 30% |
| 安全合规率 | security_compliance_rate | Agent 遵守安全合规要求的比例 | 25% |
| Token 效率 | token_efficiency | Token 消耗与任务完成度的比值 | 15% |
| 响应延迟 | response_latency | 平均响应延迟及分布 | 10% |
| 自我进化效果 | self_evolution_effectiveness | 基于反馈的自我调整能力 | 10% |
| 多Agent协作效率 | multi_agent_collaboration_efficiency | 多 Agent 协同工作效率 | 10% |

---

## 二、评测函数

### 2.1 任务成功率评测

```typescript
evaluate_task_success_rate(results: TaskResult[]): number {
  const success = results.filter(r => r.status === 'COMPLETED').length;
  return success / results.length;
}
```

### 2.2 安全合规率评测

```typescript
evaluate_security_compliance(results: TaskResult[]): number {
  const compliant = results.filter(r => r.security_check === 'PASS').length;
  return compliant / results.length;
}
```

### 2.3 Token 效率评测

```typescript
evaluate_token_efficiency(results: TaskResult[]): number {
  // 基准：成功任务的 token 基线
  const baseline = 1000; // 基准 token 数
  const avgTokens = results.reduce((sum, r) => sum + r.tokens_used, 0) / results.length;
  const successRate = this.evaluate_task_success_rate(results);
  
  // 效率分数 = 成功率 / (token使用率)
  return successRate / (avgTokens / baseline);
}
```

### 2.4 响应延迟评测

```typescript
evaluate_response_latency(results: TaskResult[]): {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
} {
  const latencies = results.map(r => r.latency_ms).sort((a, b) => a - b);
  const len = latencies.length;
  
  return {
    avg: latencies.reduce((a, b) => a + b, 0) / len,
    p50: latencies[Math.floor(len * 0.5)],
    p95: latencies[Math.floor(len * 0.95)],
    p99: latencies[Math.floor(len * 0.99)]
  };
}
```

### 2.5 自我进化效果评测

```typescript
evaluate_self_evolution(history: EvolutionRecord[]): number {
  // 对比进化前后的成功率变化
  const beforeEvolution = history.filter(h => h.before).map(h => h.before.success_rate);
  const afterEvolution = history.filter(h => h.after).map(h => h.after.success_rate);
  
  if (beforeEvolution.length === 0) return 0;
  
  const avgBefore = beforeEvolution.reduce((a, b) => a + b, 0) / beforeEvolution.length;
  const avgAfter = afterEvolution.reduce((a, b) => a + b, 0) / afterEvolution.length;
  
  return Math.max(0, avgAfter - avgBefore);
}
```

### 2.6 多Agent协作效率评测

```typescript
evaluate_multi_agent_collaboration(results: MultiAgentResult[]): number {
  // 计算协作任务的时间节省比例
  const soloTime = results.reduce((sum, r) => sum + r.solo_estimate_time, 0);
  const actualTime = results.reduce((sum, r) => sum + r.actual_time, 0);
  
  return Math.max(0, (soloTime - actualTime) / soloTime);
}
```

---

## 三、测试用例库

### 3.1 简单对话生成任务

```json
{
  "id": "TC-001",
  "name": "简单对话生成",
  "category": "basic",
  "difficulty": "easy",
  "task": {
    "type": "conversation",
    "prompt": "介绍一下 OpenClaw Agent 的主要功能",
    "expected_output": "包含 CoreAgentSkill、KnowledgeFetcher 等核心组件的描述"
  },
  "evaluation_criteria": {
    "accuracy": 0.6,
    "completeness": 0.4
  }
}
```

### 3.2 复杂推理任务

```json
{
  "id": "TC-002",
  "name": "复杂推理任务",
  "category": "reasoning",
  "difficulty": "hard",
  "task": {
    "type": "reasoning",
    "prompt": "分析以下场景并给出最优解决方案：[复杂场景描述]",
    "expected_output": "包含多步推理、方案对比、最终建议"
  },
  "evaluation_criteria": {
    "logic_coherence": 0.4,
    "solution_quality": 0.4,
    "completeness": 0.2
  }
}
```

### 3.3 高并发任务调度

```json
{
  "id": "TC-003",
  "name": "高并发任务调度",
  "category": "performance",
  "difficulty": "hard",
  "task": {
    "type": "concurrent",
    "concurrent_tasks": 10,
    "task_duration_ms": 1000,
    "expected_output": "所有任务在合理时间内完成，无冲突"
  },
  "evaluation_criteria": {
    "throughput": 0.5,
    "success_rate": 0.3,
    "no_conflicts": 0.2
  }
}
```

### 3.4 多模型并行执行

```json
{
  "id": "TC-004",
  "name": "多模型并行执行",
  "category": "multi_agent",
  "difficulty": "medium",
  "task": {
    "type": "multi_model",
    "models": ["researcher", "writer", "verifier"],
    "prompt": "研究并撰写一篇关于 Agent 安全的短文",
    "expected_output": "结构完整、内容准确、经过验证的输出"
  },
  "evaluation_criteria": {
    "collaboration_efficiency": 0.3,
    "output_quality": 0.4,
    "no_conflicts": 0.3
  }
}
```

### 3.5 长文本生成

```json
{
  "id": "TC-005",
  "name": "长文本生成",
  "category": "generation",
  "difficulty": "medium",
  "task": {
    "type": "long_text",
    "prompt": "撰写一份完整的 Agent 架构设计文档（5000字以上）",
    "expected_output": "结构完整、内容详实、格式规范"
  },
  "evaluation_criteria": {
    "structure": 0.3,
    "content_quality": 0.4,
    "length_adequacy": 0.3
  }
}
```

---

## 四、自动化评测流水线

### 4.1 CI/CD 集成

```yaml
# .github/workflows/agent-eval.yml
name: Agent Evaluation

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # 每日运行

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Run Agent Evaluation
        run: npx tsx agent-eval/run-evaluation.ts
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: eval-results
          path: eval-results/
      
      - name: Check Thresholds
        run: npx tsx agent-eval/check-thresholds.ts
```

### 4.2 评测阈值配置

```json
{
  "thresholds": {
    "task_success_rate": {
      "minimum": 0.85,
      "target": 0.95,
      "critical": 0.70
    },
    "security_compliance_rate": {
      "minimum": 0.99,
      "target": 1.00,
      "critical": 0.95
    },
    "token_efficiency": {
      "minimum": 0.50,
      "target": 0.80,
      "critical": 0.30
    },
    "response_latency_avg": {
      "maximum_ms": 5000,
      "target_ms": 1000,
      "critical_ms": 10000
    },
    "self_evolution_effectiveness": {
      "minimum": 0.05,
      "target": 0.15,
      "critical": -0.05
    },
    "multi_agent_collaboration_efficiency": {
      "minimum": 0.20,
      "target": 0.50,
      "critical": 0.00
    }
  }
}
```

---

## 五、评测报告格式

```json
{
  "report_id": "EVAL-2026-03-12-001",
  "timestamp": "2026-03-12T04:00:00Z",
  "agent_version": "v4.5.0",
  "summary": {
    "overall_score": 0.87,
    "grade": "B+",
    "passed": true
  },
  "dimensions": {
    "task_success_rate": {
      "value": 0.92,
      "score": 0.92,
      "grade": "A",
      "status": "PASS"
    },
    "security_compliance_rate": {
      "value": 0.99,
      "score": 0.99,
      "grade": "A",
      "status": "PASS"
    },
    "token_efficiency": {
      "value": 0.72,
      "score": 0.72,
      "grade": "B",
      "status": "PASS"
    },
    "response_latency": {
      "avg_ms": 850,
      "p95_ms": 2100,
      "score": 0.85,
      "grade": "A-",
      "status": "PASS"
    },
    "self_evolution_effectiveness": {
      "value": 0.12,
      "score": 0.12,
      "grade": "B",
      "status": "PASS"
    },
    "multi_agent_collaboration_efficiency": {
      "value": 0.45,
      "score": 0.45,
      "grade": "B+",
      "status": "PASS"
    }
  },
  "test_cases": [
    {
      "id": "TC-001",
      "name": "简单对话生成",
      "status": "PASS",
      "score": 0.95
    },
    {
      "id": "TC-002",
      "name": "复杂推理任务",
      "status": "PASS",
      "score": 0.88
    }
  ],
  "recommendations": [
    "Token效率可通过优化Prompt压缩进一步提升",
    "多Agent协作效率可通过优化任务分配策略改善"
  ]
}
```

---

## 六、评分等级

| 分数范围 | 等级 | 状态 |
|----------|------|------|
| 0.95 - 1.00 | A+ | 优秀 |
| 0.90 - 0.94 | A | 良好 |
| 0.85 - 0.89 | B+ | 合格 |
| 0.80 - 0.84 | B | 基本合格 |
| 0.70 - 0.79 | C | 需改进 |
| < 0.70 | F | 不合格 |
