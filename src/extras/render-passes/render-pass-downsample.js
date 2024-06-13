import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';

/**
 * Render pass implementation of a down-sample filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDownsample extends RenderPassShaderQuad {
    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.shader = this.createQuadShader('DownSampleShader', /* glsl */`

            uniform sampler2D sourceTexture;
            uniform vec2 sourceInvResolution;
            varying vec2 uv0;

            void main()
            {
                float x = sourceInvResolution.x;
                float y = sourceInvResolution.y;

                vec3 a = texture2D (sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y + 2.0 * y)).rgb;
                vec3 b = texture2D (sourceTexture, vec2 (uv0.x,           uv0.y + 2.0 * y)).rgb;
                vec3 c = texture2D (sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y + 2.0 * y)).rgb;

                vec3 d = texture2D (sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y)).rgb;
                vec3 e = texture2D (sourceTexture, vec2 (uv0.x,           uv0.y)).rgb;
                vec3 f = texture2D (sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y)).rgb;

                vec3 g = texture2D (sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y - 2.0 * y)).rgb;
                vec3 h = texture2D (sourceTexture, vec2 (uv0.x,           uv0.y - 2.0 * y)).rgb;
                vec3 i = texture2D (sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y - 2.0 * y)).rgb;

                vec3 j = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;
                vec3 k = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;
                vec3 l = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;
                vec3 m = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;

                vec3 value = e * 0.125;
                value += (a + c + g + i) * 0.03125;
                value += (b + d + f + h) * 0.0625;
                value += (j + k + l + m) * 0.125;

                gl_FragColor = vec4(value, 1.0);
            }`
        );

        this.sourceTextureId = device.scope.resolve('sourceTexture');
        this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);

        this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
        this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        super.execute();
    }
}

export { RenderPassDownsample };
