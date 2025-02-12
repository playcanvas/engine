import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass implementation of a down-sample filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDownsample extends RenderPassShaderQuad {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture} sourceTexture - The source texture to downsample.
     * @param {object} [options] - The options for the render pass.
     * @param {boolean} [options.boxFilter] - Whether to use a box filter for downsampling.
     * @param {Texture|null} [options.premultiplyTexture] - The texture to premultiply the source texture
     * with. Only supported when boxFilter is true.
     * @param {string} [options.premultiplySrcChannel] - The source channel to premultiply.
     */
    constructor(device, sourceTexture, options = {}) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.premultiplyTexture = options.premultiplyTexture;

        const boxFilter = options.boxFilter ?? false;
        const key = `${boxFilter ? 'Box' : ''}-${options.premultiplyTexture ? 'Premultiply' : ''}-${options.premultiplySrcChannel ?? ''}}`;

        this.shader = this.createQuadShader(`DownSampleShader:${key}`, /* glsl */`

            ${boxFilter ? '#define BOXFILTER' : ''}
            ${options.premultiplyTexture ? '#define PREMULTIPLY' : ''}

            uniform sampler2D sourceTexture;
            uniform vec2 sourceInvResolution;
            varying vec2 uv0;

            #ifdef PREMULTIPLY
                uniform sampler2D premultiplyTexture;
            #endif

            void main()
            {
                vec3 e = texture2D (sourceTexture, vec2 (uv0.x, uv0.y)).rgb;

                #ifdef BOXFILTER
                    vec3 value = e;

                    #ifdef PREMULTIPLY
                        float premultiply = texture2D(premultiplyTexture, vec2 (uv0.x, uv0.y)).${options.premultiplySrcChannel};
                        value *= vec3(premultiply);
                    #endif
                #else

                    float x = sourceInvResolution.x;
                    float y = sourceInvResolution.y;

                    vec3 a = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y + 2.0 * y)).rgb;
                    vec3 b = texture2D(sourceTexture, vec2 (uv0.x,           uv0.y + 2.0 * y)).rgb;
                    vec3 c = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y + 2.0 * y)).rgb;

                    vec3 d = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y)).rgb;
                    vec3 f = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y)).rgb;

                    vec3 g = texture2D(sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y - 2.0 * y)).rgb;
                    vec3 h = texture2D(sourceTexture, vec2 (uv0.x,           uv0.y - 2.0 * y)).rgb;
                    vec3 i = texture2D(sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y - 2.0 * y)).rgb;

                    vec3 j = texture2D(sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;
                    vec3 k = texture2D(sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;
                    vec3 l = texture2D(sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;
                    vec3 m = texture2D(sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;


                    vec3 value = e * 0.125;
                    value += (a + c + g + i) * 0.03125;
                    value += (b + d + f + h) * 0.0625;
                    value += (j + k + l + m) * 0.125;
                #endif

                gl_FragColor = vec4(value, 1.0);
            }`
        );

        this.sourceTextureId = device.scope.resolve('sourceTexture');
        this.premultiplyTextureId = device.scope.resolve('premultiplyTexture');
        this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
    }

    setSourceTexture(value) {
        this._sourceTexture = value;

        // change resize source
        this.options.resizeSource = value;
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);
        if (this.premultiplyTexture) {
            this.premultiplyTextureId.setValue(this.premultiplyTexture);
        }

        this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
        this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        super.execute();
    }
}

export { RenderPassDownsample };
