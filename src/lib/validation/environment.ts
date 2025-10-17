/**
 * Environment Validation Utility
 * Part of Arduino Workflow Builder debugging infrastructure
 * 
 * Constitutional compliance: Environment verification per principle X
 */

export interface EnvironmentValidationResult {
  valid: boolean;
  issues: EnvironmentIssue[];
  recommendations: EnvironmentRecommendation[];
  configuration: EnvironmentConfiguration;
}

export interface EnvironmentIssue {
  type: 'MISSING_ENV_VAR' | 'INVALID_FORMAT' | 'PLACEHOLDER_VALUE';
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  variable?: string;
}

export interface EnvironmentRecommendation {
  action: string;
  command?: string;
  documentation?: string;
}

export interface EnvironmentConfiguration {
  clerk: {
    publishableKey: string;
    isPlaceholder: boolean;
  };
  convex: {
    url: string;
    isPlaceholder: boolean;
  };
  server: {
    arduinoUrl: string;
  };
  deployment: {
    bucketName: string;
    siteName: string;
    useEmulator: boolean;
  };
}

/**
 * Validates environment variables required for Arduino Workflow Builder
 */
import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_CONVEX_URL } from '$env/static/public';

export function validateEnvironment(): EnvironmentValidationResult {
  const issues: EnvironmentIssue[] = [];
  const recommendations: EnvironmentRecommendation[] = [];
  
  // Check Clerk configuration
  const clerkKey = PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const isClerkPlaceholder = clerkKey.includes("placeholder") || clerkKey.startsWith("pk_test_development_placeholder");
  
  if (!clerkKey) {
    issues.push({
      type: 'MISSING_ENV_VAR',
      description: 'Clerk publishable key is not set',
      severity: 'CRITICAL',
      variable: 'PUBLIC_CLERK_PUBLISHABLE_KEY'
    });
    recommendations.push({
      action: 'Set Clerk publishable key in environment variables',
      command: 'export PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here',
      documentation: 'See Clerk dashboard for your publishable key'
    });
  } else if (isClerkPlaceholder) {
    issues.push({
      type: 'PLACEHOLDER_VALUE',
      description: 'Clerk publishable key is using placeholder value',
      severity: 'HIGH',
      variable: 'PUBLIC_CLERK_PUBLISHABLE_KEY'
    });
    recommendations.push({
      action: 'Replace placeholder with actual Clerk publishable key',
      documentation: 'Get your publishable key from Clerk dashboard'
    });
  }
  
  // Check Convex configuration
  const convexUrl = PUBLIC_CONVEX_URL || "";
  const isConvexPlaceholder = convexUrl.includes("development.convex.cloud");
  
  if (!convexUrl) {
    issues.push({
      type: 'MISSING_ENV_VAR',
      description: 'Convex URL is not set',
      severity: 'CRITICAL',
      variable: 'PUBLIC_CONVEX_URL'
    });
    recommendations.push({
      action: 'Set Convex deployment URL in environment variables',
      command: 'export PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud',
      documentation: 'Get your deployment URL from Convex dashboard'
    });
  } else if (isConvexPlaceholder) {
    issues.push({
      type: 'PLACEHOLDER_VALUE',
      description: 'Convex URL is using placeholder value',
      severity: 'HIGH',
      variable: 'PUBLIC_CONVEX_URL'
    });
    recommendations.push({
      action: 'Replace placeholder with actual Convex deployment URL',
      documentation: 'Get your deployment URL from Convex dashboard'
    });
  }
  
  const configuration: EnvironmentConfiguration = {
    clerk: {
      publishableKey: clerkKey,
      isPlaceholder: isClerkPlaceholder
    },
    convex: {
      url: convexUrl,
      isPlaceholder: isConvexPlaceholder
    },
    server: {
      arduinoUrl: "http://localhost:3001"
    },
    deployment: {
      bucketName: "arduino-workflow-builder-lesson-dev",
      siteName: "arduino-workflow-builder-dev",
      useEmulator: true
    }
  };
  
  const valid = issues.filter(issue => issue.severity === 'CRITICAL').length === 0;
  
  return {
    valid,
    issues,
    recommendations,
    configuration
  };
}

/**
 * Validates browser environment for debugging
 */
export function validateBrowserEnvironment(): {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  platform: string;
  cookiesEnabled: boolean;
  localStorageAvailable: boolean;
  sessionStorageAvailable: boolean;
} {
  const userAgent = navigator.userAgent;
  
  // Simple browser detection
  let browserName = 'Unknown';
  let browserVersion = 'Unknown';
  
  if (userAgent.includes('Chrome')) {
    browserName = 'Chrome';
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
    const match = userAgent.match(/Version\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  } else if (userAgent.includes('Edge')) {
    browserName = 'Edge';
    const match = userAgent.match(/Edge\/([0-9.]+)/);
    browserVersion = match ? match[1] : 'Unknown';
  }
  
  // Test storage availability
  let localStorageAvailable = false;
  let sessionStorageAvailable = false;
  let cookiesEnabled = false;
  
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    localStorageAvailable = true;
  } catch (e) {
    localStorageAvailable = false;
  }
  
  try {
    sessionStorage.setItem('test', 'test');
    sessionStorage.removeItem('test');
    sessionStorageAvailable = true;
  } catch (e) {
    sessionStorageAvailable = false;
  }
  
  cookiesEnabled = navigator.cookieEnabled;
  
  return {
    userAgent,
    browserName,
    browserVersion,
    platform: navigator.platform,
    cookiesEnabled,
    localStorageAvailable,
    sessionStorageAvailable
  };
}

/**
 * Logs environment validation results for debugging
 */
export function logEnvironmentValidation(): void {
  const serverValidation = validateEnvironment();
  
  console.group('🔧 Arduino Workflow Builder - Environment Validation');
  
  if (serverValidation.valid) {
    console.log('✅ Server environment validation passed');
  } else {
    console.warn('⚠️ Server environment validation failed');
    serverValidation.issues.forEach(issue => {
      const icon = issue.severity === 'CRITICAL' ? '🚨' : '⚠️';
      console.warn(`${icon} ${issue.description}`);
    });
  }
  
  if (typeof window !== 'undefined') {
    const browserValidation = validateBrowserEnvironment();
    console.log('🌐 Browser environment:', browserValidation);
  }
  
  console.groupEnd();
}