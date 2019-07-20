// --------------- POST EFFECT DEFINITION --------------- //
Object.assign(pc, function () {

    /**
     * @constructor
     * @name pc.BlendEffect
     * @classdesc Blends the input render target with another texture
     * @description Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {pc.Texture} blendMap The texture with which to blend the input render target with
     * @property {Number} mixRatio The amount of blending between the input and the blendMap. Ranges from 0 to 1
     */
    var BlendEffect = function (graphicsDevice) {
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
                "uniform float uMixRatio;",
                "uniform sampler2D uColorBuffer;",
                "uniform sampler2D uBlendMap;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main(void)",
                "{",
                "    vec4 texel1 = texture2D(uColorBuffer, vUv0);",
                "    vec4 texel2 = texture2D(uBlendMap, vUv0);",
                "    gl_FragColor = mix(texel1, texel2, uMixRatio);",
                "}"
            ].join("\n")
        });

        // Uniforms
        this.mixRatio = 0.5;
        this.blendMap = new pc.Texture(graphicsDevice);
        this.blendMap.name = 'pe-blend';
    };

    BlendEffect.prototype = Object.create(pc.PostEffect.prototype);
    BlendEffect.prototype.constructor = BlendEffect;

    Object.assign(BlendEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uMixRatio").setValue(this.mixRatio);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            scope.resolve("uBlendMap").setValue(this.blendMap);
            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        BlendEffect: BlendEffect
    };
}());

// ----------------- SCRIPT DEFINITION ------------------ //
var Blend = pc.createScript('blend');

Blend.attributes.add('mixRatio', {
    type: 'number',
    default: 1,
    min: 0,
    max: 1,
    precision: 5,
    title: 'Mix Ratio'
});

Blend.attributes.add('blendMap', {
    type: 'asset',
    assetType: 'texture',
    title: 'Blend Map'
});

Blend.prototype.initialize = function () {
    this.effect = new pc.BlendEffect(this.app.graphicsDevice);
    this.effect.mixRatio = this.mixRatio;
    this.effect.blendMap = this.blendMap.resource;

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

    this.on('attr:mixRatio', function (value) {
        this.effect.mixRatio = value;
    }, this);

    this.on('attr:blendMap', function (value) {
        this.effect.blendMap = value ? value.resource : null;
    }, this);
};
