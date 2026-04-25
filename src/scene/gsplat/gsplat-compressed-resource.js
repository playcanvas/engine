import { Vec2 } from '../../core/math/vec2.js';
import {
    PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32U
} from '../../platform/graphics/constants.js';
import { GSplatResourceBase } from './gsplat-resource-base.js';
import { GSplatFormat } from './gsplat-format.js';

/**
 * @import { GSplatCompressedData } from './gsplat-compressed-data.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
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

        // Define all streams upfront
        // Note: chunkTexture uses different size/UV so we handle it specially
        const formatStreams = [
            { name: 'packedTexture', format: PIXELFORMAT_RGBA32U }
        ];

        // Add SH streams if present
        if (shBands > 0) {
            formatStreams.push({ name: 'shTexture0', format: PIXELFORMAT_RGBA32U });
            formatStreams.push({ name: 'shTexture1', format: PIXELFORMAT_RGBA32U });
            formatStreams.push({ name: 'shTexture2', format: PIXELFORMAT_RGBA32U });
        }

        // Create format with streams and shader chunk include
        this._format = new GSplatFormat(device, formatStreams, {
            readGLSL: '#include "gsplatCompressedVS"',
            readWGSL: '#include "gsplatCompressedVS"'
        });

        // Let streams create textures from format
        this.streams.init(this.format, numSplats);

        // Initialize packed texture data
        const packedTexture = this.streams.getTexture('packedTexture');
        const packedData = packedTexture.lock();
        packedData.set(vertexData);
        packedTexture.unlock();

        // Initialize SH texture data if present
        if (shBands > 0) {
            const shTexture0 = this.streams.getTexture('shTexture0');
            const shTexture1 = this.streams.getTexture('shTexture1');
            const shTexture2 = this.streams.getTexture('shTexture2');

            const sh0Data = shTexture0.lock();
            sh0Data.set(new Uint32Array(gsplatData.shData0.buffer));
            shTexture0.unlock();

            const sh1Data = shTexture1.lock();
            sh1Data.set(new Uint32Array(gsplatData.shData1.buffer));
            shTexture1.unlock();

            const sh2Data = shTexture2.lock();
            sh2Data.set(new Uint32Array(gsplatData.shData2.buffer));
            shTexture2.unlock();
        }

        // Initialize chunk texture (uses different size - managed separately)
        const chunkTextureSize = this.evalChunkTextureSize(numChunks);

        const chunkTexture = this.streams.createTexture('chunkTexture', PIXELFORMAT_RGBA32F, chunkTextureSize);
        this.streams.textures.set('chunkTexture', chunkTexture);

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
    }

    destroy() {
        super.destroy();
    }

    configureMaterialDefines(defines) {
        defines.set('SH_BANDS', this.streams.textures.has('shTexture0') ? 3 : 0);
    }

    /**
     * Evaluates the texture size for chunk data.
     *
     * @param {number} numChunks - The number of chunks.
     * @returns {Vec2} The width and height of the texture.
     * @private
     */
    evalChunkTextureSize(numChunks) {
        const width = Math.ceil(Math.sqrt(numChunks));
        const height = Math.ceil(numChunks / width);
        return new Vec2(width * 5, height);
    }
}

export { GSplatCompressedResource };
