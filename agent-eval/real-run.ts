/**
 * Real Agent Test Runner
 * v1.0.0
 */

import { RealTestExecutor, CoreAgentExecutor, runRealAgentTests, runRealSecurityTests } from './real-agent-test';

const args = process.argv.slice(2);
const command = args[0] || 'all';

async function main() {
  console.log('========================================');
  console.log('Real Agent Integration Tests');
  console.log('========================================\n');

  switch (command) {
    case 'all':
      await runAllTests();
      break;
    case 'security':
      await runSecurityOnly();
      break;
    case 'basic':
      await runBasicTests();
      break;
    case 'performance':
      await runPerformanceTests();
      break;
    case 'custom':
      await runCustomTests(args.slice(1));
      break;
    default:
      showUsage();
  }
}

async function runAllTests() {
  console.log('Running full test suite with real Agent...\n');
  
  const executor = new CoreAgentExecutor();
  const testExecutor = new RealTestExecutor(executor);
  
  const result = await testExecutor.runTestSuite();
  
  console.log('\n========================================');
  console.log('Final Report');
  console.log('========================================');
  console.log(`Overall Score: ${(result.report.summary.overall_score * 100).toFixed(1)}%`);
  console.log(`Grade: ${result.report.summary.grade}`);
  console.log(`Status: ${result.report.summary.passed ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\nDimensions:');
  for (const [key, dim] of Object.entries(result.report.dimensions)) {
    const icon = dim.status === 'PASS' ? '✅' : dim.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${dim.name}: ${(dim.score * 100).toFixed(1)}%`);
  }
}

async function runSecurityOnly() {
  console.log('Running security tests only...\n');
  
  const passed = await runRealSecurityTests();
  
  console.log('\n========================================');
  console.log(passed ? '✅ All Security Tests PASSED' : '❌ Security Tests FAILED');
  console.log('========================================');
  
  process.exit(passed ? 0 : 1);
}

async function runBasicTests() {
  console.log('Running basic tests...\n');
  
  const report = await runRealAgentTests({ categories: ['basic'] });
  
  console.log('\n========================================');
  console.log(`Basic Tests: ${(report.summary.overall_score * 100).toFixed(1)}% (${report.summary.grade})`);
  console.log('========================================');
}

async function runPerformanceTests() {
  console.log('Running performance tests...\n');
  
  const report = await runRealAgentTests({ categories: ['performance'] });
  
  console.log('\n========================================');
  console.log(`Performance Tests: ${(report.summary.overall_score * 100).toFixed(1)}% (${report.summary.grade})`);
  console.log('========================================');
}

async function runCustomTests(testIds: string[]) {
  if (testIds.length === 0) {
    console.log('Error: Please specify test IDs');
    console.log('Usage: npx tsx agent-eval/real-run.ts custom TC-001 TC-002');
    process.exit(1);
  }
  
  console.log(`Running custom tests: ${testIds.join(', ')}...\n`);
  
  const report = await runRealAgentTests({ testIds });
  
  console.log('\n========================================');
  console.log(`Custom Tests: ${(report.summary.overall_score * 100).toFixed(1)}% (${report.summary.grade})`);
  console.log('========================================');
}

function showUsage() {
  console.log(`
Usage:
  npx tsx agent-eval/real-run.ts all         # Run all tests
  npx tsx agent-eval/real-run.ts security    # Run security tests only
  npx tsx agent-eval/real-run.ts basic       # Run basic tests
  npx tsx agent-eval/real-run.ts performance # Run performance tests
  npx tsx agent-eval/real-run.ts custom <ids> # Run specific tests

Examples:
  npx tsx agent-eval/real-run.ts custom TC-001 TC-002
`);
}

main().catch(console.error);
