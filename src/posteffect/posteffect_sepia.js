pc.extend(pc.posteffect, function () {

    function Sepia(graphicsDevice) {
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
                "precision mediump float;",
                "",
                "uniform float uAmount;",
                "uniform sampler2D uColorBuffer;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main() {",
                "    vec4 color = texture2D(uColorBuffer, vUv0);",
                "    vec3 c = color.rgb;",
                "",
                "    color.r = dot(c, vec3(1.0 - 0.607 * uAmount, 0.769 * uAmount, 0.189 * uAmount));",
                "    color.g = dot(c, vec3(0.349 * uAmount, 1.0 - 0.314 * uAmount, 0.168 * uAmount));",
                "    color.b = dot(c, vec3(0.272 * uAmount, 0.534 * uAmount, 1.0 - 0.869 * uAmount));",
                "",
                "    gl_FragColor = vec4(min(vec3(1.0), color.rgb), color.a);",
                "}"
            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // Uniforms
        this.amount = 1;
    }

    Sepia.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uAmount").setValue(this.amount);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader);
        }
    };

    return {
        Sepia: Sepia
    };
}());