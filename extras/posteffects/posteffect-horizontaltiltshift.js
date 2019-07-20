// --------------- POST EFFECT DEFINITION --------------- //
Object.assign(pc, function () {

    /**
     * @constructor
     * @name pc.HorizontalTiltShiftEffect
     * @classdesc Simple fake tilt-shift effect, modulating two pass Gaussian blur by horizontal position
     * @description Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {Number} focus Controls where the "focused" vertical line lies
     */
    var HorizontalTiltShiftEffect = function (graphicsDevice) {
        pc.PostEffect.call(this, graphicsDevice);

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
                "",
                "uniform sampler2D uColorBuffer;",
                "uniform float uH;",
                "uniform float uR;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main() {",
                "    vec4 sum = vec4( 0.0 );",
                "    float hh = uH * abs( uR - vUv0.x );",
                "",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x - 4.0 * hh, vUv0.y ) ) * 0.051;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x - 3.0 * hh, vUv0.y ) ) * 0.0918;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x - 2.0 * hh, vUv0.y ) ) * 0.12245;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x - 1.0 * hh, vUv0.y ) ) * 0.1531;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x, vUv0.y ) ) * 0.1633;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x + 1.0 * hh, vUv0.y ) ) * 0.1531;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x + 2.0 * hh, vUv0.y ) ) * 0.12245;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x + 3.0 * hh, vUv0.y ) ) * 0.0918;",
                "    sum += texture2D( uColorBuffer, vec2( vUv0.x + 4.0 * hh, vUv0.y ) ) * 0.051;",
                "",
                "    gl_FragColor = sum;",
                "}"
            ].join("\n")
        });

        // uniforms
        this.focus = 0.35;
    };

    HorizontalTiltShiftEffect.prototype = Object.create(pc.PostEffect.prototype);
    HorizontalTiltShiftEffect.prototype.constructor = HorizontalTiltShiftEffect;

    Object.assign(HorizontalTiltShiftEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uH").setValue(1 / inputTarget.width);
            scope.resolve("uR").setValue(this.focus);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        HorizontalTiltShiftEffect: HorizontalTiltShiftEffect
    };
}());

// ----------------- SCRIPT DEFINITION ------------------ //
var HorizontalTiltShift = pc.createScript('horizontalTiltShift');

HorizontalTiltShift.attributes.add('focus', {
    type: 'number',
    default: 0.35,
    min: 0,
    max: 1,
    precision: 5,
    title: 'Focus'
});

// initialize code called once per entity
HorizontalTiltShift.prototype.initialize = function () {
    this.effect = new pc.HorizontalTiltShiftEffect(this.app.graphicsDevice);
    this.effect.focus = this.focus;

    this.on('attr:focus', function (value) {
        this.effect.focus = value;
    }, this);

    var queue = this.entity.camera.postEffects;
    queue.addEffect(this.effect);

    this.on('state', function (enabled) {
        if (enabled) {
            queue.addEffect(this.effect);
        } else {
            queue.removeEffect(this.effect);
        }
    });

    this.on('destroy', function () {
        queue.removeEffect(this.effect);
    });
};
