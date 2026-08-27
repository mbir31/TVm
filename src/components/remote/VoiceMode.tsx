/**
 * TVm Voice Control & Dictation Mode
 * Live speech recognition with audio visualizer, real-time transcription,
 * and TV voice command execution.
 */

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Volume2, Sparkles, AlertCircle, Play, Home } from 'lucide-react';
import { voiceEngine, VoiceResult, VoiceState } from '../../services/voice-engine';
import { AndroidKeyCode, KeyDirection } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface VoiceModeProps {
  onSendText: (text: string) => void;
  onSendKey: (keyCode: AndroidKeyCode, direction?: KeyDirection) => void;
  onLaunchApp: (appLink: string) => void;
  onAdjustVolume: (direction: 'UP' | 'DOWN' | 'MUTE') => void;
  hapticsEnabled: boolean;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({
  onSendText,
  onSendKey,
  onLaunchApp,
  onAdjustVolume,
  hapticsEnabled,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      voiceEngine.stop();
    };
  }, []);

  const toggleListening = async () => {
    if (voiceState === 'listening') {
      if (hapticsEnabled) haptics.trigger('light');
      voiceEngine.stop();
      setVoiceState('idle');
    } else {
      if (hapticsEnabled) haptics.trigger('medium');
      setErrorMsg(null);
      setTranscript('');

      const started = await voiceEngine.startListening(
        (res: VoiceResult) => {
          setTranscript(res.transcript);
        },
        (st: VoiceState, err?: string) => {
          setVoiceState(st);
          if (err) setErrorMsg(err);
        },
        (level: number) => {
          setAudioLevel(level);
        }
      );

      if (!started) {
        setVoiceState('error');
      }
    }
  };

  const handleSendToTV = () => {
    if (!transcript.trim()) return;
    if (hapticsEnabled) haptics.trigger('medium');

    const clean = transcript.trim().toLowerCase();

    // Check for voice commands
    if (clean.includes('open youtube') || clean.includes('launch youtube')) {
      onLaunchApp('https://www.youtube.com');
    } else if (clean.includes('open netflix') || clean.includes('launch netflix')) {
      onLaunchApp('https://www.netflix.com/watch');
    } else if (clean.includes('volume up') || clean.includes('turn up')) {
      onAdjustVolume('UP');
    } else if (clean.includes('volume down') || clean.includes('turn down')) {
      onAdjustVolume('DOWN');
    } else if (clean.includes('mute') || clean.includes('silence')) {
      onAdjustVolume('MUTE');
    } else if (clean.includes('go home') || clean.includes('home screen')) {
      onSendKey(AndroidKeyCode.KEYCODE_HOME);
    } else {
      // Send as direct text to TV active search/input
      onSendText(transcript.trim());
      onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER);
    }

    voiceEngine.stop();
    setVoiceState('idle');
  };

  const handleQuickCommand = (cmd: string, action: () => void) => {
    if (hapticsEnabled) haptics.trigger('light');
    setTranscript(cmd);
    action();
  };

  return (
    <div className="w-full max-w-[400px] mx-auto flex flex-col gap-4">
      {/* Speech Visualizer & Microphone Button */}
      <div className="p-6 rounded-[32px] bg-gradient-to-b from-[#212632] via-[#171b23] to-[#11141b] border border-white/10 shadow-xl flex flex-col items-center justify-center gap-5 relative overflow-hidden">
        {/* Animated Sound Wave Rings */}
        {voiceState === 'listening' && (
          <>
            <div
              className="absolute w-44 h-44 rounded-full bg-rose-500/10 animate-ping"
              style={{ animationDuration: '2s' }}
            />
            <div
              className="absolute w-36 h-36 rounded-full border border-rose-500/30 transition-transform duration-75"
              style={{ transform: `scale(${1 + audioLevel * 0.8})` }}
            />
          </>
        )}

        {/* Central Mic Button */}
        <button
          id="btn-voice-mic-trigger"
          type="button"
          onClick={toggleListening}
          className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xl ${
            voiceState === 'listening'
              ? 'bg-rose-600 text-white shadow-[0_0_32px_rgba(225,29,72,0.8)] scale-105'
              : 'bg-gradient-to-b from-[#323a4b] to-[#1f242f] text-gray-200 hover:brightness-110 border border-white/15'
          }`}
        >
          {voiceState === 'listening' ? <Mic className="w-10 h-10 animate-pulse" /> : <MicOff className="w-10 h-10" />}
        </button>

        {/* State Label */}
        <div className="flex flex-col items-center gap-1 z-10">
          <span className="text-sm font-bold text-gray-200">
            {voiceState === 'listening' ? 'Listening to speech...' : 'Tap to Start Dictation'}
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            {voiceState === 'listening' ? 'Speak clearly into your phone microphone' : 'Web Speech Engine Ready'}
          </span>
        </div>

        {/* Dynamic Waveform Bars */}
        <div className="flex items-center gap-1 h-8 z-10">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                voiceState === 'listening' ? 'bg-rose-400' : 'bg-gray-700'
              }`}
              style={{
                height:
                  voiceState === 'listening'
                    ? `${Math.max(4, Math.sin(i + audioLevel * 5) * 24 * audioLevel + 12)}px`
                    : '4px',
              }}
            />
          ))}
        </div>
      </div>

      {/* Transcript Box */}
      {transcript && (
        <div className="p-4 rounded-2xl bg-[#1a1e27] border border-white/10 flex flex-col gap-3 shadow-lg animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Speech Transcript
            </span>
            <button
              type="button"
              onClick={() => setTranscript('')}
              className="text-[10px] text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <p className="text-sm text-gray-100 font-medium italic bg-[#11141b] p-3 rounded-xl border border-white/5">
            "{transcript}"
          </p>

          <button
            id="btn-voice-send-to-tv"
            type="button"
            onClick={handleSendToTV}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Send Dictation to TV</span>
          </button>
        </div>
      )}

      {/* Error Message if any */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quick Voice Command Chips */}
      <div className="p-4 rounded-2xl bg-[#171a22] border border-white/5 flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span>Popular Voice Commands</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleQuickCommand('Open YouTube', () => onLaunchApp('https://www.youtube.com'))}
            className="py-2 px-3 rounded-xl bg-[#202531] hover:bg-[#2a3140] text-gray-300 text-xs text-left border border-white/5 active:scale-95 transition-all truncate"
          >
            "Open YouTube"
          </button>

          <button
            type="button"
            onClick={() => handleQuickCommand('Open Netflix', () => onLaunchApp('https://www.netflix.com/watch'))}
            className="py-2 px-3 rounded-xl bg-[#202531] hover:bg-[#2a3140] text-gray-300 text-xs text-left border border-white/5 active:scale-95 transition-all truncate"
          >
            "Open Netflix"
          </button>

          <button
            type="button"
            onClick={() => handleQuickCommand('Search 4K Movies', () => {
              onSendText('4K Movies');
              onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER);
            })}
            className="py-2 px-3 rounded-xl bg-[#202531] hover:bg-[#2a3140] text-gray-300 text-xs text-left border border-white/5 active:scale-95 transition-all truncate"
          >
            "Search 4K Movies"
          </button>

          <button
            type="button"
            onClick={() => handleQuickCommand('Go Home', () => onSendKey(AndroidKeyCode.KEYCODE_HOME))}
            className="py-2 px-3 rounded-xl bg-[#202531] hover:bg-[#2a3140] text-gray-300 text-xs text-left border border-white/5 active:scale-95 transition-all truncate"
          >
            "Go Home"
          </button>
        </div>
      </div>
    </div>
  );
};
