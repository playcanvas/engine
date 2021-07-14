// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name SharpenEffect
 * @classdesc Implements the SharpenEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
function SharpenEffect(graphicsDevice) {
    pc.PostEffect.call(this, graphicsDevice);

    this.shader = new pc.Shader(graphicsDevice, {
        attributes: {
            aPosition: pc.SEMANTIC_POSITION
        },
        vshader: [
            (graphicsDevice.webgl2) ? ("#version 300 es\n\n" + pc.shaderChunks.gles3VS) : "",
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
            (graphicsDevice.webgl2) ? ("#version 300 es\n\n" + pc.shaderChunks.gles3PS) : "",
            "precision " + graphicsDevice.precision + " float;",
            pc.shaderChunks.screenDepthPS,
            "",
            "varying vec2 vUv0;",
            "",
            "uniform vec2 uResolution;",
            "uniform sampler2D uColorBuffer;",
            "uniform float uAmount;",
            "",
            "void main() {",
            "   highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "",
            "   vec4 base = texture2D( uColorBuffer, uv );",
            "   vec2 texel = 1.0 / uResolution.xy;",
            "   vec4 edgeDetection = texture2D(uColorBuffer, uv + texel * vec2(0.0, -1.0)) +",
            "   texture2D(uColorBuffer, uv + texel * vec2(-1.0, 0.0)) +",
            "   texture2D(uColorBuffer, uv + texel * vec2(1.0, 0.0)) +",
            "   texture2D(uColorBuffer, uv + texel * vec2(0.0, 1.0)) -",
            "   base * 4.0;",
            "",
            "   gl_FragColor = max(base - (uAmount * vec4(edgeDetection.rgb, 0)), 0.);",
            "}"
        ].join("\n")
    });

    // Uniforms
    this.amount = 10.0;
}

SharpenEffect.prototype = Object.create(pc.PostEffect.prototype);
SharpenEffect.prototype.constructor = SharpenEffect;

Object.assign(SharpenEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {

        var device = this.device;
        var scope = device.scope;

        scope.resolve("uResolution").setValue([device.width, device.height]);
        scope.resolve("uAmount").setValue(this.amount);
        scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);

        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var Sharpen = pc.createScript('sharpen');

Sharpen.attributes.add('amount', {
    type: 'number',
    default: 1,
    min: 0,
    max: 10,
    title: 'Amount',
    description: 'The amount of sharpen applied.'
});

Sharpen.prototype.initialize = function () {

    this.effect = new SharpenEffect(this.app.graphicsDevice);
    this.effect.amount = this.amount;

    this.on('attr', function (name, value) {
        this.effect[name] = value;
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
