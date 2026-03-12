/**
 * Sandbox Resource Limits
 * v2.0.0
 *
 * Features:
 * - CPU limits (percentage of core)
 * - Memory limits (MB)
 * - Network limits (bandwidth, connections)
 * - Timeout limits (per task)
 * - Disk limits (write operations)
 * - Process isolation (sub-process)
 */

export interface SandboxConfig {
  cpuLimit: number; // Percentage (0-100)
  memoryLimit: number; // MB
  networkBandwidth: number; // MB/s
  maxNetworkConnections: number;
  timeoutMs: number;
  maxDiskWriteMB: number;
  enableProcessIsolation: boolean;
  allowedCommands?: string[];
}

export interface SandboxLimits {
  cpuLimit: number;
  memoryLimit: number;
  networkBandwidth: number;
  maxNetworkConnections: number;
  timeoutMs: number;
  maxDiskWriteMB: number;
  enableProcessIsolation: boolean;
}

export class Sandbox {
  private config: SandboxConfig;
  private activeTasks: Map<string, {
    startTime: number;
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
  }> = new Map();

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  /**
   * Create sandbox limits for a task
   */
  createLimits(taskId: string): SandboxLimits {
    return {
      cpuLimit: this.config.cpuLimit,
      memoryLimit: this.config.memoryLimit,
      networkBandwidth: this.config.networkBandwidth,
      maxNetworkConnections: this.config.maxNetworkConnections,
      timeoutMs: this.config.timeoutMs,
      maxDiskWriteMB: this.config.maxDiskWriteMB,
      enableProcessIsolation: this.config.enableProcessIsolation
    };
  }

  /**
   * Check if task is within limits
   */
  checkLimits(taskId: string, usage: {
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
    diskWriteMB: number;
    elapsedTimeMs: number;
  }): { allowed: boolean; reason?: string } {
    const limits = this.createLimits(taskId);

    // Check CPU limit
    if (usage.cpuUsage > limits.cpuLimit) {
      return {
        allowed: false,
        reason: `CPU usage ${usage.cpuUsage}% exceeds limit ${limits.cpuLimit}%`
      };
    }

    // Check memory limit
    if (usage.memoryUsage > limits.memoryLimit) {
      return {
        allowed: false,
        reason: `Memory usage ${usage.memoryUsage}MB exceeds limit ${limits.memoryLimit}MB`
      };
    }

    // Check network bandwidth
    if (usage.networkUsage > limits.networkBandwidth) {
      return {
        allowed: false,
        reason: `Network bandwidth ${usage.networkUsage}MB/s exceeds limit ${limits.networkBandwidth}MB/s`
      };
    }

    // Check network connections
    if (usage.networkUsage > limits.maxNetworkConnections) {
      return {
        allowed: false,
        reason: `Network connections ${usage.networkUsage} exceeds limit ${limits.maxNetworkConnections}`
      };
    }

    // Check timeout
    if (usage.elapsedTimeMs > limits.timeoutMs) {
      return {
        allowed: false,
        reason: `Task timeout after ${usage.elapsedTimeMs}ms (limit: ${limits.timeoutMs}ms)`
      };
    }

    // Check disk write limit
    if (usage.diskWriteMB > limits.maxDiskWriteMB) {
      return {
        allowed: false,
        reason: `Disk write ${usage.diskWriteMB}MB exceeds limit ${limits.maxDiskWriteMB}MB`
      };
    }

    return { allowed: true };
  }

  /**
   * Start tracking task
   */
  startTask(taskId: string): void {
    this.activeTasks.set(taskId, {
      startTime: Date.now(),
      cpuUsage: 0,
      memoryUsage: 0,
      networkUsage: 0
    });
  }

  /**
   * Update task usage
   */
  updateTaskUsage(taskId: string, usage: {
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
    diskWriteMB?: number;
  }): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.cpuUsage = usage.cpuUsage;
    task.memoryUsage = usage.memoryUsage;
    task.networkUsage = usage.networkUsage;
    if (usage.diskWriteMB !== undefined) {
      task.diskWriteMB = usage.diskWriteMB;
    }
  }

  /**
   * Stop tracking task
   */
  stopTask(taskId: string): void {
    this.activeTasks.delete(taskId);
  }

  /**
   * Get task usage
   */
  getTaskUsage(taskId: string) {
    return this.activeTasks.get(taskId);
  }

  /**
   * Check if task is running
   */
  isTaskRunning(taskId: string): boolean {
    return this.activeTasks.has(taskId);
  }

  /**
   * Get all running tasks
   */
  getRunningTasks(): string[] {
    return Array.from(this.activeTasks.keys());
  }

  /**
   * Kill task (simulate)
   */
  killTask(taskId: string): void {
    this.stopTask(taskId);
  }

  /**
   * Get sandbox statistics
   */
  getStats(): {
    runningTasks: number;
    totalTasks: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
    avgNetworkUsage: number;
  } {
    if (this.activeTasks.size === 0) {
      return {
        runningTasks: 0,
        totalTasks: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        avgNetworkUsage: 0
      };
    }

    let totalCpu = 0;
    let totalMemory = 0;
    let totalNetwork = 0;

    for (const task of this.activeTasks.values()) {
      totalCpu += task.cpuUsage;
      totalMemory += task.memoryUsage;
      totalNetwork += task.networkUsage;
    }

    return {
      runningTasks: this.activeTasks.size,
      totalTasks: this.activeTasks.size,
      avgCpuUsage: totalCpu / this.activeTasks.size,
      avgMemoryUsage: totalMemory / this.activeTasks.size,
      avgNetworkUsage: totalNetwork / this.activeTasks.size
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Check if command is allowed
   */
  isCommandAllowed(command: string): boolean {
    if (!this.config.allowedCommands || this.config.allowedCommands.length === 0) {
      return true;
    }

    return this.config.allowedCommands.includes(command);
  }
}

// Default sandbox configuration
const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  cpuLimit: 50,
  memoryLimit: 512,
  networkBandwidth: 10,
  maxNetworkConnections: 10,
  timeoutMs: 300000, // 5 minutes
  maxDiskWriteMB: 100,
  enableProcessIsolation: true,
  allowedCommands: [
    'npm',
    'git',
    'node',
    'python',
    'curl',
    'wget',
    'ls',
    'cat',
    'grep',
    'find',
    'ps',
    'kill',
    'rm'
  ]
};

// Singleton instance
let sandboxInstance: Sandbox | null = null;

export function getSandbox(config?: Partial<SandboxConfig>): Sandbox {
  if (!sandboxInstance) {
    sandboxInstance = new Sandbox(config ?? DEFAULT_SANDBOX_CONFIG);
  } else if (config) {
    sandboxInstance.updateConfig(config);
  }
  return sandboxInstance;
}

// Export default config
export { DEFAULT_SANDBOX_CONFIG };
