// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name ChromaticAberrationEffect
 * @classdesc Implements the ChromaticAberrationEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
function ChromaticAberrationEffect(graphicsDevice) {
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
            "    gl_FragColor = texture2D( uColorBuffer, vUv0 );",
            "",
            "    vec2 texel = 1.0 / uResolution.xy;",
            "    vec2 coords = (vUv0 - 0.5) * 2.0;",
            "    float coordDot = dot (coords, coords);",
            "",
            "    vec2 aberrationPrecompute = uAmount * coordDot * coords;",
            "    vec2 uvR = vUv0 - texel.xy * aberrationPrecompute;",
            "    vec2 uvB = vUv0 + texel.xy * aberrationPrecompute;",
            "",
            "    gl_FragColor.r = texture2D(uColorBuffer, uvR).r;",
            "    gl_FragColor.b = texture2D(uColorBuffer, uvB).b;",
            "}"
        ].join("\n")
    });

    // Uniforms
    this.amount = 10.0;
}

ChromaticAberrationEffect.prototype = Object.create(pc.PostEffect.prototype);
ChromaticAberrationEffect.prototype.constructor = ChromaticAberrationEffect;

Object.assign(ChromaticAberrationEffect.prototype, {
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
var ChromaticAberration = pc.createScript('chromaticAberration');

ChromaticAberration.attributes.add('amount', {
    type: 'number',
    default: 10,
    min: -100,
    max: 100,
    title: 'Amount',
    description: 'The amount of chromatic aberration applied.'
});

ChromaticAberration.prototype.initialize = function () {

    this.effect = new ChromaticAberrationEffect(this.app.graphicsDevice);
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
