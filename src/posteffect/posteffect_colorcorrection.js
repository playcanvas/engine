pc.extend(pc.posteffect, function () {

    function ColorCorrection(graphicsDevice) {
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
                "uniform vec3 uPowRGB;",
                "uniform vec3 uMulRGB;",

                "varying vec2 vUv0;",

                "void main() {",

                    "gl_FragColor = texture2D( uColorBuffer, vUv0 );",
                    "gl_FragColor.rgb = uMulRGB * pow( gl_FragColor.rgb, uPowRGB );",

                "}"
            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // Uniforms
        this.powerRgb = [1,1,1];
        this.mulRgb = [1,1,1];
    }

    ColorCorrection.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uPowRGB").setValue(this.powerRgb);
            scope.resolve("uMulRGB").setValue(this.mulRgb);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader);
        }
    };

    return {
        ColorCorrection: ColorCorrection
    };
}());