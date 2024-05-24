import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

const vec3 = new Vec3();
const mat4 = new Mat4();
const quat = new Quat();
const quat2 = new Quat();
const aabb = new BoundingBox();
const aabb2 = new BoundingBox();

const debugColor = new Color(1, 1, 0, 0.4);
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

        const min_x = gsplatData.getProp('min_x', 'chunk');
        const min_y = gsplatData.getProp('min_y', 'chunk');
        const min_z = gsplatData.getProp('min_z', 'chunk');
        const max_x = gsplatData.getProp('max_x', 'chunk');
        const max_y = gsplatData.getProp('max_y', 'chunk');
        const max_z = gsplatData.getProp('max_z', 'chunk');
        const min_scale_x = gsplatData.getProp('min_scale_x', 'chunk');
        const min_scale_y = gsplatData.getProp('min_scale_y', 'chunk');
        const min_scale_z = gsplatData.getProp('min_scale_z', 'chunk');
        const max_scale_x = gsplatData.getProp('max_scale_x', 'chunk');
        const max_scale_y = gsplatData.getProp('max_scale_y', 'chunk');
        const max_scale_z = gsplatData.getProp('max_scale_z', 'chunk');

        const position = gsplatData.getProp('packed_position');
        const rotation = gsplatData.getProp('packed_rotation');
        const scale = gsplatData.getProp('packed_scale');
        const color = gsplatData.getProp('packed_color');

        this.read = (i) => {
            const ci = Math.floor(i / 256);

            if (p) {
                unpack111011(p, position[i]);
                p.x = lerp(min_x[ci], max_x[ci], p.x);
                p.y = lerp(min_y[ci], max_y[ci], p.y);
                p.z = lerp(min_z[ci], max_z[ci], p.z);
            }

            if (r) {
                unpackRot(r, rotation[i]);
            }

            if (s) {
                unpack111011(s, scale[i]);
                s.x = lerp(min_scale_x[ci], max_scale_x[ci], s.x);
                s.y = lerp(min_scale_y[ci], max_scale_y[ci], s.y);
                s.z = lerp(min_scale_z[ci], max_scale_z[ci], s.z);
            }

            if (c) {
                unpack8888(c, color[i]);
            }
        };
    }
}

// iterator for accessing uncompressed splat data
class SplatIterator {
    constructor(gsplatData, p, r, s, c) {
        const x = gsplatData.getProp('x');
        const y = gsplatData.getProp('y');
        const z = gsplatData.getProp('z');

        const rx = gsplatData.getProp('rot_1');
        const ry = gsplatData.getProp('rot_2');
        const rz = gsplatData.getProp('rot_3');
        const rw = gsplatData.getProp('rot_0');

        const sx = gsplatData.getProp('scale_0');
        const sy = gsplatData.getProp('scale_1');
        const sz = gsplatData.getProp('scale_2');

        const cr = gsplatData.getProp('f_dc_0');
        const cg = gsplatData.getProp('f_dc_1');
        const cb = gsplatData.getProp('f_dc_2');
        const ca = gsplatData.getProp('opacity');

        /**
         * Calculates the sigmoid of a given value.
         *
         * @param {number} v - The value for which to compute the sigmoid function.
         * @returns {number} The result of the sigmoid function.
         */
        const sigmoid = (v) => {
            if (v > 0) {
                return 1 / (1 + Math.exp(-v));
            }

            const t = Math.exp(v);
            return t / (1 + t);
        };

        this.read = (i) => {
            if (p) {
                p.x = x[i];
                p.y = y[i];
                p.z = z[i];
            }

            if (r) {
                r.set(rx[i], ry[i], rz[i], rw[i]);
            }

            if (s) {
                s.set(Math.exp(sx[i]), Math.exp(sy[i]), Math.exp(sz[i]));
            }

            if (c) {
                c.set(
                    0.5 + cr[i] * SH_C0,
                    0.5 + cg[i] * SH_C0,
                    0.5 + cb[i] * SH_C0,
                    sigmoid(ca[i])
                );
            }
        };
    }
}

/**
 * Calculate a splat orientation matrix from its position and rotation.
 * @param {Mat4} result - Mat4 instance holding calculated rotation matrix.
 * @param {Vec3} p - The splat position
 * @param {Quat} r - The splat rotation
 */
const calcSplatMat = (result, p, r) => {
    quat.set(r.x, r.y, r.z, r.w).normalize();
    result.setTRS(p, quat, Vec3.ONE);
};

class GSplatData {
    // /** @type {import('./ply-reader').PlyElement[]} */
    elements;

    numSplats;

    // /**
    //  * @param {import('./ply-reader').PlyElement[]} elements - The elements.
    //  * @param {boolean} [performZScale] - Whether to perform z scaling.
    //  * @param {object} [options] - The options.
    //  * @param {boolean} [options.performZScale] - Whether to perform z scaling.
    //  * @param {boolean} [options.reorder] - Whether to reorder the data.
    //  */
    constructor(elements, options = {}) {
        this.elements = elements;

        this.numSplats = this.getElement('vertex').count;

        if (!this.isCompressed) {
            if (options.performZScale ?? true) {
                mat4.setScale(-1, -1, 1);
                this.transform(mat4);
            }

            // reorder uncompressed splats in morton order for better memory access
            // efficiency during rendering
            if (options.reorder ?? true) {
                this.reorderData();
            }
        }
    }

    /**
     * @param {BoundingBox} result - Bounding box instance holding calculated result.
     * @param {Vec3} p - The splat position
     * @param {Quat} r - The splat rotation
     * @param {Vec3} s - The splat scale
     */
    static calcSplatAabb(result, p, r, s) {
        calcSplatMat(mat4, p, r);
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(s.x * 2, s.y * 2, s.z * 2);
        result.setFromTransformedAabb(aabb, mat4);
    }

    /**
     * Transform splat data by the given matrix.
     *
     * @param {Mat4} mat - The matrix.
     * @returns {boolean} True if the transformation was successful, false if the data is compressed.
     */
    transform(mat) {
        if (this.isCompressed) {
            return false;
        }

        const x = this.getProp('x');
        const y = this.getProp('y');
        const z = this.getProp('z');

        const rx = this.getProp('rot_1');
        const ry = this.getProp('rot_2');
        const rz = this.getProp('rot_3');
        const rw = this.getProp('rot_0');

        quat2.setFromMat4(mat);

        for (let i = 0; i < this.numSplats; ++i) {
            // transform center
            vec3.set(x[i], y[i], z[i]);
            mat.transformPoint(vec3, vec3);
            x[i] = vec3.x;
            y[i] = vec3.y;
            z[i] = vec3.z;

            // transform orientation
            quat.set(rx[i], ry[i], rz[i], rw[i]).mul2(quat2, quat);
            rx[i] = quat.x;
            ry[i] = quat.y;
            rz[i] = quat.z;
            rw[i] = quat.w;

            // TODO: transform SH
        }

        return true;
    }

    // access a named property
    getProp(name, elementName = 'vertex') {
        return this.getElement(elementName)?.properties.find(p => p.name === name)?.storage;
    }

    // access the named element
    getElement(name) {
        return this.elements.find(e => e.name === name);
    }

    // add a new property
    addProp(name, storage) {
        this.getElement('vertex').properties.push({
            type: 'float',
            name,
            storage,
            byteSize: 4
        });
    }

    /**
     * Create an iterator for accessing splat data
     *
     * @param {Vec3|null} [p] - the vector to receive splat position
     * @param {Quat|null} [r] - the quaternion to receive splat rotation
     * @param {Vec3|null} [s] - the vector to receive splat scale
     * @param {Vec4|null} [c] - the vector to receive splat color
     * @returns {SplatIterator | SplatCompressedIterator} - The iterator
     */
    createIter(p, r, s, c) {
        return this.isCompressed ? new SplatCompressedIterator(this, p, r, s, c) : new SplatIterator(this, p, r, s, c);
    }

    /**
     * Calculate pessimistic scene aabb taking into account splat size. This is faster than
     * calculating an exact aabb.
     *
     * @param {BoundingBox} result - Where to store the resulting bounding box.
     * @param {(i: number) => boolean} [pred] - Optional predicate function to filter splats.
     * @returns {boolean} - Whether the calculation was successful.
     */
    calcAabb(result, pred) {
        let mx, my, mz, Mx, My, Mz;
        let first = true;

        if (this.isCompressed && !pred && this.numSplats) {
            // fast bounds calc using chunk data
            const numChunks = Math.ceil(this.numSplats / 256);

            const min_x = this.getProp('min_x', 'chunk');
            const min_y = this.getProp('min_y', 'chunk');
            const min_z = this.getProp('min_z', 'chunk');
            const max_x = this.getProp('max_x', 'chunk');
            const max_y = this.getProp('max_y', 'chunk');
            const max_z = this.getProp('max_z', 'chunk');
            const max_scale_x = this.getProp('max_scale_x', 'chunk');
            const max_scale_y = this.getProp('max_scale_y', 'chunk');
            const max_scale_z = this.getProp('max_scale_z', 'chunk');

            let s = Math.exp(Math.max(max_scale_x[0], max_scale_y[0], max_scale_z[0]));
            mx = min_x[0] - s;
            my = min_y[0] - s;
            mz = min_z[0] - s;
            Mx = max_x[0] + s;
            My = max_y[0] + s;
            Mz = max_z[0] + s;

            for (let i = 1; i < numChunks; ++i) {
                s = Math.exp(Math.max(max_scale_x[i], max_scale_y[i], max_scale_z[i]));
                mx = Math.min(mx, min_x[i] - s);
                my = Math.min(my, min_y[i] - s);
                mz = Math.min(mz, min_z[i] - s);
                Mx = Math.max(Mx, max_x[i] + s);
                My = Math.max(My, max_y[i] + s);
                Mz = Math.max(Mz, max_z[i] + s);
            }

            first = false;
        } else {
            const p = new Vec3();
            const s = new Vec3();

            const iter = this.createIter(p, null, s);

            for (let i = 0; i < this.numSplats; ++i) {
                if (pred && !pred(i)) {
                    continue;
                }

                iter.read(i);

                const scaleVal = 2.0 * Math.max(s.x, s.y, s.z);

                if (first) {
                    first = false;
                    mx = p.x - scaleVal;
                    my = p.y - scaleVal;
                    mz = p.z - scaleVal;
                    Mx = p.x + scaleVal;
                    My = p.y + scaleVal;
                    Mz = p.z + scaleVal;
                } else {
                    mx = Math.min(mx, p.x - scaleVal);
                    my = Math.min(my, p.y - scaleVal);
                    mz = Math.min(mz, p.z - scaleVal);
                    Mx = Math.max(Mx, p.x + scaleVal);
                    My = Math.max(My, p.y + scaleVal);
                    Mz = Math.max(Mz, p.z + scaleVal);
                }
            }
        }

        if (!first) {
            result.center.set((mx + Mx) * 0.5, (my + My) * 0.5, (mz + Mz) * 0.5);
            result.halfExtents.set((Mx - mx) * 0.5, (My - my) * 0.5, (Mz - mz) * 0.5);
        }

        return !first;
    }

    /**
     * Calculate exact scene aabb taking into account splat size
     *
     * @param {BoundingBox} result - Where to store the resulting bounding box.
     * @param {(i: number) => boolean} [pred] - Optional predicate function to filter splats.
     * @returns {boolean} - Whether the calculation was successful.
     */
    calcAabbExact(result, pred) {

        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();

        const iter = this.createIter(p, r, s);

        let first = true;

        for (let i = 0; i < this.numSplats; ++i) {
            if (pred && !pred(i)) {
                continue;
            }

            iter.read(i);

            if (first) {
                first = false;
                GSplatData.calcSplatAabb(result, p, r, s);
            } else {
                GSplatData.calcSplatAabb(aabb2, p, r, s);
                result.add(aabb2);
            }
        }

        return !first;
    }

    /**
     * @param {Float32Array} result - Array containing the centers.
     */
    getCenters(result) {
        if (this.isCompressed) {
            // optimised centers extraction for centers
            const position = this.getProp('packed_position');
            const min_x = this.getProp('min_x', 'chunk');
            const min_y = this.getProp('min_y', 'chunk');
            const min_z = this.getProp('min_z', 'chunk');
            const max_x = this.getProp('max_x', 'chunk');
            const max_y = this.getProp('max_y', 'chunk');
            const max_z = this.getProp('max_z', 'chunk');

            const numChunks = Math.ceil(this.numSplats / 256);

            let mx, my, mz, Mx, My, Mz;

            for (let c = 0; c < numChunks; ++c) {
                mx = min_x[c];
                my = min_y[c];
                mz = min_z[c];
                Mx = max_x[c];
                My = max_y[c];
                Mz = max_z[c];

                const end = Math.min(this.numSplats, (c + 1) * 256);
                for (let i = c * 256; i < end; ++i) {
                    const p = position[i];
                    const px = (p >>> 21) / 2047;
                    const py = ((p >>> 11) & 0x3ff) / 1023;
                    const pz = (p & 0x7ff) / 2047;
                    result[i * 3 + 0] = (1 - px) * mx + px * Mx;
                    result[i * 3 + 1] = (1 - py) * my + py * My;
                    result[i * 3 + 2] = (1 - pz) * mz + pz * Mz;
                }
            }
        } else {
            const p = new Vec3();
            const iter = this.createIter(p);

            for (let i = 0; i < this.numSplats; ++i) {
                iter.read(i);

                result[i * 3 + 0] = p.x;
                result[i * 3 + 1] = p.y;
                result[i * 3 + 2] = p.z;
            }
        }
    }

    /**
     * @param {Vec3} result - The result.
     * @param {Function} pred - Predicate given index for skipping.
     */
    calcFocalPoint(result, pred) {
        const p = new Vec3();
        const s = new Vec3();
        const iter = this.createIter(p, null, s, null);

        result.x = 0;
        result.y = 0;
        result.z = 0;

        let sum = 0;
        for (let i = 0; i < this.numSplats; ++i) {
            if (pred && !pred(i)) {
                continue;
            }

            iter.read(i);

            const weight = 1.0 / (1.0 + Math.max(s.x, s.y, s.z));
            result.x += p.x * weight;
            result.y += p.y * weight;
            result.z += p.z * weight;
            sum += weight;
        }
        result.mulScalar(1 / sum);
    }

    /**
     * @param {import('../scene.js').Scene} scene - The application's scene.
     * @param {Mat4} worldMat - The world matrix.
     */
    renderWireframeBounds(scene, worldMat) {
        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();

        const min = new Vec3();
        const max = new Vec3();

        const iter = this.createIter(p, r, s);

        for (let i = 0; i < this.numSplats; ++i) {
            iter.read(i);

            calcSplatMat(mat4, p, r);
            mat4.mul2(worldMat, mat4);

            min.set(s.x * -2.0, s.y * -2.0, s.z * -2.0);
            max.set(s.x * 2.0, s.y * 2.0, s.z * 2.0);

            // @ts-ignore
            scene.immediate.drawWireAlignedBox(min, max, debugColor, true, scene.defaultDrawLayer, mat4);
        }
    }

    // compressed splats
    get isCompressed() {
        return this.elements.some(e => e.name === 'chunk') &&
               ['packed_position', 'packed_rotation', 'packed_scale', 'packed_color'].every(name => this.getProp(name));
    }

    // decompress data into uncompressed splat format and return a new GSplatData instance
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

            const SH_C0 = 0.28209479177387814;
            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
            data.opacity[i] = -Math.log(1 / c.w - 1);
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
        }], {
            performZScale: false,
            reorder: false
        });
    }

    calcMortonOrder() {
        const calcMinMax = (arr) => {
            let min = arr[0];
            let max = arr[0];
            for (let i = 1; i < arr.length; i++) {
                if (arr[i] < min) min = arr[i];
                if (arr[i] > max) max = arr[i];
            }
            return { min, max };
        };

        // https://fgiesen.wordpress.com/2009/12/13/decoding-morton-codes/
        const encodeMorton3 = (x, y, z) => {
            const Part1By2 = (x) => {
                x &= 0x000003ff;
                x = (x ^ (x << 16)) & 0xff0000ff;
                x = (x ^ (x <<  8)) & 0x0300f00f;
                x = (x ^ (x <<  4)) & 0x030c30c3;
                x = (x ^ (x <<  2)) & 0x09249249;
                return x;
            };

            return (Part1By2(z) << 2) + (Part1By2(y) << 1) + Part1By2(x);
        };

        const x = this.getProp('x');
        const y = this.getProp('y');
        const z = this.getProp('z');

        const { min: minX, max: maxX } = calcMinMax(x);
        const { min: minY, max: maxY } = calcMinMax(y);
        const { min: minZ, max: maxZ } = calcMinMax(z);

        const sizeX = 1024 / (maxX - minX);
        const sizeY = 1024 / (maxY - minY);
        const sizeZ = 1024 / (maxZ - minZ);

        const morton = new Uint32Array(this.numSplats);
        for (let i = 0; i < this.numSplats; i++) {
            const ix = Math.floor((x[i] - minX) * sizeX);
            const iy = Math.floor((y[i] - minY) * sizeY);
            const iz = Math.floor((z[i] - minZ) * sizeZ);
            morton[i] = encodeMorton3(ix, iy, iz);
        }

        // generate indices
        const indices = new Uint32Array(this.numSplats);
        for (let i = 0; i < this.numSplats; i++) {
            indices[i] = i;
        }
        // order splats by morton code
        indices.sort((a, b) => morton[a] - morton[b]);

        return indices;
    }

    // reorder the splat data to aid in better gpu memory access at render time
    reorderData() {
        const order = this.calcMortonOrder();

        const reorder = (data) => {
            const result = new data.constructor(data.length);

            for (let i = 0; i < order.length; i++) {
                result[i] = data[order[i]];
            }

            return result;
        };

        this.elements.forEach((element) => {
            element.properties.forEach((property) => {
                if (property.storage) {
                    property.storage = reorder(property.storage);
                }
            });
        });
    }
}

export { GSplatData };
