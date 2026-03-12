/**
 * Mem0 Persistence Layer
 * v1.0.0
 *
 * 统一持久化层，支持：
 * - TaskEngine 任务状态持久化
 * - ContextBus 上下文快照持久化
 * - Learning 记录持久化
 * - Evolution 历史持久化
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// 持久化配置
// ============================================

export interface Mem0PersistConfig {
  enabled: boolean;
  backend: 'file' | 'api' | 'postgres';
  basePath: string;
  autoSaveInterval: number; // ms
  maxSnapshots: number;
  compression: boolean;
}

const DEFAULT_CONFIG: Mem0PersistConfig = {
  enabled: true,
  backend: 'file',
  basePath: './state/persist',
  autoSaveInterval: 60000, // 1分钟
  maxSnapshots: 100,
  compression: false
};

// ============================================
// 持久化数据结构
// ============================================

export interface PersistSnapshot {
  id: string;
  timestamp: number;
  type: 'task' | 'context' | 'learning' | 'evolution' | 'full';
  data: any;
  checksum: string;
  metadata: {
    version: string;
    source: string;
    size: number;
  };
}

export interface PersistResult {
  success: boolean;
  snapshotId?: string;
  path?: string;
  error?: string;
}

// ============================================
// Mem0 持久化层
// ============================================

export class Mem0Persist {
  private config: Mem0PersistConfig;
  private pendingWrites: Map<string, any> = new Map();
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: Partial<Mem0PersistConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  /**
   * 初始化持久化目录
   */
  private initialize(): void {
    if (!this.config.enabled) return;

    const dirs = [
      this.config.basePath,
      path.join(this.config.basePath, 'tasks'),
      path.join(this.config.basePath, 'context'),
      path.join(this.config.basePath, 'learning'),
      path.join(this.config.basePath, 'evolution'),
      path.join(this.config.basePath, 'snapshots')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 启动自动保存
    this.startAutoSave();

    console.log('[Mem0] Persistence layer initialized:', this.config.backend);
  }

  // ============================================
  // TaskEngine 持久化
  // ============================================

  /**
   * 保存任务状态
   */
  async saveTask(taskId: string, taskData: any): Promise<PersistResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Persistence disabled' };
    }

    const snapshot: PersistSnapshot = {
      id: `task-${taskId}-${Date.now()}`,
      timestamp: Date.now(),
      type: 'task',
      data: taskData,
      checksum: this.computeChecksum(taskData),
      metadata: {
        version: '1.0.0',
        source: 'TaskEngine',
        size: JSON.stringify(taskData).length
      }
    };

    return this.writeSnapshot('tasks', taskId, snapshot);
  }

  /**
   * 加载任务状态
   */
  async loadTask(taskId: string): Promise<any | null> {
    return this.loadSnapshot('tasks', taskId);
  }

  /**
   * 保存所有任务
   */
  async saveAllTasks(tasks: Map<string, any>): Promise<PersistResult[]> {
    const results: PersistResult[] = [];
    for (const [taskId, taskData] of tasks) {
      results.push(await this.saveTask(taskId, taskData));
    }
    return results;
  }

  // ============================================
  // ContextBus 持久化
  // ============================================

  /**
   * 保存上下文快照
   */
  async saveContext(scope: string, contextData: Map<string, any>): Promise<PersistResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Persistence disabled' };
    }

    const data = Object.fromEntries(contextData);
    const snapshot: PersistSnapshot = {
      id: `context-${scope}-${Date.now()}`,
      timestamp: Date.now(),
      type: 'context',
      data,
      checksum: this.computeChecksum(data),
      metadata: {
        version: '1.0.0',
        source: 'ContextBus',
        size: JSON.stringify(data).length
      }
    };

    return this.writeSnapshot('context', scope, snapshot);
  }

  /**
   * 加载上下文快照
   */
  async loadContext(scope: string): Promise<Map<string, any> | null> {
    const data = await this.loadSnapshot('context', scope);
    if (!data) return null;
    return new Map(Object.entries(data));
  }

  // ============================================
  // Learning 持久化
  // ============================================

  /**
   * 保存学习记录
   */
  async saveLearning(record: any): Promise<PersistResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Persistence disabled' };
    }

    const recordId = record.id || `learn-${Date.now()}`;
    const snapshot: PersistSnapshot = {
      id: recordId,
      timestamp: Date.now(),
      type: 'learning',
      data: record,
      checksum: this.computeChecksum(record),
      metadata: {
        version: '1.0.0',
        source: 'CoreAgentSkill',
        size: JSON.stringify(record).length
      }
    };

    return this.writeSnapshot('learning', recordId, snapshot);
  }

  /**
   * 批量保存学习记录
   */
  async saveLearningBatch(records: any[]): Promise<PersistResult[]> {
    const results: PersistResult[] = [];
    for (const record of records) {
      results.push(await this.saveLearning(record));
    }
    return results;
  }

  /**
   * 加载学习记录
   */
  async loadLearning(recordId: string): Promise<any | null> {
    return this.loadSnapshot('learning', recordId);
  }

  /**
   * 查询学习记录（按时间范围）
   */
  async queryLearning(options: {
    startDate?: number;
    endDate?: number;
    sourceType?: string;
    category?: string;
    limit?: number;
  }): Promise<any[]> {
    const learningDir = path.join(this.config.basePath, 'learning');
    if (!fs.existsSync(learningDir)) return [];

    const files = fs.readdirSync(learningDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // 最新优先

    const results: any[] = [];
    const limit = options.limit || 100;

    for (const file of files) {
      if (results.length >= limit) break;

      const data = JSON.parse(fs.readFileSync(path.join(learningDir, file), 'utf-8'));
      
      // 过滤条件
      if (options.startDate && data.timestamp < options.startDate) continue;
      if (options.endDate && data.timestamp > options.endDate) continue;
      if (options.sourceType && data.data?.source_type !== options.sourceType) continue;
      if (options.category && data.data?.category !== options.category) continue;

      results.push(data.data);
    }

    return results;
  }

  // ============================================
  // Evolution 持久化
  // ============================================

  /**
   * 保存进化提案
   */
  async saveEvolution(proposal: any): Promise<PersistResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Persistence disabled' };
    }

    const proposalId = proposal.proposal_id || `evo-${Date.now()}`;
    const snapshot: PersistSnapshot = {
      id: proposalId,
      timestamp: Date.now(),
      type: 'evolution',
      data: proposal,
      checksum: this.computeChecksum(proposal),
      metadata: {
        version: '1.0.0',
        source: 'EvolutionNode',
        size: JSON.stringify(proposal).length
      }
    };

    return this.writeSnapshot('evolution', proposalId, snapshot);
  }

  /**
   * 加载进化历史
   */
  async loadEvolutionHistory(limit: number = 50): Promise<any[]> {
    const evolutionDir = path.join(this.config.basePath, 'evolution');
    if (!fs.existsSync(evolutionDir)) return [];

    return fs.readdirSync(evolutionDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, limit)
      .map(f => JSON.parse(fs.readFileSync(path.join(evolutionDir, f), 'utf-8')).data);
  }

  // ============================================
  // 完整快照
  // ============================================

  /**
   * 创建完整快照
   */
  async createFullSnapshot(data: {
    tasks?: Map<string, any>;
    context?: Map<string, any>;
    learning?: any[];
    evolution?: any[];
  }): Promise<PersistResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Persistence disabled' };
    }

    const snapshotId = `full-${Date.now()}`;
    const fullData = {
      tasks: data.tasks ? Object.fromEntries(data.tasks) : {},
      context: data.context ? Object.fromEntries(data.context) : {},
      learning: data.learning || [],
      evolution: data.evolution || []
    };

    const snapshot: PersistSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      type: 'full',
      data: fullData,
      checksum: this.computeChecksum(fullData),
      metadata: {
        version: '1.0.0',
        source: 'FullSnapshot',
        size: JSON.stringify(fullData).length
      }
    };

    return this.writeSnapshot('snapshots', snapshotId, snapshot);
  }

  /**
   * 恢复完整快照
   */
  async restoreFullSnapshot(snapshotId: string): Promise<{
    tasks: Map<string, any>;
    context: Map<string, any>;
    learning: any[];
    evolution: any[];
  } | null> {
    const data = await this.loadSnapshot('snapshots', snapshotId);
    if (!data) return null;

    return {
      tasks: new Map(Object.entries(data.tasks || {})),
      context: new Map(Object.entries(data.context || {})),
      learning: data.learning || [],
      evolution: data.evolution || []
    };
  }

  // ============================================
  // 核心读写操作
  // ============================================

  private async writeSnapshot(
    category: string,
    id: string,
    snapshot: PersistSnapshot
  ): Promise<PersistResult> {
    // 串行化写入，避免并发冲突
    return new Promise((resolve) => {
      this.writeQueue = this.writeQueue.then(async () => {
        try {
          const filePath = path.join(this.config.basePath, category, `${id}.json`);
          fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
          
          // 清理旧快照
          this.cleanupOldSnapshots(category);
          
          resolve({
            success: true,
            snapshotId: snapshot.id,
            path: filePath
          });
        } catch (error: any) {
          resolve({
            success: false,
            error: error.message
          });
        }
      });
    });
  }

  private async loadSnapshot(category: string, id: string): Promise<any | null> {
    try {
      const filePath = path.join(this.config.basePath, category, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;

      const snapshot: PersistSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      // 校验 checksum
      const computed = this.computeChecksum(snapshot.data);
      if (computed !== snapshot.checksum) {
        console.warn(`[Mem0] Checksum mismatch for ${id}, data may be corrupted`);
      }

      return snapshot.data;
    } catch (error) {
      return null;
    }
  }

  // ============================================
  // 自动保存
  // ============================================

  private startAutoSave(): void {
    if (this.autoSaveTimer) return;

    this.autoSaveTimer = setInterval(() => {
      this.flushPendingWrites();
    }, this.config.autoSaveInterval);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 添加到待写入队列（批量写入优化）
   */
  addToPending(key: string, data: any): void {
    this.pendingWrites.set(key, data);
  }

  /**
   * 刷新待写入数据
   */
  private async flushPendingWrites(): Promise<void> {
    if (this.pendingWrites.size === 0) return;

    const pending = new Map(this.pendingWrites);
    this.pendingWrites.clear();

    for (const [key, data] of pending) {
      const [category, id] = key.split(':');
      if (category && id) {
        await this.writeSnapshot(category, id, {
          id: `${category}-${id}-${Date.now()}`,
          timestamp: Date.now(),
          type: category as any,
          data,
          checksum: this.computeChecksum(data),
          metadata: {
            version: '1.0.0',
            source: 'AutoSave',
            size: JSON.stringify(data).length
          }
        });
      }
    }
  }

  // ============================================
  // 清理与维护
  // ============================================

  private cleanupOldSnapshots(category: string): void {
    const dir = path.join(this.config.basePath, category);
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a));

    if (files.length > this.config.maxSnapshots) {
      const toDelete = files.slice(this.config.maxSnapshots);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(dir, f));
      });
    }
  }

  /**
   * 获取存储统计
   */
  getStats(): {
    totalFiles: number;
    totalSize: number;
    byCategory: Record<string, { count: number; size: number }>;
  } {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {} as Record<string, { count: number; size: number }>
    };

    const categories = ['tasks', 'context', 'learning', 'evolution', 'snapshots'];
    
    categories.forEach(cat => {
      const dir = path.join(this.config.basePath, cat);
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      let size = 0;
      files.forEach(f => {
        size += fs.statSync(path.join(dir, f)).size;
      });

      stats.byCategory[cat] = { count: files.length, size };
      stats.totalFiles += files.length;
      stats.totalSize += size;
    });

    return stats;
  }

  // ============================================
  // 工具方法
  // ============================================

  private computeChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 关闭持久化层
   */
  async close(): Promise<void> {
    this.stopAutoSave();
    await this.flushPendingWrites();
    console.log('[Mem0] Persistence layer closed');
  }
}

// ============================================
// 单例实例
// ============================================

let mem0Instance: Mem0Persist | null = null;

export function getMem0Persist(config?: Partial<Mem0PersistConfig>): Mem0Persist {
  if (!mem0Instance) {
    mem0Instance = new Mem0Persist(config);
  }
  return mem0Instance;
}
