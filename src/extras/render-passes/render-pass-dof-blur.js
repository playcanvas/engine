import { Kernel } from '../../core/math/kernel.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js'
 */

/**
 * Render pass implementation of a down-sample filter used by the Depth of Field pass. Based on
 * a texel of the CoC texture, it generates blurred version of the near or far texture.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDofBlur extends RenderPassShaderQuad {
    blurRadiusNear = 1;

    blurRadiusFar = 1;

    _blurRings = 3;

    _blurRingPoints = 3;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture|null} nearTexture - The near texture to blur. Skip near blur if the texture is null.
     * @param {Texture} farTexture - The far texture to blur.
     * @param {Texture} cocTexture - The CoC texture.
     */
    constructor(device, nearTexture, farTexture, cocTexture) {
        super(device);
        this.nearTexture = nearTexture;
        this.farTexture = farTexture;
        this.cocTexture = cocTexture;

        const { scope } = device;
        this.kernelId = scope.resolve('kernel[0]');
        this.kernelCountId = scope.resolve('kernelCount');
        this.blurRadiusNearId = scope.resolve('blurRadiusNear');
        this.blurRadiusFarId = scope.resolve('blurRadiusFar');

        this.nearTextureId = scope.resolve('nearTexture');
        this.farTextureId = scope.resolve('farTexture');
        this.cocTextureId = scope.resolve('cocTexture');
    }

    set blurRings(value) {
        if (this._blurRings !== value) {
            this._blurRings = value;
            this.shader = null;
        }
    }

    get blurRings() {
        return this._blurRings;
    }

    set blurRingPoints(value) {
        if (this._blurRingPoints !== value) {
            this._blurRingPoints = value;
            this.shader = null;
        }
    }

    get blurRingPoints() {
        return this._blurRingPoints;
    }

    createShader() {
        this.kernel = new Float32Array(Kernel.concentric(this.blurRings, this.blurRingPoints));
        const kernelCount = this.kernel.length >> 1;
        const nearBlur = this.nearTexture !== null;
        const shaderName = `DofBlurShader-${kernelCount}-${nearBlur ? 'nearBlur' : 'noNearBlur'}`;

        this.shader = this.createQuadShader(shaderName, /* glsl */`

            ${nearBlur ? '#define NEAR_BLUR' : ''}

            #if defined(NEAR_BLUR)
                uniform sampler2D nearTexture;
            #endif
            uniform sampler2D farTexture;
            uniform sampler2D cocTexture;
            uniform float blurRadiusNear;
            uniform float blurRadiusFar;
            uniform vec2 kernel[${kernelCount}];

            varying vec2 uv0;

            void main()
            {
                vec2 coc = texture2D(cocTexture, uv0).rg;
                float cocFar = coc.r;

                vec3 sum = vec3(0.0, 0.0, 0.0);

                #if defined(NEAR_BLUR)
                    // near blur
                    float cocNear = coc.g;
                    if (cocNear > 0.0001) {

                        ivec2 nearTextureSize = textureSize(nearTexture, 0);
                        vec2 step = cocNear * blurRadiusNear / vec2(nearTextureSize);

                        for (int i = 0; i < ${kernelCount}; i++) {
                            vec2 uv = uv0 + step * kernel[i];
                            vec3 tap = texture2DLod(nearTexture, uv, 0.0).rgb;
                            sum += tap.rgb;
                        }

                        sum *= ${1.0 / kernelCount};

                    } else
                #endif
                    
                    if (cocFar > 0.0001) { // far blur

                    ivec2 farTextureSize = textureSize(farTexture, 0);
                    vec2 step = cocFar * blurRadiusFar / vec2(farTextureSize);

                    float sumCoC = 0.0; 
                    for (int i = 0; i < ${kernelCount}; i++) {
                        vec2 uv = uv0 + step * kernel[i];
                        vec3 tap = texture2DLod(farTexture, uv, 0.0).rgb;

                        // block out sharp objects to avoid leaking to far blur
                        float cocThis = texture2DLod(cocTexture, uv, 0.0).r;
                        tap *= cocThis;
                        sumCoC += cocThis;

                        sum += tap.rgb;
                    }

                    // average out the sum
                    if (sumCoC > 0.0)
                        sum /= sumCoC;

                    // compensate for the fact the farTexture was premultiplied by CoC
                    sum /= cocFar;
                }

                pcFragColor0 = vec4(sum, 1.0);
            }`
        );
    }

    execute() {

        if (!this.shader) {
            this.createShader();
        }

        this.nearTextureId.setValue(this.nearTexture);
        this.farTextureId.setValue(this.farTexture);
        this.cocTextureId.setValue(this.cocTexture);

        this.kernelId.setValue(this.kernel);
        this.kernelCountId.setValue(this.kernel.length >> 1);
        this.blurRadiusNearId.setValue(this.blurRadiusNear);
        this.blurRadiusFarId.setValue(this.blurRadiusFar);

        super.execute();
    }
}

export { RenderPassDofBlur };
