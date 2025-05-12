import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { PIXELFORMAT_R32U, PIXELFORMAT_RGBA8, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { createShaderFromCode } from '../shader-lib/utils.js';

const SH_C0 = 0.28209479177387814;

const reorderVS = /*glsl */`
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;

const reorderFS = /*glsl */`
    uniform usampler2D orderTexture;
    uniform sampler2D sourceTexture;
    uniform highp uint numSplats;

    void main(void) {
        uint w = uint(textureSize(sourceTexture, 0).x);
        uint idx = uint(gl_FragCoord.x) + uint(gl_FragCoord.y) * w;
        if (idx >= numSplats) discard;

        // fetch the source index and calculate source uv
        uint sidx = texelFetch(orderTexture, ivec2(gl_FragCoord.xy), 0).x;
        uvec2 suv = uvec2(sidx % w, sidx / w);

        // sample the source texture
        gl_FragColor = texelFetch(sourceTexture, ivec2(suv), 0);
    }
`;

const resolve = (scope, values) => {
    for (const key in values) {
        scope.resolve(key).setValue(values[key]);
    }
};

class GSplatSogsIterator {
    constructor(data, p, r, s, c, sh) {

        const lerp = (a, b, t) => a * (1 - t) + b * t;

        // extract means for centers
        const { meta } = data;
        const { means, scales, sh0, shN } = meta;
        const means_l_data = p && data.means_l._levels[0];
        const means_u_data = p && data.means_u._levels[0];
        const quats_data = r && data.quats._levels[0];
        const scales_data = s && data.scales._levels[0];
        const sh0_data = c && data.sh0._levels[0];
        const sh_labels_data = sh && data.sh_labels._levels[0];
        const sh_centroids_data = sh && data.sh_centroids._levels[0];

        const norm = 2.0 / Math.sqrt(2.0);

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
                const a = (quats_data[i * 4 + 0] / 255 - 0.5) * norm;
                const b = (quats_data[i * 4 + 1] / 255 - 0.5) * norm;
                const c = (quats_data[i * 4 + 2] / 255 - 0.5) * norm;
                const d = Math.sqrt(Math.max(0, 1 - (a * a + b * b + c * c)));
                const mode = quats_data[i * 4 + 3] - 252;

                switch (mode) {
                    case 0: r.set(a, b, c, d); break;
                    case 1: r.set(d, b, c, a); break;
                    case 2: r.set(b, d, c, a); break;
                    case 3: r.set(b, c, d, a); break;
                }
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
                const a = lerp(sh0.mins[3], sh0.maxs[3], sh0_data[i * 4 + 3] / 255);

                c.set(
                    0.5 + r * SH_C0,
                    0.5 + g * SH_C0,
                    0.5 + b * SH_C0,
                    1.0 / (1.0 + Math.exp(a * -1.0))
                );
            }

            if (sh) {
                const n = sh_labels_data[i * 4 + 0] + (sh_labels_data[i * 4 + 1] << 8);
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

    sh0;

    sh_centroids;

    sh_labels;

    cachedCenters;

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
        if (this.cachedCenters) {
            result.set(this.cachedCenters);
        } else {
            const p = new Vec3();
            const iter = this.createIter(p);

            for (let i = 0; i < this.numSplats; i++) {
                iter.read(i);

                result[i * 3 + 0] = p.x;
                result[i * 3 + 1] = p.y;
                result[i * 3 + 2] = p.z;
            }
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

    // reorder the sogs texture data in gpu memory for better cache coherency during rendering
    reorder(order) {
        const { means_l } = this;
        const { device } = means_l;
        const { scope } = device;

        const shader = createShaderFromCode(device, reorderVS, reorderFS, 'reorderShader', {
            vertex_position: SEMANTIC_POSITION
        });

        const orderTexture = new Texture(device, {
            name: 'orderTexture',
            width: means_l.width,
            height: means_l.height,
            format: PIXELFORMAT_R32U,
            mipmaps: false,
            levels: [order]
        });

        let targetTexture = new Texture(device, {
            width: means_l.width,
            height: means_l.height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
        });

        const members = ['means_l', 'means_u', 'quats', 'scales', 'sh0', 'sh_labels'];

        // temp start
        const getCenters = (result) => {
            const p = new Vec3();
            const iter = this.createIter(p);

            for (let i = 0; i < this.numSplats; i++) {
                iter.read(order[i]);

                result[i * 3 + 0] = p.x;
                result[i * 3 + 1] = p.y;
                result[i * 3 + 2] = p.z;
            }
        };
        this.cachedCenters = new Float32Array(this.numSplats * 3);
        getCenters(this.cachedCenters);
        // temp end

        members.forEach((member) => {
            const sourceTexture = this[member];

            const renderTarget = new RenderTarget({
                colorBuffer: targetTexture,
                depth: false
            });

            resolve(scope, {
                orderTexture: orderTexture,
                sourceTexture: sourceTexture,
                numSplats: this.numSplats
            });

            device.setBlendState(BlendState.NOBLEND);

            drawQuadWithShader(device, renderTarget, shader);

            targetTexture.name = `sogs-${member}`;
            targetTexture._levels = sourceTexture._levels;
            this[member] = targetTexture;

            targetTexture = sourceTexture;
        });

        shader.destroy();
        orderTexture.destroy();
        targetTexture.destroy();
    }

    // construct an array containing the Morton order of the splats
    calcMortonOrder() {
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

        const { means_l, means_u } = this;
        const means_l_data = means_l._levels[0];
        const means_u_data = means_u._levels[0];
        const codes = new BigUint64Array(this.numSplats);

        // generate Morton codes for each splat based on the means directly (i.e. the log-space coordinates)
        for (let i = 0; i < this.numSplats; ++i) {
            const ix = (means_u_data[i * 4 + 0] << 2) | (means_l_data[i * 4 + 0] >>> 6);
            const iy = (means_u_data[i * 4 + 1] << 2) | (means_l_data[i * 4 + 1] >>> 6);
            const iz = (means_u_data[i * 4 + 2] << 2) | (means_l_data[i * 4 + 2] >>> 6);
            codes[i] = BigInt(encodeMorton3(ix, iy, iz)) << BigInt(32) | BigInt(i);
        }

        codes.sort();

        // allocate data for the order buffer, but make it texture-memory sized
        const order = new Uint32Array(means_l.width * means_l.height);
        for (let i = 0; i < this.numSplats; ++i) {
            order[i] = Number(codes[i] & BigInt(0xffffffff));
        }
    
        return order;
    }

    reorderData() {
        this.reorder(this.calcMortonOrder());
    }
}

export { GSplatSogsData };
