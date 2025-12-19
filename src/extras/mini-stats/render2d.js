import {
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
import { GraphNode } from '../../scene/graph-node.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';

// Graph colors for MiniStats
const graphColorRed = '1.0, 0.412, 0.380';      // Pastel Red
const graphColorGreen = '0.467, 0.867, 0.467';  // Pastel Green
const graphColorBlue = '0.424, 0.627, 0.863';   // Little Boy Blue

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
// where the R channel denotes the height of the 1st graph and the G channel the height
// of the second graph and B channel the height of the last graph
const fragmentShaderGLSL = /* glsl */ `
    varying vec4 uv0;
    varying float wordFlag;

    uniform vec4 clr;
    uniform sampler2D graphTex;
    uniform sampler2D wordsTex;

    void main (void) {
        vec4 graphSample = texture2D(graphTex, uv0.xy);

        vec4 graph;
        if (uv0.w < graphSample.r)
            graph = vec4(${graphColorRed}, 1.0);
        else if (uv0.w < graphSample.g)
            graph = vec4(${graphColorGreen}, 1.0);
        else if (uv0.w < graphSample.b)
            graph = vec4(${graphColorBlue}, 1.0);
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
        var graphSample: vec4f = textureSample(graphTex, graphTex_sampler, uv0.xy);

        var graph: vec4f;
        if (uv0.w < graphSample.r) {
            graph = vec4f(${graphColorRed}, 1.0);
        } else if (uv0.w < graphSample.g) {
            graph = vec4f(${graphColorGreen}, 1.0);
        } else if (uv0.w < graphSample.b) {
            graph = vec4f(${graphColorBlue}, 1.0);
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

        this.mesh = new Mesh(device);
        this.mesh.vertexBuffer = this.buffer;
        this.mesh.indexBuffer[0] = this.indexBuffer;
        this.mesh.primitive = [this.prim];

        const material = new ShaderMaterial({
            uniqueName: 'MiniStats',
            vertexGLSL: vertexShaderGLSL,
            fragmentGLSL: fragmentShaderGLSL,
            vertexWGSL: vertexShaderWGSL,
            fragmentWGSL: fragmentShaderWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_texCoord0: SEMANTIC_TEXCOORD0
            }
        });
        this.material = material;
        material.cull = CULLFACE_NONE;
        material.depthState = DepthState.NODEPTH;
        material.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
        material.update();

        this.meshInstance = new MeshInstance(this.mesh, material, new GraphNode('MiniStatsMesh'));

        this.uniforms = {
            clr: new Float32Array(4)
        };

        this.targetSize = {
            width: device.width,
            height: device.height
        };
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

    render(app, layer, graphTexture, wordsTexture, clr, height) {

        // set vertex data (swap storage)
        this.buffer.setData(this.data.buffer);

        this.uniforms.clr.set(clr, 0);

        // material params
        this.material.setParameter('clr', this.uniforms.clr);
        this.material.setParameter('graphTex', graphTexture);
        this.material.setParameter('wordsTex', wordsTexture);

        app.drawMeshInstance(this.meshInstance, layer);
    }
}

export { Render2d };
