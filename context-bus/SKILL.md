# Context Bus Skill

**Version:** 2.0.0
**Type:** Core Module
**Category:** Context Management

## Description

Scoped, TTL-based context management for OpenClaw agents. Supports GLOBAL / TASK / STEP scopes with automatic expiration and cleanup.

## Features

- **Scoped Context:** GLOBAL (session-wide), TASK (task-specific), STEP (step-level)
- **TTL-based Expiration:** Auto-delete expired entries
- **Automatic Cleanup:** Runs every 5 minutes by default
- **Thread-safe:** Map-based storage with O(1) operations
- **Metadata Tracking:** Scope, TTL, createdAt, updatedAt

## Installation

No dependencies required.

## Usage

### Basic Context Storage

```typescript
import { getContextBus } from './context-bus';

const contextBus = getContextBus();

// Set context value
contextBus.set('user_preferences', { theme: 'dark', language: 'zh-CN' });
contextBus.set('task_goal', 'Generate report', 'TASK', 7200000); // 2 hours
contextBus.set('step_input', 'Raw data', 'STEP', 1800000); // 30 minutes
```

### Context Retrieval

```typescript
// Get context value
const preferences = contextBus.get('user_preferences');
console.log(preferences); // { theme: 'dark', language: 'zh-CN' }

// Get with metadata
const metadata = contextBus.getWithMetadata('task_goal');
console.log(metadata);
// { value: 'Generate report', scope: 'TASK', ttl: 7200000, expiresAt: 1757526480000 }
```

### Scope Management

```typescript
// Get all values for a specific scope
const taskContext = contextBus.getByScope('TASK');
console.log(taskContext);
// Map { 'task_goal' => 'Generate report', 'task_progress' => 50 }

// Clear all values for a specific scope
contextBus.clearScope('STEP');
```

### Expiration Management

```typescript
// Check if key exists (returns false if expired)
const exists = contextBus.has('user_preferences');
console.log(exists); // true

// Delete expired entries
contextBus.clearExpired();

// Clear all context
contextBus.clear();
```

### Configuration

```typescript
// Create context bus with custom options
const contextBus = getContextBus({
  defaultScope: 'TASK',
  defaultTTL: 1800000, // 30 minutes
  autoCleanup: true
});
```

## API Reference

### Methods

| Method | Description |
|--------|-------------|
| `set(key, value, scope?, ttl?)` | Set context value with optional scope and TTL |
| `get(key)` | Get context value (returns undefined if expired) |
| `getWithMetadata(key)` | Get context value with metadata |
| `has(key)` | Check if key exists (not expired) |
| `delete(key)` | Delete context value |
| `getByScope(scope)` | Get all values for a specific scope |
| `clearScope(scope)` | Clear all values for a specific scope |
| `clearExpired()` | Delete all expired entries |
| `clear()` | Clear all context |
| `getAll()` | Get all entries (not expired) |
| `getStats()` | Get statistics |
| `setDefaultScope(scope)` | Set default scope |
| `setDefaultTTL(ttl)` | Set default TTL |

## Scopes

### GLOBAL
- **Purpose:** Session-wide context
- **Example:** User preferences, session settings
- **TTL:** Default (1 hour)

### TASK
- **Purpose:** Task-specific context
- **Example:** Task goal, task progress, task metadata
- **TTL:** Default (2 hours)

### STEP
- **Purpose:** Step-level context
- **Example:** Step input, step output, step reasoning
- **TTL:** Default (30 minutes)

## TTL Recommendations

| Context Type | Recommended TTL | Reason |
|--------------|----------------|--------|
| User preferences | 24 hours | Rarely changes |
| Session settings | 1 hour | May change frequently |
| Task goal | 2 hours | Task duration |
| Task progress | 1 hour | Updates frequently |
| Step input | 30 minutes | Short-lived |
| Step output | 30 minutes | Short-lived |

## Usage Examples

### Example 1: Task Context Management

```typescript
const contextBus = getContextBus();

// Set task context
contextBus.set('task_goal', 'Generate monthly sales report', 'TASK', 7200000);
contextBus.set('task_progress', 25, 'TASK', 1800000);
contextBus.set('task_dependencies', ['data_ingest', 'data_clean'], 'TASK', 3600000);

// Track progress
contextBus.set('task_progress', 50, 'TASK', 1800000);
contextBus.set('task_progress', 75, 'TASK', 1800000);

// Check progress
const progress = contextBus.get('task_progress');
console.log(`Progress: ${progress}%`);

// Clear task context when done
contextBus.clearScope('TASK');
```

### Example 2: Step-level Context

```typescript
const contextBus = getContextBus();

// Set step context
contextBus.set('step_input', 'Raw CSV data', 'STEP', 1800000);
contextBus.set('step_reasoning', 'Need to parse CSV first', 'STEP', 1800000);

// Process step
const result = processStep(contextBus.get('step_input'));

// Set step output
contextBus.set('step_output', result, 'STEP', 1800000);

// Use step output in next step
const nextInput = contextBus.get('step_output');
```

### Example 3: Global Context

```typescript
const contextBus = getContextBus();

// Set global preferences
contextBus.set('user_preferences', { theme: 'dark', language: 'zh-CN' }, 'GLOBAL', 86400000);
contextBus.set('session_start', Date.now(), 'GLOBAL', 3600000);

// Access preferences anywhere
const preferences = contextBus.get('user_preferences');
```

### Example 4: Automatic Cleanup

```typescript
const contextBus = getContextBus({
  defaultTTL: 60000, // 1 minute
  autoCleanup: true
});

// Set some values
contextBus.set('temp1', 'value1');
contextBus.set('temp2', 'value2');

// Wait 2 minutes
await new Promise(resolve => setTimeout(resolve, 120000));

// Check if expired
console.log(contextBus.has('temp1')); // false (expired)
console.log(contextBus.has('temp2')); // false (expired)
```

### Example 5: Statistics

```typescript
const contextBus = getContextBus();

// Set some values
contextBus.set('key1', 'value1', 'GLOBAL');
contextBus.set('key2', 'value2', 'TASK');
contextBus.set('key3', 'value3', 'STEP');

// Get statistics
const stats = contextBus.getStats();
console.log(stats);
// {
//   totalEntries: 3,
//   byScope: { GLOBAL: 1, TASK: 1, STEP: 1 },
//   expiredEntries: 0,
//   oldestEntryAge: 5000
// }
```

## Integration with CoreAgentSkill

### Perceive Node

```typescript
async perceive() {
  const contextBus = getContextBus();

  // Load session context
  contextBus.set('session_start', Date.now(), 'GLOBAL', 3600000);
  contextBus.set('agent_id', 'main', 'GLOBAL', 86400000);

  // Load task context
  contextBus.set('current_task', 'Generate report', 'TASK', 7200000);

  return contextBus.get('session_start');
}
```

### Plan Node

```typescript
async plan() {
  const contextBus = getContextBus();

  // Check task context
  const taskGoal = contextBus.get('task_goal', 'TASK');

  // Check step context
  const stepInput = contextBus.get('step_input', 'STEP');

  // Plan based on context
  if (taskGoal) {
    this.contextBus.set('planning_strategy', 'task-oriented', 'STEP', 1800000);
  }

  return this.contextBus.get('planning_strategy', 'STEP');
}
```

## Performance Considerations

- **Lookup:** O(1) for get/set/has
- **Scope filtering:** O(n) where n is number of entries in scope
- **Cleanup:** O(n) where n is total entries
- **Memory:** Each entry adds ~100 bytes (key + value + metadata)

## Best Practices

1. **Use appropriate scopes:** GLOBAL for session-wide, TASK for task-specific, STEP for step-level
2. **Set reasonable TTLs:** Don't set TTL too short (frequent cleanup), don't set too long (memory bloat)
3. **Clean up when done:** Call `clearScope()` or `clear()` when context is no longer needed
4. **Check expiration:** Use `has()` before `get()` to avoid fetching expired values
5. **Monitor usage:** Use `getStats()` to track memory usage and expiration patterns

## Future Enhancements

- [ ] Persistent storage (file-based or Mem0)
- [ ] Event notifications (when entry expires)
- [ ] Batch operations (set multiple keys at once)
- [ ] Key patterns (set/get by pattern)
- [ ] Compression for large values

## Dependencies

None

## License

MIT
