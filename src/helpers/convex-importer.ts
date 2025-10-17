// Convex Data Import Utility
// This utility imports data from Firebase export to Convex

import { getConvexClient } from '../stores/convex.store';
import { getSessionToken } from '../auth/clerk-auth';
import { browser } from '$app/environment';
import type { ExportResult, ExportedUser, ExportedProject } from './firebase-exporter';

/**
 * Import result structure
 */
export interface ImportResult {
  success: boolean;
  importedUsers: number;
  importedProjects: number;
  importedFiles: number;
  errors: string[];
  warnings: string[];
  duration: number;
}

/**
 * Import progress callback
 */
export type ImportProgressCallback = (progress: {
  stage: string;
  current: number;
  total: number;
  message: string;
}) => void;

/**
 * Import all data from Firebase export to Convex
 */
export async function importAllData(
  exportData: ExportResult,
  progressCallback?: ImportProgressCallback
): Promise<ImportResult> {
  if (!browser) {
    throw new Error('Convex import can only run in browser environment');
  }

  const startTime = Date.now();
  const result: ImportResult = {
    success: false,
    importedUsers: 0,
    importedProjects: 0,
    importedFiles: 0,
    errors: [],
    warnings: [],
    duration: 0
  };

  try {
    const convexClient = getConvexClient();
    const sessionToken = await getSessionToken();
    
    if (!sessionToken) {
      throw new Error('Authentication required for import');
    }

    // Stage 1: Import users
    progressCallback?.({
      stage: 'users',
      current: 0,
      total: exportData.users.length,
      message: 'Importing user profiles and settings...'
    });

    for (let i = 0; i < exportData.users.length; i++) {
      const user = exportData.users[i];
      try {
        await importUser(user);
        result.importedUsers++;
      } catch (error) {
        result.errors.push(`Failed to import user ${user.uid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      progressCallback?.({
        stage: 'users',
        current: i + 1,
        total: exportData.users.length,
        message: `Imported user ${user.uid}`
      });
    }

    // Stage 2: Import projects
    progressCallback?.({
      stage: 'projects',
      current: 0,
      total: exportData.projects.length,
      message: 'Importing projects and workspace files...'
    });

    for (let i = 0; i < exportData.projects.length; i++) {
      const project = exportData.projects[i];
      try {
        await importProject(project);
        result.importedProjects++;
        
        // Import project file if it exists
        if (project.workspaceXml) {
          await importProjectFile(project.id, project.userId, project.workspaceXml);
          result.importedFiles++;
        }
      } catch (error) {
        result.errors.push(`Failed to import project ${project.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      progressCallback?.({
        stage: 'projects',
        current: i + 1,
        total: exportData.projects.length,
        message: `Imported project ${project.name}`
      });
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    console.log('Import completed:', result);
    return result;

  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.duration = Date.now() - startTime;
    console.error('Import error:', error);
    return result;
  }
}

/**
 * Import a single user to Convex
 */
export async function importUser(user: ExportedUser): Promise<void> {
  try {
    const convexClient = getConvexClient();

    // Import user profile
    if (user.profile) {
      await convexClient.mutation('users:createUserProfile', {
        userId: user.uid,
        username: user.profile.username,
        bio: user.profile.bio,
        email: user.email,
        name: user.displayName,
        profileImage: user.photoURL,
        isPublic: true // Default to public
      });
    }

    // Import user settings
    if (user.settings) {
      await convexClient.mutation('users:updateUserSettings', {
        userId: user.uid,
        boardType: user.settings.boardType,
        theme: user.settings.theme,
        language: user.settings.language,
        autoSave: user.settings.autoSave
      });
    }

    console.log(`Imported user: ${user.uid}`);

  } catch (error) {
    console.error(`Error importing user ${user.uid}:`, error);
    throw error;
  }
}

/**
 * Import a single project to Convex
 */
export async function importProject(project: ExportedProject): Promise<void> {
  try {
    const convexClient = getConvexClient();

    // Create project in Convex
    await convexClient.mutation('projects:createProject', {
      userId: project.userId,
      name: project.name,
      description: project.description,
      boardType: project.boardType,
      isPublic: project.canShare,
      workspace: project.workspaceXml || '<xml></xml>', // Include workspace in project
      originalFirebaseId: project.id // Keep original ID for reference
    });

    console.log(`Imported project: ${project.id} (${project.name})`);

  } catch (error) {
    console.error(`Error importing project ${project.id}:`, error);
    throw error;
  }
}

/**
 * Import project file to Convex storage
 */
export async function importProjectFile(
  projectId: string,
  userId: string,
  workspaceXml: string
): Promise<void> {
  try {
    const convexClient = getConvexClient();

    // Calculate checksum for integrity
    const checksum = calculateChecksum(workspaceXml);

    // Save project file
    await convexClient.mutation('projects:saveProjectFile', {
      projectId,
      userId,
      filename: `${projectId}.xml`,
      content: workspaceXml,
      contentType: 'application/xml',
      size: workspaceXml.length,
      checksum
    });

    console.log(`Imported project file: ${projectId}.xml`);

  } catch (error) {
    console.error(`Error importing project file ${projectId}:`, error);
    throw error;
  }
}

/**
 * Import specific user's data
 */
export async function importUserData(
  uid: string,
  userData: { user: ExportedUser | null; projects: ExportedProject[] },
  progressCallback?: ImportProgressCallback
): Promise<ImportResult> {
  if (!browser) {
    throw new Error('Convex import can only run in browser environment');
  }

  const startTime = Date.now();
  const result: ImportResult = {
    success: false,
    importedUsers: 0,
    importedProjects: 0,
    importedFiles: 0,
    errors: [],
    warnings: [],
    duration: 0
  };

  try {
    // Import user profile and settings
    if (userData.user) {
      progressCallback?.({
        stage: 'user',
        current: 0,
        total: 1,
        message: `Importing user ${uid}...`
      });

      await importUser(userData.user);
      result.importedUsers = 1;

      progressCallback?.({
        stage: 'user',
        current: 1,
        total: 1,
        message: `User ${uid} imported successfully`
      });
    }

    // Import user's projects
    if (userData.projects.length > 0) {
      progressCallback?.({
        stage: 'projects',
        current: 0,
        total: userData.projects.length,
        message: 'Importing user projects...'
      });

      for (let i = 0; i < userData.projects.length; i++) {
        const project = userData.projects[i];
        try {
          await importProject(project);
          result.importedProjects++;

          if (project.workspaceXml) {
            await importProjectFile(project.id, project.userId, project.workspaceXml);
            result.importedFiles++;
          }
        } catch (error) {
          result.errors.push(`Failed to import project ${project.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        progressCallback?.({
          stage: 'projects',
          current: i + 1,
          total: userData.projects.length,
          message: `Imported project ${project.name}`
        });
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    console.log(`Import completed for user ${uid}:`, result);
    return result;

  } catch (error) {
    result.errors.push(`User import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.duration = Date.now() - startTime;
    console.error(`Import error for user ${uid}:`, error);
    return result;
  }
}

/**
 * Verify import integrity by comparing checksums
 */
export async function verifyImportIntegrity(
  exportData: ExportResult
): Promise<{
  isValid: boolean;
  missingUsers: string[];
  missingProjects: string[];
  corruptedFiles: string[];
}> {
  try {
    const convexClient = getConvexClient();
    const result = {
      isValid: true,
      missingUsers: [] as string[],
      missingProjects: [] as string[],
      corruptedFiles: [] as string[]
    };

    // Verify users
    for (const user of exportData.users) {
      try {
        const convexUser = await convexClient.query('users:getUserProfile', { userId: user.uid });
        if (!convexUser) {
          result.missingUsers.push(user.uid);
          result.isValid = false;
        }
      } catch (error) {
        result.missingUsers.push(user.uid);
        result.isValid = false;
      }
    }

    // Verify projects
    for (const project of exportData.projects) {
      try {
        const convexProject = await convexClient.query('projects:getProject', { projectId: project.id });
        if (!convexProject) {
          result.missingProjects.push(project.id);
          result.isValid = false;
        }

        // Verify file integrity if workspace XML exists
        if (project.workspaceXml) {
          const projectFile = await convexClient.query('projects:getProjectFile', {
            projectId: project.id,
            userId: project.userId
          });

          if (!projectFile) {
            result.corruptedFiles.push(project.id);
            result.isValid = false;
          } else {
            // Verify checksum
            const expectedChecksum = calculateChecksum(project.workspaceXml);
            if (projectFile.checksum !== expectedChecksum) {
              result.corruptedFiles.push(project.id);
              result.isValid = false;
            }
          }
        }
      } catch (error) {
        result.missingProjects.push(project.id);
        result.isValid = false;
      }
    }

    console.log('Import verification completed:', result);
    return result;

  } catch (error) {
    console.error('Import verification failed:', error);
    return {
      isValid: false,
      missingUsers: [],
      missingProjects: [],
      corruptedFiles: []
    };
  }
}

/**
 * Rollback imported data (delete from Convex)
 */
export async function rollbackImport(
  exportData: ExportResult,
  progressCallback?: ImportProgressCallback
): Promise<{ success: boolean; errors: string[] }> {
  const result = { success: true, errors: [] as string[] };

  try {
    const convexClient = getConvexClient();

    // Delete projects
    progressCallback?.({
      stage: 'rollback_projects',
      current: 0,
      total: exportData.projects.length,
      message: 'Removing imported projects...'
    });

    for (let i = 0; i < exportData.projects.length; i++) {
      const project = exportData.projects[i];
      try {
        await convexClient.mutation('projects:deleteProject', { projectId: project.id });
      } catch (error) {
        result.errors.push(`Failed to delete project ${project.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }

      progressCallback?.({
        stage: 'rollback_projects',
        current: i + 1,
        total: exportData.projects.length,
        message: `Removed project ${project.name}`
      });
    }

    // Delete user profiles and settings
    progressCallback?.({
      stage: 'rollback_users',
      current: 0,
      total: exportData.users.length,
      message: 'Removing imported user data...'
    });

    for (let i = 0; i < exportData.users.length; i++) {
      const user = exportData.users[i];
      try {
        await convexClient.mutation('users:deleteUserProfile', { userId: user.uid });
      } catch (error) {
        result.errors.push(`Failed to delete user ${user.uid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }

      progressCallback?.({
        stage: 'rollback_users',
        current: i + 1,
        total: exportData.users.length,
        message: `Removed user ${user.uid}`
      });
    }

    console.log('Rollback completed:', result);
    return result;

  } catch (error) {
    result.errors.push(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.success = false;
    console.error('Rollback error:', error);
    return result;
  }
}

/**
 * Calculate checksum for data integrity
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
 * Batch import with error recovery
 */
export async function batchImportWithRecovery(
  exportData: ExportResult,
  batchSize: number = 10,
  progressCallback?: ImportProgressCallback
): Promise<ImportResult> {
  const startTime = Date.now();
  const result: ImportResult = {
    success: false,
    importedUsers: 0,
    importedProjects: 0,
    importedFiles: 0,
    errors: [],
    warnings: [],
    duration: 0
  };

  try {
    // Import users in batches
    const userBatches = chunkArray(exportData.users, batchSize);
    for (let batchIndex = 0; batchIndex < userBatches.length; batchIndex++) {
      const batch = userBatches[batchIndex];
      
      progressCallback?.({
        stage: 'users_batch',
        current: batchIndex + 1,
        total: userBatches.length,
        message: `Processing user batch ${batchIndex + 1} of ${userBatches.length}`
      });

      for (const user of batch) {
        try {
          await importUser(user);
          result.importedUsers++;
        } catch (error) {
          result.warnings.push(`Failed to import user ${user.uid} in batch ${batchIndex + 1}`);
        }
      }
    }

    // Import projects in batches
    const projectBatches = chunkArray(exportData.projects, batchSize);
    for (let batchIndex = 0; batchIndex < projectBatches.length; batchIndex++) {
      const batch = projectBatches[batchIndex];
      
      progressCallback?.({
        stage: 'projects_batch',
        current: batchIndex + 1,
        total: projectBatches.length,
        message: `Processing project batch ${batchIndex + 1} of ${projectBatches.length}`
      });

      for (const project of batch) {
        try {
          await importProject(project);
          result.importedProjects++;

          if (project.workspaceXml) {
            await importProjectFile(project.id, project.userId, project.workspaceXml);
            result.importedFiles++;
          }
        } catch (error) {
          result.warnings.push(`Failed to import project ${project.id} in batch ${batchIndex + 1}`);
        }
      }
    }

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    console.log('Batch import completed:', result);
    return result;

  } catch (error) {
    result.errors.push(`Batch import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.duration = Date.now() - startTime;
    console.error('Batch import error:', error);
    return result;
  }
}

/**
 * Utility function to chunk array into batches
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}