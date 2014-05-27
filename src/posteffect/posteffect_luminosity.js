pc.extend(pc.posteffect, function () {

    function Luminosity(graphicsDevice) {
        this.shader = new pc.gfx.Shader(graphicsDevice, {
            attributes: {
                aPosition: pc.gfx.SEMANTIC_POSITION
            },
            vshader: [
                "attribute vec2 aPosition;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main(void)",
                "{",
                "    gl_Position = vec4(aPosition, 0.0, 1.0);",
                "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
                "}"
            ].join("\n"),
            fshader: [
                "precision " + graphicsDevice.precision + " float;",
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
            ].join("\n")
        });
    }

    Luminosity = pc.inherits(Luminosity, pc.posteffect.PostEffect);

    Luminosity.prototype = pc.extend(Luminosity.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        Luminosity: Luminosity
    };
}());