/**
 * Peer Shared Learning Source
 * v1.0.0
 *
 * 多Agent间经验共享模块
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// 类型定义
// ============================================

export interface PeerSharedRecord {
  id: string;
  source_agent: string;
  target_agent: string;
  timestamp: number;
  experience_type: 'success' | 'failure' | 'insight';
  content: {
    task_context: string;
    approach: string;
    outcome: string;
    lesson: string;
  };
  confidence: number;
  verified: boolean;
  cross_validated: boolean;
  tags: string[];
}

export interface PeerSharedConfig {
  enabled: boolean;
  quarantineDir: string;
  validatedDir: string;
  autoValidate: boolean;
  minConfidence: number;
  crossValidationThreshold: number;
}

const DEFAULT_CONFIG: PeerSharedConfig = {
  enabled: true,
  quarantineDir: './state/peer-inbox',
  validatedDir: './learning/peer-shared',
  autoValidate: true,
  minConfidence: 0.6,
  crossValidationThreshold: 0.7
};

// ============================================
// Peer Shared 管理器
// ============================================

export class PeerSharedManager {
  private config: PeerSharedConfig;
  private quarantineRecords: Map<string, PeerSharedRecord> = new Map();
  private validatedRecords: Map<string, PeerSharedRecord> = new Map();

  constructor(config: Partial<PeerSharedConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize(): void {
    // 确保目录存在
    [this.config.quarantineDir, this.config.validatedDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 加载已有记录
    this.loadQuarantineRecords();
    this.loadValidatedRecords();

    console.log('[PeerShared] Initialized:', {
      quarantine: this.quarantineRecords.size,
      validated: this.validatedRecords.size
    });
  }

  // ============================================
  // 接收经验
  // ============================================

  /**
   * 接收来自其他Agent的经验
   */
  ingest(record: Omit<PeerSharedRecord, 'id' | 'timestamp' | 'verified' | 'cross_validated'>): {
    id: string;
    status: 'quarantined' | 'rejected' | 'validated';
  } {
    if (!this.config.enabled) {
      return { id: '', status: 'rejected' };
    }

    const fullRecord: PeerSharedRecord = {
      ...record,
      id: `PS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      verified: false,
      cross_validated: false
    };

    // 安全检查
    if (this.containsSensitiveData(fullRecord)) {
      console.log('[PeerShared] Rejected: contains sensitive data');
      return { id: fullRecord.id, status: 'rejected' };
    }

    // 置信度检查
    if (fullRecord.confidence < this.config.minConfidence) {
      console.log('[PeerShared] Rejected: low confidence');
      return { id: fullRecord.id, status: 'rejected' };
    }

    // 进入隔离区
    this.quarantineRecords.set(fullRecord.id, fullRecord);
    this.saveQuarantineRecord(fullRecord);

    console.log('[PeerShared] Quarantined:', fullRecord.id);
    return { id: fullRecord.id, status: 'quarantined' };
  }

  // ============================================
  // 交叉验证
  // ============================================

  /**
   * 交叉验证 - 与自身经验对比
   */
  crossValidate(recordId: string, selfExperiences: Array<{
    content: string;
    outcome: string;
  }>): {
    passed: boolean;
    conflicts: string[];
  } {
    const record = this.quarantineRecords.get(recordId);
    if (!record) {
      return { passed: false, conflicts: ['Record not found'] };
    }

    const conflicts: string[] = [];

    // 检查是否有冲突
    for (const selfExp of selfExperiences) {
      const similarity = this.computeSimilarity(
        record.content.lesson,
        selfExp.content
      );

      // 如果高相似度但结论相反
      if (similarity > 0.7 && this.isContradictory(record.content.outcome, selfExp.outcome)) {
        conflicts.push(`Conflicts with self experience: ${selfExp.content.substring(0, 50)}...`);
      }
    }

    const passed = conflicts.length === 0;
    record.cross_validated = passed;

    if (passed && this.config.autoValidate) {
      this.promoteToValidated(recordId);
    }

    return { passed, conflicts };
  }

  /**
   * 批量交叉验证
   */
  batchCrossValidate(selfExperiences: Array<{ content: string; outcome: string }>): {
    validated: number;
    rejected: number;
  } {
    let validated = 0;
    let rejected = 0;

    for (const [id, record] of this.quarantineRecords) {
      const result = this.crossValidate(id, selfExperiences);
      if (result.passed) {
        validated++;
      } else {
        rejected++;
        console.log(`[PeerShared] Rejected ${id}:`, result.conflicts);
      }
    }

    console.log(`[PeerShared] Batch validation: ${validated} validated, ${rejected} rejected`);
    return { validated, rejected };
  }

  // ============================================
  // 提升/拒绝
  // ============================================

  private promoteToValidated(recordId: string): void {
    const record = this.quarantineRecords.get(recordId);
    if (!record) return;

    record.verified = true;
    this.validatedRecords.set(recordId, record);
    this.quarantineRecords.delete(recordId);

    // 保存到验证目录
    this.saveValidatedRecord(record);

    // 从隔离目录删除
    const quarantinePath = path.join(this.config.quarantineDir, `${recordId}.json`);
    if (fs.existsSync(quarantinePath)) {
      fs.unlinkSync(quarantinePath);
    }

    console.log('[PeerShared] Promoted:', recordId);
  }

  reject(recordId: string, reason: string): void {
    const record = this.quarantineRecords.get(recordId);
    if (!record) return;

    // 标记为拒绝并记录原因
    const rejectRecord = {
      ...record,
      rejected: true,
      reject_reason: reason,
      rejected_at: Date.now()
    };

    // 保存拒绝记录
    const rejectPath = path.join(this.config.quarantineDir, 'rejected', `${recordId}.json`);
    const rejectDir = path.dirname(rejectPath);
    if (!fs.existsSync(rejectDir)) {
      fs.mkdirSync(rejectDir, { recursive: true });
    }
    fs.writeFileSync(rejectPath, JSON.stringify(rejectRecord, null, 2));

    this.quarantineRecords.delete(recordId);
    console.log('[PeerShared] Rejected:', recordId, reason);
  }

  // ============================================
  // 查询
  // ============================================

  getValidatedRecords(options?: {
    sourceAgent?: string;
    experienceType?: 'success' | 'failure' | 'insight';
    tags?: string[];
    limit?: number;
  }): PeerSharedRecord[] {
    let records = Array.from(this.validatedRecords.values());

    if (options?.sourceAgent) {
      records = records.filter(r => r.source_agent === options.sourceAgent);
    }
    if (options?.experienceType) {
      records = records.filter(r => r.experience_type === options.experienceType);
    }
    if (options?.tags && options.tags.length > 0) {
      records = records.filter(r => 
        options.tags!.some(tag => r.tags.includes(tag))
      );
    }

    records.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return records;
  }

  getQuarantineRecords(): PeerSharedRecord[] {
    return Array.from(this.quarantineRecords.values());
  }

  // ============================================
  // 统计
  // ============================================

  getStats(): {
    quarantineCount: number;
    validatedCount: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};

    this.validatedRecords.forEach(r => {
      byAgent[r.source_agent] = (byAgent[r.source_agent] || 0) + 1;
      byType[r.experience_type] = (byType[r.experience_type] || 0) + 1;
    });

    return {
      quarantineCount: this.quarantineRecords.size,
      validatedCount: this.validatedRecords.size,
      byAgent,
      byType
    };
  }

  // ============================================
  // 持久化
  // ============================================

  private loadQuarantineRecords(): void {
    if (!fs.existsSync(this.config.quarantineDir)) return;

    fs.readdirSync(this.config.quarantineDir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(this.config.quarantineDir, f), 'utf-8')
          );
          this.quarantineRecords.set(data.id, data);
        } catch (e) {
          // ignore
        }
      });
  }

  private loadValidatedRecords(): void {
    if (!fs.existsSync(this.config.validatedDir)) return;

    fs.readdirSync(this.config.validatedDir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => {
        try {
          const data = JSON.parse(
            fs.readFileSync(path.join(this.config.validatedDir, f), 'utf-8')
          );
          this.validatedRecords.set(data.id, data);
        } catch (e) {
          // ignore
        }
      });
  }

  private saveQuarantineRecord(record: PeerSharedRecord): void {
    const filePath = path.join(this.config.quarantineDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  private saveValidatedRecord(record: PeerSharedRecord): void {
    const filePath = path.join(this.config.validatedDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  // ============================================
  // 工具方法
  // ============================================

  private containsSensitiveData(record: PeerSharedRecord): boolean {
    const sensitivePatterns = [
      /password/i,
      /api[_-]?key/i,
      /secret/i,
      /token/i,
      /credential/i,
      /\d{16,}/  // 长数字串（可能是卡号等）
    ];

    const content = JSON.stringify(record).toLowerCase();
    return sensitivePatterns.some(p => p.test(content));
  }

  private computeSimilarity(a: string, b: string): number {
    // 简单的词重叠相似度
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private isContradictory(a: string, b: string): boolean {
    const contradictionPairs = [
      ['success', 'failed'],
      ['pass', 'fail'],
      ['works', 'broken'],
      ['good', 'bad'],
      ['safe', 'unsafe'],
      ['allowed', 'blocked']
    ];

    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    return contradictionPairs.some(([pos, neg]) => 
      (aLower.includes(pos) && bLower.includes(neg)) ||
      (aLower.includes(neg) && bLower.includes(pos))
    );
  }
}

// ============================================
// 单例
// ============================================

let peerSharedInstance: PeerSharedManager | null = null;

export function getPeerSharedManager(config?: Partial<PeerSharedConfig>): PeerSharedManager {
  if (!peerSharedInstance) {
    peerSharedInstance = new PeerSharedManager(config);
  }
  return peerSharedInstance;
}
