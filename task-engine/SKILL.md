# Task Engine Skill

**Version:** 2.0.0
**Type:** Core Module
**Category:** Orchestration

## Description

Persistent task state management with automatic retry, dependency tracking, and task lifecycle management. Supports Mem0 persistence for cross-session task recovery.

## Features

- **State Machine:** PENDING → RUNNING → WAITING → FAILED → COMPLETED → CANCELLED
- **Priority Queue:** LOW / NORMAL / HIGH / CRITICAL
- **Dependency Tracking:** Automatic dependency satisfaction checking
- **Retry Logic:** Exponential backoff with configurable max retries
- **Timeout Support:** Configurable task timeout per task or globally
- **Mem0 Persistence:** Optional persistent storage for task recovery

## Installation

```bash
npm install uuid
```

## Usage

### Basic Task Creation

```typescript
import { getTaskEngine } from './task-engine';

const taskEngine = getTaskEngine();

// Create a task
const task = taskEngine.createTask({
  name: 'Generate report',
  description: 'Monthly sales report',
  priority: 'HIGH',
  metadata: { owner: 'john' }
});

console.log(`Task created: ${task.id}`);
```

### Task Execution with Retry

```typescript
// Execute task with automatic retry
async function executeTask(taskId: string) {
  const task = taskEngine.getTask(taskId);
  if (!task) throw new Error('Task not found');

  taskEngine.updateTaskStatus(taskId, 'RUNNING');

  try {
    // Your logic here
    const result = await doWork();

    taskEngine.setTaskCompleted(taskId, result);
    return result;
  } catch (error) {
    taskEngine.setTaskFailed(taskId, error.message);
    throw error;
  }
}

// Retry failed task
const task = await taskEngine.retryTask(taskId);
```

### Dependency Management

```typescript
// Create parent task
const parentTask = taskEngine.createTask({
  name: 'Main project',
  priority: 'HIGH'
});

// Create child tasks with dependency
const task1 = taskEngine.createTask({
  name: 'Research',
  dependencies: [parentTask.id]
});

const task2 = taskEngine.createTask({
  name: 'Development',
  dependencies: [parentTask.id]
});

// Check if ready to run
if (taskEngine.areDependenciesSatisfied(task2.id)) {
  taskEngine.resumeTask(task2.id);
}
```

### Priority Queue Processing

```typescript
// Get ready tasks sorted by priority
const readyTasks = taskEngine.getReadyTasks();

for (const task of readyTasks) {
  console.log(`Executing: ${task.name} (priority: ${task.priority})`);
  await executeTask(task.id);
}
```

### Mem0 Persistence

```typescript
// Enable Mem0 persistence
const taskEngine = getTaskEngine({
  useMem0: true,
  mem0Key: 'my_agent_tasks'
});

// Tasks persist across sessions
await taskEngine.loadFromMem0();
```

## API Reference

### TaskEngine Methods

| Method | Description |
|--------|-------------|
| `createTask(params)` | Create a new task |
| `updateTaskStatus(taskId, status, error?, result?)` | Update task status |
| `setTaskWaiting(taskId, reason?)` | Mark as waiting |
| `setTaskFailed(taskId, error)` | Mark as failed |
| `setTaskCompleted(taskId, result)` | Mark as completed |
| `retryTask(taskId)` | Retry failed task with backoff |
| `resumeTask(taskId)` | Resume waiting task |
| `cancelTask(taskId, reason?)` | Cancel task |
| `getTask(taskId)` | Get task by ID |
| `getTasks(filter?)` | Get all tasks (filtered) |
| `getPendingTasks()` | Get pending tasks sorted by priority |
| `getReadyTasks()` | Get ready-to-run tasks |
| `areDependenciesSatisfied(taskId)` | Check dependencies |

## Configuration

```typescript
const taskEngine = getTaskEngine({
  maxRetries: 3,              // Default max retries (default: 3)
  defaultTimeoutMs: 300000,   // Default timeout in ms (default: 5 min)
  useMem0: true,              // Enable Mem0 persistence
  mem0Key: 'my_tasks'         // Mem0 key for storage
});
```

## State Machine Flow

```
PENDING → RUNNING → (error) → FAILED
              ↓
           WAITING ← (dependencies not ready)
              ↓
           COMPLETED / CANCELLED
```

## Integration with CoreAgentSkill

Task Engine can be integrated as:

1. **External Task Manager:** Use for long-running workflows with pause/resume
2. **Memory Bridge:** Tasks stored in Mem0 persist across sessions
3. **Dependency Graph:** Complex multi-step workflows with automatic ordering

## Examples

### Example 1: Multi-step Workflow

```typescript
// Step 1: Create workflow
const workflow = taskEngine.createTask({
  name: 'Data pipeline',
  priority: 'HIGH'
});

// Step 2: Create dependent tasks
const ingest = taskEngine.createTask({
  name: 'Ingest data',
  dependencies: [workflow.id]
});

const transform = taskEngine.createTask({
  name: 'Transform data',
  dependencies: [ingest.id]
});

const load = taskEngine.createTask({
  name: 'Load to database',
  dependencies: [transform.id]
});

// Step 3: Process in order
for (const task of [ingest, transform, load]) {
  if (taskEngine.areDependenciesSatisfied(task.id)) {
    taskEngine.resumeTask(task.id);
    await executeTask(task.id);
  }
}
```

### Example 2: Error Recovery

```typescript
async function executeWithRetry(taskId: string, maxAttempts = 3) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const task = taskEngine.getTask(taskId);
      taskEngine.updateTaskStatus(taskId, 'RUNNING');

      const result = await doWork();

      taskEngine.setTaskCompleted(taskId, result);
      return result;
    } catch (error) {
      if (attempts < maxAttempts) {
        console.log(`Retry ${attempts}/${maxAttempts} for ${taskId}`);
        await taskEngine.retryTask(taskId);
      } else {
        taskEngine.setTaskFailed(taskId, error.message);
        throw error;
      }
    }
  }
}
```

## Performance Considerations

- **Memory:** Tasks stored in Map (O(1) lookup)
- **Persistence:** Mem0 writes are async and can be throttled
- **Dependencies:** Linear scan for dependency checks (O(n) per check)

## Future Enhancements

- [ ] Task scheduling with cron-like expressions
- [ ] Task result caching
- [ ] Task progress tracking
- [ ] Task sub-tasks (nested tasks)
- [ ] Task events/hooks for notifications

## Dependencies

- `uuid` for unique ID generation

## License

MIT
