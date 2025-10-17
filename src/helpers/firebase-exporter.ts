// Firebase Data Export Utility
// This utility exports data from Firebase for migration to Convex

// Firebase imports - these would be actual Firebase imports in a real migration
// For development purposes, we'll create mock implementations
// import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
// import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { browser } from '$app/environment';

// Mock Firebase functions for development
const mockFirebase = {
  getFirestore: () => ({}),
  collection: (db: any, collectionName: string) => ({ collectionName }),
  getDocs: async (collectionRef: any) => ({
    docs: [] // Mock empty collection
  }),
  doc: (db: any, collectionName: string, docId: string) => ({ collectionName, docId }),
  getDoc: async (docRef: any) => ({
    exists: () => false,
    data: () => null
  }),
  getStorage: () => ({}),
  ref: (storage: any, path: string) => ({ path }),
  getDownloadURL: async (ref: any) => `https://mock-url.com/${ref.path}`
};

// Use mock functions for development
const getFirestore = mockFirebase.getFirestore;
const collection = mockFirebase.collection;
const getDocs = mockFirebase.getDocs;
const doc = mockFirebase.doc;
const getDoc = mockFirebase.getDoc;
const getStorage = mockFirebase.getStorage;
const ref = mockFirebase.ref;
const getDownloadURL = mockFirebase.getDownloadURL;

/**
 * Exported user data structure
 */
export interface ExportedUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  created: any;
  profile?: {
    username: string;
    bio: string;
  };
  settings?: {
    boardType: string;
    theme?: string;
    language?: string;
    autoSave?: boolean;
  };
}

/**
 * Exported project data structure
 */
export interface ExportedProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  boardType: string;
  canShare: boolean;
  created: any;
  updated: any;
  workspaceXml?: string;
  fileUrl?: string;
}

/**
 * Export result structure
 */
export interface ExportResult {
  users: ExportedUser[];
  projects: ExportedProject[];
  metadata: {
    exportDate: string;
    totalUsers: number;
    totalProjects: number;
    version: string;
  };
}

/**
 * Export all user data from Firebase
 * NOTE: This is a mock implementation for development
 * In a real migration, this would connect to actual Firebase
 */
export async function exportUsers(): Promise<ExportedUser[]> {
  if (!browser) {
    throw new Error('Firebase export can only run in browser environment');
  }

  console.log('MOCK: Exporting users from Firebase...');
  
  // Mock implementation - in real migration, this would query Firebase
  const mockUsers: ExportedUser[] = [
    {
      uid: 'user1',
      email: 'user1@example.com',
      displayName: 'Test User 1',
      created: new Date().toISOString(),
      profile: {
        username: 'testuser1',
        bio: 'Test user biography'
      },
      settings: {
        boardType: 'uno',
        theme: 'light',
        autoSave: true
      }
    }
  ];
  
  console.log(`MOCK: Exported ${mockUsers.length} users from Firebase`);
  return mockUsers;
}

/**
 * Export all project data from Firebase
 * NOTE: This is a mock implementation for development
 * In a real migration, this would connect to actual Firebase
 */
export async function exportProjects(): Promise<ExportedProject[]> {
  if (!browser) {
    throw new Error('Firebase export can only run in browser environment');
  }

  console.log('MOCK: Exporting projects from Firebase...');
  
  // Mock implementation - in real migration, this would query Firebase
  const mockProjects: ExportedProject[] = [
    {
      id: 'project1',
      userId: 'user1',
      name: 'Test Project 1',
      description: 'A test Arduino project',
      boardType: 'uno',
      canShare: true,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      workspaceXml: '<xml><block type="arduino_setup"></block></xml>'
    }
  ];
  
  console.log(`MOCK: Exported ${mockProjects.length} projects from Firebase`);
  return mockProjects;
}

/**
 * Export specific user's data
 * NOTE: This is a mock implementation for development
 */
export async function exportUserData(uid: string): Promise<{
  user: ExportedUser | null;
  projects: ExportedProject[];
}> {
  if (!browser) {
    throw new Error('Firebase export can only run in browser environment');
  }
  
  console.log(`MOCK: Exporting data for user ${uid}...`);
  
  // Mock implementation
  const allUsers = await exportUsers();
  const allProjects = await exportProjects();
  
  const user = allUsers.find(u => u.uid === uid) || null;
  const userProjects = allProjects.filter(project => project.userId === uid);
  
  console.log(`MOCK: Exported data for user ${uid}: ${userProjects.length} projects`);
  
  return { user, projects: userProjects };
}

/**
 * Export all Firebase data
 */
export async function exportAllData(): Promise<ExportResult> {
  if (!browser) {
    throw new Error('Firebase export can only run in browser environment');
  }
  
  console.log('Starting complete Firebase data export...');
  
  try {
    // Export users and projects in parallel
    const [users, projects] = await Promise.all([
      exportUsers(),
      exportProjects()
    ]);
    
    const result: ExportResult = {
      users,
      projects,
      metadata: {
        exportDate: new Date().toISOString(),
        totalUsers: users.length,
        totalProjects: projects.length,
        version: '1.0.0'
      }
    };
    
    console.log('Firebase export completed:', result.metadata);
    return result;
    
  } catch (error) {
    console.error('Error during complete export:', error);
    throw new Error(`Failed to export all data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save export data to JSON file
 */
export function saveExportToFile(exportData: ExportResult, filename?: string): void {
  if (!browser) {
    throw new Error('File save can only run in browser environment');
  }
  
  const jsonData = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `firebase-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  console.log(`Export saved to file: ${link.download}`);
}

/**
 * Load export data from JSON file
 */
export function loadExportFromFile(): Promise<ExportResult> {
  if (!browser) {
    throw new Error('File load can only run in browser environment');
  }
  
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);
          resolve(jsonData as ExportResult);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    
    input.click();
  });
}

/**
 * Validate export data integrity
 */
export function validateExportData(exportData: ExportResult): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check metadata
  if (!exportData.metadata) {
    errors.push('Missing export metadata');
  } else {
    if (!exportData.metadata.exportDate) warnings.push('Missing export date');
    if (exportData.metadata.totalUsers !== exportData.users.length) {
      warnings.push('User count mismatch in metadata');
    }
    if (exportData.metadata.totalProjects !== exportData.projects.length) {
      warnings.push('Project count mismatch in metadata');
    }
  }
  
  // Check users
  if (!Array.isArray(exportData.users)) {
    errors.push('Users data is not an array');
  } else {
    exportData.users.forEach((user, index) => {
      if (!user.uid) errors.push(`User ${index} missing uid`);
      if (!user.email) warnings.push(`User ${user.uid || index} missing email`);
    });
  }
  
  // Check projects
  if (!Array.isArray(exportData.projects)) {
    errors.push('Projects data is not an array');
  } else {
    exportData.projects.forEach((project, index) => {
      if (!project.id) errors.push(`Project ${index} missing id`);
      if (!project.userId) errors.push(`Project ${project.id || index} missing userId`);
      if (!project.name) warnings.push(`Project ${project.id || index} missing name`);
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}