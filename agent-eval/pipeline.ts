/**
 * Automated Evaluation Pipeline
 * v1.0.0
 *
 * 自动化评测流水线
 */

import * as fs from 'fs';
import * as path from 'path';
import { getEvalEngine, EvalReport, TaskResult, MultiAgentResult, EvolutionRecord } from './eval-engine';
import { getTestCaseManager, TestCase } from './test-cases';

// ============================================
// 流水线配置
// ============================================

export interface PipelineConfig {
  name: string;
  version: string;
  outputDir: string;
  parallel: boolean;
  maxConcurrency: number;
  timeout: number;
  retryCount: number;
  reportFormats: ('json' | 'markdown' | 'html')[];
  notifications: {
    enabled: boolean;
    channels: ('console' | 'webhook')[];
    webhook_url?: string;
  };
  thresholds: {
    overall_score: number;
    any_dimension_fail: boolean;
  };
}

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  name: 'Agent Evaluation Pipeline',
  version: '1.0.0',
  outputDir: './eval-results',
  parallel: true,
  maxConcurrency: 3,
  timeout: 300000,
  retryCount: 1,
  reportFormats: ['json', 'markdown'],
  notifications: {
    enabled: true,
    channels: ['console']
  },
  thresholds: {
    overall_score: 0.80,
    any_dimension_fail: true
  }
};

// ============================================
// 测试执行结果
// ============================================

export interface TestExecutionResult {
  testCaseId: string;
  testCaseName: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
  score: number;
  duration_ms: number;
  tokens_used: number;
  error?: string;
  details?: any;
}

// ============================================
// 流水线执行器
// ============================================

export class EvalPipeline {
  private config: PipelineConfig;
  private evalEngine = getEvalEngine();
  private testCaseManager = getTestCaseManager();
  private executionResults: TestExecutionResult[] = [];
  private startTime: number = 0;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.ensureOutputDir();
  }

  /**
   * 确保输出目录存在
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * 运行完整评测流水线
   */
  async runPipeline(options: {
    testSuite?: string;
    categories?: string[];
    testIds?: string[];
    dryRun?: boolean;
  } = {}): Promise<{
    success: boolean;
    report: EvalReport;
    executionResults: TestExecutionResult[];
  }> {
    console.log('\n========================================');
    console.log(`${this.config.name} v${this.config.version}`);
    console.log('========================================\n');

    this.startTime = Date.now();
    this.executionResults = [];

    // 1. 选择测试用例
    let testCases: TestCase[];
    if (options.testIds && options.testIds.length > 0) {
      testCases = options.testIds
        .map(id => this.testCaseManager.getTestCase(id))
        .filter((tc): tc is TestCase => tc !== undefined);
    } else if (options.categories && options.categories.length > 0) {
      testCases = this.testCaseManager.generateTestSuite({
        categories: options.categories as any
      });
    } else {
      testCases = this.testCaseManager.getAllTestCases();
    }

    console.log(`[Pipeline] Selected ${testCases.length} test cases\n`);

    if (options.dryRun) {
      console.log('[DRY RUN] Would execute the following test cases:');
      testCases.forEach(tc => console.log(`  - ${tc.id}: ${tc.name}`));
      return {
        success: true,
        report: this.createEmptyReport(),
        executionResults: []
      };
    }

    // 2. 执行测试用例
    console.log('[Pipeline] Executing test cases...\n');
    
    if (this.config.parallel) {
      await this.executeParallel(testCases);
    } else {
      await this.executeSequential(testCases);
    }

    // 3. 收集结果并生成评测报告
    console.log('\n[Pipeline] Generating evaluation report...\n');
    
    this.collectResults();
    const report = this.evalEngine.runFullEvaluation();

    // 4. 输出报告
    await this.outputReport(report);

    // 5. 检查阈值
    const success = this.checkThresholds(report);

    // 6. 发送通知
    this.sendNotification(report, success);

    return { success, report, executionResults: this.executionResults };
  }

  /**
   * 并行执行测试
   */
  private async executeParallel(testCases: TestCase[]): Promise<void> {
    const batches: TestCase[][] = [];
    for (let i = 0; i < testCases.length; i += this.config.maxConcurrency) {
      batches.push(testCases.slice(i, i + this.config.maxConcurrency));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(tc => this.executeTestCase(tc)));
    }
  }

  /**
   * 顺序执行测试
   */
  private async executeSequential(testCases: TestCase[]): Promise<void> {
    for (const tc of testCases) {
      await this.executeTestCase(tc);
    }
  }

  /**
   * 执行单个测试用例
   */
  private async executeTestCase(testCase: TestCase): Promise<TestExecutionResult> {
    const startTime = Date.now();
    console.log(`  [${testCase.id}] ${testCase.name}...`);

    try {
      // 模拟执行 - 实际执行时替换为真实Agent调用
      const result = await this.simulateTestCaseExecution(testCase);
      
      const duration = Date.now() - startTime;
      const execResult: TestExecutionResult = {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: result.success ? 'PASS' : 'FAIL',
        score: result.score,
        duration_ms: duration,
        tokens_used: result.tokens_used,
        details: result.details
      };

      this.executionResults.push(execResult);
      console.log(`    ✅ ${execResult.status} (${duration}ms, ${result.tokens_used} tokens)`);
      
      return execResult;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const execResult: TestExecutionResult = {
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: 'ERROR',
        score: 0,
        duration_ms: duration,
        tokens_used: 0,
        error: error.message
      };

      this.executionResults.push(execResult);
      console.log(`    ❌ ERROR: ${error.message}`);
      
      return execResult;
    }
  }

  /**
   * 模拟测试用例执行（实际使用时替换为真实Agent调用）
   */
  private async simulateTestCaseExecution(testCase: TestCase): Promise<{
    success: boolean;
    score: number;
    tokens_used: number;
    details?: any;
  }> {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    // 根据难度生成模拟结果
    const baseScore = testCase.difficulty === 'easy' ? 0.9 : 
                      testCase.difficulty === 'medium' ? 0.8 : 0.7;
    const variance = Math.random() * 0.2 - 0.1;
    const score = Math.min(1, Math.max(0, baseScore + variance));

    return {
      success: score >= 0.6,
      score,
      tokens_used: Math.floor(Math.random() * 2000 + 500),
      details: { simulated: true }
    };
  }

  /**
   * 收集执行结果到评测引擎
   */
  private collectResults(): void {
    // 将执行结果转换为评测引擎需要的格式
    this.executionResults.forEach(exec => {
      const taskResult: TaskResult = {
        taskId: exec.testCaseId,
        status: exec.status === 'PASS' ? 'COMPLETED' : 'FAILED',
        tokens_used: exec.tokens_used,
        latency_ms: exec.duration_ms,
        security_check: exec.status === 'PASS' ? 'PASS' : 
                       exec.status === 'ERROR' ? 'FAIL' : 'WARN',
        timestamp: Date.now()
      };
      this.evalEngine.addTaskResult(taskResult);
    });
  }

  /**
   * 输出报告
   */
  private async outputReport(report: EvalReport): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = `eval-report-${timestamp}`;

    // JSON 格式
    if (this.config.reportFormats.includes('json')) {
      const jsonPath = path.join(this.config.outputDir, `${baseName}.json`);
      this.evalEngine.saveReport(report, jsonPath);
    }

    // Markdown 格式
    if (this.config.reportFormats.includes('markdown')) {
      const mdPath = path.join(this.config.outputDir, `${baseName}.md`);
      this.saveMarkdownReport(report, mdPath);
    }

    // 控制台输出
    this.evalEngine.printReport(report);
  }

  /**
   * 保存 Markdown 格式报告
   */
  private saveMarkdownReport(report: EvalReport, outputPath: string): void {
    const lines: string[] = [
      `# Agent Evaluation Report`,
      '',
      `**Report ID:** ${report.report_id}`,
      `**Timestamp:** ${report.timestamp}`,
      `**Agent Version:** ${report.agent_version}`,
      '',
      '## Summary',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Overall Score | ${(report.summary.overall_score * 100).toFixed(1)}% |`,
      `| Grade | ${report.summary.grade} |`,
      `| Status | ${report.summary.passed ? '✅ PASS' : '❌ FAIL'} |`,
      '',
      '## Dimensions',
      '',
      '| Dimension | Score | Grade | Status |',
      '|-----------|-------|-------|--------|'
    ];

    for (const [key, dim] of Object.entries(report.dimensions)) {
      const icon = dim.status === 'PASS' ? '✅' : dim.status === 'WARN' ? '⚠️' : '❌';
      lines.push(`| ${dim.name} | ${(dim.score * 100).toFixed(1)}% | ${dim.grade} | ${icon} ${dim.status} |`);
    }

    if (report.recommendations.length > 0) {
      lines.push('', '## Recommendations', '');
      report.recommendations.forEach((rec, i) => {
        lines.push(`${i + 1}. ${rec}`);
      });
    }

    lines.push('', '## Test Cases', '');
    lines.push('| ID | Name | Status | Score | Duration |');
    lines.push('|----|------|--------|-------|----------|');

    this.executionResults.forEach(exec => {
      const icon = exec.status === 'PASS' ? '✅' : '❌';
      lines.push(`| ${exec.testCaseId} | ${exec.testCaseName} | ${icon} ${exec.status} | ${(exec.score * 100).toFixed(1)}% | ${exec.duration_ms}ms |`);
    });

    lines.push('', `---`, `*Generated by ${this.config.name} v${this.config.version}*`);

    fs.writeFileSync(outputPath, lines.join('\n'));
    console.log(`[Pipeline] Markdown report saved to ${outputPath}`);
  }

  /**
   * 检查阈值
   */
  private checkThresholds(report: EvalReport): boolean {
    let success = true;

    if (report.summary.overall_score < this.config.thresholds.overall_score) {
      console.log(`[Pipeline] ❌ Overall score ${(report.summary.overall_score * 100).toFixed(1)}% below threshold ${(this.config.thresholds.overall_score * 100)}%`);
      success = false;
    }

    if (this.config.thresholds.any_dimension_fail) {
      for (const dim of Object.values(report.dimensions)) {
        if (dim.status === 'FAIL') {
          console.log(`[Pipeline] ❌ Dimension "${dim.name}" failed`);
          success = false;
        }
      }
    }

    return success;
  }

  /**
   * 发送通知
   */
  private sendNotification(report: EvalReport, success: boolean): void {
    if (!this.config.notifications.enabled) return;

    const icon = success ? '✅' : '❌';
    const message = `${icon} Agent Evaluation ${success ? 'PASSED' : 'FAILED'}\n` +
                   `Overall Score: ${(report.summary.overall_score * 100).toFixed(1)}%\n` +
                   `Grade: ${report.summary.grade}`;

    if (this.config.notifications.channels.includes('console')) {
      console.log('\n' + message);
    }

    if (this.config.notifications.channels.includes('webhook') && this.config.notifications.webhook_url) {
      // TODO: Implement webhook notification
      console.log('[Pipeline] Webhook notification would be sent to:', this.config.notifications.webhook_url);
    }
  }

  /**
   * 创建空报告
   */
  private createEmptyReport(): EvalReport {
    return {
      report_id: 'EMPTY',
      timestamp: new Date().toISOString(),
      agent_version: 'N/A',
      summary: { overall_score: 0, grade: 'N/A', passed: false },
      dimensions: {},
      test_cases: [],
      recommendations: []
    };
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(): {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
    totalDuration_ms: number;
    totalTokens: number;
    avgScore: number;
  } {
    const total = this.executionResults.length;
    const passed = this.executionResults.filter(r => r.status === 'PASS').length;
    const failed = this.executionResults.filter(r => r.status === 'FAIL').length;
    const errors = this.executionResults.filter(r => r.status === 'ERROR').length;
    const skipped = this.executionResults.filter(r => r.status === 'SKIP').length;
    const totalDuration = this.executionResults.reduce((sum, r) => sum + r.duration_ms, 0);
    const totalTokens = this.executionResults.reduce((sum, r) => sum + r.tokens_used, 0);
    const avgScore = total > 0 ? this.executionResults.reduce((sum, r) => sum + r.score, 0) / total : 0;

    return { total, passed, failed, errors, skipped, totalDuration_ms: totalDuration, totalTokens, avgScore };
  }
}

// ============================================
// 快捷执行函数
// ============================================

export async function runQuickEval(options?: {
  categories?: string[];
  testIds?: string[];
}): Promise<{ success: boolean; report: EvalReport }> {
  const pipeline = new EvalPipeline();
  const result = await pipeline.runPipeline(options);
  return { success: result.success, report: result.report };
}

export async function runFullEval(): Promise<{ success: boolean; report: EvalReport }> {
  const pipeline = new EvalPipeline();
  const result = await pipeline.runPipeline();
  return { success: result.success, report: result.report };
}

// ============================================
// 单例
// ============================================

let pipelineInstance: EvalPipeline | null = null;

export function getEvalPipeline(config?: Partial<PipelineConfig>): EvalPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new EvalPipeline(config);
  }
  return pipelineInstance;
}
