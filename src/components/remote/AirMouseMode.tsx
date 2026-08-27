/**
 * TVm Air Mouse / Gyroscope Motion Pointer Mode
 * Uses device orientation sensors with EMA smoothing to transform the smartphone
 * into a precision spatial pointer for smart TV navigation.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Compass, RotateCcw, Target, Sliders, ArrowLeft, Home } from 'lucide-react';
import { motionEngine, MotionData } from '../../services/motion-engine';
import { AndroidKeyCode, KeyDirection } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface AirMouseModeProps {
  onSendKey: (keyCode: AndroidKeyCode, direction?: KeyDirection) => void;
  onSendMotion: (payload: { x: number; y: number; pitch?: number; roll?: number }) => void;
  hapticsEnabled: boolean;
}

export const AirMouseMode: React.FC<AirMouseModeProps> = ({ onSendKey, onSendMotion, hapticsEnabled }) => {
  const [motion, setMotion] = useState<MotionData | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [sensitivity, setSensitivity] = useState(1.2);
  const [deadZone, setDeadZone] = useState(0.04);
  const lastNudgeTime = useRef(0);

  useEffect(() => {
    motionEngine.sensitivity = sensitivity;
    motionEngine.deadZone = deadZone;
  }, [sensitivity, deadZone]);

  const handleStartSensors = async () => {
    const granted = await motionEngine.requestPermission();
    setPermissionGranted(granted);
    if (granted) {
      motionEngine.start((data) => {
        setMotion(data);

        // Periodically emit motion nudges to TV if tilted significantly
        const now = Date.now();
        if (now - lastNudgeTime.current > 180) {
          onSendMotion({ x: data.normalizedX, y: data.normalizedY, pitch: data.pitch, roll: data.roll });
          lastNudgeTime.current = now;
        }
      });
      motionEngine.calibrate();
    }
  };

  const handleRecenter = () => {
    if (hapticsEnabled) haptics.trigger('medium');
    motionEngine.calibrate();
  };

  const handleTriggerClick = () => {
    if (hapticsEnabled) haptics.trigger('heavy');
    onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER);
  };

  return (
    <div className="w-full max-w-[400px] mx-auto flex flex-col gap-4">
      {/* Sensor Permission Banner if needed */}
      {permissionGranted === null && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <Compass className="w-4 h-4" />
            <span>Enable Gyroscope & Motion Sensors</span>
          </div>
          <p className="text-[11px] text-amber-200/80">
            Air Mouse mode requires device orientation access to turn your phone into a spatial pointer.
          </p>
          <button
            type="button"
            onClick={handleStartSensors}
            className="mt-1 py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md transition-colors"
          >
            Activate Motion Sensors
          </button>
        </div>
      )}

      {/* Spatial HUD Radar / Pointer Surface */}
      <div className="relative w-full h-[320px] rounded-[32px] bg-gradient-to-b from-[#191d26] via-[#14171f] to-[#0d1017] border-2 border-[#374151] shadow-[inset_0_4px_16px_rgba(0,0,0,0.8),0_12px_32px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
        {/* Concentric Gyro Rings */}
        <div className="absolute w-56 h-56 rounded-full border border-white/5" />
        <div className="absolute w-40 h-40 rounded-full border border-white/10" />
        <div className="absolute w-24 h-24 rounded-full border border-dashed border-cyan-500/20" />

        {/* Center Target Mark */}
        <div className="pointer-events-none w-8 h-8 rounded-full border border-cyan-400/40 flex items-center justify-center">
          <Target className="w-4 h-4 text-cyan-400/60" />
        </div>

        {/* Dynamic Motion Pointer Reticle */}
        {motion && (
          <div
            className="pointer-events-none absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.8)] flex items-center justify-center transition-all duration-75"
            style={{
              left: `${50 + motion.normalizedX * 42}%`,
              top: `${50 + motion.normalizedY * 42}%`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#22d3ee]" />
          </div>
        )}

        {/* Telemetry Corner Badges */}
        <div className="absolute top-4 left-4 text-[10px] font-mono text-cyan-400/80 bg-black/40 px-2 py-1 rounded-md border border-white/5">
          P: {motion ? motion.pitch.toFixed(1) : '0.0'}° | R: {motion ? motion.roll.toFixed(1) : '0.0'}°
        </div>

        <div className="absolute top-4 right-4 text-[10px] font-mono text-cyan-400/80 bg-black/40 px-2 py-1 rounded-md border border-white/5">
          X: {motion ? motion.normalizedX.toFixed(2) : '0.00'} Y: {motion ? motion.normalizedY.toFixed(2) : '0.00'}
        </div>
      </div>

      {/* Primary Trigger / Action Button */}
      <button
        id="btn-airmouse-trigger"
        type="button"
        onClick={handleTriggerClick}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-base tracking-wider uppercase shadow-[0_6px_20px_rgba(6,182,212,0.4)] active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <Target className="w-5 h-5" />
        <span>Click / Select Target</span>
      </button>

      {/* Recenter & Quick Navigation */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={handleRecenter}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-cyan-300 active:scale-95 transition-all shadow text-xs font-semibold"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Recenter</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (hapticsEnabled) haptics.trigger('light');
            onSendKey(AndroidKeyCode.KEYCODE_BACK);
          }}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-gray-300 active:scale-95 transition-all shadow text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (hapticsEnabled) haptics.trigger('light');
            onSendKey(AndroidKeyCode.KEYCODE_HOME);
          }}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-gray-300 active:scale-95 transition-all shadow text-xs font-semibold"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
      </div>

      {/* Sensitivity Slider */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#171a22] border border-white/5 text-xs text-gray-400">
        <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="text-[11px] whitespace-nowrap">Gyro Sensitivity</span>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.1"
          value={sensitivity}
          onChange={(e) => setSensitivity(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
      </div>
    </div>
  );
};
