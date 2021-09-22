import { createShaderFromCode } from '../../graphics/program-lib/utils.js';
import { shaderChunks } from '../../graphics/program-lib/chunks/chunks.js';

class LightmapFilters {
    constructor(device) {
        this.device = device;
        this.shaderDilate = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.dilatePS, "lmDilate");

        this.constantTexSource = device.scope.resolve("source");

        this.constantPixelOffset = device.scope.resolve("pixelOffset");
        this.pixelOffset = new Float32Array(2);

        this.shaderDenoise = null;
        this.sigmas = null;
        this.constantSigmas = null;
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
        }

        this.sigmas[0] = filterRange;
        this.sigmas[1] = filterSmoothness;
        this.constantSigmas.setValue(this.sigmas);
    }
}

export { LightmapFilters };
