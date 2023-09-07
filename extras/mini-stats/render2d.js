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
    TYPE_FLOAT32,
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

// render 2d textured quads
class Render2d {
    constructor(device, colors, maxQuads = 512) {
        const vertexShader =
            'attribute vec3 vertex_position;\n' +       // unnormalized
            'attribute vec4 vertex_texCoord0;\n' +      // unnormalized texture space uv, normalized uv
            'uniform vec4 screenAndTextureSize;\n' +    // xy: screen size, zw: texture size
            'varying vec4 uv0;\n' +
            'varying float enabled;\n' +
            'void main(void) {\n' +
            '    vec2 pos = vertex_position.xy / screenAndTextureSize.xy;\n' +
            '    gl_Position = vec4(pos * 2.0 - 1.0, 0.5, 1.0);\n' +
            '    uv0 = vec4(vertex_texCoord0.xy / screenAndTextureSize.zw, vertex_texCoord0.zw);\n' +
            '    enabled = vertex_position.z;\n' +
            '}\n';

        // this fragment shader renders the bits required for text and graphs. The text is identified
        // in the texture by white color. The graph data is specified as a single row of pixels
        // where the R channel denotes the height of the 1st graph and the G channel the height
        // of the second graph and B channel the height of the last graph
        const fragmentShader =
            'varying vec4 uv0;\n' +
            'varying float enabled;\n' +
            'uniform vec4 clr;\n' +
            'uniform vec4 col0;\n' +
            'uniform vec4 col1;\n' +
            'uniform vec4 col2;\n' +
            'uniform vec4 watermark;\n' +
            'uniform float watermarkSize;\n' +
            'uniform vec4 background;\n' +
            'uniform sampler2D data;\n' +
            'void main (void) {\n' +
            '    vec4 tex = texture2D(data, uv0.xy);\n' +
            '    if (!(tex.rgb == vec3(1.0, 1.0, 1.0))) {\n' +  // pure white is text
            '       if (enabled < 0.5)\n' +
            '           tex = background;\n' +
            '       else if (abs(uv0.w - tex.a) < watermarkSize)\n' +
            '           tex = watermark;\n' +
            '       else if (uv0.w < tex.r)\n' +
            '           tex = col0;\n' +
            '       else if (uv0.w < tex.g)\n' +
            '           tex = col1;\n' +
            '       else if (uv0.w < tex.b)\n' +
            '           tex = col2;\n' +
            '       else\n' +
            '           tex = background;\n' +
            '    }\n' +
            '    gl_FragColor = tex * clr;\n' +
            '}\n';

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
        const shader = shaderChunks.createShaderFromCode(device, vertexShader, fragmentShader, 'mini-stats');
        this.buffer = new VertexBuffer(device, format, maxQuads * 4, BUFFER_STREAM);
        this.data = new Float32Array(this.buffer.numBytes / 4);

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

        // colors
        const setupColor = (name, value) => {
            this[name] = new Float32Array([value.r, value.g, value.b, value.a]);
        };
        setupColor('col0', colors.graph0);
        setupColor('col1', colors.graph1);
        setupColor('col2', colors.graph2);
        setupColor('watermark', colors.watermark);
        setupColor('background', colors.background);

        this.clr = new Float32Array(4);
        this.screenTextureSize = new Float32Array(4);
    }

    quad(x, y, w, h, u, v, uw, uh, enabled) {
        const quad = this.quads++;

        // update primitive
        this.prim.count += 6;

        const x1 = x + w;
        const y1 = y + h;
        const u1 = u + (uw === undefined ? w : uw);
        const v1 = v + (uh === undefined ? h : uh);

        const colorize = enabled ? 1 : 0;
        this.data.set([
            x,  y,  colorize, u,  v,  0, 0,
            x1, y,  colorize, u1, v,  1, 0,
            x1, y1, colorize, u1, v1, 1, 1,
            x,  y1, colorize, u,  v1, 0, 1
        ], 4 * 7 * quad);
    }

    startFrame() {
        this.prim.count = 0;
        this.quads = 0;
    }

    render(app, texture, clr, height) {

        // set vertex data (swap storage)
        this.buffer.setData(this.data.buffer);

        // material params
        this.clr.set(clr, 0);
        this.material.setParameter('clr', this.clr);

        this.material.setParameter('col0', this.col0);
        this.material.setParameter('col1', this.col1);
        this.material.setParameter('col2', this.col2);
        this.material.setParameter('watermark', this.watermark);
        this.material.setParameter('background', this.background);
        this.material.setParameter('watermarkSize', 0.5 / height);

        const canvas = this.device.canvas;
        this.screenTextureSize[0] = canvas.scrollWidth;
        this.screenTextureSize[1] = canvas.scrollHeight;
        this.screenTextureSize[2] = texture.width;
        this.screenTextureSize[3] = texture.height;
        this.material.setParameter('screenAndTextureSize', this.screenTextureSize);

        this.material.setParameter('data', texture);

        app.drawMeshInstance(this.meshInstance);
    }
}

export { Render2d };
