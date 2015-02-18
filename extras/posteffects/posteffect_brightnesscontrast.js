//--------------------------------- POST EFFECT DEFINITION -----------------------------------//
pc.extend(pc, function () {

    /**
     * @name pc.BrightnessContrastEffect
     * @class Changes the brightness and contrast of the input render target
     * @constructor Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     * @property {Number} brightness Controls the brightness of the render target. Ranges from -1 to 1 (-1 is solid black, 0 no change, 1 solid white)
     * @property {Number} contrast Controls the contrast of the render target. Ranges from -1 to 1 (-1 is solid gray, 0 no change, 1 maximum contrast)
     */
    var BrightnessContrastEffect = function (graphicsDevice) {
        // Shader author: tapio / http://tapio.github.com/
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
                "uniform sampler2D uColorBuffer;",
                "uniform float uBrightness;",
                "uniform float uContrast;",

                "varying vec2 vUv0;",

                "void main() {",

                    "gl_FragColor = texture2D( uColorBuffer, vUv0 );",

                    "gl_FragColor.rgb += uBrightness;",

                    "if (uContrast > 0.0) {",
                        "gl_FragColor.rgb = (gl_FragColor.rgb - 0.5) / (1.0 - uContrast) + 0.5;",
                    "} else {",
                        "gl_FragColor.rgb = (gl_FragColor.rgb - 0.5) * (1.0 + uContrast) + 0.5;",
                    "}",

                "}"
            ].join("\n")
        });

        // Uniforms
        this.brightness = 0;
        this.contrast = 0;
    }

    BrightnessContrastEffect = pc.inherits(BrightnessContrastEffect, pc.PostEffect);

    BrightnessContrastEffect.prototype = pc.extend(BrightnessContrastEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uBrightness").setValue(this.brightness);
            scope.resolve("uContrast").setValue(this.contrast);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        BrightnessContrastEffect: BrightnessContrastEffect
    };
}());

//--------------------------------- SCRIPT ATTRIBUTES DEFINITION -----------------------------------//

pc.script.attribute('brightness', 'number', 0, {
    min: -1,
    max: 1,
    step: 0.05,
    decimalPrecision: 5,
    displayName: 'Brightness'
});

pc.script.attribute('contrast', 'number', 0, {
    min: -1,
    max: 1,
    step: 0.05,
    decimalPrecision: 5,
    displayName: 'Contrast'
});

//--------------------------------- SCRIPT DEFINITION -----------------------------------//

pc.script.create('brightnessContrastEffect', function (app) {
    var BrightnessContrastEffect = function (entity) {
        this.entity = entity;
        this.effect = new pc.BrightnessContrastEffect(app.graphicsDevice);
    };

    BrightnessContrastEffect.prototype = {
        initialize:  function () {
            this.on('set', this.onAttributeChanged, this);

            this.effect.brightness = this.brightness;
            this.effect.contrast = this.contrast;
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

    return BrightnessContrastEffect;
});
