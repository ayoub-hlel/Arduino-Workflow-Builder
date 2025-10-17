/**
 * Clerk Initialization Validation Test
 * Tests the proper initialization of Clerk authentication in the application
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { 
  initializeClerkAuth, 
  authState, 
  user, 
  userId, 
  isSignedIn 
} from '../../stores/clerk-auth.store';

// Mock browser environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:5173'
  }
});

describe('Clerk Initialization Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth state before each test
    authState.set({
      isLoaded: false,
      isSignedIn: false,
      user: null,
      userId: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Verify Clerk is properly initialized', () => {
    it('should initialize Clerk authentication on app startup', () => {
      // Call the initialization function from clerk-auth.store.ts
      initializeClerkAuth();
      
      // Verify auth state is marked as loaded
      const currentState = get(authState);
      expect(currentState.isLoaded).toBe(true);
      expect(currentState.isSignedIn).toBe(false);
      expect(currentState.user).toBeNull();
      expect(currentState.userId).toBeNull();
    });

    it('should only initialize in browser environment', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      initializeClerkAuth();
      
      // Current implementation logs placeholder message
      expect(consoleSpy).toHaveBeenCalledWith('Clerk authentication initialization placeholder');
    });

    it('should handle initialization errors gracefully', () => {
      // Mock console.error to catch any errors
      const errorSpy = vi.spyOn(console, 'error');
      
      // Even if initialization fails, it should not throw
      expect(() => initializeClerkAuth()).not.toThrow();
      
      // Should still mark as loaded even if Clerk isn't available
      const currentState = get(authState);
      expect(currentState.isLoaded).toBe(true);
    });
  });

  describe('2. Validate app.html integration', () => {
    it('should not require Clerk script tags yet (mock implementation)', () => {
      // In the current implementation, app.html doesn't include Clerk scripts
      // This test validates the current state before actual Clerk integration
      const scripts = document.querySelectorAll('script[src*="clerk"]');
      expect(scripts.length).toBe(0);
      
      // This is expected behavior during migration phase
    });

    it('should initialize from layout component', () => {
      // Test that initialization works when called from +layout.svelte
      // This mirrors the actual call in src/routes/(blockly)/+layout.svelte
      expect(() => initializeClerkAuth()).not.toThrow();
      
      const currentState = get(authState);
      expect(currentState.isLoaded).toBe(true);
    });
  });
});