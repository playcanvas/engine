import {
    BLENDEQUATION_ADD,
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA,
    BUFFER_STATIC,
    BUFFER_STREAM,
    CULLFACE_NONE,
    INDEXFORMAT_UINT16,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    SEMANTIC_TEXCOORD1,
    SEMANTIC_TEXCOORD2,
    TYPE_FLOAT32,
    TYPE_UINT8,
    shaderChunks,
    IndexBuffer,
    VertexBuffer,
    VertexFormat,
    BlendState,
    DepthState,
    Mesh,
    MeshInstance,
    Material,
    GraphNode
} from 'playcanvas';

const vertexShader = /*glsl*/ `
attribute vec4 vertex_position;         // unnormalized
attribute vec4 vertex_texCoord0;        // unnormalized texture space uv, normalized uv
attribute vec4 vertex_texCoord1;        // graph color
attribute vec4 vertex_texCoord2;        // word color

varying vec4 uv0;
varying vec4 graphClr;
varying vec4 wordsClr;

void main(void) {
    gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);
    uv0 = vertex_texCoord0;
    graphClr = vertex_texCoord1;
    wordsClr = vertex_texCoord2;
}`;

// this fragment shader renders the bits required for text and graphs. The text is identified
// in the texture by white color. The graph data is specified as a single row of pixels
// where the R channel denotes the height of the 1st graph and the G channel the height
// of the second graph and B channel the height of the last graph
const fragmentShader = /*glsl*/ `
varying vec4 uv0;
varying vec4 graphClr;
varying vec4 wordsClr;

uniform vec4 clr;
uniform sampler2D graphTex;
uniform sampler2D wordsTex;

void main (void) {
    vec4 graphSample = texture2D(graphTex, uv0.xy);

    vec4 graph;
    if (uv0.w < graphSample.r)
        graph = vec4(0.7, 0.2, 0.2, 1.0);
    else if (uv0.w < graphSample.g)
        graph = vec4(0.2, 0.7, 0.2, 1.0);
    else if (uv0.w < graphSample.b)
        graph = vec4(0.2, 0.2, 0.7, 1.0);
    else
        graph = vec4(0.0, 0.0, 0.0, 1.0 - 0.25 * sin(uv0.w * 3.14159));

    vec4 words = texture2D(wordsTex, vec2(uv0.x, 1.0 - uv0.y));

    gl_FragColor = (graph * graphClr + words * wordsClr) * clr;
}`;

// render 2d textured quads
class Render2d {
    constructor(device, colors, maxQuads = 512) {
        const format = new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 2, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_TEXCOORD0, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_TEXCOORD1, components: 4, type: TYPE_UINT8, normalize: true },
            { semantic: SEMANTIC_TEXCOORD2, components: 4, type: TYPE_UINT8, normalize: true }
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

        const shader = shaderChunks.createShaderFromCode(device, vertexShader, fragmentShader, 'mini-stats');

        this.device = device;
        this.buffer = new VertexBuffer(device, format, maxQuads * 4, BUFFER_STREAM);
        this.data = new Float32Array(this.buffer.numBytes / 4);
        this.intVal = new Uint32Array(1);
        this.floatVal = new Float32Array(this.intVal.buffer);
        this.indexBuffer = new IndexBuffer(device, INDEXFORMAT_UINT16, maxQuads * 6, BUFFER_STATIC, indices);
        this.prim = {
            type: PRIMITIVE_TRIANGLES,
            indexed: true,
            base: 0,
            count: 0
        };
        this.quads = 0;

        this.mesh = new Mesh(device);
        this.mesh.vertexBuffer = this.buffer;
        this.mesh.indexBuffer[0] = this.indexBuffer;
        this.mesh.primitive = [this.prim];

        const material = new Material();
        this.material = material;
        material.cull = CULLFACE_NONE;
        material.shader = shader;
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

    quad(x, y, w, h, u, v, uw, uh, texture, graphClr, wordsClr) {
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

        this.intVal[0] = graphClr;
        const gc = this.floatVal[0];

        this.intVal[0] = wordsClr;
        const wc = this.floatVal[0];

        this.data.set([
            x0, y0, u0, v0, 0, 0, gc, wc,
            x1, y0, u1, v0, 1, 0, gc, wc,
            x1, y1, u1, v1, 1, 1, gc, wc,
            x0, y1, u0, v1, 0, 1, gc, wc
        ], 4 * 8 * this.quads);

        this.quads++;
        this.prim.count += 6;
    }

    startFrame() {
        this.quads = 0;
        this.prim.count = 0;

        this.targetSize.width = this.device.width;
        this.targetSize.height = this.device.height;
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
