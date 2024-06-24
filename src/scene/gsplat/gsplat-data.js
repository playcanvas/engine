import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

const vec3 = new Vec3();
const mat4 = new Mat4();
const quat = new Quat();
const quat2 = new Quat();
const aabb = new BoundingBox();
const aabb2 = new BoundingBox();

const debugColor = new Color(1, 1, 0, 0.4);
const SH_C0 = 0.28209479177387814;

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
    //  */
    constructor(elements) {
        this.elements = elements;
        this.numSplats = this.getElement('vertex').count;
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
     */
    transform(mat) {
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
     * @param {import('../../core/math/vec4.js').Vec4|null} [c] - the vector to receive splat color
     * @returns {SplatIterator} - The iterator
     */
    createIter(p, r, s, c) {
        return new SplatIterator(this, p, r, s, c);
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
        const p = new Vec3();
        const iter = this.createIter(p);

        for (let i = 0; i < this.numSplats; ++i) {
            iter.read(i);

            result[i * 3 + 0] = p.x;
            result[i * 3 + 1] = p.y;
            result[i * 3 + 2] = p.z;
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

    get isCompressed() {
        return false;
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

        const sizeX = minX === maxX ? 0 : 1024 / (maxX - minX);
        const sizeY = minY === maxY ? 0 : 1024 / (maxY - minY);
        const sizeZ = minZ === maxZ ? 0 : 1024 / (maxZ - minZ);

        const codes = new Map();
        for (let i = 0; i < this.numSplats; i++) {
            const ix = Math.floor((x[i] - minX) * sizeX);
            const iy = Math.floor((y[i] - minY) * sizeY);
            const iz = Math.floor((z[i] - minZ) * sizeZ);
            const code = encodeMorton3(ix, iy, iz);

            const val = codes.get(code);
            if (val) {
                val.push(i);
            } else {
                codes.set(code, [i]);
            }
        }

        const keys = Array.from(codes.keys()).sort((a, b) => a - b);
        const indices = new Uint32Array(this.numSplats);
        let idx = 0;

        for (let i = 0; i < keys.length; ++i) {
            const val = codes.get(keys[i]);
            for (let j = 0; j < val.length; ++j) {
                indices[idx++] = val[j];
            }
        }

        return indices;
    }

    // reorder the splat data to aid in better gpu memory access at render time
    reorder(order) {
        const cache = new Map();

        const getStorage = (size) => {
            if (cache.has(size)) {
                const buffer = cache.get(size);
                cache.delete(size);
                return buffer;
            }

            return new ArrayBuffer(size);
        };

        const returnStorage = (buffer) => {
            cache.set(buffer.byteLength, buffer);
        };

        const reorder = (data) => {
            const result = new data.constructor(getStorage(data.byteLength));

            for (let i = 0; i < order.length; i++) {
                result[i] = data[order[i]];
            }

            returnStorage(data.buffer);

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

    // reorder the splat data to aid in better gpu memory access at render time
    reorderData() {
        this.reorder(this.calcMortonOrder());
    }
}

export { GSplatData };
