/**
 * TVm Local Settings & Preferences Storage
 */

import { UserSettings } from '../types';

const SETTINGS_KEY = 'tvm_user_settings_v1';
const RECENT_APPS_KEY = 'tvm_recent_apps_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  hapticsEnabled: true,
  keyRepeat: true,
  realism3D: 'ultra',
  remoteTheme: 'titanium',
  gyroSensitivity: 1.2,
  gyroDeadZone: 0.04,
  motionSmoothing: 0.35,
  axisInversionX: false,
  axisInversionY: false,
  autoReconnect: true,
  preferredTvId: null,
};

export class StorageService {
  public static getSettings(): UserSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  }

  public static saveSettings(settings: UserSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('[StorageService] Error saving settings:', err);
    }
  }

  public static getRecentApps(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_APPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fallback
    }
    return ['youtube', 'netflix', 'prime', 'disney'];
  }

  public static addRecentApp(appId: string): void {
    try {
      const apps = this.getRecentApps().filter(a => a !== appId);
      apps.unshift(appId);
      localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(apps.slice(0, 12)));
    } catch {
      // Fallback
    }
  }
}
