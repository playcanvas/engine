//--------------- POST EFFECT DEFINITION ------------------------//
pc.extend(pc.posteffect, function () {

    /**
     * @name pc.posteffect.HueSaturation
     * @class Allows hue and saturation adjustment of the input render target.
     * @constructor Creates new instance of the post effect.
     * @extends pc.posteffect.PostEffect
     * @param {pc.gfx.Device} graphicsDevice The graphics device of the application
     * @property {Number} hue Controls the hue. Ranges from -1 to 1 (-1 is 180 degrees in the negative direction, 0 no change, 1 is 180 degrees in the postitive direction).
     * @property {Number} saturation Controls the saturation. Ranges from -1 to 1 (-1 is solid gray, 0 no change, 1 maximum saturation).
     */
    var HueSaturation = function (graphicsDevice) {
        // Shader author: tapio / http://tapio.github.com/
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
                "uniform sampler2D uColorBuffer;",
                "uniform float uHue;",
                "uniform float uSaturation;",

                "varying vec2 vUv0;",

                "void main() {",

                    "gl_FragColor = texture2D( uColorBuffer, vUv0 );",

                    // uHue
                    "float angle = uHue * 3.14159265;",
                    "float s = sin(angle), c = cos(angle);",
                    "vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;",
                    "float len = length(gl_FragColor.rgb);",
                    "gl_FragColor.rgb = vec3(",
                        "dot(gl_FragColor.rgb, weights.xyz),",
                        "dot(gl_FragColor.rgb, weights.zxy),",
                        "dot(gl_FragColor.rgb, weights.yzx)",
                    ");",

                    // uSaturation
                    "float average = (gl_FragColor.r + gl_FragColor.g + gl_FragColor.b) / 3.0;",
                    "if (uSaturation > 0.0) {",
                        "gl_FragColor.rgb += (average - gl_FragColor.rgb) * (1.0 - 1.0 / (1.001 - uSaturation));",
                    "} else {",
                        "gl_FragColor.rgb += (average - gl_FragColor.rgb) * (-uSaturation);",
                    "}",

                "}"
            ].join("\n")
        });

        // uniforms
        this.hue = 0;
        this.saturation = 0;
    }

    HueSaturation = pc.inherits(HueSaturation, pc.posteffect.PostEffect);

    HueSaturation.prototype = pc.extend(HueSaturation.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uHue").setValue(this.hue);
            scope.resolve("uSaturation").setValue(this.saturation);
            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.posteffect.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        HueSaturation: HueSaturation
    };
}());

//--------------- SCRIPT ATTRIBUTES ------------------------//
pc.script.attribute('hue', 'number', 0, {
    min: -1,
    max: 1,
    step: 0.05,
    decimalPrecision: 5
});

pc.script.attribute('saturation', 'number', 0, {
    min: -1,
    max: 1,
    step: 0.05,
    decimalPrecision: 5
});

//--------------- SCRIPT DEFINITION------------------------//
pc.script.create('huesaturation', function (context) {
    var Huesaturation = function (entity) {
        this.entity = entity;
        this.effect = new pc.posteffect.HueSaturation(context.graphicsDevice);
    };

    Huesaturation.prototype = {
        initialize: function () {
            this.effect.hue = this.hue;
            this.effect.saturation = this.saturation;
            this.on('set', this.onAttributeChanged, this);
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

    return Huesaturation;
});