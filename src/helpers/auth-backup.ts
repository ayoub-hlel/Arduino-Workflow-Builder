// Clerk Authentication Helper Functions
// Provides unified authentication interface for the application

import { get } from 'svelte/store';
import { authState, userId, isSignedIn, updateAuthState } from '../stores/clerk-auth.store';

/**
 * Sign in with Google using Clerk with comprehensive error handling
 */
export async function signInWithGoogle(): Promise<void> {
  console.log('Initiating Google sign-in with Clerk');
  
  return withAuthRetry(async () => {
    // Mock implementation - would be replaced with actual Clerk OAuth
    cons/**
 * Clean up authentication resources
 */
export function cleanupAuth(): void {
  console.log('Cleaning up authentication resources');
  // Clear error history
  AuthErrorHandler.clearErrorHistory();
  // Mock cleanup - would clean up Clerk resources
}

/**
 * Get authentication error summary for debugging
 */
export function getAuthErrorSummary(): {
  totalErrors: number;
  errorsByType: Record<string, number>;
  recentErrors: AuthError[];
} {
  const errorHistory = AuthErrorHandler.getErrorHistory();
  const errorsByType: Record<string, number> = {};
  
  errorHistory.forEach(error => {
    errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
  });
  
  return {
    totalErrors: errorHistory.length,
    errorsByType,
    recentErrors: errorHistory.slice(-5) // Last 5 errors
  };
}

/**
 * Check authentication health
 */
export async function checkAuthHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  lastCheck: number;
}> {
  const issues: string[] = [];
  const lastCheck = Date.now();
  
  try {
    // Check if authentication is responsive
    const start = performance.now();
    const user = getCurrentUser();
    const duration = performance.now() - start;
    
    if (duration > 100) {
      issues.push(`Slow authentication check: ${duration.toFixed(1)}ms`);
    }
    
    // Check error rate
    const errorSummary = getAuthErrorSummary();
    const recentErrors = errorSummary.recentErrors.filter(
      error => Date.now() - error.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );
    
    if (recentErrors.length > 3) {
      issues.push(`High error rate: ${recentErrors.length} errors in last 5 minutes`);
    }
    
    // Check for critical errors
    const criticalErrors = recentErrors.filter(
      error => !error.retryable || error.type === AuthErrorType.SERVICE_UNAVAILABLE
    );
    
    if (criticalErrors.length > 0) {
      issues.push(`Critical authentication errors detected`);
    }
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = criticalErrors.length > 0 ? 'unhealthy' : 'degraded';
    }
    
    return { status, issues, lastCheck };
  } catch (error) {
    return {
      status: 'unhealthy',
      issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      lastCheck
    };
  }
}

/**
 * Get authentication error summary for debugging
 */
export function getAuthErrorSummary(): {
  totalErrors: number;
  errorsByType: Record<string, number>;
  recentErrors: AuthError[];
} {
  const errorHistory = AuthErrorHandler.getErrorHistory();
  const errorsByType: Record<string, number> = {};
  
  errorHistory.forEach(error => {
    errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
  });
  
  return {
    totalErrors: errorHistory.length,
    errorsByType,
    recentErrors: errorHistory.slice(-5) // Last 5 errors
  };
}

/**
 * Check authentication health
 */
export async function checkAuthHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  lastCheck: number;
}> {
  const issues: string[] = [];
  const lastCheck = Date.now();
  
  try {
    // Check if authentication is responsive
    const start = performance.now();
    const user = getCurrentUser();
    const duration = performance.now() - start;
    
    if (duration > 100) {
      issues.push(`Slow authentication check: ${duration.toFixed(1)}ms`);
    }
    
    // Check error rate
    const errorSummary = getAuthErrorSummary();
    const recentErrors = errorSummary.recentErrors.filter(
      error => Date.now() - error.timestamp < 5 * 60 * 1000 // Last 5 minutes
    );
    
    if (recentErrors.length > 3) {
      issues.push(`High error rate: ${recentErrors.length} errors in last 5 minutes`);
    }
    
    // Check for critical errors
    const criticalErrors = recentErrors.filter(
      error => !error.retryable || error.type === AuthErrorType.SERVICE_UNAVAILABLE
    );
    
    if (criticalErrors.length > 0) {
      issues.push(`Critical authentication errors detected`);
    }
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) {
      status = criticalErrors.length > 0 ? 'unhealthy' : 'degraded';
    }
    
    return { status, issues, lastCheck };
  } catch (error) {
    return {
      status: 'unhealthy',
      issues: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      lastCheck
    };
  }
}('MOCK: Opening Google OAuth popup');
    
    // Simulate potential network issues
    if (Math.random() < 0.1) {
      throw new Error('Network connection failed');
    }
    
    // Simulate successful authentication
    // In real implementation, this would:
    // 1. Open OAuth popup/redirect
    // 2. Handle OAuth callback
    // 3. Extract user data from Clerk
    // 4. Update stores automatically
    
    const mockUserId = 'user_' + Math.random().toString(36).substr(2, 9);
    updateAuthState({
      isSignedIn: true,
      userId: mockUserId,
      user: {
        id: mockUserId,
        emailAddresses: [{ emailAddress: 'test@example.com', id: 'email_1' }],
        firstName: 'Test',
        lastName: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });
    
    console.log('MOCK: Google sign-in completed successfully');
  }, { operation: 'signInWithGoogle' });
}

/**
 * Sign out with Clerk with comprehensive error handling
 */
export async function signOutWithClerk(): Promise<void> {
  console.log('Signing out with Clerk');
  
  return withAuthRetry(async () => {
    // Mock implementation - would be replaced with actual Clerk calls
    console.log('MOCK: Clerk sign-out initiated');
    
    // Simulate successful sign-out
    updateAuthState({
      isSignedIn: false,
      userId: null,
      user: null
    });
    
    console.log('MOCK: Sign-out completed successfully');
  }, { operation: 'signOut' });
}

/**
 * Get current user from Clerk
 */
export function getCurrentUser(): string | null {
  return get(userId);
}

/**
 * Check if user is currently signed in
 */
export function isUserSignedIn(): boolean {
  return get(isSignedIn);
}

/**
 * Get user session token (for API calls) with error handling
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    return await withAuthRetry(async () => {
      // Mock implementation - would use actual Clerk session management
      const currentUserId = getCurrentUser();
      if (!currentUserId || !isUserSignedIn()) {
        return null;
      }
      
      // Simulate token generation
      const mockToken = 'mock_session_token_' + Math.random().toString(36).substr(2, 16);
      console.log('MOCK: Generated session token');
      return mockToken;
    }, { operation: 'getSessionToken' });
  } catch (error) {
    const authError = handleAuthError(error, { operation: 'getSessionToken' });
    console.error('Failed to get session token:', authError.message);
    return null;
  }
}

/**
 * Refresh user session
 */
export async function refreshSession(): Promise<boolean> {
  try {
    // Mock implementation - would use actual Clerk session refresh
    console.log('MOCK: Refreshing session');
    
    const currentUserId = getCurrentUser();
    if (!currentUserId) {
      return false;
    }
    
    // Simulate successful refresh
    return true;
  } catch (error) {
    console.error('Failed to refresh session:', error);
    return false;
  }
}

/**
 * Handle authentication state changes
 */
export function onAuthStateChange(callback: (user: string | null) => void): () => void {
  // Subscribe to auth store changes
  const unsubscribe = userId.subscribe(callback);
  
  return unsubscribe;
}

/**
 * Get user profile information
 */
export async function getUserProfile(): Promise<{
  id: string;
  email: string;
  name?: string;
  avatar?: string;
} | null> {
  try {
    const currentUserId = getCurrentUser();
    if (!currentUserId || !isUserSignedIn()) {
      return null;
    }
    
    // Mock implementation - would use actual Clerk user data
    console.log('MOCK: Getting user profile');
    return {
      id: currentUserId,
      email: `user${currentUserId}@example.com`,
      name: `User ${currentUserId}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`
    };
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

/**
 * Initialize Clerk authentication
 */
export function initializeAuth(): void {
  console.log('Initializing Clerk authentication');
  
  // Mock initialization - would be replaced with actual Clerk setup
  console.log('MOCK: Clerk initialized');
  
  // In real implementation, this would:
  // 1. Initialize Clerk with publishable key
  // 2. Set up authentication providers
  // 3. Configure session management
  // 4. Handle automatic sign-in state detection
}

/**
 * Check if authentication is ready
 */
export function isAuthReady(): boolean {
  // Mock implementation - would check if Clerk is fully loaded
  return true;
}

/**
 * Comprehensive error handling for authentication operations
 */
export enum AuthErrorType {
  NETWORK_ERROR = 'network_error',
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_CANCELLED = 'user_cancelled',
  SESSION_EXPIRED = 'session_expired',
  RATE_LIMITED = 'rate_limited',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  INVALID_STATE = 'invalid_state',
  POPUP_BLOCKED = 'popup_blocked',
  CORS_ERROR = 'cors_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface AuthError {
  type: AuthErrorType;
  message: string;
  originalError?: any;
  retryable: boolean;
  timestamp: number;
  context?: Record<string, any>;
}

/**
 * Authentication error handler with comprehensive error mapping
 */
export class AuthErrorHandler {
  private static errorHistory: AuthError[] = [];
  private static maxErrorHistory = 100;

  /**
   * Handle and categorize authentication errors
   */
  static handleError(error: any, context?: Record<string, any>): AuthError {
    const authError = this.categorizeError(error, context);
    
    // Log error for debugging
    console.error(`Auth Error [${authError.type}]:`, authError.message, authError.originalError);
    
    // Store error in history
    this.errorHistory.push(authError);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }

    // Track error metrics
    this.trackErrorMetrics(authError);

    return authError;
  }

  /**
   * Categorize error into specific type
   */
  private static categorizeError(error: any, context?: Record<string, any>): AuthError {
    const timestamp = Date.now();

    // Network-related errors
    if (this.isNetworkError(error)) {
      return {
        type: AuthErrorType.NETWORK_ERROR,
        message: 'Network connection failed. Please check your internet connection and try again.',
        originalError: error,
        retryable: true,
        timestamp,
        context
      };
    }

    // Clerk-specific errors
    if (error?.clerkError || error?.clerk_error) {
      return this.handleClerkError(error, context, timestamp);
    }

    // Browser-specific errors
    if (this.isPopupBlocked(error)) {
      return {
        type: AuthErrorType.POPUP_BLOCKED,
        message: 'Popup was blocked by your browser. Please allow popups for this site and try again.',
        originalError: error,
        retryable: true,
        timestamp,
        context
      };
    }

    // User cancellation
    if (this.isUserCancellation(error)) {
      return {
        type: AuthErrorType.USER_CANCELLED,
        message: 'Sign-in was cancelled. Please try again when ready.',
        originalError: error,
        retryable: true,
        timestamp,
        context
      };
    }

    // Rate limiting
    if (this.isRateLimited(error)) {
      return {
        type: AuthErrorType.RATE_LIMITED,
        message: 'Too many authentication attempts. Please wait a moment and try again.',
        originalError: error,
        retryable: true,
        timestamp,
        context
      };
    }

    // CORS errors
    if (this.isCorsError(error)) {
      return {
        type: AuthErrorType.CORS_ERROR,
        message: 'Cross-origin request failed. This may be a configuration issue.',
        originalError: error,
        retryable: false,
        timestamp,
        context
      };
    }

    // Default to unknown error
    return {
      type: AuthErrorType.UNKNOWN_ERROR,
      message: error?.message || 'An unexpected authentication error occurred. Please try again.',
      originalError: error,
      retryable: true,
      timestamp,
      context
    };
  }

  /**
   * Handle Clerk-specific errors
   */
  private static handleClerkError(error: any, context?: Record<string, any>, timestamp: number = Date.now()): AuthError {
    const clerkCode = error.code || error.clerkError?.code || error.clerk_error?.code;
    
    switch (clerkCode) {
      case 'session_token_invalid':
      case 'session_expired':
        return {
          type: AuthErrorType.SESSION_EXPIRED,
          message: 'Your session has expired. Please sign in again.',
          originalError: error,
          retryable: true,
          timestamp,
          context
        };

      case 'invalid_client_id':
      case 'invalid_publishable_key':
        return {
          type: AuthErrorType.INVALID_STATE,
          message: 'Authentication configuration error. Please contact support.',
          originalError: error,
          retryable: false,
          timestamp,
          context
        };

      case 'user_locked':
        return {
          type: AuthErrorType.INVALID_CREDENTIALS,
          message: 'Account is temporarily locked. Please try again later or contact support.',
          originalError: error,
          retryable: true,
          timestamp,
          context
        };

      case 'form_password_incorrect':
      case 'form_identifier_not_found':
        return {
          type: AuthErrorType.INVALID_CREDENTIALS,
          message: 'Invalid email or password. Please check your credentials and try again.',
          originalError: error,
          retryable: true,
          timestamp,
          context
        };

      default:
        return {
          type: AuthErrorType.SERVICE_UNAVAILABLE,
          message: 'Authentication service is temporarily unavailable. Please try again later.',
          originalError: error,
          retryable: true,
          timestamp,
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
   * Check if error is due to popup being blocked
   */
  private static isPopupBlocked(error: any): boolean {
    return (
      error?.message?.includes('popup') ||
      error?.message?.includes('blocked') ||
      error?.code === 'popup_blocked' ||
      error?.name === 'PopupBlockedError'
    );
  }

  /**
   * Check if error is user cancellation
   */
  private static isUserCancellation(error: any): boolean {
    return (
      error?.message?.includes('cancelled') ||
      error?.message?.includes('closed') ||
      error?.code === 'popup_closed_by_user' ||
      error?.code === 'user_cancelled'
    );
  }

  /**
   * Check if error is due to rate limiting
   */
  private static isRateLimited(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.code === 'rate_limited' ||
      error?.message?.includes('rate limit') ||
      error?.message?.includes('too many requests')
    );
  }

  /**
   * Check if error is CORS-related
   */
  private static isCorsError(error: any): boolean {
    return (
      error?.message?.includes('CORS') ||
      error?.message?.includes('cross-origin') ||
      error?.name === 'CORSError'
    );
  }

  /**
   * Track error metrics for monitoring
   */
  private static trackErrorMetrics(authError: AuthError): void {
    // In a real implementation, this would send metrics to analytics
    console.warn(`Auth Error Metric: ${authError.type} - ${authError.retryable ? 'Retryable' : 'Non-retryable'}`);
    
    // Could integrate with performance monitoring here
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'auth_error', {
        error_type: authError.type,
        retryable: authError.retryable,
        error_message: authError.message
      });
    }
  }

  /**
   * Get error history for debugging
   */
  static getErrorHistory(): AuthError[] {
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
  static getRetryStrategy(authError: AuthError): {
    shouldRetry: boolean;
    retryAfter: number;
    maxRetries: number;
  } {
    if (!authError.retryable) {
      return { shouldRetry: false, retryAfter: 0, maxRetries: 0 };
    }

    switch (authError.type) {
      case AuthErrorType.NETWORK_ERROR:
        return { shouldRetry: true, retryAfter: 2000, maxRetries: 3 };
      
      case AuthErrorType.RATE_LIMITED:
        return { shouldRetry: true, retryAfter: 10000, maxRetries: 2 };
      
      case AuthErrorType.SERVICE_UNAVAILABLE:
        return { shouldRetry: true, retryAfter: 5000, maxRetries: 2 };
      
      case AuthErrorType.SESSION_EXPIRED:
        return { shouldRetry: true, retryAfter: 1000, maxRetries: 1 };
      
      default:
        return { shouldRetry: true, retryAfter: 1000, maxRetries: 2 };
    }
  }
}

/**
 * Enhanced error handling function with retry logic
 */
export function handleAuthError(error: any, context?: Record<string, any>): AuthError {
  return AuthErrorHandler.handleError(error, context);
}

/**
 * Retry wrapper for authentication operations
 */
export async function withAuthRetry<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  let lastError: AuthError | null = null;
  let attempts = 0;

  while (attempts < 3) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      lastError = handleAuthError(error, { ...context, attempt: attempts });
      
      const retryStrategy = AuthErrorHandler.getRetryStrategy(lastError);
      
      if (!retryStrategy.shouldRetry || attempts >= retryStrategy.maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryStrategy.retryAfter));
    }
  }

  throw lastError;
}

/**
 * Clean up authentication resources
 */
export function cleanupAuth(): void {
  console.log('Cleaning up authentication resources');
  // Mock cleanup - would clean up Clerk resources
}

// Export auth utilities for backward compatibility
export const authUtils = {
  signInWithGoogle,
  signOutWithClerk,
  getCurrentUser,
  isUserSignedIn,
  getSessionToken,
  refreshSession,
  onAuthStateChange,
  getUserProfile,
  initializeAuth,
  isAuthReady,
  handleAuthError,
  cleanupAuth
};

export default authUtils;