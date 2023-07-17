import { Shader } from "../shader.js";
import { SHADERLANGUAGE_WGSL } from "../constants.js";
import { Debug, DebugHelper } from "../../../core/debug.js";
import { DebugGraphics } from "../debug-graphics.js";

/**
 * A WebGPU helper class implementing custom resolve of multi-sampled textures.
 *
 * @ignore
 */
class WebgpuResolver {
    /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
    device;

    /**
     * Cache of render pipelines for each texture format, to avoid their per frame creation.
     *
     * @type {Map<GPUTextureFormat, GPURenderPipeline>}
     * @private
     */
    pipelineCache = new Map();

    constructor(device) {
        this.device = device;

        // Shader that renders a fullscreen textured quad and copies the depth value from sample index 0
        // TODO: could handle all sample indices and use min/max as needed
        const code = `
 
            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
                vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
            );

            struct VertexOutput {
                @builtin(position) position : vec4f,
            };

            @vertex
            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
              var output : VertexOutput;
              output.position = vec4f(pos[vertexIndex], 0, 1);
              return output;
            }

            @group(0) @binding(0) var img : texture_depth_multisampled_2d;

            @fragment
            fn fragmentMain(@builtin(position) fragColor: vec4f) -> @location(0) vec4f {
                // load th depth value from sample index 0
                var depth = textureLoad(img, vec2i(fragColor.xy), 0u);
                return vec4<f32>(depth, 0.0, 0.0, 0.0);
            }
        `;

        this.shader = new Shader(device, {
            name: 'WebGPUResolverDepthShader',
            shaderLanguage: SHADERLANGUAGE_WGSL,
            vshader: code,
            fshader: code
        });
    }

    destroy() {
        this.shader.destroy();
        this.shader = null;
        this.pipelineCache = null;
    }

    /** @private */
    getPipeline(format) {
        let pipeline = this.pipelineCache.get(format);
        if (!pipeline) {
            pipeline = this.createPipeline(format);
            this.pipelineCache.set(format, pipeline);
        }
        return pipeline;
    }

    /** @private */
    createPipeline(format) {

        /** @type {import('./webgpu-shader.js').WebgpuShader} */
        const webgpuShader = this.shader.impl;

        const pipeline = this.device.wgpu.createRenderPipeline({
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
        DebugHelper.setLabel(pipeline, `RenderPipeline-DepthResolver-${format}`);
        return pipeline;
    }

    /**
     * @param {GPUCommandEncoder} commandEncoder - Command encoder to use for the resolve.
     * @param {GPUTexture} sourceTexture - Source multi-sampled depth texture to resolve.
     * @param {GPUTexture} destinationTexture - Destination depth texture to resolve to.
     * @private
     */
    resolveDepth(commandEncoder, sourceTexture, destinationTexture) {

        Debug.assert(sourceTexture.sampleCount > 1);
        Debug.assert(destinationTexture.sampleCount === 1);
        Debug.assert(sourceTexture.depthOrArrayLayers === destinationTexture.depthOrArrayLayers);

        const device = this.device;
        const wgpu = device.wgpu;

        // pipeline depends on the format
        const pipeline = this.getPipeline(destinationTexture.format);

        DebugGraphics.pushGpuMarker(device, 'DEPTH_RESOLVE-RENDERER');

        const numFaces = sourceTexture.depthOrArrayLayers;
        for (let face = 0; face < numFaces; face++) {

            // copy depth only (not stencil)
            const srcView = sourceTexture.createView({
                dimension: '2d',
                aspect: 'depth-only',
                baseMipLevel: 0,
                mipLevelCount: 1,
                baseArrayLayer: face
            });

            const dstView = destinationTexture.createView({
                dimension: '2d',
                baseMipLevel: 0,
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
            DebugHelper.setLabel(passEncoder, `DepthResolve-PassEncoder`);

            // no need for a sampler when using textureLoad
            const bindGroup = wgpu.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [{
                    binding: 0,
                    resource: srcView
                }]
            });

            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(4);
            passEncoder.end();
        }

        DebugGraphics.popGpuMarker(device);

        // clear invalidated state
        device.pipeline = null;
    }
}

export { WebgpuResolver };
