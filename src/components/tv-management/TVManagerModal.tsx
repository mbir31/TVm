/**
 * TVm TV Management & Pairing Modal
 * Discovers nearby Google TV / Android TV devices on local Wi-Fi, handles manual IP connect,
 * and presents the 6-digit TV-generated pairing PIN validation dialog.
 */

import React, { useState } from 'react';
import {
  Tv,
  Wifi,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { ConnectionState, TVDevice } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface TVManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredTvs: TVDevice[];
  activeTv: TVDevice | null;
  connectionState: ConnectionState;
  pairingPrompt: { tv: TVDevice; testbedPin?: string } | null;
  onConnectTV: (tvId: string) => void;
  onSubmitPin: (pin: string) => void;
  onAddManualTV: (ip: string, name?: string) => void;
  onForgetTV: (tvId: string) => void;
  onDisconnect: () => void;
}

export const TVManagerModal: React.FC<TVManagerModalProps> = ({
  isOpen,
  onClose,
  discoveredTvs,
  activeTv,
  connectionState,
  pairingPrompt,
  onConnectTV,
  onSubmitPin,
  onAddManualTV,
  onForgetTV,
  onDisconnect,
}) => {
  const [manualIp, setManualIp] = useState('');
  const [manualName, setManualName] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  if (!isOpen) return null;

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    onAddManualTV(manualIp.trim(), manualName.trim() || undefined);
    setManualIp('');
    setManualName('');
    setShowManualForm(false);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.length < 4) return;
    setIsSubmittingPin(true);
    haptics.trigger('medium');
    onSubmitPin(pinInput.toUpperCase());
    setTimeout(() => {
      setIsSubmittingPin(false);
      setPinInput('');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-[#1a1e27] border border-white/10 shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">TV Devices & Pairing</h2>
              <p className="text-[11px] text-gray-400">Local Wi-Fi Network</p>
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

        {/* PAIRING PIN PROMPT OVERLAY IF ACTIVE */}
        {pairingPrompt && (
          <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-950/70 to-[#121824] border-2 border-blue-500/50 shadow-xl flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span>Enter TV Pairing Code</span>
            </div>
            <p className="text-xs text-gray-300">
              Please enter the 6-character code currently displayed on{' '}
              <strong className="text-white">{pairingPrompt.tv.name}</strong>.
            </p>

            {pairingPrompt.testbedPin && (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
                <span>Testbed PIN on TV Screen:</span>
                <span className="font-mono font-bold tracking-widest text-sm bg-black/40 px-2 py-0.5 rounded text-emerald-200">
                  {pairingPrompt.testbedPin}
                </span>
              </div>
            )}

            <form onSubmit={handlePinSubmit} className="flex flex-col gap-3 mt-1">
              <input
                type="text"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                placeholder="e.g. 8F3A2B or 123456"
                className="w-full py-3 px-4 rounded-xl bg-[#11141b] border-2 border-blue-500/60 text-white text-center font-mono font-bold text-lg tracking-[0.25em] focus:outline-none focus:border-blue-400 uppercase shadow-inner"
                autoFocus
              />

              <button
                type="submit"
                disabled={pinInput.length < 4 || isSubmittingPin}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-98"
              >
                {isSubmittingPin ? 'Verifying Challenge...' : 'Confirm & Pair'}
              </button>
            </form>
          </div>
        )}

        {/* DISCOVERED TVS LIST */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Available Televisions ({discoveredTvs.length})</span>
            </span>
            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manual IP</span>
            </button>
          </div>

          {/* Manual IP Dialog */}
          {showManualForm && (
            <form onSubmit={handleAddManual} className="p-3.5 rounded-xl bg-[#141820] border border-white/10 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-gray-300">Add TV by Local IP Address</span>
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="192.168.1.xxx"
                className="py-2 px-3 rounded-lg bg-[#1a1e27] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                required
              />
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="TV Name (Optional)"
                className="py-2 px-3 rounded-lg bg-[#1a1e27] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  Add & Probe
                </button>
              </div>
            </form>
          )}

          {discoveredTvs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141820] border border-dashed border-white/10 text-center flex flex-col items-center gap-2">
              <Wifi className="w-8 h-8 text-gray-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-300">Scanning local Wi-Fi network...</span>
              <p className="text-[11px] text-gray-500 max-w-[240px]">
                Ensure your TV is powered on and connected to the same Wi-Fi.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {discoveredTvs.map((tv) => {
                const isActive = activeTv?.id === tv.id && connectionState === ConnectionState.CONNECTED;
                return (
                  <div
                    key={tv.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-blue-950/40 border-blue-500/50 shadow-md'
                        : 'bg-[#141820] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-blue-600 text-white' : 'bg-[#222733] text-gray-300'
                        }`}
                      >
                        <Tv className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          <span>{tv.name}</span>
                          {tv.isPaired && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                              PAIRED
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400 truncate">
                          {tv.host} : {tv.remotePort}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive ? (
                        <button
                          type="button"
                          onClick={onDisconnect}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-600/30 text-rose-300 text-xs font-semibold"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            haptics.trigger('medium');
                            onConnectTV(tv.id);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow transition-all active:scale-95"
                        >
                          {tv.isPaired ? 'Connect' : 'Pair'}
                        </button>
                      )}

                      {tv.isPaired && (
                        <button
                          type="button"
                          onClick={() => onForgetTV(tv.id)}
                          className="p-2 rounded-xl text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Forget TV Credentials"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
