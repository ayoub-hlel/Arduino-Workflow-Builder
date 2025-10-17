import { writable, derived, type Readable } from "svelte/store";
import type { Settings } from "../types/models";
import is_browser from "../helpers/is_browser";
import { defaultSetting } from "../types/models";
import _ from "lodash";
import authStore from "./auth.store";
import { MicroControllerType } from "../core/microcontroller/microcontroller";
import { getConvexClient, createQuery, createMutation } from "./convex.store";
import { userId } from "./clerk-auth.store";

/**
 * Settings state interface
 */
interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  isCloudSynced: boolean;
}

/**
 * Load initial settings from localStorage or use defaults
 */
function loadInitialSettings(): Settings {
  let settings: Settings;
  try {
    const storedSettings = is_browser() ? localStorage.getItem("settings") : null;
    settings = storedSettings ? JSON.parse(storedSettings) : defaultSetting;
  } catch (e) {
    settings = defaultSetting;
  }

  settings["boardType"] = settings.boardType || MicroControllerType.ARDUINO_UNO;
  return settings;
}

/**
 * Initial settings state
 */
const initialState: SettingsState = {
  settings: loadInitialSettings(),
  isLoading: false,
  error: null,
  isCloudSynced: false
};

/**
 * Core settings store
 */
const settingsStore = writable<SettingsState>(initialState);

/**
 * Update user settings using Convex mutation
 */
export const updateUserSettings = createMutation<Partial<Settings>, void>('users:updateUserSettings');

/**
 * Load settings from cloud when user logs in
 */
authStore.subscribe(async (auth) => {
  if (!auth.isLoggedIn || !is_browser()) {
    return;
  }

  settingsStore.update(state => ({
    ...state,
    isLoading: true,
    error: null
  }));

  try {
    let cloudSettings: Settings | null = null;

    // Try to load from Convex first, fallback to Firebase during migration
    try {
      const convexClient = getConvexClient();
      cloudSettings = await convexClient.query('users:getUserSettings', { userId: auth.uid });
    } catch (convexError) {
      console.log('Convex settings not available, trying Firebase fallback:', convexError);
      
              // Firebase fallback removed - migration complete
        console.log('Settings not found in Convex, using defaults');
    }

    if (cloudSettings) {
      // Ensure boardType is set
      cloudSettings["boardType"] = cloudSettings.boardType || MicroControllerType.ARDUINO_UNO;
      
      settingsStore.set({
        settings: cloudSettings,
        isLoading: false,
        error: null,
        isCloudSynced: true
      });
    } else {
      // Use local settings if no cloud settings found
      settingsStore.update(state => ({
        ...state,
        isLoading: false,
        isCloudSynced: false
      }));
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    settingsStore.update(state => ({
      ...state,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to load settings'
    }));
  }
});

/**
 * Save settings to localStorage whenever they change
 */
settingsStore.subscribe((state) => {
  if (is_browser()) {
    localStorage.setItem("settings", JSON.stringify(state.settings));
  }
});

/**
 * Update settings and sync to cloud
 */
export async function updateSettings(newSettings: Partial<Settings>): Promise<void> {
  const currentState = getCurrentSettingsState();
  const updatedSettings = { ...currentState.settings, ...newSettings };

  // Update local state immediately
  settingsStore.update(state => ({
    ...state,
    settings: updatedSettings,
    isLoading: true,
    error: null
  }));

  // Try to sync to cloud if user is logged in
  const authState = getCurrentAuthState();
  if (authState.isLoggedIn && authState.uid) {
    try {
      await updateUserSettings(newSettings);
      
      settingsStore.update(state => ({
        ...state,
        isLoading: false,
        isCloudSynced: true
      }));
    } catch (error) {
      console.error('Error syncing settings to cloud:', error);
      settingsStore.update(state => ({
        ...state,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to sync settings'
      }));
    }
  } else {
    // Not logged in, just save locally
    settingsStore.update(state => ({
      ...state,
      isLoading: false,
      isCloudSynced: false
    }));
  }
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
  const defaultSettings = { ...defaultSetting };
  defaultSettings["boardType"] = "ARDUINO_UNO";
  
  await updateSettings(defaultSettings);
}

/**
 * Get current settings state (synchronous)
 */
function getCurrentSettingsState(): SettingsState {
  let currentState: SettingsState = initialState;
  const unsubscribe = settingsStore.subscribe(state => { currentState = state; });
  unsubscribe();
  return currentState;
}

/**
 * Get current auth state (synchronous)
 */
function getCurrentAuthState(): { isLoggedIn: boolean; uid: string | null } {
  let currentState: { isLoggedIn: boolean; uid: string | null } = { isLoggedIn: false, uid: null };
  const unsubscribe = authStore.subscribe(state => { 
    currentState = {
      isLoggedIn: state.isLoggedIn,
      uid: state.uid
    };
  });
  unsubscribe();
  return currentState;
}

/**
 * Settings-only derived store for backward compatibility
 */
export const settings: Readable<Settings> = derived(
  settingsStore,
  ($settingsStore) => $settingsStore.settings
);

/**
 * Is settings loading derived store
 */
export const isSettingsLoading: Readable<boolean> = derived(
  settingsStore,
  ($settingsStore) => $settingsStore.isLoading
);

/**
 * Settings error derived store
 */
export const settingsError: Readable<string | null> = derived(
  settingsStore,
  ($settingsStore) => $settingsStore.error
);

/**
 * Is cloud synced derived store
 */
export const isSettingsCloudSynced: Readable<boolean> = derived(
  settingsStore,
  ($settingsStore) => $settingsStore.isCloudSynced
);

/**
 * Legacy interface for backward compatibility
 */
export default {
  subscribe: settings.subscribe,
  set: (newSettings: Settings) => {
    updateSettings(newSettings);
  },
  update: (updater: (settings: Settings) => Settings) => {
    const currentState = getCurrentSettingsState();
    const updatedSettings = updater(currentState.settings);
    updateSettings(updatedSettings);
  },
  
  // New Convex-based methods
  updateSettings,
  resetSettings,
  
  // Additional derived stores
  isLoading: isSettingsLoading,
  error: settingsError,
  isCloudSynced: isSettingsCloudSynced
};
