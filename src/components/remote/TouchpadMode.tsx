/**
 * TVm Precision Capacitive Touchpad Mode
 * Smooth gesture-driven navigation pad with tap-to-click, swipe-to-navigate,
 * inertia tracking, and gesture ripple effects.
 */

import React, { useState, useRef } from 'react';
import { ArrowLeft, Home, Volume2, VolumeX, Sliders, RotateCcw, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { AndroidKeyCode, KeyDirection } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface TouchpadModeProps {
  onSendKey: (keyCode: AndroidKeyCode, direction?: KeyDirection) => void;
  onAdjustVolume: (direction: 'UP' | 'DOWN' | 'MUTE') => void;
  hapticsEnabled: boolean;
}

export const TouchpadMode: React.FC<TouchpadModeProps> = ({ onSendKey, onAdjustVolume, hapticsEnabled }) => {
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [sensitivity, setSensitivity] = useState(1.2);
  const [lastGesture, setLastGesture] = useState<string>('Ready for gesture');

  const startPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const isMoved = useRef(false);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    startPos.current = { x: clientX, y: clientY, time: Date.now() };
    isMoved.current = false;
    setTouchPos({ x: clientX - rect.left, y: clientY - rect.top });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!startPos.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    const dx = clientX - startPos.current.x;
    const dy = clientY - startPos.current.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      isMoved.current = true;
    }

    setTouchPos({
      x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
    });
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!startPos.current) return;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : (e as React.MouseEvent).clientY;

    const dx = (clientX - startPos.current.x) * sensitivity;
    const dy = (clientY - startPos.current.y) * sensitivity;
    const duration = Date.now() - startPos.current.time;

    const threshold = 30;

    if (!isMoved.current || (Math.abs(dx) < threshold && Math.abs(dy) < threshold && duration < 300)) {
      // Tap gesture -> Select (OK)
      setLastGesture('Tap (Select / OK)');
      if (hapticsEnabled) haptics.trigger('medium');
      onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER);
    } else {
      // Swipe gesture
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > threshold) {
          setLastGesture('Swipe Right ➔');
          if (hapticsEnabled) haptics.trigger('light');
          onSendKey(AndroidKeyCode.KEYCODE_DPAD_RIGHT);
        } else if (dx < -threshold) {
          setLastGesture('Swipe Left ⬅');
          if (hapticsEnabled) haptics.trigger('light');
          onSendKey(AndroidKeyCode.KEYCODE_DPAD_LEFT);
        }
      } else {
        if (dy > threshold) {
          setLastGesture('Swipe Down ⬇');
          if (hapticsEnabled) haptics.trigger('light');
          onSendKey(AndroidKeyCode.KEYCODE_DPAD_DOWN);
        } else if (dy < -threshold) {
          setLastGesture('Swipe Up ⬆');
          if (hapticsEnabled) haptics.trigger('light');
          onSendKey(AndroidKeyCode.KEYCODE_DPAD_UP);
        }
      }
    }

    startPos.current = null;
    setTimeout(() => setTouchPos(null), 200);
  };

  return (
    <div className="w-full max-w-[400px] mx-auto flex flex-col gap-4">
      {/* Gesture Status Header */}
      <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-[#1e232e] border border-white/10 text-xs font-mono text-gray-300">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>{lastGesture}</span>
        </span>
        <span className="text-gray-400">Sens: {sensitivity.toFixed(1)}x</span>
      </div>

      {/* Main Touchpad Canvas */}
      <div
        id="touchpad-surface"
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-[320px] rounded-[32px] bg-gradient-to-b from-[#212631] to-[#141820] border-2 border-[#374151] shadow-[inset_0_4px_12px_rgba(0,0,0,0.6),0_12px_32px_rgba(0,0,0,0.4)] flex items-center justify-center cursor-crosshair overflow-hidden touch-none"
      >
        {/* Subtle grid lines */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />

        {/* Center Crosshair Indicator */}
        <div className="pointer-events-none w-16 h-16 rounded-full border border-dashed border-white/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white/30" />
        </div>

        {/* Dynamic Touch Position Cursor */}
        {touchPos && (
          <div
            className="pointer-events-none absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 border-2 border-blue-400/80 shadow-[0_0_20px_rgba(59,130,246,0.6)] flex items-center justify-center transition-transform"
            style={{ left: touchPos.x, top: touchPos.y }}
          >
            <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8]" />
          </div>
        )}

        {/* Directional Prompt Hints */}
        <span className="pointer-events-none absolute top-4 text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1">
          <ChevronUp className="w-3 h-3" /> UP
        </span>
        <span className="pointer-events-none absolute bottom-4 text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1">
          <ChevronDown className="w-3 h-3" /> DOWN
        </span>
        <span className="pointer-events-none absolute left-4 text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1">
          <ChevronLeft className="w-3 h-3" /> LEFT
        </span>
        <span className="pointer-events-none absolute right-4 text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1">
          RIGHT <ChevronRight className="w-3 h-3" />
        </span>
      </div>

      {/* Quick Navigation Control Bar */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (hapticsEnabled) haptics.trigger('light');
            onSendKey(AndroidKeyCode.KEYCODE_BACK);
          }}
          className="flex items-center justify-center py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-gray-300 active:scale-95 transition-all shadow"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (hapticsEnabled) haptics.trigger('light');
            onSendKey(AndroidKeyCode.KEYCODE_HOME);
          }}
          className="flex items-center justify-center py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-gray-300 active:scale-95 transition-all shadow"
        >
          <Home className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (hapticsEnabled) haptics.trigger('light');
            onAdjustVolume('DOWN');
          }}
          className="flex items-center justify-center py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-gray-300 active:scale-95 transition-all shadow"
        >
          <Volume2 className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (hapticsEnabled) haptics.trigger('light');
            onAdjustVolume('UP');
          }}
          className="flex items-center justify-center py-3 rounded-xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/10 text-gray-300 active:scale-95 transition-all shadow"
        >
          <Volume2 className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Sensitivity Slider */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#171a22] border border-white/5 text-xs text-gray-400">
        <Sliders className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-[11px] whitespace-nowrap">Swipe Sensitivity</span>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.1"
          value={sensitivity}
          onChange={(e) => setSensitivity(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
};
