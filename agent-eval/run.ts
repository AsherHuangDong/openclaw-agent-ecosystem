/**
 * Evaluation Runner
 * v1.0.0
 */

import { getEvalPipeline } from './pipeline';
import { getTestCaseManager } from './test-cases';

const args = process.argv.slice(2);
const command = args[0] || 'run';

async function main() {
  console.log('========================================');
  console.log('Agent Evaluation Framework v1.0.0');
  console.log('========================================\n');

  switch (command) {
    case 'run':
      await runEvaluation();
      break;
    case 'list':
      listTestCases();
      break;
    case 'stats':
      showStats();
      break;
    default:
      console.log('Commands: run | list | stats');
  }
}

async function runEvaluation() {
  const pipeline = getEvalPipeline({
    outputDir: './eval-results',
    parallel: true,
    reportFormats: ['json', 'markdown']
  });

  const result = await pipeline.runPipeline();
  const stats = pipeline.getExecutionStats();

  console.log('\n========================================');
  console.log('Execution Stats');
  console.log('========================================');
  console.log(`Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed}`);
  console.log(`Duration: ${(stats.totalDuration_ms / 1000).toFixed(1)}s | Tokens: ${stats.totalTokens}`);
  console.log(`Avg Score: ${(stats.avgScore * 100).toFixed(1)}%`);

  process.exit(result.success ? 0 : 1);
}

function listTestCases() {
  const manager = getTestCaseManager();
  const testCases = manager.getAllTestCases();
  console.log(`Total: ${testCases.length}\n`);
  testCases.forEach(tc => {
    console.log(`${tc.id}: ${tc.name} [${tc.category}/${tc.difficulty}]`);
  });
}

function showStats() {
  const manager = getTestCaseManager();
  const stats = manager.getStats();
  console.log('Stats:', JSON.stringify(stats, null, 2));
}

main().catch(console.error);
