/**
 * denoise.mjs — removes steady background noise (hiss, hum, fan, room tone) from a voice recording.
 *
 * How it works ("spectral gating"): the sound is cut into short overlapping slices, and each slice is
 * split into frequencies (an FFT). For every frequency, the script learns how loud the background is
 * from the quietest moments. Then, in every slice, frequencies that aren't clearly louder than the
 * background are turned down, and the slices are stitched back together. The voice stays; the steady
 * noise underneath it drops away. No extra software needed.
 *
 *   node scripts/denoise.mjs input.wav output.wav   (16-bit mono WAV)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
const N = 2048; // slice length (about 43 ms at 48 kHz)
const HOP = N / 4; // slices overlap by 75%
const REDUCE = 0.1; // how far noise-only sound is turned down (-20 dB)
const MARGIN = 3; // how much louder than the average background a sound must be to count as voice

// --- read a 16-bit PCM WAV ---
const buf = readFileSync(input);
let pos = 12;
let fmt;
let data;
while (pos < buf.length) {
  const id = buf.toString('ascii', pos, pos + 4);
  const size = buf.readUInt32LE(pos + 4);
  if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(pos + 10), rate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
  if (id === 'data') data = buf.subarray(pos + 8, pos + 8 + size);
  pos += 8 + size + (size % 2);
}
if (!fmt || fmt.channels !== 1 || fmt.bits !== 16) throw new Error('Expected a 16-bit mono WAV');
const x = new Float32Array(data.length / 2);
for (let i = 0; i < x.length; i++) x[i] = data.readInt16LE(i * 2) / 32768;

// --- FFT (in place, radix 2) ---
const fft = (re, im, inverse) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) (re[i] /= n), (im[i] /= n);
};

const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
const frames = Math.floor((x.length - N) / HOP) + 1;
const bins = N / 2 + 1;

// Pass 1: loudness of every frequency in every slice.
const mags = [];
const specs = [];
for (let f = 0; f < frames; f++) {
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = x[f * HOP + i] * win[i];
  fft(re, im, false);
  const m = new Float32Array(bins);
  for (let b = 0; b < bins; b++) m[b] = Math.hypot(re[b], im[b]);
  mags.push(m);
  specs.push([re, im]);
}

// The background level of each frequency: its average loudness in the quietest 20% of slices
// (the pauses between sentences, where there's only background noise).
const energy = mags.map((m, f) => [m.reduce((a, v) => a + v * v, 0), f]).sort((a, b) => a[0] - b[0]);
const quiet = energy.slice(0, Math.max(1, Math.floor(frames * 0.2))).map(([, f]) => f);
const noise = new Float32Array(bins);
for (let b = 0; b < bins; b++) noise[b] = quiet.reduce((a, f) => a + mags[f][b], 0) / quiet.length;

// Pass 2: a gain per slice and frequency, smoothed so it doesn't flutter, then rebuild the sound.
const y = new Float32Array(x.length);
const norm = new Float32Array(x.length);
let prev = new Float32Array(bins).fill(1);
for (let f = 0; f < frames; f++) {
  const [re, im] = specs[f];
  const gain = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    const snr = mags[f][b] / (noise[b] * MARGIN + 1e-9);
    // Below about 80 Hz there's only rumble (room, handling, traffic), never voice: turn it down.
    const g = (b * fmt.rate) / N < 80 ? REDUCE : snr >= 1 ? 1 : REDUCE + (1 - REDUCE) * snr ** 4;
    // Open quickly when the voice starts, close slowly after it stops.
    gain[b] = g > prev[b] ? g : prev[b] * 0.7 + g * 0.3;
  }
  // Blur across neighboring frequencies too.
  for (let b = 0; b < bins; b++) {
    const g = (gain[Math.max(0, b - 1)] + 2 * gain[b] + gain[Math.min(bins - 1, b + 1)]) / 4;
    re[b] *= g;
    im[b] *= g;
    if (b > 0 && b < N / 2) {
      re[N - b] *= g;
      im[N - b] *= g;
    }
  }
  prev = gain;
  fft(re, im, true);
  for (let i = 0; i < N; i++) {
    y[f * HOP + i] += re[i] * win[i];
    norm[f * HOP + i] += win[i] * win[i];
  }
}

// --- write the cleaned WAV ---
const out = Buffer.alloc(44 + x.length * 2);
out.write('RIFF', 0);
out.writeUInt32LE(36 + x.length * 2, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(1, 22);
out.writeUInt32LE(fmt.rate, 24);
out.writeUInt32LE(fmt.rate * 2, 28);
out.writeUInt16LE(2, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(x.length * 2, 40);
for (let i = 0; i < x.length; i++) {
  const v = norm[i] > 1e-6 ? y[i] / norm[i] : 0;
  out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2);
}
writeFileSync(output, out);
console.log(`Cleaned ${(x.length / fmt.rate).toFixed(1)} s -> ${output}`);
