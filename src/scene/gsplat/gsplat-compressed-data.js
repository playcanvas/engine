import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';

/**
 * @import { BoundingBox } from '../../core/shape/bounding-box.js'
 */

const SH_C0 = 0.28209479177387814;

// iterator for accessing compressed splat data
class SplatCompressedIterator {
    constructor(gsplatData, p, r, s, c, sh) {
        const unpackUnorm = (value, bits) => {
            const t = (1 << bits) - 1;
            return (value & t) / t;
        };

        const unpack111011 = (result, value) => {
            result.x = unpackUnorm(value >>> 21, 11);
            result.y = unpackUnorm(value >>> 11, 10);
            result.z = unpackUnorm(value, 11);
        };

        const unpack8888 = (result, value) => {
            result.x = unpackUnorm(value >>> 24, 8);
            result.y = unpackUnorm(value >>> 16, 8);
            result.z = unpackUnorm(value >>> 8, 8);
            result.w = unpackUnorm(value, 8);
        };

        // unpack quaternion with 2,10,10,10 format (largest element, 3x10bit element)
        const unpackRot = (result, value) => {
            const norm = 1.0 / (Math.sqrt(2) * 0.5);
            const a = (unpackUnorm(value >>> 20, 10) - 0.5) * norm;
            const b = (unpackUnorm(value >>> 10, 10) - 0.5) * norm;
            const c = (unpackUnorm(value, 10) - 0.5) * norm;
            const m = Math.sqrt(1.0 - (a * a + b * b + c * c));

            switch (value >>> 30) {
                case 0: result.set(a, b, c, m); break;
                case 1: result.set(m, b, c, a); break;
                case 2: result.set(b, m, c, a); break;
                case 3: result.set(b, c, m, a); break;
            }
        };

        const lerp = (a, b, t) => a * (1 - t) + b * t;

        const { chunkData, chunkSize, vertexData, shData0, shData1, shData2, shBands } = gsplatData;
        const shCoeffs = [3, 8, 15][shBands - 1];

        this.read = (i) => {
            const ci = Math.floor(i / 256) * chunkSize;

            if (p) {
                unpack111011(p, vertexData[i * 4 + 0]);
                p.x = lerp(chunkData[ci + 0], chunkData[ci + 3], p.x);
                p.y = lerp(chunkData[ci + 1], chunkData[ci + 4], p.y);
                p.z = lerp(chunkData[ci + 2], chunkData[ci + 5], p.z);
            }

            if (r) {
                unpackRot(r, vertexData[i * 4 + 1]);
            }

            if (s) {
                unpack111011(s, vertexData[i * 4 + 2]);
                s.x = lerp(chunkData[ci + 6], chunkData[ci + 9], s.x);
                s.y = lerp(chunkData[ci + 7], chunkData[ci + 10], s.y);
                s.z = lerp(chunkData[ci + 8], chunkData[ci + 11], s.z);
            }

            if (c) {
                unpack8888(c, vertexData[i * 4 + 3]);
                if (chunkSize > 12) {
                    c.x = lerp(chunkData[ci + 12], chunkData[ci + 15], c.x);
                    c.y = lerp(chunkData[ci + 13], chunkData[ci + 16], c.y);
                    c.z = lerp(chunkData[ci + 14], chunkData[ci + 17], c.z);
                }
            }

            if (sh && shBands > 0) {
                const shData = [shData0, shData1, shData2];
                for (let j = 0; j < 3; ++j) {
                    for (let k = 0; k < 15; ++k) {
                        sh[j * 15 + k] = (k < shCoeffs) ? (shData[j][i * 16 + k] * (8 / 255) - 4) : 0;
                    }
                }
            }
        };
    }
}

class GSplatCompressedData {
    numSplats;

    /**
     * File header comments.
     *
     * @type { string[] }
     */
    comments;

    /**
     * Contains either 12 or 18 floats per chunk:
     *      min_x, min_y, min_z,
     *      max_x, max_y, max_z,
     *      min_scale_x, min_scale_y, min_scale_z,
     *      max_scale_x, max_scale_y, max_scale_z
     *      min_r, min_g, min_b,
     *      max_r, max_g, max_b
     * @type {Float32Array}
     */
    chunkData;

    /**
     * Contains 4 uint32 per vertex:
     *      packed_position
     *      packed_rotation
     *      packed_scale
     *      packed_color
     * @type {Uint32Array}
     */
    vertexData;

    /**
     * Contains optional quantized spherical harmonic data.
     * @type {Uint8Array}
     */
    shData0;

    /**
     * Contains optional quantized spherical harmonic data.
     * @type {Uint8Array}
     */
    shData1;

    /**
     * Contains optional quantized spherical harmonic data.
     * @type {Uint8Array}
     */
    shData2;

    /**
     * Contains the number of bands of spherical harmonics data.
     * @type {number}
     */
    shBands;

    /**
     * Create an iterator for accessing splat data
     *
     * @param {Vec3|null} [p] - the vector to receive splat position
     * @param {Quat|null} [r] - the quaternion to receive splat rotation
     * @param {Vec3|null} [s] - the vector to receive splat scale
     * @param {Vec4|null} [c] - the vector to receive splat color
     * @param {Float32Array|null} [sh] - the array to receive spherical harmonics data
     * @returns {SplatCompressedIterator} - The iterator
     */
    createIter(p, r, s, c, sh) {
        return new SplatCompressedIterator(this, p, r, s, c, sh);
    }

    /**
     * Calculate pessimistic scene aabb taking into account splat size. This is faster than
     * calculating an exact aabb.
     *
     * @param {BoundingBox} result - Where to store the resulting bounding box.
     * @returns {boolean} - Whether the calculation was successful.
     */
    calcAabb(result) {
        const { chunkData, numChunks, chunkSize } = this;

        let s = Math.exp(Math.max(chunkData[9], chunkData[10], chunkData[11]));
        let mx = chunkData[0] - s;
        let my = chunkData[1] - s;
        let mz = chunkData[2] - s;
        let Mx = chunkData[3] + s;
        let My = chunkData[4] + s;
        let Mz = chunkData[5] + s;

        for (let i = 1; i < numChunks; ++i) {
            const off = i * chunkSize;
            s = Math.exp(Math.max(chunkData[off + 9], chunkData[off + 10], chunkData[off + 11]));
            mx = Math.min(mx, chunkData[off + 0] - s);
            my = Math.min(my, chunkData[off + 1] - s);
            mz = Math.min(mz, chunkData[off + 2] - s);
            Mx = Math.max(Mx, chunkData[off + 3] + s);
            My = Math.max(My, chunkData[off + 4] + s);
            Mz = Math.max(Mz, chunkData[off + 5] + s);
        }

        result.center.set((mx + Mx) * 0.5, (my + My) * 0.5, (mz + Mz) * 0.5);
        result.halfExtents.set((Mx - mx) * 0.5, (My - my) * 0.5, (Mz - mz) * 0.5);

        return true;
    }

    /**
     * @param {Float32Array} result - Array containing the centers.
     */
    getCenters(result) {
        const { vertexData, chunkData, numChunks, chunkSize } = this;

        let mx, my, mz, Mx, My, Mz;

        for (let c = 0; c < numChunks; ++c) {
            const off = c * chunkSize;
            mx = chunkData[off + 0];
            my = chunkData[off + 1];
            mz = chunkData[off + 2];
            Mx = chunkData[off + 3];
            My = chunkData[off + 4];
            Mz = chunkData[off + 5];

            const end = Math.min(this.numSplats, (c + 1) * 256);
            for (let i = c * 256; i < end; ++i) {
                const p = vertexData[i * 4];
                const px = (p >>> 21) / 2047;
                const py = ((p >>> 11) & 0x3ff) / 1023;
                const pz = (p & 0x7ff) / 2047;
                result[i * 3 + 0] = (1 - px) * mx + px * Mx;
                result[i * 3 + 1] = (1 - py) * my + py * My;
                result[i * 3 + 2] = (1 - pz) * mz + pz * Mz;
            }
        }
    }

    getChunks(result) {
        const { chunkData, numChunks, chunkSize } = this;

        let mx, my, mz, Mx, My, Mz;

        for (let c = 0; c < numChunks; ++c) {
            const off = c * chunkSize;
            mx = chunkData[off + 0];
            my = chunkData[off + 1];
            mz = chunkData[off + 2];
            Mx = chunkData[off + 3];
            My = chunkData[off + 4];
            Mz = chunkData[off + 5];

            result[c * 6 + 0] = mx;
            result[c * 6 + 1] = my;
            result[c * 6 + 2] = mz;
            result[c * 6 + 3] = Mx;
            result[c * 6 + 4] = My;
            result[c * 6 + 5] = Mz;
        }
    }

    /**
     * @param {Vec3} result - The result.
     */
    calcFocalPoint(result) {
        const { chunkData, numChunks, chunkSize } = this;

        result.x = 0;
        result.y = 0;
        result.z = 0;

        for (let i = 0; i < numChunks; ++i) {
            const off = i * chunkSize;
            result.x += chunkData[off + 0] + chunkData[off + 3];
            result.y += chunkData[off + 1] + chunkData[off + 4];
            result.z += chunkData[off + 2] + chunkData[off + 5];
        }
        result.mulScalar(0.5 / numChunks);
    }

    get isCompressed() {
        return true;
    }

    get numChunks() {
        return Math.ceil(this.numSplats / 256);
    }

    get chunkSize() {
        return this.chunkData.length / this.numChunks;
    }

    // decompress into GSplatData
    decompress() {
        const members = [
            'x', 'y', 'z',
            'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
            'scale_0', 'scale_1', 'scale_2',
            'rot_0', 'rot_1', 'rot_2', 'rot_3'
        ];

        const { shBands } = this;

        // allocate spherical harmonics data
        if (shBands > 0) {
            const shMembers = [];
            for (let i = 0; i < 45; ++i) {
                shMembers.push(`f_rest_${i}`);
            }
            members.splice(members.indexOf('f_dc_0') + 1, 0, ...shMembers);
        }

        // allocate uncompressed data
        const data = {};
        members.forEach((name) => {
            data[name] = new Float32Array(this.numSplats);
        });

        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();
        const c = new Vec4();
        const sh = shBands > 0 ? new Float32Array(45) : null;

        const iter = this.createIter(p, r, s, c, sh);

        for (let i = 0; i < this.numSplats; ++i) {
            iter.read(i);

            data.x[i] = p.x;
            data.y[i] = p.y;
            data.z[i] = p.z;

            data.rot_1[i] = r.x;
            data.rot_2[i] = r.y;
            data.rot_3[i] = r.z;
            data.rot_0[i] = r.w;

            data.scale_0[i] = s.x;
            data.scale_1[i] = s.y;
            data.scale_2[i] = s.z;

            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
            // convert opacity to log sigmoid taking into account infinities at 0 and 1
            data.opacity[i] = (c.w <= 0) ? -40 : (c.w >= 1) ? 40 : -Math.log(1 / c.w - 1);

            if (sh) {
                for (let c = 0; c < 45; ++c) {
                    data[`f_rest_${c}`][i] = sh[c];
                }
            }
        }

        return new GSplatData([{
            name: 'vertex',
            count: this.numSplats,
            properties: members.map((name) => {
                return {
                    name: name,
                    type: 'float',
                    byteSize: 4,
                    storage: data[name]
                };
            })
        }], this.comments);
    }
}

export { GSplatCompressedData };
