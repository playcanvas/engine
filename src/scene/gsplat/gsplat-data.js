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

const debugPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];
const debugLines = [
    debugPoints[0], debugPoints[1], debugPoints[1], debugPoints[3], debugPoints[3], debugPoints[2], debugPoints[2], debugPoints[0],
    debugPoints[4], debugPoints[5], debugPoints[5], debugPoints[7], debugPoints[7], debugPoints[6], debugPoints[6], debugPoints[4],
    debugPoints[0], debugPoints[4], debugPoints[1], debugPoints[5], debugPoints[2], debugPoints[6], debugPoints[3], debugPoints[7]
];
const debugColor = new Color(1, 1, 0, 0.4);

/**
 * Defines the shape of a SplatTRS.
 * @typedef {object} SplatTRS - Represents a splat object with position, rotation, and scale.
 * @property {number} x - The x-coordinate of the position.
 * @property {number} y - The y-coordinate of the position.
 * @property {number} z - The z-coordinate of the position.
 * @property {number} rx - The x-component of the quaternion rotation.
 * @property {number} ry - The y-component of the quaternion rotation.
 * @property {number} rz - The z-component of the quaternion rotation.
 * @property {number} rw - The w-component of the quaternion rotation.
 * @property {number} sx - The scale factor in the x-direction.
 * @property {number} sy - The scale factor in the y-direction.
 * @property {number} sz - The scale factor in the z-direction.
 */

/**
 * @param {Mat4} result - Mat4 instance holding calculated rotation matrix.
 * @param {SplatTRS} data - The splat TRS object.
 */
const calcSplatMat = (result, data) => {
    const px = data.x;
    const py = data.y;
    const pz = data.z;
    const d = Math.sqrt(data.rx * data.rx + data.ry * data.ry + data.rz * data.rz + data.rw * data.rw);
    const x = data.rx / d;
    const y = data.ry / d;
    const z = data.rz / d;
    const w = data.rw / d;

    // build rotation matrix
    result.data.set([
        1.0 - 2.0 * (z * z + w * w),
        2.0 * (y * z + x * w),
        2.0 * (y * w - x * z),
        0,

        2.0 * (y * z - x * w),
        1.0 - 2.0 * (y * y + w * w),
        2.0 * (z * w + x * y),
        0,

        2.0 * (y * w + x * z),
        2.0 * (z * w - x * y),
        1.0 - 2.0 * (y * y + z * z),
        0,

        px, py, pz, 1
    ]);
};

class GSplatData {
    // /** @type {import('./ply-reader').PlyElement[]} */
    elements;

    // /** @type {import('./ply-reader').PlyElement} */
    vertexElement;

    // /**
    //  * @param {import('./ply-reader').PlyElement[]} elements - The elements.
    //  * @param {boolean} [performZScale] - Whether to perform z scaling.
    //  */
    constructor(elements, performZScale = true) {
        this.elements = elements;
        this.vertexElement = elements.find(element => element.name === 'vertex');

        if (!this.isCompressed && performZScale) {
            mat4.setScale(-1, -1, 1);
            this.transform(mat4);
        }
    }

    get numSplats() {
        return this.vertexElement.count;
    }

    /**
     * @param {BoundingBox} result - Bounding box instance holding calculated result.
     * @param {SplatTRS} data - The splat TRS object.
     */
    static calcSplatAabb(result, data) {
        calcSplatMat(mat4, data);
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(data.sx * 2, data.sy * 2, data.sz * 2);
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

        const rx = this.getProp('rot_0');
        const ry = this.getProp('rot_1');
        const rz = this.getProp('rot_2');
        const rw = this.getProp('rot_3');

        quat2.setFromMat4(mat);

        for (let i = 0; i < this.numSplats; ++i) {
            // transform center
            vec3.set(x[i], y[i], z[i]);
            mat.transformPoint(vec3, vec3);
            x[i] = vec3.x;
            y[i] = vec3.y;
            z[i] = vec3.z;

            // transform orientation
            quat.set(ry[i], rz[i], rw[i], rx[i]).mul2(quat2, quat);
            rx[i] = quat.w;
            ry[i] = quat.x;
            rz[i] = quat.y;
            rw[i] = quat.z;

            // TODO: transform SH
        }
    }

    // access a named property
    getProp(name) {
        return this.vertexElement.properties.find(property => property.name === name && property.storage)?.storage;
    }

    // add a new property
    addProp(name, storage) {
        this.vertexElement.properties.push({
            type: 'float',
            name,
            storage,
            byteSize: 4
        });
    }

    // calculate scene aabb taking into account splat size
    calcAabb(result, pred) {
        const x = this.getProp('x');
        const y = this.getProp('y');
        const z = this.getProp('z');

        const rx = this.getProp('rot_0');
        const ry = this.getProp('rot_1');
        const rz = this.getProp('rot_2');
        const rw = this.getProp('rot_3');

        const sx = this.getProp('scale_0');
        const sy = this.getProp('scale_1');
        const sz = this.getProp('scale_2');

        const splat = {
            x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, rw: 0, sx: 0, sy: 0, sz: 0
        };

        let first = true;

        for (let i = 0; i < this.numSplats; ++i) {
            if (pred && !pred(i)) {
                continue;
            }

            splat.x = x[i];
            splat.y = y[i];
            splat.z = z[i];
            splat.rx = rx[i];
            splat.ry = ry[i];
            splat.rz = rz[i];
            splat.rw = rw[i];
            splat.sx = Math.exp(sx[i]);
            splat.sy = Math.exp(sy[i]);
            splat.sz = Math.exp(sz[i]);

            if (first) {
                first = false;
                GSplatData.calcSplatAabb(result, splat);
            } else {
                GSplatData.calcSplatAabb(aabb2, splat);
                result.add(aabb2);
            }
        }

        return !first;
    }

    /**
     * @param {Vec3} result - The result.
     * @param {Function} pred - Predicate given index for skipping.
     */
    calcFocalPoint(result, pred) {
        const x = this.getProp('x');
        const y = this.getProp('y');
        const z = this.getProp('z');

        const sx = this.getProp('scale_0');
        const sy = this.getProp('scale_1');
        const sz = this.getProp('scale_2');

        result.x = 0;
        result.y = 0;
        result.z = 0;

        let sum = 0;
        for (let i = 0; i < this.numSplats; ++i) {
            if (pred && !pred(i)) {
                continue;
            }
            const weight = 1.0 / (1.0 + Math.exp(Math.max(sx[i], sy[i], sz[i])));
            result.x += x[i] * weight;
            result.y += y[i] * weight;
            result.z += z[i] * weight;
            sum += weight;
        }
        result.mulScalar(1 / sum);
    }

    /**
     * @param {import('../scene.js').Scene} scene - The application's scene.
     * @param {Mat4} worldMat - The world matrix.
     */
    renderWireframeBounds(scene, worldMat) {
        const x = this.getProp('x');
        const y = this.getProp('y');
        const z = this.getProp('z');

        const rx = this.getProp('rot_0');
        const ry = this.getProp('rot_1');
        const rz = this.getProp('rot_2');
        const rw = this.getProp('rot_3');

        const sx = this.getProp('scale_0');
        const sy = this.getProp('scale_1');
        const sz = this.getProp('scale_2');

        const splat = {
            x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, rw: 0, sx: 0, sy: 0, sz: 0
        };

        for (let i = 0; i < this.numSplats; ++i) {
            splat.x = x[i];
            splat.y = y[i];
            splat.z = z[i];
            splat.rx = rx[i];
            splat.ry = ry[i];
            splat.rz = rz[i];
            splat.rw = rw[i];
            splat.sx = Math.exp(sx[i]);
            splat.sy = Math.exp(sy[i]);
            splat.sz = Math.exp(sz[i]);

            calcSplatMat(mat4, splat);
            mat4.mul2(worldMat, mat4);

            for (let j = 0; j < 8; ++j) {
                vec3.set(
                    splat.sx * 2 * ((j & 1) ? 1 : -1),
                    splat.sy * 2 * ((j & 2) ? 1 : -1),
                    splat.sz * 2 * ((j & 4) ? 1 : -1)
                );
                mat4.transformPoint(vec3, debugPoints[j]);
            }

            scene.drawLineArrays(debugLines, debugColor);
        }
    }

    // compressed splats
    get isCompressed() {
        return this.elements.some(e => e.name === 'chunk') &&
               ['packed_position', 'packed_rotation', 'packed_scale', 'packed_color'].every(name => this.getProp(name));
    }

    decompress() {
        const members = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2'];
        const chunks = this.elements.find(e => e.name === 'chunk');
        const vertices = this.vertexElement;

        // allocate uncompressed data
        const data = {};
        members.forEach((name) => {
            data[name] = new Float32Array(vertices.count);
        });

        const getChunkProp = (name) => {
            return chunks.properties.find(p => p.name === name && p.storage)?.storage;
        };

        const min_x = getChunkProp('min_x');
        const min_y = getChunkProp('min_y');
        const min_z = getChunkProp('min_z');
        const max_x = getChunkProp('max_x');
        const max_y = getChunkProp('max_y');
        const max_z = getChunkProp('max_z');
        const min_scale_x = getChunkProp('min_scale_x');
        const min_scale_y = getChunkProp('min_scale_y');
        const min_scale_z = getChunkProp('min_scale_z');
        const max_scale_x = getChunkProp('max_scale_x');
        const max_scale_y = getChunkProp('max_scale_y');
        const max_scale_z = getChunkProp('max_scale_z');

        const position = this.getProp('packed_position');
        const rotation = this.getProp('packed_rotation');
        const scale = this.getProp('packed_scale');
        const color = this.getProp('packed_color');

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

        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();
        const c = new Vec4();

        for (let i = 0; i < vertices.count; ++i) {
            const ci = Math.floor(i / 256);

            unpack111011(p, position[i]);
            unpackRot(r, rotation[i]);
            unpack111011(s, scale[i]);
            unpack8888(c, color[i]);

            data.x[i] = lerp(min_x[ci], max_x[ci], p.x);
            data.y[i] = lerp(min_y[ci], max_y[ci], p.y);
            data.z[i] = lerp(min_z[ci], max_z[ci], p.z);

            data.rot_0[i] = r.x;
            data.rot_1[i] = r.y;
            data.rot_2[i] = r.z;
            data.rot_3[i] = r.w;

            data.scale_0[i] = lerp(min_scale_x[ci], max_scale_x[ci], s.x);
            data.scale_1[i] = lerp(min_scale_y[ci], max_scale_y[ci], s.y);
            data.scale_2[i] = lerp(min_scale_z[ci], max_scale_z[ci], s.z);

            const SH_C0 = 0.28209479177387814;
            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
            data.opacity[i] = -Math.log(1 / c.w - 1);
        }

        return new GSplatData([{
            name: 'vertex',
            count: vertices.count,
            properties: members.map((name) => {
                return {
                    name: name,
                    type: 'float',
                    byteSize: 4,
                    storage: data[name]
                };
            })
        }], false);
    }
}

export { GSplatData };
