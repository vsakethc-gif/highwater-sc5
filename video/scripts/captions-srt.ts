/**
 * captions-srt.ts — writes the video's captions as an .srt file for YouTube, plus the chapter times.
 *   npx tsx scripts/captions-srt.ts
 */
import { writeFileSync } from 'node:fs';
import { CAPTIONS, TIMELINE } from '../src/edit';

const stamp = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
writeFileSync('out/highwater-demo.srt', CAPTIONS.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
for (const s of TIMELINE) console.log(`${Math.floor(s.start / 60)}:${String(Math.floor(s.start % 60)).padStart(2, '0')} ${s.id}`);
