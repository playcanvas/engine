import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import { shaderChunks } from '../../scene/shader-lib/chunks-glsl/chunks.js';
import { shaderChunksWGSL } from '../../scene/shader-lib/chunks-wgsl/chunks-wgsl.js';
import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';

// size of the kernel - needs to match the constant in the shader
const DENOISE_FILTER_SIZE = 15;

// helper class used by lightmapper, wrapping functionality of dilate and denoise shaders
class LightmapFilters {
    shaderDilate = [];

    shaderDenoise = [];

    constructor(device) {
        this.device = device;

        this.constantTexSource = device.scope.resolve('source');

        this.constantPixelOffset = device.scope.resolve('pixelOffset');
        this.pixelOffset = new Float32Array(2);

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

    prepareDenoise(filterRange, filterSmoothness, bakeHDR) {

        const index = bakeHDR ? 0 : 1;
        if (!this.shaderDenoise[index]) {

            const defines = new Map();
            defines.set('{MSIZE}', 15);
            if (bakeHDR) defines.set('HDR', '');

            this.shaderDenoise[index] = ShaderUtils.createShader(this.device, {
                uniqueName: `lmBilateralDeNoise-${bakeHDR ? 'hdr' : 'rgbm'}`,
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexGLSL: shaderChunks.fullscreenQuadVS,
                vertexWGSL: shaderChunksWGSL.fullscreenQuadVS,
                fragmentGLSL: shaderChunks.bilateralDeNoisePS,
                fragmentWGSL: shaderChunksWGSL.bilateralDeNoisePS,
                fragmentDefines: defines
            });

            this.sigmas = new Float32Array(2);
            this.constantSigmas = this.device.scope.resolve('sigmas');
            this.constantKernel = this.device.scope.resolve('kernel[0]');
            this.bZnorm = this.device.scope.resolve('bZnorm');
        }

        this.sigmas[0] = filterRange;
        this.sigmas[1] = filterSmoothness;
        this.constantSigmas.setValue(this.sigmas);

        this.evaluateDenoiseUniforms(filterRange, filterSmoothness);
    }

    getDenoise(bakeHDR) {
        const index = bakeHDR ? 0 : 1;
        return this.shaderDenoise[index];
    }

    getDilate(device, bakeHDR) {
        const index = bakeHDR ? 0 : 1;
        if (!this.shaderDilate[index]) {
            const define = bakeHDR ? '#define HDR\n' : '';
            this.shaderDilate[index] = ShaderUtils.createShader(device, {
                uniqueName: `lmDilate-${bakeHDR ? 'hdr' : 'rgbm'}`,
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexGLSL: shaderChunks.fullscreenQuadVS,
                vertexWGSL: shaderChunksWGSL.fullscreenQuadVS,
                fragmentGLSL: define + shaderChunks.dilatePS,
                fragmentWGSL: define + shaderChunksWGSL.dilatePS
            });
        }
        return this.shaderDilate[index];
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
