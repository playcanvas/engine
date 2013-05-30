pc.extend(pc.posteffect, function () {

    function Luminosity(graphicsDevice) {
        this.device = graphicsDevice;

        // Shaders
        var attributes = {
            aPosition: pc.gfx.SEMANTIC_POSITION
        };

        var passThroughVert = [
            "attribute vec2 aPosition;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main(void)",
            "{",
            "    gl_Position = vec4(aPosition, 0.0, 1.0);",
            "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
            "}"
        ].join("\n");

        var luminosityFrag = [
            "precision mediump float;",
            "",
            "uniform sampler2D tDiffuse;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main() {",
                "vec4 texel = texture2D( tDiffuse, vUv0);",
                "vec3 luma = vec3(0.299, 0.587, 0.114);",
                "float v = dot(texel.xyz, luma);",
                "gl_FragColor = vec4(v, v, v, texel.w);",
            "}"
        ].join("\n");

        this.luminosityShader = new pc.gfx.Shader(graphicsDevice, {
            attributes: attributes,
            vshader: passThroughVert,
            fshader: luminosityFrag
        });

        // Create the vertex format
        var vertexFormat = new pc.gfx.VertexFormat();
        vertexFormat.begin();
        vertexFormat.addElement(new pc.gfx.VertexElement(pc.gfx.SEMANTIC_POSITION, 2, pc.gfx.ELEMENTTYPE_FLOAT32));
        vertexFormat.end();

        // Create a vertex buffer
        this.vertexBuffer = new pc.gfx.VertexBuffer(graphicsDevice, vertexFormat, 4);

        // Fill the vertex buffer
        var iterator = new pc.gfx.VertexIterator(this.vertexBuffer);
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(-1.0, -1.0);
        iterator.next();
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(1.0, -1.0);
        iterator.next();
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(-1.0, 1.0);
        iterator.next();
        iterator.element[pc.gfx.SEMANTIC_POSITION].set(1.0, 1.0);
        iterator.end();
    }

    Luminosity.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("tDiffuse").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.luminosityShader);
        }
    };

    return {
        Luminosity: Luminosity
    };
}());