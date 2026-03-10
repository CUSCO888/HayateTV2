import React, { useState, useEffect } from 'react';
import Player from './components/Player';
import { List, Tv, WifiOff } from 'lucide-react';

// 定义频道类型
interface Channel {
  id: number;
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

const App: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);

  // 模拟数据：在没有远程服务器时，保证 App 有内容显示
  const mockChannels: Channel[] = [
    { id: 1, name: 'CCTV-1 综合', url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', group: '中央台' },
    { id: 2, name: 'CCTV-5 体育', url: 'http://sample.vodobox.net/skate_phantom_flex_4k/skate_phantom_flex_4k.m3u8', group: '中央台' },
    { id: 3, name: '本地测试流', url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', group: '测试' }
  ];

  useEffect(() => {
    const loadChannels = async () => {
      try {
        setLoading(true);
        // 注意：在手机端，这里必须填写你真实的服务器 IP 或域名
        // 如果还没有部署后端，先使用 mockChannels 保证不白屏
        const response = await fetch('http://你的服务器IP:3000/api/channels').catch(() => null);
        
        if (response && response.ok) {
          const data = await response.json();
          setChannels(data);
          if (data.length > 0) setCurrentChannel(data[0]);
        } else {
          // 如果请求失败（比如没联网或服务器没开），使用模拟数据
          setChannels(mockChannels);
          setCurrentChannel(mockChannels[0]);
        }
      } catch (error) {
        console.error("加载频道失败:", error);
        setChannels(mockChannels);
      } finally {
        setLoading(false);
      }
    };

    loadChannels();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* 顶部状态栏占位 (针对手机端优化) */}
      <div className="h-6 bg-black w-full"></div>

      {/* 播放器区域 */}
      <div className="w-full aspect-video bg-black shadow-lg">
        {currentChannel ? (
          <Player url={currentChannel.url} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <WifiOff size={48} className="text-gray-600 mb-2" />
            <p>暂无可用直播源</p>
          </div>
        )}
      </div>

      {/* 频道列表区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center mb-4 border-b border-gray-700 pb-2">
          <Tv className="mr-2 text-blue-400" size={20} />
          <h2 className="text-xl font-bold">频道列表</h2>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setCurrentChannel(channel)}
              className={`flex items-center p-4 rounded-lg transition-all ${
                currentChannel?.id === channel.id 
                ? 'bg-blue-600 shadow-md scale-[1.02]' 
                : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="bg-gray-900 p-2 rounded mr-3">
                <List size={16} />
              </div>
              <div className="text-left">
                <p className="font-medium">{channel.name}</p>
                <p className="text-xs text-gray-400">{channel.group || '默认分组'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
