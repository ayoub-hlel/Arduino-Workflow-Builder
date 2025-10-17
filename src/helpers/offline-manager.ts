// Offline Capability Manager
// Provides local storage caching and offline functionality for Arduino Workflow Builder

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { handleDatabaseError, type DatabaseError } from './database-error-handler';

/**
 * Offline capability states
 */
export enum OfflineStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SYNCING = 'syncing',
  ERROR = 'error'
}

/**
 * Cached item structure
 */
export interface CachedItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  version: number;
  checksum: string;
  dirty: boolean; // Has local changes not synced
  expiry?: number;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: DatabaseError[];
}

/**
 * Offline state interface
 */
export interface OfflineState {
  status: OfflineStatus;
  isOnline: boolean;
  lastSync: number;
  pendingChanges: number;
  cacheSize: number;
  autoSyncEnabled: boolean;
}

/**
 * Initial offline state
 */
const initialOfflineState: OfflineState = {
  status: OfflineStatus.ONLINE,
  isOnline: true,
  lastSync: 0,
  pendingChanges: 0,
  cacheSize: 0,
  autoSyncEnabled: true
};

/**
 * Offline state store
 */
export const offlineState = writable<OfflineState>(initialOfflineState);

/**
 * Offline capability manager
 */
export class OfflineManager {
  private static instance: OfflineManager | null = null;
  private cache = new Map<string, CachedItem>();
  private syncQueue = new Set<string>();
  private syncInProgress = false;
  private networkStatusListener: (() => void) | null = null;
  private autoSyncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeNetworkListener();
    this.loadCacheFromStorage();
    this.startAutoSync();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  /**
   * Initialize network status listener
   */
  private initializeNetworkListener(): void {
    if (!browser) return;

    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      const status = isOnline ? OfflineStatus.ONLINE : OfflineStatus.OFFLINE;
      
      offlineState.update(state => ({
        ...state,
        isOnline,
        status: this.syncInProgress ? OfflineStatus.SYNCING : status
      }));

      // Trigger sync when coming back online
      if (isOnline && this.syncQueue.size > 0) {
        this.syncPendingChanges();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial status check
    updateOnlineStatus();

    this.networkStatusListener = () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }

  /**
   * Load cache from localStorage
   */
  private loadCacheFromStorage(): void {
    if (!browser) return;

    try {
      const cacheData = localStorage.getItem('arduino_workflow_builder_offline_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        this.cache = new Map(Object.entries(parsed));
        
        // Clean expired items
        this.cleanExpiredItems();
        this.updateCacheStats();
      }
    } catch (error) {
      console.error('Failed to load offline cache:', error);
      this.clearCache();
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCacheToStorage(): void {
    if (!browser) return;

    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem('arduino_workflow_builder_offline_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Failed to save offline cache:', error);
      // If storage is full, try to clear old items
      this.cleanupOldItems();
    }
  }

  /**
   * Clean expired items from cache
   */
  private cleanExpiredItems(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && item.expiry < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache items`);
      this.saveCacheToStorage();
      this.updateCacheStats();
    }
  }

  /**
   * Cleanup old items when storage is full
   */
  private cleanupOldItems(): void {
    const sortedItems = Array.from(this.cache.entries())
      .filter(([_, item]) => !item.dirty) // Don't remove dirty items
      .sort(([_, a], [__, b]) => a.timestamp - b.timestamp);

    // Remove oldest 25% of clean items
    const toRemove = Math.floor(sortedItems.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(sortedItems[i][0]);
    }

    if (toRemove > 0) {
      console.log(`Cleaned up ${toRemove} old cache items`);
      this.saveCacheToStorage();
      this.updateCacheStats();
    }
  }

  /**
   * Update cache statistics
   */
  private updateCacheStats(): void {
    const pendingChanges = Array.from(this.cache.values()).filter(item => item.dirty).length;
    
    offlineState.update(state => ({
      ...state,
      cacheSize: this.cache.size,
      pendingChanges
    }));
  }

  /**
   * Start auto-sync interval
   */
  private startAutoSync(): void {
    if (!browser) return;

    this.autoSyncInterval = setInterval(() => {
      offlineState.subscribe(state => {
        if (state.autoSyncEnabled && state.isOnline && this.syncQueue.size > 0) {
          this.syncPendingChanges();
        }
      })();
    }, 30000); // Every 30 seconds
  }

  /**
   * Generate checksum for data
   */
  private generateChecksum(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cache data with expiry and versioning
   */
  async cacheItem<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number; // Time to live in milliseconds
      version?: number;
      markDirty?: boolean;
    } = {}
  ): Promise<void> {
    const { ttl, version = 1, markDirty = false } = options;
    
    const cachedItem: CachedItem<T> = {
      key,
      data,
      timestamp: Date.now(),
      version,
      checksum: this.generateChecksum(data),
      dirty: markDirty,
      expiry: ttl ? Date.now() + ttl : undefined
    };

    this.cache.set(key, cachedItem);
    
    if (markDirty) {
      this.syncQueue.add(key);
    }

    this.saveCacheToStorage();
    this.updateCacheStats();
  }

  /**
   * Get cached item
   */
  getCachedItem<T>(key: string): CachedItem<T> | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (item.expiry && item.expiry < Date.now()) {
      this.cache.delete(key);
      this.saveCacheToStorage();
      this.updateCacheStats();
      return null;
    }

    return item as CachedItem<T>;
  }

  /**
   * Get cached data directly
   */
  getCachedData<T>(key: string): T | null {
    const item = this.getCachedItem<T>(key);
    return item ? item.data : null;
  }

  /**
   * Update cached item and mark as dirty
   */
  async updateCachedItem<T>(key: string, data: T, version?: number): Promise<void> {
    const existing = this.getCachedItem<T>(key);
    const newVersion = version || (existing ? existing.version + 1 : 1);
    
    await this.cacheItem(key, data, { 
      version: newVersion, 
      markDirty: true 
    });
  }

  /**
   * Remove item from cache
   */
  removeCachedItem(key: string): boolean {
    const removed = this.cache.delete(key);
    this.syncQueue.delete(key);
    
    if (removed) {
      this.saveCacheToStorage();
      this.updateCacheStats();
    }
    
    return removed;
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.syncQueue.clear();
    
    if (browser) {
      localStorage.removeItem('arduino_workflow_builder_offline_cache');
    }
    
    this.updateCacheStats();
  }

  /**
   * Sync pending changes to server
   */
  async syncPendingChanges(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { success: false, synced: 0, failed: 0, errors: [] };
    }

    this.syncInProgress = true;
    offlineState.update(state => ({ ...state, status: OfflineStatus.SYNCING }));

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: []
    };

    try {
      const itemsToSync = Array.from(this.syncQueue);
      
      for (const key of itemsToSync) {
        const item = this.cache.get(key);
        if (!item || !item.dirty) {
          this.syncQueue.delete(key);
          continue;
        }

        try {
          // Here we would sync with the actual server
          // For now, simulate sync operation
          await this.simulateSync(key, item);
          
          // Mark as clean after successful sync
          item.dirty = false;
          item.timestamp = Date.now();
          this.cache.set(key, item);
          this.syncQueue.delete(key);
          result.synced++;
          
        } catch (error) {
          const dbError = handleDatabaseError(error, `sync:${key}`);
          result.errors.push(dbError);
          result.failed++;
          result.success = false;
        }
      }

      // Update last sync time
      offlineState.update(state => ({ 
        ...state, 
        lastSync: Date.now(),
        status: navigator.onLine ? OfflineStatus.ONLINE : OfflineStatus.OFFLINE
      }));

    } catch (error) {
      const dbError = handleDatabaseError(error, 'sync_operation');
      result.errors.push(dbError);
      result.success = false;
      
      offlineState.update(state => ({ ...state, status: OfflineStatus.ERROR }));
    } finally {
      this.syncInProgress = false;
      this.saveCacheToStorage();
      this.updateCacheStats();
    }

    return result;
  }

  /**
   * Simulate sync operation (replace with actual server sync)
   */
  private async simulateSync(key: string, item: CachedItem): Promise<void> {
    console.log(`Syncing ${key}:`, item.data);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    // Simulate occasional sync failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Sync failed: Network timeout');
    }
    
    console.log(`Successfully synced ${key}`);
  }

  /**
   * Get sync queue status
   */
  getSyncStatus(): {
    pending: number;
    inProgress: boolean;
    lastSync: number;
  } {
    let lastSync = 0;
    const unsubscribe = offlineState.subscribe(state => { lastSync = state.lastSync; });
    unsubscribe();

    return {
      pending: this.syncQueue.size,
      inProgress: this.syncInProgress,
      lastSync
    };
  }

  /**
   * Enable/disable auto-sync
   */
  setAutoSync(enabled: boolean): void {
    offlineState.update(state => ({ ...state, autoSyncEnabled: enabled }));
  }

  /**
   * Force immediate sync
   */
  async forcSync(): Promise<SyncResult> {
    return this.syncPendingChanges();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.networkStatusListener) {
      this.networkStatusListener();
    }
    
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    
    OfflineManager.instance = null;
  }
}

/**
 * Initialize offline manager
 */
export function initializeOfflineManager(): OfflineManager {
  return OfflineManager.getInstance();
}

/**
 * Offline-aware data access wrapper
 */
export async function withOfflineSupport<T>(
  key: string,
  onlineOperation: () => Promise<T>,
  options: {
    ttl?: number;
    fallbackData?: T;
    useCache?: boolean;
  } = {}
): Promise<T> {
  const { ttl, fallbackData, useCache = true } = options;
  const offlineManager = OfflineManager.getInstance();
  
  // Try cache first if offline or cache preferred
  if (useCache && (!navigator.onLine || useCache)) {
    const cached = offlineManager.getCachedData<T>(key);
    if (cached !== null) {
      // If offline, return cached data
      if (!navigator.onLine) {
        return cached;
      }
      
      // If online, try to refresh but return cached on failure
      try {
        const fresh = await onlineOperation();
        await offlineManager.cacheItem(key, fresh, { ttl });
        return fresh;
      } catch (error) {
        console.warn(`Failed to refresh ${key}, using cached data:`, error);
        return cached;
      }
    }
  }

  // Try online operation
  try {
    const result = await onlineOperation();
    
    // Cache successful result
    if (useCache) {
      await offlineManager.cacheItem(key, result, { ttl });
    }
    
    return result;
  } catch (error) {
    // If offline and we have fallback data, use it
    if (!navigator.onLine && fallbackData !== undefined) {
      await offlineManager.cacheItem(key, fallbackData, { ttl });
      return fallbackData;
    }
    
    throw error;
  }
}

/**
 * Current project offline manager
 */
export class ProjectOfflineManager {
  private offlineManager: OfflineManager;
  private currentProjectKey: string | null = null;

  constructor() {
    this.offlineManager = OfflineManager.getInstance();
  }

  /**
   * Set current project for offline caching
   */
  setCurrentProject(projectId: string): void {
    this.currentProjectKey = `project:${projectId}`;
  }

  /**
   * Save current project state offline
   */
  async saveProjectOffline(projectData: any): Promise<void> {
    if (!this.currentProjectKey) {
      throw new Error('No current project set');
    }

    await this.offlineManager.updateCachedItem(this.currentProjectKey, {
      ...projectData,
      lastModified: Date.now(),
      isOffline: true
    });
  }

  /**
   * Load current project from offline cache
   */
  getCurrentProjectOffline(): any | null {
    if (!this.currentProjectKey) {
      return null;
    }

    return this.offlineManager.getCachedData(this.currentProjectKey);
  }

  /**
   * Check if current project has offline changes
   */
  hasOfflineChanges(): boolean {
    if (!this.currentProjectKey) {
      return false;
    }

    const item = this.offlineManager.getCachedItem(this.currentProjectKey);
    return item ? item.dirty : false;
  }

  /**
   * Sync current project changes
   */
  async syncCurrentProject(): Promise<boolean> {
    if (!this.currentProjectKey || !this.hasOfflineChanges()) {
      return true;
    }

    const result = await this.offlineManager.syncPendingChanges();
    return result.success && result.errors.length === 0;
  }
}

// Derived stores for components
export const isOnline: Readable<boolean> = derived(
  offlineState,
  ($offlineState) => $offlineState.isOnline
);

export const offlineStatus: Readable<OfflineStatus> = derived(
  offlineState,
  ($offlineState) => $offlineState.status
);

export const pendingChanges: Readable<number> = derived(
  offlineState,
  ($offlineState) => $offlineState.pendingChanges
);

export const lastSyncTime: Readable<number> = derived(
  offlineState,
  ($offlineState) => $offlineState.lastSync
);

// Export singleton instances
export const offlineManager = OfflineManager.getInstance();
export const projectOfflineManager = new ProjectOfflineManager();