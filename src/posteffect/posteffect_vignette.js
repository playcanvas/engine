pc.extend(pc.posteffect, function () {

    /**
     * @name pc.posteffect.Vignette
     * @class Implements the Vignette post processing effect.
     * @extends pc.posteffect.PostEffect
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     * @property {Number} offset Controls the offset of the effect.
     * @property {Number} darkness Controls the darkness of the effect.
     */
    function Vignette(graphicsDevice) {
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
            "precision " + graphicsDevice.precision + " float;",
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

        this.offset = 1;
        this.darkness = 1;
    }

    Vignette = pc.inherits(Vignette, pc.posteffect.PostEffect);

    Vignette.prototype = pc.extend(Vignette, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            scope.resolve("uOffset").setValue(this.offset);
            scope.resolve("uDarkness").setValue(this.darkness);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.vignetteShader, rect);
        }
    });

    return {
        Vignette: Vignette
    };
}());