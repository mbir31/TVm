/**
 * TVm Motion & Gyroscope Engine
 * Captures device orientation, accelerometer, and gyroscope data.
 * Applies calibration offsets, dead-zones, sensitivity multipliers, and Exponential Moving Average smoothing.
 */

export interface MotionData {
  pitch: number; // Beta (deg)
  roll: number;  // Gamma (deg)
  yaw: number;   // Alpha (deg)
  normalizedX: number; // -1.0 to 1.0
  normalizedY: number; // -1.0 to 1.0
  accelX: number;
  accelY: number;
  accelZ: number;
}

export type MotionCallback = (data: MotionData) => void;

export class MotionInputEngine {
  private isListening = false;
  private callbacks: Set<MotionCallback> = new Set();

  // Calibration zero-reference
  private refPitch = 0;
  private refRoll = 0;
  private refYaw = 0;

  // Smoothing filter state
  private smoothX = 0;
  private smoothY = 0;

  // Settings
  public sensitivity = 1.2;
  public deadZone = 0.04;
  public smoothingFactor = 0.35; // Alpha for EMA filter
  public invertX = false;
  public invertY = false;

  constructor() {
    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleMotion = this.handleMotion.bind(this);
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // iOS 13+ permission flow
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        return response === 'granted';
      } catch (err) {
        console.warn('[MotionEngine] Orientation permission error:', err);
        return false;
      }
    }
    return true; // Android / standard desktop
  }

  public start(callback: MotionCallback): () => void {
    this.callbacks.add(callback);
    if (!this.isListening && typeof window !== 'undefined') {
      this.isListening = true;
      window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
      window.addEventListener('devicemotion', this.handleMotion, { passive: true });
    }
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0) {
        this.stop();
      }
    };
  }

  public stop(): void {
    this.isListening = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.handleOrientation);
      window.removeEventListener('devicemotion', this.handleMotion);
    }
  }

  public calibrate(): void {
    // Current orientation becomes center (0, 0)
    this.refPitch = this.lastPitch;
    this.refRoll = this.lastRoll;
    this.refYaw = this.lastYaw;
    this.smoothX = 0;
    this.smoothY = 0;
  }

  private lastPitch = 0;
  private lastRoll = 0;
  private lastYaw = 0;
  private accelX = 0;
  private accelY = 0;
  private accelZ = 0;

  private handleMotion(event: DeviceMotionEvent): void {
    if (event.accelerationIncludingGravity) {
      this.accelX = event.accelerationIncludingGravity.x || 0;
      this.accelY = event.accelerationIncludingGravity.y || 0;
      this.accelZ = event.accelerationIncludingGravity.z || 0;
    }
  }

  private handleOrientation(event: DeviceOrientationEvent): void {
    const rawPitch = event.beta || 0;  // front-to-back tilt [-180, 180]
    const rawRoll = event.gamma || 0;  // left-to-right tilt [-90, 90]
    const rawYaw = event.alpha || 0;   // compass direction [0, 360]

    this.lastPitch = rawPitch;
    this.lastRoll = rawRoll;
    this.lastYaw = rawYaw;

    // Delta from calibration center
    let deltaRoll = rawRoll - this.refRoll;
    let deltaPitch = rawPitch - this.refPitch;

    // Normalize to range [-1.0, 1.0] with clamping (assuming 35 degrees = max reach)
    const maxDeg = 35;
    let targetX = (deltaRoll / maxDeg) * this.sensitivity;
    let targetY = (deltaPitch / maxDeg) * this.sensitivity;

    if (this.invertX) targetX = -targetX;
    if (this.invertY) targetY = -targetY;

    // Dead zone check
    if (Math.abs(targetX) < this.deadZone) targetX = 0;
    if (Math.abs(targetY) < this.deadZone) targetY = 0;

    targetX = Math.max(-1, Math.min(1, targetX));
    targetY = Math.max(-1, Math.min(1, targetY));

    // Exponential Moving Average (EMA) smoothing
    this.smoothX = this.smoothX * (1 - this.smoothingFactor) + targetX * this.smoothingFactor;
    this.smoothY = this.smoothY * (1 - this.smoothingFactor) + targetY * this.smoothingFactor;

    const data: MotionData = {
      pitch: rawPitch,
      roll: rawRoll,
      yaw: rawYaw,
      normalizedX: this.smoothX,
      normalizedY: this.smoothY,
      accelX: this.accelX,
      accelY: this.accelY,
      accelZ: this.accelZ,
    };

    for (const cb of this.callbacks) {
      cb(data);
    }
  }
}

export const motionEngine = new MotionInputEngine();
