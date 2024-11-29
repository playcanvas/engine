import { Vec2 } from '../../core/math/vec2.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32U
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { createGSplatCompressedMaterial } from './gsplat-compressed-material.js';

// copy data with padding
const strideCopy = (target, targetStride, src, srcStride, numEntries) => {
    for (let i = 0; i < numEntries; ++i) {
        for (let j = 0; j < srcStride; ++j) {
            target[i * targetStride + j] = src[i * srcStride + j];
        }
    }
};

/** @ignore */
class GSplatCompressed {
    device;

    numSplats;

    /** @type {import('../../core/shape/bounding-box.js').BoundingBox} */
    aabb;

    /** @type {Float32Array} */
    centers;

    /** @type {Texture} */
    packedTexture;

    /** @type {Texture} */
    chunkTexture;

    /** @type {Texture?} */
    shTexture0;

    /** @type {Texture?} */
    shTexture1;

    /** @type {Texture?} */
    shTexture2;

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {import('./gsplat-compressed-data.js').GSplatCompressedData} gsplatData - The splat data.
     */
    constructor(device, gsplatData) {
        const { chunkData, chunkSize, numChunks, numSplats, vertexData, shBands } = gsplatData;

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

        // load optional spherical harmonics data
        if (shBands > 0) {
            const { shData } = gsplatData;

            const size = this.evalTextureSize(numSplats);

            const texture0 = this.createTexture('shTexture0', PIXELFORMAT_RGBA32U, size);
            const texture1 = this.createTexture('shTexture1', PIXELFORMAT_RGBA32U, size);
            const texture2 = this.createTexture('shTexture2', PIXELFORMAT_RGBA32U, size);

            const data0 = texture0.lock();
            const data1 = texture1.lock();
            const data2 = texture2.lock();

            const target0 = new Uint8Array(data0.buffer);
            const target1 = new Uint8Array(data1.buffer);
            const target2 = new Uint8Array(data2.buffer);

            const srcCoeffs = [3, 8, 15][shBands - 1];

            for (let i = 0; i < numSplats; ++i) {
                for (let j = 0; j < srcCoeffs; ++j) {
                    target0[i * 16 + j] = shData[(i * 3 + 0) * srcCoeffs + j];
                    target1[i * 16 + j] = shData[(i * 3 + 1) * srcCoeffs + j];
                    target2[i * 16 + j] = shData[(i * 3 + 2) * srcCoeffs + j];
                }
            }

            texture0.unlock();
            texture1.unlock();
            texture2.unlock();

            this.shTexture0 = texture0;
            this.shTexture1 = texture1;
            this.shTexture2 = texture2;
        } else {
            this.shTexture0 = null;
            this.shTexture1 = null;
            this.shTexture2 = null;
        }
    }

    destroy() {
        this.packedTexture?.destroy();
        this.chunkTexture?.destroy();
        this.shTexture0?.destroy();
        this.shTexture1?.destroy();
        this.shTexture2?.destroy();
    }

    /**
     * @returns {import('../materials/material.js').Material} material - The material to set up for
     * the splat rendering.
     */
    createMaterial(options) {
        const hasSH = this.shTexture0 !== null;
        const result = createGSplatCompressedMaterial({
            ...(hasSH ? { defines: ['USE_SH'] } : { }),
            ...options
        });
        result.setParameter('packedTexture', this.packedTexture);
        result.setParameter('chunkTexture', this.chunkTexture);
        result.setParameter('tex_params', new Float32Array([this.numSplats, this.packedTexture.width, this.chunkTexture.width / 5, 0]));
        if (hasSH) {
            result.setParameter('shTexture0', this.shTexture0);
            result.setParameter('shTexture1', this.shTexture1);
            result.setParameter('shTexture2', this.shTexture2);
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
