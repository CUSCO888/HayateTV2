import React, { useEffect, useRef, useState } from 'react';

interface MarqueeTextProps {
  text: string;
  className?: string;
}

const MarqueeText: React.FC<MarqueeTextProps> = ({ text, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current && textRef.current) {
        setShouldScroll(textRef.current.offsetWidth > containerRef.current.offsetWidth);
      }
    };

    measure();
    const timer = setTimeout(measure, 200);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden whitespace-nowrap ${className}`}>
      <span
        ref={textRef}
        className={`inline-block ${shouldScroll ? 'animate-marquee-scroll' : ''}`}
      >
        {text}
        {shouldScroll && <span className="ml-12">{text}</span>}
      </span>
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-scroll {
          animation: marquee-scroll 10s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default MarqueeText;
