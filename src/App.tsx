import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Settings, List, Tv, Play, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Channel,
  EPGData,
  Program,
  parseM3U,
  parseTXT,
  parseEPG,
} from "./utils/parser";
import { translations, Language } from "./utils/i18n";
import Player from "./components/Player";

type Panel = "hidden" | "groups" | "channels" | "settings";

export default function App() {
  const [panel, setPanel] = useState<Panel>("settings");
  const [lang, setLang] = useState<Language>("en");

  const DEFAULT_PLAYLIST =
    "https://raw.githubusercontent.com/CUSCO888/spider/refs/heads/master/output/hayate.m3u";

  const [playlistMode, setPlaylistMode] = useState<"default" | "custom">(
    "default",
  );
  const [playlistUrl, setPlaylistUrl] = useState(DEFAULT_PLAYLIST);
  const [epgUrl, setEpgUrl] = useState("");

  const [useInternetTime, setUseInternetTime] = useState(true);
  const [timezone, setTimezone] = useState("UTC");

  const [lanIp, setLanIp] = useState("");
  const [lastRemoteTimestamp, setLastRemoteTimestamp] = useState(0);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [epg, setEpg] = useState<EPGData>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);
  const [playerError, setPlayerError] = useState(false);
  const [showMinimalOverlay, setShowMinimalOverlay] = useState(false);

  // Navigation state
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);

  const [unlockedGroups, setUnlockedGroups] = useState<Set<string>>(new Set());
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");

  const t = translations[lang];

  const allTimezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch (e) {
      return ["UTC", "Asia/Shanghai", "Asia/Tokyo", "America/New_York", "Europe/London"];
    }
  }, []);
  const groups = useMemo(() => {
    const groupSet = new Set<string>();
    channels.forEach((c) => groupSet.add(c.group));
    return Array.from(groupSet);
  }, [channels]);

  const channelsInGroup = useMemo(() => {
    if (groups.length === 0) return [];
    const currentGroup = groups[selectedGroupIndex];
    if (currentGroup === "RAKUTEN" && !unlockedGroups.has("RAKUTEN")) {
      return [];
    }
    return channels.filter((c) => c.group === currentGroup);
  }, [channels, groups, selectedGroupIndex, unlockedGroups]);

  // Refs for scrolling
  const groupListRef = useRef<HTMLDivElement>(null);
  const channelListRef = useRef<HTMLDivElement>(null);

  // Load saved settings
  useEffect(() => {
    const savedLang = localStorage.getItem("iptv_lang") as Language;
    const savedPlaylistMode = localStorage.getItem("iptv_playlist_mode") as
      | "default"
      | "custom";
    const savedPlaylist = localStorage.getItem("iptv_playlist");
    const savedEpg = localStorage.getItem("iptv_epg");
    const savedUseInternetTime = localStorage.getItem("iptv_use_internet_time");
    const savedTimezone = localStorage.getItem("iptv_timezone");

    if (savedLang) setLang(savedLang);
    if (savedPlaylistMode) setPlaylistMode(savedPlaylistMode);
    if (savedPlaylist) setPlaylistUrl(savedPlaylist);
    if (savedEpg) setEpgUrl(savedEpg);
    if (savedUseInternetTime !== null)
      setUseInternetTime(savedUseInternetTime === "true");
    if (savedTimezone) setTimezone(savedTimezone);

    const initialUrl =
      savedPlaylistMode === "custom"
        ? savedPlaylist || DEFAULT_PLAYLIST
        : DEFAULT_PLAYLIST;
    loadData(initialUrl, savedEpg || "");

    // Get LAN IP
    fetch("/api/ip").then(res => res.json()).then(data => setLanIp(data.ip)).catch(console.error);
  }, []);

  // Poll for remote input
  useEffect(() => {
    if (panel !== "settings") return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/remote/poll");
        const data = await res.json();
        if (data.timestamp > lastRemoteTimestamp) {
          if (data.playlistUrl) {
            setPlaylistUrl(data.playlistUrl);
            setPlaylistMode("custom");
          }
          if (data.epgUrl) setEpgUrl(data.epgUrl);
          setLastRemoteTimestamp(data.timestamp);
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [panel, lastRemoteTimestamp]);

  const fetchProxy = async (url: string) => {
    const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return await res.text();
  };

  const loadData = async (pUrl: string, eUrl: string) => {
    setLoading(true);
    setError("");
    try {
      const content = await fetchProxy(pUrl);
      let parsedChannels: Channel[] = [];
      let detectedEpgUrl = "";
      
      if (content.includes("#EXTM3U")) {
        const result = parseM3U(content);
        parsedChannels = result.channels;
        detectedEpgUrl = result.tvgUrl || "";
      } else {
        parsedChannels = parseTXT(content);
      }

      if (parsedChannels.length > 0) {
        setChannels(parsedChannels);
        setPanel("groups");
        setSelectedGroupIndex(0);
        setSelectedChannelIndex(0);

        const finalEpgUrl = eUrl || detectedEpgUrl;
        if (finalEpgUrl) {
          try {
            const epgContent = await fetchProxy(finalEpgUrl);
            const parsedEpg = parseEPG(epgContent);
            setEpg(parsedEpg);
          } catch (e) {
            console.error("Failed to load EPG", e);
          }
        }
      } else {
        setError(t.noChannels);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem("iptv_lang", lang);
    localStorage.setItem("iptv_playlist_mode", playlistMode);
    localStorage.setItem("iptv_playlist", playlistUrl);
    localStorage.setItem("iptv_epg", epgUrl);
    localStorage.setItem("iptv_use_internet_time", useInternetTime.toString());
    localStorage.setItem("iptv_timezone", timezone);

    const urlToLoad =
      playlistMode === "default" ? DEFAULT_PLAYLIST : playlistUrl;
    loadData(urlToLoad, epgUrl);
  };

  const playChannel = useCallback((channel: Channel) => {
    setPlayingChannel(channel);
    setPlayerError(false);
    setPanel("hidden");
    setShowMinimalOverlay(true);
  }, []);

  useEffect(() => {
    if (showMinimalOverlay) {
      const timer = setTimeout(() => setShowMinimalOverlay(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showMinimalOverlay, playingChannel]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (panel === "settings") {
        if (e.key === "Escape" || e.key === "Backspace") {
          if (channels.length > 0) setPanel("groups");
        }
        return; // Let user type in inputs
      }

      e.preventDefault(); // Prevent default scrolling

      if (showPasswordPrompt) {
        if (e.key === "Escape") {
          setShowPasswordPrompt(null);
          setPasswordInput("");
        } else if (e.key === "Backspace") {
          setPasswordInput((prev) => prev.slice(0, -1));
        } else if (e.key === "Enter") {
          if (passwordInput === "1234") {
            setUnlockedGroups((prev) => new Set(prev).add(showPasswordPrompt));
            setShowPasswordPrompt(null);
            setPasswordInput("");
            setPanel("channels");
          } else {
            setPasswordInput("");
          }
        } else if (/^[0-9]$/.test(e.key)) {
          setPasswordInput((prev) => (prev + e.key).slice(0, 4));
        }
        return;
      }

      if (panel === "hidden") {
        if (
          e.key === "Enter" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight"
        ) {
          setPanel("channels");
        } else if (e.key === "ArrowUp") {
          // Previous channel globally
          if (playingChannel) {
            let idx = channels.findIndex((c) => c.url === playingChannel.url);
            while (idx > 0) {
              idx--;
              const prevChannel = channels[idx];
              if (prevChannel.group === "RAKUTEN" && !unlockedGroups.has("RAKUTEN")) continue;
              playChannel(prevChannel);
              break;
            }
          }
        } else if (e.key === "ArrowDown") {
          // Next channel globally
          if (playingChannel) {
            let idx = channels.findIndex((c) => c.url === playingChannel.url);
            while (idx < channels.length - 1) {
              idx++;
              const nextChannel = channels[idx];
              if (nextChannel.group === "RAKUTEN" && !unlockedGroups.has("RAKUTEN")) continue;
              playChannel(nextChannel);
              break;
            }
          }
        }
        return;
      }

      if (panel === "groups") {
        if (e.key === "ArrowUp") {
          setSelectedGroupIndex((prev) => Math.max(0, prev - 1));
          setSelectedChannelIndex(0);
        } else if (e.key === "ArrowDown") {
          setSelectedGroupIndex((prev) =>
            Math.min(groups.length - 1, prev + 1),
          );
          setSelectedChannelIndex(0);
        } else if (e.key === "ArrowRight" || e.key === "Enter") {
          const currentGroup = groups[selectedGroupIndex];
          if (currentGroup === "RAKUTEN" && !unlockedGroups.has("RAKUTEN")) {
            setShowPasswordPrompt("RAKUTEN");
          } else {
            setPanel("channels");
          }
        } else if (e.key === "Backspace" || e.key === "Escape") {
          if (playingChannel) setPanel("hidden");
        }
      } else if (panel === "channels") {
        if (e.key === "ArrowUp") {
          setSelectedChannelIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === "ArrowDown") {
          setSelectedChannelIndex((prev) =>
            Math.min(channelsInGroup.length - 1, prev + 1),
          );
        } else if (e.key === "ArrowLeft") {
          setPanel("groups");
        } else if (e.key === "Enter") {
          const channel = channelsInGroup[selectedChannelIndex];
          if (channel) playChannel(channel);
        } else if (e.key === "Backspace" || e.key === "Escape") {
          setPanel("groups");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    panel,
    groups.length,
    channelsInGroup,
    selectedGroupIndex,
    selectedChannelIndex,
    playingChannel,
    channels,
    playChannel,
  ]);

  // Auto-scroll selected items into view
  useEffect(() => {
    if (panel === "groups" && groupListRef.current) {
      const selectedEl = groupListRef.current.children[
        selectedGroupIndex
      ] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [selectedGroupIndex, panel]);

  useEffect(() => {
    if (panel === "channels" && channelListRef.current) {
      const selectedEl = channelListRef.current.children[
        selectedChannelIndex
      ] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [selectedChannelIndex, panel]);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getFormattedTime = (date: Date) => {
    if (useInternetTime) {
      return date.toLocaleTimeString(
        lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-US",
        { hour: "2-digit", minute: "2-digit" },
      );
    } else {
      try {
        return date.toLocaleTimeString(
          lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-US",
          { hour: "2-digit", minute: "2-digit", timeZone: timezone },
        );
      } catch (e) {
        return date.toLocaleTimeString(
          lang === "zh" ? "zh-CN" : lang === "ja" ? "ja-JP" : "en-US",
          { hour: "2-digit", minute: "2-digit" },
        );
      }
    }
  };

  const getNowForEpg = () => {
    if (useInternetTime) return new Date();

    // If manual timezone, we need to adjust the 'now' to match the selected timezone's local time
    // Actually, EPG start/stop are parsed as absolute Date objects (UTC based).
    // So 'now' is always new Date() for comparison.
    return new Date();
  };

  const getCurrentProgram = (channelId: string) => {
    if (!channelId || !epg[channelId]) return null;
    const now = getNowForEpg();
    return epg[channelId].find((p) => p.start <= now && p.stop > now);
  };

  const getNextProgram = (channelId: string) => {
    if (!channelId || !epg[channelId]) return null;
    const now = getNowForEpg();
    return epg[channelId].find((p) => p.start > now);
  };

  return (
    <div className="w-screen h-screen bg-black text-white overflow-hidden font-sans select-none">
      {/* Background Player */}
      <div className="absolute inset-0 z-0">
        {playingChannel ? (
          <Player
            url={playingChannel.url}
            onError={() => setPlayerError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <Tv size={64} />
          </div>
        )}
      </div>

      {/* Overlay UI */}
      {panel !== "hidden" && (
        <div className="absolute inset-0 z-10 bg-black/80 flex">
          {/* Password Prompt */}
          {showPasswordPrompt && (
            <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center">
              <div className="bg-gray-900 p-8 rounded-xl shadow-2xl w-[400px] border border-gray-700 text-center">
                <h2 className="text-2xl font-bold mb-4">{t.enterPassword}</h2>
                <p className="text-gray-400 mb-6">{t.group}: {showPasswordPrompt}</p>
                <div className="flex justify-center gap-2 mb-6">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-12 h-14 bg-gray-800 border-2 border-gray-700 rounded-lg flex items-center justify-center text-2xl font-bold"
                    >
                      {passwordInput[i] ? "•" : ""}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-6 max-w-[200px] mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === "C") {
                          setPasswordInput("");
                        } else if (key === "OK") {
                          if (passwordInput === "1234") {
                            setUnlockedGroups((prev) => new Set(prev).add(showPasswordPrompt));
                            setShowPasswordPrompt(null);
                            setPasswordInput("");
                            setPanel("channels");
                          } else {
                            setPasswordInput("");
                          }
                        } else {
                          setPasswordInput((prev) => (prev + key).slice(0, 4));
                        }
                      }}
                      className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors text-xl"
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mb-4">{t.passwordHint}</p>
                <button
                  onClick={() => {
                    setShowPasswordPrompt(null);
                    setPasswordInput("");
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {panel === "settings" && (
            <div className="m-auto bg-gray-900 p-8 rounded-xl shadow-2xl w-[600px] max-w-full border border-gray-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-4 mb-6">
                <img
                  src="/logo0.png"
                  alt="HayateTV"
                  className="w-12 h-12 object-contain"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Settings /> {t.settings}
                </h2>
              </div>

              <div className="space-y-4">
                <div className="border-b border-gray-700 pb-4">
                  <h3 className="text-lg font-semibold mb-3 text-blue-400">
                    {t.timeSettings}
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useInternetTime}
                        onChange={(e) => setUseInternetTime(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                        tabIndex={0}
                        autoFocus
                      />
                      <span className="text-white">{t.useInternetTime}</span>
                    </label>

                    <div>
                      <label
                        className={`block text-sm mb-1 ${useInternetTime ? "text-gray-600" : "text-gray-400"}`}
                      >
                        {t.timezone}
                      </label>
                      <select
                        tabIndex={0}
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        disabled={useInternetTime}
                        className={`w-full border rounded-lg p-3 outline-none transition-colors ${
                          useInternetTime
                            ? "bg-gray-800/50 border-gray-800 text-gray-600 cursor-not-allowed"
                            : "bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        }`}
                      >
                        {allTimezones.map(tz => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {t.language}
                  </label>
                  <select
                    tabIndex={0}
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Language)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {t.playlistMode}
                  </label>
                  <select
                    tabIndex={0}
                    value={playlistMode}
                    onChange={(e) =>
                      setPlaylistMode(e.target.value as "default" | "custom")
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none mb-2"
                  >
                    <option value="default">{t.default}</option>
                    <option value="custom">{t.custom}</option>
                  </select>

                  {playlistMode === "custom" && (
                    <>
                      <label className="block text-sm mb-1 text-gray-400">
                        {t.playlistUrl}
                      </label>
                      <input
                        tabIndex={0}
                        type="text"
                        value={playlistUrl}
                        onChange={(e) => setPlaylistUrl(e.target.value)}
                        placeholder="http://..."
                        className="w-full border rounded-lg p-3 outline-none transition-colors bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {t.epgUrl}
                  </label>
                  <input
                    tabIndex={0}
                    type="text"
                    value={epgUrl}
                    onChange={(e) => setEpgUrl(e.target.value)}
                    placeholder="http://..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-3 text-blue-400">{t.remoteInput}</h3>
                  <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-300 mb-2">{t.remoteInputDesc}</p>
                      <div className="font-mono text-xl text-white bg-gray-900 px-3 py-2 rounded border border-gray-700 inline-block">
                        {lanIp ? `http://${lanIp}:6780/remote` : t.loading}
                      </div>
                    </div>
                    {lanIp && (
                      <div className="bg-white p-2 rounded-lg ml-4 shrink-0">
                        <QRCodeSVG value={`http://${lanIp}:6780/remote`} size={80} />
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                <button
                  tabIndex={0}
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-4 focus:ring-2 focus:ring-white outline-none"
                >
                  {loading ? t.loading : t.save}
                </button>

                {channels.length > 0 && (
                  <button
                    tabIndex={0}
                    onClick={() => setPanel("groups")}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2 focus:ring-2 focus:ring-white outline-none"
                  >
                    {t.channels}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Groups & Channels Panel */}
          {(panel === "groups" || panel === "channels") && (
            <div className="flex w-full h-full">
              {/* Groups Sidebar */}
              <div className="w-1/4 bg-gray-900/90 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <img
                    src="/banner0.png"
                    alt="HayateTV"
                    className="h-8 object-contain"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <div className="flex items-center gap-3">
                    <div className="text-gray-400 font-mono text-sm">
                      {getFormattedTime(currentTime)}
                    </div>
                    <button
                      onClick={() => setPanel("settings")}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                </div>
                <div
                  className="flex-1 overflow-y-auto p-2 space-y-1"
                  ref={groupListRef}
                >
                  {groups.map((group, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedGroupIndex(idx);
                        setSelectedChannelIndex(0);
                        if (group === "RAKUTEN" && !unlockedGroups.has("RAKUTEN")) {
                          setShowPasswordPrompt("RAKUTEN");
                        } else {
                          setPanel("channels");
                        }
                      }}
                      className={`px-4 py-3 rounded-lg text-lg transition-colors cursor-pointer ${
                        idx === selectedGroupIndex
                          ? panel === "groups"
                            ? "bg-blue-600 text-white font-bold shadow-lg scale-[1.02]"
                            : "bg-gray-800 text-white"
                          : "text-gray-400 hover:bg-gray-800/50"
                      }`}
                    >
                      {group}
                      {group === "RAKUTEN" && !unlockedGroups.has("RAKUTEN") && (
                        <span className="float-right text-gray-500">🔒</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Channels List */}
              <div className="w-1/3 bg-gray-900/80 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800 font-bold text-gray-400 uppercase tracking-wider text-sm">
                  {t.channels}
                </div>
                <div
                  className="flex-1 overflow-y-auto p-2 space-y-1"
                  ref={channelListRef}
                >
                  {channelsInGroup.map((channel, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedChannelIndex(idx);
                        setPanel("channels");
                        playChannel(channel);
                      }}
                      className={`px-4 py-3 rounded-lg flex items-center gap-3 transition-colors cursor-pointer ${
                        idx === selectedChannelIndex
                          ? panel === "channels"
                            ? "bg-blue-600 text-white font-bold shadow-lg scale-[1.02]"
                            : "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-800/50"
                      }`}
                    >
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt=""
                          className="w-10 h-10 object-contain bg-white/10 rounded"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center">
                          <Tv size={20} className="text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-lg">{channel.name}</div>
                        {getCurrentProgram(channel.id) && (
                          <div className="text-sm text-gray-400 overflow-hidden relative h-5 mt-0.5">
                            <div className="whitespace-nowrap animate-marquee absolute">
                              {getCurrentProgram(channel.id)?.title}
                            </div>
                          </div>
                        )}
                      </div>
                      {playingChannel?.url === channel.url && (
                        <Play
                          size={16}
                          className="text-green-400"
                          fill="currentColor"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* EPG Info Panel */}
              <div className="flex-1 bg-gradient-to-r from-gray-900/80 to-transparent p-12 flex flex-col justify-center">
                {channelsInGroup[selectedChannelIndex] && (
                  <div className="max-w-2xl">
                    <h1 className="text-5xl font-bold mb-8 drop-shadow-lg">
                      {channelsInGroup[selectedChannelIndex].name}
                    </h1>

                    {(() => {
                      const channelId =
                        channelsInGroup[selectedChannelIndex].id;
                      const currentProg = getCurrentProgram(channelId);
                      const nextProg = getNextProgram(channelId);

                      if (!currentProg && !nextProg) {
                        return (
                          <div className="text-gray-400 text-xl">{t.noEpg}</div>
                        );
                      }

                      return (
                        <div className="space-y-8">
                          {currentProg && (
                            <div className="bg-blue-900/30 border border-blue-500/30 p-6 rounded-2xl backdrop-blur-md">
                              <div className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-2">
                                {t.nowPlaying}
                              </div>
                              <div className="text-3xl font-bold mb-2">
                                {currentProg.title}
                              </div>
                              <div className="text-gray-300 text-lg mb-4">
                                {getFormattedTime(currentProg.start)} -{" "}
                                {getFormattedTime(currentProg.stop)}
                              </div>
                              {currentProg.desc && (
                                <div className="text-gray-400 leading-relaxed line-clamp-3">
                                  {currentProg.desc}
                                </div>
                              )}
                            </div>
                          )}

                          {nextProg && (
                            <div className="bg-gray-800/50 border border-gray-700/50 p-6 rounded-2xl backdrop-blur-md">
                              <div className="text-gray-400 font-bold uppercase tracking-widest text-sm mb-2">
                                {t.next}
                              </div>
                              <div className="text-2xl font-bold mb-2 text-gray-200">
                                {nextProg.title}
                              </div>
                              <div className="text-gray-400">
                                {getFormattedTime(nextProg.start)} -{" "}
                                {getFormattedTime(nextProg.stop)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden state overlay (minimal info) */}
      {panel === "hidden" && playingChannel && showMinimalOverlay && (
        <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none transition-opacity duration-500">
          <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 flex items-center gap-4">
            {playingChannel.logo ? (
              <img
                src={playingChannel.logo}
                alt=""
                className="w-12 h-12 object-contain bg-white/10 rounded-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                <Tv size={24} className="text-gray-500" />
              </div>
            )}
            <div>
              <div className="text-2xl font-bold">{playingChannel.name}</div>
              {playerError && (
                <div className="text-red-400 text-sm">{t.error}</div>
              )}
            </div>
          </div>

          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-gray-300 text-sm">
            {t.pressEnter}
          </div>
        </div>
      )}
    </div>
  );
}
