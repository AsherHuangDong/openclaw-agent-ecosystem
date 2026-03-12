# Sandbox Resource Limits Skill

**Version:** 2.0.0
**Type:** Core Module
**Category:** Security & Isolation

## Description

Resource limit enforcement for sandboxed tasks. Enforces CPU, memory, network, timeout, and disk limits to prevent resource exhaustion and ensure task isolation.

## Features

- **CPU Limits:** Percentage of CPU core usage (0-100%)
- **Memory Limits:** Maximum RAM usage (MB)
- **Network Limits:** Bandwidth (MB/s) and connection limits
- **Timeout Limits:** Maximum execution time (ms)
- **Disk Limits:** Maximum write operations (MB)
- **Process Isolation:** Sub-process isolation (optional)
- **Command Whitelist:** Allowlist for allowed commands

## Installation

No dependencies required.

## Usage

### Basic Sandbox Configuration

```typescript
import { getSandbox } from './sandbox';

const sandbox = getSandbox();

// Create limits for a task
const limits = sandbox.createLimits('task-123');
console.log(limits);
// {
//   cpuLimit: 50,
//   memoryLimit: 512,
//   networkBandwidth: 10,
//   maxNetworkConnections: 10,
//   timeoutMs: 300000,
//   maxDiskWriteMB: 100,
//   enableProcessIsolation: true
// }
```

### Task Execution with Limits

```typescript
const sandbox = getSandbox();

// Start tracking task
sandbox.startTask('task-123');

try {
  // Execute task
  const result = await executeTask();

  // Update usage
  sandbox.updateTaskUsage('task-123', {
    cpuUsage: 30,
    memoryUsage: 256,
    networkUsage: 5
  });

  // Check limits
  const limitsCheck = sandbox.checkLimits('task-123', {
    cpuUsage: 30,
    memoryUsage: 256,
    networkUsage: 5,
    diskWriteMB: 50,
    elapsedTimeMs: 120000
  });

  if (!limitsCheck.allowed) {
    throw new Error(limitsCheck.reason);
  }

  return result;
} finally {
  sandbox.stopTask('task-123');
}
```

### Network Limit Enforcement

```typescript
const sandbox = getSandbox({
  networkBandwidth: 5,
  maxNetworkConnections: 5,
  timeoutMs: 60000
});

// Check network usage
const limitsCheck = sandbox.checkLimits('task-456', {
  cpuUsage: 10,
  memoryUsage: 128,
  networkUsage: 6, // Exceeds 5 MB/s limit
  diskWriteMB: 20,
  elapsedTimeMs: 30000
});

console.log(limitsCheck.allowed); // false
console.log(limitsCheck.reason); // "Network bandwidth 6MB/s exceeds limit 5MB/s"
```

### Timeout Enforcement

```typescript
const sandbox = getSandbox({
  timeoutMs: 30000 // 30 seconds
});

const startTime = Date.now();

// Simulate long-running task
while (Date.now() - startTime < 60000) {
  // Task logic
}

const limitsCheck = sandbox.checkLimits('task-789', {
  cpuUsage: 20,
  memoryUsage: 100,
  networkUsage: 1,
  diskWriteMB: 10,
  elapsedTimeMs: 60000 // Exceeds 30s timeout
});

console.log(limitsCheck.allowed); // false
console.log(limitsCheck.reason); // "Task timeout after 60000ms (limit: 30000ms)"
```

### Command Whitelist

```typescript
const sandbox = getSandbox({
  allowedCommands: ['npm', 'git', 'node']
});

// Check if command is allowed
console.log(sandbox.isCommandAllowed('npm')); // true
console.log(sandbox.isCommandAllowed('rm')); // false (not in allowlist)
```

## Configuration Options

```typescript
const sandbox = getSandbox({
  cpuLimit: 50,                    // CPU percentage (0-100)
  memoryLimit: 512,                // Memory limit in MB
  networkBandwidth: 10,            // Network bandwidth in MB/s
  maxNetworkConnections: 10,       // Maximum network connections
  timeoutMs: 300000,               // Timeout in milliseconds (5 minutes)
  maxDiskWriteMB: 100,             // Maximum disk write in MB
  enableProcessIsolation: true,    // Enable sub-process isolation
  allowedCommands: ['npm', 'git']  // Command allowlist
});
```

## API Reference

### Methods

| Method | Description |
|--------|-------------|
| `createLimits(taskId)` | Create sandbox limits for a task |
| `checkLimits(taskId, usage)` | Check if task usage is within limits |
| `startTask(taskId)` | Start tracking task |
| `updateTaskUsage(taskId, usage)` | Update task usage metrics |
| `stopTask(taskId)` | Stop tracking task |
| `getTaskUsage(taskId)` | Get task usage |
| `isTaskRunning(taskId)` | Check if task is running |
| `getRunningTasks()` | Get all running tasks |
| `killTask(taskId)` | Kill task (simulate) |
| `getStats()` | Get sandbox statistics |
| `updateConfig(config)` | Update sandbox configuration |
| `getConfig()` | Get current configuration |
| `isCommandAllowed(command)` | Check if command is allowed |

## Resource Limits

### CPU Limit
- **Default:** 50% of CPU core
- **Range:** 0-100%
- **Purpose:** Prevent CPU hogging
- **Check:** Current CPU usage percentage

### Memory Limit
- **Default:** 512 MB
- **Range:** 0-∞ MB
- **Purpose:** Prevent memory exhaustion
- **Check:** Current memory usage in MB

### Network Bandwidth Limit
- **Default:** 10 MB/s
- **Range:** 0-∞ MB/s
- **Purpose:** Prevent network flooding
- **Check:** Network bandwidth in MB/s

### Network Connections Limit
- **Default:** 10 connections
- **Range:** 0-∞ connections
- **Purpose:** Prevent connection exhaustion
- **Check:** Current network connections

### Timeout Limit
- **Default:** 5 minutes (300000 ms)
- **Range:** 0-∞ ms
- **Purpose:** Prevent infinite loops
- **Check:** Elapsed time in ms

### Disk Write Limit
- **Default:** 100 MB
- **Range:** 0-∞ MB
- **Purpose:** Prevent disk exhaustion
- **Check:** Total disk write in MB

## Usage Examples

### Example 1: Safe Task Execution

```typescript
const sandbox = getSandbox();

async function executeSafeTask(taskId: string, taskFn: () => Promise<any>) {
  sandbox.startTask(taskId);

  try {
    // Execute task
    const result = await taskFn();

    // Check limits
    const limitsCheck = sandbox.checkLimits(taskId, {
      cpuUsage: 30,
      memoryUsage: 256,
      networkUsage: 5,
      diskWriteMB: 50,
      elapsedTimeMs: 120000
    });

    if (!limitsCheck.allowed) {
      console.error('Task limit exceeded:', limitsCheck.reason);
      sandbox.killTask(taskId);
      throw new Error(limitsCheck.reason);
    }

    return result;
  } finally {
    sandbox.stopTask(taskId);
  }
}

// Use
executeSafeTask('task-123', async () => {
  // Safe task logic
  return 'result';
});
```

### Example 2: Monitoring Running Tasks

```typescript
const sandbox = getSandbox();

// Start multiple tasks
sandbox.startTask('task-1');
sandbox.startTask('task-2');
sandbox.startTask('task-3');

// Update usage
sandbox.updateTaskUsage('task-1', { cpuUsage: 40, memoryUsage: 200, networkUsage: 8 });
sandbox.updateTaskUsage('task-2', { cpuUsage: 20, memoryUsage: 100, networkUsage: 3 });
sandbox.updateTaskUsage('task-3', { cpuUsage: 60, memoryUsage: 400, networkUsage: 12 });

// Get running tasks
const runningTasks = sandbox.getRunningTasks();
console.log(runningTasks); // ['task-1', 'task-2', 'task-3']

// Get statistics
const stats = sandbox.getStats();
console.log(stats);
// {
//   runningTasks: 3,
//   totalTasks: 3,
//   avgCpuUsage: 40,
//   avgMemoryUsage: 233,
//   avgNetworkUsage: 7.67
// }
```

### Example 3: Dynamic Configuration

```typescript
const sandbox = getSandbox();

// Check current config
console.log(sandbox.getConfig());
// {
//   cpuLimit: 50,
//   memoryLimit: 512,
//   ...
// }

// Update config
sandbox.updateConfig({
  cpuLimit: 75,
  memoryLimit: 1024,
  timeoutMs: 600000 // 10 minutes
});

// Check new config
console.log(sandbox.getConfig());
// {
//   cpuLimit: 75,
//   memoryLimit: 1024,
//   timeoutMs: 600000,
//   ...
// }
```

### Example 4: Resource-Intensive Task

```typescript
const sandbox = getSandbox({
  cpuLimit: 30,
  memoryLimit: 256,
  networkBandwidth: 5,
  timeoutMs: 60000
});

async function heavyComputation() {
  let result = 0;
  for (let i = 0; i < 1000000000; i++) {
    result += i;
  }
  return result;
}

try {
  const startTime = Date.now();
  const result = await heavyComputation();
  const elapsed = Date.now() - startTime;

  const limitsCheck = sandbox.checkLimits('heavy-task', {
    cpuUsage: 25,
    memoryUsage: 200,
    networkUsage: 0,
    diskWriteMB: 0,
    elapsedTimeMs: elapsed
  });

  console.log('Task completed:', limitsCheck.allowed);
} catch (error) {
  console.error('Task failed:', error.message);
}
```

## Integration with CoreAgentSkill

### Security Guard Integration

```typescript
async security_guard(action: any): Promise<boolean> {
  const sandbox = getSandbox();

  // Check command whitelist
  if (action.type === 'exec') {
    if (!sandbox.isCommandAllowed(action.command)) {
      return false;
    }
  }

  // Check task limits (for sub-agents)
  if (action.type === 'subagent') {
    const limitsCheck = sandbox.checkLimits(action.taskId, action.usage);
    if (!limitsCheck.allowed) {
      return false;
    }
  }

  return true;
}
```

## Best Practices

1. **Set appropriate limits:** Don't set limits too low (tasks will fail), don't set too high (no isolation)
2. **Monitor usage:** Use `getStats()` to track resource usage
3. **Check before execution:** Always check limits before starting a task
4. **Kill tasks safely:** Use `killTask()` to stop runaway tasks
5. **Update limits dynamically:** Adjust limits based on task requirements
6. **Use command whitelist:** Restrict commands to prevent malicious execution

## Security Considerations

- **CPU limits** prevent CPU hogging
- **Memory limits** prevent memory exhaustion
- **Network limits** prevent network flooding
- **Timeout limits** prevent infinite loops
- **Disk limits** prevent disk exhaustion
- **Command whitelist** restricts allowed commands
- **Process isolation** prevents cross-task interference

## Performance Considerations

- **Memory:** Each running task adds ~100 bytes (taskId + metrics)
- **Lookup:** O(1) for task tracking
- **Limit checks:** O(1) per check

## Future Enhancements

- [ ] Real resource monitoring (CPU, memory, network)
- [ ] Dynamic limit adjustment based on system load
- [ ] Resource quota per user
- [ ] Detailed usage reports
- [ ] Integration with process managers (pm2, docker)

## Dependencies

None

## License

MIT
