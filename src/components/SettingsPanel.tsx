import React, { useState, useEffect } from 'react';
import { X, Globe, List, Clock, Languages, Smartphone } from 'lucide-react';
import { AppSettings } from '../types';
import { translations } from '../i18n';
import QRCode from 'react-qr-code';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
  t: any;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings: initialSettings, onUpdate, onClose, t }) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [ip, setIp] = useState('Loading...');

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    // In this environment, we use the APP_URL provided
    const url = window.location.origin;
    setIp(url);
  }, []);

  const timezones = Array.from({ length: 25 }, (_, i) => {
    const offset = i - 12;
    const sign = offset >= 0 ? '+' : '-';
    const abs = Math.abs(offset).toString().padStart(2, '0');
    return `UTC${sign}${abs}:00`;
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-10">
      <div className="bg-[#1a1a1a] w-full max-w-4xl rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#222]">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="text-[#00e676]" /> {t.settings}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            tabIndex={100}
          >
            <X />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Language */}
          <div className="space-y-2">
            <label className="text-sm text-white/50 flex items-center gap-2 uppercase tracking-wider font-bold">
              <Languages size={16} /> {t.language}
            </label>
            <select
              tabIndex={1}
              autoFocus
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value as any })}
              className="w-full bg-[#2a2a2a] border border-white/10 p-4 rounded-xl focus:border-[#00e676] focus:ring-2 focus:ring-[#00e676]/20 outline-none transition-all"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          {/* Playlist Mode */}
          <div className="space-y-2">
            <label className="text-sm text-white/50 flex items-center gap-2 uppercase tracking-wider font-bold">
              <List size={16} /> {t.playlistMode}
            </label>
            <select
              tabIndex={2}
              value={settings.playlistMode}
              onChange={(e) => setSettings({ ...settings, playlistMode: e.target.value as any })}
              className="w-full bg-[#2a2a2a] border border-white/10 p-4 rounded-xl focus:border-[#00e676] focus:ring-2 focus:ring-[#00e676]/20 outline-none transition-all"
            >
              <option value="default">{t.default}</option>
              <option value="custom">{t.custom}</option>
            </select>
          </div>

          {settings.playlistMode === 'custom' && (
            <div className="space-y-2">
              <label className="text-sm text-white/50 uppercase tracking-wider font-bold">{t.playlistUrl}</label>
              <input
                tabIndex={3}
                type="text"
                value={settings.customPlaylistUrl}
                onChange={(e) => setSettings({ ...settings, customPlaylistUrl: e.target.value })}
                className="w-full bg-[#2a2a2a] border border-white/10 p-4 rounded-xl focus:border-[#00e676] focus:ring-2 focus:ring-[#00e676]/20 outline-none transition-all"
                placeholder="https://..."
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm text-white/50 uppercase tracking-wider font-bold">{t.epgUrl}</label>
            <input
              tabIndex={4}
              type="text"
              value={settings.epgUrl}
              onChange={(e) => setSettings({ ...settings, epgUrl: e.target.value })}
              className="w-full bg-[#2a2a2a] border border-white/10 p-4 rounded-xl focus:border-[#00e676] focus:ring-2 focus:ring-[#00e676]/20 outline-none transition-all"
              placeholder="https://..."
            />
          </div>

          {/* Time Settings */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-white/50 flex items-center gap-2 uppercase tracking-wider font-bold">
                <Clock size={16} /> {t.useInternetTime}
              </label>
              <div className="flex items-center h-[58px]">
                <input
                  tabIndex={5}
                  type="checkbox"
                  checked={settings.useInternetTime}
                  onChange={(e) => setSettings({ ...settings, useInternetTime: e.target.checked })}
                  className="w-6 h-6 rounded bg-[#2a2a2a] border-white/10 text-[#00e676] focus:ring-[#00e676]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/50 uppercase tracking-wider font-bold">{t.timezone}</label>
              <select
                tabIndex={6}
                disabled={settings.useInternetTime}
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className={`w-full bg-[#2a2a2a] border border-white/10 p-4 rounded-xl outline-none transition-all ${settings.useInternetTime ? 'opacity-30' : 'focus:border-[#00e676] focus:ring-2 focus:ring-[#00e676]/20'}`}
              >
                {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          {/* Remote Input */}
          <div className="mt-10 p-6 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-8">
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={`${ip}/remote`} size={120} />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Smartphone className="text-[#00e676]" /> {t.remoteInput}
              </h3>
              <p className="text-white/60 text-sm">{t.remoteInputDesc}</p>
              <div className="bg-black/40 p-3 rounded-lg font-mono text-[#00e676] text-sm">
                {ip}/remote
              </div>
              <p className="text-[10px] text-white/30 italic">Port: 6780 (Display Only)</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-white/10 bg-[#222] flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 p-4 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all border border-white/5"
            tabIndex={7}
          >
            {t.back || 'Back'}
          </button>
          <button
            onClick={() => {
              onUpdate(settings);
              onClose();
            }}
            className="flex-1 p-4 rounded-xl bg-[#00e676] hover:bg-[#00c853] text-black font-bold transition-all shadow-lg shadow-[#00e676]/20"
            tabIndex={8}
          >
            {t.save || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
