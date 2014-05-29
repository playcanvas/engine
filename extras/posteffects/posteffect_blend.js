//--------------- POST EFFECT DEFINITION ------------------------//
pc.extend(pc.posteffect, function () {
    /**
     * @name pc.posteffect.Blend
     * @class Blends the input render target with another texture
     * @constructor Creates new instance of the post effect.
     * @extends pc.posteffect.PostEffect
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     * @property {pc.gfx.Texture} blendMap The texture with which to blend the input render target with
     * @property {Number} mixRatio The amount of blending between the input and the blendMap. Ranges from 0 to 1
     */
    var Blend = function (graphicsDevice) {
        this.shader = new pc.gfx.Shader(graphicsDevice, {
            attributes: {
                aPosition: pc.gfx.SEMANTIC_POSITION
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
        this.blendMap = new pc.gfx.Texture(graphicsDevice);
    }

    Blend = pc.inherits(Blend, pc.posteffect.PostEffect);

    Blend.prototype = pc.extend(Blend.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uMixRatio").setValue(this.mixRatio);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            scope.resolve("uBlendMap").setValue(this.blendMap);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        Blend: Blend
    };
}());

//--------------- SCRIPT ATTRIBUTES ------------------------//
pc.script.attribute('mixRatio', 'number', 1, {
    min: 0,
    max: 1,
    step: 0.05,
    decimalPrecision: 5
});

pc.script.attribute('blendMap', 'asset', [], {
    type: 'texture',
    max: 1
});

//--------------- SCRIPT DEFINITION ------------------------//
pc.script.create('blend', function (context) {
    // Creates a new Blend instance
    var Blend = function (entity) {
        this.entity = entity;
        this.effect = new pc.posteffect.Blend(context.graphicsDevice);
    };

    Blend.prototype = {
        initialize: function () {
            this.on('set', this.onAttributeChanged, this);
            this.effect.mixRatio = this.mixRatio;
            
            this.loadBlendMap();
        },
        
        loadBlendMap: function () {
            if (this.blendMap) {
                var asset = context.assets.getAssetByResourceId(this.blendMap);
                context.assets.load([asset]).then(function (resources) {
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

    return Blend;
});