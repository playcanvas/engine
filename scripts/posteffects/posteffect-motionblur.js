// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name MotionBlurEffect
 * @classdesc Implements the MotionBlurEffect post processing effect.
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 * @param {number} motionBlurSamples - The number of samples collected per pixel to calculate the total motion blur.
 */
function MotionBlurEffect(graphicsDevice, motionBlurSamples) {
    pc.PostEffect.call(this, graphicsDevice);

    this.needsDepthBuffer = true;

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
            "#define SAMPLES " + motionBlurSamples.toFixed(1),
            "",
            "uniform sampler2D uColorBuffer;",
            "uniform vec2 uResolution;",
            "uniform float uAspect;",
            "uniform float uStrength;",
            "uniform mat4 matrix_viewProjectionPrevious;",
            "uniform mat4 matrix_viewProjectionInverse;",
            "",
            "void main()",
            "{",
            "    highp vec2 uv = vUv0; // variable_vertex.xy; // interpolated at pixel's center",
            "",
            "    vec2 texelSize = 1.0 / uResolution;",
            "    float depth = getLinearScreenDepth(uv);",
            "",
            "    vec4 cpos = vec4(uv * 2.0 - 1.0, depth, 1.0);",
            "    cpos = cpos * matrix_viewProjectionInverse;",
            "",
            "    vec4 ppos = cpos * matrix_viewProjectionPrevious;",
            "    ppos.xyz /= ppos.w;",
            "    ppos.xy = ppos.xy * 0.5 + 0.5;",
            "",
            "    vec2 velocity = (ppos.xy - uv) * 0.01 * uStrength;",
            `
            vec4 result = texture2D(uColorBuffer, uv);
            float speed = length(velocity / texelSize);      

            int samplesCount = int(clamp(speed, 1.0, float(SAMPLES)));

            velocity = normalize(velocity) * texelSize;
            float hlim = float(-samplesCount) * 0.5 + 0.5;

            for( int i = 1; i < int(SAMPLES); ++i ) {
                
                if (i >= samplesCount) break;

                vec2 offset = uv + velocity * (hlim + float(i));
                result += texture2D(uColorBuffer, offset);
            }

            gl_FragColor = result / float(samplesCount);
            `,
            "}"
        ].join("\n")
    });

    // Uniforms
    this.strength = 2.0;
    this.camera = undefined;
    this.matrix = new pc.Mat4();
    this.matrixPrevious = new pc.Mat4();
}

MotionBlurEffect.prototype = Object.create(pc.PostEffect.prototype);
MotionBlurEffect.prototype.constructor = MotionBlurEffect;

Object.assign(MotionBlurEffect.prototype, {
    render: function (inputTarget, outputTarget, rect) {

        var device = this.device;
        var scope = device.scope;

        scope.resolve("matrix_viewProjectionPrevious").setValue(this.matrixPrevious.data);

        const matrixValue = scope.resolve("matrix_view").getValue();
        this.matrix.set(matrixValue);
        this.matrix.invert();

        scope.resolve("matrix_viewProjectionInverse").setValue(this.matrix.data);

        scope.resolve("uStrength").setValue(this.strength);

        scope.resolve("uResolution").setValue([device.width, device.height]);
        scope.resolve("uAspect").setValue(device.width / device.height);
        scope.resolve("uColorBuffer").setValue(inputTarget.colorBuffer);

        pc.drawFullscreenQuad(device, outputTarget, this.vertexBuffer, this.shader, rect);

        this.matrixPrevious.set(matrixValue);
    }
});

// ----------------- SCRIPT DEFINITION ------------------ //
var MotionBlur = pc.createScript('motionBlur');

MotionBlur.attributes.add('samples', {
    type: 'number',
    default: 32,
    min: 8,
    max: 256,
    precision: 0,
    title: 'Samples',
    description: 'The number of samples collected per pixel to calculate the total motion blur. Larger values provide better quality but can have a performance hit.'
});

MotionBlur.attributes.add('strength', {
    type: 'number',
    default: 2.0,
    min: 0.0,
    max: 20.0,
    title: 'Strength',
    description: 'Determines how intense the calculated motion blurring is.'
});

MotionBlur.prototype.initialize = function () {

    this.effect = new MotionBlurEffect(this.app.graphicsDevice, this.samples);
    this.effect.strength = this.strength;
    this.effect.camera = this.entity;

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
