// Legacy Firebase DB Interface - Redirects to Convex
// This file provides backward compatibility for Firebase DB operations

import { type Settings, type Project, defaultSetting } from "./model";
import { workspaceToXML } from "../core/blockly/helpers/workspace.helper";
import { getConvexClient } from "../stores/convex.store";

/**
 * Legacy Firebase Settings Operations - Now using Convex
 */
export async function fbSaveSettings(uid: string, settings: Settings) {
  console.warn('fbSaveSettings: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    await convexClient.mutation('users:updateUserSettings', { userId: uid, settings });
  } catch (error) {
    console.error('Error saving settings to Convex:', error);
    throw error;
  }
}

export async function getSettings(uid: string): Promise<Settings> {
  console.warn('getSettings: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    const settings = await convexClient.query('users:getUserSettings', { userId: uid });
    return settings || defaultSetting;
  } catch (error) {
    console.error('Error getting settings from Convex:', error);
    return defaultSetting;
  }
}

/**
 * Legacy Firebase Project Operations - Now using Convex
 */
export async function addProject(project: Project) {
  console.warn('addProject: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    project.created = project.created ? project.created : new Date();
    project.updated = new Date();
    project.canShare = false;
    
    const projectId = await convexClient.mutation('projects:createProject', {
      name: project.name,
      description: project.description
    });
    
    // Save the file content
    await saveFile(projectId, project.userId);
    
    return { projectId, project: { ...project, id: projectId } };
  } catch (error) {
    console.error('Error adding project to Convex:', error);
    throw error;
  }
}

export async function saveProject(project: Project, projectId: string) {
  console.warn('saveProject: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    project.created = project.created ? project.created : new Date();
    project.updated = new Date();
    
    await convexClient.mutation('projects:updateProject', {
      projectId,
      name: project.name,
      description: project.description
    });
    
    await saveFile(projectId, project.userId);
  } catch (error) {
    console.error('Error saving project to Convex:', error);
    throw error;
  }
}

export async function getProject(projectId: string): Promise<Project> {
  console.warn('getProject: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    const project = await convexClient.query('projects:getProject', { projectId });
    return project;
  } catch (error) {
    console.error('Error getting project from Convex:', error);
    throw error;
  }
}

export async function getProjects(uid: string): Promise<[Project, string][]> {
  console.warn('getProjects: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    const projects = await convexClient.query('projects:getUserProjects', { userId: uid });
    return (projects || []).map((project: any) => [project, project._id || project.id || ''] as [Project, string]);
  } catch (error) {
    console.error('Error getting projects from Convex:', error);
    return [];
  }
}

/**
 * Legacy Firebase File Operations - Now using Convex File Storage
 */
async function saveFile(projectId: string, uid: string) {
  console.warn('saveFile: Firebase compatibility layer - redirecting to Convex');
  try {
    const workspace = workspaceToXML();
    if (!workspace) {
      throw new Error('No workspace content to save');
    }
    
    const convexClient = getConvexClient();
    
    // Store file content directly in Convex
    await convexClient.mutation('projects:saveProjectFile', {
      projectId,
      userId: uid,
      content: workspace,
      filename: `${projectId}.xml`
    });
  } catch (error) {
    console.error('Error saving file to Convex:', error);
    throw error;
  }
}

export async function saveUserProfile(bio: string, username: string, uid: string) {
  console.warn('saveUserProfile: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    await convexClient.mutation('users:updateUserProfile', { 
      userId: uid, 
      profile: { bio, username } 
    });
  } catch (error) {
    console.error('Error saving user profile to Convex:', error);
    throw error;
  }
}

export async function getUserProfile(uid: string) {
  console.warn('getUserProfile: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    const profile = await convexClient.query('users:getUserProfile', { userId: uid });
    return profile || { username: "", bio: "" };
  } catch (error) {
    console.error('Error getting user profile from Convex:', error);
    return { username: "", bio: "" };
  }
}

export async function getFile(projectId: string, uid: string) {
  console.warn('getFile: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    const fileData = await convexClient.query('projects:getProjectFile', { 
      projectId, 
      userId: uid 
    });
    
    return fileData?.content || '';
  } catch (error) {
    console.error('Error getting file from Convex:', error);
    return '';
  }
}

export async function deleteProject(projectId: string, uid: string) {
  console.warn('deleteProject: Firebase compatibility layer - redirecting to Convex');
  try {
    const convexClient = getConvexClient();
    await convexClient.mutation('projects:deleteProject', { projectId });
  } catch (error) {
    console.error('Error deleting project from Convex:', error);
    throw error;
  }
}

/**
 * Legacy Firebase initialization - No longer needed
 */
const firestore = () => {
  console.warn('firestore: Firebase compatibility layer - returning mock object');
  return {
    // Return a mock object for backward compatibility
    collection: () => ({}),
    doc: () => ({}),
    getDoc: () => Promise.resolve({ exists: () => false, data: () => null }),
    getDocs: () => Promise.resolve({ docs: [] }),
    addDoc: () => Promise.resolve({ id: 'mock-id' }),
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve()
  };
};
