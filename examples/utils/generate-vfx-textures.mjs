/**
 * Generates the textures of the impact effects example, in `assets/textures/vfx`:
 *
 * - `smoke-flipbook.webp` and `explosion-flipbook.webp`, 8x8 flipbooks of a billowing smoke puff,
 * and of a fireball cooling into smoke. Each frame is a density field of warped billow noise that
 * grows and erodes over time, lit by marching through it towards a light at the top left.
 * - `scorch-decal.webp`, `bullet-hole-decal.webp` and `rune-decal.webp`, decals drawn from noise
 * and distance functions.
 *
 * All the textures use straight alpha. The noise is seeded, so every run writes the same files.
 *
 * Run from the examples folder: `node utils/generate-vfx-textures.mjs [names] [--out dir]`, where
 * the optional names pick some of smoke, explosion, scorch, bulletHole and runeCircle.
 */
import path from 'node:path';

import sharp from 'sharp';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const OUT = outIndex >= 0 ? args.splice(outIndex, 2)[1] : 'assets/textures/vfx';
const ONLY = args;

// ----- Noise -----

const perm = new Uint8Array(512);
{
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        p[i] = i;
    }
    let seed = 1337;
    const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
    }
}

const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const grad = (h, x, y, z) => {
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
};

/**
 * Classic 3D Perlin noise.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @returns {number} The noise, in about the -1 to 1 range.
 */
const perlin = (x, y, z) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    return lerp(
        lerp(
            lerp(grad(perm[AA] & 15, x, y, z), grad(perm[BA] & 15, x - 1, y, z), u),
            lerp(grad(perm[AB] & 15, x, y - 1, z), grad(perm[BB] & 15, x - 1, y - 1, z), u),
            v
        ),
        lerp(
            lerp(grad(perm[AA + 1] & 15, x, y, z - 1), grad(perm[BA + 1] & 15, x - 1, y, z - 1), u),
            lerp(grad(perm[AB + 1] & 15, x, y - 1, z - 1), grad(perm[BB + 1] & 15, x - 1, y - 1, z - 1), u),
            v
        ),
        w
    );
};

/**
 * Fractal noise: octaves of Perlin noise.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} [octaves] - The number of octaves. Defaults to 5.
 * @returns {number} The noise, in about the 0 to 1 range.
 */
const fbm = (x, y, z, octaves = 5) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * perlin(x * f, y * f, z * f);
        norm += amp;
        f *= 2.03;
        amp *= 0.5;
    }
    return sum / norm * 0.5 + 0.5;
};

/**
 * Billow noise: octaves of inverted absolute Perlin noise, which looks puffy, like smoke.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} [octaves] - The number of octaves. Defaults to 5.
 * @returns {number} The noise, mostly in the 0 to 1 range.
 */
const billow = (x, y, z, octaves = 5) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * (1 - Math.abs(perlin(x * f, y * f, z * f)) * 1.6);
        norm += amp;
        f *= 2.03;
        amp *= 0.5;
    }
    return sum / norm;
};

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const toSrgb = c => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));

// ----- Flipbooks -----

const SIZE = 256;
const TILES = 8;

/**
 * Lights a density field: the transmittance of each pixel towards a light at the top left.
 *
 * @param {Float32Array} density - The density of each pixel.
 * @param {number} size - The width and height of the field.
 * @param {number} absorption - How quickly the density absorbs the light.
 * @returns {Float32Array} The transmittance of each pixel.
 */
const lightField = (density, size, absorption) => {
    const lx = -0.55;
    const ly = -0.83;
    const steps = 14;
    const stepLen = size / 48;
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let sum = 0;
            for (let s = 1; s <= steps; s++) {
                // bilinear samples, so the march doesn't band along the light direction
                const fx = x + lx * s * stepLen;
                const fy = y + ly * s * stepLen;
                if (fx < 0 || fy < 0 || fx >= size - 1 || fy >= size - 1) break;
                const ix = Math.floor(fx);
                const iy = Math.floor(fy);
                const tx = fx - ix;
                const ty = fy - iy;
                const i0 = iy * size + ix;
                sum += lerp(lerp(density[i0], density[i0 + 1], tx), lerp(density[i0 + size], density[i0 + size + 1], tx), ty);
            }
            out[y * size + x] = Math.exp(-sum * absorption);
        }
    }
    return out;
};

/**
 * The shape of a puff.
 *
 * @typedef {object} PuffOptions
 * @property {number} r0 - The radius at the start, as a fraction of the frame.
 * @property {number} r1 - The radius at the end.
 * @property {number} growPower - How quickly the puff grows at the start.
 * @property {number} evolve - How much the noise changes over the life of the puff.
 * @property {number} seed - The offset of the noise.
 * @property {number} warp - How much the noise is warped.
 * @property {number} freq - The frequency of the billows.
 * @property {number} edgeNoise - How ragged the edge is.
 * @property {number} core - The radius of the solid core, as a fraction of the radius.
 * @property {number} gain - The density multiplier.
 * @property {number} soft - The softness of the erosion threshold.
 * @property {number} erode0 - The erosion threshold at the start.
 * @property {number} erode1 - The erosion threshold at the end.
 * @property {number} erodeStart - When the erosion starts, 0 to 1.
 */

/**
 * Computes one frame of a puff.
 *
 * @param {number} t - The time of the frame, 0 to 1.
 * @param {number} size - The width and height of the frame.
 * @param {PuffOptions} o - The shape of the puff.
 * @returns {{ density: Float32Array, n: Float32Array, r: Float32Array }} The density, the billow
 * noise, and the distance from the center as a fraction of the radius, of each pixel.
 */
const puffFrame = (t, size, o) => {
    const density = new Float32Array(size * size);
    const nf = new Float32Array(size * size);
    const rf = new Float32Array(size * size);
    const grow = 1 - Math.pow(1 - t, o.growPower);
    const R = o.r0 + (o.r1 - o.r0) * grow;
    const z = t * o.evolve + o.seed;
    // the erosion threshold rises over time, so the puff breaks up and dissipates
    const thr = o.erode0 + (o.erode1 - o.erode0) * smoothstep(o.erodeStart, 1, t);
    // the last frames thin out as well, so the puff fades instead of breaking into hard pieces
    const fadeOut = 1 - 0.7 * smoothstep(0.6, 1, t);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const px = ((x + 0.5) / size) * 2 - 1;
            const py = ((y + 0.5) / size) * 2 - 1;
            // the noise scales with the radius, so the billows grow with the puff
            const sx = px / R;
            const sy = py / R;
            const wx = fbm(sx * 1.3 + 5.2, sy * 1.3 + 1.3, z * 0.6, 3) * 2 - 1;
            const wy = fbm(sx * 1.3 + 1.7, sy * 1.3 + 9.2, z * 0.6, 3) * 2 - 1;
            const qx = sx + wx * o.warp;
            const qy = sy + wy * o.warp;
            const n = billow(qx * o.freq, qy * o.freq, z, 5);
            const r = Math.sqrt(px * px + py * py);
            const edge = r / R + (0.5 - n) * o.edgeNoise;
            const shape = 1 - smoothstep(o.core, 1, edge);
            const v = shape * (0.45 + 0.9 * n);
            const d = clamp01(smoothstep(thr, thr + o.soft, v) * o.gain) * fadeOut;
            const i = y * size + x;
            // stay inside the frame
            density[i] = d * smoothstep(1, 0.92, r);
            nf[i] = n;
            rf[i] = r / R;
        }
    }
    return { density, n: nf, r: rf };
};

/**
 * Writes a flipbook.
 *
 * @param {string} name - The file name, without the extension.
 * @param {(t: number) => { rgb: Float32Array, alpha: Float32Array }} frameFn - Computes the
 * linear color and the alpha of a frame, for a time of 0 to 1.
 */
const writeAtlas = async (name, frameFn) => {
    const w = TILES * SIZE;
    const buf = Buffer.alloc(w * w * 4);
    const frames = TILES * TILES;
    for (let f = 0; f < frames; f++) {
        const t = f / (frames - 1);
        const { rgb, alpha } = frameFn(t);
        const ox = (f % TILES) * SIZE;
        const oy = Math.floor(f / TILES) * SIZE;
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const i = y * SIZE + x;
                const o = ((oy + y) * w + ox + x) * 4;
                buf[o] = toSrgb(clamp01(rgb[i * 3]));
                buf[o + 1] = toSrgb(clamp01(rgb[i * 3 + 1]));
                buf[o + 2] = toSrgb(clamp01(rgb[i * 3 + 2]));
                buf[o + 3] = Math.round(clamp01(alpha[i]) * 255);
            }
        }
        process.stdout.write(`${name} ${f + 1}/${frames}\r`);
    }
    // Lossless alpha, as lossy alpha shows blocks where the puffs break up. Exact keeps the color
    // under transparent pixels, which the mipmaps blend in at the edges.
    await sharp(buf, { raw: { width: w, height: w, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100, effort: 6, exact: true })
    .toFile(path.join(OUT, `${name}.webp`));
    console.log(`\n${name}.webp written`);
};

// A grey puff of smoke, lit from the top left
const smoke = () => writeAtlas('smoke-flipbook', (t) => {
    const { density, n } = puffFrame(t, SIZE, {
        r0: 0.38,
        r1: 0.92,
        growPower: 2.2,
        evolve: 1.4,
        seed: 3.1,
        warp: 0.45,
        freq: 1.7,
        edgeNoise: 0.55,
        core: 0.25,
        gain: 1,
        soft: 0.5,
        erode0: 0.0,
        erode1: 0.8,
        erodeStart: 0.25
    });
    const T = lightField(density, SIZE, 0.17);
    const rgb = new Float32Array(SIZE * SIZE * 3);
    for (let i = 0; i < SIZE * SIZE; i++) {
        // ambient plus light, with the billows adding detail
        const lit = (0.12 + 0.88 * T[i]) * (0.7 + 0.45 * n[i]);
        rgb[i * 3] = lit;
        rgb[i * 3 + 1] = lit;
        rgb[i * 3 + 2] = lit * 1.02;
    }
    return { rgb, alpha: density };
});

// The colors of the fire by temperature: temperature, then red, green and blue
const fireRamp = [
    [0.0, 0.0, 0.0, 0.0],
    [0.15, 0.25, 0.03, 0.01],
    [0.35, 0.85, 0.18, 0.02],
    [0.55, 1.0, 0.45, 0.08],
    [0.75, 1.0, 0.75, 0.3],
    [1.0, 1.0, 0.97, 0.85]
];
const ramp = (v) => {
    for (let i = 1; i < fireRamp.length; i++) {
        if (v <= fireRamp[i][0]) {
            const a = fireRamp[i - 1];
            const b = fireRamp[i];
            const k = (v - a[0]) / (b[0] - a[0]);
            return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
        }
    }
    return fireRamp[fireRamp.length - 1].slice(1);
};

// A fireball, hot in the middle and in the dense billows, cooling into smoke
const explosion = () => writeAtlas('explosion-flipbook', (t) => {
    const { density, n, r } = puffFrame(t, SIZE, {
        r0: 0.3,
        r1: 0.95,
        growPower: 3.2,
        evolve: 1.8,
        seed: 11.7,
        warp: 0.6,
        freq: 1.9,
        edgeNoise: 0.7,
        core: 0.15,
        gain: 1,
        soft: 0.4,
        erode0: 0.0,
        erode1: 0.8,
        erodeStart: 0.45
    });
    const T = lightField(density, SIZE, 0.07);
    const rgb = new Float32Array(SIZE * SIZE * 3);
    const alpha = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const d = density[i];
        const temp = clamp01((1 - r[i]) * 1.35 + (n[i] - 0.5) * 0.9 - t * 1.25 + 0.15);
        const heat = smoothstep(0.12, 0.55, temp);
        const fire = ramp(temp);
        // the fire is drawn with an intensity above 1 so that it blooms, which brightens the
        // smoke as well, so the smoke is dark
        const smokeShade = 0.03 + 0.09 * T[i];
        for (let c = 0; c < 3; c++) {
            rgb[i * 3 + c] = smokeShade * (1 - heat) + fire[c] * heat;
        }
        alpha[i] = d * (1 - heat * 0.15);
    }
    return { rgb, alpha };
});

// ----- Decals -----

/**
 * Writes a decal.
 *
 * @param {string} name - The file name, without the extension.
 * @param {number} size - The width and height.
 * @param {(x: number, y: number) => number[]} fn - Computes the linear color and the alpha of a
 * pixel, for coordinates of -1 to 1 from the center.
 */
const writeImage = async (name, size, fn) => {
    const buf = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const px = ((x + 0.5) / size) * 2 - 1;
            const py = ((y + 0.5) / size) * 2 - 1;
            const [cr, cg, cb, a] = fn(px, py);
            const o = (y * size + x) * 4;
            buf[o] = toSrgb(clamp01(cr));
            buf[o + 1] = toSrgb(clamp01(cg));
            buf[o + 2] = toSrgb(clamp01(cb));
            buf[o + 3] = Math.round(clamp01(a) * 255);
        }
    }
    await sharp(buf, { raw: { width: size, height: size, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 95 })
    .toFile(path.join(OUT, `${name}.webp`));
    console.log(`${name}.webp written`);
};

// A scorch mark: a burnt center, with soot streaks radiating out
const scorch = () => writeImage('scorch-decal', 512, (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const ang = Math.atan2(y, x);
    const n = fbm(x * 3, y * 3, 0.5, 5);
    const grain = fbm(x * 14, y * 14, 4.5, 3);
    const streak = fbm(Math.cos(ang) * 5 + 10, Math.sin(ang) * 5 + 10, r * 2.5, 4);
    const reach = 0.5 + Math.pow(streak, 1.4) * 0.8;
    const shape = (1 - smoothstep(0.3, reach, r + (n - 0.5) * 0.3)) * smoothstep(1, 0.9, r);
    // the center is fully opaque: on a glossy surface, even 1% of a bright highlight shows through
    const core = 1 - smoothstep(0.15, 0.6, r + (n - 0.5) * 0.3);
    const a = 1.15 * Math.max(Math.pow(shape, 0.45) * (0.65 + 0.35 * smoothstep(0.3, 0.7, grain)), core);
    const shade = 0.015 + 0.06 * grain * (1 - core);
    return [shade, shade * 0.85, shade * 0.7, Math.min(1, a)];
});

// A bullet hole, in a crater of freshly exposed material that the decal color tints
const bulletHole = () => writeImage('bullet-hole-decal', 256, (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const ang = Math.atan2(y, x);
    const n = fbm(x * 6, y * 6, 2.5, 4);
    const hole = 1 - smoothstep(0.13, 0.16, r + (n - 0.5) * 0.05);
    const crater = smoothstep(0.12, 0.18, r) * (1 - smoothstep(0.3, 0.42, r + (n - 0.5) * 0.18));
    // cracks: thin dark radial lines of noise
    const crackNoise = Math.abs(perlin(Math.cos(ang) * 2.5 + 3, Math.sin(ang) * 2.5 + 3, r * 3));
    const crack = (1 - smoothstep(0.0, 0.035, crackNoise)) * (1 - smoothstep(0.3, 0.9, r)) * smoothstep(0.15, 0.25, r);
    // a faint ring of soot outside the crater
    const soot = smoothstep(0.25, 0.4, r) * (1 - smoothstep(0.4, 0.7, r + (n - 0.5) * 0.2)) * 0.35;
    if (hole > 0.5) return [0.01, 0.01, 0.01, 1];
    if (crack > 0.5 && crater < 0.5) return [0.03, 0.03, 0.03, crack * 0.8];
    const chips = 0.55 + 0.45 * fbm(x * 18, y * 18, 7.5, 3);
    const shade = crater > 0.01 ? chips * (0.6 + 0.4 * (r / 0.42)) : 0.04;
    return [shade, shade, shade, Math.max(hole, crater * 0.95, soot)];
});

// A magic rune circle: rings, ticks, glyphs and a hexagram, in white for the decal to color
const runeCircle = () => writeImage('rune-decal', 512, (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const ang = Math.atan2(y, x);
    const line = (d, w) => 1 - smoothstep(w * 0.5, w, Math.abs(d));
    let v = 0;
    v = Math.max(v, line(r - 0.93, 0.025), line(r - 0.86, 0.012), line(r - 0.6, 0.015), line(r - 0.53, 0.01), line(r - 0.2, 0.012));
    // ticks between the outer rings
    const tick = Math.abs(((ang / (Math.PI * 2)) * 72) % 1 - 0.5);
    if (r > 0.87 && r < 0.92) v = Math.max(v, line(tick - 0.5, 0.12));
    // glyphs: small arcs, bars and dots between the middle rings
    const seg = ((ang / (Math.PI * 2)) * 16 + 16) % 1;
    const segIdx = Math.floor(((ang / (Math.PI * 2)) * 16 + 16)) % 16;
    if (r > 0.62 && r < 0.84) {
        const gy = (r - 0.62) / 0.22;
        const pattern = (segIdx * 7919) % 5;
        if (pattern === 0) v = Math.max(v, line(seg - 0.5, 0.06) * smoothstep(0.1, 0.2, gy) * smoothstep(0.9, 0.8, gy));
        if (pattern === 1) v = Math.max(v, line(Math.hypot(seg - 0.5, (gy - 0.5) * 0.6) - 0.22, 0.05));
        if (pattern === 2) v = Math.max(v, line(gy - 0.5, 0.08) * smoothstep(0.1, 0.25, seg) * smoothstep(0.9, 0.75, seg));
        if (pattern === 3) v = Math.max(v, 1 - smoothstep(0.08, 0.13, Math.hypot(seg - 0.5, (gy - 0.5) * 0.5)));
        if (pattern === 4) v = Math.max(v, line(seg - gy, 0.07) * smoothstep(0.05, 0.15, gy) * smoothstep(0.95, 0.85, gy));
    }
    // a hexagram: two triangles inscribed in the middle ring
    const tri = (rot) => {
        let d = -1e9;
        for (let k = 0; k < 3; k++) {
            const a = rot + (k * Math.PI * 2) / 3;
            d = Math.max(d, x * Math.cos(a) + y * Math.sin(a));
        }
        return d - 0.265;
    };
    if (r < 0.6) v = Math.max(v, line(tri(Math.PI / 2), 0.014), line(tri(-Math.PI / 2), 0.014));
    // a soft glow under the lines
    const glow = (1 - smoothstep(0.0, 1.0, r)) * 0.12;
    return [1, 1, 1, Math.max(v, glow)];
});

const textures = { smoke, explosion, scorch, bulletHole, runeCircle };
await Promise.all(
    Object.entries(textures)
    .filter(([name]) => ONLY.length === 0 || ONLY.includes(name))
    .map(([, generate]) => generate())
);
