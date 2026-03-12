import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, List, Lock, Play, ChevronRight, Clock, Tv } from 'lucide-react';
import { CapacitorHttp } from '@capacitor/core';
import { Channel, EPGProgram, AppSettings, ViewState } from './types';
import { translations } from './i18n';
import { parseM3U, DEFAULT_M3U_URL } from './utils/parser';
import { parseEPG } from './utils/epgParser';
import VideoPlayer from './components/VideoPlayer';
import SettingsPanel from './components/SettingsPanel';
import PasswordModal from './components/PasswordModal';
import MarqueeText from './components/MarqueeText';
import axios from 'axios';

const App: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [epg, setEpg] = useState<EPGProgram[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [viewState, setViewState] = useState<ViewState>('channelList');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [groupIndex, setGroupIndex] = useState(0);
  const [unlockedGroups, setUnlockedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detect API Base URL
  const API_BASE = useMemo(() => {
    // 预览环境：如果是 .run.app 结尾，使用相对路径
    if (window.location.hostname.includes('run.app')) return '';
    // 电视环境：强制指向云端
    return 'https://ais-dev-xzne2da2oxzmo2zwn7pq56-204444045691.asia-northeast1.run.app';
  }, []);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('hayate_settings');
    if (saved) return JSON.parse(saved);
    return {
      language: 'en',
      playlistMode: 'default',
      customPlaylistUrl: '',
      epgUrl: 'https://iptv-org.github.io/epg/guides/jp/skyperfectv.co.jp.xml',
      useInternetTime: true,
      timezone: 'UTC+09:00'
    };
  });

  const t = translations[settings.language];

  // Groups
  const groups = useMemo(() => {
    const g = Array.from(new Set(channels.map(c => c.group)));
    return g.length > 0 ? g : ['Default'];
  }, [channels]);

  useEffect(() => {
    if (!selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0]);
    }
  }, [groups, selectedGroup]);

  const filteredChannels = useMemo(() => {
    return channels.filter(c => c.group === selectedGroup);
  }, [channels, selectedGroup]);

  // Load Data
  const loadPlaylist = useCallback(async () => {
    const url = settings.playlistMode === 'default' ? DEFAULT_M3U_URL : settings.customPlaylistUrl;
    if (!url) return;

    console.log("loadPlaylist triggered (v3.4 - Native HTTP). URL:", url);
    setLoading(true);
    setError(null);

    try {
      // 在原生平台（电视端）直接请求，绕过代理和安全检查
      // 在浏览器预览时才使用代理
      const isNative = window.hasOwnProperty('Capacitor') && (window as any).Capacitor.isNativePlatform();
      const finalUrl = isNative
        ? url
        : `${API_BASE}/api/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`;

      console.log(`Fetching Playlist (Native: ${isNative}):`, finalUrl);

      // 使用 CapacitorHttp 绕过浏览器 CORS
      const options = {
        url: finalUrl,
        headers: { 'Accept': 'text/plain, */*' }
      };

      const response = await CapacitorHttp.get(options);

      if (response.status !== 200) throw new Error(`HTTP error! status: ${response.status}`);

      console.log("Native Response Data Type:", typeof response.data);

      // 确保 content 是字符串
      let content = '';
      if (typeof response.data === 'string') {
        content = response.data;
      } else if (response.data && typeof response.data === 'object') {
        console.log("Native Response Data keys:", Object.keys(response.data).slice(0, 10));
        content = JSON.stringify(response.data);
      }

      console.log("Playlist loaded successfully. Length:", content.length);
      console.log("Content Preview (First 500 chars):", content.substring(0, 500));
      const { channels: parsedChannels, epgUrl: detectedEpg } = parseM3U(content);
      console.log("Parsed channels count:", parsedChannels.length);
      setChannels(parsedChannels);

      if (detectedEpg && !settings.epgUrl) {
        console.log("Applying detected EPG URL to settings:", detectedEpg);
        setSettings(prev => {
          if (prev.epgUrl) {
            console.log("Settings already has EPG URL, skipping update:", prev.epgUrl);
            return prev;
          }
          return { ...prev, epgUrl: detectedEpg };
        });
      }
      setError(null);
    } catch (e) {
      console.error("Playlist Load Error:", e);
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [settings.playlistMode, settings.customPlaylistUrl, settings.epgUrl, t.error]);

  const loadEPG = useCallback(async () => {
    console.log("loadEPG called with URL (v3.4 - Native HTTP):", settings.epgUrl);
    if (!settings.epgUrl) {
      console.log("No EPG URL set");
      return;
    }
    try {
      const isNative = window.hasOwnProperty('Capacitor') && (window as any).Capacitor.isNativePlatform();
      const finalUrl = isNative
        ? settings.epgUrl
        : `${API_BASE}/api/proxy?url=${encodeURIComponent(settings.epgUrl)}&t=${Date.now()}`;

      console.log(`Fetching EPG (Native: ${isNative}):`, finalUrl);

      const options = {
        url: finalUrl,
        headers: { 'Accept': 'text/xml,application/xml' },
        connectTimeout: 30000, // 30s timeout for large EPG
        readTimeout: 30000
      };

      const response = await CapacitorHttp.get(options);
      console.log("EPG Response Status:", response.status);
      console.log("EPG Data Type:", typeof response.data);

      if (response.status === 200) {
        let content = '';
        if (typeof response.data === 'string') {
          content = response.data;
        } else if (response.data && typeof response.data === 'object') {
          content = JSON.stringify(response.data);
        }

        console.log("EPG Content Length:", content.length);
        if (content.length > 0) {
          console.log("Starting EPG parse...");
          const parsedEPG = parseEPG(content);
          console.log(`Parsed ${parsedEPG.length} EPG programs`);
          setEpg(parsedEPG);
        } else {
          console.warn("EPG content is empty");
        }
      } else {
        console.error("EPG fetch failed with status:", response.status);
      }
    } catch (e) {
      console.error("EPG Load Error:", e);
    }
  }, [settings.epgUrl, API_BASE]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => {
    loadEPG();
  }, [loadEPG]);

  useEffect(() => {
    if (epg.length > 0) {
      console.log(`EPG loaded: ${epg.length} programs`);
      const now = Date.now();
      const currentProgs = epg.filter(p => now >= p.start && now < p.stop);
      console.log(`Currently playing: ${currentProgs.length} programs`);
      if (currentProgs.length > 0) {
        console.log("Sample playing program:", currentProgs[0]);
      }
    }
  }, [epg]);

  // Remote Input Polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const options = {
          url: `${API_BASE}/api/remote-input/poll?t=${Date.now()}`
        };
        const res = await CapacitorHttp.get(options);
        if (res.data.timestamp > (Number(localStorage.getItem('last_remote_ts')) || 0)) {
          localStorage.setItem('last_remote_ts', res.data.timestamp.toString());
          setSettings(prev => ({
            ...prev,
            customPlaylistUrl: res.data.playlistUrl || prev.customPlaylistUrl,
            epgUrl: res.data.epgUrl || prev.epgUrl,
            playlistMode: res.data.playlistUrl ? 'custom' : prev.playlistMode
          }));
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [API_BASE]);

  useEffect(() => {
    localStorage.setItem('hayate_settings', JSON.stringify(settings));
  }, [settings]);

  // Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewState === 'password' || viewState === 'settings') return;

      switch (e.key) {
        case 'ArrowUp':
          if (viewState === 'channelList') {
            setSelectedIndex(prev => Math.max(0, prev - 1));
          } else if (viewState === 'groupList') {
            setGroupIndex(prev => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowDown':
          if (viewState === 'channelList') {
            setSelectedIndex(prev => Math.min(filteredChannels.length - 1, prev + 1));
          } else if (viewState === 'groupList') {
            setGroupIndex(prev => Math.min(groups.length - 1, prev + 1));
          }
          break;
        case 'ArrowLeft':
          if (viewState === 'channelList') {
            setViewState('groupList');
          }
          break;
        case 'ArrowRight':
          if (viewState === 'groupList') {
            handleGroupSelect(groups[groupIndex]);
          }
          break;
        case 'Enter':
          if (viewState === 'groupList') {
            handleGroupSelect(groups[groupIndex]);
          } else if (viewState === 'channelList') {
            setCurrentChannel(filteredChannels[selectedIndex]);
            setViewState('player');
          }
          break;
        case 's':
        case 'S':
          setViewState('settings');
          break;
        case 'Escape':
        case 'Backspace':
          if (viewState === 'channelList' || viewState === 'groupList') {
            if (currentChannel) setViewState('player');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState, groupIndex, selectedIndex, groups, filteredChannels, currentChannel]);

  const handleGroupSelect = (group: string) => {
    if (group === 'RAKUTEN' && !unlockedGroups.has(group)) {
      setViewState('password');
    } else {
      setSelectedGroup(group);
      setSelectedIndex(0);
      setViewState('channelList');
    }
  };

  const handlePassword = (pass: string) => {
    if (pass === '1234') {
      setUnlockedGroups(prev => new Set(prev).add('RAKUTEN'));
      setSelectedGroup('RAKUTEN');
      setSelectedIndex(0);
      setViewState('channelList');
    } else {
      // Wrong password handled in modal
    }
  };

  const getNowPlaying = (channel: Channel) => {
    if (!epg || epg.length === 0) return null;
    const now = Date.now();

    // Normalize names for better matching
    const channelName = channel.name.toLowerCase().trim();
    const tvgId = channel.tvgId?.toLowerCase().trim();
    const tvgName = channel.name.toLowerCase().replace(/\s+HD$/i, '').trim();

    return epg.find(p => {
      const pChannel = p.channel.toLowerCase().trim();

      // Try multiple matching strategies
      const matchesId = tvgId && pChannel === tvgId;
      const matchesName = pChannel === channelName;
      const matchesTvgName = pChannel === tvgName;
      const fuzzyMatch = pChannel.includes(tvgName) || tvgName.includes(pChannel);

      return (matchesId || matchesName || matchesTvgName || (fuzzyMatch && tvgName.length > 3)) && now >= p.start && now < p.stop;
    });
  };

  const getNextProgram = (channel: Channel) => {
    if (!epg || epg.length === 0) return null;
    const now = Date.now();

    // Normalize names for better matching
    const channelName = channel.name.toLowerCase().trim();
    const tvgId = channel.tvgId?.toLowerCase().trim();

    return epg.find(p => {
      const pChannel = p.channel.toLowerCase().trim();
      const matchesId = tvgId && pChannel === tvgId;
      const matchesName = pChannel === channelName;

      return (matchesId || matchesName) && p.start >= now;
    });
  };

  const handleNextChannel = () => {
    const allChannels = channels.filter(c => c.group !== 'RAKUTEN' || unlockedGroups.has('RAKUTEN'));
    const idx = allChannels.findIndex(c => c.id === currentChannel?.id);
    const nextIdx = (idx + 1) % allChannels.length;
    setCurrentChannel(allChannels[nextIdx]);
  };

  const handlePrevChannel = () => {
    const allChannels = channels.filter(c => c.group !== 'RAKUTEN' || unlockedGroups.has('RAKUTEN'));
    const idx = allChannels.findIndex(c => c.id === currentChannel?.id);
    const prevIdx = (idx - 1 + allChannels.length) % allChannels.length;
    setCurrentChannel(allChannels[prevIdx]);
  };

  if (loading && channels.length === 0) {
    return <div className="fixed inset-0 bg-black flex items-center justify-center text-white text-2xl">{t.loading}</div>;
  }

  if (error && channels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-10 text-center">
        <div className="text-red-500 text-4xl mb-4 font-bold">Network Error</div>
        <p className="text-xl text-white/60 mb-8 max-w-md">{error}</p>
        <div className="text-sm text-white/30 mb-8 font-mono bg-white/5 p-4 rounded-lg">
          API: {API_BASE || 'Internal'}<br/>
          Origin: {window.location.origin}
        </div>
        <button
          onClick={() => loadPlaylist()}
          className="px-8 py-4 bg-[#00e676] text-black font-bold rounded-xl hover:scale-105 transition-transform"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden select-none">
      {currentChannel && (
        <VideoPlayer
          url={currentChannel.url}
          onBack={() => setViewState('channelList')}
          onShowList={() => setViewState('channelList')}
          onNext={handleNextChannel}
          onPrev={handlePrevChannel}
        />
      )}

      {(viewState === 'channelList' || viewState === 'groupList') && (
        <div className="absolute inset-0 flex z-10 bg-black">
          {/* Sidebar - Groups */}
          <div className="w-[25vw] h-full border-r border-white/5 flex flex-col bg-[#0a0a0a]">
            <div className="p-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-[#00e676] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00e676]/20 overflow-hidden">
                <img
                  src="assets/icon.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play text-black fill-current"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                  }}
                />
              </div>
              <h1 className="text-3xl font-black tracking-tighter italic">HAYATE<span className="text-[#00e676]">TV</span></h1>
            </div>

            <div className="flex-1 overflow-y-auto px-6 space-y-2">
              {groups.map((group, idx) => (
                <div
                  key={group}
                  className={`p-5 rounded-2xl flex items-center justify-between transition-all duration-200 cursor-pointer ${
                    (viewState === 'groupList' && groupIndex === idx) || (viewState === 'channelList' && selectedGroup === group)
                      ? 'bg-[#00e676] text-black font-bold scale-105 shadow-xl'
                      : 'hover:bg-white/5 text-white/40'
                  }`}
                  onClick={() => handleGroupSelect(group)}
                >
                  <div className="flex items-center gap-4">
                    <List size={22} />
                    <span className="text-lg truncate">{group}</span>
                  </div>
                  {group === 'RAKUTEN' && !unlockedGroups.has(group) && <Lock size={18} />}
                </div>
              ))}
            </div>

            <div
              className={`p-8 border-t border-white/5 flex items-center gap-4 cursor-pointer transition-colors ${viewState === 'settings' ? 'bg-[#00e676] text-black' : 'hover:bg-white/5 text-white/30'}`}
              onClick={() => setViewState('settings')}
            >
              <Settings size={24} />
              <span className="text-lg font-bold">{t.settings}</span>
            </div>
          </div>

          {/* Channel List */}
          <div className="flex-1 h-full flex flex-col bg-[#050505]">
            <div className="p-10 flex justify-between items-end">
              <div>
                <h2 className="text-5xl font-black tracking-tight text-white">{selectedGroup}</h2>
                <p className="text-white/30 font-bold mt-2 uppercase tracking-widest text-sm">{filteredChannels.length} Channels Available</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-mono font-black text-[#00e676]">
                  {new Date().toLocaleTimeString(settings.language, { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-white/20 uppercase tracking-[0.3em] font-black mt-1">
                  {settings.useInternetTime ? 'Network Sync' : settings.timezone}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-4">
              {filteredChannels.map((channel, idx) => {
                const now = getNowPlaying(channel);
                return (
                  <div
                    key={channel.id}
                    className={`group p-5 rounded-3xl flex items-center gap-8 transition-all duration-300 cursor-pointer border-2 ${
                      viewState === 'channelList' && selectedIndex === idx
                        ? 'bg-white text-black border-white scale-[1.02] shadow-2xl'
                        : 'bg-white/5 border-transparent hover:bg-white/10 text-white'
                    }`}
                    onClick={() => {
                      setCurrentChannel(channel);
                      setViewState('player');
                    }}
                  >
                    <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt=""
                          className="w-full h-full object-contain p-2"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const icon = document.createElement('div');
                              icon.className = 'text-white/10';
                              icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tv"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="7 2 12 7 17 2"/></svg>';
                              parent.appendChild(icon);
                            }
                          }}
                        />
                      ) : (
                        <Play size={32} className={viewState === 'channelList' && selectedIndex === idx ? 'text-black' : 'text-white/20'} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-black truncate">{channel.name}</h3>
                      {now ? (
                        <div className="mt-2 flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-md font-black uppercase flex-shrink-0 ${viewState === 'channelList' && selectedIndex === idx ? 'bg-black text-white' : 'bg-[#00e676] text-black'}`}>LIVE</span>
                          <MarqueeText
                            text={now.title}
                            className={`text-lg font-bold flex-1 ${viewState === 'channelList' && selectedIndex === idx ? 'text-black/70' : 'text-white/40'}`}
                          />
                        </div>
                      ) : (
                        <p className={`text-lg font-bold mt-2 ${viewState === 'channelList' && selectedIndex === idx ? 'text-black/40' : 'text-white/20 italic'}`}>No program info</p>
                      )}
                    </div>
                    {viewState === 'channelList' && selectedIndex === idx && (
                      <ChevronRight size={32} className="text-black" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Info Panel */}
          {viewState === 'channelList' && filteredChannels[selectedIndex] && (
            <div className="w-[30vw] h-full bg-[#0a0a0a] border-l border-white/5 p-10 flex flex-col gap-10">
              <div className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl flex items-center justify-center">
                {filteredChannels[selectedIndex].logo ? (
                  <img
                    src={filteredChannels[selectedIndex].logo}
                    alt=""
                    className="w-full h-full object-contain p-4"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const icon = document.createElement('div');
                        icon.className = 'text-white/5';
                        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tv"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="7 2 12 7 17 2"/></svg>';
                        parent.appendChild(icon);
                      }
                    }}
                  />
                ) : (
                  <Tv size={80} className="text-white/5" />
                )}
              </div>

              <div className="space-y-8">
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-[#00e676] uppercase tracking-[0.3em]">{t.nowPlaying}</h4>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                    {getNowPlaying(filteredChannels[selectedIndex]) ? (
                      <>
                        <p className="font-black text-2xl leading-tight">{getNowPlaying(filteredChannels[selectedIndex])?.title}</p>
                        <p className="text-lg text-white/40 mt-4 leading-relaxed line-clamp-6">{getNowPlaying(filteredChannels[selectedIndex])?.desc}</p>
                      </>
                    ) : (
                      <p className="text-white/20 italic text-lg">{t.noProgram}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-black text-white/20 uppercase tracking-[0.3em]">Channel Details</h4>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/40 font-bold">Group</span>
                      <span className="font-black text-[#00e676]">{filteredChannels[selectedIndex].group}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/40 font-bold">ID</span>
                      <span className="font-mono text-sm">{filteredChannels[selectedIndex].tvgId || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {viewState === 'settings' && (
        <SettingsPanel
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setViewState('groupList')}
          t={t}
        />
      )}

      {viewState === 'password' && (
        <PasswordModal
          onConfirm={handlePassword}
          onCancel={() => setViewState('groupList')}
          t={t}
        />
      )}

      {/* Styles removed as they are now in MarqueeText component */}
    </div>
  );
};

export default App;
