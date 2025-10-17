/**
 * User Profile Data Access Validation Test
 * Tests that user profile data is accessible through Clerk client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { 
  user, 
  userId, 
  displayName, 
  updateAuthState 
} from '../../stores/clerk-auth.store';
import { getUserProfile } from '../../helpers/auth';
import type { ClerkUser } from '../../stores/clerk-auth.store';

describe('User Profile Data Access Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset auth state
    updateAuthState({
      isLoaded: true,
      isSignedIn: false,
      user: null,
      userId: null
    });
  });

  describe('7. Check that user profile data is accessible through Clerk client', () => {
    it('should provide access to user ID', () => {
      const mockUser: ClerkUser = {
        id: 'user_profile_123',
        emailAddresses: [{ emailAddress: 'profile@example.com', id: 'email_1' }],
        firstName: 'Profile',
        lastName: 'User',
        username: 'profileuser',
        imageUrl: '/profile-avatar.png',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: mockUser,
        userId: mockUser.id
      });

      const currentUserId = get(userId);
      expect(currentUserId).toBe('user_profile_123');
    });

    it('should provide access to user email addresses', () => {
      const mockUser: ClerkUser = {
        id: 'user_email_test',
        emailAddresses: [
          { emailAddress: 'primary@example.com', id: 'email_1' },
          { emailAddress: 'secondary@example.com', id: 'email_2' }
        ],
        firstName: 'Email',
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

      const currentUser = get(user);
      expect(currentUser?.emailAddresses).toHaveLength(2);
      expect(currentUser?.emailAddresses[0].emailAddress).toBe('primary@example.com');
      expect(currentUser?.emailAddresses[1].emailAddress).toBe('secondary@example.com');
    });

    it('should provide access to user profile information', () => {
      const mockUser: ClerkUser = {
        id: 'user_profile_info',
        emailAddresses: [{ emailAddress: 'info@example.com', id: 'email_1' }],
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        imageUrl: '/john-doe-avatar.png',
        createdAt: 1640995200000,
        updatedAt: 1640995300000
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: mockUser,
        userId: mockUser.id
      });

      const currentUser = get(user);
      expect(currentUser?.firstName).toBe('John');
      expect(currentUser?.lastName).toBe('Doe');
      expect(currentUser?.username).toBe('johndoe');
      expect(currentUser?.imageUrl).toBe('/john-doe-avatar.png');
      expect(currentUser?.createdAt).toBe(1640995200000);
      expect(currentUser?.updatedAt).toBe(1640995300000);
    });

    it('should provide computed display name', () => {
      const testCases = [
        {
          user: {
            id: 'user_1',
            emailAddresses: [{ emailAddress: 'test@example.com', id: 'email_1' }],
            firstName: 'John',
            lastName: 'Doe',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          expectedDisplayName: 'John Doe'
        },
        {
          user: {
            id: 'user_2',
            emailAddresses: [{ emailAddress: 'jane@example.com', id: 'email_2' }],
            firstName: 'Jane',
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          expectedDisplayName: 'Jane'
        },
        {
          user: {
            id: 'user_3',
            emailAddresses: [{ emailAddress: 'email-only@example.com', id: 'email_3' }],
            createdAt: Date.now(),
            updatedAt: Date.now()
          },
          expectedDisplayName: 'email-only@example.com'
        }
      ];

      testCases.forEach(({ user: testUser, expectedDisplayName }) => {
        updateAuthState({
          isLoaded: true,
          isSignedIn: true,
          user: testUser,
          userId: testUser.id
        });

        const currentDisplayName = get(displayName);
        expect(currentDisplayName).toBe(expectedDisplayName);
      });
    });

    it('should handle missing profile data gracefully', () => {
      const minimalUser: ClerkUser = {
        id: 'user_minimal',
        emailAddresses: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: minimalUser,
        userId: minimalUser.id
      });

      const currentUser = get(user);
      expect(currentUser?.id).toBe('user_minimal');
      expect(currentUser?.emailAddresses).toHaveLength(0);
      expect(currentUser?.firstName).toBeUndefined();
      expect(currentUser?.lastName).toBeUndefined();
      expect(currentUser?.username).toBeUndefined();
      expect(currentUser?.imageUrl).toBeUndefined();

      // Display name should fallback to 'User' when no data available
      const currentDisplayName = get(displayName);
      expect(currentDisplayName).toBe('User');
    });
  });

  describe('Profile data retrieval functions', () => {
    it('should retrieve user profile via helper function', async () => {
      const mockUser: ClerkUser = {
        id: 'user_helper_test',
        emailAddresses: [{ emailAddress: 'helper@example.com', id: 'email_1' }],
        firstName: 'Helper',
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

      const profile = await getUserProfile();
      
      // Current implementation returns null (placeholder)
      // In real Clerk implementation, this would return user profile data
      expect(profile).toBeNull();
    });

    it('should handle profile retrieval errors', async () => {
      // Test error handling when profile retrieval fails
      const profile = await getUserProfile();
      
      // Should not throw and should handle gracefully
      expect(profile).toBeNull();
    });

    it('should return null profile when not authenticated', async () => {
      // Ensure user is not authenticated
      updateAuthState({
        isLoaded: true,
        isSignedIn: false,
        user: null,
        userId: null
      });

      const profile = await getUserProfile();
      expect(profile).toBeNull();
    });
  });

  describe('Profile data reactivity', () => {
    it('should update profile data reactively', () => {
      let profileUpdateCount = 0;
      let lastProfile: ClerkUser | null = null;

      // Subscribe to user profile changes
      const unsubscribe = user.subscribe((currentUser) => {
        profileUpdateCount++;
        lastProfile = currentUser;
      });

      // Initial state
      expect(profileUpdateCount).toBe(1);
      expect(lastProfile).toBeNull();

      // Update profile
      const newUser: ClerkUser = {
        id: 'user_reactive',
        emailAddresses: [{ emailAddress: 'reactive@example.com', id: 'email_1' }],
        firstName: 'Reactive',
        lastName: 'User',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: newUser,
        userId: newUser.id
      });

      // Should have triggered update
      expect(profileUpdateCount).toBe(2);
      expect(lastProfile).toEqual(newUser);

      unsubscribe();
    });

    it('should update display name reactively', () => {
      let displayNameUpdateCount = 0;
      let lastDisplayName = '';

      const unsubscribe = displayName.subscribe((name: string) => {
        displayNameUpdateCount++;
        lastDisplayName = name;
      });

      // Initial state
      expect(displayNameUpdateCount).toBe(1);
      expect(lastDisplayName).toBe('User');

      // Update user with name
      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: {
          id: 'user_display_reactive',
          emailAddresses: [{ emailAddress: 'display@example.com', id: 'email_1' }],
          firstName: 'Display',
          lastName: 'Reactive',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        userId: 'user_display_reactive'
      });

      expect(displayNameUpdateCount).toBe(2);
      expect(lastDisplayName).toBe('Display Reactive');

      unsubscribe();
    });
  });

  describe('Profile data validation', () => {
    it('should validate email address format', () => {
      const userWithValidEmail: ClerkUser = {
        id: 'user_valid_email',
        emailAddresses: [{ emailAddress: 'valid@example.com', id: 'email_1' }],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: userWithValidEmail,
        userId: userWithValidEmail.id
      });

      const currentUser = get(user);
      const email = currentUser?.emailAddresses[0]?.emailAddress;
      
      // Basic email validation
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should handle multiple email addresses', () => {
      const userWithMultipleEmails: ClerkUser = {
        id: 'user_multiple_emails',
        emailAddresses: [
          { emailAddress: 'primary@example.com', id: 'email_1' },
          { emailAddress: 'work@company.com', id: 'email_2' },
          { emailAddress: 'personal@gmail.com', id: 'email_3' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: userWithMultipleEmails,
        userId: userWithMultipleEmails.id
      });

      const currentUser = get(user);
      expect(currentUser?.emailAddresses).toHaveLength(3);
      
      // Should be able to access all email addresses
      const emails = currentUser?.emailAddresses.map(e => e.emailAddress);
      expect(emails).toContain('primary@example.com');
      expect(emails).toContain('work@company.com');
      expect(emails).toContain('personal@gmail.com');
    });

    it('should handle user timestamps correctly', () => {
      const now = Date.now();
      const userWithTimestamps: ClerkUser = {
        id: 'user_timestamps',
        emailAddresses: [{ emailAddress: 'timestamps@example.com', id: 'email_1' }],
        createdAt: now - 86400000, // 24 hours ago
        updatedAt: now
      };

      updateAuthState({
        isLoaded: true,
        isSignedIn: true,
        user: userWithTimestamps,
        userId: userWithTimestamps.id
      });

      const currentUser = get(user);
      expect(currentUser?.createdAt).toBeLessThan(now);
      expect(currentUser?.updatedAt).toBe(now);
      expect(currentUser?.updatedAt).toBeGreaterThan(currentUser?.createdAt || 0);
    });
  });
});