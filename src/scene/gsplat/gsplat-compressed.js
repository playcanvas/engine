import { Vec2 } from '../../core/math/vec2.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32U
} from '../../platform/graphics/constants.js';
import { createGSplatCompressedMaterial } from './gsplat-compressed-material.js';

/**
 * @import { GSplatCompressedData } from './gsplat-compressed-data.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Material } from '../materials/material.js'
 * @import { SplatMaterialOptions } from './gsplat-material.js'
 */

// copy data with padding
const strideCopy = (target, targetStride, src, srcStride, numEntries) => {
    for (let i = 0; i < numEntries; ++i) {
        for (let j = 0; j < srcStride; ++j) {
            target[i * targetStride + j] = src[i * srcStride + j];
        }
    }
};

class GSplatCompressed {
    device;

    numSplats;

    /** @type {BoundingBox} */
    aabb;

    /** @type {Float32Array} */
    centers;

    /** @type {Texture} */
    packedTexture;

    /** @type {Texture} */
    chunkTexture;

    /** @type {Texture?} */
    band1Texture;

    /** @type {Texture?} */
    band2Texture;

    /** @type {Texture?} */
    band3Texture;

    /** @type {Texture?} */
    packedSHTexture;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatCompressedData} gsplatData - The splat data.
     */
    constructor(device, gsplatData) {
        const { chunkData, chunkSize, numChunks, numSplats, vertexData } = gsplatData;

        this.device = device;
        this.numSplats = numSplats;

        // initialize aabb
        this.aabb = new BoundingBox();
        gsplatData.calcAabb(this.aabb);

        // initialize centers
        this.centers = new Float32Array(numSplats * 3);
        gsplatData.getCenters(this.centers);

        // initialize packed data
        this.packedTexture = this.createTexture('packedData', PIXELFORMAT_RGBA32U, this.evalTextureSize(numSplats), vertexData);

        // initialize chunk data
        const chunkTextureSize = this.evalTextureSize(numChunks);
        chunkTextureSize.x *= 5;

        this.chunkTexture = this.createTexture('chunkData', PIXELFORMAT_RGBA32F, chunkTextureSize);
        const chunkTextureData = this.chunkTexture.lock();
        strideCopy(chunkTextureData, 20, chunkData, chunkSize, numChunks);

        if (chunkSize === 12) {
            // if the chunks don't contain color min/max values we must update max to 1 (min is filled with 0's)
            for (let i = 0; i < numChunks; ++i) {
                chunkTextureData[i * 20 + 15] = 1;
                chunkTextureData[i * 20 + 16] = 1;
                chunkTextureData[i * 20 + 17] = 1;
            }
        }

        this.chunkTexture.unlock();

        if (gsplatData.hasSHData) {
            const { band1Data, band2Data, band3Data, packedSHData } = gsplatData;

            const calcDim = (numEntries) => {
                return new Vec2(2048, Math.ceil(numEntries / 1024));
            };

            // unpack the palette coefficients to align nicely to RGBA16F boundaries for ease of reading on gpu

            // band1 has max 2k entries, 3 coefficients each, 1 pixel per entry.
            const band1Size = band1Data.length / 3;
            this.band1Texture = this.createTexture('band1Palette', PIXELFORMAT_RGBA16F, new Vec2(band1Size, 1));
            strideCopy(this.band1Texture.lock(), 4, band1Data, 3, band1Size);

            // band2 has max 32k entries, 5 coefficients each, 2 pixels per entry.
            const band2Size = band2Data.length / 5;
            this.band2Texture = this.createTexture('band2Palette', PIXELFORMAT_RGBA16F, calcDim(band2Size));
            strideCopy(this.band2Texture.lock(), 8, band2Data, 5, band2Size);

            // band3 has max 128k entries, 7 coefficients each, 2 pixels per entry.
            const band3Size = band3Data.length / 7;
            this.band3Texture = this.createTexture('band3Palette', PIXELFORMAT_RGBA16F, calcDim(band3Size));
            strideCopy(this.band3Texture.lock(), 8, band3Data, 7, band3Size);

            // packed SH data is loaded directly
            this.packedSHTexture = this.createTexture('packedSHData', PIXELFORMAT_RGBA32U, this.evalTextureSize(numSplats), packedSHData);

            this.band1Texture.unlock();
            this.band2Texture.unlock();
            this.band3Texture.unlock();
        } else {
            this.band1Texture = null;
            this.band2Texture = null;
            this.band3Texture = null;
            this.packedSHTexture = null;
        }
    }

    destroy() {
        this.packedTexture?.destroy();
        this.chunkTexture?.destroy();
    }

    /**
     * @param {SplatMaterialOptions} options - The splat material options.
     * @returns {Material} material - The material to set up for the splat rendering.
     */
    createMaterial(options) {
        const result = createGSplatCompressedMaterial(options);
        result.setParameter('packedTexture', this.packedTexture);
        result.setParameter('chunkTexture', this.chunkTexture);
        result.setParameter('tex_params', new Float32Array([this.numSplats, this.packedTexture.width, this.chunkTexture.width / 5, 0]));
        if (this.packedSHTexture) {
            result.setDefine('USE_SH', true);
            result.setParameter('band1Texture', this.band1Texture);
            result.setParameter('band2Texture', this.band2Texture);
            result.setParameter('band3Texture', this.band3Texture);
            result.setParameter('packedSHTexture', this.packedSHTexture);
        }
        return result;
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

    /**
     * Creates a new texture with the specified parameters.
     *
     * @param {string} name - The name of the texture to be created.
     * @param {number} format - The pixel format of the texture.
     * @param {Vec2} size - The width and height of the texture.
     * @param {Uint8Array|Uint16Array|Uint32Array} [data] - The initial data to fill the texture with.
     * @returns {Texture} The created texture instance.
     */
    createTexture(name, format, size, data) {
        return new Texture(this.device, {
            name: name,
            width: size.x,
            height: size.y,
            format: format,
            cubemap: false,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            ...(data ? { levels: [data] } : { })
        });
    }
}

export { GSplatCompressed };
