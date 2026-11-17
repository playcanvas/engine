/**
 * Generates the sounds of the Ocean Assault demo:
 *
 * - `assets/sounds/ocean-assault.mp3`, every sound of the game, one after another, with silence
 * between them.
 * - `assets/sounds/ocean-assault.json`, where each sound starts in that file and how long it is,
 * in seconds, by name. The game gives each one to a slot of a sound component.
 *
 * Every sound is made here, so the sounds are original: square, triangle and saw waves whose pitch
 * slides and whose level fades, and bursts of noise through a low pass filter that closes.
 *
 * Run from the examples folder: `node utils/generate-ocean-assault-sounds.mjs`. It needs `ffmpeg`
 * on the path, to encode the mp3.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = 'assets/sounds';
const NAME = 'ocean-assault';
const RATE = 44100;

// Silence before the first sound and between sounds. An mp3 can decode a few hundredths of a
// second early or late, depending on the decoder, so each sound's part of the file starts a
// little before the sound and ends a little after it, in that silence.
const LEAD = 0.1;
const GAP = 0.25;
const BEFORE = 0.01;
const AFTER = 0.06;

// The loudest sample of the file. The game sets how loud the sounds are played.
const PEAK = 0.95;

// ---------------------------------------------------------------- waves and noise

/**
 * A wave built from its harmonics, up to the highest the file can hold, so that a bright wave
 * sliding in pitch does not fold back as a whine.
 *
 * @type {Record<string, (phase: number, harmonics: number) => number>}
 */
const WAVES = {
    square(phase, harmonics) {
        let sum = 0;
        for (let k = 1; k <= harmonics; k += 2) sum += Math.sin(k * phase) / k;
        return (4 / Math.PI) * sum;
    },
    triangle(phase, harmonics) {
        let sum = 0;
        for (let k = 1, sign = 1; k <= harmonics; k += 2, sign = -sign) sum += (sign * Math.sin(k * phase)) / (k * k);
        return (8 / (Math.PI * Math.PI)) * sum;
    },
    sawtooth(phase, harmonics) {
        let sum = 0;
        for (let k = 1, sign = 1; k <= harmonics; k++, sign = -sign) sum += (sign * Math.sin(k * phase)) / k;
        return (2 / Math.PI) * sum;
    }
};
const TOP = 16000;
const MOST_HARMONICS = 200;

/**
 * @param {number} from - The value at the start.
 * @param {number} to - The value at the end.
 * @param {number} t - How far through, from 0 to 1.
 * @returns {number} The value part way, each step multiplying it by as much.
 */
const slide = (from, to, t) => from * Math.pow(to / from, t);

/**
 * A note whose pitch slides and whose level fades to nothing.
 *
 * @param {Float32Array} out - The samples to add the note to.
 * @param {number} at - The time the note starts, in seconds.
 * @param {keyof typeof WAVES} type - The wave.
 * @param {number} from - The pitch it starts at, in hertz.
 * @param {number} to - The pitch it ends at.
 * @param {number} time - How long it lasts, in seconds.
 * @param {number} level - How loud it is.
 */
const tone = (out, at, type, from, to, time, level) => {
    const wave = WAVES[type];
    const start = Math.round(at * RATE);
    const count = Math.round(time * RATE);
    let phase = 0;
    for (let i = 0; i < count; i++) {
        const t = i / count;
        const pitch = slide(from, to, t);
        const harmonics = Math.max(1, Math.min(MOST_HARMONICS, Math.floor(TOP / pitch)));
        out[start + i] += wave(phase, harmonics) * slide(level, 0.001, t);
        phase += (Math.PI * 2 * pitch) / RATE;
    }
};

/**
 * @param {number} seed - The seed.
 * @returns {() => number} A source of numbers from -1 to 1, the same every time for a seed.
 */
const noise = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let n = state;
        n = Math.imul(n ^ (n >>> 15), n | 1);
        n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
        return (((n ^ (n >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    };
};

// How peaked the low pass filter is where it cuts off: one decibel
const RESONANCE = Math.pow(10, 1 / 20);

/**
 * A burst of noise through a low pass filter that closes, or opens, as the burst fades.
 *
 * @param {Float32Array} out - The samples to add the burst to.
 * @param {number} at - The time the burst starts, in seconds.
 * @param {number} from - The frequency the filter starts at, in hertz.
 * @param {number} to - The frequency the filter ends at.
 * @param {number} time - How long it lasts, in seconds.
 * @param {number} level - How loud it is.
 * @param {number} seed - The seed of the noise.
 */
const burst = (out, at, from, to, time, level, seed) => {
    const random = noise(seed);
    const start = Math.round(at * RATE);
    const count = Math.round(time * RATE);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < count; i++) {
        const t = i / count;

        // a second order low pass filter, whose cut off moves with every sample
        const w = (Math.PI * 2 * slide(from, to, t)) / RATE;
        const cos = Math.cos(w);
        const alpha = Math.sin(w) / (2 * RESONANCE);
        const b1 = 1 - cos;
        const b0 = b1 / 2;
        const x = random();
        const y = (b0 * x + b1 * x1 + b0 * x2 + 2 * cos * y1 - (1 - alpha) * y2) / (1 + alpha);
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        out[start + i] += y * slide(level, 0.001, t);
    }
};

// ---------------------------------------------------------------- the sounds

/**
 * Each sound: how long it lasts, in seconds, and what it is made of.
 *
 * @type {Record<string, { time: number, make: (out: Float32Array) => void }>}
 */
const SOUNDS = {
    // the player's guns
    shot: {
        time: 0.07,
        make: out => tone(out, 0, 'square', 980, 420, 0.07, 0.1)
    },

    // a shot landing on something that is still flying
    hit: {
        time: 0.05,
        make: out => tone(out, 0, 'square', 260, 170, 0.05, 0.14)
    },

    // a gunboat's missile leaving its deck
    launch: {
        time: 0.4,
        make: (out) => {
            burst(out, 0, 600, 3000, 0.4, 0.4, 1);
            tone(out, 0, 'sawtooth', 150, 400, 0.3, 0.1);
        }
    },

    // a small raider going up
    boom: {
        time: 0.3,
        make: (out) => {
            burst(out, 0, 2400, 220, 0.3, 0.6, 2);
            tone(out, 0, 'triangle', 190, 50, 0.22, 0.5);
        }
    },

    // a big one
    blast: {
        time: 0.9,
        make: (out) => {
            burst(out, 0, 3200, 90, 0.9, 0.9, 3);
            tone(out, 0, 'triangle', 120, 30, 0.7, 0.8);
            tone(out, 0.08, 'sawtooth', 90, 35, 0.4, 0.3);
        }
    },

    // a power up collected
    pickup: {
        time: 0.21,
        make: out => [660, 880, 1320].forEach((pitch, i) => tone(out, i * 0.06, 'square', pitch, pitch, 0.09, 0.12))
    },

    // the player's seaplane going down
    crash: {
        time: 0.8,
        make: (out) => {
            tone(out, 0, 'sawtooth', 520, 40, 0.8, 0.35);
            burst(out, 0, 2600, 120, 0.8, 0.8, 4);
        }
    },

    // the game starting
    start: {
        time: 0.41,
        make: out => [392, 523, 659, 784].forEach((pitch, i) => tone(out, i * 0.09, 'square', pitch, pitch, 0.14, 0.12))
    },

    // the airship arriving
    alarm: {
        time: 1.76,
        make: (out) => {
            for (let i = 0; i < 6; i++) tone(out, i * 0.3, 'square', i % 2 ? 370 : 494, i % 2 ? 370 : 494, 0.26, 0.11);
        }
    }
};

// ---------------------------------------------------------------- the file

// one after another, with silence between
const names = Object.keys(SOUNDS);
const length = LEAD + names.reduce((sum, name) => sum + SOUNDS[name].time + GAP, 0);
const samples = new Float32Array(Math.ceil(length * RATE));

/** @type {string[]} */
const lines = [];
let at = LEAD;
for (const name of names) {
    const { time, make } = SOUNDS[name];
    const sound = new Float32Array(Math.round(time * RATE));
    make(sound);
    samples.set(sound, Math.round(at * RATE));
    const start = (at - BEFORE).toFixed(3);
    const duration = (time + BEFORE + AFTER).toFixed(3);
    lines.push(`        ${JSON.stringify(name)}: { "start": ${Number(start)}, "duration": ${Number(duration)} }`);
    at += time + GAP;
}

// as loud as the file can hold
const loudest = samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
const scale = PEAK / loudest;

// a 16 bit wave file, for ffmpeg to encode
const wave = Buffer.alloc(44 + samples.length * 2);
wave.write('RIFF', 0);
wave.writeUInt32LE(36 + samples.length * 2, 4);
wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(RATE, 24);
wave.writeUInt32LE(RATE * 2, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write('data', 36);
wave.writeUInt32LE(samples.length * 2, 40);
samples.forEach((sample, i) => wave.writeInt16LE(Math.round(sample * scale * 32767), 44 + i * 2));

fs.mkdirSync(OUT, { recursive: true });
const folder = fs.mkdtempSync(path.join(os.tmpdir(), `${NAME}-`));
const waveFile = path.join(folder, `${NAME}.wav`);
fs.writeFileSync(waveFile, wave);
try {
    execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error', '-i', waveFile,
        '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', '-fflags', '+bitexact',
        `${OUT}/${NAME}.mp3`
    ]);
} catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
        throw new Error('ffmpeg was not found: it is needed to encode the mp3', { cause: error });
    }
    throw error;
} finally {
    fs.rmSync(folder, { recursive: true });
}

const meta = {
    app: `examples/utils/generate-${NAME}-sounds.mjs`,
    audio: `${NAME}.mp3`
};
const json = `{\n    "sounds": {\n${lines.join(',\n')}\n    },\n    "meta": ${JSON.stringify(meta, null, 4).replace(/\n/g, '\n    ')}\n}\n`;
fs.writeFileSync(`${OUT}/${NAME}.json`, json);

const size = fs.statSync(`${OUT}/${NAME}.mp3`).size;
console.log(`${OUT}/${NAME}.mp3: ${length.toFixed(2)}s, ${names.length} sounds, ${Math.round(size / 1024)} KB`);
