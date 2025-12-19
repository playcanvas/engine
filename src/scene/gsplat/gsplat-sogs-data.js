import { Debug } from '../../core/debug.js';
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

import glslSogsCentersPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSogsCenters.js';
import wgslSogsCentersPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSogsCenters.js';

/**
 * @import { EventHandle } from '../../core/event-handle.js'
 */

const SH_C0 = 0.28209479177387814;

const readImageDataAsync = (texture) => {

    if (texture.device.isNull) {
        return new Promise((resolve) => {
            resolve(new Uint8Array(texture.width * texture.height * 4));
        });
    }

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

        const norm = Math.SQRT2;

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

    /**
     * URL of the asset, used for debugging texture names.
     *
     * @type {string}
     */
    url = '';

    /**
     * Whether to use minimal memory mode (releases source textures after packing).
     *
     * @type {boolean}
     */
    minimalMemory = false;

    /**
     * Event handle for devicerestored listener (when minimalMemory is false).
     *
     * @type {EventHandle|null}
     */
    deviceRestoredEvent = null;

    /**
     * Cached centers array (x, y, z per splat), length = numSplats * 3.
     *
     * @type {Float32Array | null}
     * @private
     */
    _centers = null;

    // Marked when resource is destroyed, to abort any in-flight async preparation
    destroyed = false;

    /**
     * Cached number of spherical harmonics bands.
     *
     * @type {number}
     * @private
     */
    _shBands = 0;

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
        // Remove devicerestored listener if it was registered
        this.deviceRestoredEvent?.off();
        this.deviceRestoredEvent = null;

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

    getCenters() {
        // centers can be only copied once to avoid making copies.
        Debug.assert(this._centers);
        const centers = /** @type {Float32Array} */ this._centers;
        this._centers = null;
        return centers;
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
        return this._shBands;
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

    async generateCenters() {
        const { device, width, height } = this.means_l;
        const { scope } = device;

        // create a temporary texture to render centers into
        const centersTexture = new Texture(device, {
            name: 'sogsCentersTexture',
            width,
            height,
            format: PIXELFORMAT_RGBA32U,
            mipmaps: false
        });

        const shader = ShaderUtils.createShader(device, {
            uniqueName: 'GsplatSogsCentersShader',
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslSogsCentersPS,
            fragmentWGSL: wgslSogsCentersPS,
            fragmentOutputTypes: ['uvec4'],
            fragmentIncludes: new Map([['gsplatPackingPS', device.isWebGPU ? wgslGsplatPackingPS : glslGsplatPackingPS]])
        });

        const renderTarget = new RenderTarget({
            colorBuffer: centersTexture,
            depth: false,
            mipLevel: 0
        });

        device.setCullMode(CULLFACE_NONE);
        device.setBlendState(BlendState.NOBLEND);
        device.setDepthState(DepthState.NODEPTH);

        resolve(scope, {
            means_l: this.means_l,
            means_u: this.means_u,
            numSplats: this.numSplats,
            means_mins: this.meta.means.mins,
            means_maxs: this.meta.means.maxs
        });

        drawQuadWithShader(device, renderTarget, shader);

        renderTarget.destroy();

        const u32 = await readImageDataAsync(centersTexture);
        if (this.destroyed || device._destroyed) {
            centersTexture.destroy();
            return;
        }

        const asFloat = new Float32Array(u32.buffer);
        const result = new Float32Array(this.numSplats * 3);
        for (let i = 0; i < this.numSplats; i++) {
            const base = i * 4;
            result[i * 3 + 0] = asFloat[base + 0];
            result[i * 3 + 1] = asFloat[base + 1];
            result[i * 3 + 2] = asFloat[base + 2];
        }
        this._centers = result;
        centersTexture.destroy();
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
        let device = this.means_l.device;
        const { height, width } = this.means_l;

        if (this.destroyed || !device || device._destroyed) return;

        // Cache shBands from sh_centroids texture width before source textures may be destroyed
        // sh palette has 64 sh entries per row: 192 = 1 band (64*3), 512 = 2 bands (64*8), 960 = 3 bands (64*15)
        const shBandsWidths = { 192: 1, 512: 2, 960: 3 };
        this._shBands = shBandsWidths[this.sh_centroids?.width] ?? 0;

        // Include URL in texture name for debugging
        const urlSuffix = this.url ? `_${this.url}` : '';

        this.packedTexture = new Texture(device, {
            name: `sogsPackedTexture${urlSuffix}`,
            width,
            height,
            format: PIXELFORMAT_RGBA32U,
            mipmaps: false
        });

        this.packedSh0 = new Texture(device, {
            name: `sogsPackedSh0${urlSuffix}`,
            width,
            height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false
        });

        this.packedShN = this.sh_centroids && new Texture(device, {
            name: `sogsPackedShN${urlSuffix}`,
            width: this.sh_centroids.width,
            height: this.sh_centroids.height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false
        });

        if (!this.minimalMemory) {

            // when context is restored, pack the gpu data again
            this.deviceRestoredEvent = device.on('devicerestored', () => {
                this.packGpuMemory();
                if (this.packedShN) {
                    this.packShMemory();
                }
            });
        }

        // patch codebooks starting with a null entry
        ['scales', 'sh0', 'shN'].forEach((name) => {
            const codebook = this.meta[name]?.codebook;
            if (codebook?.[0] === null) {
                codebook[0] = codebook[1] + (codebook[1] - codebook[255]) / 255;
            }
        });

        device = this.means_l?.device;
        if (this.destroyed || !device || device._destroyed) return;
        await this.generateCenters();

        device = this.means_l?.device;
        if (this.destroyed || !device || device._destroyed) return;
        this.packGpuMemory();
        if (this.packedShN) {
            device = this.means_l?.device;
            if (this.destroyed || !device || device._destroyed) return;
            this.packShMemory();
        }

        if (this.minimalMemory) {
            // Release source textures to save memory
            this.means_l?.destroy();
            this.means_u?.destroy();
            this.quats?.destroy();
            this.scales?.destroy();
            this.sh0?.destroy();
            this.sh_centroids?.destroy();
            this.sh_labels?.destroy();

            this.means_l = null;
            this.means_u = null;
            this.quats = null;
            this.scales = null;
            this.sh0 = null;
            this.sh_centroids = null;
            this.sh_labels = null;
        }
    }

    // temporary, for backwards compatibility
    reorderData() {
        return this.prepareGpuData();
    }
}

export { GSplatSogsData };
