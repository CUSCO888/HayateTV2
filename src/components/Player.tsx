import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface PlayerProps {
  url: string;
  onError?: () => void;
}

export default function Player({ url, onError }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let hls: Hls;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log("Autoplay prevented", e));
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("fatal network error encountered, try to recover");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("fatal media error encountered, try to recover");
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (onError) onError();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log("Autoplay prevented", e));
      });
      video.addEventListener('error', () => {
        if (onError) onError();
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [url, onError]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      controls={false}
      autoPlay
    />
  );
}
