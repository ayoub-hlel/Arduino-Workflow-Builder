/**
 * Authentication State Propagation Validation Test  
 * Tests that authentication state changes propagate reactively to all components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get, writable } from 'svelte/store';
import { 
  authState, 
  isSignedIn, 
  user, 
  userId, 
  displayName,
  updateAuthState 
} from '../../stores/clerk-auth.store';
import type { ClerkUser } from '../../stores/clerk-auth.store';

// Mock components that would consume auth state
const createMockComponent = (name: string) => {
  let authUpdateCount = 0;
  let lastAuthState: any = null;

  const component = {
    name,
    authUpdateCount: () => authUpdateCount,
    lastAuthState: () => lastAuthState,
    subscribe: (store: any) => {
      return store.subscribe((state: any) => {
        authUpdateCount++;
        lastAuthState = state;
      });
    }
  };

  return component;
};

describe('Authentication State Propagation Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset auth state
    authState.set({
      isLoaded: false,
      isSignedIn: false,
      user: null,
      userId: null
    });
  });

  describe('9. Test authentication state changes propagate reactively to all components', () => {
    it('should propagate auth state changes to multiple subscribers', () => {
      const component1 = createMockComponent('Nav');
      const component2 = createMockComponent('ProjectSettings');
      const component3 = createMockComponent('UserProfile');

      // Subscribe all components to auth state
      const unsubscribe1 = component1.subscribe(authState);
      const unsubscribe2 = component2.subscribe(authState);
      const unsubscribe3 = component3.subscribe(authState);

      // Initial subscription should trigger
      expect(component1.authUpdateCount()).toBe(1);
      expect(component2.authUpdateCount()).toBe(1);
      expect(component3.authUpdateCount()).toBe(1);

      // Update auth state
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_propagation',
          emailAddresses: [{ emailAddress: 'propagation@example.com', id: 'email_1' }],
          firstName: 'Propagation',
          lastName: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_propagation'
      });

      // All components should receive the update
      expect(component1.authUpdateCount()).toBe(2);
      expect(component2.authUpdateCount()).toBe(2);
      expect(component3.authUpdateCount()).toBe(2);

      // All should have the same state
      const state1 = component1.lastAuthState();
      const state2 = component2.lastAuthState();
      const state3 = component3.lastAuthState();

      expect(state1).toEqual(state2);
      expect(state2).toEqual(state3);
      expect(state1.isSignedIn).toBe(true);
      expect(state1.userId).toBe('user_propagation');

      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });

    it('should propagate derived store changes reactively', () => {
      let isSignedInUpdates = 0;
      let userUpdates = 0;
      let userIdUpdates = 0;
      let displayNameUpdates = 0;

      const unsubscribeSignedIn = isSignedIn.subscribe(() => isSignedInUpdates++);
      const unsubscribeUser = user.subscribe(() => userUpdates++);
      const unsubscribeUserId = userId.subscribe(() => userIdUpdates++);
      const unsubscribeDisplayName = displayName.subscribe(() => displayNameUpdates++);

      // Reset counters after initial subscriptions
      isSignedInUpdates = 0;
      userUpdates = 0;
      userIdUpdates = 0;
      displayNameUpdates = 0;

      // Update auth state
      const mockUser: ClerkUser = {
        id: 'user_derived_test',
        emailAddresses: [{ emailAddress: 'derived@example.com', id: 'email_1' }],
        firstName: 'Derived',
        lastName: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: mockUser,
        userId: mockUser.id
      });

      // All derived stores should have updated
      expect(isSignedInUpdates).toBe(1);
      expect(userUpdates).toBe(1);
      expect(userIdUpdates).toBe(1);
      expect(displayNameUpdates).toBe(1);

      // Verify derived values are correct
      expect(get(isSignedIn)).toBe(true);
      expect(get(user)).toEqual(mockUser);
      expect(get(userId)).toBe('user_derived_test');
      expect(get(displayName)).toBe('Derived Test');

      unsubscribeSignedIn();
      unsubscribeUser();
      unsubscribeUserId();
      unsubscribeDisplayName();
    });

    it('should handle partial state updates reactively', () => {
      // Set initial authenticated state
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_partial',
          emailAddresses: [{ emailAddress: 'partial@example.com', id: 'email_1' }],
          firstName: 'Initial',
          lastName: 'Name',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_partial'
      });

      let updateCount = 0;
      const unsubscribe = authState.subscribe(() => updateCount++);
      updateCount = 0; // Reset after initial subscription

      // Partial update - only change loading state
      updateAuthState({ isLoaded: false });
      expect(updateCount).toBe(1);
      
      const currentState = get(authState);
      expect(currentState.isLoaded).toBe(false);
      expect(currentState.isSignedIn).toBe(true); // Should preserve existing value
      expect(currentState.userId).toBe('user_partial'); // Should preserve existing value

      unsubscribe();
    });

    it('should propagate sign out state changes', () => {
      // Set up authenticated state
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_signout_propagation',
          emailAddresses: [{ emailAddress: 'signout@example.com', id: 'email_1' }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_signout_propagation'
      });

      // Track all derived store changes
      let isSignedInValue = false;
      let userValue = null;
      let userIdValue = null;

      const unsubscribeSignedIn = isSignedIn.subscribe(value => isSignedInValue = value);
      const unsubscribeUser = user.subscribe(value => userValue = value);
      const unsubscribeUserId = userId.subscribe(value => userIdValue = value);

      // Verify initial values
      expect(isSignedInValue).toBe(true);
      expect(userValue).not.toBeNull();
      expect(userIdValue).toBe('user_signout_propagation');

      // Sign out
      updateAuthState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        userId: null
      });

      // All derived stores should reflect sign out
      expect(isSignedInValue).toBe(false);
      expect(userValue).toBeNull();
      expect(userIdValue).toBeNull();

      unsubscribeSignedIn();
      unsubscribeUser();
      unsubscribeUserId();
    });
  });

  describe('Cross-component state synchronization', () => {
    it('should synchronize state across navigation and content components', () => {
      // Simulate Nav component subscription
      let navAuthState: any = null;
      const navUnsubscribe = authState.subscribe(state => navAuthState = state);

      // Simulate ProjectSettings component subscription  
      let projectAuthState: any = null;
      const projectUnsubscribe = isSignedIn.subscribe(signedIn => {
        projectAuthState = { isSignedIn: signedIn };
      });

      // Update authentication state
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_sync_test',
          emailAddresses: [{ emailAddress: 'sync@example.com', id: 'email_1' }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_sync_test'
      });

      // Both components should see the update
      expect(navAuthState?.isSignedIn).toBe(true);
      expect(navAuthState?.userId).toBe('user_sync_test');
      expect(projectAuthState?.isSignedIn).toBe(true);

      navUnsubscribe();
      projectUnsubscribe();
    });

    it('should handle rapid state changes consistently', () => {
      const stateHistory: any[] = [];
      
      const unsubscribe = authState.subscribe(state => {
        stateHistory.push({ ...state, timestamp: Date.now() });
      });

      // Rapid state changes
      updateAuthState({ isLoaded: true });
      updateAuthState({ isSignedIn: true });
      updateAuthState({ 
        user: {
          id: 'rapid_user',
          emailAddresses: [{ emailAddress: 'rapid@example.com', id: 'email_1' }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });
      updateAuthState({ userId: 'rapid_user' });

      // Should have recorded all state changes
      expect(stateHistory.length).toBeGreaterThan(3);
      
      // Final state should be consistent
      const finalState = stateHistory[stateHistory.length - 1];
      expect(finalState.isLoaded).toBe(true);
      expect(finalState.isSignedIn).toBe(true);
      expect(finalState.userId).toBe('rapid_user');

      unsubscribe();
    });

    it('should maintain state consistency during async operations', async () => {
      let asyncStateUpdates = 0;
      
      const unsubscribe = authState.subscribe(() => asyncStateUpdates++);
      asyncStateUpdates = 0; // Reset after subscription

      // Simulate async authentication operations
      const asyncUpdates = [
        () => updateAuthState({ isLoaded: true }),
        () => updateAuthState({ 
          isSignedIn: true,
          user: {
            id: 'async_user',
            emailAddresses: [{ emailAddress: 'async@example.com', id: 'email_1' }],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }),
        () => updateAuthState({ userId: 'async_user' })
      ];

      // Execute updates with small delays
      for (const update of asyncUpdates) {
        await new Promise(resolve => setTimeout(resolve, 1));
        update();
      }

      expect(asyncStateUpdates).toBe(3);
      
      // Final state should be consistent
      const finalState = get(authState);
      expect(finalState.isLoaded).toBe(true);
      expect(finalState.isSignedIn).toBe(true);
      expect(finalState.userId).toBe('async_user');

      unsubscribe();
    });
  });

  describe('Component lifecycle integration', () => {
    it('should handle component mounting during auth state changes', () => {
      // Start with an auth update in progress
      updateAuthState({ isLoaded: true });

      // Simulate component mounting mid-update
      let mountedComponentState: any = null;
      const lateSubscriber = authState.subscribe(state => {
        mountedComponentState = state;
      });

      // Should immediately receive current state
      expect(mountedComponentState).not.toBeNull();
      expect(mountedComponentState.isLoaded).toBe(true);

      // Further updates should still propagate
      updateAuthState({ isSignedIn: true });
      expect(mountedComponentState.isSignedIn).toBe(true);

      lateSubscriber();
    });

    it('should handle component unmounting without affecting other subscribers', () => {
      let component1Updates = 0;
      let component2Updates = 0;

      const component1Unsubscribe = authState.subscribe(() => component1Updates++);
      const component2Unsubscribe = authState.subscribe(() => component2Updates++);

      // Reset counters
      component1Updates = 0;
      component2Updates = 0;

      // Update state - both should receive
      updateAuthState({ isLoaded: true });
      expect(component1Updates).toBe(1);
      expect(component2Updates).toBe(1);

      // Unmount component 1
      component1Unsubscribe();

      // Update state again - only component 2 should receive
      updateAuthState({ isSignedIn: true });
      expect(component1Updates).toBe(1); // Should not increment
      expect(component2Updates).toBe(2); // Should increment

      component2Unsubscribe();
    });

    it('should handle error in subscriber without affecting others', () => {
      let goodSubscriberUpdates = 0;
      let errorSubscriberCalls = 0;

      // Good subscriber
      const goodUnsubscribe = authState.subscribe(() => {
        goodSubscriberUpdates++;
      });

      // Subscriber that throws error
      const errorUnsubscribe = authState.subscribe(() => {
        errorSubscriberCalls++;
        if (errorSubscriberCalls > 1) {
          throw new Error('Subscriber error');
        }
      });

      // Reset counters
      goodSubscriberUpdates = 0;
      errorSubscriberCalls = 0;

      // First update should work for both
      updateAuthState({ isLoaded: true });
      expect(goodSubscriberUpdates).toBe(1);
      expect(errorSubscriberCalls).toBe(1);

      // Second update - error subscriber throws, but good subscriber should still work
      try {
        updateAuthState({ isSignedIn: true });
      } catch (e) {
        // Expected error from error subscriber
      }

      expect(goodSubscriberUpdates).toBe(2);
      expect(errorSubscriberCalls).toBe(2);

      goodUnsubscribe();
      errorUnsubscribe();
    });
  });

  describe('Performance and memory management', () => {
    it('should not create memory leaks with many subscribe/unsubscribe cycles', () => {
      const subscriptions = [];

      // Create many subscriptions
      for (let i = 0; i < 100; i++) {
        const unsubscribe = authState.subscribe(() => {});
        subscriptions.push(unsubscribe);
      }

      // Unsubscribe all
      subscriptions.forEach(unsubscribe => unsubscribe());

      // Should be able to continue normal operations
      let finalSubscriberCalled = false;
      const finalUnsubscribe = authState.subscribe(() => {
        finalSubscriberCalled = true;
      });

      updateAuthState({ isLoaded: true });
      expect(finalSubscriberCalled).toBe(true);

      finalUnsubscribe();
    });

    it('should efficiently handle multiple rapid state changes', () => {
      let updateCount = 0;
      const unsubscribe = authState.subscribe(() => updateCount++);
      updateCount = 0; // Reset after initial subscription

      const startTime = Date.now();
      
      // Perform many rapid updates
      for (let i = 0; i < 50; i++) {
        updateAuthState({ isLoaded: i % 2 === 0 });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (under 100ms for 50 updates)
      expect(duration).toBeLessThan(100);
      expect(updateCount).toBe(50);

      unsubscribe();
    });
  });
});