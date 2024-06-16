import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { BLUR_GAUSSIAN } from '../../scene/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { shaderChunks } from '../../scene/shader-lib/chunks/chunks.js';

const sourceInvResolutionValueTmp = new Float32Array(2);

const fragmentShader = shaderChunks.screenDepthPS + /* glsl */`

varying vec2 uv0;

uniform sampler2D sourceTexture;
uniform vec2 sourceInvResolution;
uniform int filterSize;
uniform vec2 direction;
uniform float kernel[KERNEL_SIZE];

float random(const highp vec2 w) {
    const vec3 m = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(m.z * fract(dot(w, m.xy)));
}

float bilateralWeight(in float depth, in float sampleDepth) {
    float diff = (sampleDepth - depth);
    return max(0.0, 1.0 - diff * diff);
}

void tap(inout float sum, inout float totalWeight, float weight, float depth, vec2 position) {

    float color = texture2D(sourceTexture, position).r;

    float textureDepth = -getLinearScreenDepth(position);

    float bilateral = bilateralWeight(depth, textureDepth);

    bilateral *= weight;

    sum += color * bilateral;
    totalWeight += bilateral;
}

int middle = (KERNEL_SIZE + 1) / 2;

void main() {
    float depth = -getLinearScreenDepth(uv0);

    float sum = texture2D(sourceTexture, uv0).r * kernel[middle];
    float totalWeight = kernel[middle];

    #pragma unroll
    for (int i = 1; i < middle; i++) {
        tap(sum, totalWeight, kernel[middle + i], depth, uv0 + float(i) * direction * sourceInvResolution);
        tap(sum, totalWeight, kernel[middle - i], depth, uv0 - float(i) * direction * sourceInvResolution);
    }

    float finalColor = sum / totalWeight;

    // simple dithering helps a lot (assumes 8 bits target)
    // this is most useful with high quality/large blurs
    // finalColor += ((random(gl_FragCoord.xy) - 0.5) / 255.0);

    gl_FragColor.r = finalColor;
}
`;

/**
 * Render pass implementation of a depth-aware bilateral blur filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDepthAwareBlur extends RenderPassShaderQuad {
    _direction = new Float32Array(2);

    /**
     * Initializes a new blur render pass. It has to be called before the render pass can be used.
     *
     * @param {Object} options - Options for configuring the blur effect.
     * @param {import('../../platform/graphics/texture.js').Texture} [options.sourceTexture] - The source texture to be blurred.
     * @param {number} [options.kernelSize] - The size of the blur kernel. Defaults to 7.
     * @param {BLUR_GAUSSIAN|import('../../scene/constants.js').BLUR_BOX} [options.type] - The type of blur to apply. Defaults to BLUR_GAUSSIAN.
     * @param {Vec2} [options.direction] - The direction of the blur. Defaults to (1, 0).
     */
    setup(options) {
        this.sourceTexture = options.sourceTexture;

        this.direction = options.direction ?? new Vec2(1, 0);
        this.kernelSize = options.kernelSize ?? 9;
        this.type = options.type ?? BLUR_GAUSSIAN;

        var scope = this.device.scope;

        this.sourceTextureId = scope.resolve('sourceTexture');
        this.sourceInvResolutionId = scope.resolve('sourceInvResolution');
        this.kernelId = scope.resolve('kernel[0]');
        this.directionId = scope.resolve('direction');
    }

    execute() {
        if (!this.sourceTexture) {
            super.execute();
            return;
        }

        const { width, height } = this.sourceTexture;
        sourceInvResolutionValueTmp[0] = 1.0 / width;
        sourceInvResolutionValueTmp[1] = 1.0 / height;

        this.sourceInvResolutionId?.setValue(sourceInvResolutionValueTmp);
        this.sourceTextureId?.setValue(this.sourceTexture);
        this.kernelId?.setValue(this.kernelValue);
        this.directionId?.setValue(this.direction);

        super.execute();
    }

    /**
     * @param {BLUR_GAUSSIAN|import('../../scene/constants.js').BLUR_BOX} value - The type of blur to apply.
     */
    set type(value) {
        if (value === this._type) {
            return;
        }

        this._type = value;

        this.updateWeightCoefs();
    }

    get type() {
        return this._type;
    }

    set kernelSize(value) {
        if (value === this._kernelSize) {
            return;
        }

        this._kernelSize = Math.max(1, Math.floor(value));

        this.updateShader();

        this.updateWeightCoefs();
    }

    /**
     * @type {number}
     */
    get kernelSize() {
        return this._kernelSize;
    }

    /**
     * Sets the direction of the blur.
     * @param {Vec2|Float32Array|Float64Array} value - The direction of the blur.
     */
    set direction(value) {
        if (value instanceof Vec2) {
            this._direction.set([value.x, value.y]);
        } else {
            this._direction.set(value);
        }
    }

    /**
     * @type {Float32Array}
     */
    get direction() {
        return this._direction;
    }

    updateShader() {
        const shaderName = `BlurShader-kernelsize-${this.kernelSize}`;

        const defines = `#define KERNEL_SIZE ${this.kernelSize}\n`;

        // CHECK: should we destroy the shader?
        // But `(property) RenderPassShaderQuad.shader: null`, so we can't call `destroy` on it
        // this.shader.destroy();

        this.shader = this.createQuadShader(shaderName, defines + fragmentShader);
    }

    updateWeightCoefs() {
        if (this.kernelSize !== this.kernelValue?.length) {
            this.kernelValue = new Float32Array(this.kernelSize);
        }

        if (this._type === BLUR_GAUSSIAN) {
            math.gaussWeights(this.kernelSize, this.kernelValue);
        } else {
            this.kernelValue.fill(1);
        }
    }
}

export { RenderPassDepthAwareBlur };
