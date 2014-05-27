/**
 * Shader author: tapio / http://tapio.github.com/
 *
 * Hue and saturation adjustment
 * https://github.com/evanw/glfx.js
 * hue: -1 to 1 (-1 is 180 degrees in the negative direction, 0 is no change, etc.
 * saturation: -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */

pc.extend(pc.posteffect, function () {

    function HueSaturation(graphicsDevice) {
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
                "uniform float uHue;",
                "uniform float uSaturation;",

                "varying vec2 vUv0;",

                "void main() {",

                    "gl_FragColor = texture2D( uColorBuffer, vUv0 );",

                    // uHue
                    "float angle = uHue * 3.14159265;",
                    "float s = sin(angle), c = cos(angle);",
                    "vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;",
                    "float len = length(gl_FragColor.rgb);",
                    "gl_FragColor.rgb = vec3(",
                        "dot(gl_FragColor.rgb, weights.xyz),",
                        "dot(gl_FragColor.rgb, weights.zxy),",
                        "dot(gl_FragColor.rgb, weights.yzx)",
                    ");",

                    // uSaturation
                    "float average = (gl_FragColor.r + gl_FragColor.g + gl_FragColor.b) / 3.0;",
                    "if (uSaturation > 0.0) {",
                        "gl_FragColor.rgb += (average - gl_FragColor.rgb) * (1.0 - 1.0 / (1.001 - uSaturation));",
                    "} else {",
                        "gl_FragColor.rgb += (average - gl_FragColor.rgb) * (-uSaturation);",
                    "}",

                "}"
            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // uniforms
        this.hue = 0;
        this.saturation = 0;
    }

    HueSaturation.prototype = {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uHue").setValue(this.hue);
            scope.resolve("uSaturation").setValue(this.saturation);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    };

    return {
        HueSaturation: HueSaturation
    };
}());