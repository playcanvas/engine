import { Vec2 } from '../../core/math/vec2.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32U
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { createGSplatCompressedMaterial } from './gsplat-compressed-material.js';

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

    /**
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
     * @param {import('./gsplat-data.js').GSplatData} gsplatData - The splat data.
     */
    constructor(device, gsplatData) {
        const numSplats = gsplatData.numSplats;
        const numChunks = Math.ceil(numSplats / 256);

        this.device = device;
        this.numSplats = numSplats;

        // initialize aabb
        this.aabb = new BoundingBox();
        gsplatData.calcAabb(this.aabb);

        // initialize centers
        this.centers = new Float32Array(gsplatData.numSplats * 3);
        gsplatData.getCenters(this.centers);

        // initialize packed data
        this.packedTexture = this.createTexture('packedData', PIXELFORMAT_RGBA32U, this.evalTextureSize(numSplats));

        const position = gsplatData.getProp('packed_position');
        const rotation = gsplatData.getProp('packed_rotation');
        const scale = gsplatData.getProp('packed_scale');
        const color = gsplatData.getProp('packed_color');

        const packedData = this.packedTexture.lock();
        for (let i = 0; i < numSplats; ++i) {
            packedData[i * 4 + 0] = position[i];
            packedData[i * 4 + 1] = rotation[i];
            packedData[i * 4 + 2] = scale[i];
            packedData[i * 4 + 3] = color[i];
        }
        this.packedTexture.unlock();

        // initialize chunk data
        const chunkSize = this.evalTextureSize(numChunks);
        chunkSize.x *= 3;

        this.chunkTexture = this.createTexture('chunkData', PIXELFORMAT_RGBA32F, chunkSize);

        const minX = gsplatData.getProp('min_x', 'chunk');
        const minY = gsplatData.getProp('min_y', 'chunk');
        const minZ = gsplatData.getProp('min_z', 'chunk');
        const maxX = gsplatData.getProp('max_x', 'chunk');
        const maxY = gsplatData.getProp('max_y', 'chunk');
        const maxZ = gsplatData.getProp('max_z', 'chunk');
        const minScaleX = gsplatData.getProp('min_scale_x', 'chunk');
        const minScaleY = gsplatData.getProp('min_scale_y', 'chunk');
        const minScaleZ = gsplatData.getProp('min_scale_z', 'chunk');
        const maxScaleX = gsplatData.getProp('max_scale_x', 'chunk');
        const maxScaleY = gsplatData.getProp('max_scale_y', 'chunk');
        const maxScaleZ = gsplatData.getProp('max_scale_z', 'chunk');

        const chunkData = this.chunkTexture.lock();
        for (let i = 0; i < numChunks; ++i) {
            chunkData[i * 12 + 0] = minX[i];
            chunkData[i * 12 + 1] = minY[i];
            chunkData[i * 12 + 2] = minZ[i];
            chunkData[i * 12 + 3] = maxX[i];
            chunkData[i * 12 + 4] = maxY[i];
            chunkData[i * 12 + 5] = maxZ[i];
            chunkData[i * 12 + 6] = minScaleX[i];
            chunkData[i * 12 + 7] = minScaleY[i];
            chunkData[i * 12 + 8] = minScaleZ[i];
            chunkData[i * 12 + 9] = maxScaleX[i];
            chunkData[i * 12 + 10] = maxScaleY[i];
            chunkData[i * 12 + 11] = maxScaleZ[i];
        }
        this.chunkTexture.unlock();
    }

    destroy() {
        this.packedTexture?.destroy();
        this.chunkTexture?.destroy();
    }

    /**
     * @returns {import('../materials/material.js').Material} material - The material to set up for
     * the splat rendering.
     */
    createMaterial(options) {
        const result = createGSplatCompressedMaterial(options);
        result.setParameter('packedTexture', this.packedTexture);
        result.setParameter('chunkTexture', this.chunkTexture);
        result.setParameter('bufferWidths', new Float32Array([this.packedTexture.width, this.chunkTexture.width / 3, 0, 0]));
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
     * @returns {Texture} The created texture instance.
     */
    createTexture(name, format, size) {
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
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }
}

export { GSplatCompressed };
