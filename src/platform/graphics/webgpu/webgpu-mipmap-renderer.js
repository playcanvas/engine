import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';

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
     */
    pipelineCache = new Map();

    constructor(device) {
        this.device = device;

        // Shader that renders a fullscreen textured quad
        const code = `
 
            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
                vec2(-1.0, 1.0), vec2(1.0, 1.0),
                vec2(-1.0, -1.0), vec2(1.0, -1.0)
            );

            struct VertexOutput {
                @builtin(position) position : vec4f,
                @location(0) texCoord : vec2f
            };

            @vertex
            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
              var output : VertexOutput;
              output.texCoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5);
              output.position = vec4f(pos[vertexIndex], 0, 1);
              return output;
            }

            @group(0) @binding(0) var imgSampler : sampler;
            @group(0) @binding(1) var img : texture_2d<f32>;

            @fragment
            fn fragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
              return textureSample(img, imgSampler, texCoord);
            }
        `;

        this.shader = new Shader(device, {
            name: 'WebGPUMipmapRendererShader',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            vshader: code,
            fshader: code
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
     */
    generate(webgpuTexture) {

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

        const srcViews = [];
        for (let face = 0; face < numFaces; face++) {
            srcViews.push(webgpuTexture.createView({
                dimension: '2d',
                baseMipLevel: 0,
                mipLevelCount: 1,
                baseArrayLayer: face
            }));
        }

        // loop through each mip level and render the previous level's contents into it.
        const commandEncoder = device.getCommandEncoder();

        DebugGraphics.pushGpuMarker(device, 'MIPMAP-RENDERER');

        for (let i = 1; i < textureDescr.mipLevelCount; i++) {

            for (let face = 0; face < numFaces; face++) {

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
