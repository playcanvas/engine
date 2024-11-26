import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';

/**
 * Render pass implementation of a depth-aware bilateral blur filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDepthAwareBlur extends RenderPassShaderQuad {
    constructor(device, sourceTexture, cameraComponent, horizontal) {
        super(device);
        this.sourceTexture = sourceTexture;

        const screenDepth = ChunkUtils.getScreenDepthChunk(device, cameraComponent.shaderParams);
        this.shader = this.createQuadShader(`DepthAware${horizontal ? 'Horizontal' : 'Vertical'}BlurShader`,
            /* glsl */ `${screenDepth}

            ${horizontal ? '#define HORIZONTAL' : ''}

            varying vec2 uv0;

            uniform sampler2D sourceTexture;
            uniform vec2 sourceInvResolution;
            uniform int filterSize;

            float random(const highp vec2 w) {
                const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);
                return fract(m.z * fract(dot(w, m.xy)));
            }

            mediump float bilateralWeight(in mediump float depth, in mediump float sampleDepth) {
                mediump float diff = (sampleDepth - depth);
                return max(0.0, 1.0 - diff * diff);
            }

            void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {

                mediump float color = texture2D(sourceTexture, position).r;
                mediump float textureDepth = -getLinearScreenDepth(position);
            
                mediump float bilateral = bilateralWeight(depth, textureDepth);

                bilateral *= weight;
                sum += color * bilateral;
                totalWeight += bilateral;
            }

            // TODO: weights of 1 are used for all samples. Test with gaussian weights
            void main() {

                // handle the center pixel separately because it doesn't participate in bilateral filtering
                mediump float depth = -getLinearScreenDepth(uv0);
                mediump float totalWeight = 1.0;
                mediump float color = texture2D(sourceTexture, uv0 ).r;
                mediump float sum = color * totalWeight;

                for (mediump int i = -filterSize; i <= filterSize; i++) {
                    mediump float weight = 1.0;

                    #ifdef HORIZONTAL
                        vec2 offset = vec2(i, 0) * sourceInvResolution;
                    #else
                        vec2 offset = vec2(0, i) * sourceInvResolution;
                    #endif

                    tap(sum, totalWeight, weight, depth, uv0 + offset);
                }

                mediump float ao = sum / totalWeight;

                // simple dithering helps a lot (assumes 8 bits target)
                // this is most useful with high quality/large blurs
                // ao += ((random(gl_FragCoord.xy) - 0.5) / 255.0);

                gl_FragColor.r = ao;
            }
        `
        );

        const scope = this.device.scope;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.sourceInvResolutionId = scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
        this.filterSizeId = scope.resolve('filterSize');
    }

    execute() {

        this.filterSizeId.setValue(4);
        this.sourceTextureId.setValue(this.sourceTexture);

        const { width, height } = this.sourceTexture;
        this.sourceInvResolutionValue[0] = 1.0 / width;
        this.sourceInvResolutionValue[1] = 1.0 / height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        super.execute();
    }
}

export { RenderPassDepthAwareBlur };
