// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name PixelateEffect
 * @classdesc Implements the PixelateEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
function PixelateEffect(graphicsDevice) {
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
            "    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "",
            "   vec2 pixelateDxy = uAmount / uResolution;",
            "   vec2 pixelateCoord = pixelateDxy * floor( uv / pixelateDxy );",
            "   gl_FragColor = texture2D(uColorBuffer, pixelateCoord);",
            "}"
        ].join("\n")
    });

    // Uniforms
    this.amount = 10.0;
}

PixelateEffect.prototype = Object.create(pc.PostEffect.prototype);
PixelateEffect.prototype.constructor = PixelateEffect;

Object.assign(PixelateEffect.prototype, {
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
var Pixelate = pc.createScript('pixelate');

Pixelate.attributes.add('amount', {
    type: 'number',
    default: 12,
    min: 1,
    max: 64,
    title: 'Amount',
    description: 'The size of each pixel.'
});

Pixelate.prototype.initialize = function () {

    this.effect = new PixelateEffect(this.app.graphicsDevice);
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
