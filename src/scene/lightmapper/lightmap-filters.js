import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';

// size of the kernel - needs to match the constant in the shader
const DENOISE_FILTER_SIZE = 15;

// helper class used by lightmapper, wrapping functionality of dilate and denoise shaders
class LightmapFilters {
    constructor(device) {
        this.device = device;
        this.shaderDilate = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.dilatePS, "lmDilate");

        this.constantTexSource = device.scope.resolve("source");

        this.constantPixelOffset = device.scope.resolve("pixelOffset");
        this.pixelOffset = new Float32Array(2);

        // denoise is optional and gets created only when needed
        this.shaderDenoise = null;
        this.sigmas = null;
        this.constantSigmas = null;
        this.kernel = null;
    }

    setSourceTexture(texture) {
        this.constantTexSource.setValue(texture);
    }

    prepare(textureWidth, textureHeight) {

        // inverse texture size
        this.pixelOffset[0] = 1 / textureWidth;
        this.pixelOffset[1] = 1 / textureHeight;
        this.constantPixelOffset.setValue(this.pixelOffset);
    }

    prepareDenoise(filterRange, filterSmoothness) {

        if (!this.shaderDenoise) {
            this.shaderDenoise = createShaderFromCode(this.device, shaderChunks.fullscreenQuadVS, shaderChunks.bilateralDeNoisePS, "lmBilateralDeNoise");
            this.sigmas = new Float32Array(2);
            this.constantSigmas = this.device.scope.resolve("sigmas");
            this.constantKernel = this.device.scope.resolve("kernel[0]");
            this.bZnorm = this.device.scope.resolve("bZnorm");
        }

        this.sigmas[0] = filterRange;
        this.sigmas[1] = filterSmoothness;
        this.constantSigmas.setValue(this.sigmas);

        this.evaluateDenoiseUniforms(filterRange, filterSmoothness);
    }

    evaluateDenoiseUniforms(filterRange, filterSmoothness) {

        function normpdf(x, sigma) {
            return 0.39894 * Math.exp(-0.5 * x * x / (sigma * sigma)) / sigma;
        }

        // kernel
        this.kernel = this.kernel || new Float32Array(DENOISE_FILTER_SIZE);
        const kernel = this.kernel;
        const kSize = Math.floor((DENOISE_FILTER_SIZE - 1) / 2);
        for (let j = 0; j <= kSize; ++j) {
            const value = normpdf(j, filterRange);
            kernel[kSize + j] = value;
            kernel[kSize - j] = value;
        }
        this.constantKernel.setValue(this.kernel);

        const bZnorm = 1 / normpdf(0.0, filterSmoothness);
        this.bZnorm.setValue(bZnorm);
    }
}

export { LightmapFilters };
