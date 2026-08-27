/**
 * TVm Virtual Game Controller Mode
 * Full-featured gamepad with virtual analog thumbstick, tactile ABXY diamond,
 * L1/R1 bumpers, L2/R2 triggers, Start/Select, and Gyroscope Tilt Steering.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Gamepad2, Compass, RotateCcw, Flame } from 'lucide-react';
import { AndroidKeyCode, KeyDirection } from '../../types';
import { motionEngine, MotionData } from '../../services/motion-engine';
import { haptics } from '../../services/haptics-engine';

interface GameControllerModeProps {
  onSendKey: (keyCode: AndroidKeyCode, direction?: KeyDirection) => void;
  onSendMotion: (payload: { x: number; y: number; pitch?: number; roll?: number }) => void;
  hapticsEnabled: boolean;
}

export const GameControllerMode: React.FC<GameControllerModeProps> = ({
  onSendKey,
  onSendMotion,
  hapticsEnabled,
}) => {
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTiltEnabled, setIsTiltEnabled] = useState(false);
  const [motionTilt, setMotionTilt] = useState<MotionData | null>(null);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  const stickCenter = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isTiltEnabled) {
      const unsub = motionEngine.start((data) => {
        setMotionTilt(data);
        onSendMotion({ x: data.normalizedX, y: data.normalizedY });
      });
      return () => {
        unsub();
      };
    }
  }, [isTiltEnabled]);

  const handleStickStart = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    stickCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    handleStickMove(e);
  };

  const handleStickMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!stickCenter.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - stickCenter.current.x;
    const dy = clientY - stickCenter.current.y;
    const maxRadius = 45;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const clampedRadius = Math.min(distance, maxRadius);

    const stickX = Math.cos(angle) * clampedRadius;
    const stickY = Math.sin(angle) * clampedRadius;

    setJoystickPos({ x: stickX, y: stickY });

    // Directional threshold trigger
    if (distance > 20) {
      const deg = (angle * 180) / Math.PI;
      if (deg > -45 && deg <= 45) {
        onSendKey(AndroidKeyCode.KEYCODE_DPAD_RIGHT);
      } else if (deg > 45 && deg <= 135) {
        onSendKey(AndroidKeyCode.KEYCODE_DPAD_DOWN);
      } else if (deg > -135 && deg <= -45) {
        onSendKey(AndroidKeyCode.KEYCODE_DPAD_UP);
      } else {
        onSendKey(AndroidKeyCode.KEYCODE_DPAD_LEFT);
      }
    }
  };

  const handleStickEnd = () => {
    stickCenter.current = null;
    setJoystickPos({ x: 0, y: 0 });
  };

  const triggerButton = (btnId: string, keyCode: AndroidKeyCode) => {
    setActiveBtn(btnId);
    if (hapticsEnabled) haptics.trigger('medium');
    onSendKey(keyCode);
    setTimeout(() => setActiveBtn(null), 120);
  };

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4">
      {/* Top Bumpers & Triggers (L1/R1, L2/R2) */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => triggerButton('L2', AndroidKeyCode.KEYCODE_BUTTON_L2)}
          className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
            activeBtn === 'L2'
              ? 'bg-blue-600 text-white scale-95'
              : 'bg-[#202532] text-gray-300 border border-white/10 hover:bg-[#282f3f]'
          }`}
        >
          LT / L2
        </button>

        <button
          type="button"
          onClick={() => triggerButton('L1', AndroidKeyCode.KEYCODE_BUTTON_L1)}
          className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
            activeBtn === 'L1'
              ? 'bg-blue-600 text-white scale-95'
              : 'bg-[#202532] text-gray-300 border border-white/10 hover:bg-[#282f3f]'
          }`}
        >
          LB / L1
        </button>

        <button
          type="button"
          onClick={() => triggerButton('R1', AndroidKeyCode.KEYCODE_BUTTON_R1)}
          className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
            activeBtn === 'R1'
              ? 'bg-blue-600 text-white scale-95'
              : 'bg-[#202532] text-gray-300 border border-white/10 hover:bg-[#282f3f]'
          }`}
        >
          RB / R1
        </button>

        <button
          type="button"
          onClick={() => triggerButton('R2', AndroidKeyCode.KEYCODE_BUTTON_R2)}
          className={`py-2.5 rounded-xl text-xs font-bold font-mono transition-all ${
            activeBtn === 'R2'
              ? 'bg-blue-600 text-white scale-95'
              : 'bg-[#202532] text-gray-300 border border-white/10 hover:bg-[#282f3f]'
          }`}
        >
          RT / R2
        </button>
      </div>

      {/* Main Gamepad Dual-Zone Body */}
      <div className="p-5 rounded-[36px] bg-gradient-to-b from-[#212633] via-[#161a22] to-[#0f1218] border-2 border-[#374151] shadow-[0_16px_40px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.15)] flex flex-col gap-6">
        {/* Center Start / Select / Tilt Toggle */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={() => triggerButton('select', AndroidKeyCode.KEYCODE_BUTTON_SELECT)}
            className="px-3 py-1.5 rounded-lg bg-[#242b3a] hover:bg-[#2e374a] text-[10px] font-bold text-gray-300 uppercase tracking-wider border border-white/5 active:scale-95 shadow"
          >
            SELECT
          </button>

          {/* Gyro Tilt Steering Button */}
          <button
            type="button"
            onClick={async () => {
              if (!isTiltEnabled) {
                const ok = await motionEngine.requestPermission();
                if (ok) setIsTiltEnabled(true);
              } else {
                setIsTiltEnabled(false);
              }
            }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase border transition-all ${
              isTiltEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : 'bg-[#181c25] text-gray-400 border-white/5'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isTiltEnabled ? 'animate-spin' : ''}`} />
            <span>{isTiltEnabled ? 'TILT ON' : 'TILT STEER'}</span>
          </button>

          <button
            type="button"
            onClick={() => triggerButton('start', AndroidKeyCode.KEYCODE_BUTTON_START)}
            className="px-3 py-1.5 rounded-lg bg-[#242b3a] hover:bg-[#2e374a] text-[10px] font-bold text-gray-300 uppercase tracking-wider border border-white/5 active:scale-95 shadow"
          >
            START
          </button>
        </div>

        {/* Dual Control Zones: Joystick (Left) + ABXY Diamond (Right) */}
        <div className="grid grid-cols-2 gap-4 items-center">
          {/* Left: Virtual Analog Joystick */}
          <div className="flex flex-col items-center">
            <div
              id="gamepad-analog-stick"
              onMouseDown={handleStickStart}
              onMouseMove={handleStickMove}
              onMouseUp={handleStickEnd}
              onTouchStart={handleStickStart}
              onTouchMove={handleStickMove}
              onTouchEnd={handleStickEnd}
              className="relative w-36 h-36 rounded-full bg-gradient-to-b from-[#141820] to-[#0d1016] border-2 border-white/10 shadow-inner flex items-center justify-center cursor-pointer touch-none"
            >
              {/* Stick Head */}
              <div
                className="w-16 h-16 rounded-full bg-gradient-to-b from-[#3a4458] to-[#202633] border-2 border-white/20 shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center transition-transform pointer-events-none"
                style={{
                  transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                }}
              >
                <div className="w-6 h-6 rounded-full bg-[#171b24] shadow-inner" />
              </div>
            </div>
            <span className="text-[10px] font-mono text-gray-500 mt-2 uppercase font-semibold">Thumbstick</span>
          </div>

          {/* Right: ABXY Diamond */}
          <div className="flex flex-col items-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Y Button (Top) */}
              <button
                type="button"
                onClick={() => triggerButton('Y', AndroidKeyCode.KEYCODE_BUTTON_Y)}
                className={`absolute top-0 w-11 h-11 rounded-full font-bold text-sm shadow-md flex items-center justify-center transition-all ${
                  activeBtn === 'Y'
                    ? 'bg-amber-400 text-black scale-90'
                    : 'bg-[#252b38] text-amber-400 border border-amber-500/30 hover:bg-[#303848] active:scale-90'
                }`}
              >
                Y
              </button>

              {/* X Button (Left) */}
              <button
                type="button"
                onClick={() => triggerButton('X', AndroidKeyCode.KEYCODE_BUTTON_X)}
                className={`absolute left-0 w-11 h-11 rounded-full font-bold text-sm shadow-md flex items-center justify-center transition-all ${
                  activeBtn === 'X'
                    ? 'bg-blue-400 text-black scale-90'
                    : 'bg-[#252b38] text-blue-400 border border-blue-500/30 hover:bg-[#303848] active:scale-90'
                }`}
              >
                X
              </button>

              {/* B Button (Right) */}
              <button
                type="button"
                onClick={() => triggerButton('B', AndroidKeyCode.KEYCODE_BUTTON_B)}
                className={`absolute right-0 w-11 h-11 rounded-full font-bold text-sm shadow-md flex items-center justify-center transition-all ${
                  activeBtn === 'B'
                    ? 'bg-rose-500 text-white scale-90'
                    : 'bg-[#252b38] text-rose-400 border border-rose-500/30 hover:bg-[#303848] active:scale-90'
                }`}
              >
                B
              </button>

              {/* A Button (Bottom) */}
              <button
                type="button"
                onClick={() => triggerButton('A', AndroidKeyCode.KEYCODE_BUTTON_A)}
                className={`absolute bottom-0 w-11 h-11 rounded-full font-bold text-sm shadow-md flex items-center justify-center transition-all ${
                  activeBtn === 'A'
                    ? 'bg-emerald-500 text-white scale-90'
                    : 'bg-[#252b38] text-emerald-400 border border-emerald-500/30 hover:bg-[#303848] active:scale-90'
                }`}
              >
                A
              </button>
            </div>
            <span className="text-[10px] font-mono text-gray-500 mt-2 uppercase font-semibold">ABXY Diamond</span>
          </div>
        </div>
      </div>
    </div>
  );
};
