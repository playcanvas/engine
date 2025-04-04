import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';

let offscreen = null;
let ctx = null;

const readImageData = (imageBitmap) => {
    if (!offscreen || offscreen.width !== imageBitmap.width || offscreen.height !== imageBitmap.height) {
        offscreen = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        ctx = offscreen.getContext('2d');
        ctx.globalCompositeOperation = 'copy';
    }
    ctx.drawImage(imageBitmap, 0, 0);
    return ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height).data;
};

const SH_C0 = 0.28209479177387814;

class GSplatSogsIterator {
    constructor(data, p, r, s, c, sh) {

        const lerp = (a, b, t) => a * (1 - t) + b * t;

        // extract means for centers
        const { meta } = data;
        const { means, quats, scales, opacities, sh0, shN } = meta;
        const means_l_data = p && readImageData(data.means_l._levels[0]);
        const means_u_data = p && readImageData(data.means_u._levels[0]);
        const quats_data = r && readImageData(data.quats._levels[0]);
        const scales_data = s && readImageData(data.scales._levels[0]);
        const opacities_data = c && readImageData(data.opacities._levels[0]);
        const sh0_data = c && readImageData(data.sh0._levels[0]);
        const sh_labels_l_data = sh && readImageData(data.sh_labels_l._levels[0]);
        const sh_labels_u_data = sh && readImageData(data.sh_labels_u._levels[0]);
        const sh_centroids_data = sh && readImageData(data.sh_centroids._levels[0]);

        this.read = (i) => {
            if (p) {
                const nx = lerp(means.mins[0], means.maxs[0], ((means_u_data[i * 4 + 0] << 8) + means_l_data[i * 4 + 0]) / 65535);
                const ny = lerp(means.mins[1], means.maxs[1], ((means_u_data[i * 4 + 1] << 8) + means_l_data[i * 4 + 1]) / 65535);
                const nz = lerp(means.mins[2], means.maxs[2], ((means_u_data[i * 4 + 2] << 8) + means_l_data[i * 4 + 2]) / 65535);

                p.x = Math.sign(nx) * (Math.exp(Math.abs(nx)) - 1);
                p.y = Math.sign(ny) * (Math.exp(Math.abs(ny)) - 1);
                p.z = Math.sign(nz) * (Math.exp(Math.abs(nz)) - 1);
            }

            if (r) {
                const qx = lerp(quats.mins[0], quats.maxs[0], quats_data[i * 4 + 0] / 255);
                const qy = lerp(quats.mins[1], quats.maxs[1], quats_data[i * 4 + 1] / 255);
                const qz = lerp(quats.mins[2], quats.maxs[2], quats_data[i * 4 + 2] / 255);
                const qw = Math.sqrt(Math.max(0, 1 - (qx * qx + qy * qy + qz * qz)));
                r.set(qy, qz, qw, qx);
            }

            if (s) {
                const sx = lerp(scales.mins[0], scales.maxs[0], scales_data[i * 4 + 0] / 255);
                const sy = lerp(scales.mins[1], scales.maxs[1], scales_data[i * 4 + 1] / 255);
                const sz = lerp(scales.mins[2], scales.maxs[2], scales_data[i * 4 + 2] / 255);
                s.set(sx, sy, sz);
            }

            if (c) {
                const r = lerp(sh0.mins[0], sh0.maxs[0], sh0_data[i * 4 + 0] / 255);
                const g = lerp(sh0.mins[1], sh0.maxs[1], sh0_data[i * 4 + 1] / 255);
                const b = lerp(sh0.mins[2], sh0.maxs[2], sh0_data[i * 4 + 2] / 255);
                const a = lerp(opacities.mins[0], opacities.maxs[0], opacities_data[i * 4 + 0] / 255);

                c.set(
                    0.5 + r * SH_C0,
                    0.5 + g * SH_C0,
                    0.5 + b * SH_C0,
                    1.0 / (1.0 + Math.exp(a * -1.0))
                );
            }

            if (sh) {
                const n = sh_labels_l_data[i * 4 + 0] + (sh_labels_u_data[i * 4 + 0] << 8);
                const u = (n % 64) * 15;
                const v = Math.floor(n / 64);

                for (let j = 0; j < 3; ++j) {
                    for (let k = 0; k < 15; ++k) {
                        sh[j * 15 + k] = lerp(shN.mins, shN.maxs, sh_centroids_data[((u + k) * 4 + j) + (v * data.sh_centroids.width * 4)] / 255);
                    }
                }
            }
        };
    }
}

class GSplatSogsData {
    meta;

    numSplats;

    shBands;

    means_l;

    means_u;

    quats;

    scales;

    opacities;

    sh0;

    sh_centroids;

    sh_labels_l;

    sh_labels_u;

    createIter(p, r, s, c, sh) {
        return new GSplatSogsIterator(this, p, r, s, c, sh);
    }

    calcAabb(result) {
        const { mins, maxs } = this.meta.means;

        const map = v => Math.sign(v) * (Math.exp(Math.abs(v)) - 1);

        result.center.set(
            (map(mins[0]) + map(maxs[0])) * 0.5,
            (map(mins[1]) + map(maxs[1])) * 0.5,
            (map(mins[2]) + map(maxs[2])) * 0.5
        );

        result.halfExtents.set(
            (map(maxs[0]) - map(mins[0])) * 0.5,
            (map(maxs[1]) - map(mins[1])) * 0.5,
            (map(maxs[2]) - map(mins[2])) * 0.5
        );
    }

    getCenters(result) {
        const p = new Vec3();
        const iter = this.createIter(p);

        for (let i = 0; i < this.numSplats; i++) {
            iter.read(i);

            result[i * 3 + 0] = p.x;
            result[i * 3 + 1] = p.y;
            result[i * 3 + 2] = p.z;
        }
    }

    calcFocalPoint(result, pred) {
        result.set(0, 0, 0);
    }

    get isSogs() {
        return true;
    }

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
        }]);
    }
}

export { GSplatSogsData };
