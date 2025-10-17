// Data Integrity and Validation Manager
// Provides comprehensive data corruption prevention and validation checks

import { browser } from '$app/environment';
import { handleDatabaseError, type DatabaseError } from './database-error-handler';

/**
 * Data validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  timestamp: number;
  dataHash: string;
  checksum?: string;
  checksumAlgorithm?: 'sha256' | 'md5';
}

/**
 * Data corruption check result
 */
export interface CorruptionCheckResult {
  isCorrupted: boolean;
  corruptionLevel: 'none' | 'minor' | 'moderate' | 'severe';
  issues: string[];
  recommendations: string[];
  timestamp: number;
}

/**
 * Data backup entry
 */
export interface DataBackup {
  id: string;
  data: any;
  timestamp: number;
  checksum: string;
  version: number;
  source: 'user' | 'auto' | 'recovery';
}

/**
 * Schema validation rules
 */
export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  validator?: (value: any) => boolean;
  errorMessage?: string;
}

/**
 * Project data schema for validation
 */
const PROJECT_SCHEMA: ValidationRule[] = [
  {
    field: 'name',
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    errorMessage: 'Project name must be between 1 and 100 characters'
  },
  {
    field: 'workspace',
    type: 'string',
    required: true,
    minLength: 1,
    validator: (value) => {
      try {
        // Check if workspace is valid XML
        const parser = new DOMParser();
        const doc = parser.parseFromString(value, 'application/xml');
        return !doc.querySelector('parsererror');
      } catch {
        return false;
      }
    },
    errorMessage: 'Workspace must contain valid XML'
  },
  {
    field: 'tags',
    type: 'array',
    required: false,
    validator: (value) => Array.isArray(value) && value.every(tag => typeof tag === 'string'),
    errorMessage: 'Tags must be an array of strings'
  },
  {
    field: 'isPublic',
    type: 'boolean',
    required: false,
    errorMessage: 'isPublic must be a boolean value'
  },
  {
    field: 'createdAt',
    type: 'number',
    required: false,
    validator: (value) => typeof value === 'number' && value > 0,
    errorMessage: 'createdAt must be a positive timestamp'
  },
  {
    field: 'updatedAt',
    type: 'number',
    required: false,
    validator: (value) => typeof value === 'number' && value > 0,
    errorMessage: 'updatedAt must be a positive timestamp'
  }
];

/**
 * User settings schema for validation
 */
const USER_SETTINGS_SCHEMA: ValidationRule[] = [
  {
    field: 'autoSave',
    type: 'boolean',
    required: false,
    errorMessage: 'autoSave must be a boolean value'
  },
  {
    field: 'codeFont',
    type: 'string',
    required: false,
    minLength: 1,
    maxLength: 50,
    errorMessage: 'codeFont must be between 1 and 50 characters'
  },
  {
    field: 'tutorialCompleted',
    type: 'boolean',
    required: false,
    errorMessage: 'tutorialCompleted must be a boolean value'
  },
  {
    field: 'theme',
    type: 'string',
    required: false,
    validator: (value) => ['light', 'dark', 'auto'].includes(value),
    errorMessage: 'theme must be one of: light, dark, auto'
  }
];

/**
 * Data integrity and validation manager
 */
export class DataIntegrityManager {
  private static instance: DataIntegrityManager | null = null;
  private backups = new Map<string, DataBackup[]>();
  private maxBackupsPerKey = 10;
  private validationCache = new Map<string, ValidationResult>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.loadBackupsFromStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DataIntegrityManager {
    if (!DataIntegrityManager.instance) {
      DataIntegrityManager.instance = new DataIntegrityManager();
    }
    return DataIntegrityManager.instance;
  }

  /**
   * Generate secure hash for data integrity
   */
  private async generateHash(data: any): Promise<string> {
    const str = typeof data === 'string' ? data : JSON.stringify(data, Object.keys(data).sort());
    
    // Use Web Crypto API if available, fallback to simple hash
    if (browser && window.crypto && window.crypto.subtle) {
      return await this.generateCryptoHash(str);
    }
    
    return this.generateSimpleHash(str);
  }

  /**
   * Generate simple hash synchronously for compatibility
   */
  private generateSimpleHashSync(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data, Object.keys(data).sort());
    return this.generateSimpleHash(str);
  }

  /**
   * Generate cryptographic hash using Web Crypto API
   */
  private async generateCryptoHash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Crypto hash failed, using simple hash:', error);
      return this.generateSimpleHash(data);
    }
  }

  /**
   * Generate simple hash for fallback
   */
  private generateSimpleHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate data against schema
   */
  async validateData(data: any, schema: ValidationRule[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const timestamp = Date.now();
    
    // Check for null or undefined data
    if (data === null || data === undefined) {
      return {
        isValid: false,
        errors: ['Data is null or undefined'],
        warnings: [],
        timestamp,
        dataHash: ''
      };
    }

    // Validate each field according to schema
    for (const rule of schema) {
      const value = data[rule.field];
      
      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.errorMessage || `Field '${rule.field}' is required`);
        continue;
      }
      
      // Skip validation for optional fields that are not present
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }
      
      // Type validation
      if (!this.validateType(value, rule.type)) {
        errors.push(rule.errorMessage || `Field '${rule.field}' must be of type ${rule.type}`);
        continue;
      }
      
      // String-specific validations
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(rule.errorMessage || `Field '${rule.field}' must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(rule.errorMessage || `Field '${rule.field}' must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(rule.errorMessage || `Field '${rule.field}' does not match required pattern`);
        }
      }
      
      // Custom validator
      if (rule.validator && !rule.validator(value)) {
        errors.push(rule.errorMessage || `Field '${rule.field}' failed custom validation`);
      }
    }

    // Check for unexpected fields (warnings only)
    const schemaFields = new Set(schema.map(rule => rule.field));
    for (const key of Object.keys(data)) {
      if (!schemaFields.has(key)) {
        warnings.push(`Unexpected field '${key}' found in data`);
      }
    }

    const dataHash = await this.generateHash(data);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      timestamp,
      dataHash
    };
  }

  /**
   * Validate type of value
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Validate project data
   */
  async validateProject(projectData: any): Promise<ValidationResult> {
    const cacheKey = `project:${this.generateSimpleHashSync(projectData)}`;
    
    // Check cache first
    const cached = this.validationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached;
    }
    
    const result = await this.validateData(projectData, PROJECT_SCHEMA);
    
    // Additional project-specific validations
    if (projectData.workspace) {
      try {
        // Check for potential corruption indicators in workspace XML
        const suspiciousPatterns = [
          /<script[^>]*>/i,
          /javascript:/i,
          /data:text\/html/i,
          /\x00/g, // null bytes
          /[\x01-\x08\x0B\x0C\x0E-\x1F]/g // control characters
        ];
        
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(projectData.workspace)) {
            result.warnings.push('Workspace contains potentially suspicious content');
            break;
          }
        }
        
        // Check XML structure integrity
        const xmlLines = projectData.workspace.split('\n');
        const openTags = (projectData.workspace.match(/<[^\/][^>]*>/g) || []).length;
        const closeTags = (projectData.workspace.match(/<\/[^>]*>/g) || []).length;
        
        if (Math.abs(openTags - closeTags) > 5) {
          result.warnings.push('XML structure may be corrupted - tag mismatch detected');
        }
        
      } catch (error) {
        result.warnings.push('Unable to validate workspace XML structure');
      }
    }
    
    // Cache result
    this.validationCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Validate user settings data
   */
  async validateUserSettings(settingsData: any): Promise<ValidationResult> {
    return await this.validateData(settingsData, USER_SETTINGS_SCHEMA);
  }

  /**
   * Check for data corruption
   */
  async checkDataCorruption(data: any, expectedHash?: string): Promise<CorruptionCheckResult> {
    const timestamp = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      // Generate current hash
      const currentHash = await this.generateHash(data);
      
      // Compare with expected hash if provided
      if (expectedHash && currentHash !== expectedHash) {
        issues.push('Data hash mismatch - data may have been corrupted');
        recommendations.push('Restore from backup or re-sync data from server');
      }
      
      // Check for structural corruption
      if (typeof data !== 'object' || data === null) {
        issues.push('Data is not a valid object');
        recommendations.push('Restore from backup');
      } else {
        // Check for circular references
        try {
          JSON.stringify(data);
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('circular')) {
            issues.push('Data contains circular references');
            recommendations.push('Clean data structure and remove circular references');
          }
        }
        
        // Check for suspicious properties
        const suspiciousKeys = ['__proto__', 'constructor', 'prototype'];
        for (const key of suspiciousKeys) {
          if (key in data) {
            issues.push(`Suspicious property '${key}' found in data`);
            recommendations.push('Remove suspicious properties from data');
          }
        }
        
        // Check for excessively deep nesting
        const maxDepth = this.getObjectDepth(data);
        if (maxDepth > 20) {
          issues.push(`Excessive object nesting detected (depth: ${maxDepth})`);
          recommendations.push('Flatten data structure or check for recursive references');
        }
        
        // Check for extremely large objects
        const dataSize = JSON.stringify(data).length;
        if (dataSize > 10 * 1024 * 1024) { // 10MB
          issues.push(`Data size is unusually large (${Math.round(dataSize / 1024 / 1024)}MB)`);
          recommendations.push('Consider data optimization or chunking');
        }
      }
      
      // Determine corruption level
      let corruptionLevel: 'none' | 'minor' | 'moderate' | 'severe' = 'none';
      if (issues.length > 0) {
        if (issues.some(issue => issue.includes('hash mismatch') || issue.includes('not a valid object'))) {
          corruptionLevel = 'severe';
        } else if (issues.some(issue => issue.includes('circular') || issue.includes('suspicious'))) {
          corruptionLevel = 'moderate';
        } else {
          corruptionLevel = 'minor';
        }
      }
      
      return {
        isCorrupted: issues.length > 0,
        corruptionLevel,
        issues,
        recommendations,
        timestamp
      };
      
    } catch (error) {
      return {
        isCorrupted: true,
        corruptionLevel: 'severe',
        issues: [`Corruption check failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Restore from backup', 'Contact support if issue persists'],
        timestamp
      };
    }
  }

  /**
   * Get object nesting depth
   */
  private getObjectDepth(obj: any, depth = 1): number {
    if (typeof obj !== 'object' || obj === null) {
      return depth;
    }
    
    let maxDepth = depth;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        maxDepth = Math.max(maxDepth, this.getObjectDepth(value, depth + 1));
      }
    }
    
    return maxDepth;
  }

  /**
   * Create data backup
   */
  async createBackup(key: string, data: any, source: 'user' | 'auto' | 'recovery' = 'auto'): Promise<string> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const checksum = await this.generateHash(data);
    
    const backup: DataBackup = {
      id: backupId,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: Date.now(),
      checksum: typeof checksum === 'string' ? checksum : await checksum,
      version: this.getNextVersion(key),
      source
    };
    
    // Get existing backups for this key
    const existingBackups = this.backups.get(key) || [];
    
    // Add new backup
    existingBackups.push(backup);
    
    // Keep only the most recent backups
    existingBackups.sort((a, b) => b.timestamp - a.timestamp);
    if (existingBackups.length > this.maxBackupsPerKey) {
      existingBackups.splice(this.maxBackupsPerKey);
    }
    
    this.backups.set(key, existingBackups);
    this.saveBackupsToStorage();
    
    console.log(`Created backup ${backupId} for ${key}`);
    return backupId;
  }

  /**
   * Get next version number for key
   */
  private getNextVersion(key: string): number {
    const existingBackups = this.backups.get(key) || [];
    const maxVersion = existingBackups.reduce((max, backup) => Math.max(max, backup.version), 0);
    return maxVersion + 1;
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(key: string, backupId?: string): any | null {
    const backups = this.backups.get(key) || [];
    
    let backup: DataBackup | undefined;
    if (backupId) {
      backup = backups.find(b => b.id === backupId);
    } else {
      // Get most recent backup
      backup = backups.sort((a, b) => b.timestamp - a.timestamp)[0];
    }
    
    if (!backup) {
      console.warn(`No backup found for ${key}${backupId ? ` with ID ${backupId}` : ''}`);
      return null;
    }
    
    console.log(`Restoring ${key} from backup ${backup.id} (${new Date(backup.timestamp).toISOString()})`);
    return JSON.parse(JSON.stringify(backup.data)); // Deep clone
  }

  /**
   * Get backup history for key
   */
  getBackupHistory(key: string): DataBackup[] {
    return (this.backups.get(key) || [])
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(backup => ({
        ...backup,
        data: undefined // Don't return actual data, just metadata
      })) as DataBackup[];
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(key: string, backupId: string): Promise<boolean> {
    const backups = this.backups.get(key) || [];
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
      return false;
    }
    
    try {
      const currentChecksum = await this.generateHash(backup.data);
      const expectedChecksum = typeof currentChecksum === 'string' ? currentChecksum : await currentChecksum;
      return expectedChecksum === backup.checksum;
    } catch (error) {
      console.error(`Error verifying backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Clean old backups
   */
  cleanOldBackups(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number { // 30 days default
    const cutoffTime = Date.now() - maxAgeMs;
    let cleanedCount = 0;
    
    for (const [key, backups] of this.backups.entries()) {
      const validBackups = backups.filter(backup => backup.timestamp > cutoffTime);
      if (validBackups.length < backups.length) {
        cleanedCount += backups.length - validBackups.length;
        this.backups.set(key, validBackups);
      }
    }
    
    if (cleanedCount > 0) {
      this.saveBackupsToStorage();
      console.log(`Cleaned ${cleanedCount} old backups`);
    }
    
    return cleanedCount;
  }

  /**
   * Load backups from localStorage
   */
  private loadBackupsFromStorage(): void {
    if (!browser) return;
    
    try {
      const stored = localStorage.getItem('arduino_workflow_builder_data_backups');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.backups = new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load backups from storage:', error);
      this.backups.clear();
    }
  }

  /**
   * Save backups to localStorage
   */
  private saveBackupsToStorage(): void {
    if (!browser) return;
    
    try {
      const backupObject = Object.fromEntries(this.backups);
      localStorage.setItem('arduino_workflow_builder_data_backups', JSON.stringify(backupObject));
    } catch (error) {
      console.error('Failed to save backups to storage:', error);
      // If storage is full, try cleaning old backups
      this.cleanOldBackups(7 * 24 * 60 * 60 * 1000); // 7 days
    }
  }

  /**
   * Get integrity manager statistics
   */
  getStatistics(): {
    totalBackups: number;
    backupsByKey: Record<string, number>;
    oldestBackup: number;
    newestBackup: number;
    totalStorageSize: number;
  } {
    let totalBackups = 0;
    let oldestBackup = Date.now();
    let newestBackup = 0;
    const backupsByKey: Record<string, number> = {};
    
    for (const [key, backups] of this.backups.entries()) {
      totalBackups += backups.length;
      backupsByKey[key] = backups.length;
      
      for (const backup of backups) {
        oldestBackup = Math.min(oldestBackup, backup.timestamp);
        newestBackup = Math.max(newestBackup, backup.timestamp);
      }
    }
    
    // Estimate storage size
    let totalStorageSize = 0;
    if (browser) {
      try {
        const stored = localStorage.getItem('arduino_workflow_builder_data_backups');
        totalStorageSize = stored ? stored.length : 0;
      } catch (error) {
        totalStorageSize = -1;
      }
    }
    
    return {
      totalBackups,
      backupsByKey,
      oldestBackup: totalBackups > 0 ? oldestBackup : 0,
      newestBackup,
      totalStorageSize
    };
  }

  /**
   * Generate checksum for data integrity verification
   * Constitutional requirement: Data corruption prevention
   */
  async generateChecksum(data: any, algorithm: 'sha256' | 'md5' = 'sha256'): Promise<string> {
    try {
      // Normalize data for consistent checksum generation
      const normalizedData = this.normalizeDataForChecksum(data);
      const dataString = JSON.stringify(normalizedData);
      
      if (algorithm === 'sha256' && browser && crypto.subtle) {
        // Use Web Crypto API for SHA-256
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(dataString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        
        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
      } else {
        // Fallback to simple hash
        return this.generateSimpleHash(dataString);
      }
      
    } catch (error) {
      console.error('Checksum generation error:', error);
      // Fallback to simple hash
      return this.generateSimpleHash(JSON.stringify(data));
    }
  }

  /**
   * Verify data integrity using checksum comparison
   */
  async verifyChecksum(data: any, expectedChecksum: string, algorithm: 'sha256' | 'md5' = 'sha256'): Promise<boolean> {
    try {
      const actualChecksum = await this.generateChecksum(data, algorithm);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      console.error('Checksum verification error:', error);
      return false;
    }
  }

  /**
   * Compare data integrity between Firebase and Convex data
   */
  async compareDataIntegrity(firebaseData: any, convexData: any): Promise<{
    identical: boolean;
    firebaseChecksum: string;
    convexChecksum: string;
    differences: string[];
  }> {
    try {
      const firebaseChecksum = await this.generateChecksum(firebaseData);
      const convexChecksum = await this.generateChecksum(convexData);
      
      const identical = firebaseChecksum === convexChecksum;
      const differences: string[] = [];
      
      if (!identical) {
        // Find specific differences
        const firebaseKeys = Object.keys(firebaseData || {});
        const convexKeys = Object.keys(convexData || {});
        const allKeys = [...new Set([...firebaseKeys, ...convexKeys])];
        
        allKeys.forEach(key => {
          if (firebaseData?.[key] !== convexData?.[key]) {
            differences.push(`Field '${key}': Firebase='${firebaseData?.[key]}' vs Convex='${convexData?.[key]}'`);
          }
        });
      }
      
      return {
        identical,
        firebaseChecksum,
        convexChecksum,
        differences
      };
      
    } catch (error) {
      console.error('Data integrity comparison error:', error);
      return {
        identical: false,
        firebaseChecksum: '',
        convexChecksum: '',
        differences: ['Comparison failed due to error']
      };
    }
  }

  /**
   * Batch validate data with checksum verification
   */
  async batchValidateWithChecksums(
    dataRecords: { data: any; expectedChecksum?: string; type: 'project' | 'settings' | 'profile' }[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const record of dataRecords) {
      try {
        let validation: ValidationResult;
        
        // Perform type-specific validation
        switch (record.type) {
          case 'project':
            validation = await this.validateProject(record.data);
            break;
          case 'settings':
            validation = await this.validateUserSettings(record.data);
            break;
          case 'profile':
            validation = await this.validateUserProfile(record.data);
            break;
          default:
            validation = {
              isValid: false,
              errors: [`Unknown data type: ${record.type}`],
              warnings: [],
              timestamp: Date.now(),
              dataHash: ''
            };
        }
        
        // Add checksum verification
        if (record.expectedChecksum) {
          const checksumValid = await this.verifyChecksum(record.data, record.expectedChecksum);
          if (!checksumValid) {
            validation.errors.push('Checksum verification failed - data may be corrupted');
            validation.isValid = false;
          }
          validation.checksum = await this.generateChecksum(record.data);
          validation.checksumAlgorithm = 'sha256';
        }
        
        results.push(validation);
        
      } catch (error) {
        results.push({
          isValid: false,
          errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          warnings: [],
          timestamp: Date.now(),
          dataHash: ''
        });
      }
    }
    
    return results;
  }

  /**
   * Normalize data structure for consistent checksum generation
   */
  private normalizeDataForChecksum(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const normalized = { ...data };
    
    // Remove non-deterministic fields that shouldn't affect checksum
    delete normalized._id; // Database-generated IDs
    delete normalized.timestamp;
    delete normalized.lastModified;
    delete normalized.checksum;
    delete normalized.dataHash;
    delete normalized.source;
    delete normalized._validation_failed;
    
    // Sort object keys for consistency
    const sortedKeys = Object.keys(normalized).sort();
    const sortedNormalized: any = {};
    
    sortedKeys.forEach(key => {
      if (normalized[key] !== undefined && normalized[key] !== null) {
        if (typeof normalized[key] === 'object' && !Array.isArray(normalized[key])) {
          sortedNormalized[key] = this.normalizeDataForChecksum(normalized[key]);
        } else {
          sortedNormalized[key] = normalized[key];
        }
      }
    });
    
    return sortedNormalized;
  }



  /**
   * Validate user profile data (added for completeness)
   */
  private async validateUserProfile(profileData: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      if (!profileData) {
        errors.push('Profile data is null or undefined');
        return {
          isValid: false,
          errors,
          warnings,
          timestamp: Date.now(),
          dataHash: ''
        };
      }
      
      // Basic profile validation
      if (!profileData.userId) {
        errors.push('Profile missing userId');
      }
      
      if (profileData.username && (typeof profileData.username !== 'string' || profileData.username.length < 3)) {
        errors.push('Username must be at least 3 characters');
      }
      
      if (profileData.bio && profileData.bio.length > 500) {
        warnings.push('Bio exceeds recommended 500 character limit');
      }
      
      const dataHash = await this.generateHash(profileData);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        timestamp: Date.now(),
        dataHash
      };
      
    } catch (error) {
      return {
        isValid: false,
        errors: [`Profile validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
        timestamp: Date.now(),
        dataHash: ''
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.backups.clear();
    this.validationCache.clear();
    DataIntegrityManager.instance = null;
  }
}

// Export singleton instance
export const dataIntegrityManager = DataIntegrityManager.getInstance();

// Convenience functions
export async function validateProject(projectData: any): Promise<ValidationResult> {
  return dataIntegrityManager.validateProject(projectData);
}

export async function validateUserSettings(settingsData: any): Promise<ValidationResult> {
  return dataIntegrityManager.validateUserSettings(settingsData);
}

export async function checkDataCorruption(data: any, expectedHash?: string): Promise<CorruptionCheckResult> {
  return dataIntegrityManager.checkDataCorruption(data, expectedHash);
}

export async function createDataBackup(key: string, data: any, source?: 'user' | 'auto' | 'recovery'): Promise<string> {
  return dataIntegrityManager.createBackup(key, data, source);
}

export function restoreFromBackup(key: string, backupId?: string): any | null {
  return dataIntegrityManager.restoreFromBackup(key, backupId);
}