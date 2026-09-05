import {
    BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE,
    BUFFER_STATIC, BUFFER_STREAM, CULLFACE_NONE, INDEXFORMAT_UINT16, PRIMITIVE_TRIANGLES,
    SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SEMANTIC_COLOR, TYPE_FLOAT32, TYPE_UINT8
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

const vertexShaderGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec4 vertex_texCoord0;
    attribute vec4 vertex_color;
    varying vec4 uv0;
    varying vec4 color;
    varying float mode;
    void main(void) {
        gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);
        uv0 = vertex_texCoord0;
        color = vertex_color;
        mode = vertex_position.z;
    }
`;

const vertexShaderWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute vertex_texCoord0: vec4f;
    attribute vertex_color: vec4f;
    varying uv0: vec4f;
    varying color: vec4f;
    varying mode: f32;
    @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(input.vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);
        output.uv0 = input.vertex_texCoord0;
        output.color = input.vertex_color;
        output.mode = input.vertex_position.z;
        return output;
    }
`;

// Each branch is uniform within a quad: solid rectangles need no texture fetch, text and
// graphs need one each. The graph outline and budget line use CSS-pixel heights, not derivatives.
const fragmentShaderGLSL = /* glsl */ `
    varying vec4 uv0;
    varying vec4 color;
    varying float mode;
    uniform vec4 clr;
    uniform sampler2D graphTex;
    uniform sampler2D wordsTex;
    void main(void) {
        float alpha = 1.0;
        if (mode > 1.5) {
            vec4 sampleValue = texture2D(graphTex, uv0.xy);
            float fill = step(uv0.w, sampleValue.r) * 0.18;
            float edge = (1.0 - step(uv0.z, abs(uv0.w - sampleValue.r))) * 0.60;
            float budget = (1.0 - step(uv0.z * 0.5, abs(uv0.w - sampleValue.a))) * 0.16;
            alpha = max(fill, max(edge, budget)) * step(0.001, sampleValue.a);
        } else if (mode > 0.5) {
            alpha = texture2D(wordsTex, vec2(uv0.x, 1.0 - uv0.y)).a;
        }
        gl_FragColor = vec4(color.rgb, color.a * alpha) * clr;
    }
`;

const fragmentShaderWGSL = /* wgsl */ `
    varying uv0: vec4f;
    varying color: vec4f;
    varying mode: f32;
    uniform clr: vec4f;
    var graphTex: texture_2d<f32>;
    var graphTex_sampler: sampler;
    var wordsTex: texture_2d<f32>;
    var wordsTex_sampler: sampler;
    @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var alpha = 1.0;
        if (input.mode > 1.5) {
            let sampleValue = textureSampleLevel(graphTex, graphTex_sampler, input.uv0.xy, 0.0);
            let fill = step(input.uv0.w, sampleValue.r) * 0.18;
            let edge = (1.0 - step(input.uv0.z, abs(input.uv0.w - sampleValue.r))) * 0.60;
            let budget = (1.0 - step(input.uv0.z * 0.5, abs(input.uv0.w - sampleValue.a))) * 0.16;
            alpha = max(fill, max(edge, budget)) * step(0.001, sampleValue.a);
        } else if (input.mode > 0.5) {
            alpha = textureSampleLevel(wordsTex, wordsTex_sampler, vec2f(input.uv0.x, 1.0 - input.uv0.y), 0.0).a;
        }
        var output: FragmentOutput;
        output.color = vec4f(input.color.rgb, input.color.a * alpha) * uniform.clr;
        return output;
    }
`;

class Render2d {
    constructor(device, maxQuads = 128) {
        this.device = device;
        this.format = new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_TEXCOORD0, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_COLOR, components: 4, type: TYPE_UINT8, normalize: true }
        ]);
        this.mesh = new Mesh(device);
        this.prim = { type: PRIMITIVE_TRIANGLES, indexed: true, base: 0, baseVertex: 0, count: 0 };
        this.mesh.primitive = [this.prim];
        this.quads = 0;
        this.dirty = true;
        this.resize(maxQuads);
        this.material = new ShaderMaterial({
            uniqueName: 'MiniStats',
            vertexGLSL: vertexShaderGLSL,
            fragmentGLSL: fragmentShaderGLSL,
            vertexWGSL: vertexShaderWGSL,
            fragmentWGSL: fragmentShaderWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_texCoord0: SEMANTIC_TEXCOORD0,
                vertex_color: SEMANTIC_COLOR
            }
        });
        this.material.cull = CULLFACE_NONE;
        this.material.depthState = DepthState.NODEPTH;
        this.material.blendState = new BlendState(true,
            BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA);
        this.material.update();
        this.meshInstance = new MeshInstance(this.mesh, this.material, new GraphNode('MiniStatsMesh'));
        this.meshInstance.cull = false;
        this.clr = new Float32Array(4);
        this.material.setParameter('clr', this.clr);
        this.targetWidth = 1;
        this.targetHeight = 1;
        this.setClip(0, 0, Infinity, Infinity);
    }

    resize(capacity) {
        const data = new Float32Array(capacity * 32);
        if (this.data) {
            data.set(this.data);
            this.buffer.destroy();
            this.indexBuffer.destroy();
        }
        const indices = new Uint16Array(capacity * 6);
        for (let i = 0; i < capacity; i++) {
            const offset = i * 6;
            const vertex = i * 4;
            indices[offset] = vertex;
            indices[offset + 1] = vertex + 1;
            indices[offset + 2] = vertex + 2;
            indices[offset + 3] = vertex;
            indices[offset + 4] = vertex + 2;
            indices[offset + 5] = vertex + 3;
        }
        this.maxQuads = capacity;
        this.data = data;
        this.colors = new Uint32Array(data.buffer);
        this.buffer = new VertexBuffer(this.device, this.format, capacity * 4, { usage: BUFFER_STREAM });
        this.indexBuffer = new IndexBuffer(this.device, INDEXFORMAT_UINT16, capacity * 6, BUFFER_STATIC, indices);
        this.mesh.vertexBuffer = this.buffer;
        this.mesh.indexBuffer[0] = this.indexBuffer;
        this.dirty = true;
    }

    destroy() {
        this.meshInstance.destroy();
        this.material.destroy();
    }

    setClip(x, y, w, h) {
        this.clipLeft = x;
        this.clipBottom = y;
        this.clipRight = x + w;
        this.clipTop = y + h;
    }

    // Positions and UVs are supplied in bottom-left coordinates. Packed colors use RGBA bytes.
    quad(x, y, w, h, u, v, uw, uh, texture, mode = 0, color = 0xffffffff) {
        const x0 = Math.max(x, this.clipLeft);
        const y0 = Math.max(y, this.clipBottom);
        const x1 = Math.min(x + w, this.clipRight);
        const y1 = Math.min(y + h, this.clipTop);
        if (x1 <= x0 || y1 <= y0) return -1;
        if (this.quads === this.maxQuads) {
            if (this.maxQuads >= 8192) {
                Debug.warnOnce('MiniStats: maximum number of quads exceeded.');
                return -1;
            }
            this.resize(this.maxQuads * 2);
        }
        const tw = texture?.width ?? 1;
        const th = texture?.height ?? 1;
        const u0 = (u + (x0 - x) / w * uw) / tw;
        const u1 = (u + (x1 - x) / w * uw) / tw;
        const v0 = (v + (y0 - y) / h * uh) / th;
        const v1 = (v + (y1 - y) / h * uh) / th;
        const bottom = (y0 - y) / h;
        const top = (y1 - y) / h;
        const data = this.data;
        const colors = this.colors;
        let offset = this.quads * 32;
        for (let i = 0; i < 4; i++) {
            const right = i === 1 || i === 2;
            const upper = i >= 2;
            data[offset] = (right ? x1 : x0) / this.targetWidth;
            data[offset + 1] = (upper ? y1 : y0) / this.targetHeight;
            data[offset + 2] = mode;
            data[offset + 3] = right ? u1 : u0;
            data[offset + 4] = upper ? v1 : v0;
            data[offset + 5] = 1 / h;
            data[offset + 6] = upper ? top : bottom;
            colors[offset + 7] = color;
            offset += 8;
        }
        this.prim.count += 6;
        this.dirty = true;
        return this.quads++;
    }

    rect(x, y, w, h, color) {
        this.quad(x, y, w, h, 0, 0, 0, 0, null, 0, color);
    }

    graph(graph, x, y, w, h, color) {
        graph.quad = this.quad(x, y, w, h, graph.cursor - w, graph.yOffset + 0.5, w, 0, graph.texture, 2, color);
        graph.renderWidth = w;
    }

    graphCursor(graph) {
        if (graph.quad < 0) return;
        const offset = graph.quad * 32 + 3;
        const u0 = (graph.cursor - graph.renderWidth) / graph.texture.width;
        const u1 = graph.cursor / graph.texture.width;
        this.data[offset] = u0;
        this.data[offset + 8] = u1;
        this.data[offset + 16] = u1;
        this.data[offset + 24] = u0;
        this.dirty = true;
    }

    startFrame() {
        this.quads = 0;
        this.prim.count = 0;
    }

    render(app, layer, graphTexture, wordsTexture, clr) {
        if (this.dirty) {
            this.buffer.setData(this.data.buffer);
            this.dirty = false;
        }
        this.clr.set(clr);
        this.material.setParameter('graphTex', graphTexture);
        this.material.setParameter('wordsTex', wordsTexture);
        app.drawMeshInstance(this.meshInstance, layer);
    }
}

export { Render2d };
