// Convex Database Schema
// This file defines the database schema for the Arduino Workflow Builder migration from Firebase

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User profiles table - combines user data from Clerk with additional profile info
  profiles: defineTable({
    userId: v.string(), // Clerk user ID
    email: v.string(),
    name: v.string(),
    profileImage: v.optional(v.string()),
    username: v.optional(v.string()), // Username is optional initially
    bio: v.optional(v.string()), // Bio is optional
    location: v.optional(v.string()), // Location is optional
    website: v.optional(v.string()), // Website is optional
    isPublic: v.boolean(),
    lastLogin: v.number(),
    created: v.number(),
    updated: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_username", ["username"]),

  // Arduino projects table
  projects: defineTable({
    userId: v.string(), // Clerk user ID
    name: v.string(),
    description: v.optional(v.string()), // Description is optional
    workspace: v.string(), // Blockly XML
    boardType: v.union(v.literal("uno"), v.literal("nano"), v.literal("mega")),
    isPublic: v.boolean(),
    canShare: v.boolean(), // Legacy field for compatibility
    tags: v.optional(v.array(v.string())), // Project tags for categorization
    likes: v.optional(v.number()), // Like count for public projects
    views: v.optional(v.number()), // View count for public projects
    firebaseId: v.optional(v.string()), // For migration tracking
    created: v.number(),
    updated: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_created", ["created"])
    .index("by_public", ["isPublic"]),

  // User settings table
  settings: defineTable({
    userId: v.string(), // Clerk user ID
    boardType: v.union(v.literal("uno"), v.literal("nano"), v.literal("mega")),
    theme: v.union(v.literal("light"), v.literal("dark")),
    language: v.string(),
    autoSave: v.boolean(),
    tutorialCompleted: v.record(v.string(), v.boolean()),
    updated: v.number(),
  }).index("by_userId", ["userId"]),

  // Project files table (for future file storage integration)
  projectFiles: defineTable({
    projectId: v.id("projects"),
    userId: v.string(), // For access control
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    checksum: v.string(),
    storageId: v.string(), // Convex file storage ID
    uploadedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  // Migration tracking table (temporary, for migration process)
  migrations: defineTable({
    userId: v.string(),
    migrationId: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    migratedCount: v.number(),
    errorCount: v.number(),
    errors: v.array(v.string()),
    checksum: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),
});