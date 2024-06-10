import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { BLUR_GAUSSIAN } from '../../scene/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';

/**
 * Render pass implementation of a depth-aware bilateral blur filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDepthAwareBlur extends RenderPassShaderQuad {
    /**
     * Initializes a new blur render pass. It has to be called before the render pass can be used.
     *
     * @param {import('../../platform/graphics/render-target.js').RenderTarget|null} [renderTarget] - The render
     * target to render into (output).
     * @param {Object} options - Options for configuring the blur effect.
     * @param {import('../../platform/graphics/texture.js').Texture} [options.resizeSource] - The source texture to be blurred.
     * @param {number} [options.scaleX] - The scale factor for the render target width. Defaults to 1.
     * @param {number} [options.scaleY] - The scale factor for the render target height. Defaults to 1.
     * @param {number} [options.kernelSize] - The size of the blur kernel. Defaults to 7.
     * @param {boolean} [options.depthAware] - Whether the blur should be depth-aware. Defaults to false.
     * @param {BLUR_GAUSSIAN|import('../../scene/constants.js').BLUR_BOX} [options.type] - The type of blur to apply. Defaults to BLUR_GAUSSIAN.
     * @param {Vec2} [options.direction] - The direction of the blur. Defaults to (1, 0).
     * @param {string} [options.channels] - The color channels to apply the blur to ('r'|'g'|'b'|'a'|'rg'|..|'ba'|'rgb'|'gba'|'rgba'). Defaults to 'rgba'.
     */
    init(renderTarget = null, options = {}) {
        super.init(renderTarget, options);

        this.sourceTexture = options.resizeSource;

        // FIXME: resizeSource has to be passed and it is not possible to define
        // the default value for resizeSource.
        // But the init function of RenderPass is defined as
        // init(renderTarget = null, options) { ... }
        // So, the option parameter has to be optional because it is passed after
        // renderTarget that is an optional parameter.
        if (this.sourceTexture === null) {
            console.error('RenderPassDepthAwareBlur: resizeSource is not set in the options.');
            return;
        }

        const kernelSize = options.kernelSize ?? 7;
        const depthAware = options.depthAware ?? false;
        const blurType = options.type ?? BLUR_GAUSSIAN;
        const blurDirection = options.direction ?? new Vec2(1, 0);
        const channels = options.channels ?? 'rgba';

        let loop = '';

        const weightCoefs =
            blurType === BLUR_GAUSSIAN ?
                math.gaussWeights(kernelSize) :
                new Array(kernelSize).fill(1);

        const kernelWidth = kernelSize / 2 | 0;
        const middle = kernelWidth + (1 - kernelSize % 2);

        loop += `
                sum += texture2D(sourceTexture, uv0).${channels} * ${weightCoefs[middle].toFixed(4)};
                totalWeight += ${weightCoefs[middle].toFixed(4)};`;

        // TODO: move calculating UV coordinates to the vertex shader and pass them as varying
        for (let i = 1; i <= kernelWidth; i++) {
            loop += `
                tap(sum,
                    totalWeight,
                    ${weightCoefs[i + middle].toFixed(4)},
                    depth,
                    uv0 + vec2(${(i *  blurDirection.x).toFixed(4)},${(i *  blurDirection.y).toFixed(4)}) * sourceInvResolution);
                tap(sum,
                    totalWeight,
                    ${weightCoefs[i + middle].toFixed(4)},
                    depth,
                    uv0 + vec2(${(-i *  blurDirection.x).toFixed(4)}, ${(-i *  blurDirection.y).toFixed(4)}) * sourceInvResolution);
            `;
        }

        const type = ["float", "vec2", "vec3", "vec4"][channels.length - 1];

        const shaderName = `BlurShader:${JSON.stringify({ kernelSize, depthAware, blurType, blurDirection, channels })}`;

        this.shader = this.createQuadShader(shaderName, shaderChunks.screenDepthPS + /* glsl */`

            varying vec2 uv0;

            uniform sampler2D sourceTexture;
            uniform vec2 sourceInvResolution;
            uniform int filterSize;

${depthAware ? '#define DEPTH_AWARE' : ''}

            float random(const highp vec2 w) {
                const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);
                return fract(m.z * fract(dot(w, m.xy)));
            }

            float bilateralWeight(in float depth, in float sampleDepth) {
                float diff = (sampleDepth - depth);
                return max(0.0, 1.0 - diff * diff);
            }

            void tap(inout ${type} sum, inout float totalWeight, float weight, float depth, vec2 position) {

                ${type} color = texture2D(sourceTexture, position).${channels};

#ifdef DEPTH_AWARE
                float textureDepth = -getLinearScreenDepth(position);

                float bilateral = bilateralWeight(depth, textureDepth);

                bilateral *= weight;

                sum += color * bilateral;
                totalWeight += bilateral;
#else
                sum += color * weight;
                totalWeight += weight;
#endif
            }

            void main() {
#ifdef DEPTH_AWARE
                float depth = -getLinearScreenDepth(uv0);
#else
                float depth = 0.0;
#endif
                float totalWeight = 0.0;
                ${type} sum = ${type}(0.0);

                ${loop}

                ${type} finalColor = sum / totalWeight;

                // simple dithering helps a lot (assumes 8 bits target)
                // this is most useful with high quality/large blurs
                // finalColor += ((random(gl_FragCoord.xy) - 0.5) / 255.0);

                gl_FragColor.${channels} = finalColor;
            }
        `
        );

        var scope = this.device.scope;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.sourceInvResolutionId = scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
    }

    execute() {
        if (!this.sourceTexture) {
            super.execute();
            return;
        }

        this.sourceTextureId.setValue(this.sourceTexture);

        const { width, height } = this.sourceTexture;
        this.sourceInvResolutionValue[0] = 1.0 / width;
        this.sourceInvResolutionValue[1] = 1.0 / height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        super.execute();
    }
}

export { RenderPassDepthAwareBlur };
