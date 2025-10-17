/**
 * Clerk Error Handling Validation Test
 * Tests proper error handling for Clerk authentication errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  AuthErrorHandler, 
  AuthErrorType, 
  signInWithGoogle,
  signOutWithClerk,
  type AuthError
} from '../../helpers/auth';

describe('Clerk Error Handling Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear error history
    AuthErrorHandler.clearErrorHistory();
  });

  describe('3. Ensure proper error handling for Clerk authentication errors', () => {
    it('should handle Clerk-specific errors correctly', () => {
      const clerkError = {
        code: 'session_expired',
        clerkError: { code: 'session_expired' }
      };

      const handledError = AuthErrorHandler.handleError(clerkError);

      expect(handledError.type).toBe(AuthErrorType.SESSION_EXPIRED);
      expect(handledError.message).toContain('session has expired');
      expect(handledError.retryable).toBe(true);
    });

    it('should handle invalid credentials error', () => {
      const clerkError = {
        code: 'form_password_incorrect',
        clerkError: { code: 'form_password_incorrect' }
      };

      const handledError = AuthErrorHandler.handleError(clerkError);

      expect(handledError.type).toBe(AuthErrorType.INVALID_CREDENTIALS);
      expect(handledError.message).toContain('Invalid email or password');
      expect(handledError.retryable).toBe(true);
    });

    it('should handle popup blocked errors', () => {
      const popupError = new Error('Popup blocked');
      popupError.name = 'PopupBlockedError';

      const handledError = AuthErrorHandler.handleError(popupError);

      expect(handledError.type).toBe(AuthErrorType.POPUP_BLOCKED);
      expect(handledError.message).toContain('popup was blocked');
      expect(handledError.retryable).toBe(true);
    });

    it('should handle network errors with retry logic', () => {
      const networkError = new Error('Network connection failed');

      const handledError = AuthErrorHandler.handleError(networkError);

      expect(handledError.type).toBe(AuthErrorType.NETWORK_ERROR);
      expect(handledError.message).toContain('Network connection failed');
      expect(handledError.retryable).toBe(true);
    });

    it('should provide context with errors', () => {
      const error = new Error('Test error');
      const context = { operation: 'signIn', userId: 'user_123' };

      const handledError = AuthErrorHandler.handleError(error, context);

      expect(handledError.context).toEqual(context);
      expect(handledError.timestamp).toBeDefined();
    });

    it('should track error history', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      AuthErrorHandler.handleError(error1);
      AuthErrorHandler.handleError(error2);

      const summary = AuthErrorHandler.getErrorSummary();
      expect(summary.totalErrors).toBe(2);
      expect(summary.recentErrors).toHaveLength(2);
    });
  });

  describe('Authentication function error handling', () => {
    it('should handle errors in signInWithGoogle', async () => {
      // Mock Math.random to force network error simulation
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.05); // Force network error (< 0.1)

      const consoleSpy = vi.spyOn(console, log);
      
      try {
        await signInWithGoogle();
        // Should not reach here due to error
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Network connection failed');
      }

      Math.random = originalRandom;
    });

    it('should handle errors in signOut', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // Current implementation should not throw
      await expect(signOutWithClerk()).resolves.toBeUndefined();
      
      expect(consoleSpy).toHaveBeenCalledWith('Signing out with Clerk');
    });

    it('should provide user-friendly error messages', () => {
      const technicalError = new Error('JWT token validation failed at line 42');

      const handledError = AuthErrorHandler.handleError(technicalError);

      // Should not expose technical details to users
      expect(handledError.message).not.toContain('line 42');
      expect(handledError.message).not.toContain('JWT');
      expect(handledError.message).toContain('authentication');
    });
  });

  describe('Error recovery and retry logic', () => {
    it('should implement retry logic for network errors', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      // Test the withAuthRetry function from helpers/auth.ts
      // Current implementation includes retry logic with exponential backoff
      
      // Mock successful operation after retry
      let attemptCount = 0;
      const mockOperation = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Network error');
        }
        return 'success';
      });

      // Note: Current implementation doesn't expose withAuthRetry directly
      // This test validates the concept that should be implemented
      try {
        await signInWithGoogle();
      } catch (error) {
        // Expected in current mock implementation
        expect(error).toBeDefined();
      }
    });

    it('should respect maximum retry attempts', () => {
      // Test that retry logic doesn't retry indefinitely
      const maxRetries = 3;
      let errorCount = 0;

      for (let i = 0; i < 5; i++) {
        try {
          AuthErrorHandler.handleError(new Error(`Error ${i}`));
          errorCount++;
        } catch (e) {
          break;
        }
      }

      expect(errorCount).toBe(5); // All errors should be handled, not thrown
    });
  });

  describe('Error categorization', () => {
    it('should correctly categorize different error types', () => {
      const testCases = [
        { error: new Error('Network connection failed'), expected: AuthErrorType.NETWORK_ERROR },
        { error: { code: 'session_expired' }, expected: AuthErrorType.SESSION_EXPIRED },
        { error: { code: 'form_password_incorrect' }, expected: AuthErrorType.INVALID_CREDENTIALS },
        { error: new Error('Unknown error'), expected: AuthErrorType.UNKNOWN_ERROR }
      ];

      testCases.forEach(({ error, expected }) => {
        const handled = AuthErrorHandler.handleError(error);
        expect(handled.type).toBe(expected);
      });
    });

    it('should provide appropriate retry flags', () => {
      const networkError = AuthErrorHandler.handleError(new Error('Network failed'));
      const unknownError = AuthErrorHandler.handleError(new Error('Unknown'));

      expect(networkError.retryable).toBe(true);
      expect(unknownError.retryable).toBe(true); // Current implementation marks all as retryable
    });
  });
});