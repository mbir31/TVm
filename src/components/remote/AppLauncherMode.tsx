/**
 * TVm Application Launcher Mode
 * Launches Android TV / Google TV applications and deep links directly on the TV.
 */

import React, { useState } from 'react';
import { Search, ExternalLink, Play, Sparkles, Tv, Layers } from 'lucide-react';
import { TVAppItem } from '../../types';
import { haptics } from '../../services/haptics-engine';

interface AppLauncherModeProps {
  onLaunchApp: (appLink: string) => void;
  hapticsEnabled: boolean;
}

const APPS_CATALOG: TVAppItem[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    packageName: 'com.google.android.youtube.tv',
    deepLink: 'https://www.youtube.com',
    iconBg: 'bg-red-600',
    category: 'Video',
    isPopular: true,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    packageName: 'com.netflix.ninja',
    deepLink: 'https://www.netflix.com/watch',
    iconBg: 'bg-black text-red-600 border border-red-600/30',
    category: 'Movies',
    isPopular: true,
  },
  {
    id: 'prime',
    name: 'Prime Video',
    packageName: 'com.amazon.amazonvideo.livingroom',
    deepLink: 'https://app.primevideo.com',
    iconBg: 'bg-sky-600',
    category: 'Movies',
    isPopular: true,
  },
  {
    id: 'disney',
    name: 'Disney+',
    packageName: 'com.disney.disneyplus',
    deepLink: 'https://app.disneyplus.com',
    iconBg: 'bg-blue-900',
    category: 'Movies',
    isPopular: true,
  },
  {
    id: 'spotify',
    name: 'Spotify',
    packageName: 'com.spotify.tv.android',
    deepLink: 'https://open.spotify.com',
    iconBg: 'bg-emerald-600',
    category: 'Music',
    isPopular: true,
  },
  {
    id: 'max',
    name: 'Max / HBO',
    packageName: 'com.wbd.stream',
    deepLink: 'https://play.max.com',
    iconBg: 'bg-indigo-950 border border-indigo-500/40',
    category: 'Movies',
  },
  {
    id: 'plex',
    name: 'Plex Media',
    packageName: 'com.plexapp.android',
    deepLink: 'plex://',
    iconBg: 'bg-amber-600',
    category: 'Media Server',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    packageName: 'tv.twitch.android.app',
    deepLink: 'https://www.twitch.tv',
    iconBg: 'bg-purple-600',
    category: 'Live',
  },
  {
    id: 'appletv',
    name: 'Apple TV',
    packageName: 'com.apple.atve.androidtv.appletv',
    deepLink: 'https://tv.apple.com',
    iconBg: 'bg-gray-900 border border-white/20',
    category: 'Movies',
  },
  {
    id: 'settings',
    name: 'TV Settings',
    packageName: 'com.android.tv.settings',
    deepLink: 'android.settings.SETTINGS',
    iconBg: 'bg-slate-700',
    category: 'System',
  },
];

export const AppLauncherMode: React.FC<AppLauncherModeProps> = ({ onLaunchApp, hapticsEnabled }) => {
  const [search, setSearch] = useState('');
  const [customLink, setCustomLink] = useState('');

  const filteredApps = APPS_CATALOG.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleLaunch = (app: TVAppItem) => {
    if (hapticsEnabled) haptics.trigger('medium');
    onLaunchApp(app.deepLink);
  };

  const handleCustomLaunch = () => {
    if (!customLink.trim()) return;
    if (hapticsEnabled) haptics.trigger('medium');
    onLaunchApp(customLink.trim());
    setCustomLink('');
  };

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4">
      {/* Search Filter */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search TV applications..."
          className="w-full py-3 pl-10 pr-4 rounded-2xl bg-[#1e232e] border border-white/10 text-white placeholder-gray-500 font-sans text-sm focus:outline-none focus:border-blue-500 shadow-inner"
        />
      </div>

      {/* Grid of Apps */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filteredApps.map((app) => (
          <button
            key={app.id}
            id={`btn-app-${app.id}`}
            type="button"
            onClick={() => handleLaunch(app)}
            className="p-3.5 rounded-2xl bg-[#1e232e] hover:bg-[#282f3d] border border-white/5 flex flex-col items-center gap-2.5 shadow-md active:scale-95 transition-all text-center group"
          >
            <div
              className={`w-12 h-12 rounded-xl ${app.iconBg} flex items-center justify-center font-bold text-white text-sm shadow-md group-hover:scale-105 transition-transform`}
            >
              {app.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-gray-200 group-hover:text-white truncate max-w-[100px]">
                {app.name}
              </span>
              <span className="text-[10px] text-gray-400">{app.category}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Deep-Link Launcher */}
      <div className="p-4 rounded-2xl bg-[#171a22] border border-white/5 flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
          <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          <span>Launch Custom Deep Link / Package</span>
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={customLink}
            onChange={(e) => setCustomLink(e.target.value)}
            placeholder="e.g. https://youtube.com or package.name"
            className="flex-1 py-2 px-3 rounded-xl bg-[#11141b] border border-white/10 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="button"
            onClick={handleCustomLaunch}
            disabled={!customLink.trim()}
            className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow transition-all active:scale-95"
          >
            Launch
          </button>
        </div>
      </div>
    </div>
  );
};
