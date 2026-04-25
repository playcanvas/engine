// --------------- POST EFFECT DEFINITION --------------- //
/**
 * @class
 * @name FxaaEffect
 * @classdesc Implements the FXAA post effect by NVIDIA (WebGL2 only).
 * @description Creates new instance of the post effect.
 * @augments PostEffect
 * @param {GraphicsDevice} graphicsDevice - The graphics device of the application.
 */
class FxaaEffect extends pc.PostEffect {
    constructor(graphicsDevice) {
        super(graphicsDevice);

        // Shaders
        const fxaaFrag = /* glsl */`
            uniform sampler2D uColorBuffer;
            uniform vec2 uResolution;

            #define FXAA_REDUCE_MIN   (1.0/128.0)
            #define FXAA_REDUCE_MUL   (1.0/8.0)
            #define FXAA_SPAN_MAX     8.0

            void main()
            {
                vec2 fragCoord = gl_FragCoord.xy * uResolution;

                // Sample center pixel
                vec4 rgbaM = texture2D(uColorBuffer, fragCoord);
                vec3 rgbM = rgbaM.rgb;
                float opacity = rgbaM.a;

                // Sample the 4 neighboring pixels using textureOffset (WebGL2)
                vec3 rgbNW = textureOffset(uColorBuffer, fragCoord, ivec2(-1, -1)).rgb;
                vec3 rgbNE = textureOffset(uColorBuffer, fragCoord, ivec2( 1, -1)).rgb;
                vec3 rgbSW = textureOffset(uColorBuffer, fragCoord, ivec2(-1,  1)).rgb;
                vec3 rgbSE = textureOffset(uColorBuffer, fragCoord, ivec2( 1,  1)).rgb;

                vec3 luma = vec3(0.299, 0.587, 0.114);

                float lumaNW = dot(rgbNW, luma);
                float lumaNE = dot(rgbNE, luma);
                float lumaSW = dot(rgbSW, luma);
                float lumaSE = dot(rgbSE, luma);
                float lumaM  = dot(rgbM, luma);
                float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
                float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

                vec2 dir;
                dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
                dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

                float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);

                float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
                dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * uResolution;

                vec3 rgbA = 0.5 * (
                    texture2D(uColorBuffer, fragCoord + dir * (1.0 / 3.0 - 0.5)).rgb +
                    texture2D(uColorBuffer, fragCoord + dir * (2.0 / 3.0 - 0.5)).rgb);

                vec3 rgbB = rgbA * 0.5 + 0.25 * (
                    texture2D(uColorBuffer, fragCoord + dir * -0.5).rgb +
                    texture2D(uColorBuffer, fragCoord + dir * 0.5).rgb);

                float lumaB = dot(rgbB, luma);

                if ((lumaB < lumaMin) || (lumaB > lumaMax))
                {
                    gl_FragColor = vec4(rgbA, opacity);
                }
                else
                {
                    gl_FragColor = vec4(rgbB, opacity);
                }
            }
        `;

        this.fxaaShader = pc.ShaderUtils.createShader(graphicsDevice, {
            uniqueName: 'FxaaShader',
            attributes: { aPosition: pc.SEMANTIC_POSITION },
            vertexGLSL: pc.PostEffect.quadVertexShader,
            fragmentGLSL: fxaaFrag
        });

        // Uniforms
        this.resolution = new Float32Array(2);
    }

    render(inputTarget, outputTarget, rect) {
        const device = this.device;
        const scope = device.scope;

        this.resolution[0] = 1 / inputTarget.width;
        this.resolution[1] = 1 / inputTarget.height;
        scope.resolve('uResolution').setValue(this.resolution);
        scope.resolve('uColorBuffer').setValue(inputTarget.colorBuffer);
        this.drawQuad(outputTarget, this.fxaaShader, rect);
    }
}

// ----------------- SCRIPT DEFINITION ------------------ //
var Fxaa = pc.createScript('fxaa');

// initialize code called once per entity
Fxaa.prototype.initialize = function () {
    this.effect = new FxaaEffect(this.app.graphicsDevice);

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
