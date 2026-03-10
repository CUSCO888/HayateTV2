export interface Channel {
  id: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

export function parseM3U(content: string): { channels: Channel[], tvgUrl?: string } {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};
  let tvgUrl: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (i === 0 && line.toUpperCase().startsWith('#EXTM3U')) {
      const match = line.match(/x-tvg-url="([^"]+)"/i);
      if (match) tvgUrl = match[1];
    }
    
    if (line.startsWith('#EXTINF:')) {
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      
      const commaIndex = line.lastIndexOf(',');
      const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Unknown Channel';

      currentChannel = {
        id: tvgIdMatch ? tvgIdMatch[1] : '',
        name: tvgNameMatch ? tvgNameMatch[1] : name,
        logo: tvgLogoMatch ? tvgLogoMatch[1] : '',
        group: groupTitleMatch ? groupTitleMatch[1] : 'Uncategorized',
      };
    } else if (line && !line.startsWith('#')) {
      if (currentChannel.name) {
        channels.push({
          id: currentChannel.id || '',
          name: currentChannel.name,
          logo: currentChannel.logo || '',
          group: currentChannel.group || 'Uncategorized',
          url: line
        });
        currentChannel = {};
      }
    }
  }
  return { channels, tvgUrl };
}

export function parseTXT(content: string): Channel[] {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentGroup = 'Uncategorized';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.endsWith(',#genre#')) {
      currentGroup = trimmed.split(',')[0].trim();
      continue;
    }

    const parts = trimmed.split(',');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const url = parts.slice(1).join(',').trim();
      if (url.startsWith('http')) {
        channels.push({
          id: '',
          name,
          logo: '',
          group: currentGroup,
          url
        });
      }
    }
  }
  return channels;
}

export interface Program {
  title: string;
  start: Date;
  stop: Date;
  desc: string;
}

export interface EPGData {
  [channelId: string]: Program[];
}

export function parseEPG(xmlText: string): EPGData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const programmes = xmlDoc.getElementsByTagName("programme");
  
  const epg: EPGData = {};
  
  const parseTime = (t: string) => {
    const match = t.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
    if (!match) return new Date();
    
    const [, year, month, day, hour, min, sec, offset] = match;
    let isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    if (offset) {
      isoStr += `${offset.substring(0,3)}:${offset.substring(3,5)}`;
    } else {
      isoStr += 'Z';
    }
    return new Date(isoStr);
  };
  
  for (let i = 0; i < programmes.length; i++) {
    const prog = programmes[i];
    const channelId = prog.getAttribute("channel");
    const startStr = prog.getAttribute("start");
    const stopStr = prog.getAttribute("stop");
    
    if (!channelId || !startStr || !stopStr) continue;
    
    const titleNode = prog.getElementsByTagName("title")[0];
    const descNode = prog.getElementsByTagName("desc")[0];
    
    const title = titleNode?.textContent || "Unknown Program";
    const desc = descNode?.textContent || "";
    
    const start = parseTime(startStr);
    const stop = parseTime(stopStr);
    
    if (!epg[channelId]) {
      epg[channelId] = [];
    }
    epg[channelId].push({ title, start, stop, desc });
  }
  
  return epg;
}
