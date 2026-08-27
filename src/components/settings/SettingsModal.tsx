/**
 * TVm Application Settings Modal
 */

import React from 'react';
import {
  Settings,
  Vibrate,
  Layers,
  Compass,
  RefreshCw,
  X,
  HelpCircle,
  Download,
  Shield,
} from 'lucide-react';
import { UserSettings } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onInstallPwa?: () => void;
  canInstallPwa?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onInstallPwa,
  canInstallPwa,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-[#1a1e27] border border-white/10 shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gray-800 text-gray-200 border border-white/10">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">TVm Settings</h2>
              <p className="text-[11px] text-gray-400">Preferences & Motion Tuning</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Sections */}
        <div className="flex flex-col gap-4">
          {/* Haptics */}
          <div className="p-4 rounded-2xl bg-[#141820] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate className="w-5 h-5 text-purple-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Tactile Haptic Feedback</span>
                <span className="text-[10px] text-gray-400">Micro-vibrations on button press</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !settings.hapticsEnabled;
                onUpdateSettings({ hapticsEnabled: next });
                haptics.setEnabled(next);
                if (next) haptics.trigger('medium');
              }}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.hapticsEnabled ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.hapticsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto-Reconnect */}
          <div className="p-4 rounded-2xl bg-[#141820] border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Automatic Reconnection</span>
                <span className="text-[10px] text-gray-400">Resume connection when TV is detected</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateSettings({ autoReconnect: !settings.autoReconnect })}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.autoReconnect ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.autoReconnect ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Motion Sensitivity */}
          <div className="p-4 rounded-2xl bg-[#141820] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">Gyro Pointer Sensitivity</span>
              </div>
              <span className="text-xs font-mono text-cyan-400">{settings.gyroSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.gyroSensitivity}
              onChange={(e) => onUpdateSettings({ gyroSensitivity: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Install PWA Prompt if applicable */}
          {canInstallPwa && onInstallPwa && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-blue-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Install TVm App</span>
                  <span className="text-[10px] text-blue-200/80">Add to Home Screen for fullscreen remote</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onInstallPwa}
                className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow"
              >
                Install
              </button>
            </div>
          )}

          {/* Troubleshooting Info */}
          <div className="p-4 rounded-2xl bg-[#11141b] border border-white/5 flex flex-col gap-2 text-xs text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Wi-Fi Network Requirements</span>
            </span>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Phone and Google TV must be on the same local Wi-Fi / subnet.</li>
              <li>Ensure AP Isolation / Client Isolation is disabled on your router.</li>
              <li>Ports 6467 (Pairing) and 6466 (Remote) must be accessible over LAN.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
