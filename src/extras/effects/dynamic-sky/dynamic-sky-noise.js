import {
    ADDRESS_REPEAT, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_R8, PIXELFORMAT_RGBA8
} from '../../../platform/graphics/constants.js';
import { DeviceCache } from '../../../platform/graphics/device-cache.js';
import { Texture } from '../../../platform/graphics/texture.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * Hash of an integer lattice point, to the 0..1 range.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} seed - The seed.
 * @returns {number} The hash.
 */
const noiseHash = (x, y, seed) => {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h & 0xffff) / 65535;
};

/**
 * Value noise with a period of `px` x `py` lattice cells across the texture, so it tiles.
 *
 * @param {number} u - The u texture coordinate, 0..1.
 * @param {number} v - The v texture coordinate, 0..1.
 * @param {number} px - The number of lattice cells along u.
 * @param {number} py - The number of lattice cells along v.
 * @param {number} seed - The seed.
 * @returns {number} The noise, 0..1.
 */
const valueNoise = (u, v, px, py, seed) => {
    const x = u * px;
    const y = v * py;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const x0 = ix % px;
    const y0 = iy % py;
    const x1 = (ix + 1) % px;
    const y1 = (iy + 1) % py;
    const a = noiseHash(x0, y0, seed);
    const b = noiseHash(x1, y0, seed);
    const c = noiseHash(x0, y1, seed);
    const d = noiseHash(x1, y1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

/**
 * Fractal value noise - octaves of doubling frequency and halving amplitude.
 *
 * @param {number} u - The u texture coordinate, 0..1.
 * @param {number} v - The v texture coordinate, 0..1.
 * @param {number} px - The number of lattice cells of the first octave along u.
 * @param {number} py - The number of lattice cells of the first octave along v.
 * @param {number} octaves - The number of octaves.
 * @param {number} seed - The seed.
 * @returns {number} The noise, 0..1.
 */
const fractalNoise = (u, v, px, py, octaves, seed) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * valueNoise(u, v, px << i, py << i, seed + i);
        norm += amp;
        amp *= 0.5;
    }
    return sum / norm;
};

/**
 * Cellular noise - one minus the distance to the nearest of randomly placed points, one per
 * lattice cell, giving round puffs.
 *
 * @param {number} u - The u texture coordinate, 0..1.
 * @param {number} v - The v texture coordinate, 0..1.
 * @param {number} period - The number of lattice cells across the texture.
 * @param {number} seed - The seed.
 * @returns {number} The noise, 0..1.
 */
const cellularNoise = (u, v, period, seed) => {
    const x = u * period;
    const y = v * period;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let best = 4;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const cx = ix + dx;
            const cy = iy + dy;
            const hx = ((cx % period) + period) % period;
            const hy = ((cy % period) + period) % period;
            const ox = cx + noiseHash(hx, hy, seed) - x;
            const oy = cy + noiseHash(hx, hy, seed + 7) - y;
            best = Math.min(best, ox * ox + oy * oy);
        }
    }
    return 1 - Math.min(Math.sqrt(best), 1);
};

/**
 * Fractal value noise bunches up around 0.5 - stretches it to use the whole range.
 *
 * @param {number} value - The noise value.
 * @returns {number} The stretched value, 0..1.
 */
const stretchNoise = value => Math.min(Math.max((value - 0.5) * 2.2 + 0.5, 0), 1);

/**
 * Creates a tileable RGBA8 noise texture, filled by a function returning the four channels.
 * Channels can be equalized - each value replaced by its rank among the values of the channel, so
 * the channel spreads evenly over the whole range. A threshold then covers exactly its fraction of
 * the texture, and noise of a low contrast gains the full contrast.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} name - The name of the texture.
 * @param {number} size - The resolution of the texture.
 * @param {(u: number, v: number, out: number[]) => void} fill - Writes the channels of a texel,
 * 0..1, to the `out` array.
 * @param {boolean[]} equalize - Per channel, whether it is equalized.
 * @returns {Texture} The noise texture.
 */
const createNoiseTexture = (device, name, size, fill, equalize) => {
    const count = size * size;
    const channels = [0, 1, 2, 3].map(() => new Float32Array(count));
    const texel = [0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            fill(x / size, y / size, texel);
            for (let c = 0; c < 4; c++) {
                channels[c][y * size + x] = texel[c];
            }
        }
    }

    const data = new Uint8Array(count * 4);
    const order = new Uint32Array(count);
    for (let c = 0; c < 4; c++) {
        const values = channels[c];
        if (equalize[c]) {
            for (let i = 0; i < count; i++) order[i] = i;
            order.sort((a, b) => values[a] - values[b]);
            for (let r = 0; r < count; r++) {
                data[order[r] * 4 + c] = Math.round((r / (count - 1)) * 255);
            }
        } else {
            for (let i = 0; i < count; i++) {
                data[i * 4 + c] = Math.round(values[i] * 255);
            }
        }
    }

    return new Texture(device, {
        name,
        width: size,
        height: size,
        format: PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        anisotropy: Math.min(8, device.maxAnisotropy),
        levels: [data]
    });
};

/**
 * Hash of an integer 3D lattice point, to the 0..1 range.
 *
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 * @param {number} seed - The seed.
 * @returns {number} The hash.
 */
const noiseHash3 = (x, y, z, seed) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 0x9e3779b1) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h & 0xffff) / 65535;
};

/**
 * Creates tileable 3D cellular noise of `period` lattice cells along each axis, with a randomly
 * placed point in each cell. The returned function evaluates one minus the distance to the
 * nearest point, 0..1, at a position in 0..1 coordinates.
 *
 * @param {number} period - The number of lattice cells along each axis.
 * @param {number} seed - The seed.
 * @returns {(u: number, v: number, w: number) => number} The noise function.
 */
const cellularNoise3D = (period, seed) => {
    const count = period * period * period;
    const points = new Float32Array(count * 3);
    for (let c = 0; c < count; c++) {
        const x = c % period;
        const y = Math.floor(c / period) % period;
        const z = Math.floor(c / (period * period));
        points[c * 3] = noiseHash3(x, y, z, seed);
        points[c * 3 + 1] = noiseHash3(x, y, z, seed + 1);
        points[c * 3 + 2] = noiseHash3(x, y, z, seed + 2);
    }

    return (u, v, w) => {
        const x = u * period;
        const y = v * period;
        const z = w * period;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;
        let best = 3;
        for (let dz = -1; dz <= 1; dz++) {
            const cz = (iz + dz + period) % period;
            for (let dy = -1; dy <= 1; dy++) {
                const row = (cz * period + (iy + dy + period) % period) * period;
                for (let dx = -1; dx <= 1; dx++) {
                    const o = (row + (ix + dx + period) % period) * 3;
                    const ox = dx + points[o] - fx;
                    const oy = dy + points[o + 1] - fy;
                    const oz = dz + points[o + 2] - fz;
                    best = Math.min(best, ox * ox + oy * oy + oz * oz);
                }
            }
        }
        return 1 - Math.min(Math.sqrt(best), 1);
    };
};

/**
 * Creates tileable 3D gradient (Perlin) noise of `period` lattice cells along each axis. The
 * returned function evaluates the noise, about -1..1, at a position in 0..1 coordinates.
 *
 * @param {number} period - The number of lattice cells along each axis.
 * @param {number} seed - The seed.
 * @returns {(u: number, v: number, w: number) => number} The noise function.
 */
const gradientNoise3D = (period, seed) => {
    const count = period * period * period;
    const gradients = new Float32Array(count * 3);
    for (let c = 0; c < count; c++) {
        const x = c % period;
        const y = Math.floor(c / period) % period;
        const z = Math.floor(c / (period * period));
        const gz = noiseHash3(x, y, z, seed) * 2 - 1;
        const a = noiseHash3(x, y, z, seed + 1) * Math.PI * 2;
        const r = Math.sqrt(1 - gz * gz);
        gradients[c * 3] = r * Math.cos(a);
        gradients[c * 3 + 1] = r * Math.sin(a);
        gradients[c * 3 + 2] = gz;
    }

    const corner = (ix, iy, iz, x, y, z) => {
        const o = (((iz % period) * period + (iy % period)) * period + (ix % period)) * 3;
        return gradients[o] * x + gradients[o + 1] * y + gradients[o + 2] * z;
    };

    return (u, v, w) => {
        const x = u * period;
        const y = v * period;
        const z = w * period;
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;
        const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
        const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
        const sz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
        const n00 = corner(ix, iy, iz, fx, fy, fz);
        const n10 = corner(ix + 1, iy, iz, fx - 1, fy, fz);
        const n01 = corner(ix, iy + 1, iz, fx, fy - 1, fz);
        const n11 = corner(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
        const m00 = corner(ix, iy, iz + 1, fx, fy, fz - 1);
        const m10 = corner(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1);
        const m01 = corner(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1);
        const m11 = corner(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
        const n0 = n00 + (n10 - n00) * sx;
        const n1 = n01 + (n11 - n01) * sx;
        const m0 = m00 + (m10 - m00) * sx;
        const m1 = m01 + (m11 - m01) * sx;
        const n = n0 + (n1 - n0) * sy;
        const m = m0 + (m1 - m0) * sy;
        return n + (m - n) * sz;
    };
};

/**
 * Creates a tileable 3D R8 noise texture, filled by a function returning the noise. The noise is
 * equalized by the cumulative histogram of its values, so it spreads evenly over the whole range
 * and a threshold covers exactly its fraction of the volume. It is stored in the layers of a 2D
 * texture array, as 3D textures are not supported by every graphics backend - the shader
 * interpolates between the layers.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} name - The name of the texture.
 * @param {number} size - The resolution of the texture along each axis.
 * @param {(u: number, v: number, w: number) => number} fill - Returns the noise at a position in
 * 0..1 coordinates.
 * @returns {Texture} The noise texture.
 */
const createNoiseVolume = (device, name, size, fill) => {
    const count = size * size * size;
    const values = new Float32Array(count);
    let min = Infinity;
    let max = -Infinity;
    let i = 0;
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const value = fill(x / size, y / size, z / size);
                values[i++] = value;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }
    }

    const bins = 4096;
    const histogram = new Float32Array(bins + 1);
    const binScale = (bins - 1) / Math.max(max - min, 1e-6);
    for (let j = 0; j < count; j++) {
        histogram[Math.floor((values[j] - min) * binScale) + 1]++;
    }
    for (let b = 1; b <= bins; b++) {
        histogram[b] += histogram[b - 1];
    }

    const layerSize = size * size;
    const layers = [];
    for (let z = 0; z < size; z++) {
        const data = new Uint8Array(layerSize);
        for (let j = 0; j < layerSize; j++) {
            const bin = Math.floor((values[z * layerSize + j] - min) * binScale);
            data[j] = Math.round(histogram[bin] / count * 255);
        }
        layers.push(data);
    }

    return new Texture(device, {
        name,
        width: size,
        height: size,
        arrayLength: size,
        format: PIXELFORMAT_R8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        levels: [layers]
    });
};

/**
 * The noise textures shaping the clouds of the dynamic sky effect, generated on the CPU when they
 * are first used, and shared by the effects of a device.
 *
 * @ignore
 */
class DynamicSkyNoise {
    /** @type {Texture|null} */
    _cloudMap = null;

    /** @type {Texture|null} */
    _shapeMap = null;

    /** @type {Texture|null} */
    _detailMap = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.device = device;
    }

    destroy() {
        this._cloudMap?.destroy();
        this._shapeMap?.destroy();
        this._detailMap?.destroy();
        this._cloudMap = null;
        this._shapeMap = null;
        this._detailMap = null;
    }

    /**
     * The noise of the flat clouds, which also holds the large scale weather pattern of the
     * volumetric clouds, 256^2:
     *
     * - r: fractal noise forming the large cloud shapes
     * - g: cellular noise, rounding the shapes into puffs
     * - b: fractal noise (equalized)
     * - a: the weather - smooth noise gathering the clouds into fields with clear gaps (equalized)
     *
     * @type {Texture}
     */
    get cloudMap() {
        this._cloudMap ??= createNoiseTexture(this.device, 'dynamic-sky-cloud-noise', 256, (u, v, out) => {
            out[0] = stretchNoise(fractalNoise(u, v, 4, 4, 5, 1));
            out[1] = cellularNoise(u, v, 6, 11) * 0.65 + cellularNoise(u, v, 12, 23) * 0.35;
            out[2] = fractalNoise(u, v, 16, 16, 4, 31);
            out[3] = fractalNoise(u, v, 4, 4, 3, 41);
        }, [false, false, true, true]);
        return this._cloudMap;
    }

    /**
     * The 3D noise forming the shapes of the volumetric clouds, 64^3 - Perlin-Worley noise,
     * fractal gradient noise dilated by fractal cellular noise into billowy shapes.
     *
     * @type {Texture}
     */
    get shapeMap() {
        if (!this._shapeMap) {
            const gradients = [4, 8, 16, 32].map((period, i) => gradientNoise3D(period, 51 + i));
            const c4 = cellularNoise3D(4, 61);
            const c8 = cellularNoise3D(8, 62);
            const c16 = cellularNoise3D(16, 63);
            this._shapeMap = createNoiseVolume(this.device, 'dynamic-sky-cloud-shapes', 64, (u, v, w) => {
                let perlin = 0;
                let amplitude = 1;
                for (let o = 0; o < gradients.length; o++) {
                    perlin += gradients[o](u, v, w) * amplitude;
                    amplitude *= 0.5;
                }
                perlin = Math.min(Math.max(perlin * 0.5 + 0.5, 0), 1);

                // Perlin-Worley noise, dilated again by the fractal cellular noise
                const worley = c4(u, v, w) * 0.625 + c8(u, v, w) * 0.25 + c16(u, v, w) * 0.125;
                const perlinWorley = (perlin - (worley - 1)) / (2 - worley);
                return (perlinWorley + 1 - worley) / (2 - worley);
            });
        }
        return this._shapeMap;
    }

    /**
     * The 3D noise of the detail eroding the edges of the volumetric clouds, 32^3 - fractal
     * cellular noise.
     *
     * @type {Texture}
     */
    get detailMap() {
        if (!this._detailMap) {
            const c4 = cellularNoise3D(4, 71);
            const c8 = cellularNoise3D(8, 72);
            const c16 = cellularNoise3D(16, 73);
            this._detailMap = createNoiseVolume(this.device, 'dynamic-sky-cloud-detail', 32, (u, v, w) => {
                return c4(u, v, w) * 0.625 + c8(u, v, w) * 0.25 + c16(u, v, w) * 0.125;
            });
        }
        return this._detailMap;
    }
}

/**
 * The noise of each device, shared by its effects, created on the first use.
 *
 * @type {DeviceCache|null}
 */
let noiseCache = null;

/**
 * Returns the cloud noise textures of a device.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {DynamicSkyNoise} The noise textures.
 * @ignore
 */
const getDynamicSkyNoise = (device) => {
    noiseCache ??= new DeviceCache();
    return noiseCache.get(device, () => new DynamicSkyNoise(device));
};

export { getDynamicSkyNoise };
