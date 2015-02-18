//--------------- POST EFFECT DEFINITION ------------------------//
pc.extend(pc, function () {
    /**
     * @name pc.BlendEffect
     * @class Blends the input render target with another texture
     * @constructor Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {pc.Texture} blendMap The texture with which to blend the input render target with
     * @property {Number} mixRatio The amount of blending between the input and the blendMap. Ranges from 0 to 1
     */
    var BlendEffect = function (graphicsDevice) {
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
    }

    BlendEffect = pc.inherits(BlendEffect, pc.PostEffect);

    BlendEffect.prototype = pc.extend(BlendEffect.prototype, {
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

//--------------- SCRIPT ATTRIBUTES ------------------------//
pc.script.attribute('mixRatio', 'number', 1, {
    min: 0,
    max: 1,
    step: 0.05,
    decimalPrecision: 5,
    displayName: 'Mix Ratio'
});

pc.script.attribute('blendMap', 'asset', [], {
    type: 'texture',
    max: 1,
    displayName: 'Blend Map'
});

//--------------- SCRIPT DEFINITION ------------------------//
pc.script.create('blendEffect', function (app) {
    // Creates a new BlendEffect instance
    var BlendEffect = function (entity) {
        this.entity = entity;
        this.effect = new pc.BlendEffect(app.graphicsDevice);
    };

    BlendEffect.prototype = {
        initialize: function () {
            this.on('set', this.onAttributeChanged, this);
            this.effect.mixRatio = this.mixRatio;

            this.loadBlendMap();
        },

        loadBlendMap: function () {
            if (this.blendMap) {
                var asset = app.assets.getAssetById(this.blendMap);
                app.assets.load([asset]).then(function (resources) {
                    this.effect.blendMap = resources[0];
                }.bind(this));
            }
        },

        onAttributeChanged: function (name, oldValue, newValue) {
            if (name === 'blendMap') {
                this.loadBlendMap();
            }  else {
                this.effect[name] = newValue;
            }
        },

        onEnable: function () {
            this.entity.camera.postEffects.addEffect(this.effect);
        },

        onDisable: function () {
            this.entity.camera.postEffects.removeEffect(this.effect);
        }
    };

    return BlendEffect;
});
