/**
 * Shader author: alteredq / http://alteredqualia.com/
 *
 * Simple fake tilt-shift effect, modulating two pass Gaussian blur (see above) by vertical position
 */

pc.extend(pc.posteffect, function () {

    function HorizontalTiltShift(graphicsDevice) {
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
                "uniform float uH;",
                "uniform float uR;",

                "varying vec2 vUv0;",

                "void main() {",

                    "vec4 sum = vec4( 0.0 );",

                    "float hh = uH * abs( uR - vUv0.x );",

                    "sum += texture2D( uColorBuffer, vec2( vUv0.x - 4.0 * hh, vUv0.y ) ) * 0.051;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x - 3.0 * hh, vUv0.y ) ) * 0.0918;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x - 2.0 * hh, vUv0.y ) ) * 0.12245;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x - 1.0 * hh, vUv0.y ) ) * 0.1531;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y ) ) * 0.1633;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x + 1.0 * hh, vUv0.y ) ) * 0.1531;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x + 2.0 * hh, vUv0.y ) ) * 0.12245;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x + 3.0 * hh, vUv0.y ) ) * 0.0918;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x + 4.0 * hh, vUv0.y ) ) * 0.051;",

                    "gl_FragColor = sum;",

                "}"

            ].join("\n")
        });

        this.vertexBuffer = pc.posteffect.createFullscreenQuad(graphicsDevice);

        // uniforms
        this.focus = 0.35;
    }

    HorizontalTiltShift.prototype = {
        render: function (inputTarget, outputTarget) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uH").setValue(1/inputTarget.width);
            scope.resolve("uR").setValue(this.focus);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader);
        }
    };

    return {
        HorizontalTiltShift: HorizontalTiltShift
    };
}());