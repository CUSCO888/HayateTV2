import { XMLParser } from 'fast-xml-parser';
import { EPGProgram } from '../types';

export function parseEPG(xmlContent: string): EPGProgram[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
  });

  try {
    const jsonObj = parser.parse(xmlContent);
    const programs: EPGProgram[] = [];

    if (!jsonObj.tv || !jsonObj.tv.programme) return [];

    const rawPrograms = Array.isArray(jsonObj.tv.programme) ? jsonObj.tv.programme : [jsonObj.tv.programme];

    for (const p of rawPrograms) {
      programs.push({
        start: parseXMLTVDate(p.start),
        stop: parseXMLTVDate(p.stop),
        title: typeof p.title === 'string' ? p.title : p.title['#text'] || '',
        desc: p.desc ? (typeof p.desc === 'string' ? p.desc : p.desc['#text']) : undefined,
        channel: p.channel
      });
    }

    return programs;
  } catch (e) {
    console.error("EPG Parse Error", e);
    return [];
  }
}

function parseXMLTVDate(dateStr: string): number {
  // Format: 20231027120000 +0800
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s?([+-]\d{4})?$/);
  if (!match) return 0;

  const [_, y, m, d, h, min, s, tz] = match;
  const isoStr = `${y}-${m}-${d}T${h}:${min}:${s}${tz ? tz.replace(/(\d{2})(\d{2})/, '$1:$2') : 'Z'}`;
  return new Date(isoStr).getTime();
}
