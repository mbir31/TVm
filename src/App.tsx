/**
 * TVm: Premium Google TV & Android TV Control Center
 * Main Application Component
 */

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  Compass,
  Keyboard,
  Mic,
  Gamepad2,
  Layers,
  Terminal,
  Settings,
  ChevronDown,
  ShieldCheck,
  AlertCircle,
  Radio,
  Loader2,
} from 'lucide-react';
import {
  ActiveUIMode,
  AndroidKeyCode,
  ConnectionState,
  DiagnosticLog,
  KeyDirection,
  TVDevice,
  UserSettings,
} from './types';
import { bridgeClient } from './services/bridge-client';
import { StorageService } from './services/storage-service';
import { haptics } from './services/haptics-engine';

// Mode Components
import { PhysicalRemote3D } from './components/remote/PhysicalRemote3D';
import { TouchpadMode } from './components/remote/TouchpadMode';
import { AirMouseMode } from './components/remote/AirMouseMode';
import { KeyboardMode } from './components/remote/KeyboardMode';
import { VoiceMode } from './components/remote/VoiceMode';
import { GameControllerMode } from './components/remote/GameControllerMode';
import { AppLauncherMode } from './components/remote/AppLauncherMode';
import { DiagnosticsPanel } from './components/diagnostics/DiagnosticsPanel';

// Modals
import { TVManagerModal } from './components/tv-management/TVManagerModal';
import { SettingsModal } from './components/settings/SettingsModal';

export function App() {
  const [activeMode, setActiveMode] = useState<ActiveUIMode>('remote');
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [stateMessage, setStateMessage] = useState<string>('Initializing TVm...');
  const [activeTv, setActiveTv] = useState<TVDevice | null>(null);
  const [discoveredTvs, setDiscoveredTvs] = useState<TVDevice[]>([]);
  const [pairingPrompt, setPairingPrompt] = useState<{ tv: TVDevice; testbedPin?: string } | null>(null);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [settings, setSettings] = useState<UserSettings>(StorageService.getSettings());

  const [isTvManagerOpen, setIsTvManagerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  // Initialize and subscribe to Bridge Client
  useEffect(() => {
    haptics.setEnabled(settings.hapticsEnabled);

    // Initial status fetch
    bridgeClient.getStatus().then((status) => {
      setConnectionState(status.state);
      setStateMessage(status.stateMessage);
      setActiveTv(status.activeTv);
      setDiscoveredTvs(status.discoveredTvs);
    }).catch((err) => {
      console.warn('[TVm App] Bridge status query:', err);
    });

    // Fetch initial logs
    bridgeClient.getLogs().then(setLogs).catch(() => {});

    // Listen for PWA install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Subscribe to live WebSocket / bridge events
    const unsubscribe = bridgeClient.subscribe({
      onStateChange: (state, message, tv) => {
        setConnectionState(state);
        setStateMessage(message);
        if (tv !== undefined) setActiveTv(tv);
      },
      onTVDiscovered: (tv) => {
        setDiscoveredTvs((prev) => {
          const filtered = prev.filter((t) => t.id !== tv.id);
          return [...filtered, tv];
        });
      },
      onPinPrompt: (tv, testbedPin) => {
        setPairingPrompt({ tv, testbedPin });
        setIsTvManagerOpen(true);
        if (settings.hapticsEnabled) haptics.trigger('heavy');
      },
      onDiagnosticLog: (log) => {
        setLogs((prev) => [log, ...prev.slice(0, 199)]);
      },
      onPing: (latency) => {
        setLatencyMs(latency);
      },
    });

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleUpdateSettings = (updated: Partial<UserSettings>) => {
    const next = { ...settings, ...updated };
    setSettings(next);
    StorageService.saveSettings(next);
  };

  const handleInstallPwa = () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then(() => setInstallPromptEvent(null));
    }
  };

  // Command dispatchers
  const handleSendKey = (keyCode: AndroidKeyCode, direction: KeyDirection = KeyDirection.SHORT) => {
    bridgeClient.sendKey(keyCode, direction);
  };

  const handleAdjustVolume = (direction: 'UP' | 'DOWN' | 'MUTE') => {
    bridgeClient.adjustVolume(direction);
  };

  const handleSendText = (text: string) => {
    bridgeClient.sendText(text);
  };

  const handleLaunchApp = (appLink: string) => {
    bridgeClient.launchApp(appLink);
  };

  const handleSendMotion = (payload: { x: number; y: number; pitch?: number; roll?: number }) => {
    bridgeClient.sendMotion(payload);
  };

  const handleConnectTV = (tvId: string) => {
    bridgeClient.connectTV(tvId);
  };

  const handleSubmitPin = (pin: string) => {
    bridgeClient.submitPin(pin);
    setPairingPrompt(null);
  };

  const handleAddManualTV = (ip: string, name?: string) => {
    bridgeClient.addManualTV(ip, name);
  };

  const handleForgetTV = (tvId: string) => {
    bridgeClient.forgetTV(tvId);
    setDiscoveredTvs((prev) => prev.map((t) => (t.id === tvId ? { ...t, isPaired: false } : t)));
  };

  const handleDisconnect = () => {
    bridgeClient.disconnect();
  };

  const handleClearLogs = () => {
    bridgeClient.clearLogs();
    setLogs([]);
  };

  const handleTestConnection = async () => {
    return bridgeClient.testConnection();
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isSyncing =
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.PAIRING ||
    connectionState === ConnectionState.RECONNECTING ||
    connectionState === ConnectionState.PAIRING_CODE_REQUIRED;

  return (
    <div className="min-h-screen bg-[#0d1017] text-gray-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* ================= TOP APPLICATION HEADER ================= */}
      <header className="sticky top-0 z-40 bg-[#161a23]/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1e2430] flex items-center justify-center shadow-lg border border-white/20 overflow-hidden shrink-0">
              <img
                src="/logo.png"
                alt="TVm Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to icon if logo load fails
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                  if (fallback) (fallback as HTMLElement).style.display = 'block';
                }}
              />
              <Tv className="fallback-icon w-5 h-5 text-blue-400 hidden" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider text-white uppercase leading-tight font-mono">
                TV<span className="text-blue-500">m</span>
              </span>
              <span className="text-[10px] font-medium text-gray-400">Control Center</span>
            </div>
          </div>

          {/* Active TV Connection Indicator Pill (Click opens TV Manager) */}
          <button
            id="btn-header-tv-status"
            type="button"
            onClick={() => {
              if (settings.hapticsEnabled) haptics.trigger('light');
              setIsTvManagerOpen(true);
            }}
            className={`relative overflow-hidden py-1.5 px-3 rounded-full border transition-all flex items-center gap-2 shadow-sm text-xs font-semibold max-w-[240px] truncate ${
              isConnected
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                : isSyncing
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/50'
                : 'bg-[#1f2430] border-white/10 text-gray-300 hover:bg-[#282f3f]'
            }`}
            title={activeTv ? `${activeTv.name} (${connectionState})` : 'Select TV'}
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            ) : (
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : 'bg-rose-500'
                }`}
              />
            )}
            <span className="truncate">
              {isSyncing
                ? activeTv
                  ? `${activeTv.name} (${connectionState === ConnectionState.PAIRING ? 'Pairing' : connectionState === ConnectionState.PAIRING_CODE_REQUIRED ? 'PIN' : 'Connecting'})`
                  : connectionState === ConnectionState.PAIRING
                  ? 'Pairing TV...'
                  : connectionState === ConnectionState.PAIRING_CODE_REQUIRED
                  ? 'PIN Required'
                  : 'Connecting...'
                : activeTv?.name || 'Select TV'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />

            {/* Embedded Progress Bar for Connecting / Pairing State */}
            {isSyncing && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-950 overflow-hidden">
                <div className="h-full w-1/2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 rounded-full animate-progress-indeterminate shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
              </div>
            )}
          </button>

          {/* Header Action Icons */}
          <div className="flex items-center gap-1.5">
            <button
              id="btn-header-tv-manager"
              type="button"
              onClick={() => setIsTvManagerOpen(true)}
              className="p-2 rounded-xl bg-[#1e232e] hover:bg-[#282f3e] text-gray-300 hover:text-white border border-white/5 transition-colors shadow-sm"
              title="Discovered Televisions"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              id="btn-header-settings"
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-[#1e232e] hover:bg-[#282f3e] text-gray-300 hover:text-white border border-white/5 transition-colors shadow-sm"
              title="Settings & Preferences"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MODE SWITCHER NAVIGATION TABS */}
        <div className="max-w-4xl mx-auto mt-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#11141b] border border-white/5 min-w-max">
            <button
              id="tab-mode-remote"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('remote');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'remote'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>3D Remote</span>
            </button>

            <button
              id="tab-mode-touchpad"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('touchpad');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'touchpad'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
              <span>Touchpad</span>
            </button>

            <button
              id="tab-mode-airmouse"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('airmouse');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'airmouse'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Air Mouse</span>
            </button>

            <button
              id="tab-mode-keyboard"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('keyboard');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'keyboard'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-400" />
              <span>Keyboard</span>
            </button>

            <button
              id="tab-mode-voice"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('voice');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'voice'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-rose-400" />
              <span>Voice</span>
            </button>

            <button
              id="tab-mode-gamepad"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('gamepad');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'gamepad'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gamepad</span>
            </button>

            <button
              id="tab-mode-apps"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('apps');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'apps'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Apps</span>
            </button>

            <button
              id="tab-mode-diagnostics"
              type="button"
              onClick={() => {
                if (settings.hapticsEnabled) haptics.trigger('light');
                setActiveMode('diagnostics');
              }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'diagnostics'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-gray-300" />
              <span>Inspector</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT SURFACE ================= */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center items-center">
        {/* Disconnection Warning Banner if user tries sending key while offline */}
        {!isConnected && !isSyncing && (
          <div className="w-full max-w-[360px] mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-950/60 to-[#181d28] border border-blue-500/30 flex items-center justify-between gap-2 shadow animate-fadeIn">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs text-gray-300 font-medium">Ready to connect with TV</span>
            </div>
            <button
              type="button"
              onClick={() => setIsTvManagerOpen(true)}
              className="py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow"
            >
              Connect
            </button>
          </div>
        )}

        {/* RENDER ACTIVE MODE */}
        {activeMode === 'remote' && (
          <PhysicalRemote3D
            connectionState={connectionState}
            activeTv={activeTv}
            settings={settings}
            onSendKey={handleSendKey}
            onAdjustVolume={handleAdjustVolume}
            onLaunchApp={handleLaunchApp}
            onOpenVoice={() => setActiveMode('voice')}
            onOpenTouchpad={() => setActiveMode('touchpad')}
            onOpenAirMouse={() => setActiveMode('airmouse')}
          />
        )}

        {activeMode === 'touchpad' && (
          <TouchpadMode
            onSendKey={handleSendKey}
            onAdjustVolume={handleAdjustVolume}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {activeMode === 'airmouse' && (
          <AirMouseMode
            onSendKey={handleSendKey}
            onSendMotion={handleSendMotion}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {activeMode === 'keyboard' && (
          <KeyboardMode
            onSendText={handleSendText}
            onSendKey={handleSendKey}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {activeMode === 'voice' && (
          <VoiceMode
            onSendText={handleSendText}
            onSendKey={handleSendKey}
            onLaunchApp={handleLaunchApp}
            onAdjustVolume={handleAdjustVolume}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {activeMode === 'gamepad' && (
          <GameControllerMode
            onSendKey={handleSendKey}
            onSendMotion={handleSendMotion}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {activeMode === 'apps' && (
          <AppLauncherMode
            onLaunchApp={handleLaunchApp}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {activeMode === 'diagnostics' && (
          <DiagnosticsPanel
            logs={logs}
            activeTv={activeTv}
            connectionState={connectionState}
            stateMessage={stateMessage}
            latencyMs={latencyMs}
            onClearLogs={handleClearLogs}
            onTestConnection={handleTestConnection}
          />
        )}
      </main>

      {/* ================= FOOTER CREDITS ================= */}
      <footer className="w-full py-4 px-4 border-t border-white/5 bg-[#11141b]/80 backdrop-blur-sm text-center">
        <p className="text-xs text-gray-400 font-medium tracking-wide flex items-center justify-center gap-1.5">
          <span>Made with</span>
          <span className="text-rose-500 animate-pulse inline-block">♥</span>
          <span>by</span>
          <span className="text-gray-200 font-semibold hover:text-white transition-colors">
            ©munabbiRMushran🇧🇩
          </span>
        </p>
      </footer>

      {/* ================= MODALS ================= */}
      <TVManagerModal
        isOpen={isTvManagerOpen}
        onClose={() => setIsTvManagerOpen(false)}
        discoveredTvs={discoveredTvs}
        activeTv={activeTv}
        connectionState={connectionState}
        pairingPrompt={pairingPrompt}
        onConnectTV={handleConnectTV}
        onSubmitPin={handleSubmitPin}
        onAddManualTV={handleAddManualTV}
        onForgetTV={handleForgetTV}
        onDisconnect={handleDisconnect}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onInstallPwa={handleInstallPwa}
        canInstallPwa={!!installPromptEvent}
      />
    </div>
  );
}
export default App;
