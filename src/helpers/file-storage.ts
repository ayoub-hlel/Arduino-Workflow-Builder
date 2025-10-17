// Convex File Storage Operations
// This service replaces Firebase Storage with Convex file storage

import { getConvexClient } from '../stores/convex.store';
import { getSessionToken } from '../auth/clerk-auth';

/**
 * File upload result interface
 */
export interface FileUploadResult {
  storageId: string;
  filename: string;
  size: number;
  contentType: string;
  checksum: string;
}

/**
 * File download result interface
 */
export interface FileDownloadResult {
  content: string;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Upload project XML file to Convex storage
 */
export async function uploadProjectFile(
  projectId: string,
  xmlContent: string,
  userId: string
): Promise<FileUploadResult> {
  try {
    const convexClient = getConvexClient();
    
    // Create blob from XML content
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const filename = `${projectId}.xml`;
    
    // Upload to Convex file storage
    // TODO: Replace with actual Convex file upload once installed
    console.log(`Uploading file ${filename} for project ${projectId}`);
    
    // Mock implementation for development
    const mockResult: FileUploadResult = {
      storageId: `file_${Date.now()}`,
      filename,
      size: blob.size,
      contentType: 'application/xml',
      checksum: calculateSimpleChecksum(xmlContent)
    };
    
    // Save file metadata to Convex
    await convexClient.mutation('projects:saveProjectFile', {
      projectId,
      userId,
      storageId: mockResult.storageId,
      filename: mockResult.filename,
      contentType: mockResult.contentType,
      size: mockResult.size,
      checksum: mockResult.checksum,
      content: xmlContent // Store content directly for now
    });
    
    return mockResult;
    
  } catch (error) {
    console.error('Error uploading project file:', error);
    throw new Error(`Failed to upload project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Download project XML file from Convex storage
 */
export async function downloadProjectFile(
  projectId: string,
  userId: string
): Promise<FileDownloadResult> {
  try {
    const convexClient = getConvexClient();
    
    // Get file metadata and content from Convex
    const fileData = await convexClient.query('projects:getProjectFile', {
      projectId,
      userId
    });
    
    if (!fileData) {
      throw new Error('Project file not found');
    }
    
    // TODO: Replace with actual Convex file download once installed
    console.log(`Downloading file for project ${projectId}`);
    
    return {
      content: fileData.content || '<xml></xml>', // Fallback to empty workspace
      filename: fileData.filename || `${projectId}.xml`,
      contentType: fileData.contentType || 'application/xml',
      size: fileData.size || 0
    };
    
  } catch (error) {
    console.error('Error downloading project file:', error);
    throw new Error(`Failed to download project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete project file from Convex storage
 */
export async function deleteProjectFile(
  projectId: string,
  userId: string
): Promise<void> {
  try {
    const convexClient = getConvexClient();
    
    // Delete file from Convex storage
    await convexClient.mutation('projects:deleteProjectFile', {
      projectId,
      userId
    });
    
    console.log(`Deleted file for project ${projectId}`);
    
  } catch (error) {
    console.error('Error deleting project file:', error);
    throw new Error(`Failed to delete project file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List all files for a user
 */
export async function listUserFiles(userId: string): Promise<FileUploadResult[]> {
  try {
    const convexClient = getConvexClient();
    
    const files = await convexClient.query('projects:getUserFiles', { userId });
    
    return files || [];
    
  } catch (error) {
    console.error('Error listing user files:', error);
    throw new Error(`Failed to list user files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if project file exists
 */
export async function projectFileExists(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    const fileData = await downloadProjectFile(projectId, userId);
    return !!fileData;
  } catch (error) {
    return false;
  }
}

/**
 * Get file size for a project
 */
export async function getProjectFileSize(
  projectId: string,
  userId: string
): Promise<number> {
  try {
    const fileData = await downloadProjectFile(projectId, userId);
    return fileData.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Validate XML content
 */
export function validateXmlContent(xmlContent: string): boolean {
  try {
    // Basic XML validation - check for proper opening/closing tags
    if (!xmlContent.trim()) return false;
    if (!xmlContent.includes('<xml>') || !xmlContent.includes('</xml>')) return false;
    
    // Additional validation could be added here
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Calculate simple checksum for data integrity
 */
function calculateSimpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Legacy compatibility functions that match Firebase Storage interface
 */

/**
 * Save project file (compatible with Firebase saveFile function)
 */
export async function saveFile(projectId: string, uid: string, xmlContent?: string): Promise<void> {
  // If no XML content provided, get it from workspace (legacy behavior)
  let content = xmlContent;
  if (!content) {
    // Try to get from workspace helper
    try {
      const { workspaceToXML } = await import('../core/blockly/helpers/workspace.helper');
      content = workspaceToXML();
    } catch (error) {
      console.warn('Could not get workspace XML, using empty workspace');
      content = '<xml></xml>';
    }
  }
  
  await uploadProjectFile(projectId, content!, uid);
}

/**
 * Get project file content (compatible with Firebase getFile function)
 */
export async function getFile(projectId: string, uid: string): Promise<string> {
  const fileData = await downloadProjectFile(projectId, uid);
  return fileData.content;
}