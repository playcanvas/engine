pc.extend(pc.posteffect, function () {

    function BrightnessContrast(graphicsDevice) {
        this.device = graphicsDevice;

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
                "uniform sampler2D uColorBuffer;",
                "uniform float uBrightness;",
                "uniform float uContrast;",

                "varying vec2 vUv0;",

                "void main() {",

                    "gl_FragColor = texture2D( uColorBuffer, vUv0 );",

                    "gl_FragColor.rgb += uBrightness;",

                    "if (uContrast > 0.0) {",
                        "gl_FragColor.rgb = (gl_FragColor.rgb - 0.5) / (1.0 - uContrast) + 0.5;",
                    "} else {",
                        "gl_FragColor.rgb = (gl_FragColor.rgb - 0.5) * (1.0 + uContrast) + 0.5;",
                    "}",

                "}"
            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // Uniforms
        this.brightness = 0;
        this.contrast = 0;
    }

    BrightnessContrast.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uBrightness").setValue(this.brightness);
            scope.resolve("uContrast").setValue(this.contrast);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader);
        }
    };

    return {
        BrightnessContrast: BrightnessContrast
    };
}());