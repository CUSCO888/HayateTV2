import { Channel } from '../types';

export const DEFAULT_M3U_URL = "https://raw.githubusercontent.com/CUSCO888/spider/refs/heads/master/output/hayate.m3u";

export function parseM3U(content: string): { channels: Channel[], epgUrl?: string } {
  if (!content) return { channels: [] };

  // More robust line splitting (handles \n, \r\n, \r)
  const lines = content.split(/\r?\n/);
  const channels: Channel[] = [];
  let epgUrl: string | undefined;

  console.log(`parseM3U: Processing ${lines.length} lines. First 100 chars: ${content.substring(0, 100)}`);

  // Try to find EPG URL in the whole content first (common in some playlists)
  const globalTvgMatch = content.match(/(?:x-tvg-url|url-tvg|#EXT-X-TVG-URL)\s*[:=]\s*["']?([^"'\s>]+)["']?/i);
  if (globalTvgMatch) {
    epgUrl = globalTvgMatch[1];
    console.log("Found EPG URL via global search:", epgUrl);
  }

  let currentChannel: Partial<Channel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const upperLine = line.toUpperCase();

    if (upperLine.includes('#EXTM3U')) {
      // If not already found, try to extract from the header line specifically
      if (!epgUrl) {
        const tvgMatch = line.match(/(?:x-tvg-url|url-tvg)\s*=\s*["']?([^"'\s>]+)["']?/i);
        if (tvgMatch) {
          epgUrl = tvgMatch[1];
          console.log("Detected EPG URL from M3U header:", epgUrl);
        }
      }
      continue;
    }

    if (upperLine.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.*)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const idMatch = line.match(/tvg-id="([^"]+)"/i);

      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : 'Default',
        tvgId: idMatch ? idMatch[1] : undefined
      };
    } else if (line.length > 0 && !line.startsWith('#')) {
      // Line is likely a URL if it's not empty and not a comment
      currentChannel.url = line;
      currentChannel.id = Math.random().toString(36).substr(2, 9);
      if (currentChannel.name && currentChannel.url) {
        channels.push(currentChannel as Channel);
      }
      currentChannel = {};
    }
  }

  // Handle TXT format if no channels found via M3U
  if (channels.length === 0) {
    let currentGroup = "Default";
    for (const line of lines) {
      if (line.includes('#genre#')) {
        currentGroup = line.split(',')[0].trim();
      } else if (line.includes(',')) {
        const [name, url] = line.split(',');
        if (url && url.startsWith('http')) {
          channels.push({
            id: Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            url: url.trim(),
            group: currentGroup,
            logo: ""
          });
        }
      }
    }
  }

  return { channels, epgUrl };
}
