/**
 * TVm Haptic Feedback Engine
 * Provides subtle, physical-feeling tactile micro-vibrations for hardware button presses.
 */

export class HapticsEngine {
  private enabled = true;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public trigger(type: 'light' | 'medium' | 'heavy' | 'selection' | 'error' | 'success' = 'light'): void {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) {
      return;
    }

    try {
      switch (type) {
        case 'light':
          navigator.vibrate(8);
          break;
        case 'medium':
          navigator.vibrate(14);
          break;
        case 'heavy':
          navigator.vibrate(25);
          break;
        case 'selection':
          navigator.vibrate([6, 20, 6]);
          break;
        case 'success':
          navigator.vibrate([10, 30, 15]);
          break;
        case 'error':
          navigator.vibrate([30, 40, 30, 40, 30]);
          break;
      }
    } catch {
      // Haptics not allowed or unsupported on current user gesture
    }
  }
}

export const haptics = new HapticsEngine(true);
