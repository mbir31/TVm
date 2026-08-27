/**
 * TVm Real-time TV Keyboard & IME Input Mode
 * Sends text, characters, backspaces, and search queries directly to active TV input fields.
 */

import React, { useState } from 'react';
import { Send, Delete, CornerDownLeft, Search, Sparkles, ArrowLeft, RotateCcw } from 'lucide-react';
import { AndroidKeyCode, KeyDirection } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface KeyboardModeProps {
  onSendText: (text: string) => void;
  onSendKey: (keyCode: AndroidKeyCode, direction?: KeyDirection) => void;
  hapticsEnabled: boolean;
}

const QUICK_PHRASES = [
  'YouTube 4K',
  'Netflix Movies',
  'Action Sci-Fi',
  'Spotify Chill',
  'Top 10 Documentaries',
  '@gmail.com',
  '1234',
];

export const KeyboardMode: React.FC<KeyboardModeProps> = ({ onSendText, onSendKey, hapticsEnabled }) => {
  const [inputText, setInputText] = useState('');
  const [history, setHistory] = useState<string[]>(['Search Movie', 'password123']);

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (hapticsEnabled) haptics.trigger('medium');

    onSendText(inputText);

    setHistory((prev) => [inputText, ...prev.filter((h) => h !== inputText)].slice(0, 8));
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER);
    }
  };

  const handleBackspace = () => {
    if (hapticsEnabled) haptics.trigger('light');
    if (inputText.length > 0) {
      setInputText(inputText.slice(0, -1));
    }
    // Also send actual backspace key to TV
    onSendKey(AndroidKeyCode.KEYCODE_DEL);
  };

  const handleQuickPhrase = (phrase: string) => {
    if (hapticsEnabled) haptics.trigger('light');
    setInputText(phrase);
  };

  return (
    <div className="w-full max-w-[400px] mx-auto flex flex-col gap-4">
      {/* Active TV Input Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-b from-[#222733] to-[#161a23] border border-white/10 shadow-xl flex flex-col gap-3">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
          <span>TV Text Input</span>
          <span className="text-[10px] text-blue-400 font-mono">Live IME Sync</span>
        </label>

        {/* Input Box */}
        <div className="relative flex items-center">
          <input
            id="input-tvm-text"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type text or search query..."
            className="w-full py-3.5 pl-4 pr-12 rounded-2xl bg-[#11141b] border border-white/10 text-white placeholder-gray-500 font-sans text-sm focus:outline-none focus:border-blue-500 shadow-inner"
            autoFocus
          />
          {inputText && (
            <button
              type="button"
              onClick={() => setInputText('')}
              className="absolute right-3 text-xs text-gray-400 hover:text-white px-1.5 py-1 rounded bg-white/5"
            >
              Clear
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            id="btn-tvm-send-text"
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Send to TV</span>
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="py-3 px-3 rounded-xl bg-[#2a3140] hover:bg-[#343d4f] text-gray-200 font-semibold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 border border-white/5"
          >
            <Delete className="w-4 h-4 text-rose-400" />
            <span>Backspace</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (hapticsEnabled) haptics.trigger('light');
              onSendKey(AndroidKeyCode.KEYCODE_DPAD_CENTER);
            }}
            className="py-3 px-3 rounded-xl bg-[#2a3140] hover:bg-[#343d4f] text-gray-200 font-semibold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 border border-white/5"
          >
            <CornerDownLeft className="w-4 h-4 text-emerald-400" />
            <span>Enter / Search</span>
          </button>
        </div>
      </div>

      {/* Quick Text Suggestions */}
      <div className="p-4 rounded-2xl bg-[#171a22] border border-white/5 flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Phrases</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => handleQuickPhrase(phrase)}
              className="py-1.5 px-3 rounded-lg bg-[#222733] hover:bg-[#2c3343] text-gray-300 text-xs border border-white/5 active:scale-95 transition-all shadow-sm"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Entries */}
      {history.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#171a22] border border-white/5 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-gray-400">Recent Text History</span>
          <div className="flex flex-col gap-1.5">
            {history.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleQuickPhrase(item)}
                className="py-2 px-3 rounded-xl bg-[#1f2430] hover:bg-[#272d3c] text-gray-300 text-xs flex items-center justify-between cursor-pointer border border-white/5"
              >
                <span className="truncate">{item}</span>
                <span className="text-[10px] text-blue-400 font-semibold">Use</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
