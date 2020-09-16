// render 2d textured quads
function Render2d(device, colors, maxQuads) {
    maxQuads = maxQuads || 512;

    var vertexShader =
        'attribute vec2 vertex_position;\n' +       // unnormalized
        'attribute vec4 vertex_texCoord0;\n' +      // unnormalized texture space uv, normalized uv
        'uniform vec4 screenAndTextureSize;\n' +    // xy: screen size, zw: texture size
        'varying vec4 uv0;\n' +
        'void main(void) {\n' +
        '    vec2 pos = vertex_position.xy / screenAndTextureSize.xy;\n' +
        '    gl_Position = vec4(pos * 2.0 - 1.0, 0.5, 1.0);\n' +
        '    uv0 = vec4(vertex_texCoord0.xy / screenAndTextureSize.zw, vertex_texCoord0.zw);\n' +
        '}\n';

    // this fragment shader renders the bits required for text and graphs. The text is identified
    // in the texture by white color. The graph data is specified as a single row of pixels
    // where the R channel denotes the height of the 1st graph and the G channel the height
    // of the second graph and B channel the height of the last graph
    var fragmentShader =
        'varying vec4 uv0;\n' +
        'uniform vec4 clr;\n' +
        'uniform vec4 col0;\n' +
        'uniform vec4 col1;\n' +
        'uniform vec4 col2;\n' +
        'uniform vec4 watermark;\n' +
        'uniform float watermarkSize;\n' +
        'uniform vec4 background;\n' +
        'uniform sampler2D source;\n' +
        'void main (void) {\n' +
        '    vec4 tex = texture2D(source, uv0.xy);\n' +
        '    if (!(tex.rgb == vec3(1.0, 1.0, 1.0))) {\n' +  // pure white is text
        '       if (abs(uv0.w - tex.a) < watermarkSize)\n' +
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

    var format = new pc.VertexFormat(device, [{
        semantic: pc.SEMANTIC_POSITION,
        components: 2,
        type: pc.TYPE_FLOAT32
    }, {
        semantic: pc.SEMANTIC_TEXCOORD0,
        components: 4,
        type: pc.TYPE_FLOAT32
    }]);

    // generate quad indices
    var indices = new Uint16Array(maxQuads * 6);
    for (var i = 0; i < maxQuads; ++i) {
        indices[i * 6 + 0] = i * 4;
        indices[i * 6 + 1] = i * 4 + 1;
        indices[i * 6 + 2] = i * 4 + 2;
        indices[i * 6 + 3] = i * 4;
        indices[i * 6 + 4] = i * 4 + 2;
        indices[i * 6 + 5] = i * 4 + 3;
    }

    this.device = device;
    this.shader = pc.shaderChunks.createShaderFromCode(device,
                                                       vertexShader,
                                                       fragmentShader,
                                                       "mini-stats");
    this.buffer = new pc.VertexBuffer(device, format, maxQuads * 4, pc.BUFFER_STREAM);
    this.data = new Float32Array(this.buffer.numBytes / 4);

    this.indexBuffer = new pc.IndexBuffer(device, pc.INDEXFORMAT_UINT16, maxQuads * 6, pc.BUFFER_STATIC, indices);

    this.prims = [];
    this.prim = null;
    this.primIndex = -1;
    this.quads = 0;

    // colors
    var setupColor = function (name, value) {
        this[name] = new Float32Array([value.r, value.g, value.b, value.a]);
        this[name + "Id"] = device.scope.resolve(name);
    }.bind(this);
    setupColor("col0", colors.graph0);
    setupColor("col1", colors.graph1);
    setupColor("col2", colors.graph2);
    setupColor("watermark", colors.watermark);
    setupColor("background", colors.background);

    this.watermarkSizeId = device.scope.resolve('watermarkSize');
    this.clrId = device.scope.resolve('clr');
    this.clr = new Float32Array(4);

    this.screenTextureSizeId = device.scope.resolve('screenAndTextureSize');
    this.screenTextureSize = new Float32Array(4);
}

Object.assign(Render2d.prototype, {
    quad: function (texture, x, y, w, h, u, v, uw, uh) {
        var quad = this.quads++;

        // update primitive
        var prim = this.prim;
        if (prim && prim.texture === texture) {
            prim.count += 6;
        } else {
            this.primIndex++;
            if (this.primIndex === this.prims.length) {
                prim = {
                    type: pc.PRIMITIVE_TRIANGLES,
                    indexed: true,
                    base: quad * 6,
                    count: 6,
                    texture: texture
                };
                this.prims.push(prim);
            } else {
                prim = this.prims[this.primIndex];
                prim.base = quad * 6;
                prim.count = 6;
                prim.texture = texture;
            }
            this.prim = prim;
        }

        var x1 = x + w;
        var y1 = y + h;
        var u1 = u + (uw === undefined ? w : uw);
        var v1 = v + (uh === undefined ? h : uh);

        this.data.set([
            x,  y,  u,  v,  0, 0,
            x1, y,  u1, v,  1, 0,
            x1, y1, u1, v1, 1, 1,
            x,  y1, u,  v1, 0, 1
        ], 4 * 6 * quad);
    },

    render: function (clr, height) {
        var device = this.device;
        var buffer = this.buffer;

        // set vertex data (swap storage)
        buffer.setData(this.data.buffer);

        device.updateBegin();
        device.setDepthTest(false);
        device.setDepthWrite(false);
        device.setCullMode(pc.CULLFACE_NONE);
        device.setBlending(true);
        device.setBlendFunctionSeparate(pc.BLENDMODE_SRC_ALPHA,
                                        pc.BLENDMODE_ONE_MINUS_SRC_ALPHA,
                                        pc.BLENDMODE_ONE,
                                        pc.BLENDMODE_ONE);
        device.setBlendEquationSeparate(pc.BLENDEQUATION_ADD, pc.BLENDEQUATION_ADD);
        device.setVertexBuffer(buffer, 0);
        device.setIndexBuffer(this.indexBuffer);
        device.setShader(this.shader);

        var pr = Math.min(device.maxPixelRatio, window.devicePixelRatio);

        // set shader uniforms
        this.clr.set(clr, 0);
        this.clrId.setValue(this.clr);
        this.screenTextureSize[0] = device.width / pr;
        this.screenTextureSize[1] = device.height / pr;

        // colors
        this.col0Id.setValue(this.col0);
        this.col1Id.setValue(this.col1);
        this.col2Id.setValue(this.col2);
        this.watermarkId.setValue(this.watermark);
        this.backgroundId.setValue(this.background);

        for (var i = 0; i <= this.primIndex; ++i) {
            var prim = this.prims[i];
            this.screenTextureSize[2] = prim.texture.width;
            this.screenTextureSize[3] = prim.texture.height;
            this.screenTextureSizeId.setValue(this.screenTextureSize);
            device.constantTexSource.setValue(prim.texture);
            this.watermarkSizeId.setValue(0.5 / height);
            device.draw(prim);
        }

        device.updateEnd();

        // reset
        this.prim = null;
        this.primIndex = -1;
        this.quads = 0;
    }
});

export { Render2d };
