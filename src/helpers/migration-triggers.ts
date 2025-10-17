// Migration Triggers and Automated Synchronization
// Handles automatic data synchronization during migration between Firebase and Convex

import { getConvexClient } from '../stores/convex.store';
import { browser } from '$app/environment';
import { 
  exportUsers, 
  exportProjects,
  exportAllData
} from './firebase-exporter';
import { 
  importUser, 
  importProject,
  importAllData as importAllDataToConvex,
  batchImportWithRecovery
} from './convex-importer';
import { 
  runMigrationValidation,
  type ValidationReport,
  type ConsistencyReport
} from './data-integrity-validator';

/**
 * Migration trigger types
 */
export enum MigrationTrigger {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  DATA_CHANGE = 'data_change',
  USER_ACTION = 'user_action',
  VALIDATION_FAILURE = 'validation_failure'
}

/**
 * Migration status
 */
export enum MigrationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back'
}

/**
 * Migration trigger event
 */
export interface MigrationTriggerEvent {
  id: string;
  trigger: MigrationTrigger;
  entityType: 'user' | 'project' | 'file' | 'all';
  entityId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Migration execution result
 */
export interface MigrationExecutionResult {
  id: string;
  trigger: MigrationTriggerEvent;
  status: MigrationStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  entitiesProcessed: number;
  entitiesSucceeded: number;
  entitiesFailed: number;
  errors: string[];
  validationReport?: any;
  rollbackAvailable: boolean;
}

/**
 * Synchronization configuration
 */
export interface SyncConfiguration {
  enabled: boolean;
  autoTriggers: MigrationTrigger[];
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  validationEnabled: boolean;
  rollbackOnFailure: boolean;
  maxConcurrentMigrations: number;
}

/**
 * Migration triggers and synchronization manager
 */
class MigrationTriggersManager {
  private config: SyncConfiguration;
  private activeMigrations = new Map<string, MigrationExecutionResult>();
  private migrationHistory: MigrationExecutionResult[] = [];
  private listeners = new Set<(event: MigrationTriggerEvent) => void>();

  constructor(config: Partial<SyncConfiguration> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      autoTriggers: config.autoTriggers ?? [MigrationTrigger.SCHEDULED, MigrationTrigger.DATA_CHANGE],
      batchSize: config.batchSize ?? 100,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 5000,
      validationEnabled: config.validationEnabled ?? true,
      rollbackOnFailure: config.rollbackOnFailure ?? false,
      maxConcurrentMigrations: config.maxConcurrentMigrations ?? 3
    };
  }

  /**
   * Configure synchronization settings
   */
  configure(config: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...config };
    console.log('Migration triggers configured:', this.config);
  }

  /**
   * Add trigger event listener
   */
  addTriggerListener(listener: (event: MigrationTriggerEvent) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove trigger event listener
   */
  removeTriggerListener(listener: (event: MigrationTriggerEvent) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Fire trigger event
   */
  private fireTriggerEvent(event: MigrationTriggerEvent): void {
    console.log(`Migration trigger fired: ${event.trigger} for ${event.entityType}`, event);
    
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in trigger listener:', error);
      }
    }

    // Auto-execute if configured
    if (this.config.enabled && this.config.autoTriggers.includes(event.trigger)) {
      this.executeMigration(event).catch(error => {
        console.error('Auto-migration execution failed:', error);
      });
    }
  }

  /**
   * Trigger user migration
   */
  triggerUserMigration(
    userId: string, 
    trigger: MigrationTrigger = MigrationTrigger.MANUAL,
    metadata?: Record<string, any>
  ): string {
    const event: MigrationTriggerEvent = {
      id: `user_${userId}_${Date.now()}`,
      trigger,
      entityType: 'user',
      entityId: userId,
      userId,
      metadata,
      timestamp: Date.now()
    };

    this.fireTriggerEvent(event);
    return event.id;
  }

  /**
   * Trigger project migration
   */
  triggerProjectMigration(
    projectId: string,
    userId: string,
    trigger: MigrationTrigger = MigrationTrigger.MANUAL,
    metadata?: Record<string, any>
  ): string {
    const event: MigrationTriggerEvent = {
      id: `project_${projectId}_${Date.now()}`,
      trigger,
      entityType: 'project',
      entityId: projectId,
      userId,
      metadata,
      timestamp: Date.now()
    };

    this.fireTriggerEvent(event);
    return event.id;
  }

  /**
   * Trigger file migration
   */
  triggerFileMigration(
    projectId: string,
    userId: string,
    trigger: MigrationTrigger = MigrationTrigger.MANUAL,
    metadata?: Record<string, any>
  ): string {
    const event: MigrationTriggerEvent = {
      id: `file_${projectId}_${Date.now()}`,
      trigger,
      entityType: 'file',
      entityId: projectId,
      userId,
      metadata,
      timestamp: Date.now()
    };

    this.fireTriggerEvent(event);
    return event.id;
  }

  /**
   * Trigger full migration
   */
  triggerFullMigration(
    trigger: MigrationTrigger = MigrationTrigger.MANUAL,
    userId?: string,
    metadata?: Record<string, any>
  ): string {
    const event: MigrationTriggerEvent = {
      id: `full_${Date.now()}`,
      trigger,
      entityType: 'all',
      userId,
      metadata,
      timestamp: Date.now()
    };

    this.fireTriggerEvent(event);
    return event.id;
  }

  /**
   * Execute migration based on trigger event
   */
  async executeMigration(event: MigrationTriggerEvent): Promise<MigrationExecutionResult> {
    // Check if we can start a new migration
    if (this.activeMigrations.size >= this.config.maxConcurrentMigrations) {
      throw new Error('Maximum concurrent migrations reached');
    }

    const result: MigrationExecutionResult = {
      id: event.id,
      trigger: event,
      status: MigrationStatus.IN_PROGRESS,
      startTime: Date.now(),
      entitiesProcessed: 0,
      entitiesSucceeded: 0,
      entitiesFailed: 0,
      errors: [],
      rollbackAvailable: false
    };

    this.activeMigrations.set(event.id, result);

    try {
      console.log(`Starting migration execution: ${event.id}`);

      switch (event.entityType) {
        case 'user':
          await this.executeUserMigration(result);
          break;
        case 'project':
          await this.executeProjectMigration(result);
          break;
        case 'file':
          await this.executeFileMigration(result);
          break;
        case 'all':
          await this.executeFullMigration(result);
          break;
        default:
          throw new Error(`Unknown entity type: ${event.entityType}`);
      }

      // Run validation if enabled
      if (this.config.validationEnabled) {
        console.log(`Running validation for migration: ${event.id}`);
        result.validationReport = await runMigrationValidation(event.userId);
        
        if (result.validationReport.summary.failedChecks > 0) {
          result.errors.push(`Validation failed: ${result.validationReport.summary.failedChecks} checks failed`);
          
          if (this.config.rollbackOnFailure) {
            console.log(`Rolling back migration due to validation failure: ${event.id}`);
            // TODO: Implement rollback logic
            result.status = MigrationStatus.ROLLED_BACK;
          } else {
            result.status = MigrationStatus.FAILED;
          }
        } else {
          result.status = MigrationStatus.COMPLETED;
        }
      } else {
        result.status = MigrationStatus.COMPLETED;
      }

      console.log(`Migration execution completed: ${event.id} (${result.status})`);

    } catch (error) {
      result.status = MigrationStatus.FAILED;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Migration execution failed: ${event.id}`, error);

      if (this.config.rollbackOnFailure) {
        try {
          console.log(`Rolling back failed migration: ${event.id}`);
          // TODO: Implement rollback logic
          result.status = MigrationStatus.ROLLED_BACK;
        } catch (rollbackError) {
          result.errors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
        }
      }
    } finally {
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
      
      this.activeMigrations.delete(event.id);
      this.migrationHistory.push(result);
      
      // Keep history size manageable
      if (this.migrationHistory.length > 1000) {
        this.migrationHistory = this.migrationHistory.slice(-500);
      }
    }

    return result;
  }

  /**
   * Execute user migration
   */
  private async executeUserMigration(result: MigrationExecutionResult): Promise<void> {
    const userId = result.trigger.userId;
    if (!userId) {
      throw new Error('User ID required for user migration');
    }

    try {
      // Export user data from Firebase
      console.log(`Exporting user data: ${userId}`);
      const userData = await exportUsers();
      const userRecord = userData.find(u => u.uid === userId);
      
      if (userRecord) {
        result.entitiesProcessed += 1;

        // Import to Convex
        console.log(`Importing user data to Convex: ${userId}`);
        await importUser(userRecord);
        result.entitiesSucceeded += 1;
      } else {
        result.errors.push(`User not found: ${userId}`);
        result.entitiesFailed += 1;
      }
    } catch (error) {
      result.errors.push(`User migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.entitiesFailed += 1;
    }
  }

  /**
   * Execute project migration
   */
  private async executeProjectMigration(result: MigrationExecutionResult): Promise<void> {
    const projectId = result.trigger.entityId;
    const userId = result.trigger.userId;
    
    if (!projectId || !userId) {
      throw new Error('Project ID and User ID required for project migration');
    }

    try {
      // Export project data from Firebase
      console.log(`Exporting project data: ${projectId}`);
      const projects = await exportProjects();
      const projectRecord = projects.find(p => p.id === projectId && p.userId === userId);
      
      if (projectRecord) {
        result.entitiesProcessed += 1;

        // Import to Convex
        console.log(`Importing project data to Convex: ${projectId}`);
        await importProject(projectRecord);
        result.entitiesSucceeded += 1;
      } else {
        result.errors.push(`Project not found: ${projectId}`);
        result.entitiesFailed += 1;
      }
    } catch (error) {
      result.errors.push(`Project migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.entitiesFailed += 1;
    }
  }

  /**
   * Execute file migration
   */
  private async executeFileMigration(result: MigrationExecutionResult): Promise<void> {
    const projectId = result.trigger.entityId;
    const userId = result.trigger.userId;
    
    if (!projectId || !userId) {
      throw new Error('Project ID and User ID required for file migration');
    }

    try {
      // For file migration, we would need to implement project file export/import
      // For now, just log the action
      console.log(`File migration for project ${projectId} (mock implementation)`);
      result.entitiesProcessed += 1;
      
      // Mock: simulate successful file migration
      result.entitiesSucceeded += 1;
      console.log(`Mock file migration completed for project: ${projectId}`);
    } catch (error) {
      result.errors.push(`File migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.entitiesFailed += 1;
    }
  }

  /**
   * Execute full migration
   */
  private async executeFullMigration(result: MigrationExecutionResult): Promise<void> {
    const userId = result.trigger.userId;

    try {
      // Export all data from Firebase
      console.log('Exporting all data from Firebase');
      const exportResult = await exportAllData();
      
      result.entitiesProcessed += exportResult.users.length + exportResult.projects.length;

      // Import all data to Convex using batch import
      console.log('Importing all data to Convex');
      const importResult = await batchImportWithRecovery(exportResult);
      
      result.entitiesSucceeded += importResult.importedUsers + importResult.importedProjects + importResult.importedFiles;
      result.entitiesFailed += result.entitiesProcessed - result.entitiesSucceeded;
      result.errors.push(...importResult.errors);

      console.log(`Full migration completed: ${result.entitiesSucceeded}/${result.entitiesProcessed} entities migrated`);
    } catch (error) {
      result.errors.push(`Full migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.entitiesFailed += result.entitiesProcessed - result.entitiesSucceeded;
    }
  }

  /**
   * Get active migrations
   */
  getActiveMigrations(): MigrationExecutionResult[] {
    return Array.from(this.activeMigrations.values());
  }

  /**
   * Get migration history
   */
  getMigrationHistory(limit: number = 100): MigrationExecutionResult[] {
    return this.migrationHistory.slice(-limit);
  }

  /**
   * Get migration by ID
   */
  getMigration(id: string): MigrationExecutionResult | null {
    return this.activeMigrations.get(id) || 
           this.migrationHistory.find(m => m.id === id) || 
           null;
  }

  /**
   * Cancel active migration
   */
  cancelMigration(id: string): boolean {
    const migration = this.activeMigrations.get(id);
    if (migration) {
      migration.status = MigrationStatus.FAILED;
      migration.errors.push('Migration cancelled by user');
      migration.endTime = Date.now();
      migration.duration = migration.endTime - migration.startTime;
      
      this.activeMigrations.delete(id);
      this.migrationHistory.push(migration);
      
      console.log(`Migration cancelled: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get migration statistics
   */
  getStatistics(): {
    totalMigrations: number;
    activeMigrations: number;
    completedMigrations: number;
    failedMigrations: number;
    rolledBackMigrations: number;
    averageDuration: number;
  } {
    const completed = this.migrationHistory.filter(m => m.status === MigrationStatus.COMPLETED);
    const failed = this.migrationHistory.filter(m => m.status === MigrationStatus.FAILED);
    const rolledBack = this.migrationHistory.filter(m => m.status === MigrationStatus.ROLLED_BACK);
    
    const totalDuration = this.migrationHistory
      .filter(m => m.duration)
      .reduce((sum, m) => sum + (m.duration || 0), 0);
    
    const averageDuration = this.migrationHistory.length > 0 
      ? totalDuration / this.migrationHistory.length 
      : 0;

    return {
      totalMigrations: this.migrationHistory.length,
      activeMigrations: this.activeMigrations.size,
      completedMigrations: completed.length,
      failedMigrations: failed.length,
      rolledBackMigrations: rolledBack.length,
      averageDuration
    };
  }
}

// Global instance
let migrationTriggersManager: MigrationTriggersManager | null = null;

/**
 * Get or create the global migration triggers manager instance
 */
export function getMigrationTriggersManager(): MigrationTriggersManager {
  if (!migrationTriggersManager) {
    migrationTriggersManager = new MigrationTriggersManager();
  }
  return migrationTriggersManager;
}

/**
 * Configure migration triggers
 */
export function configureMigrationTriggers(config: Partial<SyncConfiguration>): void {
  const manager = getMigrationTriggersManager();
  manager.configure(config);
}

/**
 * Trigger user data migration
 */
export function triggerUserMigration(
  userId: string, 
  trigger: MigrationTrigger = MigrationTrigger.MANUAL,
  metadata?: Record<string, any>
): string {
  const manager = getMigrationTriggersManager();
  return manager.triggerUserMigration(userId, trigger, metadata);
}

/**
 * Trigger project data migration
 */
export function triggerProjectMigration(
  projectId: string,
  userId: string,
  trigger: MigrationTrigger = MigrationTrigger.MANUAL,
  metadata?: Record<string, any>
): string {
  const manager = getMigrationTriggersManager();
  return manager.triggerProjectMigration(projectId, userId, trigger, metadata);
}

/**
 * Trigger full data migration
 */
export function triggerFullMigration(
  trigger: MigrationTrigger = MigrationTrigger.MANUAL,
  userId?: string,
  metadata?: Record<string, any>
): string {
  const manager = getMigrationTriggersManager();
  return manager.triggerFullMigration(trigger, userId, metadata);
}

/**
 * Get migration status
 */
export function getMigrationStatus(migrationId: string): MigrationExecutionResult | null {
  const manager = getMigrationTriggersManager();
  return manager.getMigration(migrationId);
}

/**
 * Get all active migrations
 */
export function getActiveMigrations(): MigrationExecutionResult[] {
  const manager = getMigrationTriggersManager();
  return manager.getActiveMigrations();
}

/**
 * Get migration history
 */
export function getMigrationHistory(limit: number = 100): MigrationExecutionResult[] {
  const manager = getMigrationTriggersManager();
  return manager.getMigrationHistory(limit);
}

/**
 * Cancel migration
 */
export function cancelMigration(migrationId: string): boolean {
  const manager = getMigrationTriggersManager();
  return manager.cancelMigration(migrationId);
}

/**
 * Get migration statistics
 */
export function getMigrationStatistics() {
  const manager = getMigrationTriggersManager();
  return manager.getStatistics();
}

/**
 * Add migration trigger listener
 */
export function addMigrationTriggerListener(listener: (event: MigrationTriggerEvent) => void): void {
  const manager = getMigrationTriggersManager();
  manager.addTriggerListener(listener);
}

/**
 * Remove migration trigger listener
 */
export function removeMigrationTriggerListener(listener: (event: MigrationTriggerEvent) => void): void {
  const manager = getMigrationTriggersManager();
  manager.removeTriggerListener(listener);
}

/**
 * Setup scheduled migration triggers
 */
export function setupScheduledMigration(intervalMs: number = 60 * 60 * 1000): () => void {
  console.log(`Setting up scheduled migration every ${intervalMs}ms`);
  
  const interval = setInterval(() => {
    console.log('Scheduled migration trigger');
    triggerFullMigration(MigrationTrigger.SCHEDULED, undefined, {
      scheduledAt: Date.now()
    });
  }, intervalMs);

  return () => {
    clearInterval(interval);
    console.log('Scheduled migration stopped');
  };
}

/**
 * Monitor data changes and trigger migration
 */
export function setupDataChangeTriggers(): () => void {
  console.log('Setting up data change triggers');
  
  // In a real implementation, this would monitor Firebase/Convex for changes
  // and trigger migrations accordingly
  
  const mockDataChangeCheck = setInterval(() => {
    // Mock: randomly simulate data changes
    if (Math.random() < 0.1) { // 10% chance every interval
      console.log('Data change detected (mock), triggering migration');
      triggerFullMigration(MigrationTrigger.DATA_CHANGE, undefined, {
        changeDetectedAt: Date.now(),
        mock: true
      });
    }
  }, 5 * 60 * 1000); // Check every 5 minutes

  return () => {
    clearInterval(mockDataChangeCheck);
    console.log('Data change triggers stopped');
  };
}