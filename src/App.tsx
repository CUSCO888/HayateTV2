import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, List, Lock, Play, ChevronRight, Clock } from 'lucide-react';
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

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('hayate_settings');
    if (saved) return JSON.parse(saved);
    return {
      language: 'en',
      playlistMode: 'default',
      customPlaylistUrl: '',
      epgUrl: '',
      useInternetTime: true,
      timezone: 'UTC+08:00'
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
    console.log("loadPlaylist triggered. Current settings.epgUrl:", settings.epgUrl);
    setLoading(true);
    const url = settings.playlistMode === 'default' ? DEFAULT_M3U_URL : settings.customPlaylistUrl;
    if (!url) {
      console.log("No playlist URL to load");
      setLoading(false);
      return;
    }

    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const res = await axios.get(proxyUrl, { responseType: 'text' });
      const content = typeof res.data === 'string' ? res.data : new TextDecoder().decode(res.data);
      console.log("Playlist content (first 100 chars):", content.substring(0, 100));
      const { channels: parsedChannels, epgUrl: detectedEpg } = parseM3U(content);
      console.log("Parsed M3U. Detected EPG:", detectedEpg);
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
    console.log("loadEPG called with URL:", settings.epgUrl);
    if (!settings.epgUrl) {
      console.log("No EPG URL set");
      return;
    }
    console.log("Loading EPG from:", settings.epgUrl);
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(settings.epgUrl)}`;
      const res = await axios.get(proxyUrl);
      const parsedEPG = parseEPG(res.data);
      console.log(`Parsed ${parsedEPG.length} EPG programs`);
      setEpg(parsedEPG);
    } catch (e) {
      console.error("EPG Load Error", e);
    }
  }, [settings.epgUrl]);

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
        const res = await axios.get('/api/remote-input/poll');
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
  }, []);

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

    return epg.find(p => {
      const pChannel = p.channel.toLowerCase().trim();
      const matchesId = tvgId && pChannel === tvgId;
      const matchesName = pChannel === channelName;

      return (matchesId || matchesName) && now >= p.start && now < p.stop;
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

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white font-sans overflow-hidden select-none">
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
        <div className="absolute inset-0 flex z-10 bg-gradient-to-r from-black via-black/80 to-transparent">
          {/* Sidebar - Groups */}
          <div className="w-80 h-full border-r border-white/10 flex flex-col bg-black/40 backdrop-blur-xl">
            <div className="p-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#00e676] rounded-xl flex items-center justify-center shadow-lg shadow-[#00e676]/20 overflow-hidden">
                <img
                  src="/assets/icon.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to Play icon if icon.png is not found
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-play text-black fill-current"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                  }}
                />
              </div>
              <h1 className="text-2xl font-black tracking-tighter italic">HAYATE<span className="text-[#00e676]">TV</span></h1>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-1">
              {groups.map((group, idx) => (
                <div
                  key={group}
                  className={`p-4 rounded-xl flex items-center justify-between transition-all duration-200 cursor-pointer ${
                    (viewState === 'groupList' && groupIndex === idx) || (viewState === 'channelList' && selectedGroup === group)
                      ? 'bg-[#00e676] text-black font-bold scale-105 shadow-lg'
                      : 'hover:bg-white/5 text-white/60'
                  }`}
                  onClick={() => handleGroupSelect(group)}
                >
                  <div className="flex items-center gap-3">
                    <List size={18} />
                    <span className="truncate">{group}</span>
                  </div>
                  {group === 'RAKUTEN' && !unlockedGroups.has(group) && <Lock size={16} />}
                </div>
              ))}
            </div>

            <div
              className={`p-6 border-t border-white/10 flex items-center gap-3 cursor-pointer transition-colors ${viewState === 'settings' ? 'bg-[#00e676] text-black' : 'hover:bg-white/5 text-white/50'}`}
              onClick={() => setViewState('settings')}
            >
              <Settings size={20} />
              <span className="font-bold">{t.settings}</span>
            </div>
          </div>

          {/* Channel List */}
          <div className="flex-1 h-full flex flex-col">
            <div className="p-8 flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black tracking-tight">{selectedGroup}</h2>
                <p className="text-white/40 font-medium">{filteredChannels.length} Channels</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-[#00e676]">
                  {new Date().toLocaleTimeString(settings.language, { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-white/30 uppercase tracking-widest font-bold">
                  {settings.useInternetTime ? 'Network Time' : settings.timezone}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3">
              {filteredChannels.map((channel, idx) => {
                const now = getNowPlaying(channel);
                if (idx === 0 && epg.length > 0) {
                  console.log(`First channel: ${channel.name}, Now playing:`, now);
                }
                return (
                  <div
                    key={channel.id}
                    className={`group p-4 rounded-2xl flex items-center gap-6 transition-all duration-300 cursor-pointer border ${
                      viewState === 'channelList' && selectedIndex === idx
                        ? 'bg-white text-black border-white scale-[1.02] shadow-2xl'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-white'
                    }`}
                    onClick={() => {
                      setCurrentChannel(channel);
                      setViewState('player');
                    }}
                  >
                    <div className="w-20 h-20 bg-black/20 rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                      {channel.logo ? (
                        <img src={channel.logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <Play className={viewState === 'channelList' && selectedIndex === idx ? 'text-black' : 'text-white/20'} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold truncate">{channel.name}</h3>
                      {now && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0 ${viewState === 'channelList' && selectedIndex === idx ? 'bg-black text-white' : 'bg-[#00e676] text-black'}`}>LIVE</span>
                          <MarqueeText
                            text={now.title}
                            className={`text-sm font-medium flex-1 ${viewState === 'channelList' && selectedIndex === idx ? 'text-black/60' : 'text-white/40'}`}
                          />
                        </div>
                      )}
                    </div>
                    {viewState === 'channelList' && selectedIndex === idx && (
                      <ChevronRight className="text-black" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Info Panel */}
          {viewState === 'channelList' && filteredChannels[selectedIndex] && (
            <div className="w-96 h-full bg-black/60 backdrop-blur-2xl border-l border-white/10 p-8 flex flex-col gap-8">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                {filteredChannels[selectedIndex].logo && (
                  <img src={filteredChannels[selectedIndex].logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                )}
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-[#00e676] uppercase tracking-[0.2em]">{t.nowPlaying}</h4>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    {getNowPlaying(filteredChannels[selectedIndex]) ? (
                      <>
                        <p className="font-bold text-lg leading-tight">{getNowPlaying(filteredChannels[selectedIndex])?.title}</p>
                        <p className="text-sm text-white/40 mt-2 line-clamp-3">{getNowPlaying(filteredChannels[selectedIndex])?.desc}</p>
                      </>
                    ) : (
                      <p className="text-white/30 italic">{t.noProgram}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white/30 uppercase tracking-[0.2em]">{t.next}</h4>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                    {getNextProgram(filteredChannels[selectedIndex]) ? (
                      <p className="font-bold text-white/60">{getNextProgram(filteredChannels[selectedIndex])?.title}</p>
                    ) : (
                      <p className="text-white/20 italic">{t.noProgram}</p>
                    )}
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
