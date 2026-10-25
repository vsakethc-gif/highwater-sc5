/**
 * ingest-phone.mjs — prepares your phone screen recordings for the video.
 *
 * Put the recordings in video/raw/ named phone-01.mp4 (or .mov), phone-02, … (see VOICEOVER.md).
 * For each one this script uses Remotion's copy of ffmpeg to make a copy in public/footage/ that the
 * video can always play: H.264, 30 frames a second, 780 pixels wide, no sound. The picture itself is
 * not changed (no edits to what's on screen); only the file format and size.
 *   node scripts/ingest-phone.mjs
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const raw = join(root, 'raw');
const out = join(root, 'public', 'footage');
const bin = join(root, 'node_modules', '@remotion', 'compositor-win32-x64-msvc');

const clips = readdirSync(raw).filter((f) => /^phone-\d+\.(mp4|mov|m4v)$/i.test(f)).sort();
if (!clips.length) console.log('No phone-NN recordings in video/raw yet.');
for (const f of clips) {
  const name = f.replace(/\.(mp4|mov|m4v)$/i, '.mp4').toLowerCase();
  execFileSync(join(bin, 'ffmpeg.exe'), ['-y', '-loglevel', 'error', '-i', join(raw, f), '-an', '-vf', 'scale=780:-2,format=yuv420p', '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', join(out, name)]);
  const info = execFileSync(join(bin, 'ffprobe.exe'), ['-v', 'error', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'compact=p=0:nk=1', join(out, name)]).toString().trim().replace(/\s+/g, ' ');
  console.log(`${f} -> public/footage/${name} (${info})`);
}
