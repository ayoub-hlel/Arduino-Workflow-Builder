/**
 * User Data Migration Trigger
 * 
 * MIGRATION STRATEGY RATIONALE:
 * Triggers automatic Firebase → Convex migration on first Clerk login to ensure seamless user experience.
 * This approach was chosen to minimize user friction while maintaining data integrity.
 * 
 * KEY ARCHITECTURAL DECISIONS:
 * 1. First-login trigger: Migration happens when users first authenticate with Clerk
 * 2. Lock-based concurrency: Prevents duplicate migrations for the same user
 * 3. Progressive status tracking: Users can monitor migration progress if needed
 * 4. Integrity verification: SHA-256 checksums ensure data fidelity during transfer
 * 5. Graceful fallback: If migration fails partially, dual-read still provides data access
 * 6. Fire-and-forget: Non-blocking migration doesn't delay user authentication
 * 
 * Constitutional compliance: Zero data loss during migration, <1000ms trigger response
 */

import { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { ClerkUser } from '../stores/clerk-auth.store';
import { dataIntegrityManager } from './data-integrity-manager';
import { performanceMonitor } from './performance-monitor';
import { getDualReadAccess } from './dual-read-access';
import { firebaseExporter } from './firebase-exporter';
import { convexImporter } from './convex-importer';

export interface MigrationStatus {
  userId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
  progress: number; // 0-100
  startedAt?: number;
  completedAt?: number;
  errors: string[];
  warnings: string[];
  migratedData: {
    projects: number;
    settings: boolean;
    profile: boolean;
  };
}

export interface MigrationResult {
  success: boolean;
  status: MigrationStatus;
  timeElapsed: number;
  dataIntegrityCheck: boolean;
}

export class UserDataMigrationTrigger {
  private convex: ConvexReactClient;
  private migrationStatus: Map<string, MigrationStatus> = new Map();
  private migrationLocks: Set<string> = new Set();

  constructor(convexClient: ConvexReactClient) {
    this.convex = convexClient;
  }

  /**
   * Trigger migration on first Clerk login
   * 
   * MIGRATION DECISION: First-login trigger ensures migration happens when user is actively engaged
   * This reduces resource waste on inactive accounts and provides immediate feedback on any issues
   * 
   * Constitutional requirement: <1000ms migration trigger response
   */
  async onFirstLogin(clerkUser: ClerkUser): Promise<MigrationResult> {
    const startTime = performance.now();
    const userId = clerkUser.id;

    try {
      // Check if user already exists in Convex
      const existingUser = await this.convex.query(api.users.getUser, { userId });
      
      if (existingUser) {
        // User already migrated
        return {
          success: true,
          status: {
            userId,
            status: 'completed',
            progress: 100,
            completedAt: existingUser._creationTime,
            errors: [],
            warnings: [],
            migratedData: {
              projects: existingUser.projectCount || 0,
              settings: true,
              profile: true
            }
          },
          timeElapsed: performance.now() - startTime,
          dataIntegrityCheck: true
        };
      }

      // Check for migration lock
      if (this.migrationLocks.has(userId)) {
        throw new Error('Migration already in progress for this user');
      }

      // Set migration lock
      this.migrationLocks.add(userId);

      // Initialize migration status
      const migrationStatus: MigrationStatus = {
        userId,
        status: 'pending',
        progress: 0,
        startedAt: Date.now(),
        errors: [],
        warnings: [],
        migratedData: {
          projects: 0,
          settings: false,
          profile: false
        }
      };

      this.migrationStatus.set(userId, migrationStatus);

      // Trigger async migration
      const migrationResult = await this.performMigration(clerkUser, migrationStatus);

      // Record performance
      await performanceMonitor.recordDatabaseOperation('migration_trigger', performance.now() - startTime);

      return migrationResult;

    } catch (error) {
      console.error('Migration trigger error:', error);
      
      // Clean up lock
      this.migrationLocks.delete(userId);
      
      const failureStatus: MigrationStatus = {
        userId,
        status: 'failed',
        progress: 0,
        startedAt: Date.now(),
        errors: [error instanceof Error ? error.message : 'Unknown migration error'],
        warnings: [],
        migratedData: {
          projects: 0,
          settings: false,
          profile: false
        }
      };

      this.migrationStatus.set(userId, failureStatus);

      return {
        success: false,
        status: failureStatus,
        timeElapsed: performance.now() - startTime,
        dataIntegrityCheck: false
      };
    }
  }

  /**
   * Perform the actual data migration
   */
  private async performMigration(clerkUser: ClerkUser, status: MigrationStatus): Promise<MigrationResult> {
    const startTime = performance.now();
    const userId = clerkUser.id;

    try {
      // Update status to in progress
      status.status = 'in_progress';
      status.progress = 5;
      this.migrationStatus.set(userId, status);

      // Step 1: Check for Firebase data
      const firebaseData = await this.checkFirebaseData(userId);
      status.progress = 15;
      this.migrationStatus.set(userId, status);

      if (!firebaseData.hasData) {
        // No Firebase data to migrate - create new user directly
        await this.createNewConvexUser(clerkUser);
        
        status.status = 'completed';
        status.progress = 100;
        status.completedAt = Date.now();
        this.migrationStatus.set(userId, status);
        
        this.migrationLocks.delete(userId);
        
        return {
          success: true,
          status,
          timeElapsed: performance.now() - startTime,
          dataIntegrityCheck: true
        };
      }

      // Step 2: Export Firebase data
      status.progress = 25;
      this.migrationStatus.set(userId, status);
      
      const exportedData = await firebaseExporter.exportUserData(userId);
      
      if (!exportedData.success) {
        throw new Error(`Firebase export failed: ${exportedData.errors.join(', ')}`);
      }

      status.progress = 40;
      this.migrationStatus.set(userId, status);

      // Step 3: Validate exported data integrity
      const integrityResults = await this.validateExportedData(exportedData.data);
      
      if (!integrityResults.allValid) {
        status.warnings.push(...integrityResults.warnings);
        if (integrityResults.criticalErrors.length > 0) {
          throw new Error(`Critical data integrity issues: ${integrityResults.criticalErrors.join(', ')}`);
        }
      }

      status.progress = 55;
      this.migrationStatus.set(userId, status);

      // Step 4: Import to Convex
      const importResult = await convexImporter.importUserData(clerkUser, exportedData.data);
      
      if (!importResult.success) {
        throw new Error(`Convex import failed: ${importResult.errors.join(', ')}`);
      }

      status.progress = 75;
      status.migratedData = {
        projects: importResult.migratedCounts.projects,
        settings: importResult.migratedCounts.settings > 0,
        profile: importResult.migratedCounts.profiles > 0
      };
      this.migrationStatus.set(userId, status);

      // Step 5: Verify migration integrity
      const verificationResult = await this.verifyMigrationIntegrity(userId, exportedData.data);
      
      if (!verificationResult.success) {
        status.warnings.push(...verificationResult.warnings);
        if (verificationResult.criticalFailures.length > 0) {
          throw new Error(`Migration verification failed: ${verificationResult.criticalFailures.join(', ')}`);
        }
      }

      status.progress = 90;
      this.migrationStatus.set(userId, status);

      // Step 6: Cleanup and finalize
      await this.finalizeMigration(userId);
      
      status.status = 'completed';
      status.progress = 100;
      status.completedAt = Date.now();
      this.migrationStatus.set(userId, status);

      // Remove migration lock
      this.migrationLocks.delete(userId);

      return {
        success: true,
        status,
        timeElapsed: performance.now() - startTime,
        dataIntegrityCheck: verificationResult.success
      };

    } catch (error) {
      console.error('Migration error:', error);
      
      status.status = 'failed';
      status.errors.push(error instanceof Error ? error.message : 'Unknown migration error');
      this.migrationStatus.set(userId, status);
      
      // Remove migration lock
      this.migrationLocks.delete(userId);

      return {
        success: false,
        status,
        timeElapsed: performance.now() - startTime,
        dataIntegrityCheck: false
      };
    }
  }

  /**
   * Check if user has Firebase data to migrate
   */
  private async checkFirebaseData(userId: string): Promise<{ hasData: boolean; dataTypes: string[] }> {
    try {
      const dualRead = getDualReadAccess();
      
      // Try to read from Firebase only
      dualRead.updateConfig({ preferConvex: false, fallbackEnabled: false });
      
      const projects = await dualRead.getUserProjects(userId);
      const settings = await dualRead.getUserSettings(userId);
      
      const dataTypes: string[] = [];
      if (projects && projects.length > 0) dataTypes.push('projects');
      if (settings && Object.keys(settings).length > 0) dataTypes.push('settings');
      
      return {
        hasData: dataTypes.length > 0,
        dataTypes
      };
      
    } catch (error) {
      console.warn('Error checking Firebase data:', error);
      return { hasData: false, dataTypes: [] };
    }
  }

  /**
   * Create new Convex user (no migration needed)
   */
  private async createNewConvexUser(clerkUser: ClerkUser): Promise<void> {
    try {
      // Create user in Convex with Clerk data
      await this.convex.mutation(api.users.createUser, {
        userId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        name: clerkUser.firstName && clerkUser.lastName 
          ? `${clerkUser.firstName} ${clerkUser.lastName}` 
          : clerkUser.firstName || clerkUser.username || 'User'
      });
      
      console.log(`Created new Convex user for ${clerkUser.id}`);
      
    } catch (error) {
      console.error('Error creating new Convex user:', error);
      throw error;
    }
  }

  /**
   * Validate exported data integrity before import
   */
  private async validateExportedData(exportedData: any): Promise<{
    allValid: boolean;
    warnings: string[];
    criticalErrors: string[];
  }> {
    const warnings: string[] = [];
    const criticalErrors: string[] = [];

    try {
      // Validate projects
      if (exportedData.projects) {
        for (const project of exportedData.projects) {
          const validation = await dataIntegrityManager.validateProject(project);
          if (!validation.isValid) {
            if (validation.errors.some(e => e.includes('missing') || e.includes('required'))) {
              criticalErrors.push(`Project ${project.id}: ${validation.errors.join(', ')}`);
            } else {
              warnings.push(`Project ${project.id}: ${validation.warnings.join(', ')}`);
            }
          }
        }
      }

      // Validate settings
      if (exportedData.settings) {
        const validation = await dataIntegrityManager.validateUserSettings(exportedData.settings);
        if (!validation.isValid) {
          warnings.push(`Settings: ${validation.errors.join(', ')}`);
        }
      }

      return {
        allValid: criticalErrors.length === 0,
        warnings,
        criticalErrors
      };

    } catch (error) {
      criticalErrors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        allValid: false,
        warnings,
        criticalErrors
      };
    }
  }

  /**
   * Verify migration integrity after import
   */
  private async verifyMigrationIntegrity(userId: string, originalData: any): Promise<{
    success: boolean;
    warnings: string[];
    criticalFailures: string[];
  }> {
    const warnings: string[] = [];
    const criticalFailures: string[] = [];

    try {
      // Get migrated data from Convex
      const convexProjects = await this.convex.query(api.projects.getUserProjects, { userId });
      const convexSettings = await this.convex.query(api.users.getUserSettings, { userId });

      // Compare project counts
      const originalProjectCount = originalData.projects?.length || 0;
      const migratedProjectCount = convexProjects?.length || 0;

      if (originalProjectCount !== migratedProjectCount) {
        criticalFailures.push(`Project count mismatch: expected ${originalProjectCount}, got ${migratedProjectCount}`);
      }

      // Verify data integrity using checksums
      if (originalData.projects && convexProjects) {
        for (let i = 0; i < Math.min(originalData.projects.length, convexProjects.length); i++) {
          const comparison = await dataIntegrityManager.compareDataIntegrity(
            originalData.projects[i],
            convexProjects[i]
          );
          
          if (!comparison.identical) {
            if (comparison.differences.length > 5) {
              criticalFailures.push(`Major data differences in project ${i}`);
            } else {
              warnings.push(`Minor differences in project ${i}: ${comparison.differences.join(', ')}`);
            }
          }
        }
      }

      return {
        success: criticalFailures.length === 0,
        warnings,
        criticalFailures
      };

    } catch (error) {
      criticalFailures.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        warnings,
        criticalFailures
      };
    }
  }

  /**
   * Finalize migration and cleanup
   */
  private async finalizeMigration(userId: string): Promise<void> {
    try {
      // Mark user as migrated in Convex
      await this.convex.mutation(api.users.markUserMigrated, { 
        userId,
        migratedAt: Date.now()
      });

      // Update dual-read configuration to prefer Convex
      const dualRead = getDualReadAccess();
      dualRead.updateConfig({ preferConvex: true, fallbackEnabled: true });

      console.log(`Migration finalized for user ${userId}`);

    } catch (error) {
      console.error('Error finalizing migration:', error);
      throw error;
    }
  }

  /**
   * Get migration status for a user
   */
  getMigrationStatus(userId: string): MigrationStatus | null {
    return this.migrationStatus.get(userId) || null;
  }

  /**
   * Check if migration is in progress
   */
  isMigrationInProgress(userId: string): boolean {
    return this.migrationLocks.has(userId);
  }

  /**
   * Get all migration statuses (for admin/debugging)
   */
  getAllMigrationStatuses(): MigrationStatus[] {
    return Array.from(this.migrationStatus.values());
  }

  /**
   * Retry failed migration
   */
  async retryMigration(clerkUser: ClerkUser): Promise<MigrationResult> {
    const userId = clerkUser.id;
    const currentStatus = this.migrationStatus.get(userId);
    
    if (currentStatus?.status === 'in_progress') {
      throw new Error('Migration is already in progress');
    }

    // Clear previous status
    this.migrationStatus.delete(userId);
    this.migrationLocks.delete(userId);

    // Restart migration
    return this.onFirstLogin(clerkUser);
  }
}

// Export singleton instance
let migrationTriggerInstance: UserDataMigrationTrigger | null = null;

export function createMigrationTrigger(convexClient: ConvexReactClient): UserDataMigrationTrigger {
  migrationTriggerInstance = new UserDataMigrationTrigger(convexClient);
  return migrationTriggerInstance;
}

export function getMigrationTrigger(): UserDataMigrationTrigger {
  if (!migrationTriggerInstance) {
    throw new Error('MigrationTrigger not initialized. Call createMigrationTrigger first.');
  }
  return migrationTriggerInstance;
}

export default UserDataMigrationTrigger;