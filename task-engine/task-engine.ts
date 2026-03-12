/**
 * Task Engine - Persistent Task State Management
 * v2.0.0
 *
 * Features:
 * - Task state machine: PENDING → RUNNING → WAITING → FAILED → COMPLETED
 * - Automatic retry with exponential backoff
 * - Task dependency tracking
 * - Mem0 persistence (optional)
 */

import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'PENDING' | 'RUNNING' | 'WAITING' | 'FAILED' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  parentId?: string;
  dependencies: string[];
  metadata: Record<string, any>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastError?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs?: number;
  result?: any;
}

export interface TaskEngineConfig {
  maxRetries?: number;
  defaultTimeoutMs?: number;
  useMem0?: boolean;
  mem0Key?: string;
}

export class TaskEngine {
  private tasks: Map<string, Task> = new Map();
  private config: Required<TaskEngineConfig>;

  constructor(config: TaskEngineConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 300000, // 5 minutes
      useMem0: config.useMem0 ?? false,
      mem0Key: config.mem0Key ?? 'task_engine_tasks',
    };
  }

  /**
   * Create a new task
   */
  createTask(params: {
    name: string;
    description?: string;
    priority?: TaskPriority;
    parentId?: string;
    dependencies?: string[];
    timeoutMs?: number;
    metadata?: Record<string, any>;
  }): Task {
    const task: Task = {
      id: uuidv4(),
      name: params.name,
      description: params.description,
      status: 'PENDING',
      priority: params.priority ?? 'NORMAL',
      parentId: params.parentId,
      dependencies: params.dependencies ?? [],
      metadata: params.metadata ?? {},
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      timeoutMs: params.timeoutMs ?? this.config.defaultTimeoutMs,
    };

    this.tasks.set(task.id, task);
    this._persist();
    return task;
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus, error?: string, result?: any): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const oldStatus = task.status;
    task.status = status;

    if (status === 'RUNNING' && !task.startedAt) {
      task.startedAt = Date.now();
    }

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      task.completedAt = Date.now();
    }

    if (error) task.lastError = error;
    if (result !== undefined) task.result = result;

    this._persist();
    return task;
  }

  /**
   * Mark task as waiting (dependencies not satisfied)
   */
  setTaskWaiting(taskId: string, reason?: string): Task | null {
    return this.updateTaskStatus(taskId, 'WAITING', undefined, { waitingReason: reason });
  }

  /**
   * Mark task as failed
   */
  setTaskFailed(taskId: string, error: string): Task | null {
    return this.updateTaskStatus(taskId, 'FAILED', error);
  }

  /**
   * Mark task as completed
   */
  setTaskCompleted(taskId: string, result: any): Task | null {
    return this.updateTaskStatus(taskId, 'COMPLETED', undefined, result);
  }

  /**
   * Retry failed task with exponential backoff
   */
  async retryTask(taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'FAILED') return null;

    if (task.retryCount >= task.maxRetries) {
      this.setTaskFailed(taskId, `Max retries (${task.maxRetries}) exceeded`);
      return null;
    }

    task.retryCount++;
    this.setTaskStatus(taskId, 'PENDING');

    // Exponential backoff
    const backoffMs = Math.pow(2, task.retryCount) * 5000;
    await this._sleep(backoffMs);

    return task;
  }

  /**
   * Resume waiting task
   */
  resumeTask(taskId: string): Task | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'WAITING') return null;

    this.updateTaskStatus(taskId, 'RUNNING');
    return task;
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string, reason?: string): Task | null {
    return this.updateTaskStatus(taskId, 'CANCELLED', reason);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks (optionally filtered by status)
   */
  getTasks(filter?: { status?: TaskStatus; parentId?: string }): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter?.parentId) {
      tasks = tasks.filter(t => t.parentId === filter.parentId);
    }

    return tasks;
  }

  /**
   * Get pending tasks sorted by priority
   */
  getPendingTasks(): Task[] {
    const priorityOrder: Record<TaskPriority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 };
    return this.getTasks({ status: 'PENDING' })
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  /**
   * Check if all dependencies are satisfied
   */
  areDependenciesSatisfied(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.dependencies.length === 0) return true;

    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && (depTask.status === 'COMPLETED' || depTask.status === 'CANCELLED');
    });
  }

  /**
   * Get pending tasks that have satisfied dependencies
   */
  getReadyTasks(): Task[] {
    return this.getPendingTasks().filter(task => this.areDependenciesSatisfied(task.id));
  }

  /**
   * Persist to Mem0 (optional)
   */
  private async _persist(): Promise<void> {
    if (!this.config.useMem0) return;

    // TODO: Implement Mem0 persistence
    // const mem0 = await Mem0.getInstance();
    // await mem0.save(this.config.mem0Key, Array.from(this.tasks.values()));
  }

  /**
   * Sleep utility
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load tasks from Mem0 (optional)
   */
  async loadFromMem0(): Promise<void> {
    if (!this.config.useMem0) return;

    // TODO: Implement Mem0 loading
    // const mem0 = await Mem0.getInstance();
    // const tasks = await mem0.load(this.config.mem0Key);
    // this.tasks = new Map(tasks.map(t => [t.id, t]));
  }

  /**
   * Clear all tasks
   */
  clearAll(): void {
    this.tasks.clear();
    this._persist();
  }
}

// Singleton instance
let taskEngineInstance: TaskEngine | null = null;

export function getTaskEngine(config?: TaskEngineConfig): TaskEngine {
  if (!taskEngineInstance) {
    taskEngineInstance = new TaskEngine(config);
  }
  return taskEngineInstance;
}
