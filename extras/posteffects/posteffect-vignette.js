// --------------- POST EFFECT DEFINITION --------------- //
Object.assign(pc, function () {

    /**
     * @constructor
     * @name pc.VignetteEffect
     * @classdesc Implements the VignetteEffect post processing effect.
     * @description Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {Number} offset Controls the offset of the effect.
     * @property {Number} darkness Controls the darkness of the effect.
     */
    var VignetteEffect = function (graphicsDevice) {
        pc.PostEffect.call(this, graphicsDevice);

        // Shaders
        var attributes = {
            aPosition: pc.SEMANTIC_POSITION
        };

        var passThroughVert = [
            "attribute vec2 aPosition;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main(void)",
            "{",
            "    gl_Position = vec4(aPosition, 0.0, 1.0);",
            "    vUv0 = (aPosition.xy + 1.0) * 0.5;",
            "}"
        ].join("\n");

        var luminosityFrag = [
            "precision " + graphicsDevice.precision + " float;",
            "",
            "uniform sampler2D uColorBuffer;",
            "uniform float uDarkness;",
            "uniform float uOffset;",
            "",
            "varying vec2 vUv0;",
            "",
            "void main() {",
            "    vec4 texel = texture2D(uColorBuffer, vUv0);",
            "    vec2 uv = (vUv0 - vec2(0.5)) * vec2(uOffset);",
            "    gl_FragColor = vec4(mix(texel.rgb, vec3(1.0 - uDarkness), dot(uv, uv)), texel.a);",
            "}"
        ].join("\n");

        this.vignetteShader = new pc.Shader(graphicsDevice, {
            attributes: attributes,
            vshader: passThroughVert,
            fshader: luminosityFrag
        });

        this.offset = 1;
        this.darkness = 1;
    };

    VignetteEffect.prototype = Object.create(pc.PostEffect.prototype);
    VignetteEffect.prototype.constructor = VignetteEffect;

    Object.assign(VignetteEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            scope.resolve("uOffset").setValue(this.offset);
            scope.resolve("uDarkness").setValue(this.darkness);
            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.vignetteShader, rect);
        }
    });

    return {
        VignetteEffect: VignetteEffect
    };
}());

// ----------------- SCRIPT DEFINITION ------------------ //
var Vignette = pc.createScript('vignette');

Vignette.attributes.add('offset', {
    type: 'number',
    default: 1,
    min: 0,
    precision: 5,
    title: 'Offset'
});

Vignette.attributes.add('darkness', {
    type: 'number',
    default: 1,
    precision: 5,
    title: 'Darkness'
});

// initialize code called once per entity
Vignette.prototype.initialize = function () {
    this.effect = new pc.VignetteEffect(this.app.graphicsDevice);
    this.effect.offset = this.offset;
    this.effect.darkness = this.darkness;

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
