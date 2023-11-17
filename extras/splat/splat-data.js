import {
    BoundingBox,
    Color,
    Mat4,
    Vec3,
    Quat
} from "playcanvas";

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

class SplatData {
    elements;

    vertexElement;

    constructor(elements) {
        this.elements = elements;
        this.vertexElement = elements.find(element => element.name === 'vertex');

        if (!this.isCompressed) {
            mat4.setScale(-1, -1, 1);
            this.transform(mat4);
        }
    }

    get numSplats() {
        return this.vertexElement.count;
    }

    static calcSplatAabb(result, data) {
        calcSplatMat(mat4, data);
        aabb.center.set(0, 0, 0);
        aabb.halfExtents.set(data.sx * 2, data.sy * 2, data.sz * 2);
        result.setFromTransformedAabb(aabb, mat4);
    }

    // transform splat data by the given matrix
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
                SplatData.calcSplatAabb(result, splat);
            } else {
                SplatData.calcSplatAabb(aabb2, splat);
                result.add(aabb2);
            }
        }

        return !first;
    }

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

    renderWireframeBounds(app, worldMat) {
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

            app.drawLines(debugLines, debugColor);
        }
    }

    // compressed splats
    get isCompressed() {
        return this.elements.some(e => e.name === 'chunk') &&
               ['compressed_position', 'compressed_rotation', 'compressed_scale', 'compressed_color'].every(name => this.getProp(name));
    }

    decompress() {
        const members = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2'];
        const chunks = this.elements.find(e => e.name === 'chunk');
        const vertices = this.vertexElement;

        // allocate uncompressed data
        const data = {};
        members.forEach(name => data[name] = new Float32Array(vertices.count));

        const getChunkProp = (name) => chunks.properties.find(p => p.name === name && p.storage)?.storage;

        const min_x = getChunkProp('min_x');
        const min_y = getChunkProp('min_y');
        const min_z = getChunkProp('min_z');
        const size_x = getChunkProp('size_x');
        const size_y = getChunkProp('size_y');
        const size_z = getChunkProp('size_z');
        const scale_min_x = getChunkProp('scale_min_x');
        const scale_min_y = getChunkProp('scale_min_y');
        const scale_min_z = getChunkProp('scale_min_z');
        const scale_size_x = getChunkProp('scale_size_x');
        const scale_size_y = getChunkProp('scale_size_y');
        const scale_size_z = getChunkProp('scale_size_z');

        const position = this.getProp('compressed_position');
        const rotation = this.getProp('compressed_rotation');
        const scale = this.getProp('compressed_scale');
        const color = this.getProp('compressed_color');

        const unpackUnorm = (value, bits) => {
            const t = (1 << bits) - 1;
            return (value & t) / t;
        };

        const unpack111011 = (value) => {
            return {
                x: unpackUnorm(value >> 21, 11),
                y: unpackUnorm(value >> 11, 10),
                z: unpackUnorm(value, 11)
            };
        };

        const unpack8888 = (value) => {
            return {
                x: unpackUnorm(value >> 24, 8),
                y: unpackUnorm(value >> 16, 8),
                z: unpackUnorm(value >> 8, 8),
                w: unpackUnorm(value, 8)
            };
        };

        for (let i = 0; i < vertices.count; ++i) {
            const p = unpack111011(position[i]);
            const r = unpack111011(rotation[i]);
            const s = unpack111011(scale[i]);
            const c = unpack8888(color[i]);

            const ci = Math.floor(i / 256);
            data.x[i] = min_x[ci] + size_x[ci] * p.x;
            data.y[i] = min_y[ci] + size_y[ci] * p.y;
            data.z[i] = min_z[ci] + size_z[ci] * p.z;

            data.rot_0[i] = r.x * 2 - 1;
            data.rot_1[i] = r.y * 2 - 1;
            data.rot_2[i] = r.z * 2 - 1;
            data.rot_3[i] = Math.sqrt(1 - (data.rot_0[i] * data.rot_0[i] + data.rot_1[i] * data.rot_1[i] + data.rot_2[i] * data.rot_2[i]));

            data.scale_0[i] = scale_min_x[ci] + scale_size_x[ci] * s.x;
            data.scale_1[i] = scale_min_y[ci] + scale_size_y[ci] * s.y;
            data.scale_2[i] = scale_min_z[ci] + scale_size_z[ci] * s.z;

            const SH_C0 = 0.28209479177387814;
            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;

            // x = 1 / (1 + Math.exp(-a))
            // x * (1 + Math.exp(-a)) = 1
            // 1 + Math.exp(-a) = 1 / x
            // Math.exp(-a) = 1 / x - 1
            // -a = ln(1 / x - 1)
            // a = -ln(1 / x - 1)

            data.opacity[i] = -Math.log(1 / c.w - 1);
        }

        return new SplatData([{
            name: 'vertex',
            count: vertices.count,
            properties: members.map(name => {
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

export { SplatData };
