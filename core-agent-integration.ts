/**
 * CoreAgentSkill Integration Layer
 * v1.0.0
 * 
 * 集成 TaskEngine, ContextBus, Sandbox 到 CoreAgentSkill
 */

import { getTaskEngine } from './task-engine/task-engine';
import { getContextBus } from './context-bus/context-bus';
import { getSandbox } from './sandbox';

// ============================================
// 集成配置
// ============================================

export interface IntegrationConfig {
  taskEngine: {
    enabled: boolean;
    maxRetries: number;
    defaultTimeoutMs: number;
    useMem0: boolean;
  };
  contextBus: {
    enabled: boolean;
    defaultScope: 'GLOBAL' | 'TASK' | 'STEP';
    defaultTTL: number;
    autoCleanup: boolean;
  };
  sandbox: {
    enabled: boolean;
    cpuLimit: number;
    memoryLimit: number;
    networkBandwidth: number;
    maxNetworkConnections: number;
    timeoutMs: number;
    maxDiskWriteMB: number;
    enableProcessIsolation: boolean;
  };
}

const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  taskEngine: {
    enabled: true,
    maxRetries: 3,
    defaultTimeoutMs: 300000,
    useMem0: false
  },
  contextBus: {
    enabled: true,
    defaultScope: 'GLOBAL',
    defaultTTL: 3600000,
    autoCleanup: true
  },
  sandbox: {
    enabled: true,
    cpuLimit: 50,
    memoryLimit: 512,
    networkBandwidth: 10,
    maxNetworkConnections: 10,
    timeoutMs: 300000,
    maxDiskWriteMB: 100,
    enableProcessIsolation: true
  }
};

// ============================================
// CoreAgentSkill 集成器
// ============================================

export class CoreAgentIntegration {
  private taskEngine: any = null;
  private contextBus: any = null;
  private sandbox: any = null;
  private config: IntegrationConfig;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
    this.initialize();
  }

  /**
   * 初始化所有集成模块
   */
  private initialize(): void {
    // 初始化 TaskEngine
    if (this.config.taskEngine.enabled) {
      this.taskEngine = getTaskEngine({
        maxRetries: this.config.taskEngine.maxRetries,
        defaultTimeoutMs: this.config.taskEngine.defaultTimeoutMs,
        useMem0: this.config.taskEngine.useMem0
      });
      console.log('[INTEGRATION] TaskEngine initialized');
    }

    // 初始化 ContextBus
    if (this.config.contextBus.enabled) {
      this.contextBus = getContextBus({
        defaultScope: this.config.contextBus.defaultScope,
        defaultTTL: this.config.contextBus.defaultTTL,
        autoCleanup: this.config.contextBus.autoCleanup
      });
      console.log('[INTEGRATION] ContextBus initialized');
    }

    // 初始化 Sandbox
    if (this.config.sandbox.enabled) {
      this.sandbox = getSandbox({
        cpuLimit: this.config.sandbox.cpuLimit,
        memoryLimit: this.config.sandbox.memoryLimit,
        networkBandwidth: this.config.sandbox.networkBandwidth,
        maxNetworkConnections: this.config.sandbox.maxNetworkConnections,
        timeoutMs: this.config.sandbox.timeoutMs,
        maxDiskWriteMB: this.config.sandbox.maxDiskWriteMB,
        enableProcessIsolation: this.config.sandbox.enableProcessIsolation
      });
      console.log('[INTEGRATION] Sandbox initialized');
    }
  }

  // ============================================
  // TaskEngine 集成 - 用于 planner/actor/critic 节点
  // ============================================

  createPlanTask(goal: string, subtasks: string[]): string | null {
    if (!this.taskEngine) return null;
    
    const planTask = this.taskEngine.createTask({
      name: `plan:${goal.substring(0, 50)}`,
      description: `Planning for goal: ${goal}`,
      priority: 'HIGH',
      metadata: { subtasks, goal }
    });

    subtasks.forEach((subtask, index) => {
      this.taskEngine.createTask({
        name: `subtask:${index}`,
        description: subtask,
        priority: 'NORMAL',
        parentId: planTask.id,
        dependencies: index > 0 ? [`${planTask.id}-subtask-${index - 1}`] : [],
        metadata: { step: index }
      });
    });

    return planTask.id;
  }

  async executeTask(taskId: string, action: () => Promise<any>): Promise<any> {
    if (!this.taskEngine) return action();

    const task = this.taskEngine.getTask(taskId);
    if (!task) return action();

    if (!this.taskEngine.areDependenciesSatisfied(taskId)) {
      this.taskEngine.setTaskWaiting(taskId, 'Dependencies not satisfied');
      return null;
    }

    this.taskEngine.updateTaskStatus(taskId, 'RUNNING');

    try {
      const result = await action();
      this.taskEngine.setTaskCompleted(taskId, result);
      return result;
    } catch (error: any) {
      this.taskEngine.setTaskFailed(taskId, error.message);
      
      if (task.retryCount < task.maxRetries) {
        return this.taskEngine.retryTask(taskId);
      }
      
      throw error;
    }
  }

  evaluateTaskResult(taskId: string, evaluation: any): void {
    if (!this.taskEngine) return;
    const task = this.taskEngine.getTask(taskId);
    if (!task) return;
    this.taskEngine.updateTaskStatus(taskId, 'COMPLETED', undefined, {
      evaluation,
      evaluatedAt: Date.now()
    });
  }

  getReadyTasks(): string[] {
    if (!this.taskEngine) return [];
    return this.taskEngine.getReadyTasks().map((t: any) => t.id);
  }

  // ============================================
  // ContextBus 集成 - 用于 perceive/plan/act 节点
  // ============================================

  loadPerceptionContext(goal: string): any {
    if (!this.contextBus) return { goal };
    const globalContext = this.contextBus.getByScope('GLOBAL');
    const taskContext = this.contextBus.getByScope('TASK');
    const stepContext = this.contextBus.getByScope('STEP');
    return {
      goal,
      globalContext: Object.fromEntries(globalContext),
      taskContext: Object.fromEntries(taskContext),
      stepContext: Object.fromEntries(stepContext)
    };
  }

  setPlanContext(planId: string, plan: any): void {
    if (!this.contextBus) return;
    this.contextBus.set(`plan:${planId}`, plan, 'TASK', 1800000);
    if (plan.steps) {
      plan.steps.forEach((step: any, index: number) => {
        this.contextBus.set(`step:${planId}:${index}`, step, 'STEP', 300000);
      });
    }
  }

  updateActContext(stepId: string, result: any): void {
    if (!this.contextBus) return;
    this.contextBus.set(`result:${stepId}`, result, 'STEP', 300000);
    const stats = this.contextBus.get('stats:global') || { steps: 0, successes: 0, failures: 0 };
    stats.steps++;
    if (result.success) stats.successes++;
    else stats.failures++;
    this.contextBus.set('stats:global', stats, 'GLOBAL');
  }

  cleanupContext(): void {
    if (!this.contextBus) return;
    this.contextBus.clearExpired();
  }

  getContextStats(): any {
    if (!this.contextBus) return null;
    return this.contextBus.getStats();
  }

  // ============================================
  // Sandbox 集成 - 用于 security_guard 节点
  // ============================================

  checkActionAllowed(taskId: string, action: any): { allowed: boolean; reason?: string } {
    if (!this.sandbox) return { allowed: true };

    if (!this.sandbox.isTaskRunning(taskId)) {
      this.sandbox.startTask(taskId);
    }

    const currentUsage = this.sandbox.getTaskUsage(taskId) || {
      cpuUsage: 0,
      memoryUsage: 0,
      networkUsage: 0
    };

    const elapsed = Date.now() - (this.sandbox.getTaskUsage(taskId)?.startTime || Date.now());
    
    return this.sandbox.checkLimits(taskId, {
      cpuUsage: action.cpuUsage || currentUsage.cpuUsage,
      memoryUsage: action.memoryUsage || currentUsage.memoryUsage,
      networkUsage: action.networkUsage || currentUsage.networkUsage,
      diskWriteMB: action.diskWriteMB || 0,
      elapsedTimeMs: elapsed
    });
  }

  updateResourceUsage(taskId: string, usage: any): void {
    if (!this.sandbox) return;
    if (!this.sandbox.isTaskRunning(taskId)) {
      this.sandbox.startTask(taskId);
    }
    this.sandbox.updateTaskUsage(taskId, usage);
  }

  endTaskTracking(taskId: string): void {
    if (!this.sandbox) return;
    this.sandbox.stopTask(taskId);
  }

  getSandboxStats(): any {
    if (!this.sandbox) return null;
    return this.sandbox.getStats();
  }

  isCommandAllowed(command: string): boolean {
    if (!this.sandbox) return true;
    return this.sandbox.isCommandAllowed(command);
  }

  // ============================================
  // 综合状态报告
  // ============================================

  getStatusReport(): any {
    return {
      taskEngine: {
        enabled: this.config.taskEngine.enabled,
        stats: this.taskEngine ? {
          total: this.taskEngine.getTasks().length,
          pending: this.taskEngine.getTasks({ status: 'PENDING' }).length,
          running: this.taskEngine.getTasks({ status: 'RUNNING' }).length,
          completed: this.taskEngine.getTasks({ status: 'COMPLETED' }).length,
          failed: this.taskEngine.getTasks({ status: 'FAILED' }).length
        } : null
      },
      contextBus: {
        enabled: this.config.contextBus.enabled,
        stats: this.contextBus ? this.contextBus.getStats() : null
      },
      sandbox: {
        enabled: this.config.sandbox.enabled,
        stats: this.sandbox ? this.sandbox.getStats() : null
      }
    };
  }
}

// ============================================
// 单例实例
// ============================================

let integrationInstance: CoreAgentIntegration | null = null;

export function getCoreAgentIntegration(config?: Partial<IntegrationConfig>): CoreAgentIntegration {
  if (!integrationInstance) {
    integrationInstance = new CoreAgentIntegration(config);
  }
  return integrationInstance;
}
