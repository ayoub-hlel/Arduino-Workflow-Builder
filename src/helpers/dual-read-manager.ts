// Dual-Read Data Access Layer
// This layer provides fallback from Convex to Firebase during migration

import { getConvexClient } from '../stores/convex.store';
import { browser } from '$app/environment';

// Firebase fallback imports (would be actual Firebase in real migration)
// import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

/**
 * Data source enum
 */
export enum DataSource {
  CONVEX = 'convex',
  FIREBASE = 'firebase',
  CACHE = 'cache'
}

/**
 * Read result with source tracking
 */
export interface DataReadResult<T> {
  data: T | null;
  source: DataSource;
  timestamp: number;
  error?: string;
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Dual-read data access layer
 */
class DualReadManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTtl = 5 * 60 * 1000; // 5 minutes
  private preferConvex = true; // Prefer Convex over Firebase
  
  /**
   * Set data source preference
   */
  setPreference(preferConvex: boolean): void {
    this.preferConvex = preferConvex;
    console.log(`Data source preference: ${preferConvex ? 'Convex' : 'Firebase'}`);
  }

  /**
   * Get data with dual-read fallback
   */
  async getData<T>(
    cacheKey: string,
    convexQuery: () => Promise<T | null>,
    firebaseQuery: () => Promise<T | null>,
    ttl: number = this.defaultTtl
  ): Promise<DataReadResult<T>> {
    // Check cache first
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        source: DataSource.CACHE,
        timestamp: cached.timestamp
      };
    }

    // Try primary source based on preference
    if (this.preferConvex) {
      return await this.tryConvexThenFirebase(cacheKey, convexQuery, firebaseQuery, ttl);
    } else {
      return await this.tryFirebaseThenConvex(cacheKey, convexQuery, firebaseQuery, ttl);
    }
  }

  /**
   * Try Convex first, fallback to Firebase
   */
  private async tryConvexThenFirebase<T>(
    cacheKey: string,
    convexQuery: () => Promise<T | null>,
    firebaseQuery: () => Promise<T | null>,
    ttl: number
  ): Promise<DataReadResult<T>> {
    try {
      console.log(`Attempting Convex read for: ${cacheKey}`);
      const convexData = await convexQuery();
      
      if (convexData !== null) {
        this.setCache(cacheKey, convexData, ttl);
        return {
          data: convexData,
          source: DataSource.CONVEX,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn(`Convex read failed for ${cacheKey}, trying Firebase:`, error);
    }

    // Fallback to Firebase
    try {
      console.log(`Attempting Firebase fallback for: ${cacheKey}`);
      const firebaseData = await firebaseQuery();
      
      if (firebaseData !== null) {
        this.setCache(cacheKey, firebaseData, ttl);
        return {
          data: firebaseData,
          source: DataSource.FIREBASE,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error(`Firebase fallback failed for ${cacheKey}:`, error);
      return {
        data: null,
        source: DataSource.FIREBASE,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: 'No data found in either source'
    };
  }

  /**
   * Try Firebase first, fallback to Convex
   */
  private async tryFirebaseThenConvex<T>(
    cacheKey: string,
    convexQuery: () => Promise<T | null>,
    firebaseQuery: () => Promise<T | null>,
    ttl: number
  ): Promise<DataReadResult<T>> {
    try {
      console.log(`Attempting Firebase read for: ${cacheKey}`);
      const firebaseData = await firebaseQuery();
      
      if (firebaseData !== null) {
        this.setCache(cacheKey, firebaseData, ttl);
        return {
          data: firebaseData,
          source: DataSource.FIREBASE,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn(`Firebase read failed for ${cacheKey}, trying Convex:`, error);
    }

    // Fallback to Convex
    try {
      console.log(`Attempting Convex fallback for: ${cacheKey}`);
      const convexData = await convexQuery();
      
      if (convexData !== null) {
        this.setCache(cacheKey, convexData, ttl);
        return {
          data: convexData,
          source: DataSource.CONVEX,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error(`Convex fallback failed for ${cacheKey}:`, error);
      return {
        data: null,
        source: DataSource.CONVEX,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    return {
      data: null,
      source: DataSource.FIREBASE,
      timestamp: Date.now(),
      error: 'No data found in either source'
    };
  }

  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  /**
   * Set data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Global instance
let dualReadManager: DualReadManager | null = null;

/**
 * Get or create the global dual-read manager instance
 */
export function getDualReadManager(): DualReadManager {
  if (!dualReadManager) {
    dualReadManager = new DualReadManager();
  }
  return dualReadManager;
}

/**
 * Get user project with dual-read fallback
 */
export async function getProjectWithFallback(
  projectId: string,
  userId: string
): Promise<DataReadResult<any>> {
  const manager = getDualReadManager();
  const cacheKey = `project:${projectId}:${userId}`;

  return manager.getData(
    cacheKey,
    // Convex query
    async () => {
      try {
        const convexClient = getConvexClient();
        return await convexClient.query('projects:getProject', { projectId });
      } catch (error) {
        console.warn('Convex project query failed:', error);
        return null;
      }
    },
    // Firebase fallback query (mock implementation)
    async () => {
      try {
        console.log('MOCK: Firebase project fallback query');
        // In real migration, this would query Firebase
        // const db = getFirestore();
        // const docRef = doc(db, 'projects', projectId);
        // const docSnap = await getDoc(docRef);
        // return docSnap.exists() ? docSnap.data() : null;
        
        return null; // Mock: no Firebase data available
      } catch (error) {
        console.warn('Firebase project query failed:', error);
        return null;
      }
    }
  );
}

/**
 * Get user settings with dual-read fallback
 */
export async function getUserSettingsWithFallback(
  userId: string
): Promise<DataReadResult<any>> {
  const manager = getDualReadManager();
  const cacheKey = `settings:${userId}`;

  return manager.getData(
    cacheKey,
    // Convex query
    async () => {
      try {
        const convexClient = getConvexClient();
        return await convexClient.query('users:getUserSettings', { userId });
      } catch (error) {
        console.warn('Convex settings query failed:', error);
        return null;
      }
    },
    // Firebase fallback query (mock implementation)
    async () => {
      try {
        console.log('MOCK: Firebase settings fallback query');
        // In real migration, this would query Firebase
        // const db = getFirestore();
        // const docRef = doc(db, 'settings', userId);
        // const docSnap = await getDoc(docRef);
        // return docSnap.exists() ? docSnap.data() : null;

        return null; // Mock: no Firebase data available
      } catch (error) {
        console.warn('Firebase settings query failed:', error);
        return null;
      }
    }
  );
}

/**
 * Get user profile with dual-read fallback
 */
export async function getUserProfileWithFallback(
  userId: string
): Promise<DataReadResult<any>> {
  const manager = getDualReadManager();
  const cacheKey = `profile:${userId}`;

  return manager.getData(
    cacheKey,
    // Convex query
    async () => {
      try {
        const convexClient = getConvexClient();
        return await convexClient.query('users:getUserProfile', { userId });
      } catch (error) {
        console.warn('Convex profile query failed:', error);
        return null;
      }
    },
    // Firebase fallback query (mock implementation)
    async () => {
      try {
        console.log('MOCK: Firebase profile fallback query');
        // In real migration, this would query Firebase
        // const db = getFirestore();
        // const docRef = doc(db, 'profiles', userId);
        // const docSnap = await getDoc(docRef);
        // return docSnap.exists() ? docSnap.data() : null;

        return null; // Mock: no Firebase data available
      } catch (error) {
        console.warn('Firebase profile query failed:', error);
        return null;
      }
    }
  );
}

/**
 * Get user projects list with dual-read fallback
 */
export async function getUserProjectsWithFallback(
  userId: string
): Promise<DataReadResult<any[]>> {
  const manager = getDualReadManager();
  const cacheKey = `projects:user:${userId}`;

  return manager.getData(
    cacheKey,
    // Convex query
    async () => {
      try {
        const convexClient = getConvexClient();
        return await convexClient.query('projects:getUserProjects', { userId });
      } catch (error) {
        console.warn('Convex user projects query failed:', error);
        return null;
      }
    },
    // Firebase fallback query (mock implementation)
    async () => {
      try {
        console.log('MOCK: Firebase user projects fallback query');
        // In real migration, this would query Firebase
        // const db = getFirestore();
        // const projectsRef = collection(db, 'projects');
        // const q = query(projectsRef, where('userId', '==', userId));
        // const querySnapshot = await getDocs(q);
        // return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return []; // Mock: no Firebase data available
      } catch (error) {
        console.warn('Firebase user projects query failed:', error);
        return null;
      }
    }
  );
}

/**
 * Get project file with dual-read fallback
 */
export async function getProjectFileWithFallback(
  projectId: string,
  userId: string
): Promise<DataReadResult<{ content: string; filename: string }>> {
  const manager = getDualReadManager();
  const cacheKey = `file:${projectId}:${userId}`;

  return manager.getData(
    cacheKey,
    // Convex query
    async () => {
      try {
        const convexClient = getConvexClient();
        const fileData = await convexClient.query('projects:getProjectFile', { 
          projectId, 
          userId 
        });
        
        if (fileData && fileData.content) {
          return {
            content: fileData.content,
            filename: fileData.filename || `${projectId}.xml`
          };
        }
        return null;
      } catch (error) {
        console.warn('Convex file query failed:', error);
        return null;
      }
    },
    // Firebase fallback query (mock implementation)
    async () => {
      try {
        console.log('MOCK: Firebase file fallback query');
        // In real migration, this would query Firebase Storage
        // const storage = getStorage();
        // const fileRef = ref(storage, `${userId}/${projectId}.xml`);
        // const url = await getDownloadURL(fileRef);
        // const response = await fetch(url);
        // const content = await response.text();
        // return { content, filename: `${projectId}.xml` };

        return null; // Mock: no Firebase data available
      } catch (error) {
        console.warn('Firebase file query failed:', error);
        return null;
      }
    },
    10 * 60 * 1000 // 10 minutes cache for files
  );
}

/**
 * Configure dual-read behavior
 */
export function configureDualRead(options: {
  preferConvex?: boolean;
  defaultTtl?: number;
}): void {
  const manager = getDualReadManager();
  
  if (options.preferConvex !== undefined) {
    manager.setPreference(options.preferConvex);
  }
  
  if (options.defaultTtl !== undefined) {
    // @ts-ignore - accessing private property for configuration
    manager.defaultTtl = options.defaultTtl;
  }
}

/**
 * Clear all cached data
 */
export function clearDualReadCache(): void {
  const manager = getDualReadManager();
  manager.clearCache();
}

/**
 * Get cache statistics
 */
export function getDualReadCacheStats(): { size: number; keys: string[] } {
  const manager = getDualReadManager();
  return manager.getCacheStats();
}

/**
 * Health check for both data sources
 */
export async function checkDataSourceHealth(): Promise<{
  convex: { healthy: boolean; latency: number; error?: string };
  firebase: { healthy: boolean; latency: number; error?: string };
}> {
  const result = {
    convex: { healthy: false, latency: 0, error: undefined as string | undefined },
    firebase: { healthy: false, latency: 0, error: undefined as string | undefined }
  };

  // Test Convex
  try {
    const start = Date.now();
    const convexClient = getConvexClient();
    await convexClient.query('auth:getCurrentUser', {});
    result.convex.latency = Date.now() - start;
    result.convex.healthy = true;
  } catch (error) {
    result.convex.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Test Firebase (mock)
  try {
    const start = Date.now();
    // Mock Firebase health check
    await new Promise(resolve => setTimeout(resolve, 50));
    result.firebase.latency = Date.now() - start;
    result.firebase.healthy = false; // Mock: Firebase not available
    result.firebase.error = 'Firebase disabled during migration';
  } catch (error) {
    result.firebase.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}