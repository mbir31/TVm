/**
 * TVm 3D Skeuomorphic Physical Remote Control Component
 * High-end physical remote design with realistic tactile button compression,
 * metallic chassis, LED connection indicator, D-Pad disc, volume/channel rockers, and app shortcuts.
 */

import React, { useState } from 'react';
import {
  Power,
  Tv,
  Volume2,
  VolumeX,
  Settings,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ArrowLeft,
  Mic,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Menu,
  Info,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';
import { AndroidKeyCode, ConnectionState, KeyDirection, TVDevice, UserSettings } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface PhysicalRemoteProps {
  connectionState: ConnectionState;
  activeTv: TVDevice | null;
  settings: UserSettings;
  onSendKey: (keyCode: AndroidKeyCode, direction?: KeyDirection) => void;
  onAdjustVolume: (direction: 'UP' | 'DOWN' | 'MUTE') => void;
  onLaunchApp: (appLink: string) => void;
  onOpenVoice: () => void;
  onOpenTouchpad: () => void;
  onOpenAirMouse: () => void;
}

export const PhysicalRemote3D: React.FC<PhysicalRemoteProps> = ({
  connectionState,
  activeTv,
  settings,
  onSendKey,
  onAdjustVolume,
  onLaunchApp,
  onOpenVoice,
  onOpenTouchpad,
  onOpenAirMouse,
}) => {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const handlePress = (keyId: string, action: () => void) => {
    setPressedKey(keyId);
    if (settings.hapticsEnabled) {
      haptics.trigger('light');
    }
    action();
    setTimeout(() => {
      setPressedKey(null);
    }, 120);
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isPairingOrReconnecting =
    connectionState === ConnectionState.PAIRING ||
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.RECONNECTING ||
    connectionState === ConnectionState.PAIRING_CODE_REQUIRED;

  return (
    <div
      id="tvm-physical-remote-body"
      className="relative mx-auto w-full max-w-[360px] rounded-[44px] p-6 sm:p-7 select-none transition-all duration-300 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_2px_rgba(255,255,255,0.25)] bg-gradient-to-b from-[#242933] via-[#1a1e27] to-[#12151c] text-white border border-[#374151]/50"
    >
      {/* Gloss reflection overlay */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent rounded-t-[40px] opacity-40" />

      {/* TOP HEADER: IR Emitter & Connection LED */}
      <div className="flex items-center justify-between mb-6 px-1">
        {/* IR Window */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12151c] border border-white/10 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-red-600/80 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          <span className="text-[10px] font-mono tracking-widest text-gray-400 font-semibold uppercase">IR/WIFI</span>
        </div>

        {/* Brand */}
        <span className="text-xs font-bold tracking-[0.25em] text-gray-300/80 font-sans uppercase">
          TVm
        </span>

        {/* LED Connection Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#12151c] border border-white/10 shadow-inner">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              isConnected
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse'
                : isPairingOrReconnecting
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-bounce'
                : 'bg-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.6)]'
            }`}
          />
          <span className="text-[10px] font-mono text-gray-300 font-medium">
            {isConnected ? 'ONLINE' : isPairingOrReconnecting ? 'SYNC' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* TOP ROW: Power, TV Input, Mute, Settings */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {/* Power Button */}
        <button
          id="btn-remote-power"
          type="button"
          onClick={() => handlePress('power', () => onSendKey(AndroidKeyCode.KEYCODE_POWER))}
          className={`flex flex-col items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-rose-900/60 to-rose-950/90 text-rose-300 border border-rose-700/50 shadow-[0_4px_10px_rgba(225,29,72,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)] ${
            pressedKey === 'power' ? 'translate-y-1 shadow-inner brightness-125' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="TV Power"
        >
          <Power className="w-5 h-5 drop-shadow" />
        </button>

        {/* Source/Input */}
        <button
          id="btn-remote-input"
          type="button"
          onClick={() => handlePress('input', () => onSendKey(AndroidKeyCode.KEYCODE_TV_INPUT))}
          className={`flex flex-col items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-[#2e3646] to-[#1e232e] text-gray-300 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] ${
            pressedKey === 'input' ? 'translate-y-1 shadow-inner' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="TV Input / Source"
        >
          <Tv className="w-5 h-5" />
          <span className="text-[9px] font-semibold tracking-wider text-gray-400 mt-0.5">INPUT</span>
        </button>

        {/* Mute */}
        <button
          id="btn-remote-mute"
          type="button"
          onClick={() => handlePress('mute', () => onAdjustVolume('MUTE'))}
          className={`flex flex-col items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-[#2e3646] to-[#1e232e] text-gray-300 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] ${
            pressedKey === 'mute' ? 'translate-y-1 shadow-inner' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="Mute Audio"
        >
          <VolumeX className="w-5 h-5" />
          <span className="text-[9px] font-semibold tracking-wider text-gray-400 mt-0.5">MUTE</span>
        </button>

        {/* Settings */}
        <button
          id="btn-remote-settings"
          type="button"
          onClick={() => handlePress('settings', () => onSendKey(AndroidKeyCode.KEYCODE_SETTINGS))}
          className={`flex flex-col items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-[#2e3646] to-[#1e232e] text-gray-300 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] ${
            pressedKey === 'settings' ? 'translate-y-1 shadow-inner' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="TV Settings"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[9px] font-semibold tracking-wider text-gray-400 mt-0.5">CONFIG</span>
        </button>
      </div>

      {/* QUICK MODE SWITCHERS (Touchpad, Air Mouse, Voice) */}
      <div className="grid grid-cols-3 gap-2 mb-6 p-1.5 rounded-2xl bg-[#13161e] border border-white/5 shadow-inner">
        <button
          id="btn-quick-touchpad"
          type="button"
          onClick={onOpenTouchpad}
          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1f2430] hover:bg-[#282e3d] transition-colors shadow-sm"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span>Touchpad</span>
        </button>
        <button
          id="btn-quick-airmouse"
          type="button"
          onClick={onOpenAirMouse}
          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1f2430] hover:bg-[#282e3d] transition-colors shadow-sm"
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>Air Mouse</span>
        </button>
        <button
          id="btn-quick-voice"
          type="button"
          onClick={onOpenVoice}
          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1f2430] hover:bg-[#282e3d] transition-colors shadow-sm"
        >
          <Mic className="w-3.5 h-3.5 text-rose-400" />
          <span>Voice</span>
        </button>
      </div>

      {/* 3D DIRECTIONAL DISC (D-PAD) */}
      <div className="relative mx-auto w-52 h-52 mb-6 flex items-center justify-center">
        {/* Outer Ring Bezel */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#343d4f] via-[#202530] to-[#151821] p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.25)] border border-white/10">
          <div className="w-full h-full rounded-full bg-[#1b1f29] shadow-inner relative">
            {/* UP BUTTON */}
            <button
              id="btn-dpad-up"
              type="button"
              onClick={() => handlePress('up', () => onSendKey(AndroidKeyCode.KEYCODE_DPAD_UP))}
              className={`absolute top-1 left-1/2 -translate-x-1/2 w-20 h-14 flex items-start justify-center pt-2 rounded-t-full text-gray-300 transition-transform ${
                pressedKey === 'up' ? 'scale-95 text-white' : 'hover:text-white active:scale-95'
              }`}
              title="D-Pad Up"
            >
              <ChevronUp className="w-7 h-7 drop-shadow" />
            </button>

            {/* DOWN BUTTON */}
            <button
              id="btn-dpad-down"
              type="button"
              onClick={() => handlePress('down', () => onSendKey(AndroidKeyCode.KEYCODE_DPAD_DOWN))}
              className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-14 flex items-end justify-center pb-2 rounded-b-full text-gray-300 transition-transform ${
                pressedKey === 'down' ? 'scale-95 text-white' : 'hover:text-white active:scale-95'
              }`}
              title="D-Pad Down"
            >
              <ChevronDown className="w-7 h-7 drop-shadow" />
            </button>

            {/* LEFT BUTTON */}
            <button
              id="btn-dpad-left"
              type="button"
              onClick={() => handlePress('left', () => onSendKey(AndroidKeyCode.KEYCODE_DPAD_LEFT))}
              className={`absolute left-1 top-1/2 -translate-y-1/2 w-14 h-20 flex items-center justify-start pl-2 rounded-l-full text-gray-300 transition-transform ${
                pressedKey === 'left' ? 'scale-95 text-white' : 'hover:text-white active:scale-95'
              }`}
              title="D-Pad Left"
            >
              <ChevronLeft className="w-7 h-7 drop-shadow" />
            </button>

            {/* RIGHT BUTTON */}
            <button
              id="btn-dpad-right"
              type="button"
              onClick={() => handlePress('right', () => onSendKey(AndroidKeyCode.KEYCODE_DPAD_RIGHT))}
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-14 h-20 flex items-center justify-end pr-2 rounded-r-full text-gray-300 transition-transform ${
                pressedKey === 'right' ? 'scale-95 text-white' : 'hover:text-white active:scale-95'
              }`}
              title="D-Pad Right"
            >
              <ChevronRight className="w-7 h-7 drop-shadow" />
            </button>
          </div>
        </div>

        {/* CENTER OK / SELECT BUTTON */}
        <button
          id="btn-dpad-ok"
          type="button"
          onClick={() => handlePress('ok', () => onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER))}
          className={`relative z-10 w-22 h-22 rounded-full transition-all duration-100 flex items-center justify-center font-bold text-sm tracking-wider text-white bg-gradient-to-b from-[#3d475a] to-[#252c38] border border-white/20 shadow-[0_8px_18px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.3)] ${
            pressedKey === 'ok'
              ? 'translate-y-1 scale-95 shadow-inner bg-gradient-to-b from-[#202530] to-[#171b23]'
              : 'hover:brightness-110 active:translate-y-0.5 active:scale-95'
          }`}
          title="OK / Select"
        >
          <span className="drop-shadow-md">OK</span>
        </button>
      </div>

      {/* PRIMARY NAVIGATION ROW: Back, Google Assistant, Home */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Back */}
        <button
          id="btn-nav-back"
          type="button"
          onClick={() => handlePress('back', () => onSendKey(AndroidKeyCode.KEYCODE_BACK))}
          className={`flex items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-[#2c3342] to-[#1c212b] text-gray-200 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] ${
            pressedKey === 'back' ? 'translate-y-1 shadow-inner' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Assistant / Voice Key */}
        <button
          id="btn-nav-assistant"
          type="button"
          onClick={() => handlePress('assist', () => onSendKey(AndroidKeyCode.KEYCODE_VOICE_ASSIST))}
          className={`flex items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-blue-900/60 to-indigo-950/80 text-blue-300 border border-blue-600/40 shadow-[0_4px_10px_rgba(59,130,246,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] ${
            pressedKey === 'assist' ? 'translate-y-1 shadow-inner' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="Google Assistant"
        >
          <Mic className="w-5 h-5 drop-shadow" />
        </button>

        {/* Home */}
        <button
          id="btn-nav-home"
          type="button"
          onClick={() => handlePress('home', () => onSendKey(AndroidKeyCode.KEYCODE_HOME))}
          className={`flex items-center justify-center h-13 rounded-2xl transition-all duration-100 bg-gradient-to-b from-[#2c3342] to-[#1c212b] text-gray-200 border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] ${
            pressedKey === 'home' ? 'translate-y-1 shadow-inner' : 'hover:brightness-110 active:translate-y-0.5'
          }`}
          title="Home Screen"
        >
          <Home className="w-5 h-5" />
        </button>
      </div>

      {/* VOLUME & CHANNEL ROCKERS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Volume Rocker */}
        <div className="flex flex-col items-center rounded-3xl p-1 bg-gradient-to-b from-[#2c3342] to-[#191d26] border border-white/10 shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
          <button
            id="btn-vol-up"
            type="button"
            onClick={() => handlePress('vol_up', () => onAdjustVolume('UP'))}
            className={`w-full py-3 flex items-center justify-center rounded-t-2xl text-gray-200 transition-all ${
              pressedKey === 'vol_up' ? 'bg-white/10 text-white translate-y-0.5' : 'hover:bg-white/5 active:translate-y-0.5'
            }`}
            title="Volume Up"
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <div className="w-full py-1 text-center">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">VOL</span>
          </div>
          <button
            id="btn-vol-down"
            type="button"
            onClick={() => handlePress('vol_down', () => onAdjustVolume('DOWN'))}
            className={`w-full py-3 flex items-center justify-center rounded-b-2xl text-gray-200 transition-all ${
              pressedKey === 'vol_down' ? 'bg-white/10 text-white translate-y-0.5' : 'hover:bg-white/5 active:translate-y-0.5'
            }`}
            title="Volume Down"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Rocker */}
        <div className="flex flex-col items-center rounded-3xl p-1 bg-gradient-to-b from-[#2c3342] to-[#191d26] border border-white/10 shadow-[0_6px_14px_rgba(0,0,0,0.4)]">
          <button
            id="btn-ch-up"
            type="button"
            onClick={() => handlePress('ch_up', () => onSendKey(AndroidKeyCode.KEYCODE_CHANNEL_UP))}
            className={`w-full py-3 flex items-center justify-center rounded-t-2xl text-gray-200 transition-all ${
              pressedKey === 'ch_up' ? 'bg-white/10 text-white translate-y-0.5' : 'hover:bg-white/5 active:translate-y-0.5'
            }`}
            title="Channel Up"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <div className="w-full py-1 text-center">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">CH</span>
          </div>
          <button
            id="btn-ch-down"
            type="button"
            onClick={() => handlePress('ch_down', () => onSendKey(AndroidKeyCode.KEYCODE_CHANNEL_DOWN))}
            className={`w-full py-3 flex items-center justify-center rounded-b-2xl text-gray-200 transition-all ${
              pressedKey === 'ch_down' ? 'bg-white/10 text-white translate-y-0.5' : 'hover:bg-white/5 active:translate-y-0.5'
            }`}
            title="Channel Down"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MEDIA CONTROLS ROW */}
      <div className="flex items-center justify-between gap-2 mb-6 px-1">
        <button
          id="btn-media-rewind"
          type="button"
          onClick={() => handlePress('rewind', () => onSendKey(AndroidKeyCode.KEYCODE_MEDIA_REWIND))}
          className={`p-2.5 rounded-xl bg-[#202530] text-gray-300 border border-white/5 shadow hover:text-white transition-transform ${
            pressedKey === 'rewind' ? 'scale-90' : 'active:scale-90'
          }`}
          title="Rewind"
        >
          <Rewind className="w-4 h-4" />
        </button>

        <button
          id="btn-media-play-pause"
          type="button"
          onClick={() =>
            handlePress('play_pause', () => {
              setIsPlaying(!isPlaying);
              onSendKey(AndroidKeyCode.KEYCODE_MEDIA_PLAY_PAUSE);
            })
          }
          className={`px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#343d4f] to-[#202530] text-white border border-white/15 shadow-md flex items-center justify-center transition-transform ${
            pressedKey === 'play_pause' ? 'scale-90' : 'active:scale-90'
          }`}
          title="Play / Pause"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        <button
          id="btn-media-forward"
          type="button"
          onClick={() => handlePress('forward', () => onSendKey(AndroidKeyCode.KEYCODE_MEDIA_FAST_FORWARD))}
          className={`p-2.5 rounded-xl bg-[#202530] text-gray-300 border border-white/5 shadow hover:text-white transition-transform ${
            pressedKey === 'forward' ? 'scale-90' : 'active:scale-90'
          }`}
          title="Fast Forward"
        >
          <FastForward className="w-4 h-4" />
        </button>

        <button
          id="btn-media-guide"
          type="button"
          onClick={() => handlePress('guide', () => onSendKey(AndroidKeyCode.KEYCODE_GUIDE))}
          className={`p-2.5 rounded-xl bg-[#202530] text-gray-300 border border-white/5 shadow hover:text-white transition-transform ${
            pressedKey === 'guide' ? 'scale-90' : 'active:scale-90'
          }`}
          title="TV Guide"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* COLOR BUTTONS (Red, Green, Yellow, Blue) */}
      <div className="grid grid-cols-4 gap-2 mb-6 px-1">
        <button
          id="btn-color-red"
          type="button"
          onClick={() => handlePress('red', () => onSendKey(AndroidKeyCode.KEYCODE_PROG_RED))}
          className="h-3 rounded-full bg-red-600 shadow-[0_2px_6px_rgba(220,38,38,0.6)] hover:brightness-125 active:scale-95 transition-all"
          title="Red Action"
        />
        <button
          id="btn-color-green"
          type="button"
          onClick={() => handlePress('green', () => onSendKey(AndroidKeyCode.KEYCODE_PROG_GREEN))}
          className="h-3 rounded-full bg-emerald-500 shadow-[0_2px_6px_rgba(16,185,129,0.6)] hover:brightness-125 active:scale-95 transition-all"
          title="Green Action"
        />
        <button
          id="btn-color-yellow"
          type="button"
          onClick={() => handlePress('yellow', () => onSendKey(AndroidKeyCode.KEYCODE_PROG_YELLOW))}
          className="h-3 rounded-full bg-amber-400 shadow-[0_2px_6px_rgba(251,191,36,0.6)] hover:brightness-125 active:scale-95 transition-all"
          title="Yellow Action"
        />
        <button
          id="btn-color-blue"
          type="button"
          onClick={() => handlePress('blue', () => onSendKey(AndroidKeyCode.KEYCODE_PROG_BLUE))}
          className="h-3 rounded-full bg-blue-500 shadow-[0_2px_6px_rgba(59,130,246,0.6)] hover:brightness-125 active:scale-95 transition-all"
          title="Blue Action"
        />
      </div>

      {/* HARDWARE APP SHORTCUT BUTTONS */}
      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
        <button
          id="btn-app-youtube"
          type="button"
          onClick={() => handlePress('app_yt', () => onLaunchApp('https://www.youtube.com'))}
          className="py-2.5 px-3 rounded-xl bg-[#191d26] hover:bg-[#202530] border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" />
          <span>YouTube</span>
        </button>

        <button
          id="btn-app-netflix"
          type="button"
          onClick={() => handlePress('app_netflix', () => onLaunchApp('https://www.netflix.com/watch'))}
          className="py-2.5 px-3 rounded-xl bg-[#191d26] hover:bg-[#202530] border border-white/10 text-red-500 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
        >
          <span>NETFLIX</span>
        </button>

        <button
          id="btn-app-prime"
          type="button"
          onClick={() => handlePress('app_prime', () => onLaunchApp('https://app.primevideo.com'))}
          className="py-2.5 px-3 rounded-xl bg-[#191d26] hover:bg-[#202530] border border-white/10 text-sky-400 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
        >
          <span>Prime Video</span>
        </button>

        <button
          id="btn-app-disney"
          type="button"
          onClick={() => handlePress('app_disney', () => onLaunchApp('https://app.disneyplus.com'))}
          className="py-2.5 px-3 rounded-xl bg-[#191d26] hover:bg-[#202530] border border-white/10 text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all"
        >
          <span>Disney+</span>
        </button>
      </div>

      {/* REMOTE BOTTOM LOGO BADGE */}
      <div className="flex items-center justify-center gap-1.5 pt-3 pb-1 opacity-70 hover:opacity-100 transition-opacity">
        <img
          src="/logo.png"
          alt="TVm"
          className="w-4 h-4 rounded object-cover shadow-sm"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
        <span className="text-[10px] font-mono tracking-widest text-gray-400 font-bold uppercase">
          TV<span className="text-blue-500">m</span> REMOTE
        </span>
      </div>
    </div>
  );
};
