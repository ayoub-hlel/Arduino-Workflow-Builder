// Clerk Authentication Helpers
// This file provides authentication functions using Clerk instead of Firebase
// Maintains the same interface as firebase/auth.ts for compatibility

import { goto } from '$app/navigation';
import { updateAuthState, signOut as clerkSignOut } from '../stores/clerk-auth.store';

/**
 * Login user with Google using Clerk
 * Replaces Firebase's loginGoogleUser function
 */
export const loginGoogleUser = async (): Promise<void> => {
  try {
    // TODO: Replace with actual Clerk authentication once Clerk is installed
    // This is a placeholder implementation for the migration phase
    
    console.log('Clerk Google login initiated');
    
    // Simulate Clerk authentication flow
    // In actual implementation, this would use Clerk's signIn methods
    const mockUser = {
      id: `user-${Date.now()}`,
      emailAddresses: [{ 
        emailAddress: 'user@example.com', 
        id: 'email-1' 
      }],
      firstName: 'User',
      lastName: 'Name',
      username: 'username',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Update Clerk auth state
    updateAuthState({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
      userId: mockUser.id
    });
    
    console.log('Google login successful');
    
  } catch (error) {
    console.error('Error during Google login:', error);
    throw error;
  }
};

/**
 * Login user with email/password using Clerk
 * New function that wasn't in Firebase version
 */
export const loginEmailUser = async (email: string, password: string): Promise<void> => {
  try {
    // TODO: Replace with actual Clerk authentication once Clerk is installed
    console.log('Clerk email login initiated for:', email);
    
    // Simulate successful login
    const mockUser = {
      id: `user-${Date.now()}`,
      emailAddresses: [{ 
        emailAddress: email, 
        id: 'email-1' 
      }],
      firstName: 'User',
      lastName: 'Name',
      username: email.split('@')[0],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    updateAuthState({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
      userId: mockUser.id
    });
    
    console.log('Email login successful');
    
  } catch (error) {
    console.error('Error during email login:', error);
    throw error;
  }
};

/**
 * Sign up new user with email/password using Clerk
 * New function that wasn't in Firebase version
 */
export const signUpEmailUser = async (
  email: string, 
  password: string, 
  firstName?: string, 
  lastName?: string
): Promise<void> => {
  try {
    // TODO: Replace with actual Clerk authentication once Clerk is installed
    console.log('Clerk sign up initiated for:', email);
    
    // Simulate successful signup
    const mockUser = {
      id: `user-${Date.now()}`,
      emailAddresses: [{ 
        emailAddress: email, 
        id: 'email-1' 
      }],
      firstName: firstName || 'User',
      lastName: lastName || 'Name',
      username: email.split('@')[0],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    updateAuthState({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
      userId: mockUser.id
    });
    
    console.log('Sign up successful');
    
  } catch (error) {
    console.error('Error during sign up:', error);
    throw error;
  }
};

/**
 * Logout user using Clerk
 * Replaces Firebase's logout function
 */
export const logout = async (): Promise<void> => {
  try {
    console.log('Clerk logout initiated');
    
    // Use Clerk's sign out function
    await clerkSignOut();
    
    // Redirect to home page after logout
    await goto('/');
    
    console.log('Logout successful');
    
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
};

/**
 * Check if user is currently authenticated
 */
export const isAuthenticated = (): boolean => {
  // This will be properly implemented once Clerk is integrated
  // For now, return false as a safe default
  return false;
};

/**
 * Get current user session token for API calls
 */
export const getSessionToken = async (): Promise<string | null> => {
  try {
    // TODO: Replace with actual Clerk session token once Clerk is installed
    console.log('Getting Clerk session token');
    return null; // Placeholder
  } catch (error) {
    console.error('Error getting session token:', error);
    return null;
  }
};

/**
 * Refresh authentication state
 * Useful for checking auth status after page reload
 */
export const refreshAuthState = async (): Promise<void> => {
  try {
    // TODO: Replace with actual Clerk session check once Clerk is installed
    console.log('Refreshing Clerk auth state');
    
    // For now, just ensure the auth state is marked as loaded
    updateAuthState({ isLoaded: true });
    
  } catch (error) {
    console.error('Error refreshing auth state:', error);
    throw error;
  }
};

// Export legacy functions for backward compatibility
export { loginGoogleUser as loginGoogleUserClerk };
export { logout as logoutClerk };