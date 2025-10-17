/**
 * Authentication State Management Validation Test
 * Tests that authentication state is properly managed through Svelte stores derived from Clerk
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { 
  authState, 
  user, 
  userId, 
  isSignedIn, 
  userDisplayName, 
  updateAuthState,
  checkAuth,
  waitForAuthLoad
} from '../../stores/clerk-auth.store';
import type { ClerkUser, AuthState } from '../../stores/clerk-auth.store';

describe('Authentication State Management Validation', () => {
  beforeEach(() => {
    // Reset auth state
    authState.set({
      isLoaded: false,
      isSignedIn: false,
      user: null,
      userId: null
    });
  });

  describe('2. Check that authentication state is managed through Svelte stores', () => {
    it('should manage auth state reactively through Svelte stores', () => {
      const mockUser: ClerkUser = {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com', id: 'email_1' }],
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        imageUrl: '/avatar.png',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Update auth state using the actual function from clerk-auth.store.ts
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: mockUser,
        userId: mockUser.id
      });

      // Verify derived stores update correctly
      expect(get(isSignedIn)).toBe(true);
      expect(get(userId)).toBe('user_123');
      expect(get(user)).toEqual(mockUser);
      expect(get(userDisplayName)).toBe('Test User');
    });

    it('should derive user properties reactively', () => {
      const mockUser: ClerkUser = {
        id: 'user_456',
        emailAddresses: [{ emailAddress: 'user@test.com', id: 'email_2' }],
        firstName: 'John',
        lastName: 'Doe',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: mockUser,
        userId: mockUser.id
      });

      // Test derived stores update correctly
      const currentUser = get(user);
      expect(currentUser?.firstName).toBe('John');
      expect(currentUser?.emailAddresses[0].emailAddress).toBe('user@test.com');
      expect(get(userDisplayName)).toBe('John Doe');
    });

    it('should handle user with only email (no firstName/lastName)', () => {
      const mockUser: ClerkUser = {
        id: 'user_789',
        emailAddresses: [{ emailAddress: 'email-only@test.com', id: 'email_3' }],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: mockUser,
        userId: mockUser.id
      });

      // Should fall back to email for display name
      expect(get(userDisplayName)).toBe('email-only@test.com');
    });

    it('should handle sign out state correctly', () => {
      // First sign in
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: { id: 'test', emailAddresses: [], createdAt: 0, updatedAt: 0 },
        userId: 'test'
      });

      // Then sign out
      updateAuthState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        userId: null
      });

      expect(get(isSignedIn)).toBe(false);
      expect(get(user)).toBeNull();
      expect(get(userId)).toBeNull();
      expect(get(userDisplayName)).toBe('User');
    });
  });

  describe('Store utility functions', () => {
    it('should check authentication status correctly', () => {
      // Initially not authenticated
      expect(checkAuth()).toBe(false);

      // After signing in
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: { id: 'test', emailAddresses: [], createdAt: 0, updatedAt: 0 },
        userId: 'test'
      });

      expect(checkAuth()).toBe(true);
    });

    it('should wait for auth to load', async () => {
      // Start with unloaded state
      const authPromise = waitForAuthLoad();

      // Load auth state
      setTimeout(() => {
        updateAuthState({
          isLoaded: true,
          isSignedIn: false,
          user: null,
          userId: null
        });
      }, 10);

      const authState = await authPromise;
      expect(authState.isLoaded).toBe(true);
    });
  });

  describe('Store reactivity', () => {
    it('should notify subscribers when auth state changes', () => {
      let callCount = 0;
      let lastState: AuthState | null = null;

      const unsubscribe = authState.subscribe((state) => {
        callCount++;
        lastState = state;
      });

      // Initial subscription should fire
      expect(callCount).toBe(1);
      expect(lastState?.isLoaded).toBe(false);

      // Update should trigger subscriber
      updateAuthState({ isLoaded: true });
      expect(callCount).toBe(2);
      expect(lastState?.isLoaded).toBe(true);

      unsubscribe();
    });

    it('should handle partial state updates', () => {
      // Set initial state
      updateAuthState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        userId: null
      });

      // Partial update should merge with existing state
      updateAuthState({
        isSignedIn: true,
        userId: 'new_user'
      });

      const currentState = get(authState);
      expect(currentState.isLoaded).toBe(true); // Preserved
      expect(currentState.isSignedIn).toBe(true); // Updated
      expect(currentState.userId).toBe('new_user'); // Updated
      expect(currentState.user).toBeNull(); // Preserved
    });
  });
});