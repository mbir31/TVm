/**
 * TVm TV Management & Pairing Modal
 * Discovers nearby Google TV / Android TV devices on local Wi-Fi, handles manual IP connect,
 * IP range subnet scanner, and presents the 6-digit TV-generated pairing PIN validation dialog.
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
  Search,
  HelpCircle,
  ChevronRight,
  Info,
  Layers,
} from 'lucide-react';
import { ConnectionState, TVDevice } from '../../types';
import { haptics } from '../../services/haptics-engine';
import { bridgeClient } from '../../services/bridge-client';

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
  const [showSubnetScanner, setShowSubnetScanner] = useState(false);
  const [showIpGuide, setShowIpGuide] = useState(false);
  const [subnetPrefix, setSubnetPrefix] = useState('192.168.1');
  const [isScanningSubnet, setIsScanningSubnet] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [probeResult, setProbeResult] = useState<{ host: string; isOpen: boolean } | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  if (!isOpen) return null;

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    onAddManualTV(manualIp.trim(), manualName.trim() || undefined);
    setManualIp('');
    setManualName('');
    setProbeResult(null);
    setShowManualForm(false);
  };

  const handleProbeIp = async () => {
    if (!manualIp.trim()) return;
    setIsProbing(true);
    try {
      const res = await bridgeClient.probeHost(manualIp.trim());
      setProbeResult(res);
    } catch {
      setProbeResult({ host: manualIp.trim(), isOpen: false });
    } finally {
      setIsProbing(false);
    }
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    haptics.trigger('light');
    try {
      await bridgeClient.rescan();
    } finally {
      setTimeout(() => setIsRescanning(false), 1200);
    }
  };

  const handleScanSubnet = async (prefix?: string) => {
    const target = prefix || subnetPrefix;
    setIsScanningSubnet(true);
    haptics.trigger('medium');
    try {
      await bridgeClient.scanSubnet(target);
    } finally {
      setIsScanningSubnet(false);
    }
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
      <div className="relative w-full max-w-md rounded-3xl bg-[#1a1e27] border border-white/10 shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">TV Devices & Pairing</h2>
              <p className="text-[11px] text-gray-400">Google TV & Android TV</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRescan}
              disabled={isRescanning}
              className="p-2 rounded-xl bg-[#222733] hover:bg-[#2c3343] text-gray-300 hover:text-white transition-colors"
              title="Rescan Wi-Fi Network"
            >
              <RotateCw className={`w-4 h-4 ${isRescanning ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CLOUD ENVIRONMENT NOTICE & IP GUIDANCE */}
        <div className="p-3 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-white">Connecting your TV</span>
              <p className="text-[11px] text-blue-200/90 leading-relaxed">
                If automatic mDNS scanning is blocked by your Wi-Fi router or when previewing remotely, tap{' '}
                <strong className="text-white">Manual IP</strong> or <strong className="text-white">Subnet Scan</strong> to connect instantly by local IP.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIpGuide(!showIpGuide)}
            className="flex items-center justify-between text-[11px] text-blue-400 hover:text-blue-300 font-semibold pt-1 border-t border-blue-500/20"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How to find your TV's IP address</span>
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showIpGuide ? 'rotate-90' : ''}`} />
          </button>

          {showIpGuide && (
            <div className="p-3 rounded-xl bg-[#0f141f] border border-blue-500/20 text-[11px] text-gray-300 flex flex-col gap-1.5 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">1</span>
                <span>On your TV remote, press <strong>Settings (⚙️)</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">2</span>
                <span>Select <strong>Network & Internet</strong> → your connected Wi-Fi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">3</span>
                <span>Look at <strong>IP address</strong> (e.g. <code>192.168.1.105</code>)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-[10px]">4</span>
                <span>Enter it in <strong>Manual IP</strong> below and tap <strong>Connect</strong>!</span>
              </div>
            </div>
          )}
        </div>

        {/* PAIRING PIN PROMPT OVERLAY IF ACTIVE */}
        {pairingPrompt && (
          <div className="p-5 rounded-2xl bg-gradient-to-b from-blue-950/70 to-[#121824] border-2 border-blue-500/50 shadow-xl flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span>Enter TV Pairing Code</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Look at your TV screen. Enter the 6-character pairing code shown on{' '}
              <strong className="text-white">{pairingPrompt.tv.name}</strong>:
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

        {/* QUICK ACTION BUTTONS (MANUAL IP / SUBNET SCAN) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowManualForm(!showManualForm);
              if (!showManualForm) setShowSubnetScanner(false);
            }}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              showManualForm
                ? 'bg-blue-600 border-blue-400 text-white'
                : 'bg-[#141820] border-white/10 text-gray-300 hover:bg-[#1e2330]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect by IP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowSubnetScanner(!showSubnetScanner);
              if (!showSubnetScanner) setShowManualForm(false);
            }}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              showSubnetScanner
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : 'bg-[#141820] border-white/10 text-gray-300 hover:bg-[#1e2330]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Subnet Scan</span>
          </button>
        </div>

        {/* MANUAL IP FORM */}
        {showManualForm && (
          <form onSubmit={handleAddManual} className="p-4 rounded-2xl bg-[#141820] border border-blue-500/30 flex flex-col gap-2.5 animate-fadeIn">
            <span className="text-xs font-bold text-white">Add TV by Local IP Address</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualIp}
                onChange={(e) => {
                  setManualIp(e.target.value);
                  setProbeResult(null);
                }}
                placeholder="192.168.1.xxx"
                className="flex-1 py-2 px-3 rounded-xl bg-[#1a1e27] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={handleProbeIp}
                disabled={!manualIp.trim() || isProbing}
                className="px-3 py-2 rounded-xl bg-[#222733] hover:bg-[#2c3343] text-gray-200 text-xs font-semibold shrink-0 disabled:opacity-40"
              >
                {isProbing ? 'Probing...' : 'Test IP'}
              </button>
            </div>

            {probeResult && (
              <div className={`p-2 rounded-xl text-[11px] flex items-center gap-2 ${
                probeResult.isOpen
                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
              }`}>
                {probeResult.isOpen ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {probeResult.isOpen
                    ? `Port 6467 reachable on ${probeResult.host}! Ready to pair.`
                    : `Could not reach ${probeResult.host} on port 6467. Ensure TV is turned on.`}
                </span>
              </div>
            )}

            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="TV Name (e.g. Living Room TV)"
              className="py-2 px-3 rounded-xl bg-[#1a1e27] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
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
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow"
              >
                Add & Connect
              </button>
            </div>
          </form>
        )}

        {/* SUBNET SCANNER */}
        {showSubnetScanner && (
          <div className="p-4 rounded-2xl bg-[#141820] border border-indigo-500/30 flex flex-col gap-3 animate-fadeIn">
            <span className="text-xs font-bold text-white">Scan Local IP Subnet</span>
            <p className="text-[11px] text-gray-400">
              Probes port 6467 across 254 addresses in your Wi-Fi subnet range.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {['192.168.1', '192.168.0', '192.168.86', '10.0.0'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSubnetPrefix(preset);
                    handleScanSubnet(preset);
                  }}
                  disabled={isScanningSubnet}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                    subnetPrefix === preset
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#1a1e27] text-gray-300 hover:bg-[#252b38]'
                  }`}
                >
                  {preset}.x
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={subnetPrefix}
                onChange={(e) => setSubnetPrefix(e.target.value)}
                placeholder="192.168.1"
                className="flex-1 py-2 px-3 rounded-xl bg-[#1a1e27] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleScanSubnet()}
                disabled={isScanningSubnet || !subnetPrefix.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow"
              >
                {isScanningSubnet ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Scan Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* DISCOVERED TVS LIST */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Available Televisions ({discoveredTvs.length})</span>
            </span>
            <span className="text-[11px] text-gray-500 font-mono">
              Port 6467 / 6466
            </span>
          </div>

          {discoveredTvs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141820] border border-dashed border-white/10 text-center flex flex-col items-center gap-2.5">
              <Wifi className="w-8 h-8 text-gray-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-300">No TVs discovered yet</span>
              <p className="text-[11px] text-gray-400 max-w-[260px] leading-relaxed">
                Ensure your Google TV is powered on and connected to the same Wi-Fi. Tap <strong>Connect by IP</strong> above to connect directly.
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
                          {tv.isTestbed && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-500/30">
                              LOCAL TESTBED
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

