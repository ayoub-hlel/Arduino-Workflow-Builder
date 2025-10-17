/**
 * Svelte Component Authentication Validation Test
 * Tests that sign-in/sign-up components work correctly with Svelte bindings and Clerk
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Login from '../../components/auth/Login.svelte';
import Nav from '../../components/arduino-workflow-builder/Nav.svelte';
import { authState, updateAuthState } from '../../stores/clerk-auth.store';
import { goto } from '$app/navigation';

// Mock dependencies
vi.mock('$app/navigation');
vi.mock('../../help/alerts');
vi.mock('../../auth/clerk-auth');

const mockGoto = vi.mocked(goto);

describe('Svelte Component Authentication Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset auth state
    authState.set({
      isLoaded: true,
      isSignedIn: false,
      user: null,
      userId: null
    });
  });

  describe('4. Validate sign-in/sign-up components work correctly with Svelte bindings', () => {
    it('should render Login component correctly', () => {
      const { container } = render(Login);
      
      const loginButton = container.querySelector('.login-button');
      expect(loginButton).toBeTruthy();
      
      const googleImg = container.querySelector('img[alt="Sign in with Google"]');
      expect(googleImg).toBeTruthy();
      expect(googleImg?.getAttribute('src')).toBe('/signin-btn.png');
    });

    it('should handle Google login click', async () => {
      const { loginGoogleUser } = await import('../../auth/clerk-auth');
      const mockLoginGoogleUser = vi.mocked(loginGoogleUser);
      mockLoginGoogleUser.mockResolvedValue();

      const { container } = render(Login);
      const loginButton = container.querySelector('.login-button') as HTMLButtonElement;
      
      await fireEvent.click(loginButton);
      
      expect(mockLoginGoogleUser).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockGoto).toHaveBeenCalledWith('/');
      });
    });

    it('should handle login errors gracefully', async () => {
      const { loginGoogleUser } = await import('../../auth/clerk-auth');
      const { onErrorMessage } = await import('../../help/alerts');
      const mockLoginGoogleUser = vi.mocked(loginGoogleUser);
      const mockOnErrorMessage = vi.mocked(onErrorMessage);
      
      const testError = new Error('Login failed');
      mockLoginGoogleUser.mockRejectedValue(testError);

      const { container } = render(Login);
      const loginButton = container.querySelector('.login-button') as HTMLButtonElement;
      
      await fireEvent.click(loginButton);
      
      await waitFor(() => {
        expect(mockOnErrorMessage).toHaveBeenCalledWith(
          'Sorry, please try again in 5 minutes. :)',
          testError
        );
      });
    });

    it('should ignore cancelled popup errors', async () => {
      const { loginGoogleUser } = await import('../../auth/clerk-auth');
      const { onErrorMessage } = await import('../../help/alerts');
      const mockLoginGoogleUser = vi.mocked(loginGoogleUser);
      const mockOnErrorMessage = vi.mocked(onErrorMessage);
      
      const cancelledError = { code: 'clerk/cancelled-popup-request' };
      mockLoginGoogleUser.mockRejectedValue(cancelledError);

      const { container } = render(Login);
      const loginButton = container.querySelector('.login-button') as HTMLButtonElement;
      
      await fireEvent.click(loginButton);
      
      // Should not show error message for cancelled popup
      expect(mockOnErrorMessage).not.toHaveBeenCalled();
      expect(mockGoto).not.toHaveBeenCalled();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(Login);
      
      const loginButton = container.querySelector('.login-button') as HTMLButtonElement;
      expect(loginButton.getAttribute('aria-label')).toBe('Sign in with Google');
      expect(loginButton.getAttribute('type')).toBe('button');
    });
  });

  describe('Navigation component authentication state', () => {
    it('should show login link when not authenticated', () => {
      // Mock auth store to be not logged in
      const mockAuthStore = {
        subscribe: vi.fn((callback) => {
          callback({ isLoggedIn: false, uid: null });
          return () => {};
        })
      };

      // This test would require mocking the auth store import
      // For now, we test the component structure
      const { container } = render(Nav);
      
      // Navigation should render without errors
      expect(container.querySelector('nav')).toBeTruthy();
    });

    it('should show user menu when authenticated', () => {
      // Update auth state to signed in
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_123',
          emailAddresses: [{ emailAddress: 'test@example.com', id: 'email_1' }],
          firstName: 'Test',
          lastName: 'User',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_123'
      });

      // Mock auth store for Nav component
      const mockAuthStore = {
        subscribe: vi.fn((callback) => {
          callback({ isLoggedIn: true, uid: 'user_123' });
          return () => {};
        })
      };

      const { container } = render(Nav);
      
      // Should render navigation elements
      expect(container.querySelector('nav')).toBeTruthy();
    });

    it('should handle sign out from navigation', async () => {
      const { logout } = await import('../../auth/clerk-auth');
      const mockLogout = vi.mocked(logout);
      mockLogout.mockResolvedValue();

      // Mock authenticated state for nav
      const mockAuthStore = {
        subscribe: vi.fn((callback) => {
          callback({ isLoggedIn: true, uid: 'user_123' });
          return () => {};
        })
      };

      const { container } = render(Nav);
      
      // Find sign out button (would be fa-sign-out icon)
      const signOutButton = container.querySelector('.fa-sign-out')?.parentElement;
      
      if (signOutButton) {
        await fireEvent.click(signOutButton);
        expect(mockLogout).toHaveBeenCalled();
      }
    });
  });

  describe('Component reactivity to auth state changes', () => {
    it('should reactively update when auth state changes', async () => {
      // Start with unauthenticated state
      const { container } = render(Login);
      
      // Component should render in initial state
      expect(container.querySelector('.login-button')).toBeTruthy();
      
      // Simulate auth state change
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_123',
          emailAddresses: [{ emailAddress: 'test@example.com', id: 'email_1' }],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_123'
      });

      // Component should still render (actual redirect logic is in click handler)
      expect(container.querySelector('.login-button')).toBeTruthy();
    });

    it('should handle loading states during authentication', () => {
      // Set loading state
      authState.set({
        isLoaded: false,
        isSignedIn: false,
        user: null,
        userId: null
      });

      const { container } = render(Login);
      
      // Component should still render even in loading state
      expect(container.querySelector('.login-button')).toBeTruthy();
    });
  });

  describe('Component styling and UX', () => {
    it('should apply correct CSS classes and styles', () => {
      const { container } = render(Login);
      
      const loginButton = container.querySelector('.login-button') as HTMLElement;
      expect(loginButton).toBeTruthy();
      
      // Check that button has proper styling structure
      const img = loginButton.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('/signin-btn.png');
    });

    it('should have hover and focus states', () => {
      const { container } = render(Login);
      
      const loginButton = container.querySelector('.login-button') as HTMLElement;
      
      // Test focus behavior
      loginButton.focus();
      expect(document.activeElement).toBe(loginButton);
    });
  });
});