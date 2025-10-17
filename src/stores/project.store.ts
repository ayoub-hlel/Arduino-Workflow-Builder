import { writable, derived, get, type Readable } from "svelte/store";
import type { Project } from "../types/models";
import authStore from "./auth.store";
import { getConvexClient, createQuery, createMutation } from "./convex.store";
import { userId } from "./clerk-auth.store";
import { 
  subscribeToProject, 
  subscribeToUserProjects, 
  subscribeToPublicProjects 
} from "../helpers/realtime-manager";
import { 
  getProjectWithFallback, 
  getUserProjectsWithFallback, 
  getProjectFileWithFallback,
  configureDualRead,
  DataSource,
  type DataReadResult
} from "../helpers/dual-read-manager";
import { 
  projectOfflineManager, 
  withOfflineSupport,
  isOnline,
  offlineStatus,
  OfflineStatus
} from "../helpers/offline-manager";
import { 
  validateProject,
  checkDataCorruption,
  createDataBackup,
  dataIntegrityManager,
  type ValidationResult,
  type CorruptionCheckResult
} from "../helpers/data-integrity-manager";

/**
 * Current project state interface
 */
interface ProjectState {
  project: Project | null;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;
  validationResult?: ValidationResult;
  corruptionCheck?: CorruptionCheckResult;
  lastBackupId?: string;
}

/**
 * Initial project state
 */
const initialState: ProjectState = {
  project: null,
  projectId: null,
  isLoading: false,
  error: null
};

/**
 * Core project store
 */
const projectStore = writable<ProjectState>(initialState);

/**
 * Clear project data when user logs out
 */
authStore.subscribe((auth) => {
  if (!auth.isLoggedIn) {
    projectStore.set(initialState);
  }
});

/**
 * Create project using Convex mutation
 */
export const createProject = createMutation<{
  name: string;
  workspace: string;
  tags?: string[];
  isPublic?: boolean;
}, Project>('projects:createProject');

/**
 * Update project using Convex mutation
 */
export const updateProject = createMutation<{
  projectId: string;
  name?: string;
  workspace?: string;
  tags?: string[];
  isPublic?: boolean;
}, void>('projects:updateProject');

/**
 * Delete project using Convex mutation
 */
export const deleteProject = createMutation<{
  projectId: string;
}, void>('projects:deleteProject');

/**
 * Load project by ID with offline support
 */
export async function loadProject(projectId: string): Promise<void> {
  if (!projectId) return;

  projectStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    // Set current project for offline manager
    projectOfflineManager.setCurrentProject(projectId);
    
    // Use offline-aware data loading
    const project = await withOfflineSupport(
      `project:${projectId}`,
      async () => {
        const convexClient = getConvexClient();
        return await convexClient.query('projects:getProject', { projectId });
      },
      {
        ttl: 10 * 60 * 1000, // 10 minutes cache
        useCache: true
      }
    );
    
    if (project) {
      projectStore.set({
        project,
        projectId,
        isLoading: false,
        error: null
      });
    } else {
      projectStore.set({
        project: null,
        projectId: null,
        isLoading: false,
        error: 'Project not found'
      });
    }
  } catch (error) {
    console.error('Error loading project:', error);
    
    // Try to load from offline cache as fallback
    const offlineProject = projectOfflineManager.getCurrentProjectOffline();
    if (offlineProject) {
      console.log('Loading project from offline cache');
      projectStore.set({
        project: offlineProject,
        projectId,
        isLoading: false,
        error: 'Loaded from offline cache'
      });
    } else {
      projectStore.set({
        project: null,
        projectId: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load project'
      });
    }
  }
}

/**
 * Save current project with validation and corruption prevention
 */
export async function saveCurrentProject(workspace: string): Promise<void> {
  const currentState = getCurrentProjectState();
  
  if (!currentState.project || !currentState.projectId) {
    throw new Error('No project to save');
  }

  const updatedProject = { ...currentState.project, workspace };

  try {
    // Validate project data before saving
    const validationResult = await validateProject(updatedProject);
    
    if (!validationResult.isValid) {
      const error = new Error(`Project validation failed: ${validationResult.errors.join(', ')}`);
      projectStore.update(state => ({
        ...state,
        validationResult,
        error: error.message
      }));
      throw error;
    }

    // Check for data corruption
    const corruptionCheck = await checkDataCorruption(updatedProject);
    
    if (corruptionCheck.isCorrupted && corruptionCheck.corruptionLevel === 'severe') {
      const error = new Error(`Severe data corruption detected: ${corruptionCheck.issues.join(', ')}`);
      projectStore.update(state => ({
        ...state,
        corruptionCheck,
        error: error.message
      }));
      throw error;
    }

    // Create backup before saving
    const backupId = await createDataBackup(
      `project:${currentState.projectId}`,
      currentState.project,
      'auto'
    );

    // Save to offline cache immediately (optimistic update)
    await projectOfflineManager.saveProjectOffline(updatedProject);
    
    // Update local state with validation results
    projectStore.update(state => ({
      ...state,
      project: updatedProject,
      validationResult,
      corruptionCheck,
      lastBackupId: backupId,
      error: corruptionCheck.issues.length > 0 ? 
        `Warning: ${corruptionCheck.issues.join(', ')}` : null
    }));

    // Try to sync to server if online
    if (navigator.onLine) {
      try {
        await updateProject({
          projectId: currentState.projectId,
          workspace
        });
        
        console.log('Project saved to server successfully');
      } catch (error) {
        console.warn('Failed to sync to server, will retry when online:', error);
        // The offline manager will handle retry when connection is restored
      }
    } else {
      console.log('Offline: Project saved locally, will sync when online');
    }
    
  } catch (error) {
    console.error('Error saving project:', error);
    throw error;
  }
}

/**
 * Save project workspace with auto-save capability
 */
export async function saveProjectWorkspace(workspace: string, options: {
  autoSave?: boolean;
  debounceMs?: number;
} = {}): Promise<void> {
  const { autoSave = true, debounceMs = 1000 } = options;
  
  if (autoSave) {
    // Debounced auto-save for performance
    if ((window as any).autoSaveTimeout) {
      clearTimeout((window as any).autoSaveTimeout);
    }
    
    (window as any).autoSaveTimeout = setTimeout(async () => {
      try {
        await saveCurrentProject(workspace);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, debounceMs);
  } else {
    await saveCurrentProject(workspace);
  }
}

/**
 * Create new project with validation
 */
export async function createNewProject(
  name: string, 
  workspace: string, 
  isPublic: boolean = false
): Promise<string> {
  try {
    const projectData = {
      name,
      workspace,
      isPublic,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Validate project data before creation
    const validationResult = await validateProject(projectData);
    
    if (!validationResult.isValid) {
      throw new Error(`Project validation failed: ${validationResult.errors.join(', ')}`);
    }

    const project = await createProject({
      name,
      workspace,
      isPublic
    });
    
    // Type assertion for Convex project with _id
    const convexProject = project as Project & { _id: string };
    
    // Create initial backup
    const backupId = await createDataBackup(
      `project:${convexProject._id}`,
      convexProject,
      'user'
    );
    
    projectStore.set({
      project: convexProject,
      projectId: convexProject._id,
      isLoading: false,
      error: null,
      validationResult,
      lastBackupId: backupId
    });
    
    return convexProject._id;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

/**
 * Get current project state (synchronous)
 */
function getCurrentProjectState(): ProjectState {
  let currentState: ProjectState = initialState;
  const unsubscribe = projectStore.subscribe(state => { currentState = state; });
  unsubscribe();
  return currentState;
}

/**
 * Get user's projects (reactive query) with offline support
 */
export function getUserProjects(userId: string): Readable<{
  data: Project[] | null;
  isLoading: boolean;
  error: string | null;
  isOffline?: boolean;
}> {
  const query = createQuery<Project[]>('projects:getUserProjects', { userId });
  
  return derived([query, isOnline], ([$query, $isOnline]) => ({
    data: $query.data,
    isLoading: $query.isLoading,
    error: $query.error ? $query.error.message : null,
    isOffline: !$isOnline
  }));
}

/**
 * Get public projects (reactive query) with offline support
 */
export function getPublicProjects(): Readable<{
  data: Project[] | null;
  isLoading: boolean;
  error: string | null;
  isOffline?: boolean;
}> {
  const query = createQuery<Project[]>('projects:getPublicProjects');
  
  return derived([query, isOnline], ([$query, $isOnline]) => ({
    data: $query.data,
    isLoading: $query.isLoading,
    error: $query.error ? $query.error.message : null,
    isOffline: !$isOnline
  }));
}

/**
 * Subscribe to real-time project updates
 */
export function subscribeToProjectUpdates(projectId: string): Readable<{
  data: Project | null;
  isLoading: boolean;
  error: string | null;
}> {
  return subscribeToProject(projectId) as any;
}

/**
 * Subscribe to real-time user projects updates
 */
export function subscribeToUserProjectsUpdates(userId: string): Readable<{
  data: Project[] | null;
  isLoading: boolean;
  error: string | null;
}> {
  return subscribeToUserProjects(userId) as any;
}

/**
 * Subscribe to real-time public projects updates
 */
export function subscribeToPublicProjectsUpdates(): Readable<{
  data: Project[] | null;
  isLoading: boolean;
  error: string | null;
}> {
  return subscribeToPublicProjects() as any;
}

/**
 * Load project with dual-read fallback
 */
async function loadProjectWithFallback(projectId: string): Promise<DataReadResult<Project>> {
  const currentUserId = get(userId);
  if (!currentUserId) {
    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: 'User not authenticated'
    };
  }

  projectStore.update(state => ({ ...state, isLoading: true, error: null }));

  try {
    const result = await getProjectWithFallback(projectId, currentUserId);
    
    if (result.data) {
      projectStore.update(state => ({
        ...state,
        project: result.data,
        projectId,
        isLoading: false,
        error: null
      }));
      
      console.log(`Project loaded from ${result.source}:`, projectId);
    } else {
      projectStore.update(state => ({
        ...state,
        project: null,
        projectId: null,
        isLoading: false,
        error: result.error || 'Project not found'
      }));
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load project';
    projectStore.update(state => ({
      ...state,
      project: null,
      projectId: null,
      isLoading: false,
      error: errorMessage
    }));

    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: errorMessage
    };
  }
}

/**
 * Load user projects with dual-read fallback
 */
async function loadUserProjectsWithFallback(): Promise<DataReadResult<Project[]>> {
  const currentUserId = get(userId);
  if (!currentUserId) {
    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: 'User not authenticated'
    };
  }

  try {
    const result = await getUserProjectsWithFallback(currentUserId);
    console.log(`User projects loaded from ${result.source}`);
    return result;
  } catch (error) {
    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Failed to load projects'
    };
  }
}

/**
 * Load project file with dual-read fallback
 */
async function loadProjectFileWithFallback(projectId: string): Promise<DataReadResult<{ content: string; filename: string }>> {
  const currentUserId = get(userId);
  if (!currentUserId) {
    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: 'User not authenticated'
    };
  }

  try {
    const result = await getProjectFileWithFallback(projectId, currentUserId);
    console.log(`Project file loaded from ${result.source}:`, projectId);
    return result;
  } catch (error) {
    return {
      data: null,
      source: DataSource.CONVEX,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Failed to load project file'
    };
  }
}

/**
 * Configure dual-read preferences
 */
function configureDualReadPreferences(preferConvex: boolean = true): void {
  configureDualRead({ preferConvex });
  console.log(`Project store: Dual-read preference set to ${preferConvex ? 'Convex' : 'Firebase'}`);
}

/**
 * Check if current project has offline changes
 */
export function hasOfflineChanges(): boolean {
  return projectOfflineManager.hasOfflineChanges();
}

/**
 * Sync current project changes to server
 */
export async function syncCurrentProject(): Promise<boolean> {
  try {
    const success = await projectOfflineManager.syncCurrentProject();
    if (success) {
      console.log('Project synced successfully');
    }
    return success;
  } catch (error) {
    console.error('Error syncing project:', error);
    return false;
  }
}

/**
 * Force sync all offline changes
 */
export async function syncAllOfflineChanges(): Promise<void> {
  const currentState = getCurrentProjectState();
  
  if (currentState.projectId && hasOfflineChanges()) {
    projectStore.update(state => ({
      ...state,
      isLoading: true
    }));

    try {
      const success = await syncCurrentProject();
      
      projectStore.update(state => ({
        ...state,
        isLoading: false,
        error: success ? null : 'Failed to sync offline changes'
      }));
      
      if (success) {
        // Reload project from server to get latest state
        await loadProject(currentState.projectId!);
      }
    } catch (error) {
      projectStore.update(state => ({
        ...state,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      }));
    }
  }
}

/**
 * Get offline project status
 */
export function getOfflineStatus(): Readable<{
  isOffline: boolean;
  hasOfflineChanges: boolean;
  canSync: boolean;
  status: OfflineStatus;
}> {
  return derived([isOnline, offlineStatus], ([$isOnline, $offlineStatus]) => ({
    isOffline: !$isOnline,
    hasOfflineChanges: hasOfflineChanges(),
    canSync: $isOnline && hasOfflineChanges(),
    status: $offlineStatus
  }));
}

/**
 * Enable/disable auto-save functionality
 */
export function setAutoSave(enabled: boolean): void {
  if (enabled) {
    console.log('Auto-save enabled for current project');
  } else {
    console.log('Auto-save disabled for current project');
    // Clear any pending auto-save timeout
    if ((window as any).autoSaveTimeout) {
      clearTimeout((window as any).autoSaveTimeout);
    }
  }
}

/**
 * Get current project offline cache info
 */
export function getCurrentProjectCacheInfo(): {
  hasCache: boolean;
  lastModified: number | null;
  hasOfflineChanges: boolean;
} {
  const offlineProject = projectOfflineManager.getCurrentProjectOffline();
  
  return {
    hasCache: !!offlineProject,
    lastModified: offlineProject?.lastModified || null,
    hasOfflineChanges: hasOfflineChanges()
  };
}

/**
 * Validate current project data
 */
export async function validateCurrentProject(): Promise<ValidationResult> {
  const currentState = getCurrentProjectState();
  
  if (!currentState.project) {
    return {
      isValid: false,
      errors: ['No project to validate'],
      warnings: [],
      timestamp: Date.now(),
      dataHash: ''
    };
  }

  try {
    const validationResult = await validateProject(currentState.project);
    
    // Update store with validation results
    projectStore.update(state => ({
      ...state,
      validationResult
    }));

    return validationResult;
  } catch (error) {
    const errorResult: ValidationResult = {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Validation failed'],
      warnings: [],
      timestamp: Date.now(),
      dataHash: ''
    };

    projectStore.update(state => ({
      ...state,
      validationResult: errorResult
    }));

    return errorResult;
  }
}

/**
 * Check current project for data corruption
 */
export async function checkCurrentProjectCorruption(): Promise<CorruptionCheckResult> {
  const currentState = getCurrentProjectState();
  
  if (!currentState.project) {
    return {
      isCorrupted: false,
      corruptionLevel: 'none',
      issues: ['No project to check'],
      recommendations: [],
      timestamp: Date.now()
    };
  }

  try {
    const corruptionCheck = await checkDataCorruption(currentState.project);
    
    // Update store with corruption check results
    projectStore.update(state => ({
      ...state,
      corruptionCheck
    }));

    return corruptionCheck;
  } catch (error) {
    const errorResult: CorruptionCheckResult = {
      isCorrupted: true,
      corruptionLevel: 'severe',
      issues: [error instanceof Error ? error.message : 'Corruption check failed'],
      recommendations: ['Restore from backup', 'Contact support'],
      timestamp: Date.now()
    };

    projectStore.update(state => ({
      ...state,
      corruptionCheck: errorResult
    }));

    return errorResult;
  }
}

/**
 * Create manual backup of current project
 */
export async function createCurrentProjectBackup(): Promise<string> {
  const currentState = getCurrentProjectState();
  
  if (!currentState.project || !currentState.projectId) {
    throw new Error('No project to backup');
  }

  try {
    const backupId = await createDataBackup(
      `project:${currentState.projectId}`,
      currentState.project,
      'user'
    );

    // Update store with backup ID
    projectStore.update(state => ({
      ...state,
      lastBackupId: backupId
    }));

    console.log(`Manual backup created: ${backupId}`);
    return backupId;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Restore current project from backup
 */
export async function restoreCurrentProjectFromBackup(backupId?: string): Promise<void> {
  const currentState = getCurrentProjectState();
  
  if (!currentState.projectId) {
    throw new Error('No project ID to restore');
  }

  try {
    const restoredData = dataIntegrityManager.restoreFromBackup(
      `project:${currentState.projectId}`,
      backupId
    );

    if (!restoredData) {
      throw new Error('No backup found to restore from');
    }

    // Validate restored data
    const validationResult = await validateProject(restoredData);
    
    if (!validationResult.isValid) {
      throw new Error(`Restored data is invalid: ${validationResult.errors.join(', ')}`);
    }

    // Update project store with restored data
    projectStore.update(state => ({
      ...state,
      project: restoredData,
      validationResult,
      error: null
    }));

    // Save restored project
    await saveCurrentProject(restoredData.workspace);
    
    console.log(`Project restored from backup ${backupId || 'latest'}`);
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw error;
  }
}

/**
 * Get project backup history
 */
export function getCurrentProjectBackupHistory(): any[] {
  const currentState = getCurrentProjectState();
  
  if (!currentState.projectId) {
    return [];
  }

  return dataIntegrityManager.getBackupHistory(`project:${currentState.projectId}`);
}

/**
 * Get data integrity status for current project
 */
export function getDataIntegrityStatus(): Readable<{
  isValid: boolean;
  hasCorruption: boolean;
  corruptionLevel: string;
  hasBackups: boolean;
  lastValidation: number;
  issues: string[];
  recommendations: string[];
}> {
  return derived(projectStore, ($projectStore) => {
    const validation = $projectStore.validationResult;
    const corruption = $projectStore.corruptionCheck;
    const backupHistory = getCurrentProjectBackupHistory();

    return {
      isValid: validation?.isValid ?? true,
      hasCorruption: corruption?.isCorrupted ?? false,
      corruptionLevel: corruption?.corruptionLevel ?? 'none',
      hasBackups: backupHistory.length > 0,
      lastValidation: validation?.timestamp ?? 0,
      issues: [
        ...(validation?.errors ?? []),
        ...(corruption?.issues ?? [])
      ],
      recommendations: corruption?.recommendations ?? []
    };
  });
}

/**
 * Enhanced project store with offline capabilities
 */
const enhancedProjectStore = {
  subscribe: projectStore.subscribe,
  set: (value: { project: Project | null; projectId: string | null }) => {
    projectStore.set({
      project: value.project,
      projectId: value.projectId,
      isLoading: false,
      error: null
    });
  },
  
  // Core project operations
  loadProject,
  saveCurrentProject,
  createNewProject,
  saveProjectWorkspace,
  
  // Dual-read methods
  loadProjectWithFallback,
  loadUserProjectsWithFallback,
  loadProjectFileWithFallback,
  configureDualReadPreferences,
  
  // Offline capabilities
  hasOfflineChanges,
  syncCurrentProject,
  syncAllOfflineChanges,
  getOfflineStatus,
  setAutoSave,
  getCurrentProjectCacheInfo,
  
  // Data integrity and validation
  validateCurrentProject,
  checkCurrentProjectCorruption,
  createCurrentProjectBackup,
  restoreCurrentProjectFromBackup,
  getCurrentProjectBackupHistory,
  getDataIntegrityStatus,
  
  // Convex mutations
  createProject,
  updateProject,
  deleteProject,
  
  // Reactive queries
  getUserProjects,
  getPublicProjects
};

/**
 * Legacy interface for backward compatibility
 */
export default enhancedProjectStore;
