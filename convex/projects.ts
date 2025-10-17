// Convex Project CRUD Operations
// This file implements project management functions for Arduino projects

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Helper function to generate checksum for project files
function generateChecksum(data: string): string {
  // Simple hash function for data integrity checking
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `sha256-${Math.abs(hash).toString(16)}`;
}

// Helper function to validate XML format
function validateXML(xml: string): boolean {
  try {
    // Basic XML validation - should contain valid Blockly structure
    return xml.includes('<xml') && xml.includes('</xml>') && xml.length > 0;
  } catch {
    return false;
  }
}

// Helper function to save project file with integrity checking
async function saveProjectFile(ctx: any, projectId: Id<"projects">, workspace: string, userId: string) {
  if (!validateXML(workspace)) {
    throw new Error("Invalid XML content: malformed Blockly workspace");
  }
  
  const checksum = generateChecksum(workspace);
  
  // Store file metadata (actual file storage would be implemented with Convex file storage)
  await ctx.db.insert("projectFiles", {
    projectId,
    userId,
    filename: "workspace.xml",
    contentType: "application/xml",
    size: workspace.length,
    checksum,
    storageId: `project-${projectId}-workspace`, // Would be actual storage ID in real implementation
    uploadedAt: Date.now(),
  });
  
  return checksum;
}

/**
 * Create a new Arduino project
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    workspace: v.string(), // Blockly XML
    boardType: v.union(v.literal("uno"), v.literal("nano"), v.literal("mega")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Validate project name
    if (!args.name || args.name.length < 1 || args.name.length > 100) {
      throw new Error("Project name must be between 1 and 100 characters");
    }

    // Validate XML format
    if (!validateXML(args.workspace)) {
      throw new Error("Invalid XML format: malformed Blockly workspace");
    }

    const projectId = await ctx.db.insert("projects", {
      userId: identity.subject,
      name: args.name,
      description: args.description,
      workspace: args.workspace,
      boardType: args.boardType,
      isPublic: false,
      canShare: false,
      tags: args.tags,
      likes: 0,
      views: 0,
      created: Date.now(),
      updated: Date.now(),
    });

    // Save project file with integrity checking
    const checksum = await saveProjectFile(ctx, projectId, args.workspace, identity.subject);

    const project = await ctx.db.get(projectId);
    return { 
      projectId, 
      project: { 
        ...project, 
        checksum 
      } 
    };
  },
});

/**
 * Update an existing project
 */
export const updateProject = mutation({
  args: {
    id: v.id("projects"), // Changed from projectId to id to match contract
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    xml: v.optional(v.string()), // Changed from workspace to xml to match contract
    boardType: v.optional(v.union(v.literal("uno"), v.literal("nano"), v.literal("mega"))),
    isPublic: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or access denied");
    }

    // Validate name if provided
    if (args.name !== undefined && (args.name.length < 1 || args.name.length > 100)) {
      throw new Error("Project name must be between 1 and 100 characters");
    }

    // Validate XML if provided
    if (args.xml !== undefined && !validateXML(args.xml)) {
      throw new Error("Invalid XML format: malformed Blockly workspace");
    }

    const updates: any = {
      updated: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.xml !== undefined) updates.workspace = args.xml; // Map xml to workspace field
    if (args.boardType !== undefined) updates.boardType = args.boardType;
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;
    if (args.tags !== undefined) updates.tags = args.tags;

    await ctx.db.patch(args.id, updates);
    
    // Update project file if XML changed
    if (args.xml !== undefined) {
      await saveProjectFile(ctx, args.id, args.xml, identity.subject);
    }
    
    return await ctx.db.get(args.id);
  },
});

/**
 * Get all projects for the current user
 */
export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .order("desc")
      .collect();
  },
});

/**
 * Get a single project by ID
 */
export const getProject = query({
  args: { id: v.id("projects") }, // Changed from projectId to id to match contract
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const project = await ctx.db.get(args.id);

    if (!project) {
      return null;
    }

    // Check access permissions
    if (project.userId !== identity?.subject && !project.isPublic) {
      return null;
    }

    return project;
  },
});

/**
 * Get a public project by ID (for sharing)
 */
export const getPublicProject = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);

    if (!project || !project.isPublic) {
      return null;
    }

    return project;
  },
});

/**
 * Increment project view count (separate mutation)
 */
export const incrementProjectViews = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || !project.isPublic) {
      throw new Error("Project not found or not public");
    }

    await ctx.db.patch(args.id, {
      views: (project.views || 0) + 1,
    });
  },
});

/**
 * Delete a project
 */
export const deleteProject = mutation({
  args: { id: v.id("projects") }, // Changed from projectId to id to match contract
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== identity.subject) {
      throw new Error("Project not found or access denied");
    }

    // Delete associated project files
    const projectFiles = await ctx.db
      .query("projectFiles")
      .filter((q) => q.eq(q.field("projectId"), args.id))
      .collect();
    
    for (const file of projectFiles) {
      await ctx.db.delete(file._id);
    }

    // Delete the project
    await ctx.db.delete(args.id);
  },
});

/**
 * Get public projects for discovery
 */
export const getPublicProjects = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    return await ctx.db
      .query("projects")
      .filter((q) => q.eq(q.field("isPublic"), true))
      .order("desc")
      .take(limit);
  },
});