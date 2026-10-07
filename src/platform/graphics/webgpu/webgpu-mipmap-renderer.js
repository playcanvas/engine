import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';
import webgpuMipmap from '../shader-chunks/frag/webgpu-mipmap.js';

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
     * Cache of render pipelines keyed by texture format.
     *
     * @type {Map<string, GPURenderPipeline>}
     * @private
     */
    pipelineCache = new Map();

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
        this.pipelineCache.clear();
    }

    /**
     * Generates mipmaps for the specified WebGPU texture.
     *
     * @param {WebgpuTexture} webgpuTexture - The texture to generate mipmaps for.
     * @param {number} [layer] - The cubemap face or the array layer to generate the mipmaps for.
     * When not specified, the mipmaps are generated for all faces / layers.
     */
    generate(webgpuTexture, layer) {

        // ignore texture with no mipmaps
        const textureDescr = webgpuTexture.desc;
        if (textureDescr.mipLevelCount <= 1) {
            return;
        }

        // not all types are currently supported
        if (webgpuTexture.texture.volume) {
            Debug.warnOnce('WebGPU mipmap generation is not supported volume texture.', webgpuTexture.texture);
            return;
        }

        const device = this.device;
        const wgpu = device.wgpu;
        const format = textureDescr.format;

        // Get or create cached pipeline for this texture format
        let pipeline = this.pipelineCache.get(format);
        if (!pipeline) {
            /** @type {WebgpuShader} */
            const webgpuShader = this.shader.impl;

            pipeline = wgpu.createRenderPipeline({
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
            DebugHelper.setLabel(pipeline, `RenderPipeline-MipmapRenderer-${format}`);
            this.pipelineCache.set(format, pipeline);
        }

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
}

export { WebgpuMipmapRenderer };
