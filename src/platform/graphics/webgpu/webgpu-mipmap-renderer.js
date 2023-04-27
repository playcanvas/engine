import { Shader } from "../shader.js";
import { SHADERLANGUAGE_WGSL } from "../constants.js";
import { Debug, DebugHelper } from "../../../core/debug.js";
import { DebugGraphics } from "../debug-graphics.js";

/**
 * A WebGPU helper class implementing texture mipmap generation.
 *
 * @ignore
 */
class WebgpuMipmapRenderer {
    /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
    device;

    constructor(device) {
        this.device = device;
        const wgpu = device.wgpu;

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
        this.minSampler = wgpu.createSampler({ minFilter: 'linear' });
    }

    /**
     * Generates mipmaps for the specified WebGPU texture.
     *
     * @param {import('./webgpu-texture.js').WebgpuTexture} webgpuTexture - The texture to generate mipmaps for.
     */
    generate(webgpuTexture) {

        // not all types are currently supported
        if (webgpuTexture.texture.cubemap || webgpuTexture.texture.volume) {
            Debug.warnOnce('WebGPU mipmap generation is not supported for cubemaps or volume textures.');
            return;
        }

        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'MIPMAP-RENDERER');

        // cannot run this inside render pass
        Debug.assert(!device.insideRenderPass);

        const wgpu = device.wgpu;
        const textureDescr = webgpuTexture.descr;

        /** @type {import('./webgpu-shader.js').WebgpuShader} */
        const webgpuShader = this.shader.impl;

        const pipeline = wgpu.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: webgpuShader.getVertexShaderModule(),
                entryPoint: webgpuShader.vertexEntryPoint
            },
            fragment: {
                module: webgpuShader.getFragmentShaderModule(),
                entryPoint: webgpuShader.fragmentEntryPoint,
                targets: [{
                    format: textureDescr.format // use the same format as the texture
                }]
            },
            primitive: {
                topology: 'triangle-strip'
            }
        });

        let srcView = webgpuTexture.createView({
            baseMipLevel: 0,
            mipLevelCount: 1
        });

        // loop through each mip level and render the previous level's contents into it.
        const commandEncoder = wgpu.createCommandEncoder();
        for (let i = 1; i < textureDescr.mipLevelCount; i++) {

            const dstView = webgpuTexture.createView({
                baseMipLevel: i,
                mipLevelCount: 1
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
                    resource: srcView
                }]
            });

            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(4);
            passEncoder.end();

            // next iteration
            srcView = dstView;
        }

        wgpu.queue.submit([commandEncoder.finish()]);

        // clear invalidated state
        device.pipeline = null;

        DebugGraphics.popGpuMarker(device);
    }
}

export { WebgpuMipmapRenderer };
