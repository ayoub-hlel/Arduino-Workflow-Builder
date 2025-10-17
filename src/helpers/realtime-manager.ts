// Real-time Subscription Manager for Convex
// This service manages Convex subscriptions and provides real-time updates

import { writable, type Writable } from 'svelte/store';
import { getConvexClient, type ConvexClient } from '../stores/convex.store';
import { browser } from '$app/environment';

/**
 * Subscription metadata
 */
interface Subscription {
  id: string;
  queryName: string;
  args: any;
  unsubscribe: () => void;
  store: Writable<any>;
}

/**
 * Real-time subscription manager
 */
class RealtimeManager {
  private subscriptions = new Map<string, Subscription>();
  private convexClient: ConvexClient | null = null;

  constructor() {
    if (browser) {
      try {
        this.convexClient = getConvexClient();
      } catch (error) {
        console.warn('Convex client not initialized for real-time manager');
      }
    }
  }

  /**
   * Subscribe to a Convex query with real-time updates
   */
  subscribe<T>(
    queryName: string, 
    args: any = {}, 
    subscriptionId?: string
  ): Writable<{ data: T | null; isLoading: boolean; error: string | null }> {
    if (!this.convexClient) {
      console.warn('Cannot create subscription: Convex client not available');
      return writable({ data: null, isLoading: false, error: 'Convex client unavailable' });
    }

    const id = subscriptionId || `${queryName}_${JSON.stringify(args)}_${Date.now()}`;
    
    // If subscription already exists, return existing store
    if (this.subscriptions.has(id)) {
      return this.subscriptions.get(id)!.store;
    }

    // Create new subscription store
    const store = writable<{ data: T | null; isLoading: boolean; error: string | null }>({
      data: null,
      isLoading: true,
      error: null
    });

    try {
      // Set up Convex subscription
      const unsubscribe = this.convexClient.subscribe(queryName, args, (data: T) => {
        store.set({ data, isLoading: false, error: null });
      });

      // Store subscription metadata
      const subscription: Subscription = {
        id,
        queryName,
        args,
        unsubscribe,
        store
      };

      this.subscriptions.set(id, subscription);

      console.log(`Real-time subscription created: ${id} for ${queryName}`);

    } catch (error) {
      console.error(`Failed to create subscription ${id}:`, error);
      store.set({ 
        data: null, 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Subscription failed' 
      });
    }

    return store;
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      console.log(`Unsubscribed from: ${subscriptionId}`);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    for (const [id, subscription] of this.subscriptions) {
      subscription.unsubscribe();
      console.log(`Unsubscribed from: ${id}`);
    }
    this.subscriptions.clear();
  }

  /**
   * Get active subscription count
   */
  getActiveCount(): number {
    return this.subscriptions.size;
  }

  /**
   * List active subscriptions (for debugging)
   */
  listSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Reconnect all subscriptions (useful after network reconnection)
   */
  reconnectAll(): void {
    const currentSubscriptions = Array.from(this.subscriptions.values());
    
    // Clear all subscriptions
    this.unsubscribeAll();
    
    // Recreate all subscriptions
    for (const sub of currentSubscriptions) {
      this.subscribe(sub.queryName, sub.args, sub.id);
    }
    
    console.log(`Reconnected ${currentSubscriptions.length} subscriptions`);
  }
}

// Global instance
let realtimeManager: RealtimeManager | null = null;

/**
 * Get or create the global real-time manager instance
 */
export function getRealtimeManager(): RealtimeManager {
  if (!realtimeManager) {
    realtimeManager = new RealtimeManager();
  }
  return realtimeManager;
}

/**
 * Subscribe to project updates in real-time
 */
export function subscribeToProject(projectId: string) {
  const manager = getRealtimeManager();
  return manager.subscribe<any>('projects:getProject', { projectId }, `project_${projectId}`);
}

/**
 * Subscribe to user projects list in real-time
 */
export function subscribeToUserProjects(userId: string) {
  const manager = getRealtimeManager();
  return manager.subscribe<any[]>('projects:getUserProjects', { userId }, `user_projects_${userId}`);
}

/**
 * Subscribe to user settings in real-time
 */
export function subscribeToUserSettings(userId: string) {
  const manager = getRealtimeManager();
  return manager.subscribe<any>('users:getUserSettings', { userId }, `user_settings_${userId}`);
}

/**
 * Subscribe to public projects in real-time
 */
export function subscribeToPublicProjects() {
  const manager = getRealtimeManager();
  return manager.subscribe<any[]>('projects:getPublicProjects', {}, 'public_projects');
}

/**
 * Clean up all subscriptions (call on app unmount)
 */
export function cleanupSubscriptions(): void {
  if (realtimeManager) {
    realtimeManager.unsubscribeAll();
  }
}

/**
 * Reconnect all subscriptions (call after network reconnection)
 */
export function reconnectSubscriptions(): void {
  if (realtimeManager) {
    realtimeManager.reconnectAll();
  }
}

// Auto-cleanup on page unload
if (browser) {
  window.addEventListener('beforeunload', cleanupSubscriptions);
}