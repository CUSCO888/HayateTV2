import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  url: string;
  onBack: () => void;
  onShowList: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, onBack, onShowList, onNext, onPrev }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (url.endsWith('.m3u8') || url.includes('m3u8')) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(e => console.error("Autoplay blocked", e));
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          video.play();
        });
      }
    } else {
      video.src = url;
      video.play().catch(e => console.error("Autoplay blocked", e));
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [url]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          onPrev();
          break;
        case 'ArrowDown':
          onNext();
          break;
        case 'Enter':
        case 'ArrowLeft':
        case 'ArrowRight':
          onShowList();
          break;
        case 'Escape':
        case 'Backspace':
          onBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onShowList, onBack]);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-0">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        controls={false}
      />
    </div>
  );
};

export default VideoPlayer;
