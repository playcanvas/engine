import { Debug } from '../../core/debug.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { GSplatData } from './gsplat-data.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_NEAREST,
    PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA32U,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';
import { QuadRender } from '../../scene/graphics/quad-render.js';
import { RenderPassQuad } from '../../scene/graphics/render-pass-quad.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import glslSogCentersPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSogCenters.js';
import wgslSogCentersPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSogCenters.js';

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

class GSplatSogIterator {
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

class GSplatSogData {
    meta;

    numSplats;

    means_l;

    means_u;

    quats;

    scales;

    sh0;

    sh_centroids;

    sh_labels;

    /**
     * V2-only codebook LUT (256x1 RGBA32F): .r = scales, .g = sh0, .b = shN, .a unused.
     * Built from meta codebooks in prepareCodebook(). Null for V1 assets.
     *
     * @type {Texture|null}
     */
    codebookTexture = null;

    /**
     * URL of the asset, used for debugging texture names.
     */
    url = '';

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
     * Number of spherical harmonics bands.
     */
    shBands = 0;

    _destroyGpuResources() {
        this.means_l?.destroy();
        this.means_u?.destroy();
        this.quats?.destroy();
        this.scales?.destroy();
        this.sh0?.destroy();
        this.sh_centroids?.destroy();
        this.sh_labels?.destroy();
        this.codebookTexture?.destroy();
        this.codebookTexture = null;
    }

    // calculate the number of bands given the centroids texture width
    static calcBands(centroidsWidth) {
        // sh palette has 64 sh entries per row: 192 = 1 band (64*3), 512 = 2 bands (64*8), 960 = 3 bands (64*15)
        const shBandsWidths = { 192: 1, 512: 2, 960: 3 };
        return shBandsWidths[centroidsWidth] ?? 0;
    }

    destroy() {
        this.destroyed = true;
        this._destroyGpuResources();
    }

    createIter(p, r, s, c, sh) {
        return new GSplatSogIterator(this, p, r, s, c, sh);
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

    get isSog() {
        return true;
    }

    async decompress() {
        const members = [
            'x', 'y', 'z',
            'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
            'scale_0', 'scale_1', 'scale_2',
            'rot_0', 'rot_1', 'rot_2', 'rot_3'
        ];

        // ensure V2 codebooks are patched before the CPU iterator indexes them; the GPU flow
        // does this via prepareCodebook(), but decompress runs without that path.
        this._patchCodebooks();

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
            name: 'sogCentersTexture',
            width,
            height,
            format: PIXELFORMAT_RGBA32U,
            mipmaps: false
        });

        const shader = ShaderUtils.createShader(device, {
            uniqueName: 'GsplatSogCentersShader',
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslSogCentersPS,
            fragmentWGSL: wgslSogCentersPS,
            fragmentOutputTypes: ['uvec4']
        });

        const renderTarget = new RenderTarget({
            colorBuffer: centersTexture,
            depth: false,
            mipLevel: 0
        });

        resolve(scope, {
            means_l: this.means_l,
            means_u: this.means_u,
            numSplats: this.numSplats,
            means_mins: this.meta.means.mins,
            means_maxs: this.meta.means.maxs
        });

        const quad = new QuadRender(shader);
        const renderPass = new RenderPassQuad(device, quad);
        renderPass.name = 'SogGenerateCenters';
        renderPass.init(renderTarget);
        renderPass.colorOps.clear = false;
        renderPass.depthStencilOps.clearDepth = false;
        renderPass.render();
        quad.destroy();

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

    /**
     * Creates the V2 codebook LUT texture. Packs the three 256-entry scalar codebooks
     * (scales, sh0, shN) into a single 256x1 RGBA32F texture:
     * - .r = scales codebook
     * - .g = sh0 codebook
     * - .b = shN codebook
     * - .a = 0 (unused)
     *
     * @private
     */
    _createCodebookTexture() {
        Debug.assert(!this.codebookTexture, 'GSplatSogData: codebookTexture already exists - _createCodebookTexture() should only be called once per data instance.');

        const device = this.means_l.device;
        const { scales, sh0, shN } = this.meta;

        // scales and sh0 codebooks are mandatory for V2, shN only present when SH > 0
        const scalesCb = scales.codebook;
        const sh0Cb = sh0.codebook;
        const shNCb = shN?.codebook;

        const data = new Float32Array(256 * 4);
        for (let i = 0; i < 256; i++) data[i * 4]     = scalesCb[i];
        for (let i = 0; i < 256; i++) data[i * 4 + 1] = sh0Cb[i];
        if (shNCb) {
            for (let i = 0; i < 256; i++) data[i * 4 + 2] = shNCb[i];
        }
        // .a unused (stays 0 from Float32Array init; .b also 0 when no SH)

        const urlSuffix = this.url ? `_${this.url}` : '';
        this.codebookTexture = new Texture(device, {
            name: `sogCodebook${urlSuffix}`,
            width: 256,
            height: 1,
            format: PIXELFORMAT_RGBA32F,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            levels: [data]
        });
    }

    /**
     * Patches any null-leading codebook entries in place. A null `codebook[0]` was a bug in
     * older SOG creation tools (since fixed); this workaround keeps already-published assets
     * in the wild renderable by synthesizing a plausible value so downstream sampling never
     * produces NaN. Required for both GPU rendering and CPU decompression flows.
     *
     * @private
     */
    _patchCodebooks() {
        ['scales', 'sh0', 'shN'].forEach((name) => {
            const codebook = this.meta[name]?.codebook;
            if (codebook?.[0] === null) {
                codebook[0] = codebook[1] + (codebook[1] - codebook[255]) / 255;
            }
        });
    }

    /**
     * Synchronous codebook preparation. Patches any null-leading codebook entries and, for V2
     * assets, builds the codebook LUT texture. Must be called before {@link prepareGpuData}.
     */
    prepareCodebook() {
        const device = this.means_l?.device;
        if (this.destroyed || !device || device._destroyed) return;

        this._patchCodebooks();

        // V2 only: build the codebook LUT texture
        if (this.meta.version === 2) {
            this._createCodebookTexture();
        }
    }

    async prepareGpuData() {
        const device = this.means_l?.device;
        if (this.destroyed || !device || device._destroyed) return;
        await this.generateCenters();
    }
}

export { GSplatSogData };
