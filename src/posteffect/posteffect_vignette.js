pc.extend(pc.posteffect, function () {

    function Vignette(graphicsDevice) {
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
            "uniform float uDarkness;",
            "uniform float uOffset;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main() {",
            "    vec4 texel = texture2D(uColorBuffer, vUv0);",
            "    vec2 uv = (vUv0 - vec2(0.5)) * vec2(uOffset);",
            "    gl_FragColor = vec4(mix(texel.rgb, vec3(1.0 - uDarkness), dot(uv, uv)), texel.a);",
            "}"
        ].join("\n");

        this.vignetteShader = new pc.gfx.Shader(graphicsDevice, {
            attributes: attributes,
            vshader: passThroughVert,
            fshader: luminosityFrag
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);
    }

    Vignette.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            scope.resolve("uOffset").setValue(1);
            scope.resolve("uDarkness").setValue(1);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.vignetteShader);
        }
    };

    return {
        Vignette: Vignette
    };
}());