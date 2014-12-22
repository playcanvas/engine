//--------------- POST EFFECT DEFINITION------------------------//
pc.extend(pc, function () {

    /**
     * @name pc.LuminosityEffect
     * @class Outputs the luminosity of the input render target.
     * @constructor Creates new instance of the post effect.
     * @extends pc.PostEffect
     * @param {pc.GraphicsDevice} graphicsDevice The graphics device of the application
     */
    var LuminosityEffect = function (graphicsDevice) {
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
                "uniform sampler2D uColorBuffer;",
                "",
                "varying vec2 vUv0;",
                "",
                "void main() {",
                    "vec4 texel = texture2D(uColorBuffer, vUv0);",
                    "vec3 luma = vec3(0.299, 0.587, 0.114);",
                    "float v = dot(texel.xyz, luma);",
                    "gl_FragColor = vec4(v, v, v, texel.w);",
                "}"
            ].join("\n")
        });
    }

    LuminosityEffect = pc.inherits(LuminosityEffect, pc.PostEffect);

    LuminosityEffect.prototype = pc.extend(LuminosityEffect.prototype, {
        render: function (inputTarget, outputTarget, rect) {
            var device = this.device;
            var scope = device.scope;

            scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);
            pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);
        }
    });

    return {
        LuminosityEffect: LuminosityEffect
    };
}());
    
//--------------- SCRIPT DEFINITION------------------------//    
pc.script.create('luminosityEffect', function (context) {
    
    // Creates a new LuminosityEffect instance
    var LuminosityEffect = function (entity) {
        this.entity = entity;
        this.effect = new pc.LuminosityEffect(context.graphicsDevice);
    };

    LuminosityEffect.prototype = {
        onEnable: function () {
            this.entity.camera.postEffects.addEffect(this.effect, false);
        },
        
        onDisable: function () {
            this.entity.camera.postEffects.removeEffect(this.effect);
        }
    };

    return LuminosityEffect;
    
});