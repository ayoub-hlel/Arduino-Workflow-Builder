import { writable, derived } from "svelte/store";
import { authState as clerkAuthState, isSignedIn, userId } from "./clerk-auth.store";

/**
 * Legacy auth store interface for backward compatibility
 */
export interface LegacyAuthState {
  isLoggedIn: boolean;
  uid: string | null;
  legacyControlled: boolean;
}

/**
 * Internal writable store for legacy compatibility
 * This allows manual overrides during migration phase
 */
const legacyAuthStore = writable<LegacyAuthState>({ 
  isLoggedIn: false, 
  uid: null, 
  legacyControlled: false 
});

/**
 * Derived store that combines Clerk auth state with legacy overrides
 * This provides seamless migration from Firebase to Clerk
 */
const combinedAuthStore = derived(
  [clerkAuthState, legacyAuthStore],
  ([clerkAuth, legacyAuth]) => {
    // During migration, allow manual overrides via legacyAuthStore.set()
    // Once migration is complete, this will primarily use Clerk state
    
    if (legacyAuth.legacyControlled) {
      // Legacy compatibility mode - use the manually set state
      return legacyAuth;
    }
    
    // Use Clerk authentication state
    return {
      isLoggedIn: clerkAuth.isLoaded && clerkAuth.isSignedIn,
      uid: clerkAuth.userId,
      legacyControlled: false
    };
  }
);

/**
 * Export the combined store with legacy interface
 * This maintains compatibility with existing components
 */
export default {
  subscribe: combinedAuthStore.subscribe,
  set: legacyAuthStore.set,
  
  // Additional helper methods for migration
  /**
   * Force update to Clerk-only mode
   */
  useClerkOnly: () => {
    legacyAuthStore.set({
      isLoggedIn: false,
      uid: null,
      legacyControlled: false
    });
  },
  
  /**
   * Temporarily enable Firebase compatibility mode
   */
  enableFirebaseMode: () => {
    legacyAuthStore.update(state => ({
      ...state,
      firebaseControlled: true
    }));
  }
};
