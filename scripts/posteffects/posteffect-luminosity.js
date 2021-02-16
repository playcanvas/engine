// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name LuminosityEffect
 * @classdesc Outputs the luminosity of the input render target.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {pc.GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
function LuminosityEffect(graphicsDevice) {
    pc.PostEffect.call(this, graphicsDevice);

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
            "",
            "varying vec2 vUv0;",
            "",
            "void main() {",
            "    vec4 texel = texture2D(uColorBuffer, vUv0);",
            "    vec3 luma = vec3(0.299, 0.587, 0.114);",
            "    float v = dot(texel.xyz, luma);",
            "    gl_FragColor = vec4(v, v, v, texel.w);",
            "}"
        ].join("\n")
    });
}

LuminosityEffect.prototype = Object.create(pc.PostEffect.prototype);
LuminosityEffect.prototype.constructor = LuminosityEffect;

Object.assign(LuminosityEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {
        var device = this.device;
        var scope = device.scope;

        scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var Luminosity = pc.createScript('luminosity');

// initialize code called once per entity
Luminosity.prototype.initialize = function () {
    this.effect = new LuminosityEffect(this.app.graphicsDevice);

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
