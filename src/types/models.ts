/**
 * Data model types for Arduino Workflow Builder
 * These replace the Firebase model types and are used throughout the application
 */

export interface Settings {
  autoSave: boolean;
  codeFont: string;
  tutorialCompleted: boolean;
  boardType: 'ARDUINO_UNO' | 'ARDUINO_NANO' | 'ARDUINO_MEGA';
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  workspace: string; // Blockly XML workspace
  boardType: 'ARDUINO_UNO' | 'ARDUINO_NANO' | 'ARDUINO_MEGA';
  userId: string;
  created: number;
  updated: number;
  isPublic: boolean;
  tags?: string[];
}

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  website?: string;
  isPublic: boolean;
  created: number;
  updated: number;
}

// Default settings
export const defaultSetting: Settings = {
  autoSave: false,
  codeFont: 'Consolas, "Courier New", monospace',
  tutorialCompleted: false,
  boardType: 'ARDUINO_UNO',
  theme: 'light',
  language: 'en'
};

// Board type validation
export const isValidBoardType = (boardType: string): boardType is Settings['boardType'] => {
  return ['ARDUINO_UNO', 'ARDUINO_NANO', 'ARDUINO_MEGA'].includes(boardType);
};

// Theme validation
export const isValidTheme = (theme: string): theme is NonNullable<Settings['theme']> => {
  return ['light', 'dark', 'auto'].includes(theme);
};

// Project validation
export const isValidProject = (project: any): project is Project => {
  return (
    typeof project === 'object' &&
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    typeof project.workspace === 'string' &&
    isValidBoardType(project.boardType) &&
    typeof project.userId === 'string' &&
    typeof project.created === 'number' &&
    typeof project.updated === 'number' &&
    typeof project.isPublic === 'boolean'
  );
};

// Settings validation
export const isValidSettings = (settings: any): settings is Settings => {
  return (
    typeof settings === 'object' &&
    typeof settings.autoSave === 'boolean' &&
    typeof settings.codeFont === 'string' &&
    typeof settings.tutorialCompleted === 'boolean' &&
    isValidBoardType(settings.boardType)
  );
};

export default {
  defaultSetting,
  isValidBoardType,
  isValidTheme,
  isValidProject,
  isValidSettings
};