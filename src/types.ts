export interface Channel {
  id: string;
  name: string;
  logo: string;
  url: string;
  group: string;
  tvgId?: string;
}

export interface EPGProgram {
  start: number;
  stop: number;
  title: string;
  desc?: string;
  channel: string;
}

export interface AppSettings {
  language: 'en' | 'zh' | 'ja';
  playlistMode: 'default' | 'custom';
  customPlaylistUrl: string;
  epgUrl: string;
  useInternetTime: boolean;
  timezone: string;
}

export type ViewState = 'player' | 'channelList' | 'settings' | 'password';
