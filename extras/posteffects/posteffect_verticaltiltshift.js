//--------------- POST EFFECT DEFINITION ------------------------//
pc.extend(pc, function () {

    /**
     * @name pc.VerticalTiltShiftEffect
     * @class Simple fake tilt-shift effect, modulating two pass Gaussian blur by vertical position
     * @constructor Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {Number} focus Controls where the "focused" horizontal line lies
     */
    var VerticalTiltShiftEffect = function (graphicsDevice) {
        // Shader author: alteredq / http://alteredqualia.com/
        this.shader = new pc.Shader(graphicsDevice, {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION
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
                "uniform float uV;",
                "uniform float uR;",

                "varying vec2 vUv0;",

                "void main() {",

                    "vec4 sum = vec4( 0.0 );",

                    "float vv = uV * abs( uR - vUv0.y );",

                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y - 4.0 * vv ) ) * 0.051;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y - 3.0 * vv ) ) * 0.0918;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y - 2.0 * vv ) ) * 0.12245;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y - 1.0 * vv ) ) * 0.1531;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y ) ) * 0.1633;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y + 1.0 * vv ) ) * 0.1531;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y + 2.0 * vv ) ) * 0.12245;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y + 3.0 * vv ) ) * 0.0918;",
                    "sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y + 4.0 * vv ) ) * 0.051;",

                    "gl_FragColor = sum;",
                "}"


            ].join("\n")
        });

        // uniforms
        this.focus = 0.35;
    }

    VerticalTiltShiftEffect = pc.inherits(VerticalTiltShiftEffect, pc.PostEffect);

    VerticalTiltShiftEffect.prototype = pc.extend(VerticalTiltShiftEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uV").setValue(1/inputTarget.height);
            scope.resolve("uR").setValue(this.focus);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        VerticalTiltShiftEffect: VerticalTiltShiftEffect
    };
}());


//--------------- SCRIPT ATTRIBUTES ------------------------//
pc.script.attribute('focus', 'number', 0.35, {
    min: 0,
    max: 1,
    step: 0.05,
    decimalPrecision: 5,
    displayName: 'Focus'
});

//--------------- SCRIPT DEFINITION------------------------//
pc.script.create('verticalTiltShiftEffect', function (app) {
    var VerticalTiltShiftEffect = function (entity) {
        this.entity = entity;
        this.effect = new pc.VerticalTiltShiftEffect(app.graphicsDevice);
    };

    VerticalTiltShiftEffect.prototype = {
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

    return VerticalTiltShiftEffect;
});
