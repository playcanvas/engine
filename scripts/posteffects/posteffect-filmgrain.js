// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name FilmGrainEffect
 * @classdesc Implements the FilmGrainEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
 function FilmGrainEffect(graphicsDevice) {
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
            "uniform float uTime;",
            "",
            "void main() {",
            "    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "",
            "   float x = (vUv0.x + 4.0 ) * (vUv0.y + 4.0 ) * (uTime * 10.0);",
            "   vec4 grain = vec4(mod((mod(x, 13.0) + 1.0) * (mod(x, 123.0) + 1.0), 0.01)-0.005) * uAmount * 10.0;",
            "",
            "   gl_FragColor = texture2D( uColorBuffer, vUv0 ) + grain;",
            "}"
        ].join("\n")
    });

    // Uniforms
    this.time = 0.0;
    this.amount = 10.0;
}

FilmGrainEffect.prototype = Object.create(pc.PostEffect.prototype);
FilmGrainEffect.prototype.constructor = FilmGrainEffect;

Object.assign(FilmGrainEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {

        var device = this.device;
        var scope = device.scope;

        scope.resolve("uResolution").setValue([device.width, device.height]);
        scope.resolve("uAmount").setValue(this.amount);
        scope.resolve("uTime").setValue(this.time);
        scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);

        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var FilmGrain = pc.createScript('filmGrain');

FilmGrain.attributes.add('amount', {
    type: 'number',
    default: 1.5,
    min: 0,
    title: 'Amount',
    description: 'The amount of film grain applied.'
});

FilmGrain.prototype.initialize = function () {

    this.effect = new FilmGrainEffect(this.app.graphicsDevice);
    this.effect.time = 0.0;
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

FilmGrain.prototype.update = function (dt) {
    this.effect.time += dt;
};
