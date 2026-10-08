import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';
import webgpuMipmap from '../shader-chunks/frag/webgpu-mipmap.js';
import webgpuMipmap3d from '../shader-chunks/frag/webgpu-mipmap-3d.js';

/**
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 * @import { WebgpuShader } from './webgpu-shader.js'
 * @import { WebgpuTexture } from './webgpu-texture.js'
 */

/**
 * A WebGPU helper class implementing texture mipmap generation.
 *
 * @ignore
 */
class WebgpuMipmapRenderer {
    /** @type {WebgpuGraphicsDevice} */
    device;

    /**
     * Cache of render pipelines keyed by texture format, separately for volume textures.
     *
     * @type {Map<string, GPURenderPipeline>}
     * @private
     */
    pipelineCache = new Map();

    /**
     * The shader and the sampler used to generate the mipmaps of volume textures, created on first
     * use, as most applications do not use volume textures.
     *
     * @type {Shader|null}
     * @private
     */
    shader3d = null;

    /**
     * @type {GPUSampler|null}
     * @private
     */
    linearSampler = null;

    constructor(device) {
        this.device = device;

        // shader that renders a fullscreen textured quad
        this.shader = new Shader(device, {
            name: 'WebGPUMipmapRendererShader',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            vshader: webgpuMipmap,
            fshader: webgpuMipmap
        });

        // using minified rendering, so that's the only filter mode we need to set.
        this.minSampler = device.wgpu.createSampler({ minFilter: 'linear' });
    }

    destroy() {
        this.shader.destroy();
        this.shader = null;
        this.shader3d?.destroy();
        this.shader3d = null;
        this.pipelineCache.clear();
    }

    /**
     * Returns the cached render pipeline for the texture format, creating it if needed.
     *
     * @param {GPUTextureFormat} format - The texture format.
     * @param {boolean} volume - True to return the pipeline for volume textures.
     * @returns {GPURenderPipeline} The render pipeline.
     * @private
     */
    getPipeline(format, volume) {
        const key = volume ? `3d:${format}` : format;
        let pipeline = this.pipelineCache.get(key);
        if (!pipeline) {
            /** @type {WebgpuShader} */
            const webgpuShader = (volume ? this.shader3d : this.shader).impl;

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
        const wgpu = device.wgpu;
        const pipeline = this.getPipeline(textureDescr.format, false);

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

                const bindGroup = wgpu.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [{
                        binding: 0,
                        resource: this.minSampler
                    }, {
                        binding: 1,
                        resource: srcViews[face]
                    }]
                });

                passEncoder.setPipeline(pipeline);
                passEncoder.setBindGroup(0, bindGroup);
                passEncoder.draw(4);
                passEncoder.end();

                // next iteration
                srcViews[face] = dstView;
            }
        }

        DebugGraphics.popGpuMarker(device);

        // clear invalidated state
        device.pipeline = null;
    }

    /**
     * Generates the mipmaps of a volume texture. Each depth slice of a mip level is rendered from
     * the previous mip level, sampled at the center of the slice, so the linear filtering averages
     * a 2x2x2 block of its texels.
     *
     * @param {WebgpuTexture} webgpuTexture - The volume texture to generate mipmaps for.
     * @private
     */
    generateVolume(webgpuTexture) {

        const device = this.device;
        const wgpu = device.wgpu;
        const texture = webgpuTexture.texture;
        const textureDescr = webgpuTexture.desc;

        if (!this.shader3d) {

            // shader that renders the depth slices of a volume texture
            this.shader3d = new Shader(device, {
                name: 'WebGPUMipmapRendererShader3d',
                shaderLanguage: SHADERLANGUAGE_WGSL,
                vshader: webgpuMipmap3d,
                fshader: webgpuMipmap3d
            });

            // a volume texture can keep its depth while its width and height get smaller (or the
            // other way around), so it is filtered in both cases
            this.linearSampler = wgpu.createSampler({ minFilter: 'linear', magFilter: 'linear' });
        }

        const pipeline = this.getPipeline(textureDescr.format, true);

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

            const bindGroup = wgpu.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [{
                    binding: 0,
                    resource: this.linearSampler
                }, {
                    binding: 1,
                    resource: srcView
                }]
            });

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
    }
}

export { WebgpuMipmapRenderer };
