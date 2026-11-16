/**
 * Generates the sprite sheet of the Storm Petrel demo:
 *
 * - `assets/sprites/storm-petrel.png`, the sheet: the seaplane, the raiders and their airship,
 * shots, explosions, power ups, the sea, islands, clouds and a font.
 * - `assets/sprites/storm-petrel.json`, the frames of the sheet by name, in the JSON hash format
 * that sprite sheet packers export, which a `textureatlas` asset loads.
 *
 * Every sprite is drawn here, so the art is original: small ones from grids of palette
 * characters, mirrored where they are symmetric, and the rest from shapes and noise. Each frame
 * has even dimensions, so that a sprite centered on a whole pixel has its own pixels on the
 * pixels of the screen, and a transparent pixel of padding around it.
 *
 * Run from the examples folder: `node utils/generate-storm-petrel-sheet.mjs`.
 */
import fs from 'node:fs';

import sharp from 'sharp';

const OUT = 'assets/sprites';
const NAME = 'storm-petrel';
const SHEET_WIDTH = 512;

// ---------------------------------------------------------------- colors
const hex = (s, a = 255) => {
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
};

const PAL = {
    '.': [0, 0, 0, 0],
    'k': hex('#141826'), // outline
    'K': hex('#2c3350'), // dark slate
    'g': hex('#59657f'), // mid gray
    'G': hex('#8b98b0'), // light gray
    'l': hex('#c3cbd9'), // pale gray
    'w': hex('#f4f5ef'), // white
    'r': hex('#d1383f'), // red
    'R': hex('#ff6b4a'), // orange red
    'd': hex('#8a2238'), // dark red
    'y': hex('#ffd23f'), // yellow
    'Y': hex('#fff3b0'), // pale yellow
    'o': hex('#ff9a2e'), // orange
    'c': hex('#74e0f0'), // cyan
    'C': hex('#2f93b8'), // dark cyan
    'p': hex('#3a2152'), // dark purple
    'P': hex('#6a3f95'), // purple
    'v': hex('#9a6ad0'), // violet
    'V': hex('#cfa8f2'), // pale violet
    'b': hex('#4a2c1c'), // dark brown
    'B': hex('#80502c'), // brown
    't': hex('#b9803f'), // tan
    'T': hex('#e3b96a'), // light tan
    'm': hex('#ff4f9a'), // pink
    'M': hex('#ffb3d6'), // light pink
    'n': hex('#8f1f5f'), // dark magenta
    'e': hex('#2e9e54'), // green
    'E': hex('#7fe07a'), // light green
    'f': hex('#1c6a3c'), // dark green
    's': hex('#e9d9a3'), // sand
    'S': hex('#c4a96a')  // dark sand
};

// ---------------------------------------------------------------- image
class Img {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.d = new Uint8Array(w * h * 4);
    }

    inside(x, y) {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    get(x, y) {
        if (!this.inside(x, y)) return [0, 0, 0, 0];
        const i = (y * this.w + x) * 4;
        return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
    }

    alpha(x, y) {
        return this.inside(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0;
    }

    set(x, y, c) {
        if (!this.inside(x, y)) return;
        if (typeof c === 'string') c = PAL[c];
        const i = (y * this.w + x) * 4;
        this.d[i] = c[0];
        this.d[i + 1] = c[1];
        this.d[i + 2] = c[2];
        this.d[i + 3] = c[3];
    }

    clone() {
        const out = new Img(this.w, this.h);
        out.d.set(this.d);
        return out;
    }

    // copies the opaque pixels of src
    blit(src, dx, dy) {
        for (let y = 0; y < src.h; y++) {
            for (let x = 0; x < src.w; x++) {
                const c = src.get(x, y);
                if (c[3] > 0) this.set(dx + x, dy + y, c);
            }
        }
        return this;
    }

    // copies every pixel of src, transparent ones too
    paste(src, dx, dy) {
        for (let y = 0; y < src.h; y++) {
            for (let x = 0; x < src.w; x++) this.set(dx + x, dy + y, src.get(x, y));
        }
        return this;
    }

    map(fn) {
        const out = new Img(this.w, this.h);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) out.set(x, y, fn(this.get(x, y), x, y));
        }
        return out;
    }

    flipX() {
        const out = new Img(this.w, this.h);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) out.set(this.w - 1 - x, y, this.get(x, y));
        }
        return out;
    }

    flipY() {
        const out = new Img(this.w, this.h);
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) out.set(x, this.h - 1 - y, this.get(x, y));
        }
        return out;
    }

    // a white silhouette, used for the frame an enemy shows when it is hit
    flash() {
        return this.map(c => (c[3] > 0 ? [255, 255, 255, c[3]] : c));
    }

    // draws a 1 pixel outline around the opaque pixels, inside the image
    outline(color = 'k') {
        const out = this.clone();
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.alpha(x, y) > 0) continue;
                if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)) {
                    out.set(x, y, color);
                }
            }
        }
        return out;
    }

    pad(n) {
        return new Img(this.w + n * 2, this.h + n * 2).paste(this, n, n);
    }

    // the smallest image holding the opaque pixels
    trim() {
        let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (this.alpha(x, y)) {
                    x0 = Math.min(x0, x);
                    y0 = Math.min(y0, y);
                    x1 = Math.max(x1, x);
                    y1 = Math.max(y1, y);
                }
            }
        }
        const out = new Img(x1 - x0 + 1, y1 - y0 + 1);
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) out.set(x - x0, y - y0, this.get(x, y));
        }
        return out;
    }

    scale(n) {
        const out = new Img(this.w * n, this.h * n);
        for (let y = 0; y < out.h; y++) {
            for (let x = 0; x < out.w; x++) out.set(x, y, this.get(Math.floor(x / n), Math.floor(y / n)));
        }
        return out;
    }
}

/**
 * An image from rows of palette characters.
 *
 * @param {string[]} rows - The rows, top first, each a palette character per pixel.
 * @param {object} [options] - The options.
 * @param {boolean} [options.mirror] - Whether the rows are the left half of a symmetric sprite.
 * @returns {Img} The image.
 */
const grid = (rows, { mirror = false } = {}) => {
    const half = rows[0].length;
    rows.forEach((row, i) => {
        if (row.length !== half) throw new Error(`row ${i} is ${row.length} wide, not ${half}: "${row}"`);
    });
    const w = mirror ? half * 2 : half;
    const img = new Img(w, rows.length);
    rows.forEach((row, y) => {
        for (let x = 0; x < half; x++) {
            const c = PAL[row[x]];
            if (!c) throw new Error(`unknown palette character "${row[x]}" in row ${y}`);
            img.set(x, y, c);
            if (mirror) img.set(w - 1 - x, y, c);
        }
    });
    return img;
};

// ---------------------------------------------------------------- noise
const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const hash3 = (x, y, z, seed) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// smooth value noise in 0..1
const noise = (x, y, z = 0, seed = 1) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const s = t => t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;
    const u = s(fx), v = s(fy), w = s(fz);
    const n = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
    return lerp(
        lerp(lerp(n(0, 0, 0), n(1, 0, 0), u), lerp(n(0, 1, 0), n(1, 1, 0), u), v),
        lerp(lerp(n(0, 0, 1), n(1, 0, 1), u), lerp(n(0, 1, 1), n(1, 1, 1), u), v),
        w
    );
};

// ---------------------------------------------------------------- packing
/**
 * Packs named images onto shelves of a sheet, tallest first.
 *
 * @param {{ name: string, img: Img }[]} images - The images.
 * @param {number} width - The width of the sheet, in pixels.
 * @param {number} [padding] - The transparent pixels between the images.
 * @returns {{ sheet: Img, rects: Map<string, { x: number, y: number, w: number, h: number }> }}
 * The sheet, and the rectangle of each image on it, by name.
 */
const pack = (images, width, padding = 1) => {
    const order = [...images].sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w);
    const rects = new Map();
    let x = padding, y = padding, shelf = 0;
    for (const { name, img } of order) {
        if (x + img.w + padding > width) {
            x = padding;
            y += shelf + padding;
            shelf = 0;
        }
        rects.set(name, { x, y, w: img.w, h: img.h });
        x += img.w + padding;
        shelf = Math.max(shelf, img.h);
    }
    const height = Math.ceil((y + shelf + padding) / 4) * 4;
    const sheet = new Img(width, height);
    for (const { name, img } of images) {
        const r = rects.get(name);
        sheet.paste(img, r.x, r.y);
    }
    return { sheet, rects };
};

// ---------------------------------------------------------------- the frames
/** @type {{ name: string, img: Img }[]} */
const frames = [];
// A frame is centered on its entity, so an odd width or height would put its pixels half way
// between those of the screen. Each frame is padded to even dimensions.
const add = (name, img) => {
    const w = img.w + (img.w & 1);
    const h = img.h + (img.h & 1);
    if (w !== img.w || h !== img.h) img = new Img(w, h).paste(img, 0, 0);
    frames.push({ name, img });
    return img;
};

// ---------------------------------------------------------------- the player's seaplane
const playerBase = grid([
    '............',
    '...........k',
    '..........kg',
    '..........kl',
    '.........klw',
    '.....kk..klw',
    '....kGGk.klw',
    '....klGk.kCc',
    '....klGk.kCc',
    '.kkkkkkkkkCc',
    'kwrrwwwwwwlw',
    'kwrrwwwwwwlw',
    'klrrlllllllw',
    'kGddGGGGGGlw',
    '.kkkkkkkkklw',
    '....kGGk.klw',
    '.....kk..klw',
    '.........klw',
    '..........kw',
    '......kkkkkr',
    '.....kwwwwwr',
    '.....kGllllr',
    '......kkkkkr',
    '...........k'
], { mirror: true });

// the propeller: a blurred disc, drawn as a line that changes length
const withProp = (img, wide) => {
    const out = img.clone();
    const y = 1;
    const c = img.w / 2;
    const span = wide ? 5 : 3;
    for (let i = 1; i <= span; i++) {
        const color = [244, 245, 239, wide ? 150 : 210];
        if (!out.alpha(c - 1 - i, y)) out.set(c - 1 - i, y, color);
        if (!out.alpha(c + i, y)) out.set(c + i, y, color);
    }
    return out;
};

// a darker shade of each color, for the wing that dips in a banked turn
const DARKER = new Map([
    ['w', 'l'], ['l', 'G'], ['G', 'g'], ['g', 'K'], ['r', 'd'], ['c', 'C'], ['C', 'K'],
    ['v', 'P'], ['V', 'v'], ['P', 'p'], ['y', 'o'], ['t', 'B'], ['T', 't'], ['B', 'b']
].map(([from, to]) => [PAL[from].join(), PAL[to]]));
const darker = c => DARKER.get(c.join()) ?? c;

/**
 * Rolls a top down aircraft: the wing on one side dips, so it shows shorter and darker, and the
 * other shortens a little.
 *
 * @param {Img} img - The aircraft, wings level.
 * @param {number} dir - The side that dips: -1 for the left, 1 for the right.
 * @param {number} [core] - The columns each side of the middle that keep their width.
 * @param {number} [near] - How much of its length the dipped wing shows.
 * @param {number} [far] - How much of its length the raised wing shows.
 * @returns {Img} The banked aircraft.
 */
const bank = (img, dir, core = 3, near = 0.62, far = 0.86) => {
    const half = img.w / 2;
    const out = new Img(img.w, img.h);
    for (let y = 0; y < img.h; y++) {
        for (const side of [-1, 1]) {
            const s = side === dir ? near : far;
            const n = Math.round((half - core) * s);
            for (let t = 0; t < core + n; t++) {
                const src = t < core ? t : core + Math.floor((t - core + 0.5) / n * (half - core));
                const sx = side < 0 ? half - 1 - src : half + src;
                const dx = side < 0 ? half - 1 - t : half + t;
                let c = img.get(sx, y);
                if (side === dir && t >= core && c[3] > 0) c = darker(c);
                out.set(dx, y, c);
            }
        }
    }
    return out;
};

add('player-level-0', withProp(playerBase, true));
add('player-level-1', withProp(playerBase, false));
add('player-left-0', withProp(bank(playerBase, -1), true));
add('player-left-1', withProp(bank(playerBase, -1), false));
add('player-right-0', withProp(bank(playerBase, 1), true));
add('player-right-1', withProp(bank(playerBase, 1), false));

// the life counter of the HUD
add('icon-life', grid([
    '....',
    '...w',
    '...w',
    '.www',
    'wrww',
    '...w',
    '...w',
    '..ww'
], { mirror: true }).pad(1).outline());

// ---------------------------------------------------------------- enemies, drawn nose up
// each flies nose down, so the grids are flipped
const enemy = (name, rows, { frames: count = 1, decorate } = {}) => {
    const base = grid(rows, { mirror: true }).flipY();
    for (let i = 0; i < count; i++) add(`${name}-${i}`, decorate ? decorate(base.clone(), i) : base);
    add(`${name}-flash`, base.flash());
    return base;
};

// the dart: a fast delta wing raider
enemy('dart', [
    '.......k',
    '......kV',
    '......kV',
    '.....kPv',
    '.....kPo',
    '....kPvo',
    '...kPvvV',
    '..kPvvPV',
    '.kPvvPPV',
    'kPyyvPpV',
    'kPyyPppv',
    'kpPPpkkP',
    '.kkkkkkP',
    '.....kpP',
    '......kk',
    '........'
], {
    frames: 2,
    // the engine glows and dims
    decorate: (img, i) => {
        const c = img.w / 2;
        const glow = i ? PAL.Y : PAL.o;
        img.set(c - 1, 0, glow);
        img.set(c, 0, glow);
        return img;
    }
});

// the wasp: a slow straight winged biplane that shoots at the player
enemy('wasp', [
    '......kk',
    '.....kgG',
    '.....kKg',
    '.kkkkkBt',
    'kTTTTTBt',
    'kttttttT',
    'kBByBBBt',
    '.kkkkkBo',
    '.....kBo',
    '.....kBt',
    '.....kBt',
    '....kkBt',
    '..kkttBt',
    '..kBBBBt',
    '...kkkkB',
    '.......k'
], {
    frames: 2,
    decorate: (img, i) => {
        // the propeller, at the nose, which is now at the bottom
        const c = img.w / 2;
        const span = i ? 2 : 4;
        for (let d = 1; d <= span; d++) {
            const color = [244, 245, 239, i ? 210 : 150];
            if (!img.alpha(c - 1 - d, img.h - 1)) img.set(c - 1 - d, img.h - 1, color);
            if (!img.alpha(c + d, img.h - 1)) img.set(c + d, img.h - 1, color);
        }
        return img;
    }
});

// the gunship: a twin engined bomber that takes a few hits
enemy('gunship', [
    '...............k',
    '..............kl',
    '..............kl',
    '.............kGl',
    '.............kCc',
    '.............kCc',
    '......kk.....kGl',
    '.....kGgk....kGl',
    '.....klgk....kGl',
    '..kkkklgkkkkkkGl',
    '.kvvvklgkvvvvvGl',
    'kvVVvklgkVVVVvGl',
    'kvvyyklgkvvvvvGl',
    'kPvyykGgkvvvvPGl',
    'kpPPPkggkPPPPPGl',
    '.kpppkkkkpppppGl',
    '..kkkk..kkkkkkGl',
    '.............kGl',
    '.............kGl',
    '.............kGl',
    '.............kgl',
    '..........kkkkgl',
    '.........kvvvvgl',
    '.........kPvvvgl',
    '.........kpPPPgl',
    '..........kkkkgl',
    '..............kg',
    '...............k'
], {
    frames: 2,
    decorate: (img, i) => {
        // a propeller on each engine: the engines are 9 pixels either side of the middle
        const y = img.h - 6;
        for (const engine of [img.w / 2 - 9.5, img.w / 2 + 8.5]) {
            const span = i ? 2 : 3;
            for (let d = -span; d <= span + 1; d++) {
                const x = Math.round(engine + d - 0.5);
                if (!img.alpha(x, y)) img.set(x, y, [244, 245, 239, i ? 210 : 150]);
            }
        }
        return img;
    }
});

// the gunboat: a sea target, drawn bow up, that keeps its heading
const boatRows = [
    '.......k',
    '......kl',
    '......kl',
    '.....kGl',
    '.....kGl',
    '....kGGl',
    '....kGll',
    '...kGGll',
    '...kGlKK',
    '...kGlKk',
    '...kGllK',
    '...kGlll',
    '...kGggg',
    '...kGgKK',
    '...kGgKy',
    '...kGggg',
    '...kGlll',
    '...kGllr',
    '...kGllr',
    '...kGlll',
    '...kGlKK',
    '...kGlKk',
    '...kGllK',
    '...kGGll',
    '....kGGl',
    '....kkGG',
    '.....kkk',
    '........',
    '........',
    '........',
    '........',
    '........'
];
const boat = grid(boatRows, { mirror: true });
const wake = (img, i) => {
    const out = img.clone();
    const random = rng(40 + i);
    const c = img.w / 2;
    for (let y = 27; y < 32; y++) {
        const spread = 2 + (y - 27);
        for (let n = 0; n < 3; n++) {
            const x = Math.round(c - 0.5 + (random() * 2 - 1) * spread);
            out.set(x, y, [244, 245, 239, 255 - (y - 27) * 40]);
        }
    }
    // a bow wave along each side
    for (let y = 6 + i; y < 26; y += 3) {
        out.set(2, y + 1, [244, 245, 239, 150]);
        out.set(img.w - 3, y + 1, [244, 245, 239, 150]);
    }
    return out;
};
add('boat-0', wake(boat, 0));
add('boat-1', wake(boat, 1));
add('boat-flash', boat.flash());

// ---------------------------------------------------------------- the boss: a raider airship
const airship = () => {
    const W = 132, H = 58;
    const img = new Img(W, H);
    const cx = W / 2 + 2, cy = H / 2;
    const rx = 58, ry = 17;
    // the half height of the envelope at x: blunt at the nose (right), tapered at the tail
    const halfHeight = (x) => {
        const u = (x - cx) / rx;
        if (Math.abs(u) >= 1) return 0;
        const shape = u > 0 ? Math.pow(1 - Math.pow(u, 2.6), 0.5) : Math.pow(1 - Math.pow(-u, 1.7), 0.62);
        return ry * shape;
    };

    // tail fins, behind the envelope
    for (let x = 6; x < 30; x++) {
        const t = (x - 6) / 24;
        const reach = 9 + 14 * (1 - Math.abs(t - 0.45) * 1.6);
        for (let y = 0; y < H; y++) {
            const dy = Math.abs(y + 0.5 - cy);
            if (dy < reach && dy > 2) img.set(x, y, dy > reach - 2 ? 'p' : t < 0.3 ? 'P' : 'v');
        }
    }

    // engine pods, on struts either side
    for (const px of [40, 88]) {
        for (const side of [-1, 1]) {
            const py = cy + side * 22;
            for (let y = -3; y <= 2; y++) {
                for (let x = -7; x <= 6; x++) {
                    const round = Math.abs(x + 0.5) > 5 && Math.abs(y + 0.5) > 1.5;
                    if (!round) img.set(px + x, Math.round(py + y), y < -1 ? 'l' : y < 1 ? 'G' : 'g');
                }
            }
            // the strut
            for (let y = 3; y < 8; y++) img.set(px, Math.round(py - side * y), 'K');
            img.set(px + 1, Math.round(py - side * 3), 'K');
            // the propeller disc, at the back of the pod
            for (let y = -5; y <= 4; y++) img.set(px - 9, Math.round(py + y), [244, 245, 239, 170]);
        }
    }

    // the envelope, shaded as a cylinder lit from above, with a rib every 13 pixels
    for (let x = 0; x < W; x++) {
        const hh = halfHeight(x + 0.5);
        if (hh <= 0) continue;
        for (let y = 0; y < H; y++) {
            const t = (y + 0.5 - cy) / hh;
            if (Math.abs(t) > 1) continue;
            let c = t < -0.72 ? 'P' : t < -0.5 ? 'v' : t < -0.28 ? 'V' : t < 0.2 ? 'v' : t < 0.62 ? 'P' : 'p';
            const rib = (x - Math.round(cx)) % 13 === 0;
            if (rib) c = { V: 'v', v: 'P', P: 'p', p: 'p' }[c];
            img.set(x, y, c);
        }
    }

    // a yellow band and chevron near the nose
    for (let x = 0; x < W; x++) {
        const hh = halfHeight(x + 0.5);
        for (let y = 0; y < H; y++) {
            const dy = y + 0.5 - cy;
            if (Math.abs(dy) >= hh - 1) continue;
            const chevron = [108, 115].some(tip => Math.abs((x - tip) + Math.abs(dy) * 0.9) < 1.6) && Math.abs(dy) < 10;
            if (chevron) img.set(x, y, dy > 4 ? 'o' : 'y');
        }
    }

    // three gun turrets along the top
    for (const tx of [32, 62, 92]) {
        // twin barrels, pointing down the screen
        for (let y = 3; y < 12; y++) {
            img.set(tx - 2, cy + y, 'K');
            img.set(tx + 1, cy + y, 'K');
        }
        for (let y = -6; y <= 5; y++) {
            for (let x = -6; x <= 5; x++) {
                const d = Math.hypot(x + 0.5, y + 0.5);
                if (d < 6) img.set(tx + x, cy + y, d > 4.9 ? 'k' : d > 3.4 ? (y < -1 ? 'l' : y < 2 ? 'G' : 'g') : d > 1.8 ? 'g' : 'K');
            }
        }
    }
    return img.outline();
};
const boss = airship();
add('boss-0', boss);
add('boss-flash', boss.flash());

// ---------------------------------------------------------------- shots
add('shot-0', grid([
    '..Y..',
    '.yYy.',
    '.yYy.',
    '.yYy.',
    '.yYy.',
    '.oyo.',
    '.oyo.',
    '..o..',
    '..o..'
]));
add('orb-0', grid([
    '..nnnn..',
    '.nmmmmn.',
    'nmMMMmmn',
    'nmMwMmmn',
    'nmMMMmmn',
    'nmmmmmmn',
    '.nmmmmn.',
    '..nnnn..'
]));
add('orb-1', grid([
    '..nnnn..',
    '.nmMMmn.',
    'nmMwwMmn',
    'nMwwwwMn',
    'nMwwwwMn',
    'nmMwwMmn',
    '.nmMMmn.',
    '..nnnn..'
]));
// the fast dart shot aimed at the player
add('needle-0', grid([
    '.nn.',
    'nmmn',
    'nMMn',
    'nwwn',
    'nwwn',
    'nMMn',
    'nmmn',
    'nmmn',
    '.nn.'
]));

// ---------------------------------------------------------------- explosions
const HEAT = [
    [0.86, PAL.w], [0.66, PAL.Y], [0.46, PAL.y], [0.28, PAL.o], [0.12, PAL.r], [-0.02, PAL.d], [-0.2, PAL.K]
];
const explosion = (name, size, count, seed) => {
    const c = size / 2;
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const img = new Img(size, size);
        const radius = (size / 2 - 1) * (0.3 + 0.7 * (1 - Math.pow(1 - t, 2.2)));
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / radius;
                if (d > 1) continue;
                const scale = 9 / size + 0.22;
                const n = noise(x * scale, y * scale, i * 0.45, seed);
                const fine = noise(x * 0.9, y * 0.9, i, seed + 7);
                const heat = (1 - d) * 1.25 + (n - 0.5) * 1.1 + (fine - 0.5) * 0.25 - t * 1.35 + 0.18;
                const band = HEAT.find(([level]) => heat > level);
                if (band) img.set(x, y, band[1]);
            }
        }
        add(`${name}-${i}`, img);
    }
};
explosion('boom', 16, 6, 11);
explosion('blast', 32, 8, 23);

// the spark of a shot that lands without destroying
add('spark-0', grid([
    '...w...',
    '...Y...',
    '.......',
    'wY.w.Yw',
    '.......',
    '...Y...',
    '...w...'
]));
add('spark-1', grid([
    '.......',
    '..y.y..',
    '.y...y.',
    '...Y...',
    '.y...y.',
    '..y.y..',
    '.......'
]));

// a white pixel, stretched into bars and flashes
const pixel = new Img(2, 2);
for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) pixel.set(x, y, PAL.w);
add('pixel', pixel);

// ---------------------------------------------------------------- font
const GLYPHS = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    'dash': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
    'bang': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    'colon': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
    'dot': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
    'times': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#']
};
const glyph = (rows, color = PAL.w) => {
    const img = new Img(5, 7);
    rows.forEach((row, y) => {
        for (let x = 0; x < 5; x++) if (row[x] === '#') img.set(x, y, color);
    });
    return img;
};
// each glyph carries its own drop shadow, down and to the right
for (const [name, rows] of Object.entries(GLYPHS)) {
    const img = new Img(6, 8);
    img.blit(glyph(rows, PAL.k), 1, 1);
    img.blit(glyph(rows), 0, 0);
    add(`font-${name}`, img);
}

// ---------------------------------------------------------------- pickups
const capsule = (name, body, light, dark, emblem) => {
    for (let i = 0; i < 4; i++) {
        const img = new Img(14, 14);
        for (let y = 1; y < 13; y++) {
            for (let x = 1; x < 13; x++) {
                const corner = (x < 3 || x > 10) && (y < 3 || y > 10) && Math.abs(x - 6.5) + Math.abs(y - 6.5) > 9;
                if (corner) continue;
                let c = body;
                if (y < 3 || x < 3) c = light;
                if (y > 10 || x > 10) c = dark;
                // a glint that sweeps across
                if (Math.abs(x + y - (4 + i * 6)) < 1.5) c = PAL.w;
                img.set(x, y, c);
            }
        }
        img.blit(emblem, 4, 3);
        add(`${name}-${i}`, img.outline());
    }
};
const emblem = (rows) => {
    const img = new Img(6, 8);
    img.blit(glyph(rows, PAL.k), 1, 1);
    img.blit(glyph(rows), 0, 0);
    return img;
};
capsule('power', PAL.e, PAL.E, PAL.f, emblem(GLYPHS.P));
capsule('life', PAL.r, PAL.R, PAL.d, emblem(['.....', '.#.#.', '#####', '#####', '.###.', '..#..', '.....']));

// ---------------------------------------------------------------- the sea
// One tile that repeats, in frames that loop. Each wave crest lives for part of the loop: it
// rises, runs a few pixels with the wind and sinks. The crests start evenly through the loop, so
// the sea is always moving, never all at once, and as busy in one frame as in the next.
const SEA = hex('#2659a8');
const SEA_LIGHT = hex('#3a74c4');
const SEA_PALE = hex('#5b93d8');
const SEA_GLINT = hex('#93bcec');
const SEA_DARK = hex('#1f4b93');
const SEA_TILE = 64;
const SEA_FRAMES = 8;

// the part of the loop a crest is there for
const CREST_LIFE = 0.75;

const seaCrests = () => {
    const random = rng(5);
    const crests = [];
    // on a grid, each nudged, with every other row offset
    const rows = 12;
    const columns = 5;
    for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < columns; gx++) {
            crests.push({
                x: Math.floor((gx + (gy % 2) * 0.5 + random() * 0.5) * (SEA_TILE / columns)),
                y: Math.floor((gy + random() * 0.5) * (SEA_TILE / rows)),
                length: 4 + Math.floor(random() * 5),
                run: 2 + Math.floor(random() * 3),
                // steps of the golden ratio spread the starts evenly, with neighbors far apart
                start: (crests.length * 0.618034) % 1,
                glint: random() < 0.3
            });
        }
    }
    return crests;
};

/**
 * @param {number} frame - The frame of the loop.
 * @param {ReturnType<typeof seaCrests>} crests - The wave crests.
 * @returns {Img} The tile of the sea at that frame, which repeats in both directions.
 */
const sea = (frame, crests) => {
    const img = new Img(SEA_TILE, SEA_TILE);
    const wrap = (/** @type {number} */ v) => ((v % SEA_TILE) + SEA_TILE) % SEA_TILE;
    for (let y = 0; y < SEA_TILE; y++) for (let x = 0; x < SEA_TILE; x++) img.set(x, y, SEA);

    for (const crest of crests) {
        const life = ((frame / SEA_FRAMES + crest.start) % 1) / CREST_LIFE;
        if (life >= 1) continue;

        // it grows from its middle and shrinks back to it, as it runs
        const height = Math.sin(Math.PI * life);
        const length = Math.round(crest.length * height);
        if (length < 2) continue;
        const left = Math.round(crest.x + crest.length / 2 + crest.run * life - length / 2);

        for (let i = 0; i < length; i++) {
            // lit along the top, brightest in the middle at its highest, with a shadow under it
            const core = height > 0.8 && i >= 1 && i < length - 2;
            img.set(wrap(left + i), wrap(crest.y), core ? SEA_PALE : SEA_LIGHT);
            if (i > 0) img.set(wrap(left + i), wrap(crest.y + 1), SEA_DARK);
        }

        // a glint at its highest
        if (crest.glint && Math.abs(life - 0.5) < 0.5 / (SEA_FRAMES * CREST_LIFE)) {
            img.set(wrap(left + Math.floor(length / 2)), wrap(crest.y), SEA_GLINT);
        }
    }
    return img;
};
const crests = seaCrests();
for (let frame = 0; frame < SEA_FRAMES; frame++) add(`sea-${frame}`, sea(frame, crests));

// ---------------------------------------------------------------- islands
const SHALLOW = hex('#3f86d6');
const REEF = hex('#62b6e8');
const island = (name, w, h, blobs, seed) => {
    const img = new Img(w, h);
    const field = (x, y) => {
        let best = -1;
        for (const [bx, by, r] of blobs) best = Math.max(best, 1 - Math.hypot(x - bx, (y - by) * 1.15) / r);
        return best + (noise(x * 0.09, y * 0.09, 0, seed) - 0.5) * 0.42 + (noise(x * 0.27, y * 0.27, 0, seed + 3) - 0.5) * 0.16;
    };
    const land = (x, y) => field(x + 0.5, y + 0.5);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const f = land(x, y);
            if (f < 0.02) continue;
            let c;
            if (f < 0.1) c = SHALLOW;
            else if (f < 0.17) c = REEF;
            else if (f < 0.27) c = PAL.s;
            else {
                const tree = noise(x * 0.2, y * 0.2, 5, seed + 9);
                c = f > 0.4 && tree > 0.56 ? PAL.f : tree < 0.34 ? PAL.E : PAL.e;
            }
            img.set(x, y, c);
        }
    }
    // relief: a shadow on the sand below grass, a lit top edge on the trees
    const key = c => c.join();
    const out = img.clone();
    for (let y = 1; y < h - 1; y++) {
        for (let x = 0; x < w; x++) {
            const here = key(img.get(x, y));
            const above = key(img.get(x, y - 1));
            const below = key(img.get(x, y + 1));
            const grass = k => k === key(PAL.e) || k === key(PAL.E) || k === key(PAL.f);
            if (here === key(PAL.s) && grass(above)) out.set(x, y, PAL.S);
            if (here === key(PAL.f) && !(above === key(PAL.f))) out.set(x, y, PAL.e);
            if (here === key(PAL.f) && below !== key(PAL.f)) out.set(x, y, hex('#134a2b'));
            // surf where the reef meets the sand
            if (here === key(REEF) && below === key(PAL.s) && noise(x * 0.5, y * 0.5, 0, seed) > 0.45) out.set(x, y, PAL.w);
        }
    }
    add(name, out);
};
island('island-0', 72, 60, [[28, 28, 22], [46, 34, 17]], 3);
island('island-1', 104, 76, [[34, 36, 26], [62, 30, 22], [78, 46, 18]], 8);
island('island-2', 44, 40, [[22, 20, 17]], 14);
island('island-3', 60, 92, [[30, 28, 20], [28, 56, 21], [34, 72, 14]], 21);

// ---------------------------------------------------------------- clouds
const cloud = (name, w, h, blobs, seed) => {
    const field = (x, y) => {
        let best = -1;
        for (const [bx, by, r] of blobs) best = Math.max(best, 1 - Math.hypot(x - bx, (y - by) * 1.5) / r);
        return best + (noise(x * 0.16, y * 0.16, 0, seed) - 0.5) * 0.35;
    };
    const img = new Img(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const f = field(x + 0.5, y + 0.5);
            if (f < 0.1) continue;
            const shade = field(x + 0.5, y + 3.5) < 0.16;
            const edge = f < 0.16;
            img.set(x, y, shade ? [207, 222, 240, edge ? 150 : 225] : [255, 255, 255, edge ? 150 : 225]);
        }
    }
    add(name, img);
};
cloud('cloud-0', 72, 34, [[22, 18, 16], [40, 15, 19], [56, 20, 13]], 31);
cloud('cloud-1', 48, 26, [[16, 14, 12], [31, 12, 13]], 37);
cloud('cloud-2', 104, 42, [[26, 22, 18], [50, 18, 22], [74, 23, 19], [90, 26, 11]], 41);

// ---------------------------------------------------------------- write the sheet
const { sheet, rects } = pack(frames, SHEET_WIDTH);

// one frame to a line, in the order they were drawn, which is the order of each animation
const lines = frames.map(({ name }) => {
    const { x, y, w, h } = rects.get(name);
    return `        ${JSON.stringify(name)}: { "frame": { "x": ${x}, "y": ${y}, "w": ${w}, "h": ${h} } }`;
});
const meta = {
    app: 'examples/utils/generate-storm-petrel-sheet.mjs',
    image: `${NAME}.png`,
    format: 'RGBA8888',
    size: { w: sheet.w, h: sheet.h },
    scale: '1'
};
const json = `{\n    "frames": {\n${lines.join(',\n')}\n    },\n    "meta": ${JSON.stringify(meta, null, 4).replace(/\n/g, '\n    ')}\n}\n`;

fs.mkdirSync(OUT, { recursive: true });
await sharp(Buffer.from(sheet.d.buffer), { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
.png({ compressionLevel: 9 })
.toFile(`${OUT}/${NAME}.png`);
fs.writeFileSync(`${OUT}/${NAME}.json`, json);
console.log(`${OUT}/${NAME}.png: ${sheet.w}x${sheet.h}, ${frames.length} frames`);
