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
            "uniform sampler2D uColorBuffer;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main() {",
                "vec4 texel = texture2D(uColorBuffer, vUv0);",
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

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);
    }

    Luminosity.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.luminosityShader);
        }
    };

    return {
        Luminosity: Luminosity
    };
}());