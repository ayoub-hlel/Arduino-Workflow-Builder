// Data Integrity Validation and Migration Consistency Checks
// Ensures data consistency during migration between Firebase and Convex

import { getConvexClient } from '../stores/convex.store';
import { browser } from '$app/environment';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  entity: string;
  entityId: string;
  errors: string[];
  warnings: string[];
  timestamp: number;
  source: 'convex' | 'firebase';
}

/**
 * Migration consistency result
 */
export interface ConsistencyResult {
  isConsistent: boolean;
  entity: string;
  convexData: any;
  firebaseData: any;
  differences: string[];
  timestamp: number;
}

/**
 * Validation report
 */
export interface ValidationReport {
  totalEntities: number;
  validEntities: number;
  invalidEntities: number;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  timestamp: number;
  source: 'convex' | 'firebase';
}

/**
 * Consistency report
 */
export interface ConsistencyReport {
  totalComparisons: number;
  consistentEntities: number;
  inconsistentEntities: number;
  missingInConvex: number;
  missingInFirebase: number;
  results: ConsistencyResult[];
  timestamp: number;
}

/**
 * Data integrity validator
 */
class DataIntegrityValidator {
  
  /**
   * Validate project data
   */
  validateProject(project: any, source: 'convex' | 'firebase'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!project.id) {
      errors.push('Missing required field: id');
    }

    if (!project.name || typeof project.name !== 'string') {
      errors.push('Missing or invalid required field: name');
    }

    if (!project.userId) {
      errors.push('Missing required field: userId');
    }

    if (!project.workspace || typeof project.workspace !== 'string') {
      errors.push('Missing or invalid required field: workspace');
    }

    // Optional fields validation
    if (project.description && typeof project.description !== 'string') {
      warnings.push('Invalid type for optional field: description');
    }

    if (project.tags && !Array.isArray(project.tags)) {
      warnings.push('Invalid type for optional field: tags (should be array)');
    }

    // Date validation
    if (project.createdAt) {
      const createdAt = new Date(project.createdAt);
      if (isNaN(createdAt.getTime())) {
        errors.push('Invalid date format: createdAt');
      }
    } else {
      warnings.push('Missing optional field: createdAt');
    }

    if (project.updatedAt) {
      const updatedAt = new Date(project.updatedAt);
      if (isNaN(updatedAt.getTime())) {
        errors.push('Invalid date format: updatedAt');
      }
    }

    // Business logic validation
    if (project.name && project.name.length > 255) {
      warnings.push('Project name exceeds recommended length (255 characters)');
    }

    if (project.description && project.description.length > 1000) {
      warnings.push('Project description exceeds recommended length (1000 characters)');
    }

    return {
      isValid: errors.length === 0,
      entity: 'project',
      entityId: project.id || 'unknown',
      errors,
      warnings,
      timestamp: Date.now(),
      source
    };
  }

  /**
   * Validate user profile data
   */
  validateUserProfile(profile: any, source: 'convex' | 'firebase'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!profile.id) {
      errors.push('Missing required field: id');
    }

    if (!profile.email || typeof profile.email !== 'string') {
      errors.push('Missing or invalid required field: email');
    } else {
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profile.email)) {
        errors.push('Invalid email format');
      }
    }

    // Optional fields validation
    if (profile.name && typeof profile.name !== 'string') {
      warnings.push('Invalid type for optional field: name');
    }

    if (profile.avatar && typeof profile.avatar !== 'string') {
      warnings.push('Invalid type for optional field: avatar');
    }

    // Date validation
    if (profile.createdAt) {
      const createdAt = new Date(profile.createdAt);
      if (isNaN(createdAt.getTime())) {
        errors.push('Invalid date format: createdAt');
      }
    }

    if (profile.lastLoginAt) {
      const lastLoginAt = new Date(profile.lastLoginAt);
      if (isNaN(lastLoginAt.getTime())) {
        errors.push('Invalid date format: lastLoginAt');
      }
    }

    return {
      isValid: errors.length === 0,
      entity: 'profile',
      entityId: profile.id || 'unknown',
      errors,
      warnings,
      timestamp: Date.now(),
      source
    };
  }

  /**
   * Validate user settings data
   */
  validateUserSettings(settings: any, source: 'convex' | 'firebase'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!settings.userId) {
      errors.push('Missing required field: userId');
    }

    // Settings validation
    if (settings.theme && !['light', 'dark', 'auto'].includes(settings.theme)) {
      errors.push('Invalid theme value (must be: light, dark, or auto)');
    }

    if (settings.language && typeof settings.language !== 'string') {
      warnings.push('Invalid type for optional field: language');
    }

    if (settings.notifications && typeof settings.notifications !== 'object') {
      warnings.push('Invalid type for optional field: notifications');
    }

    if (settings.autoSave && typeof settings.autoSave !== 'boolean') {
      warnings.push('Invalid type for optional field: autoSave');
    }

    return {
      isValid: errors.length === 0,
      entity: 'settings',
      entityId: settings.userId || 'unknown',
      errors,
      warnings,
      timestamp: Date.now(),
      source
    };
  }

  /**
   * Validate project file data
   */
  validateProjectFile(file: any, source: 'convex' | 'firebase'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!file.projectId) {
      errors.push('Missing required field: projectId');
    }

    if (!file.userId) {
      errors.push('Missing required field: userId');
    }

    if (!file.content || typeof file.content !== 'string') {
      errors.push('Missing or invalid required field: content');
    }

    if (!file.filename || typeof file.filename !== 'string') {
      errors.push('Missing or invalid required field: filename');
    }

    // Content validation
    if (file.content && file.content.length === 0) {
      warnings.push('Empty file content');
    }

    if (file.content && file.content.length > 10 * 1024 * 1024) { // 10MB
      warnings.push('File content exceeds recommended size (10MB)');
    }

    // File extension validation
    if (file.filename && !file.filename.endsWith('.xml')) {
      warnings.push('Unexpected file extension (expected .xml)');
    }

    return {
      isValid: errors.length === 0,
      entity: 'projectFile',
      entityId: `${file.projectId}:${file.userId}` || 'unknown',
      errors,
      warnings,
      timestamp: Date.now(),
      source
    };
  }

  /**
   * Generate validation report for multiple entities
   */
  generateValidationReport(entities: any[], entityType: string, source: 'convex' | 'firebase'): ValidationReport {
    const results: ValidationResult[] = [];

    for (const entity of entities) {
      let validationResult: ValidationResult;

      switch (entityType) {
        case 'project':
          validationResult = this.validateProject(entity, source);
          break;
        case 'profile':
          validationResult = this.validateUserProfile(entity, source);
          break;
        case 'settings':
          validationResult = this.validateUserSettings(entity, source);
          break;
        case 'projectFile':
          validationResult = this.validateProjectFile(entity, source);
          break;
        default:
          validationResult = {
            isValid: false,
            entity: entityType,
            entityId: entity.id || 'unknown',
            errors: [`Unknown entity type: ${entityType}`],
            warnings: [],
            timestamp: Date.now(),
            source
          };
      }

      results.push(validationResult);
    }

    const validEntities = results.filter(r => r.isValid).length;
    const errors = results.filter(r => r.errors.length > 0);
    const warnings = results.filter(r => r.warnings.length > 0);

    return {
      totalEntities: entities.length,
      validEntities,
      invalidEntities: entities.length - validEntities,
      errors,
      warnings,
      timestamp: Date.now(),
      source
    };
  }
}

/**
 * Migration consistency checker
 */
class MigrationConsistencyChecker {

  /**
   * Compare two entities for consistency
   */
  compareEntities(convexData: any, firebaseData: any, entityType: string): ConsistencyResult {
    const differences: string[] = [];

    // Handle null/undefined cases
    if (!convexData && !firebaseData) {
      return {
        isConsistent: true,
        entity: entityType,
        convexData,
        firebaseData,
        differences: [],
        timestamp: Date.now()
      };
    }

    if (!convexData) {
      differences.push('Missing in Convex');
    }

    if (!firebaseData) {
      differences.push('Missing in Firebase');
    }

    if (!convexData || !firebaseData) {
      return {
        isConsistent: false,
        entity: entityType,
        convexData,
        firebaseData,
        differences,
        timestamp: Date.now()
      };
    }

    // Compare common fields
    const convexKeys = Object.keys(convexData);
    const firebaseKeys = Object.keys(firebaseData);
    const allKeys = new Set([...convexKeys, ...firebaseKeys]);

    for (const key of allKeys) {
      const convexValue = convexData[key];
      const firebaseValue = firebaseData[key];

      if (convexValue === undefined && firebaseValue !== undefined) {
        differences.push(`Field "${key}" missing in Convex`);
      } else if (firebaseValue === undefined && convexValue !== undefined) {
        differences.push(`Field "${key}" missing in Firebase`);
      } else if (!this.deepEqual(convexValue, firebaseValue)) {
        differences.push(`Field "${key}" has different values: Convex=${JSON.stringify(convexValue)}, Firebase=${JSON.stringify(firebaseValue)}`);
      }
    }

    return {
      isConsistent: differences.length === 0,
      entity: entityType,
      convexData,
      firebaseData,
      differences,
      timestamp: Date.now()
    };
  }

  /**
   * Deep equality check for primitive values and objects
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (a == null || b == null) {
      return a === b;
    }

    if (typeof a !== typeof b) {
      return false;
    }

    if (typeof a !== 'object') {
      return a === b;
    }

    if (Array.isArray(a) !== Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (!this.deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate consistency report for multiple entity pairs
   */
  generateConsistencyReport(
    convexEntities: any[],
    firebaseEntities: any[],
    entityType: string
  ): ConsistencyReport {
    const results: ConsistencyResult[] = [];
    const convexMap = new Map(convexEntities.map(e => [e.id, e]));
    const firebaseMap = new Map(firebaseEntities.map(e => [e.id, e]));
    
    const allIds = new Set([
      ...convexEntities.map(e => e.id),
      ...firebaseEntities.map(e => e.id)
    ]);

    let consistentEntities = 0;
    let inconsistentEntities = 0;
    let missingInConvex = 0;
    let missingInFirebase = 0;

    for (const id of allIds) {
      const convexEntity = convexMap.get(id);
      const firebaseEntity = firebaseMap.get(id);

      const result = this.compareEntities(convexEntity, firebaseEntity, entityType);
      results.push(result);

      if (result.isConsistent) {
        consistentEntities++;
      } else {
        inconsistentEntities++;
        
        if (!convexEntity) {
          missingInConvex++;
        }
        
        if (!firebaseEntity) {
          missingInFirebase++;
        }
      }
    }

    return {
      totalComparisons: allIds.size,
      consistentEntities,
      inconsistentEntities,
      missingInConvex,
      missingInFirebase,
      results,
      timestamp: Date.now()
    };
  }
}

// Global instances
let dataIntegrityValidator: DataIntegrityValidator | null = null;
let migrationConsistencyChecker: MigrationConsistencyChecker | null = null;

/**
 * Get or create the global data integrity validator instance
 */
export function getDataIntegrityValidator(): DataIntegrityValidator {
  if (!dataIntegrityValidator) {
    dataIntegrityValidator = new DataIntegrityValidator();
  }
  return dataIntegrityValidator;
}

/**
 * Get or create the global migration consistency checker instance
 */
export function getMigrationConsistencyChecker(): MigrationConsistencyChecker {
  if (!migrationConsistencyChecker) {
    migrationConsistencyChecker = new MigrationConsistencyChecker();
  }
  return migrationConsistencyChecker;
}

/**
 * Validate all projects in Convex
 */
export async function validateConvexProjects(userId?: string): Promise<ValidationReport> {
  const validator = getDataIntegrityValidator();
  
  try {
    const convexClient = getConvexClient();
    const projects = userId 
      ? await convexClient.query('projects:getUserProjects', { userId })
      : await convexClient.query('projects:getAllProjects', {});

    return validator.generateValidationReport(projects || [], 'project', 'convex');
  } catch (error) {
    console.error('Failed to validate Convex projects:', error);
    return {
      totalEntities: 0,
      validEntities: 0,
      invalidEntities: 0,
      errors: [],
      warnings: [],
      timestamp: Date.now(),
      source: 'convex'
    };
  }
}

/**
 * Validate all user profiles in Convex
 */
export async function validateConvexProfiles(): Promise<ValidationReport> {
  const validator = getDataIntegrityValidator();
  
  try {
    const convexClient = getConvexClient();
    const profiles = await convexClient.query('users:getAllProfiles', {});

    return validator.generateValidationReport(profiles || [], 'profile', 'convex');
  } catch (error) {
    console.error('Failed to validate Convex profiles:', error);
    return {
      totalEntities: 0,
      validEntities: 0,
      invalidEntities: 0,
      errors: [],
      warnings: [],
      timestamp: Date.now(),
      source: 'convex'
    };
  }
}

/**
 * Check consistency between Convex and Firebase projects
 */
export async function checkProjectConsistency(userId?: string): Promise<ConsistencyReport> {
  const checker = getMigrationConsistencyChecker();
  
  try {
    const convexClient = getConvexClient();
    const convexProjects = userId 
      ? await convexClient.query('projects:getUserProjects', { userId })
      : await convexClient.query('projects:getAllProjects', {});

    // Mock Firebase data (in real migration, would query Firebase)
    const firebaseProjects: any[] = [];
    console.log('MOCK: Firebase project consistency check - no Firebase data available');

    return checker.generateConsistencyReport(
      convexProjects || [],
      firebaseProjects,
      'project'
    );
  } catch (error) {
    console.error('Failed to check project consistency:', error);
    return {
      totalComparisons: 0,
      consistentEntities: 0,
      inconsistentEntities: 0,
      missingInConvex: 0,
      missingInFirebase: 0,
      results: [],
      timestamp: Date.now()
    };
  }
}

/**
 * Run comprehensive validation and consistency checks
 */
export async function runMigrationValidation(userId?: string): Promise<{
  convexProjectValidation: ValidationReport;
  convexProfileValidation: ValidationReport;
  projectConsistency: ConsistencyReport;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    issues: string[];
  };
}> {
  console.log('Starting comprehensive migration validation...');

  const [convexProjectValidation, convexProfileValidation, projectConsistency] = await Promise.all([
    validateConvexProjects(userId),
    validateConvexProfiles(),
    checkProjectConsistency(userId)
  ]);

  const issues: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // Count validation results
  totalChecks += convexProjectValidation.totalEntities;
  passedChecks += convexProjectValidation.validEntities;
  if (convexProjectValidation.invalidEntities > 0) {
    issues.push(`${convexProjectValidation.invalidEntities} invalid projects in Convex`);
  }

  totalChecks += convexProfileValidation.totalEntities;
  passedChecks += convexProfileValidation.validEntities;
  if (convexProfileValidation.invalidEntities > 0) {
    issues.push(`${convexProfileValidation.invalidEntities} invalid profiles in Convex`);
  }

  // Count consistency results
  totalChecks += projectConsistency.totalComparisons;
  passedChecks += projectConsistency.consistentEntities;
  if (projectConsistency.inconsistentEntities > 0) {
    issues.push(`${projectConsistency.inconsistentEntities} inconsistent projects between sources`);
  }
  if (projectConsistency.missingInConvex > 0) {
    issues.push(`${projectConsistency.missingInConvex} projects missing in Convex`);
  }
  if (projectConsistency.missingInFirebase > 0) {
    issues.push(`${projectConsistency.missingInFirebase} projects missing in Firebase`);
  }

  console.log(`Migration validation completed: ${passedChecks}/${totalChecks} checks passed`);

  return {
    convexProjectValidation,
    convexProfileValidation,
    projectConsistency,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks: totalChecks - passedChecks,
      issues
    }
  };
}