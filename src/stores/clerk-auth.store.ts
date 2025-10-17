// Clerk Authentication Store
// This file provides reactive Svelte stores for Clerk authentication state

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Clerk user object type - simplified interface matching Clerk's User
 */
export interface ClerkUser {
  id: string;
  emailAddresses: Array<{
    emailAddress: string;
    id: string;
  }>;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Authentication state interface
 */
export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: ClerkUser | null;
  userId: string | null;
}

/**
 * Initial authentication state
 */
const initialAuthState: AuthState = {
  isLoaded: false,
  isSignedIn: false,
  user: null,
  userId: null
};

/**
 * Core authentication state store
 */
export const authState = writable<AuthState>(initialAuthState);

/**
 * User store - derived from auth state
 */
export const user: Readable<ClerkUser | null> = derived(
  authState,
  ($authState) => $authState.user
);

/**
 * User ID store - derived from auth state
 */
export const userId: Readable<string | null> = derived(
  authState,
  ($authState) => $authState.userId
);

/**
 * Is signed in store - derived from auth state
 */
export const isSignedIn: Readable<boolean> = derived(
  authState,
  ($authState) => $authState.isSignedIn
);

/**
 * Is loaded store - derived from auth state
 */
export const isLoaded: Readable<boolean> = derived(
  authState,
  ($authState) => $authState.isLoaded
);

/**
 * Primary email address store - derived from user
 */
export const userEmail: Readable<string | null> = derived(
  user,
  ($user) => $user?.emailAddresses?.[0]?.emailAddress || null
);

/**
 * Display name store - derived from user
 */
export const displayName: Readable<string> = derived(
  user,
  ($user) => {
    if (!$user) return '';
    if ($user.firstName && $user.lastName) {
      return `${$user.firstName} ${$user.lastName}`;
    }
    if ($user.firstName) return $user.firstName;
    if ($user.username) return $user.username;
    return $user.emailAddresses?.[0]?.emailAddress || 'User';
  }
);

/**
 * Initialize Clerk authentication
 * This will be called from the layout component
 */
export function initializeClerkAuth() {
  if (!browser) return;

  try {
    // Import Clerk SDK dynamically in browser environment
    import('@clerk/clerk-js').then(({ Clerk }) => {
      const clerkPublishableKey = 'pk_test_development_placeholder'; // TODO: Replace with real key
      
      if (!clerkPublishableKey || clerkPublishableKey.includes('placeholder')) {
        console.warn('⚠️ Clerk: Using placeholder publishable key. Please configure VITE_CLERK_PUBLISHABLE_KEY');
        // Set loaded state even with placeholder for development
        authState.update(state => ({ ...state, isLoaded: true }));
        return;
      }

      const clerk = new Clerk(clerkPublishableKey);
      
      clerk.load().then(() => {
        console.log('✅ Clerk: Authentication loaded successfully');
        
        // Update auth state with real Clerk data
        updateAuthState({
          isLoaded: true,
          isSignedIn: !!clerk.user,
          user: clerk.user ? {
            id: clerk.user.id,
            emailAddresses: clerk.user.emailAddresses,
            firstName: clerk.user.firstName,
            lastName: clerk.user.lastName,
            username: clerk.user.username,
            imageUrl: clerk.user.imageUrl,
            createdAt: clerk.user.createdAt,
            updatedAt: clerk.user.updatedAt
          } : null,
          userId: clerk.user?.id || null
        });

        // Listen for authentication state changes
        clerk.addListener(({ user, session }) => {
          updateAuthState({
            isSignedIn: !!user,
            user: user ? {
              id: user.id,
              emailAddresses: user.emailAddresses,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
              imageUrl: user.imageUrl,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            } : null,
            userId: user?.id || null
          });
        });

        // Store clerk instance globally for debugging
        if (typeof window !== 'undefined') {
          (window as any).clerk = clerk;
        }
        
      }).catch((error) => {
        console.error('❌ Clerk: Failed to load authentication', error);
        // Set loaded state even on error to prevent hanging
        authState.update(state => ({ 
          ...state, 
          isLoaded: true,
          error: error.message 
        }));
      });
      
    }).catch((error) => {
      console.error('❌ Clerk: Failed to import SDK', error);
      // Set loaded state even on import error
      authState.update(state => ({ 
        ...state, 
        isLoaded: true,
        error: 'Failed to load Clerk SDK' 
      }));
    });
    
  } catch (error) {
    console.error('❌ Clerk: Initialization error', error);
    // Set loaded state even on initialization error
    authState.update(state => ({ 
      ...state, 
      isLoaded: true,
      error: 'Clerk initialization failed' 
    }));
  }
}

/**
 * Update authentication state
 * Called by Clerk authentication components
 */
export function updateAuthState(newState: Partial<AuthState>) {
  authState.update(state => ({
    ...state,
    ...newState
  }));
}

/**
 * Sign out function
 * This will integrate with Clerk's signOut method
 */
export async function signOut(): Promise<void> {
  if (!browser) return;

  try {
    // This will be implemented once Clerk is installed
    console.log('Clerk sign out placeholder');
    
    // Reset auth state
    authState.set(initialAuthState);
    authState.update(state => ({ ...state, isLoaded: true }));
    
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}

/**
 * Get current user session token
 * This will integrate with Clerk's session management
 */
export async function getSessionToken(): Promise<string | null> {
  if (!browser) return null;

  try {
    // This will be implemented once Clerk is installed  
    console.log('Get session token placeholder');
    return null;
  } catch (error) {
    console.error('Error getting session token:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 * Utility function for components and guards
 */
export function checkAuth(): boolean {
  let currentState: AuthState = initialAuthState;
  const unsubscribe = authState.subscribe(state => { currentState = state; });
  unsubscribe();
  return currentState.isLoaded && currentState.isSignedIn;
}

/**
 * Wait for auth to be loaded
 * Utility function for components that need to wait for auth state
 */
export function waitForAuthLoad(): Promise<AuthState> {
  return new Promise((resolve) => {
    const unsubscribe = authState.subscribe((state) => {
      if (state.isLoaded) {
        unsubscribe();
        resolve(state);
      }
    });
  });
}