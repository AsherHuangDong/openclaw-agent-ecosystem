/**
 * Agent Evaluation Engine
 * v1.0.0
 *
 * 评测引擎核心实现
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// 类型定义
// ============================================

export interface TaskResult {
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  tokens_used: number;
  latency_ms: number;
  security_check: 'PASS' | 'WARN' | 'FAIL';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface EvolutionRecord {
  before?: { success_rate: number };
  after?: { success_rate: number };
  proposal_id: string;
  timestamp: number;
}

export interface MultiAgentResult {
  taskId: string;
  solo_estimate_time: number;
  actual_time: number;
  agents_involved: string[];
  conflicts_detected: number;
  success: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  task: any;
  evaluation_criteria: Record<string, number>;
}

export interface EvalDimension {
  id: string;
  name: string;
  weight: number;
  value: number;
  score: number;
  grade: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details?: any;
}

export interface EvalReport {
  report_id: string;
  timestamp: string;
  agent_version: string;
  summary: {
    overall_score: number;
    grade: string;
    passed: boolean;
  };
  dimensions: Record<string, EvalDimension>;
  test_cases: Array<{
    id: string;
    name: string;
    status: string;
    score: number;
  }>;
  recommendations: string[];
}

// ============================================
// 评测配置
// ============================================

export interface EvalConfig {
  thresholds: {
    task_success_rate: ThresholdConfig;
    security_compliance_rate: ThresholdConfig;
    token_efficiency: ThresholdConfig;
    response_latency_avg: LatencyThresholdConfig;
    self_evolution_effectiveness: ThresholdConfig;
    multi_agent_collaboration_efficiency: ThresholdConfig;
  };
  weights: Record<string, number>;
}

interface ThresholdConfig {
  minimum: number;
  target: number;
  critical: number;
}

interface LatencyThresholdConfig {
  maximum_ms: number;
  target_ms: number;
  critical_ms: number;
}

const DEFAULT_CONFIG: EvalConfig = {
  thresholds: {
    task_success_rate: { minimum: 0.85, target: 0.95, critical: 0.70 },
    security_compliance_rate: { minimum: 0.99, target: 1.00, critical: 0.95 },
    token_efficiency: { minimum: 0.50, target: 0.80, critical: 0.30 },
    response_latency_avg: { maximum_ms: 5000, target_ms: 1000, critical_ms: 10000 },
    self_evolution_effectiveness: { minimum: 0.05, target: 0.15, critical: -0.05 },
    multi_agent_collaboration_efficiency: { minimum: 0.20, target: 0.50, critical: 0.00 }
  },
  weights: {
    task_success_rate: 0.30,
    security_compliance_rate: 0.25,
    token_efficiency: 0.15,
    response_latency: 0.10,
    self_evolution: 0.10,
    multi_agent_collaboration: 0.10
  }
};

// ============================================
// 评测引擎
// ============================================

export class AgentEvalEngine {
  private config: EvalConfig;
  private results: TaskResult[] = [];
  private evolutionHistory: EvolutionRecord[] = [];
  private multiAgentResults: MultiAgentResult[] = [];

  constructor(config: Partial<EvalConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as EvalConfig;
  }

  // ============================================
  // 数据收集
  // ============================================

  addTaskResult(result: TaskResult): void {
    this.results.push(result);
  }

  addEvolutionRecord(record: EvolutionRecord): void {
    this.evolutionHistory.push(record);
  }

  addMultiAgentResult(result: MultiAgentResult): void {
    this.multiAgentResults.push(result);
  }

  clearResults(): void {
    this.results = [];
    this.evolutionHistory = [];
    this.multiAgentResults = [];
  }

  // ============================================
  // 维度评测函数
  // ============================================

  /**
   * 评测任务成功率
   */
  evaluateTaskSuccessRate(): EvalDimension {
    if (this.results.length === 0) {
      return this.createEmptyDimension('task_success_rate', '任务成功率');
    }

    const successCount = this.results.filter(r => r.status === 'COMPLETED').length;
    const value = successCount / this.results.length;
    const threshold = this.config.thresholds.task_success_rate;

    return {
      id: 'task_success_rate',
      name: '任务成功率',
      weight: this.config.weights.task_success_rate,
      value,
      score: value,
      grade: this.getGrade(value),
      status: this.getStatus(value, threshold),
      details: {
        total: this.results.length,
        success: successCount,
        failed: this.results.filter(r => r.status === 'FAILED').length,
        timeout: this.results.filter(r => r.status === 'TIMEOUT').length
      }
    };
  }

  /**
   * 评测安全合规率
   */
  evaluateSecurityCompliance(): EvalDimension {
    if (this.results.length === 0) {
      return this.createEmptyDimension('security_compliance_rate', '安全合规率');
    }

    const compliantCount = this.results.filter(r => r.security_check === 'PASS').length;
    const value = compliantCount / this.results.length;
    const threshold = this.config.thresholds.security_compliance_rate;

    return {
      id: 'security_compliance_rate',
      name: '安全合规率',
      weight: this.config.weights.security_compliance_rate,
      value,
      score: value,
      grade: this.getGrade(value),
      status: this.getStatus(value, threshold),
      details: {
        total: this.results.length,
        pass: compliantCount,
        warn: this.results.filter(r => r.security_check === 'WARN').length,
        fail: this.results.filter(r => r.security_check === 'FAIL').length
      }
    };
  }

  /**
   * 评测Token效率
   */
  evaluateTokenEfficiency(): EvalDimension {
    if (this.results.length === 0) {
      return this.createEmptyDimension('token_efficiency', 'Token效率');
    }

    const baseline = 1000;
    const completedTasks = this.results.filter(r => r.status === 'COMPLETED');
    
    if (completedTasks.length === 0) {
      return this.createEmptyDimension('token_efficiency', 'Token效率');
    }

    const avgTokens = completedTasks.reduce((sum, r) => sum + r.tokens_used, 0) / completedTasks.length;
    const successRate = completedTasks.length / this.results.length;
    const value = successRate / (avgTokens / baseline);
    const threshold = this.config.thresholds.token_efficiency;

    return {
      id: 'token_efficiency',
      name: 'Token效率',
      weight: this.config.weights.token_efficiency,
      value,
      score: Math.min(1, value),
      grade: this.getGrade(Math.min(1, value)),
      status: this.getStatus(value, threshold),
      details: {
        avg_tokens: Math.round(avgTokens),
        baseline,
        success_rate: successRate,
        efficiency_ratio: value.toFixed(3)
      }
    };
  }

  /**
   * 评测响应延迟
   */
  evaluateResponseLatency(): EvalDimension {
    if (this.results.length === 0) {
      return this.createEmptyDimension('response_latency', '响应延迟');
    }

    const latencies = this.results.map(r => r.latency_ms).sort((a, b) => a - b);
    const len = latencies.length;
    const avg = latencies.reduce((a, b) => a + b, 0) / len;
    const p50 = latencies[Math.floor(len * 0.5)];
    const p95 = latencies[Math.floor(len * 0.95)];
    const p99 = latencies[Math.floor(len * 0.99)];

    const threshold = this.config.thresholds.response_latency_avg;
    const score = Math.max(0, 1 - (avg - threshold.target_ms) / (threshold.critical_ms - threshold.target_ms));
    const status = avg <= threshold.target_ms ? 'PASS' : avg <= threshold.maximum_ms ? 'WARN' : 'FAIL';

    return {
      id: 'response_latency',
      name: '响应延迟',
      weight: this.config.weights.response_latency,
      value: avg,
      score: Math.min(1, Math.max(0, score)),
      grade: this.getGrade(Math.min(1, Math.max(0, score))),
      status,
      details: {
        avg_ms: Math.round(avg),
        p50_ms: p50,
        p95_ms: p95,
        p99_ms: p99,
        min_ms: latencies[0],
        max_ms: latencies[len - 1]
      }
    };
  }

  /**
   * 评测自我进化效果
   */
  evaluateSelfEvolution(): EvalDimension {
    if (this.evolutionHistory.length === 0) {
      return this.createEmptyDimension('self_evolution_effectiveness', '自我进化效果');
    }

    const beforeRates = this.evolutionHistory
      .filter(h => h.before)
      .map(h => h.before!.success_rate);
    const afterRates = this.evolutionHistory
      .filter(h => h.after)
      .map(h => h.after!.success_rate);

    if (beforeRates.length === 0 || afterRates.length === 0) {
      return this.createEmptyDimension('self_evolution_effectiveness', '自我进化效果');
    }

    const avgBefore = beforeRates.reduce((a, b) => a + b, 0) / beforeRates.length;
    const avgAfter = afterRates.reduce((a, b) => a + b, 0) / afterRates.length;
    const value = avgAfter - avgBefore;
    const threshold = this.config.thresholds.self_evolution_effectiveness;

    return {
      id: 'self_evolution_effectiveness',
      name: '自我进化效果',
      weight: this.config.weights.self_evolution,
      value,
      score: Math.max(0, value),
      grade: this.getGrade(Math.max(0, value)),
      status: this.getStatus(value, threshold),
      details: {
        evolution_count: this.evolutionHistory.length,
        before_avg: avgBefore.toFixed(3),
        after_avg: avgAfter.toFixed(3),
        improvement: (value * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * 评测多Agent协作效率
   */
  evaluateMultiAgentCollaboration(): EvalDimension {
    if (this.multiAgentResults.length === 0) {
      return this.createEmptyDimension('multi_agent_collaboration_efficiency', '多Agent协作效率');
    }

    const soloTime = this.multiAgentResults.reduce((sum, r) => sum + r.solo_estimate_time, 0);
    const actualTime = this.multiAgentResults.reduce((sum, r) => sum + r.actual_time, 0);
    const value = Math.max(0, (soloTime - actualTime) / soloTime);
    const threshold = this.config.thresholds.multi_agent_collaboration_efficiency;

    const successCount = this.multiAgentResults.filter(r => r.success).length;
    const totalConflicts = this.multiAgentResults.reduce((sum, r) => sum + r.conflicts_detected, 0);

    return {
      id: 'multi_agent_collaboration_efficiency',
      name: '多Agent协作效率',
      weight: this.config.weights.multi_agent_collaboration,
      value,
      score: value,
      grade: this.getGrade(value),
      status: this.getStatus(value, threshold),
      details: {
        tasks_count: this.multiAgentResults.length,
        success_rate: successCount / this.multiAgentResults.length,
        time_saved: ((soloTime - actualTime) / 1000).toFixed(1) + 's',
        time_saved_percent: (value * 100).toFixed(1) + '%',
        total_conflicts: totalConflicts
      }
    };
  }

  // ============================================
  // 完整评测
  // ============================================

  runFullEvaluation(): EvalReport {
    const dimensions: Record<string, EvalDimension> = {
      task_success_rate: this.evaluateTaskSuccessRate(),
      security_compliance_rate: this.evaluateSecurityCompliance(),
      token_efficiency: this.evaluateTokenEfficiency(),
      response_latency: this.evaluateResponseLatency(),
      self_evolution_effectiveness: this.evaluateSelfEvolution(),
      multi_agent_collaboration_efficiency: this.evaluateMultiAgentCollaboration()
    };

    // 计算加权总分
    let totalWeight = 0;
    let weightedScore = 0;
    let allPassed = true;

    for (const dim of Object.values(dimensions)) {
      if (dim.weight > 0 && dim.score > 0) {
        weightedScore += dim.score * dim.weight;
        totalWeight += dim.weight;
      }
      if (dim.status === 'FAIL') allPassed = false;
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return {
      report_id: `EVAL-${new Date().toISOString().slice(0, 10)}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent_version: 'v4.5.0',
      summary: {
        overall_score: Math.round(overallScore * 100) / 100,
        grade: this.getGrade(overallScore),
        passed: allPassed && overallScore >= 0.80
      },
      dimensions,
      test_cases: [],
      recommendations: this.generateRecommendations(dimensions)
    };
  }

  // ============================================
  // 辅助方法
  // ============================================

  private createEmptyDimension(id: string, name: string): EvalDimension {
    return {
      id,
      name,
      weight: 0,
      value: 0,
      score: 0,
      grade: 'N/A',
      status: 'FAIL',
      details: { message: 'No data available' }
    };
  }

  private getGrade(score: number): string {
    if (score >= 0.95) return 'A+';
    if (score >= 0.90) return 'A';
    if (score >= 0.85) return 'B+';
    if (score >= 0.80) return 'B';
    if (score >= 0.70) return 'C';
    return 'F';
  }

  private getStatus(value: number, threshold: ThresholdConfig): 'PASS' | 'WARN' | 'FAIL' {
    if (value >= threshold.target) return 'PASS';
    if (value >= threshold.minimum) return 'WARN';
    return 'FAIL';
  }

  private generateRecommendations(dimensions: Record<string, EvalDimension>): string[] {
    const recommendations: string[] = [];

    if (dimensions.token_efficiency.status !== 'PASS') {
      recommendations.push('Token效率可通过优化Prompt压缩进一步提升');
    }
    if (dimensions.response_latency.status !== 'PASS') {
      recommendations.push('响应延迟可通过模型路由优化或缓存策略改善');
    }
    if (dimensions.multi_agent_collaboration_efficiency.status !== 'PASS') {
      recommendations.push('多Agent协作效率可通过优化任务分配策略改善');
    }
    if (dimensions.self_evolution_effectiveness.status !== 'PASS') {
      recommendations.push('自我进化效果可通过增加学习频率或优化进化触发条件提升');
    }

    return recommendations;
  }

  // ============================================
  // 报告输出
  // ============================================

  saveReport(report: EvalReport, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[EvalEngine] Report saved to ${outputPath}`);
  }

  printReport(report: EvalReport): void {
    console.log('\n========================================');
    console.log('Agent Evaluation Report');
    console.log('========================================');
    console.log(`Report ID: ${report.report_id}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Agent Version: ${report.agent_version}`);
    console.log('\n--- Summary ---');
    console.log(`Overall Score: ${(report.summary.overall_score * 100).toFixed(1)}%`);
    console.log(`Grade: ${report.summary.grade}`);
    console.log(`Status: ${report.summary.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('\n--- Dimensions ---');

    for (const [key, dim] of Object.entries(report.dimensions)) {
      const statusIcon = dim.status === 'PASS' ? '✅' : dim.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${statusIcon} ${dim.name}: ${(dim.score * 100).toFixed(1)}% (${dim.grade})`);
    }

    if (report.recommendations.length > 0) {
      console.log('\n--- Recommendations ---');
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }

    console.log('========================================\n');
  }
}

// ============================================
// 单例
// ============================================

let evalEngineInstance: AgentEvalEngine | null = null;

export function getEvalEngine(config?: Partial<EvalConfig>): AgentEvalEngine {
  if (!evalEngineInstance) {
    evalEngineInstance = new AgentEvalEngine(config);
  }
  return evalEngineInstance;
}
