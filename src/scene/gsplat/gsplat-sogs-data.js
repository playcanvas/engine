import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { CULLFACE_NONE, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA8, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslGsplatSogsReorderPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSogsReorder.js';
import wgslGsplatSogsReorderPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSogsReorder.js';

import glslGsplatSogsReorderSh from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSogsReorderSh.js';
import glslGsplatPackingPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatPacking.js';

import wgslGsplatSogsReorderSH from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSogsReorderSh.js';
import wgslGsplatPackingPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatPacking.js';

const SH_C0 = 0.28209479177387814;

const readImageDataAsync = (texture) => {
    return texture.read(0, 0, texture.width, texture.height, {
        mipLevel: 0,
        face: 0,
        immediate: true
    });
};

const resolve = (scope, values) => {
    for (const key in values) {
        scope.resolve(key).setValue(values[key]);
    }
};

class GSplatSogsIterator {
    constructor(data, p, r, s, c, sh) {

        const lerp = (a, b, t) => a * (1 - t) + b * t;

        // extract means for centers
        const { meta, shBands } = data;
        const { means, scales, sh0, shN } = meta;
        const means_l_data = p && data.means_l._levels[0];
        const means_u_data = p && data.means_u._levels[0];
        const quats_data = r && data.quats._levels[0];
        const scales_data = s && data.scales._levels[0];
        const sh0_data = c && data.sh0._levels[0];
        const sh_labels_data = sh && data.sh_labels._levels[0];
        const sh_centroids_data = sh && data.sh_centroids._levels[0];

        const norm = 2.0 / Math.sqrt(2.0);

        const coeffs = { 1: 3, 2: 8, 3: 15 }[shBands] ?? 0;

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
                if (meta.version === 2) {
                    const sx = scales.codebook[scales_data[i * 4 + 0]];
                    const sy = scales.codebook[scales_data[i * 4 + 1]];
                    const sz = scales.codebook[scales_data[i * 4 + 2]];
                    s.set(sx, sy, sz);
                } else {
                    const sx = lerp(scales.mins[0], scales.maxs[0], scales_data[i * 4 + 0] / 255);
                    const sy = lerp(scales.mins[1], scales.maxs[1], scales_data[i * 4 + 1] / 255);
                    const sz = lerp(scales.mins[2], scales.maxs[2], scales_data[i * 4 + 2] / 255);
                    s.set(sx, sy, sz);
                }
            }

            if (c) {
                if (meta.version === 2) {
                    const r = sh0.codebook[sh0_data[i * 4 + 0]];
                    const g = sh0.codebook[sh0_data[i * 4 + 1]];
                    const b = sh0.codebook[sh0_data[i * 4 + 2]];
                    const a = sh0_data[i * 4 + 3] / 255;
                    c.set(
                        0.5 + r * SH_C0,
                        0.5 + g * SH_C0,
                        0.5 + b * SH_C0,
                        a
                    );
                } else {
                    const r = lerp(sh0.mins[0], sh0.maxs[0], sh0_data[i * 4 + 0] / 255);
                    const g = lerp(sh0.mins[1], sh0.maxs[1], sh0_data[i * 4 + 1] / 255);
                    const b = lerp(sh0.mins[2], sh0.maxs[2], sh0_data[i * 4 + 2] / 255);
                    const a = lerp(sh0.mins[3], sh0.maxs[3], sh0_data[i * 4 + 3] / 255);

                    c.set(
                        0.5 + r * SH_C0,
                        0.5 + g * SH_C0,
                        0.5 + b * SH_C0,
                        1.0 / (1.0 + Math.exp(-a))
                    );
                }
            }

            if (sh) {
                const n = sh_labels_data[i * 4 + 0] + (sh_labels_data[i * 4 + 1] << 8);
                const u = (n % 64) * coeffs;
                const v = Math.floor(n / 64);

                if (meta.version === 2) {
                    for (let j = 0; j < 3; ++j) {
                        for (let k = 0; k < coeffs; ++k) {
                            sh[j * 15 + k] = shN.codebook[sh_centroids_data[((u + k) * 4 + j) + (v * data.sh_centroids.width * 4)]];
                        }
                    }
                } else {
                    for (let j = 0; j < 3; ++j) {
                        for (let k = 0; k < coeffs; ++k) {
                            sh[j * 15 + k] = lerp(shN.mins, shN.maxs, sh_centroids_data[((u + k) * 4 + j) + (v * data.sh_centroids.width * 4)] / 255);
                        }
                    }
                }
            }
        };
    }
}

class GSplatSogsData {
    meta;

    numSplats;

    means_l;

    means_u;

    quats;

    scales;

    sh0;

    sh_centroids;

    sh_labels;

    packedTexture;

    packedSh0;

    packedShN;

    // Marked when resource is destroyed, to abort any in-flight async preparation
    destroyed = false;

    _destroyGpuResources() {
        this.means_l?.destroy();
        this.means_u?.destroy();
        this.quats?.destroy();
        this.scales?.destroy();
        this.sh0?.destroy();
        this.sh_centroids?.destroy();
        this.sh_labels?.destroy();
        this.packedTexture?.destroy();
        this.packedSh0?.destroy();
        this.packedShN?.destroy();
    }

    destroy() {
        this.destroyed = true;
        this._destroyGpuResources();
    }

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
        const { meta, means_l, means_u, numSplats } = this;
        const { means } = meta;

        const means_u_data = new Uint32Array(means_u._levels[0].buffer);
        const means_l_data = new Uint32Array(means_l._levels[0].buffer);

        const mx = means.mins[0] / 65535;
        const my = means.mins[1] / 65535;
        const mz = means.mins[2] / 65535;
        const Mx = means.maxs[0] / 65535;
        const My = means.maxs[1] / 65535;
        const Mz = means.maxs[2] / 65535;

        for (let i = 0; i < numSplats; i++) {
            const idx = i;

            const means_u = means_u_data[idx];
            const means_l = means_l_data[idx];

            const wx = ((means_u <<  8) & 0xff00) |  (means_l         & 0xff);
            const wy =  (means_u        & 0xff00) | ((means_l >>> 8)  & 0xff);
            const wz = ((means_u >>> 8) & 0xff00) | ((means_l >>> 16) & 0xff);

            const nx = mx * (65535 - wx) + Mx * wx;
            const ny = my * (65535 - wy) + My * wy;
            const nz = mz * (65535 - wz) + Mz * wz;

            const ax = nx < 0 ? -nx : nx;
            const ay = ny < 0 ? -ny : ny;
            const az = nz < 0 ? -nz : nz;
            result[i * 3]     = (nx < 0 ? -1 : 1) * (Math.exp(ax) - 1);
            result[i * 3 + 1] = (ny < 0 ? -1 : 1) * (Math.exp(ay) - 1);
            result[i * 3 + 2] = (nz < 0 ? -1 : 1) * (Math.exp(az) - 1);
        }
    }

    // use bound center for focal point
    calcFocalPoint(result, pred) {
        const { mins, maxs } = this.meta.means;

        const map = v => Math.sign(v) * (Math.exp(Math.abs(v)) - 1);

        result.set(
            (map(mins[0]) + map(maxs[0])) * 0.5,
            (map(mins[1]) + map(maxs[1])) * 0.5,
            (map(mins[2]) + map(maxs[2])) * 0.5
        );
    }

    get isSogs() {
        return true;
    }

    get shBands() {
        // sh palette has 64 sh entries per row. use width to calculate number of bands
        const widths = {
            192: 1,     // 64 * 3
            512: 2,     // 64 * 8
            960: 3      // 64 * 15
        };
        return widths[this.sh_centroids?.width] ?? 0;
    }

    async decompress() {
        const members = [
            'x', 'y', 'z',
            'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
            'scale_0', 'scale_1', 'scale_2',
            'rot_0', 'rot_1', 'rot_2', 'rot_3'
        ];

        const { shBands } = this;

        // copy back gpu texture data so cpu iterator has access to it
        const { means_l, means_u, quats, scales, sh0, sh_labels, sh_centroids } = this;
        means_l._levels[0] = await readImageDataAsync(means_l);
        means_u._levels[0] = await readImageDataAsync(means_u);
        quats._levels[0] = await readImageDataAsync(quats);
        scales._levels[0] = await readImageDataAsync(scales);
        sh0._levels[0] = await readImageDataAsync(sh0);

        // allocate spherical harmonics data
        if (shBands > 0) {
            sh_labels._levels[0] = await readImageDataAsync(sh_labels);
            sh_centroids._levels[0] = await readImageDataAsync(sh_centroids);

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

    // pack the means, quats, scales and sh_labels data into one RGBA32U texture
    packGpuMemory() {
        const { meta, means_l, means_u, quats, scales, sh0, sh_labels, numSplats } = this;
        const { device } = means_l;
        const { scope } = device;

        const shaderKey = meta.version === 2 ? 'v2' : 'v1';

        // Note: do not destroy it, keep it available for the lifetime of the app
        const shader = ShaderUtils.createShader(device, {
            uniqueName: `GsplatSogsReorderShader-${shaderKey}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatSogsReorderPS,
            fragmentWGSL: wgslGsplatSogsReorderPS,
            fragmentOutputTypes: ['uvec4', 'vec4'],
            fragmentIncludes: new Map([['gsplatPackingPS', device.isWebGPU ? wgslGsplatPackingPS : glslGsplatPackingPS]]),
            fragmentDefines: (meta.version === 2) ? undefined : new Map([['REORDER_V1', '1']])
        });

        const renderTarget = new RenderTarget({
            colorBuffers: [this.packedTexture, this.packedSh0],
            depth: false,
            mipLevel: 0
        });

        device.setCullMode(CULLFACE_NONE);
        device.setBlendState(BlendState.NOBLEND);
        device.setDepthState(DepthState.NODEPTH);

        resolve(scope, {
            means_l,
            means_u,
            quats,
            scales,
            sh0,
            // use means_l as dummy texture for sh_labels if there is no spherical harmonics data
            sh_labels: sh_labels ?? means_l,
            numSplats,
            'scales_codebook[0]': this.meta.scales.codebook,
            'sh0_codebook[0]': this.meta.sh0.codebook,
            // V1
            scalesMins: meta.scales.mins,
            scalesMaxs: meta.scales.maxs,
            sh0Mins: meta.sh0.mins,
            sh0Maxs: meta.sh0.maxs
        });

        drawQuadWithShader(device, renderTarget, shader);

        renderTarget.destroy();
    }

    packShMemory() {
        const { meta, sh_centroids } = this;
        const { device } = sh_centroids;
        const { scope } = device;

        const shaderKey = meta.version === 2 ? 'v2' : 'v1';

        const shader = ShaderUtils.createShader(device, {
            uniqueName: `GsplatSogsReorderShShader-${shaderKey}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatSogsReorderSh,
            fragmentWGSL: wgslGsplatSogsReorderSH,
            fragmentIncludes: new Map([['gsplatPackingPS', device.isWebGPU ? wgslGsplatPackingPS : glslGsplatPackingPS]]),
            fragmentDefines: (meta.version === 2) ? undefined : new Map([['REORDER_V1', '1']])
        });

        const renderTarget = new RenderTarget({
            colorBuffer: this.packedShN,
            depth: false,
            mipLevel: 0
        });

        device.setCullMode(CULLFACE_NONE);
        device.setBlendState(BlendState.NOBLEND);
        device.setDepthState(DepthState.NODEPTH);

        resolve(scope, {
            sh_centroids,
            'shN_codebook[0]': this.meta.shN.codebook
        });

        drawQuadWithShader(device, renderTarget, shader);

        renderTarget.destroy();
    }

    async prepareGpuData() {
        const { device, height, width } = this.means_l;

        // copy back means_l and means_u data so cpu reorder has access to it
        if (this.destroyed || device._destroyed) return; // skip the rest if the resource was destroyed
        this.means_l._levels[0] = await readImageDataAsync(this.means_l);

        if (this.destroyed || device._destroyed) return; // skip the rest if the resource was destroyed
        this.means_u._levels[0] = await readImageDataAsync(this.means_u);

        if (this.destroyed || device._destroyed) return; // skip the rest if the resource was destroyed
        this.packedTexture = new Texture(device, {
            name: 'sogsPackedTexture',
            width,
            height,
            format: PIXELFORMAT_RGBA32U,
            mipmaps: false
        });

        this.packedSh0 = new Texture(device, {
            name: 'sogsPackedSh0',
            width,
            height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false
        });

        this.packedShN = this.sh_centroids && new Texture(device, {
            name: 'sogsPackedShN',
            width: this.sh_centroids.width,
            height: this.sh_centroids.height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false
        });

        device.on('devicerestored', () => {
            this.packGpuMemory();
            if (this.packedShN) {
                this.packShMemory();
            }
        });

        if (this.destroyed || device._destroyed) return; // skip the rest if the resource was destroyed
        this.packGpuMemory();
        if (this.packedShN) {
            if (this.destroyed || device._destroyed) return; // skip the rest if the resource was destroyed
            this.packShMemory();
        }
    }

    // temporary, for backwards compatibility
    reorderData() {
        return this.prepareGpuData();
    }
}

export { GSplatSogsData };
