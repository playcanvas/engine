import { Vec2 } from '../../core/math/vec2.js';
import {
    PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32U
} from '../../platform/graphics/constants.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';
import { GSplatFormat } from './gsplat-format.js';

/**
 * @import { GSplatCompressedData } from './gsplat-compressed-data.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../platform/graphics/texture.js';
 */

// copy data with padding
const strideCopy = (target, targetStride, src, srcStride, numEntries) => {
    for (let i = 0; i < numEntries; ++i) {
        for (let j = 0; j < srcStride; ++j) {
            target[i * targetStride + j] = src[i * srcStride + j];
        }
    }
};

class GSplatCompressedResource extends GSplatResourceBase {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatCompressedData} gsplatData - The splat data.
     */
    constructor(device, gsplatData) {
        super(device, gsplatData);

        const { chunkData, chunkSize, numChunks, numSplats, vertexData, shBands } = gsplatData;

        this.chunks = new Float32Array(numChunks * 6);
        gsplatData.getChunks(this.chunks);

        // initialize packed data
        const packedSize = this.evalTextureSize(numSplats);
        this.textureSize = packedSize.x;
        this.textures.set('packedTexture', this.createTexture('packedTexture', PIXELFORMAT_RGBA32U, packedSize, vertexData));

        // initialize chunk data
        const chunkTextureSize = this.evalTextureSize(numChunks);
        chunkTextureSize.x *= 5;

        const chunkTexture = this.createTexture('chunkTexture', PIXELFORMAT_RGBA32F, chunkTextureSize);
        this.textures.set('chunkTexture', chunkTexture);
        const chunkTextureData = chunkTexture.lock();
        strideCopy(chunkTextureData, 20, chunkData, chunkSize, numChunks);

        if (chunkSize === 12) {
            // if the chunks don't contain color min/max values we must update max to 1 (min is filled with 0's)
            for (let i = 0; i < numChunks; ++i) {
                chunkTextureData[i * 20 + 15] = 1;
                chunkTextureData[i * 20 + 16] = 1;
                chunkTextureData[i * 20 + 17] = 1;
            }
        }

        chunkTexture.unlock();

        // load optional spherical harmonics data
        if (shBands > 0) {
            const size = this.evalTextureSize(numSplats);
            this.textures.set('shTexture0', this.createTexture('shTexture0', PIXELFORMAT_RGBA32U, size, new Uint32Array(gsplatData.shData0.buffer)));
            this.textures.set('shTexture1', this.createTexture('shTexture1', PIXELFORMAT_RGBA32U, size, new Uint32Array(gsplatData.shData1.buffer)));
            this.textures.set('shTexture2', this.createTexture('shTexture2', PIXELFORMAT_RGBA32U, size, new Uint32Array(gsplatData.shData2.buffer)));
        }

        // Define streams for textures that use splatUV (chunkTexture is manual - uses custom UV)
        const streams = [
            { name: 'packedTexture', format: PIXELFORMAT_RGBA32U }
        ];

        // Create format with streams and shader chunk include
        this.format = new GSplatFormat(device, streams, {
            readGLSL: '#include "gsplatCompressedVS"',
            readWGSL: '#include "gsplatCompressedVS"'
        });
    }

    destroy() {
        for (const texture of this.textures.values()) {
            texture.destroy();
        }
        this.textures.clear();
        super.destroy();
    }

    configureMaterialDefines(defines) {
        defines.set('SH_BANDS', this.textures.has('shTexture0') ? 3 : 0);
    }

    /**
     * Evaluates the texture size needed to store a given number of elements.
     * The function calculates a width and height that is close to a square
     * that can contain 'count' elements.
     *
     * @param {number} count - The number of elements to store in the texture.
     * @returns {Vec2} The width and height of the texture.
     */
    evalTextureSize(count) {
        const width = Math.ceil(Math.sqrt(count));
        const height = Math.ceil(count / width);
        return new Vec2(width, height);
    }
}

export { GSplatCompressedResource };
