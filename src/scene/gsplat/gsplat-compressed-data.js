import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';

const SH_C0 = 0.28209479177387814;

// iterator for accessing compressed splat data
class SplatCompressedIterator {
    constructor(gsplatData, p, r, s, c) {
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
                case 0: result.set(m, a, b, c); break;
                case 1: result.set(a, m, b, c); break;
                case 2: result.set(a, b, m, c); break;
                case 3: result.set(a, b, c, m); break;
            }
        };

        const lerp = (a, b, t) => a * (1 - t) + b * t;

        const chunkData = gsplatData.chunkData;
        const vertexData = gsplatData.vertexData;

        this.read = (i) => {
            const ci = Math.floor(i / 256) * 12;

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
            }
        };
    }
}

class GSplatCompressedData {
    numSplats;

    /**
     * Contains 12 floats per chunk:
     *      min_x, min_y, min_z,
     *      max_x, max_y, max_z,
     *      min_scale_x, min_scale_y, min_scale_z,
     *      max_scale_x, max_scale_y, max_scale_z
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
     * Create an iterator for accessing splat data
     *
     * @param {Vec3|null} [p] - the vector to receive splat position
     * @param {Quat|null} [r] - the quaternion to receive splat rotation
     * @param {Vec3|null} [s] - the vector to receive splat scale
     * @param {Vec4|null} [c] - the vector to receive splat color
     * @returns {SplatCompressedIterator} - The iterator
     */
    createIter(p, r, s, c) {
        return new SplatCompressedIterator(this, p, r, s, c);
    }

    /**
     * Calculate pessimistic scene aabb taking into account splat size. This is faster than
     * calculating an exact aabb.
     *
     * @param {import('../../core/shape/bounding-box.js').BoundingBox} result - Where to store the resulting bounding box.
     * @returns {boolean} - Whether the calculation was successful.
     */
    calcAabb(result) {
        let mx, my, mz, Mx, My, Mz;

        // fast bounds calc using chunk data
        const numChunks = Math.ceil(this.numSplats / 256);

        const chunkData = this.chunkData;

        let s = Math.exp(Math.max(chunkData[9], chunkData[10], chunkData[11]));
        mx = chunkData[0] - s;
        my = chunkData[1] - s;
        mz = chunkData[2] - s;
        Mx = chunkData[3] + s;
        My = chunkData[4] + s;
        Mz = chunkData[5] + s;

        for (let i = 1; i < numChunks; ++i) {
            s = Math.exp(Math.max(chunkData[i * 12 + 9], chunkData[i * 12 + 10], chunkData[i * 12 + 11]));
            mx = Math.min(mx, chunkData[i * 12 + 0] - s);
            my = Math.min(my, chunkData[i * 12 + 1] - s);
            mz = Math.min(mz, chunkData[i * 12 + 2] - s);
            Mx = Math.max(Mx, chunkData[i * 12 + 3] + s);
            My = Math.max(My, chunkData[i * 12 + 4] + s);
            Mz = Math.max(Mz, chunkData[i * 12 + 5] + s);
        }

        result.center.set((mx + Mx) * 0.5, (my + My) * 0.5, (mz + Mz) * 0.5);
        result.halfExtents.set((Mx - mx) * 0.5, (My - my) * 0.5, (Mz - mz) * 0.5);

        return true;
    }

    /**
     * @param {Float32Array} result - Array containing the centers.
     */
    getCenters(result) {
        const chunkData = this.chunkData;
        const vertexData = this.vertexData;

        const numChunks = Math.ceil(this.numSplats / 256);

        let mx, my, mz, Mx, My, Mz;

        for (let c = 0; c < numChunks; ++c) {
            mx = chunkData[c * 12 + 0];
            my = chunkData[c * 12 + 1];
            mz = chunkData[c * 12 + 2];
            Mx = chunkData[c * 12 + 3];
            My = chunkData[c * 12 + 4];
            Mz = chunkData[c * 12 + 5];

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

    /**
     * @param {Vec3} result - The result.
     */
    calcFocalPoint(result) {
        const chunkData = this.chunkData;
        const numChunks = Math.ceil(this.numSplats / 256);

        result.x = 0;
        result.y = 0;
        result.z = 0;

        for (let i = 0; i < numChunks; ++i) {
            result.x += chunkData[i * 12 + 0] + chunkData[i * 12 + 3];
            result.y += chunkData[i * 12 + 1] + chunkData[i * 12 + 4];
            result.z += chunkData[i * 12 + 2] + chunkData[i * 12 + 5];
        }
        result.mulScalar(0.5 / numChunks);
    }

    get isCompressed() {
        return true;
    }

    // decompress into GSplatData
    decompress() {
        const members = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2'];

        // allocate uncompressed data
        const data = {};
        members.forEach((name) => {
            data[name] = new Float32Array(this.numSplats);
        });

        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();
        const c = new Vec4();

        const iter = this.createIter(p, r, s, c);

        for (let i = 0; i < this.numSplats; ++i) {
            iter.read(i);

            data.x[i] = p.x;
            data.y[i] = p.y;
            data.z[i] = p.z;

            data.rot_0[i] = r.x;
            data.rot_1[i] = r.y;
            data.rot_2[i] = r.z;
            data.rot_3[i] = r.w;

            data.scale_0[i] = s.x;
            data.scale_1[i] = s.y;
            data.scale_2[i] = s.z;

            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
            // convert opacity to log sigmoid taking into account infinities at 0 and 1
            data.opacity[i] = (c.w <= 0) ? -40 : (c.w >= 1) ? 40 : -Math.log(1 / c.w - 1);
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
        }]);
    }
}

export { GSplatCompressedData };
