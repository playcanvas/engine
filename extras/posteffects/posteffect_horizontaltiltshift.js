//--------------- POST EFFECT DEFINITION ------------------------//
pc.extend(pc.posteffect, function () {

    /**
     * @name pc.posteffect.HorizontalTiltShift
     * @class Simple fake tilt-shift effect, modulating two pass Gaussian blur by horizontal position
     * @constructor Creates new instance of the post effect.
     * @extends pc.posteffect.PostEffect
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     * @property {Number} focus Controls where the "focused" vertical line lies
     */
    var HorizontalTiltShift = function (graphicsDevice) {
        // Shader author: alteredq / http://alteredqualia.com/
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

        // uniforms
        this.focus = 0.35;
    }

    HorizontalTiltShift = pc.inherits(HorizontalTiltShift, pc.posteffect.PostEffect);

    HorizontalTiltShift.prototype = pc.extend(HorizontalTiltShift.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uH").setValue(1/inputTarget.width);
            scope.resolve("uR").setValue(this.focus);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        HorizontalTiltShift: HorizontalTiltShift
    };
}());


//--------------- SCRIPT ATTRIBUTES ------------------------//
pc.script.attribute('focus', 'number', 0.35, {
    min: 0,
    max: 1,
    step: 0.05,
    decimalPrecision: 5
});

//--------------- SCRIPT DEFINITION------------------------//
pc.script.create('horizontaltiltshift', function (context) {
    // Creates a new Horizontaltiltshift instance
    var Horizontaltiltshift = function (entity) {
        this.entity = entity;
        this.effect = new pc.posteffect.HorizontalTiltShift(context.graphicsDevice);
    };

    Horizontaltiltshift.prototype = {
        initialize: function () {
            this.effect.focus = this.focus;
            this.on('set', this.onAttributeChanged, this);
        },

        onAttributeChanged: function (name, oldValue, newValue) {
            this.effect[name] = newValue;
        },

        onEnable: function () {
            this.entity.camera.postEffects.addEffect(this.effect);
        },

        onDisable: function () {
            this.entity.camera.postEffects.removeEffect(this.effect);
        }
    };

    return Horizontaltiltshift;
});