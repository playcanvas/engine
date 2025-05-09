// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name SepiaEffect
 * @classdesc Implements the SepiaEffect color filter.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 * @property {number} amount Controls the intensity of the effect. Ranges from 0 to 1.
 */
function SepiaEffect(graphicsDevice) {
    pc.PostEffect.call(this, graphicsDevice);

    var fshader = [
        'uniform float uAmount;',
        'uniform sampler2D uColorBuffer;',
        '',
        'varying vec2 vUv0;',
        '',
        'void main() {',
        '    vec4 color = texture2D(uColorBuffer, vUv0);',
        '    vec3 c = color.rgb;',
        '',
        '    color.r = dot(c, vec3(1.0 - 0.607 * uAmount, 0.769 * uAmount, 0.189 * uAmount));',
        '    color.g = dot(c, vec3(0.349 * uAmount, 1.0 - 0.314 * uAmount, 0.168 * uAmount));',
        '    color.b = dot(c, vec3(0.272 * uAmount, 0.534 * uAmount, 1.0 - 0.869 * uAmount));',
        '',
        '    gl_FragColor = vec4(min(vec3(1.0), color.rgb), color.a);',
        '}'
    ].join('\n');

    this.shader = pc.ShaderUtils.createShader(graphicsDevice, {
        uniqueName: 'SepiaShader',
        attributes: { aPosition: pc.SEMANTIC_POSITION },
        vertexGLSL: pc.PostEffect.quadVertexShader,
        fragmentGLSL: fshader
    });

    // Uniforms
    this.amount = 1;
}

SepiaEffect.prototype = Object.create(pc.PostEffect.prototype);
SepiaEffect.prototype.constructor = SepiaEffect;

Object.assign(SepiaEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {
        var device = this.device;
        var scope = device.scope;

        scope.resolve('uAmount').setValue(this.amount);
        scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
        this.drawQuad(outputTarget, this.shader, rect);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var Sepia = pc.createScript('sepia');

Sepia.attributes.add('amount', {
    type: 'number',
    default: 1,
    min: 0,
    max: 1,
    title: 'Amount'
});

// initialize code called once per entity
Sepia.prototype.initialize = function () {
    this.effect = new SepiaEffect(this.app.graphicsDevice);
    this.effect.amount = this.amount;

    this.on('attr:amount', function (value) {
        this.effect.amount = value;
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
