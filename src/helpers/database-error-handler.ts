// Convex Database Error Handling Utilities
// Provides comprehensive error handling and retry logic for Convex operations

/**
 * Comprehensive error handling for database operations
 */
export enum DatabaseErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMITED = 'rate_limited',
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_DENIED = 'permission_denied',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  CONFLICT_ERROR = 'conflict_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface DatabaseError {
  type: DatabaseErrorType;
  message: string;
  originalError?: any;
  retryable: boolean;
  timestamp: number;
  operation?: string;
  context?: Record<string, any>;
}

/**
 * Database error handler with comprehensive error mapping
 */
export class DatabaseErrorHandler {
  private static errorHistory: DatabaseError[] = [];
  private static maxErrorHistory = 100;

  /**
   * Handle and categorize database errors
   */
  static handleError(error: any, operation?: string, context?: Record<string, any>): DatabaseError {
    const dbError = this.categorizeError(error, operation, context);
    
    // Log error for debugging
    console.error(`DB Error [${dbError.type}] in ${operation}:`, dbError.message, dbError.originalError);
    
    // Store error in history
    this.errorHistory.push(dbError);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }

    // Track error metrics
    this.trackErrorMetrics(dbError);

    return dbError;
  }

  /**
   * Categorize error into specific type
   */
  private static categorizeError(error: any, operation?: string, context?: Record<string, any>): DatabaseError {
    const timestamp = Date.now();

    // Network-related errors
    if (this.isNetworkError(error)) {
      return {
        type: DatabaseErrorType.NETWORK_ERROR,
        message: 'Database connection failed. Please check your internet connection and try again.',
        originalError: error,
        retryable: true,
        timestamp,
        operation,
        context
      };
    }

    // Timeout errors
    if (this.isTimeoutError(error)) {
      return {
        type: DatabaseErrorType.TIMEOUT_ERROR,
        message: 'Database operation timed out. Please try again.',
        originalError: error,
        retryable: true,
        timestamp,
        operation,
        context
      };
    }

    // Convex-specific errors
    if (error?.data?.code || error?.code) {
      return this.handleConvexError(error, operation, context, timestamp);
    }

    // Rate limiting
    if (this.isRateLimited(error)) {
      return {
        type: DatabaseErrorType.RATE_LIMITED,
        message: 'Too many database requests. Please wait a moment and try again.',
        originalError: error,
        retryable: true,
        timestamp,
        operation,
        context
      };
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return {
        type: DatabaseErrorType.VALIDATION_ERROR,
        message: `Data validation failed: ${error.message || 'Invalid data format'}`,
        originalError: error,
        retryable: false,
        timestamp,
        operation,
        context
      };
    }

    // Permission errors
    if (this.isPermissionError(error)) {
      return {
        type: DatabaseErrorType.PERMISSION_DENIED,
        message: 'You do not have permission to perform this operation.',
        originalError: error,
        retryable: false,
        timestamp,
        operation,
        context
      };
    }

    // Default to unknown error
    return {
      type: DatabaseErrorType.UNKNOWN_ERROR,
      message: error?.message || 'An unexpected database error occurred. Please try again.',
      originalError: error,
      retryable: true,
      timestamp,
      operation,
      context
    };
  }

  /**
   * Handle Convex-specific errors
   */
  private static handleConvexError(error: any, operation?: string, context?: Record<string, any>, timestamp: number = Date.now()): DatabaseError {
    const convexCode = error.code || error.data?.code;
    
    switch (convexCode) {
      case 'UNAUTHENTICATED':
        return {
          type: DatabaseErrorType.PERMISSION_DENIED,
          message: 'Authentication required. Please sign in and try again.',
          originalError: error,
          retryable: true,
          timestamp,
          operation,
          context
        };

      case 'PERMISSION_DENIED':
        return {
          type: DatabaseErrorType.PERMISSION_DENIED,
          message: 'You do not have permission to access this resource.',
          originalError: error,
          retryable: false,
          timestamp,
          operation,
          context
        };

      case 'NOT_FOUND':
        return {
          type: DatabaseErrorType.RESOURCE_NOT_FOUND,
          message: 'The requested resource was not found.',
          originalError: error,
          retryable: false,
          timestamp,
          operation,
          context
        };

      case 'ALREADY_EXISTS':
      case 'CONFLICT':
        return {
          type: DatabaseErrorType.CONFLICT_ERROR,
          message: 'A conflict occurred. The resource may have been modified by another user.',
          originalError: error,
          retryable: true,
          timestamp,
          operation,
          context
        };

      case 'INVALID_ARGUMENT':
        return {
          type: DatabaseErrorType.VALIDATION_ERROR,
          message: `Invalid data provided: ${error.message || 'Please check your input'}`,
          originalError: error,
          retryable: false,
          timestamp,
          operation,
          context
        };

      case 'RESOURCE_EXHAUSTED':
        return {
          type: DatabaseErrorType.QUOTA_EXCEEDED,
          message: 'Database quota exceeded. Please try again later or contact support.',
          originalError: error,
          retryable: true,
          timestamp,
          operation,
          context
        };

      case 'UNAVAILABLE':
        return {
          type: DatabaseErrorType.SERVICE_UNAVAILABLE,
          message: 'Database service is temporarily unavailable. Please try again later.',
          originalError: error,
          retryable: true,
          timestamp,
          operation,
          context
        };

      default:
        return {
          type: DatabaseErrorType.UNKNOWN_ERROR,
          message: `Database error: ${error.message || 'Unknown error occurred'}`,
          originalError: error,
          retryable: true,
          timestamp,
          operation,
          context
        };
    }
  }

  /**
   * Check if error is network-related
   */
  private static isNetworkError(error: any): boolean {
    return (
      error?.name === 'NetworkError' ||
      error?.message?.includes('fetch') ||
      error?.message?.includes('network') ||
      error?.code === 'NETWORK_ERROR' ||
      !navigator.onLine
    );
  }

  /**
   * Check if error is timeout-related
   */
  private static isTimeoutError(error: any): boolean {
    return (
      error?.name === 'TimeoutError' ||
      error?.message?.includes('timeout') ||
      error?.code === 'TIMEOUT' ||
      error?.code === 'DEADLINE_EXCEEDED'
    );
  }

  /**
   * Check if error is due to rate limiting
   */
  private static isRateLimited(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.code === 'RATE_LIMITED' ||
      error?.message?.includes('rate limit') ||
      error?.message?.includes('too many requests')
    );
  }

  /**
   * Check if error is validation-related
   */
  private static isValidationError(error: any): boolean {
    return (
      error?.name === 'ValidationError' ||
      error?.message?.includes('validation') ||
      error?.code === 'INVALID_ARGUMENT' ||
      error?.code === 'VALIDATION_FAILED'
    );
  }

  /**
   * Check if error is permission-related
   */
  private static isPermissionError(error: any): boolean {
    return (
      error?.code === 'PERMISSION_DENIED' ||
      error?.code === 'UNAUTHENTICATED' ||
      error?.message?.includes('permission') ||
      error?.message?.includes('unauthorized')
    );
  }

  /**
   * Track error metrics for monitoring
   */
  private static trackErrorMetrics(dbError: DatabaseError): void {
    // In a real implementation, this would send metrics to analytics
    console.warn(`DB Error Metric: ${dbError.type} in ${dbError.operation} - ${dbError.retryable ? 'Retryable' : 'Non-retryable'}`);
    
    // Could integrate with performance monitoring here
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'database_error', {
        error_type: dbError.type,
        operation: dbError.operation,
        retryable: dbError.retryable,
        error_message: dbError.message
      });
    }
  }

  /**
   * Get error history for debugging
   */
  static getErrorHistory(): DatabaseError[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  static clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get retry strategy for error
   */
  static getRetryStrategy(dbError: DatabaseError): {
    shouldRetry: boolean;
    retryAfter: number;
    maxRetries: number;
  } {
    if (!dbError.retryable) {
      return { shouldRetry: false, retryAfter: 0, maxRetries: 0 };
    }

    switch (dbError.type) {
      case DatabaseErrorType.NETWORK_ERROR:
        return { shouldRetry: true, retryAfter: 1000, maxRetries: 3 };
      
      case DatabaseErrorType.TIMEOUT_ERROR:
        return { shouldRetry: true, retryAfter: 2000, maxRetries: 2 };
      
      case DatabaseErrorType.RATE_LIMITED:
        return { shouldRetry: true, retryAfter: 5000, maxRetries: 2 };
      
      case DatabaseErrorType.SERVICE_UNAVAILABLE:
        return { shouldRetry: true, retryAfter: 3000, maxRetries: 2 };
      
      case DatabaseErrorType.QUOTA_EXCEEDED:
        return { shouldRetry: true, retryAfter: 10000, maxRetries: 1 };
      
      case DatabaseErrorType.CONFLICT_ERROR:
        return { shouldRetry: true, retryAfter: 500, maxRetries: 2 };
      
      default:
        return { shouldRetry: true, retryAfter: 1000, maxRetries: 2 };
    }
  }
}

/**
 * Enhanced error handling function with retry logic
 */
export function handleDatabaseError(error: any, operation?: string, context?: Record<string, any>): DatabaseError {
  return DatabaseErrorHandler.handleError(error, operation, context);
}

/**
 * Retry wrapper for database operations
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  operationName?: string,
  context?: Record<string, any>
): Promise<T> {
  let lastError: DatabaseError | null = null;
  let attempts = 0;

  while (attempts < 3) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      lastError = handleDatabaseError(error, operationName, { ...context, attempt: attempts });
      
      const retryStrategy = DatabaseErrorHandler.getRetryStrategy(lastError);
      
      if (!retryStrategy.shouldRetry || attempts >= retryStrategy.maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying with exponential backoff
      const backoffDelay = retryStrategy.retryAfter * Math.pow(1.5, attempts - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
}

/**
 * Optimistic update wrapper with rollback on failure
 */
export async function withOptimisticUpdate<T, U>(
  optimisticUpdate: () => void,
  rollbackUpdate: () => void,
  actualOperation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  // Apply optimistic update immediately
  optimisticUpdate();

  try {
    // Perform actual operation with retry logic
    const result = await withDatabaseRetry(actualOperation, operationName);
    return result;
  } catch (error) {
    // Rollback optimistic update on failure
    rollbackUpdate();
    throw error;
  }
}

/**
 * Batch operation wrapper with individual error handling
 */
export async function withBatchOperation<T>(
  operations: Array<{
    operation: () => Promise<T>;
    name: string;
    context?: Record<string, any>;
  }>,
  options: {
    failFast?: boolean;
    maxConcurrency?: number;
  } = {}
): Promise<Array<{ success: boolean; result?: T; error?: DatabaseError }>> {
  const { failFast = false, maxConcurrency = 5 } = options;
  const results: Array<{ success: boolean; result?: T; error?: DatabaseError }> = [];

  // Process operations in batches to control concurrency
  for (let i = 0; i < operations.length; i += maxConcurrency) {
    const batch = operations.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async ({ operation, name, context }) => {
      try {
        const result = await withDatabaseRetry(operation, name, context);
        return { success: true, result };
      } catch (error) {
        const dbError = error instanceof Error ? 
          handleDatabaseError(error, name, context) : 
          error as DatabaseError;
        
        if (failFast) {
          throw dbError;
        }
        
        return { success: false, error: dbError };
      }
    });

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      if (failFast) {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Database health monitoring
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: {
    averageResponseTime: number;
    errorRate: number;
    recentErrors: number;
  };
  lastCheck: number;
}> {
  const issues: string[] = [];
  const lastCheck = Date.now();
  
  try {
    // Check database responsiveness
    const start = performance.now();
    // Mock database ping - in real implementation, this would be a lightweight query
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate 50ms response
    const responseTime = performance.now() - start;
    
    // Analyze error history
    const errorHistory = DatabaseErrorHandler.getErrorHistory();
    const recentErrors = errorHistory.filter(
      error => Date.now() - error.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );
    
    const totalOperations = Math.max(errorHistory.length + 100, 1); // Assume some successful operations
    const errorRate = (recentErrors.length / totalOperations) * 100;
    
    // Check response time
    if (responseTime > 1000) {
      issues.push(`Slow database response: ${responseTime.toFixed(1)}ms`);
    }
    
    // Check error rate
    if (errorRate > 5) {
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }
    
    // Check for critical errors
    const criticalErrors = recentErrors.filter(
      error => !error.retryable || error.type === DatabaseErrorType.SERVICE_UNAVAILABLE
    );
    
    if (criticalErrors.length > 0) {
      issues.push(`Critical database errors detected: ${criticalErrors.length}`);
    }
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = criticalErrors.length > 0 || errorRate > 10 ? 'unhealthy' : 'degraded';
    }
    
    return {
      status,
      issues,
      metrics: {
        averageResponseTime: responseTime,
        errorRate,
        recentErrors: recentErrors.length
      },
      lastCheck
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      metrics: {
        averageResponseTime: -1,
        errorRate: 100,
        recentErrors: -1
      },
      lastCheck
    };
  }
}

/**
 * Get database error summary for debugging
 */
export function getDatabaseErrorSummary(): {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByOperation: Record<string, number>;
  recentErrors: DatabaseError[];
} {
  const errorHistory = DatabaseErrorHandler.getErrorHistory();
  const errorsByType: Record<string, number> = {};
  const errorsByOperation: Record<string, number> = {};
  
  errorHistory.forEach(error => {
    errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    if (error.operation) {
      errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1;
    }
  });
  
  return {
    totalErrors: errorHistory.length,
    errorsByType,
    errorsByOperation,
    recentErrors: errorHistory.slice(-10) // Last 10 errors
  };
}