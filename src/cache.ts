import Database from 'better-sqlite3';
import { CacheEntry, RouterConfig } from './types.js';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * SQLite-based cache for extracted documentation
 */
export class DocumentationCache {
  private db: Database.Database;
  private defaultTtl: number;

  constructor(config: RouterConfig = {}) {
    const cachePath = config.cachePath || './.api-context-router/cache.db';
    this.defaultTtl = (config.cacheTtl || 86400) * 1000; // Convert to ms

    // Ensure directory exists
    const dir = dirname(cachePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(cachePath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        method TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_url ON cache(url);
      CREATE INDEX IF NOT EXISTS idx_expires ON cache(expires_at);
    `);
  }

  /**
   * Generate a cache key from URL and optional intent
   */
  private generateKey(url: string, intent?: string): string {
    const input = intent ? `${url}:${intent}` : url;
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get(url: string, intent?: string): CacheEntry | null {
    const key = this.generateKey(url, intent);
    const now = Date.now();

    const row = this.db.prepare(
      'SELECT * FROM cache WHERE key = ? AND expires_at > ?'
    ).get(key, now) as {
      url: string;
      data: string;
      timestamp: number;
      expires_at: number;
    } | undefined;

    if (!row) {
      return null;
    }

    return {
      url: row.url,
      data: row.data,
      timestamp: row.timestamp,
      ttl: row.expires_at - now
    };
  }

  /**
   * Store data in cache
   */
  set(
    url: string,
    data: unknown,
    method: string,
    intent?: string,
    ttl?: number
  ): void {
    const key = this.generateKey(url, intent);
    const timestamp = Date.now();
    const expiresAt = timestamp + (ttl || this.defaultTtl);

    this.db.prepare(
      `INSERT OR REPLACE INTO cache (key, url, data, timestamp, expires_at, method)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      key,
      url,
      JSON.stringify(data),
      timestamp,
      expiresAt,
      method
    );
  }

  /**
   * Check if cache has valid entry
   */
  has(url: string, intent?: string): boolean {
    return this.get(url, intent) !== null;
  }

  /**
   * Delete a specific cache entry
   */
  delete(url: string, intent?: string): void {
    const key = this.generateKey(url, intent);
    this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
  }

  /**
   * Clear all expired entries
   */
  cleanup(): number {
    const result = this.db.prepare(
      'DELETE FROM cache WHERE expires_at <= ?'
    ).run(Date.now());
    return result.changes;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.db.prepare('DELETE FROM cache').run();
  }

  /**
   * Get cache statistics
   */
  getStats(): { total: number; expired: number } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM cache').get() as { count: number }).count;
    const expired = (this.db.prepare('SELECT COUNT(*) as count FROM cache WHERE expires_at <= ?').get(Date.now()) as { count: number }).count;
    return { total, expired };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Singleton instance
let cacheInstance: DocumentationCache | null = null;

export function getCache(config?: RouterConfig): DocumentationCache {
  if (!cacheInstance) {
    cacheInstance = new DocumentationCache(config);
  }
  return cacheInstance;
}

export function resetCache(): void {
  if (cacheInstance) {
    cacheInstance.close();
    cacheInstance = null;
  }
}
