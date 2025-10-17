// Convex User Data Operations
// This file implements user settings, profiles, and migration functions

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get user settings with defaults
 */
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const settings = await ctx.db
      .query("settings")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (!settings) {
      // Return default settings
      return {
        userId: identity.subject,
        boardType: "uno" as const,
        theme: "light" as const,
        language: "en",
        autoSave: true,
        tutorialCompleted: {},
        updated: Date.now(),
      };
    }

    return settings;
  },
});

/**
 * Update user settings
 */
export const updateUserSettings = mutation({
  args: {
    boardType: v.optional(v.union(v.literal("uno"), v.literal("nano"), v.literal("mega"))),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"))),
    language: v.optional(v.string()),
    autoSave: v.optional(v.boolean()),
    tutorialCompleted: v.optional(v.record(v.string(), v.boolean())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Validate board type enum
    if (args.boardType && !["uno", "nano", "mega"].includes(args.boardType)) {
      throw new Error("Invalid board type");
    }

    // Validate theme enum
    if (args.theme && !["light", "dark"].includes(args.theme)) {
      throw new Error("Invalid theme");
    }

    const existing = await ctx.db
      .query("settings")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    const updates = {
      userId: identity.subject,
      updated: Date.now(),
      ...args,
    };

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("settings", {
        ...updates,
        boardType: args.boardType || "uno",
        theme: args.theme || "light",
        language: args.language || "en",
        autoSave: args.autoSave !== undefined ? args.autoSave : true,
        tutorialCompleted: args.tutorialCompleted || {},
      });
    }
  },
});

/**
 * Get user profile
 */
export const getUserProfile = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const targetUserId = args.userId || identity?.subject;

    if (!targetUserId) {
      return null;
    }

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), targetUserId))
      .first();

    // Public profiles are visible to all, private only to owner
    if (profile && (!profile.isPublic && profile.userId !== identity?.subject)) {
      return null;
    }

    return profile || null;
  },
});

/**
 * Update user profile
 */
export const updateUserProfile = mutation({
  args: {
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    website: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Validate username format and uniqueness if provided
    if (args.username) {
      if (!validateUsername(args.username)) {
        throw new Error("Invalid username format");
      }

      const existing = await ctx.db
        .query("profiles")
        .filter((q) =>
          q.and(
            q.eq(q.field("username"), args.username),
            q.neq(q.field("userId"), identity.subject)
          )
        )
        .first();

      if (existing) {
        throw new Error("Username already taken");
      }
    }

    // Validate bio length if provided
    if (args.bio && !validateBio(args.bio)) {
      throw new Error("Bio too long");
    }

    // Validate website URL format if provided
    if (args.website && args.website.length > 0 && !validateWebsite(args.website)) {
      throw new Error("Invalid URL format");
    }

    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    const updates = {
      userId: identity.subject,
      updated: Date.now(),
      ...args,
    };

    if (profile) {
      await ctx.db.patch(profile._id, updates);
    } else {
      await ctx.db.insert("profiles", {
        ...updates,
        username: args.username,
        bio: args.bio,
        location: args.location,
        website: args.website,
        isPublic: args.isPublic !== undefined ? args.isPublic : false,
        email: identity.email || "",
        name: identity.name || "",
        profileImage: identity.pictureUrl,
        lastLogin: Date.now(),
        created: Date.now(),
        updated: Date.now(),
      });
    }
  },
});

/**
 * Calculate checksum for data integrity validation
 * Using simple hash function compatible with Convex runtime
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Update tutorial progress
 */
export const updateTutorialProgress = mutation({
  args: {
    step: v.string(),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("settings")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();

    if (existing) {
      const tutorialCompleted = existing.tutorialCompleted || {};
      tutorialCompleted[args.step] = args.completed;

      await ctx.db.patch(existing._id, {
        tutorialCompleted,
        updated: Date.now(),
      });
    } else {
      // Create new settings with tutorial progress
      await ctx.db.insert("settings", {
        userId: identity.subject,
        boardType: "uno",
        theme: "light",
        language: "en",
        autoSave: true,
        tutorialCompleted: { [args.step]: args.completed },
        updated: Date.now(),
      });
    }

    return { userId: identity.subject, tutorialCompleted: { [args.step]: args.completed } };
  },
});

/**
 * Validate username format
 */
function validateUsername(username: string): boolean {
  // Username: 3-20 characters, alphanumeric + underscore
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Validate bio length
 */
function validateBio(bio: string): boolean {
  return bio.length <= 500;
}

/**
 * Validate website URL format
 */
function validateWebsite(website: string): boolean {
  try {
    new URL(website);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migrate Firebase user data to Convex
 */
export const migrateUserData = mutation({
  args: {
    firebaseData: v.object({
      settings: v.optional(v.record(v.string(), v.any())),
      profile: v.optional(v.record(v.string(), v.any())),
      projects: v.optional(v.array(v.record(v.string(), v.any()))),
    }),
    checksum: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Validate checksum
    const dataChecksum = calculateChecksum(JSON.stringify(args.firebaseData));
    if (dataChecksum !== args.checksum) {
      throw new Error("Data integrity check failed");
    }

    const results = { migrated: 0, errors: [] as string[] };

    // Migrate settings
    if (args.firebaseData.settings) {
      try {
        await ctx.db.insert("settings", {
          userId: identity.subject,
          boardType: args.firebaseData.settings.boardType || "uno",
          theme: args.firebaseData.settings.theme || "light",
          language: args.firebaseData.settings.language || "en",
          autoSave: args.firebaseData.settings.autoSave !== undefined ? args.firebaseData.settings.autoSave : true,
          tutorialCompleted: args.firebaseData.settings.tutorialCompleted || {},
          updated: Date.now(),
        });
        results.migrated++;
      } catch (error: any) {
        results.errors.push(`Settings migration failed: ${error.message}`);
      }
    }

    // Migrate profile
    if (args.firebaseData.profile) {
      try {
        await ctx.db.insert("profiles", {
          userId: identity.subject,
          email: identity.email || "",
          name: identity.name || "",
          profileImage: identity.pictureUrl,
          username: args.firebaseData.profile.username || "",
          bio: args.firebaseData.profile.bio || "",
          location: args.firebaseData.profile.location || "",
          website: args.firebaseData.profile.website || "",
          isPublic: args.firebaseData.profile.isPublic || false,
          lastLogin: Date.now(),
          created: Date.now(),
          updated: Date.now(),
        });
        results.migrated++;
      } catch (error: any) {
        results.errors.push(`Profile migration failed: ${error.message}`);
      }
    }

    // Migrate projects
    if (args.firebaseData.projects) {
      for (const project of args.firebaseData.projects) {
        try {
          await ctx.db.insert("projects", {
            userId: identity.subject,
            name: project.name || "Untitled Project",
            description: project.description || "",
            workspace: project.workspace || "",
            boardType: project.boardType || "uno",
            isPublic: project.isPublic || false,
            canShare: project.canShare || false,
            created: project.created || Date.now(),
            updated: Date.now(),
          });
          results.migrated++;
        } catch (error: any) {
          results.errors.push(`Project migration failed: ${error.message}`);
        }
      }
    }

    return results;
  },
});