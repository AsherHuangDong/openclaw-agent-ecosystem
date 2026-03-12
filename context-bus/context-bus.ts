/**
 * Context Bus — Scoped, TTL-based Context Management
 * v2.0.0
 *
 * Features:
 * - Scoped context (GLOBAL / TASK / STEP)
 * - TTL-based expiration
 * - Automatic cleanup
 * - Thread-safe operations
 */

export type ContextScope = 'GLOBAL' | 'TASK' | 'STEP';

export interface ContextValue {
  value: any;
  scope: ContextScope;
  ttl: number; // milliseconds
  createdAt: number;
  updatedAt: number;
}

export interface ContextOptions {
  defaultScope?: ContextScope;
  defaultTTL?: number;
  autoCleanup?: boolean;
}

export class ContextBus {
  private store: Map<string, ContextValue> = new Map();
  private defaultScope: ContextScope;
  private defaultTTL: number;
  private autoCleanup: boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: ContextOptions = {}) {
    this.defaultScope = options.defaultScope ?? 'GLOBAL';
    this.defaultTTL = options.defaultTTL ?? 3600000; // 1 hour
    this.autoCleanup = options.autoCleanup ?? true;

    if (this.autoCleanup) {
      this.startCleanup();
    }
  }

  /**
   * Set context value with scope and TTL
   */
  set(
    key: string,
    value: any,
    scope?: ContextScope,
    ttl?: number
  ): void {
    const contextScope = scope ?? this.defaultScope;
    const contextTTL = ttl ?? this.defaultTTL;

    this.store.set(key, {
      value,
      scope: contextScope,
      ttl: contextTTL,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  /**
   * Get context value (returns undefined if expired or not found)
   */
  get(key: string): any {
    const entry = this.store.get(key);

    if (!entry) return undefined;

    // Check expiration
    if (this._isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }

    // Update last accessed time
    entry.updatedAt = Date.now();

    return entry.value;
  }

  /**
   * Get context value with metadata
   */
  getWithMetadata(key: string): { value: any; scope: ContextScope; ttl: number; expiresAt: number } | undefined {
    const entry = this.store.get(key);

    if (!entry) return undefined;

    if (this._isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }

    return {
      value: entry.value,
      scope: entry.scope,
      ttl: entry.ttl,
      expiresAt: entry.createdAt + entry.ttl
    };
  }

  /**
   * Check if key exists (not expired)
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (this._isExpired(entry)) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete context value
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Get all values for a specific scope
   */
  getByScope(scope: ContextScope): Map<string, any> {
    const result = new Map();

    for (const [key, entry] of this.store) {
      if (entry.scope === scope && !this._isExpired(entry)) {
        result.set(key, entry.value);
      }
    }

    return result;
  }

  /**
   * Delete all values for a specific scope
   */
  clearScope(scope: ContextScope): void {
    for (const [key, entry] of this.store) {
      if (entry.scope === scope) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Delete all expired entries
   */
  clearExpired(): void {
    for (const [key, entry] of this.store) {
      if (this._isExpired(entry)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get all entries (not expired)
   */
  getAll(): Map<string, ContextValue> {
    const result = new Map();

    for (const [key, entry] of this.store) {
      if (!this._isExpired(entry)) {
        result.set(key, entry);
      }
    }

    return result;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number;
    byScope: Record<ContextScope, number>;
    expiredEntries: number;
    oldestEntryAge: number;
  } {
    let totalEntries = 0;
    let expiredEntries = 0;
    const byScope: Record<ContextScope, number> = { GLOBAL: 0, TASK: 0, STEP: 0 };
    let oldestEntryAge = 0;

    for (const entry of this.store.values()) {
      if (this._isExpired(entry)) {
        expiredEntries++;
      } else {
        totalEntries++;
        byScope[entry.scope]++;
      }

      const age = Date.now() - entry.createdAt;
      if (age > oldestEntryAge) {
        oldestEntryAge = age;
      }
    }

    return {
      totalEntries,
      byScope,
      expiredEntries,
      oldestEntryAge
    };
  }

  /**
   * Set default scope
   */
  setDefaultScope(scope: ContextScope): void {
    this.defaultScope = scope;
  }

  /**
   * Set default TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * Start automatic cleanup (runs every 5 minutes)
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check if entry is expired
   */
  private _isExpired(entry: ContextValue): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }
}

// Singleton instance
let contextBusInstance: ContextBus | null = null;

export function getContextBus(options?: ContextOptions): ContextBus {
  if (!contextBusInstance) {
    contextBusInstance = new ContextBus(options);
  }
  return contextBusInstance;
}
