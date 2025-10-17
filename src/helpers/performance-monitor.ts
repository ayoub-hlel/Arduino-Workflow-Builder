// Performance Monitoring for Authentication and Database Operations
// Tracks performance metrics for Clerk auth and Convex operations

import { browser } from '$app/environment';

/**
 * Performance metric interface
 */
export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  enabled: boolean;
  maxMetrics: number;
  warningThreshold: number; // milliseconds
  errorThreshold: number; // milliseconds
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
}

/**
 * Performance monitoring class
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private config: PerformanceConfig;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxMetrics: config.maxMetrics ?? 1000,
      warningThreshold: config.warningThreshold ?? 200,
      errorThreshold: config.errorThreshold ?? 1000,
      enableConsoleLogging: config.enableConsoleLogging ?? true,
      enableLocalStorage: config.enableLocalStorage ?? false
    };
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string, metadata?: Record<string, any>): string {
    if (!this.config.enabled || !browser) return '';

    const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (performance && performance.mark) {
      performance.mark(`${timerId}_start`);
    }

    // Store start metadata for later use
    const startData = {
      operation,
      startTime: Date.now(),
      metadata
    };
    
    // Store in session storage for recovery
    if (browser && sessionStorage) {
      sessionStorage.setItem(`perf_${timerId}`, JSON.stringify(startData));
    }

    return timerId;
  }

  /**
   * End timing an operation
   */
  endTimer(timerId: string, success: boolean = true, error?: string): PerformanceMetric | null {
    if (!this.config.enabled || !browser || !timerId) return null;

    const endTime = Date.now();
    let startData: any = null;

    // Retrieve start data
    if (browser && sessionStorage) {
      try {
        const stored = sessionStorage.getItem(`perf_${timerId}`);
        if (stored) {
          startData = JSON.parse(stored);
          sessionStorage.removeItem(`perf_${timerId}`);
        }
      } catch (e) {
        console.warn('Failed to retrieve performance timer data:', e);
      }
    }

    if (!startData) {
      console.warn('Performance timer not found:', timerId);
      return null;
    }

    const duration = endTime - startData.startTime;

    // Create performance mark
    if (performance && performance.mark && performance.measure) {
      try {
        performance.mark(`${timerId}_end`);
        performance.measure(timerId, `${timerId}_start`, `${timerId}_end`);
      } catch (e) {
        console.warn('Failed to create performance measure:', e);
      }
    }

    const metric: PerformanceMetric = {
      operation: startData.operation,
      startTime: startData.startTime,
      endTime,
      duration,
      success,
      error,
      metadata: startData.metadata
    };

    this.recordMetric(metric);
    return metric;
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    // Add to metrics array
    this.metrics.push(metric);

    // Trim metrics if exceeding max
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }

    // Log to console if enabled
    if (this.config.enableConsoleLogging) {
      this.logMetric(metric);
    }

    // Store to localStorage if enabled
    if (this.config.enableLocalStorage && browser && localStorage) {
      try {
        const stored = localStorage.getItem('performance_metrics') || '[]';
        const metrics = JSON.parse(stored);
        metrics.push(metric);
        
        // Keep only recent metrics
        const recentMetrics = metrics.slice(-this.config.maxMetrics);
        localStorage.setItem('performance_metrics', JSON.stringify(recentMetrics));
      } catch (e) {
        console.warn('Failed to store performance metric:', e);
      }
    }
  }

  /**
   * Log metric to console with appropriate level
   */
  private logMetric(metric: PerformanceMetric): void {
    const { operation, duration, success, error } = metric;
    const status = success ? '✅' : '❌';
    
    if (!success) {
      console.error(`${status} ${operation}: ${duration}ms - ERROR: ${error}`);
    } else if (duration > this.config.errorThreshold) {
      console.error(`${status} ${operation}: ${duration}ms - SLOW OPERATION`);
    } else if (duration > this.config.warningThreshold) {
      console.warn(`${status} ${operation}: ${duration}ms - WARNING: Slow`);
    } else {
      console.log(`${status} ${operation}: ${duration}ms`);
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operation: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.operation === operation);
  }

  /**
   * Get performance statistics
   */
  getStatistics(operation?: string): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    medianDuration: number;
    slowOperations: number;
    failedOperations: number;
  } {
    const metrics = operation ? this.getMetricsForOperation(operation) : this.metrics;
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        medianDuration: 0,
        slowOperations: 0,
        failedOperations: 0
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulOperations = metrics.filter(m => m.success).length;
    const slowOperations = metrics.filter(m => m.duration > this.config.warningThreshold).length;
    const failedOperations = metrics.filter(m => !m.success).length;

    return {
      totalOperations: metrics.length,
      successRate: (successfulOperations / metrics.length) * 100,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianDuration: durations[Math.floor(durations.length / 2)],
      slowOperations,
      failedOperations
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    
    if (this.config.enableLocalStorage && browser && localStorage) {
      localStorage.removeItem('performance_metrics');
    }
  }

  /**
   * Configure monitoring settings
   */
  configure(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      config: this.config,
      metrics: this.metrics,
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Global performance monitor instance
let performanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create the global performance monitor
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

/**
 * Decorator for measuring function performance
 */
export function measurePerformance(operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const monitor = getPerformanceMonitor();
      const timerId = monitor.startTimer(operation, { method: propertyKey, args: args.length });

      try {
        const result = await originalMethod.apply(this, args);
        monitor.endTimer(timerId, true);
        return result;
      } catch (error) {
        monitor.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Higher-order function for measuring async function performance
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const monitor = getPerformanceMonitor();
    const timerId = monitor.startTimer(operation, { args: args.length });

    try {
      const result = await fn(...args);
      monitor.endTimer(timerId, true);
      return result;
    } catch (error) {
      monitor.endTimer(timerId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }) as T;
}

/**
 * Authentication performance monitoring utilities
 */
export const authPerformance = {
  /**
   * Measure Clerk sign-in performance
   */
  measureSignIn: <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return withPerformanceMonitoring('clerk_sign_in', fn);
  },

  /**
   * Measure Clerk sign-out performance
   */
  measureSignOut: <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return withPerformanceMonitoring('clerk_sign_out', fn);
  },

  /**
   * Measure session token retrieval performance
   */
  measureGetSessionToken: <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return withPerformanceMonitoring('clerk_get_session_token', fn);
  },

  /**
   * Measure user profile loading performance
   */
  measureGetUserProfile: <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return withPerformanceMonitoring('clerk_get_user_profile', fn);
  }
};

/**
 * Database performance monitoring utilities
 */
export const dbPerformance = {
  /**
   * Measure Convex query performance
   */
  measureQuery: <T extends (...args: any[]) => Promise<any>>(operation: string, fn: T): T => {
    return withPerformanceMonitoring(`convex_query_${operation}`, fn);
  },

  /**
   * Measure Convex mutation performance
   */
  measureMutation: <T extends (...args: any[]) => Promise<any>>(operation: string, fn: T): T => {
    return withPerformanceMonitoring(`convex_mutation_${operation}`, fn);
  },

  /**
   * Measure Convex subscription performance
   */
  measureSubscription: <T extends (...args: any[]) => Promise<any>>(operation: string, fn: T): T => {
    return withPerformanceMonitoring(`convex_subscription_${operation}`, fn);
  }
};

/**
 * Component for displaying performance metrics in development
 */
export function createPerformanceReport(): {
  authStats: any;
  dbStats: any;
  overallStats: any;
} {
  const monitor = getPerformanceMonitor();
  
  return {
    authStats: {
      signIn: monitor.getStatistics('clerk_sign_in'),
      signOut: monitor.getStatistics('clerk_sign_out'),
      sessionToken: monitor.getStatistics('clerk_get_session_token'),
      userProfile: monitor.getStatistics('clerk_get_user_profile')
    },
    dbStats: {
      queries: monitor.getMetricsForOperation('convex_query').length,
      mutations: monitor.getMetricsForOperation('convex_mutation').length,
      subscriptions: monitor.getMetricsForOperation('convex_subscription').length
    },
    overallStats: monitor.getStatistics()
  };
}

/**
 * Initialize performance monitoring with development settings
 */
export function initializePerformanceMonitoring(isDevelopment: boolean = false): void {
  const monitor = getPerformanceMonitor();
  
  monitor.configure({
    enabled: true,
    enableConsoleLogging: isDevelopment,
    enableLocalStorage: isDevelopment,
    warningThreshold: 200, // Constitutional requirement: <200ms auth performance
    errorThreshold: 1000
  });

  console.log('Performance monitoring initialized');
}

export default getPerformanceMonitor;