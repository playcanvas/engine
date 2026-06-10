import {
    BINDGROUP_MESH, BINDGROUP_MESH_UB, BINDGROUP_VIEW,
    BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE,
    BUFFER_STATIC,
    BUFFER_STREAM,
    CULLFACE_NONE,
    INDEXFORMAT_UINT16,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    TYPE_FLOAT32
} from '../../platform/graphics/constants.js';
import { Debug } from '../../core/debug.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { BindGroup, DynamicBindGroup } from '../../platform/graphics/bind-group.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { UniformBuffer } from '../../platform/graphics/uniform-buffer.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';

// Graph colors for MiniStats
const graphColorDefault = '1.0, 0.412, 0.380';  // Pastel Red
const graphColorGpu = '0.467, 0.867, 0.467';    // Pastel Green
const graphColorCpu = '0.424, 0.627, 0.863';    // Little Boy Blue

// Background colors for MiniStats graphs
const mainBackgroundColor = '0.0, 0.0, 0.0';
const gpuBackgroundColor = '0.15, 0.15, 0.0';
const cpuBackgroundColor = '0.15, 0.0, 0.1';

const vertexShaderGLSL = /* glsl */ `
    attribute vec3 vertex_position;         // unnormalized xy, word flag
    attribute vec4 vertex_texCoord0;        // unnormalized texture space uv, normalized uv

    varying vec4 uv0;
    varying float wordFlag;

    void main(void) {
        gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);
        uv0 = vertex_texCoord0;
        wordFlag = vertex_position.z;
    }
`;

const vertexShaderWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;         // unnormalized xy, word flag
    attribute vertex_texCoord0: vec4f;        // unnormalized texture space uv, normalized uv

    varying uv0: vec4f;
    varying wordFlag: f32;

    @vertex fn vertexMain(input : VertexInput) -> VertexOutput {
        var output : VertexOutput;
        output.position = vec4(input.vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);
        output.uv0 = input.vertex_texCoord0;
        output.wordFlag = input.vertex_position.z;
        return output;
    }
`;

// this fragment shader renders the bits required for text and graphs. The text is identified
// in the texture by white color. The graph data is specified as a single row of pixels
// where the R channel denotes the graph height
const fragmentShaderGLSL = /* glsl */ `
    varying vec4 uv0;
    varying float wordFlag;

    uniform vec4 clr;
    uniform sampler2D graphTex;
    uniform sampler2D wordsTex;

    void main (void) {
        vec3 graphColor = vec3(${graphColorDefault});
        if (wordFlag > 0.5) {
            graphColor = vec3(${graphColorCpu});
        } else if (wordFlag > 0.2) {
            graphColor = vec3(${graphColorGpu});
        }

        vec4 graphSample = texture2D(graphTex, uv0.xy);

        vec4 graph;
        if (uv0.w < graphSample.r)
            graph = vec4(graphColor, 1.0);
        else {
            vec3 bgColor = vec3(${mainBackgroundColor});
            if (wordFlag > 0.5) {
                bgColor = vec3(${cpuBackgroundColor});  // CPU: red tint
            } else if (wordFlag > 0.2) {
                bgColor = vec3(${gpuBackgroundColor});  // GPU: blue tint
            }
            graph = vec4(bgColor, 1.0);
        }

        vec4 words = texture2D(wordsTex, vec2(uv0.x, 1.0 - uv0.y));

        // Binary blend: either graph or text, no partial mixing
        if (wordFlag > 0.99) {
            gl_FragColor = words * clr;
        } else {
            gl_FragColor = graph * clr;
        }
    }
`;

const fragmentShaderWGSL = /* wgsl */ `
    varying uv0: vec4f;
    varying wordFlag: f32;

    uniform clr: vec4f;

    var graphTex : texture_2d<f32>;
    var graphTex_sampler : sampler;

    var wordsTex : texture_2d<f32>;
    var wordsTex_sampler : sampler;

    @fragment fn fragmentMain(input : FragmentInput) -> FragmentOutput {
        var uv0: vec4f = input.uv0;
        var graphColor: vec3f = vec3f(${graphColorDefault});
        if (input.wordFlag > 0.5) {
            graphColor = vec3f(${graphColorCpu});
        } else if (input.wordFlag > 0.2) {
            graphColor = vec3f(${graphColorGpu});
        }

        var graphSample: vec4f = textureSample(graphTex, graphTex_sampler, uv0.xy);

        var graph: vec4f;
        if (uv0.w < graphSample.r) {
            graph = vec4f(graphColor, 1.0);
        } else {
            var bgColor: vec3f = vec3f(${mainBackgroundColor});
            if (input.wordFlag > 0.5) {
                bgColor = vec3f(${cpuBackgroundColor});  // CPU: red tint
            } else if (input.wordFlag > 0.2) {
                bgColor = vec3f(${gpuBackgroundColor});  // GPU: blue tint
            }
            graph = vec4f(bgColor, 1.0);
        }

        var words: vec4f = textureSample(wordsTex, wordsTex_sampler, vec2f(uv0.x, 1.0 - uv0.y));

        var output: FragmentOutput;
        // Binary blend: either graph or text, no partial mixing
        if (input.wordFlag > 0.99) {
            output.color = words * uniform.clr;
        } else {
            output.color = graph * uniform.clr;
        }
        return output;
    }
`;

const dynamicBindGroup = new DynamicBindGroup();

// render pass drawing the overlay quads directly to the backbuffer, after the frame has rendered.
// This makes the overlay independent of cameras and layers, with a full-canvas viewport.
class RenderPassMiniStats extends RenderPass {
    constructor(device, render2d) {
        super(device);
        this.render2d = render2d;

        // render to the backbuffer, preserving its content
        this.init(null);
        this.colorOps.clear = false;
        this.depthStencilOps.clearDepth = false;
    }

    execute() {
        this.render2d.draw();
    }
}

// render 2d textured quads
class Render2d {
    constructor(device, maxQuads = 2048) {
        const format = new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_TEXCOORD0, components: 4, type: TYPE_FLOAT32 }
        ]);

        // generate quad indices
        const indices = new Uint16Array(maxQuads * 6);
        for (let i = 0; i < maxQuads; ++i) {
            indices[i * 6 + 0] = i * 4;
            indices[i * 6 + 1] = i * 4 + 1;
            indices[i * 6 + 2] = i * 4 + 2;
            indices[i * 6 + 3] = i * 4;
            indices[i * 6 + 4] = i * 4 + 2;
            indices[i * 6 + 5] = i * 4 + 3;
        }

        this.device = device;
        this.maxQuads = maxQuads;
        this.buffer = new VertexBuffer(device, format, maxQuads * 4, {
            usage: BUFFER_STREAM
        });
        this.data = new Float32Array(this.buffer.numBytes / 4);
        this.indexBuffer = new IndexBuffer(device, INDEXFORMAT_UINT16, maxQuads * 6, BUFFER_STATIC, indices);
        this.prim = {
            type: PRIMITIVE_TRIANGLES,
            indexed: true,
            base: 0,
            baseVertex: 0,
            count: 0
        };
        this.quads = 0;

        let shader = ShaderUtils.createShader(device, {
            uniqueName: 'MiniStats',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_texCoord0: SEMANTIC_TEXCOORD0
            },
            vertexGLSL: vertexShaderGLSL,
            fragmentGLSL: fragmentShaderGLSL,
            vertexWGSL: vertexShaderWGSL,
            fragmentWGSL: fragmentShaderWGSL
        });

        // devices using uniform buffers need the shader processed and bind groups set up
        if (device.supportsUniformBuffers) {
            shader = ShaderUtils.processShader(shader, new ShaderProcessorOptions());
            const ubFormat = shader.meshUniformBufferFormat;
            if (ubFormat) {
                this.uniformBuffer = new UniformBuffer(device, ubFormat, false);
            }
            this.bindGroup = new BindGroup(device, shader.meshBindGroupFormat);
        }
        this.shader = shader;

        this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);

        this.renderPass = new RenderPassMiniStats(device, this);

        this.uniforms = {
            clr: new Float32Array(4)
        };

        this.targetSize = {
            width: device.width,
            height: device.height
        };
    }

    destroy() {
        this.renderPass.destroy();
        this.uniformBuffer?.destroy();
        this.bindGroup?.destroy();
        this.buffer.destroy();
        this.indexBuffer.destroy();
    }

    quad(x, y, w, h, u, v, uw, uh, texture, wordFlag = 0) {
        // bounds check to prevent buffer overflow
        if (this.quads >= this.maxQuads) {
            Debug.warnOnce('MiniStats: maximum number of quads exceeded, some elements may not render.');
            return;
        }

        const rw = this.targetSize.width;
        const rh = this.targetSize.height;
        const x0 = x / rw;
        const y0 = y / rh;
        const x1 = (x + w) / rw;
        const y1 = (y + h) / rh;

        const tw = texture.width;
        const th = texture.height;
        const u0 = u / tw;
        const v0 = v / th;
        const u1 = (u + (uw ?? w)) / tw;
        const v1 = (v + (uh ?? h)) / th;

        this.data.set([
            x0, y0, wordFlag, u0, v0, 0, 0,
            x1, y0, wordFlag, u1, v0, 1, 0,
            x1, y1, wordFlag, u1, v1, 1, 1,
            x0, y1, wordFlag, u0, v1, 0, 1
        ], 4 * 7 * this.quads);

        this.quads++;
        this.prim.count += 6;
    }

    startFrame() {
        this.quads = 0;
        this.prim.count = 0;

        this.targetSize.width = this.device.canvas.scrollWidth;
        this.targetSize.height = this.device.canvas.scrollHeight;
    }

    render(graphTexture, wordsTexture, clr) {

        // set vertex data (swap storage)
        this.buffer.setData(this.data.buffer);

        this.uniforms.clr.set(clr, 0);
        this.graphTexture = graphTexture;
        this.wordsTexture = wordsTexture;
    }

    // called by the render pass to draw the prepared quads
    draw() {
        const { device, prim } = this;
        if (!prim.count) {
            return;
        }

        // full backbuffer viewport, as a viewport of a previous camera can be active when the
        // frame graph merges this pass into the previous one
        const { width, height } = device;
        device.setViewport(0, 0, width, height);
        device.setScissor(0, 0, width, height);

        device.setDrawStates(this.blendState, DepthState.NODEPTH, CULLFACE_NONE);

        const scope = device.scope;
        scope.resolve('clr').setValue(this.uniforms.clr);
        scope.resolve('graphTex').setValue(this.graphTexture);
        scope.resolve('wordsTex').setValue(this.wordsTexture);

        device.setVertexBuffer(this.buffer);
        device.setShader(this.shader);

        if (device.supportsUniformBuffers) {
            device.setBindGroup(BINDGROUP_VIEW, device.emptyBindGroup);

            this.bindGroup.update();
            device.setBindGroup(BINDGROUP_MESH, this.bindGroup);

            if (this.uniformBuffer) {
                this.uniformBuffer.update(dynamicBindGroup);
                device.setBindGroup(BINDGROUP_MESH_UB, dynamicBindGroup.bindGroup, dynamicBindGroup.offsets);
            } else {
                device.setBindGroup(BINDGROUP_MESH_UB, device.emptyBindGroup);
            }
        }

        device.draw(prim, this.indexBuffer);
    }
}

export { Render2d };
