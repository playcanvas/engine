/**
 * Shader author: tapio / http://tapio.github.com/
 *
 * Brightness and contrast adjustment
 * https://github.com/evanw/glfx.js
 * brightness: -1 to 1 (-1 is solid black, 0 is no change, and 1 is solid white)
 * contrast: -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */

pc.extend(pc.posteffect, function () {

    /**
     * @name pc.posteffect.BrightnessContrast
     * @class Changes the brightness and contrast of the input render target
     * @extends {pc.posteffect.PostEffect}
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     * @property {Number} brightness Controls the brightness of the render target. Ranges from -1 to 1 (-1 is solid black, 0 no change, 1 solid white)
     * @property {Number} contrast Controls the contrast of the render target. Ranges from -1 to 1 (-1 is solid gray, 0 no change, 1 maximum contrast)
     */
    function BrightnessContrast(graphicsDevice) {
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

        // Uniforms
        this.brightness = 0;
        this.contrast = 0;
    }

    BrightnessContrast = pc.inherits(BrightnessContrast, pc.posteffect.PostEffect);

    BrightnessContrast.prototype = pc.extend(BrightnessContrast.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uBrightness").setValue(this.brightness);
            scope.resolve("uContrast").setValue(this.contrast);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        BrightnessContrast: BrightnessContrast
    };
}());