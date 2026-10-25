/**
 * transcribe.mjs — turns the voice in a recording into timed text, on this computer (nothing is uploaded).
 * Uses whisper.cpp through @remotion/install-whisper-cpp. First run downloads whisper.cpp and the
 * small English model into video/whisper.cpp/ (git-ignored).
 *   node scripts/transcribe.mjs raw/voice.wav out/voice.json
 */
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from '@remotion/install-whisper-cpp';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const [input, output] = process.argv.slice(2);
const to = path.resolve('whisper.cpp');
const version = '1.5.5';
await installWhisperCpp({ to, version });
await downloadWhisperModel({ model: 'small.en', folder: to });
const result = await transcribe({ inputPath: path.resolve(input), whisperPath: to, whisperCppVersion: version, model: 'small.en', tokenLevelTimestamps: true });
const { captions } = toCaptions({ whisperCppOutput: result });
writeFileSync(output, JSON.stringify(captions, null, 1));
console.log(`${captions.length} words -> ${output}`);
