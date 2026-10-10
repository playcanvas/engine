import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';
import { WebgpuDebug } from './webgpu-debug.js';
import webgpuMipmap from '../shader-chunks/frag/webgpu-mipmap.js';
import webgpuMipmap3d from '../shader-chunks/frag/webgpu-mipmap-3d.js';

/**
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 * @import { WebgpuShader } from './webgpu-shader.js'
 * @import { WebgpuTexture } from './webgpu-texture.js'
 */

// the shader of each variant of the mipmap generation - for 2D textures (including cubemaps and
// texture arrays) and volume textures, each in a version sampling the previous mip level with
// filtering, and a version reading its texels without a sampler and filtering them in the shader,
// for formats which cannot be filtered, selected by the UNFILTERABLE define
const shaderVariants = {
    '2d': { source: webgpuMipmap, unfilterable: false },
    '2d-unfilterable': { source: webgpuMipmap, unfilterable: true },
    '3d': { source: webgpuMipmap3d, unfilterable: false },
    '3d-unfilterable': { source: webgpuMipmap3d, unfilterable: true }
};

// formats which can only be filtered when the device supports float32-filterable
const float32Formats = new Set(['r32float', 'rg32float', 'rgba32float']);

/**
 * A WebGPU helper class implementing texture mipmap generation.
 *
 * @ignore
 */
class WebgpuMipmapRenderer {
    /** @type {WebgpuGraphicsDevice} */
    device;

    /**
     * Cache of render pipelines keyed by the shader variant and the texture format.
     *
     * @type {Map<string, GPURenderPipeline>}
     * @private
     */
    pipelineCache = new Map();

    /**
     * The shaders of the variants, keyed by the variant. All except the one for filterable 2D
     * textures are created on first use, as most applications do not need them.
     *
     * @type {Map<string, Shader>}
     * @private
     */
    shaders = new Map();

    /**
     * The sampler used for volume textures, created on first use.
     *
     * @type {GPUSampler|null}
     * @private
     */
    linearSampler = null;

    constructor(device) {
        this.device = device;

        // shader that renders a fullscreen textured quad
        this.getShader('2d');

        // using minified rendering, so that's the only filter mode we need to set.
        this.minSampler = device.wgpu.createSampler({ minFilter: 'linear' });
    }

    destroy() {
        this.shaders.forEach(shader => shader.destroy());
        this.shaders.clear();
        this.pipelineCache.clear();
    }

    /**
     * Returns the shader of the variant, creating it if needed.
     *
     * @param {string} variant - The variant, a key of shaderVariants.
     * @returns {Shader} The shader.
     * @private
     */
    getShader(variant) {
        let shader = this.shaders.get(variant);
        if (!shader) {
            const { source, unfilterable } = shaderVariants[variant];
            const code = unfilterable ? `#define UNFILTERABLE\n${source}` : source;
            shader = new Shader(this.device, {
                name: `WebGPUMipmapRendererShader-${variant}`,
                shaderLanguage: SHADERLANGUAGE_WGSL,
                vshader: code,
                fshader: code
            });
            this.shaders.set(variant, shader);
        }
        return shader;
    }

    /**
     * Returns the cached render pipeline for the variant and the texture format, creating it if
     * needed.
     *
     * @param {string} variant - The variant, a key of shaderVariants.
     * @param {GPUTextureFormat} format - The texture format.
     * @returns {GPURenderPipeline} The render pipeline.
     * @private
     */
    getPipeline(variant, format) {
        const key = `${variant}:${format}`;
        let pipeline = this.pipelineCache.get(key);
        if (!pipeline) {
            /** @type {WebgpuShader} */
            const webgpuShader = this.getShader(variant).impl;

            pipeline = this.device.wgpu.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module: webgpuShader.getVertexShaderModule(),
                    entryPoint: webgpuShader.vertexEntryPoint
                },
                fragment: {
                    module: webgpuShader.getFragmentShaderModule(),
                    entryPoint: webgpuShader.fragmentEntryPoint,
                    targets: [{
                        format: format
                    }]
                },
                primitive: {
                    topology: 'triangle-strip'
                }
            });
            DebugHelper.setLabel(pipeline, `RenderPipeline-MipmapRenderer-${key}`);
            this.pipelineCache.set(key, pipeline);
        }
        return pipeline;
    }

    /**
     * Returns true if the texture format cannot be filtered on this device, in which case its
     * mipmaps are generated by filtering texels read without a sampler.
     *
     * @param {GPUTextureFormat} format - The texture format.
     * @returns {boolean} True if the format cannot be filtered.
     * @private
     */
    isUnfilterable(format) {
        return !this.device.textureFloatFilterable && float32Formats.has(format);
    }

    /**
     * Creates the bind group reading the source mip level, with a sampler unless the format
     * cannot be filtered.
     *
     * @param {GPURenderPipeline} pipeline - The render pipeline.
     * @param {GPUTextureView} srcView - The view of the source mip level.
     * @param {GPUSampler|null} sampler - The sampler, or null for a format which cannot be filtered.
     * @returns {GPUBindGroup} The bind group.
     * @private
     */
    createBindGroup(pipeline, srcView, sampler) {
        return this.device.wgpu.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: sampler ? [{
                binding: 0,
                resource: sampler
            }, {
                binding: 1,
                resource: srcView
            }] : [{
                binding: 0,
                resource: srcView
            }]
        });
    }

    /**
     * Generates mipmaps for the specified WebGPU texture.
     *
     * @param {WebgpuTexture} webgpuTexture - The texture to generate mipmaps for.
     * @param {number} [layer] - The cubemap face or the array layer to generate the mipmaps for.
     * When not specified, the mipmaps are generated for all faces / layers. Ignored for volume
     * textures, as each of their mip levels is filtered from several depth slices.
     */
    generate(webgpuTexture, layer) {

        // ignore texture with no mipmaps
        const textureDescr = webgpuTexture.desc;
        if (textureDescr.mipLevelCount <= 1) {
            return;
        }

        if (webgpuTexture.texture.volume) {
            this.generateVolume(webgpuTexture);
            return;
        }

        const device = this.device;
        WebgpuDebug.validate(device);

        const unfilterable = this.isUnfilterable(textureDescr.format);
        const pipeline = this.getPipeline(unfilterable ? '2d-unfilterable' : '2d', textureDescr.format);
        const sampler = unfilterable ? null : this.minSampler;

        const texture = webgpuTexture.texture;
        const numFaces = texture.cubemap ? 6 : (texture.array ? texture.arrayLength : 1);
        const firstFace = layer ?? 0;
        const lastFace = layer === undefined ? numFaces : layer + 1;
        Debug.assert(firstFace >= 0 && lastFace <= numFaces, `MipmapRenderer: layer ${layer} is out of range for texture ${texture.name}`);

        const srcViews = [];
        for (let face = firstFace; face < lastFace; face++) {
            srcViews[face] = webgpuTexture.createView({
                dimension: '2d',
                baseMipLevel: 0,
                mipLevelCount: 1,
                baseArrayLayer: face
            });
        }

        // loop through each mip level and render the previous level's contents into it.
        const commandEncoder = device.getCommandEncoder();

        DebugGraphics.pushGpuMarker(device, 'MIPMAP-RENDERER');

        for (let i = 1; i < textureDescr.mipLevelCount; i++) {

            for (let face = firstFace; face < lastFace; face++) {

                const dstView = webgpuTexture.createView({
                    dimension: '2d',
                    baseMipLevel: i,
                    mipLevelCount: 1,
                    baseArrayLayer: face
                });

                const passEncoder = commandEncoder.beginRenderPass({
                    colorAttachments: [{
                        view: dstView,
                        loadOp: 'clear',
                        storeOp: 'store'
                    }]
                });
                DebugHelper.setLabel(passEncoder, `MipmapRenderer-PassEncoder_${i}`);

                passEncoder.setPipeline(pipeline);
                passEncoder.setBindGroup(0, this.createBindGroup(pipeline, srcViews[face], sampler));
                passEncoder.draw(4);
                passEncoder.end();

                // next iteration
                srcViews[face] = dstView;
            }
        }

        DebugGraphics.popGpuMarker(device);

        // clear invalidated state
        device.pipeline = null;

        WebgpuDebug.end(device, 'Mipmap generation', { texture, layer });
    }

    /**
     * Generates the mipmaps of a volume texture. Each depth slice of a mip level is rendered from
     * the previous mip level, sampled at the center of the slice, so the linear filtering averages
     * a 2x2x2 block of its texels - or for a format which cannot be filtered, the block is read
     * without a sampler and filtered in the shader.
     *
     * @param {WebgpuTexture} webgpuTexture - The volume texture to generate mipmaps for.
     * @private
     */
    generateVolume(webgpuTexture) {

        const device = this.device;
        WebgpuDebug.validate(device);

        const texture = webgpuTexture.texture;
        const textureDescr = webgpuTexture.desc;
        const unfilterable = this.isUnfilterable(textureDescr.format);
        const pipeline = this.getPipeline(unfilterable ? '3d-unfilterable' : '3d', textureDescr.format);

        // a volume texture can keep its depth while its width and height get smaller (or the other
        // way around), so it is filtered in both cases
        if (!unfilterable) {
            this.linearSampler ??= device.wgpu.createSampler({ minFilter: 'linear', magFilter: 'linear' });
        }
        const sampler = unfilterable ? null : this.linearSampler;

        const commandEncoder = device.getCommandEncoder();

        DebugGraphics.pushGpuMarker(device, 'MIPMAP-RENDERER-3D');

        for (let i = 1; i < textureDescr.mipLevelCount; i++) {

            const srcView = webgpuTexture.createView({
                dimension: '3d',
                baseMipLevel: i - 1,
                mipLevelCount: 1
            });

            const dstView = webgpuTexture.createView({
                dimension: '3d',
                baseMipLevel: i,
                mipLevelCount: 1
            });

            const bindGroup = this.createBindGroup(pipeline, srcView, sampler);

            // a render pass for each depth slice of the mip level, the slice is the instance index
            const depth = Math.max(1, texture.depth >> i);
            for (let slice = 0; slice < depth; slice++) {

                const passEncoder = commandEncoder.beginRenderPass({
                    colorAttachments: [{
                        view: dstView,
                        depthSlice: slice,
                        loadOp: 'clear',
                        storeOp: 'store'
                    }]
                });
                DebugHelper.setLabel(passEncoder, `MipmapRenderer3d-PassEncoder_${i}_${slice}`);

                passEncoder.setPipeline(pipeline);
                passEncoder.setBindGroup(0, bindGroup);
                passEncoder.draw(4, 1, 0, slice);
                passEncoder.end();
            }
        }

        DebugGraphics.popGpuMarker(device);

        // clear invalidated state
        device.pipeline = null;

        WebgpuDebug.end(device, 'Mipmap generation', { texture });
    }
}

export { WebgpuMipmapRenderer };
