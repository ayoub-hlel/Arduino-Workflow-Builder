// Convex Authentication Functions
// This file implements authentication-related functions for the Clerk + Convex integration

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get current authenticated user information
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return {
      id: identity.subject,
      email: identity.email,
      name: identity.name,
      profileImage: identity.pictureUrl,
      lastLogin: Date.now(),
    };
  },
});

/**
 * Create or update user profile on first login (sync with Clerk data)
 */
export const syncUserProfile = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    name: v.string(),
    username: v.optional(v.string()),
    profileImage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Check if user profile already exists
    const existingProfile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        email: args.email,
        name: args.name,
        profileImage: args.profileImage,
        lastLogin: Date.now(),
        updated: Date.now(),
      });
      return existingProfile._id;
    } else {
      // Create new profile
      return await ctx.db.insert("profiles", {
        userId: args.userId,
        email: args.email,
        name: args.name,
        profileImage: args.profileImage,
        username: args.username || null,
        bio: null,
        location: null,
        website: null,
        isPublic: false,
        lastLogin: Date.now(),
        created: Date.now(),
        updated: Date.now(),
      });
    }
  },
});

/**
 * Validate session and get user authentication status
 */
export const validateSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    return {
      isAuthenticated: !!identity,
      user: identity ? {
        id: identity.subject,
        email: identity.email,
        name: identity.name,
        profileImage: identity.pictureUrl,
      } : null,
    };
  },
});