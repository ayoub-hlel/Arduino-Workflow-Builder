// Legacy Firebase Auth Interface - Redirects to Clerk
// This file provides backward compatibility for Firebase Auth operations

import { signInWithClerk, signOutWithClerk } from "../helpers/auth";

/**
 * Legacy Firebase Google Auth - Now using Clerk
 */
export const loginGoogleUser = async () => {
  console.warn('loginGoogleUser: Firebase compatibility layer - redirecting to Clerk');
  try {
    await signInWithClerk('google');
  } catch (error) {
    console.error('Error signing in with Clerk:', error);
    throw error;
  }
};

/**
 * Legacy Firebase Logout - Now using Clerk
 */
export const logout = async () => {
  console.warn('logout: Firebase compatibility layer - redirecting to Clerk');
  try {
    await signOutWithClerk();
  } catch (error) {
    console.error('Error signing out with Clerk:', error);
    throw error;
  }
};
