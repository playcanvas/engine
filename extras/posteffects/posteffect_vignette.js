//--------------- POST EFFECT DEFINITION ------------------------//
pc.extend(pc, function () {

    /**
     * @name pc.VignetteEffect
     * @class Implements the VignetteEffect post processing effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {Number} offset Controls the offset of the effect.
     * @property {Number} darkness Controls the darkness of the effect.
     */
    var VignetteEffect = function (graphicsDevice) {
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
    }

    VignetteEffect = pc.inherits(VignetteEffect, pc.PostEffect);

    VignetteEffect.prototype = pc.extend(VignetteEffect, {
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

//--------------- SCRIPT ATTRIBUTES ------------------------//
pc.script.attribute('offset', 'number', 1, {
    min: 0,
    step: 0.05,
    decimalPrecision: 5,
    displayName: 'Offset'
});

pc.script.attribute('darkness', 'number', 1, {
    step: 0.05,
    decimalPrecision: 5,
    displayName: 'Darkness'
});

//--------------- SCRIPT DEFINITION------------------------//
pc.script.create('vignetteEffect', function (app) {
    // Creates a new VignetteEffect instance
    var VignetteEffect = function (entity) {
        this.entity = entity;
        this.effect = new pc.VignetteEffect(app.graphicsDevice);
    };

    VignetteEffect.prototype = {
        initialize: function () {
            this.on('set', this.onAttributeChanged, this);
            this.effect.offset = this.offset;
            this.effect.darkness = this.darkness;
        },

        onAttributeChanged: function (name, oldValue, newValue) {
            this.effect[name] = newValue;
        },

        onEnable: function () {
            this.entity.camera.postEffects.addEffect(this.effect);
        },

        onDisable: function () {
            this.entity.camera.postEffects.removeEffect(this.effect);
        }
    };

    return VignetteEffect;
});
