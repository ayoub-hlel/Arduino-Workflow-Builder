// Convex Client Store
// This file provides reactive Svelte stores for Convex database operations

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { getSessionToken } from '../auth/clerk-auth';
import { 
  withDatabaseRetry, 
  handleDatabaseError, 
  withOptimisticUpdate,
  withBatchOperation,
  type DatabaseError 
} from '../helpers/database-error-handler';

/**
 * Convex client interface - simplified for development
 * This will be replaced with actual Convex client once installed
 */
export interface ConvexClient {
  query: (name: string, args?: any) => Promise<any>;
  mutation: (name: string, args?: any) => Promise<any>;
  subscribe: (name: string, args?: any, callback?: (data: any) => void) => () => void;
}

/**
 * Connection state for Convex client
 */
export interface ConvexConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
}

/**
 * Initial connection state
 */
const initialConnectionState: ConvexConnectionState = {
  isConnected: false,
  isLoading: false,
  error: null,
  lastUpdated: 0
};

/**
 * Connection state store
 */
export const connectionState = writable<ConvexConnectionState>(initialConnectionState);

/**
 * Mock Convex client for development
 * This will be replaced with actual ConvexReactClient once Convex is installed
 */
class MockConvexClient implements ConvexClient {
  private baseUrl = 'http://127.0.0.1:3210'; // Local Convex deployment
  
  async query(name: string, args: any = {}): Promise<any> {
    return withDatabaseRetry(async () => {
      console.log(`Convex Query: ${name}`, args);
      
      // Simulate potential network issues (5% chance)
      if (Math.random() < 0.05) {
        throw new Error('Network connection failed');
      }
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Return mock data based on query name
      switch (name) {
        case 'projects:getUserProjects':
          return [];
        case 'projects:getProject':
          return null;
        case 'projects:getProjectFile':
          return {
            content: '<xml></xml>',
            workspace: '<xml></xml>',
            filename: 'project.xml',
            contentType: 'application/xml',
            size: 11,
            checksum: 'abc123'
          };
        case 'projects:getUserFiles':
          return [];
        case 'users:getUserSettings':
          return {
            autoSave: true,
            codeFont: 'Courier New',
            tutorialCompleted: false
          };
        case 'users:getUserProfile':
          return null;
        default:
          return null;
      }
    }, `query:${name}`, { args });
  }

  async mutation(name: string, args: any = {}): Promise<any> {
    return withDatabaseRetry(async () => {
      console.log(`Convex Mutation: ${name}`, args);
      
      // Get session token for authentication
      const token = await getSessionToken();
      if (!token && name !== 'auth:getCurrentUser') {
        const error = new Error('Authentication required');
        (error as any).code = 'UNAUTHENTICATED';
        throw error;
      }
      
      // Simulate potential network issues (3% chance)
      if (Math.random() < 0.03) {
        throw new Error('Network connection failed');
      }
      
      // Simulate validation errors for invalid data (2% chance)
      if (Math.random() < 0.02 && args && typeof args === 'object') {
        const error = new Error('Invalid data provided');
        (error as any).code = 'INVALID_ARGUMENT';
        throw error;
      }
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Return mock success responses
      switch (name) {
        case 'projects:createProject':
          return { _id: `project_${Date.now()}`, ...args };
        case 'projects:updateProject':
          return { success: true };
        case 'projects:deleteProject':
          return { success: true };
        case 'projects:saveProjectFile':
          return { success: true, storageId: `file_${Date.now()}` };
        case 'projects:deleteProjectFile':
          return { success: true };
        case 'users:updateUserSettings':
          return { success: true };
        case 'users:updateUserProfile':
          return { success: true };
        default:
          return { success: true };
      }
    }, `mutation:${name}`, { args });
  }

  subscribe(name: string, args: any = {}, callback?: (data: any) => void): () => void {
    console.log(`Convex Subscribe: ${name}`, args);
    
    // Mock subscription - call callback immediately with mock data
    if (callback) {
      setTimeout(() => {
        callback(null); // Mock empty data
      }, 100);
    }
    
    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribed from ${name}`);
    };
  }
}

/**
 * Convex client instance
 */
let convexClient: ConvexClient | null = null;

/**
 * Initialize Convex client
 */
export function initializeConvexClient(): void {
  if (!browser) return;

  try {
    console.log('🔧 Convex: Initializing client...');
    
    // Set loading state
    connectionState.set({
      isConnected: false,
      isLoading: true,
      error: null,
      lastUpdated: Date.now()
    });
    
    // Import Convex SDK dynamically in browser environment
    import('convex/browser').then(({ ConvexHttpClient }) => {
      const convexUrl = 'https://development.convex.cloud'; // TODO: Replace with real deployment URL
      
      if (!convexUrl || convexUrl.includes('development.convex.cloud')) {
        console.warn('⚠️ Convex: Using placeholder deployment URL. Please configure VITE_CONVEX_URL');
        // Use mock client for development
        convexClient = new MockConvexClient();
        connectionState.set({
          isConnected: true,
          isLoading: false,
          error: 'Using mock client (placeholder deployment URL)',
          lastUpdated: Date.now()
        });
        return;
      }

      try {
        // Initialize real Convex client
        const client = new ConvexHttpClient(convexUrl);
        convexClient = {
          query: async (name: string, args: any = {}) => {
            try {
              return await client.query(name as any, args);
            } catch (error) {
              console.error(`Convex query error (${name}):`, error);
              throw error;
            }
          },
          mutation: async (name: string, args: any = {}) => {
            try {
              return await client.mutation(name as any, args);
            } catch (error) {
              console.error(`Convex mutation error (${name}):`, error);
              throw error;
            }
          },
          subscribe: (name: string, args: any = {}, callback?: (data: any) => void) => {
            console.log(`Convex subscription not implemented in HTTP client: ${name}`);
            // HTTP client doesn't support subscriptions, would need WebSocket client
            if (callback) {
              setTimeout(() => callback(null), 100);
            }
            return () => {};
          }
        };
        
        // Test connection with a simple query
        client.query('_system/status' as any).then(() => {
          console.log('✅ Convex: Client connected successfully');
          connectionState.set({
            isConnected: true,
            isLoading: false,
            error: null,
            lastUpdated: Date.now()
          });
        }).catch((error) => {
          console.warn('⚠️ Convex: Connection test failed, using mock client');
          console.warn('Connection error:', error);
          // Fall back to mock client
          convexClient = new MockConvexClient();
          connectionState.set({
            isConnected: true,
            isLoading: false,
            error: 'Using mock client (connection test failed)',
            lastUpdated: Date.now()
          });
        });
        
        // Store client instance globally for debugging
        if (typeof window !== 'undefined') {
          (window as any).convex = client;
        }
        
      } catch (error) {
        console.error('❌ Convex: Failed to create client', error);
        // Fall back to mock client
        convexClient = new MockConvexClient();
        connectionState.set({
          isConnected: true,
          isLoading: false,
          error: `Client creation failed: ${error}`,
          lastUpdated: Date.now()
        });
      }
      
    }).catch((error) => {
      console.error('❌ Convex: Failed to import SDK', error);
      // Fall back to mock client
      convexClient = new MockConvexClient();
      connectionState.set({
        isConnected: true,
        isLoading: false,
        error: 'Failed to load Convex SDK',
        lastUpdated: Date.now()
      });
    });
    
  } catch (error) {
    console.error('❌ Convex: Initialization error', error);
    // Fall back to mock client
    convexClient = new MockConvexClient();
    connectionState.set({
      isConnected: true,
      isLoading: false,
      error: 'Convex initialization failed',
      lastUpdated: Date.now()
    });
  }
}

/**
 * Get Convex client instance
 */
export function getConvexClient(): ConvexClient {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call initializeConvexClient() first.');
  }
  return convexClient;
}

/**
 * Reactive query hook with comprehensive error handling
 * Returns a readable store that updates when the query result changes
 */
export function createQuery<T>(queryName: string, args: any = {}): Readable<{
  data: T | null;
  isLoading: boolean;
  error: DatabaseError | null;
  lastUpdated: number;
}> {
  const store = writable({
    data: null as T | null,
    isLoading: true,
    error: null as DatabaseError | null,
    lastUpdated: 0
  });

  if (browser && convexClient) {
    // Execute query immediately
    convexClient.query(queryName, args)
      .then(data => {
        store.set({ 
          data, 
          isLoading: false, 
          error: null, 
          lastUpdated: Date.now() 
        });
      })
      .catch(error => {
        const dbError = error instanceof Error ? 
          handleDatabaseError(error, `query:${queryName}`, { args }) : 
          error as DatabaseError;
        
        store.set({ 
          data: null, 
          isLoading: false, 
          error: dbError,
          lastUpdated: Date.now()
        });
      });

    // Set up subscription for real-time updates
    const unsubscribe = convexClient.subscribe(queryName, args, (data) => {
      store.set({ 
        data, 
        isLoading: false, 
        error: null,
        lastUpdated: Date.now()
      });
    });

    // TODO: Handle cleanup when component unmounts
    // This would be handled by the component using this query
  }

  return { subscribe: store.subscribe };
}

/**
 * Enhanced query function with caching and error handling
 */
export async function executeQuery<T>(
  queryName: string, 
  args: any = {},
  options: {
    cache?: boolean;
    cacheTimeout?: number;
  } = {}
): Promise<T> {
  if (!convexClient) {
    throw new Error('Convex client not initialized');
  }

  const { cache = false, cacheTimeout = 5 * 60 * 1000 } = options;
  const cacheKey = `query:${queryName}:${JSON.stringify(args)}`;

  // Check cache if enabled
  if (cache && browser) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheTimeout) {
        console.log(`Cache hit for ${queryName}`);
        return data as T;
      }
    }
  }

  try {
    const result = await convexClient.query(queryName, args);
    
    // Store in cache if enabled
    if (cache && browser) {
      const cacheData = {
        data: result,
        timestamp: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }
    
    return result as T;
  } catch (error) {
    const dbError = handleDatabaseError(error, `query:${queryName}`, { args });
    throw dbError;
  }
}

/**
 * Reactive mutation hook with comprehensive error handling
 * Returns a function to execute mutations
 */
export function createMutation<TArgs, TResult>(mutationName: string) {
  return async (args: TArgs): Promise<TResult> => {
    if (!convexClient) {
      throw new Error('Convex client not initialized');
    }

    try {
      const result = await convexClient.mutation(mutationName, args);
      return result as TResult;
    } catch (error) {
      const dbError = error instanceof Error ? 
        handleDatabaseError(error, `mutation:${mutationName}`, { args }) : 
        error as DatabaseError;
      throw dbError;
    }
  };
}

/**
 * Optimistic mutation with rollback capability
 */
export function createOptimisticMutation<TArgs, TResult>(
  mutationName: string,
  optimisticUpdate: (args: TArgs) => void,
  rollbackUpdate: () => void
) {
  return async (args: TArgs): Promise<TResult> => {
    if (!convexClient) {
      throw new Error('Convex client not initialized');
    }

    return withOptimisticUpdate(
      () => optimisticUpdate(args),
      rollbackUpdate,
      () => convexClient!.mutation(mutationName, args) as Promise<TResult>,
      `mutation:${mutationName}`
    );
  };
}

/**
 * Batch mutations with individual error handling
 */
export async function executeBatchMutations<T>(
  mutations: Array<{
    name: string;
    args: any;
    optimisticUpdate?: () => void;
    rollbackUpdate?: () => void;
  }>,
  options: {
    failFast?: boolean;
    maxConcurrency?: number;
  } = {}
): Promise<Array<{ success: boolean; result?: T; error?: DatabaseError }>> {
  if (!convexClient) {
    throw new Error('Convex client not initialized');
  }

  const operations = mutations.map(({ name, args, optimisticUpdate, rollbackUpdate }) => ({
    operation: async () => {
      if (optimisticUpdate) {
        return withOptimisticUpdate(
          optimisticUpdate,
          rollbackUpdate || (() => {}),
          () => convexClient!.mutation(name, args),
          `mutation:${name}`
        );
      } else {
        return convexClient!.mutation(name, args);
      }
    },
    name: `mutation:${name}`,
    context: { args }
  }));

  return withBatchOperation(operations, options);
}

/**
 * Convex connection status derived store
 */
export const isConnected: Readable<boolean> = derived(
  connectionState,
  ($connectionState) => $connectionState.isConnected
);

/**
 * Convex loading state derived store
 */
export const isLoading: Readable<boolean> = derived(
  connectionState,
  ($connectionState) => $connectionState.isLoading
);

/**
 * Convex error state derived store
 */
export const error: Readable<string | null> = derived(
  connectionState,
  ($connectionState) => $connectionState.error
);

/**
 * Reconnect to Convex
 */
export function reconnectConvex(): void {
  if (!browser) return;

  connectionState.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  // Reinitialize client
  setTimeout(() => {
    initializeConvexClient();
  }, 1000);
}

/**
 * Cleanup Convex client
 */
export function cleanupConvexClient(): void {
  if (convexClient) {
    console.log('Cleaning up Convex client');
    convexClient = null;
  }
  
  connectionState.set(initialConnectionState);
}

/**
 * Connection health monitoring
 */
export async function checkConvexHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: {
    responseTime: number;
    isConnected: boolean;
  };
  lastCheck: number;
}> {
  const issues: string[] = [];
  const lastCheck = Date.now();
  
  try {
    if (!convexClient) {
      throw new Error('Convex client not initialized');
    }

    // Test connection with a lightweight query
    const start = performance.now();
    await convexClient.query('health:ping', {});
    const responseTime = performance.now() - start;

    // Check response time
    if (responseTime > 2000) {
      issues.push(`Slow database response: ${responseTime.toFixed(1)}ms`);
    }

    // Check connection state
    const currentState = connectionState;
    let isConnected = false;
    const unsubscribe = currentState.subscribe(state => { isConnected = state.isConnected; });
    unsubscribe();

    if (!isConnected) {
      issues.push('Database connection lost');
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = !isConnected ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      issues,
      metrics: {
        responseTime,
        isConnected
      },
      lastCheck
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      issues: [`Connection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      metrics: {
        responseTime: -1,
        isConnected: false
      },
      lastCheck
    };
  }
}

/**
 * Auto-recovery for failed connections
 */
export function enableAutoRecovery(): () => void {
  if (!browser) {
    return () => {};
  }

  let recoveryAttempts = 0;
  const maxRecoveryAttempts = 5;
  const recoveryInterval = 30000; // 30 seconds

  const intervalId = setInterval(async () => {
    try {
      const health = await checkConvexHealth();
      
      if (health.status === 'unhealthy' && recoveryAttempts < maxRecoveryAttempts) {
        console.log(`Attempting connection recovery (${recoveryAttempts + 1}/${maxRecoveryAttempts})`);
        
        recoveryAttempts++;
        reconnectConvex();
        
        // Reset attempts counter on successful recovery
        setTimeout(async () => {
          const newHealth = await checkConvexHealth();
          if (newHealth.status !== 'unhealthy') {
            recoveryAttempts = 0;
            console.log('Connection recovery successful');
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Error during auto-recovery check:', error);
    }
  }, recoveryInterval);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}

/**
 * Clear database cache
 */
export function clearDatabaseCache(): void {
  if (!browser) return;

  // Clear all query cache
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('query:')) {
      sessionStorage.removeItem(key);
    }
  }
  
  console.log('Database cache cleared');
}

/**
 * Get database connection statistics
 */
export function getDatabaseStats(): {
  cacheSize: number;
  connectionUptime: number;
  connectionState: ConvexConnectionState;
} {
  let cacheSize = 0;
  let connectionUptime = 0;
  let currentState = initialConnectionState;

  // Count cache entries
  if (browser) {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('query:')) {
        cacheSize++;
      }
    }
  }

  // Get connection state and calculate uptime
  const unsubscribe = connectionState.subscribe(state => { 
    currentState = state;
    if (state.isConnected && state.lastUpdated > 0) {
      connectionUptime = Date.now() - state.lastUpdated;
    }
  });
  unsubscribe();

  return {
    cacheSize,
    connectionUptime,
    connectionState: currentState
  };
}