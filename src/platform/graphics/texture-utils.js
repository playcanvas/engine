import { Debug } from '../../core/debug.js';
import {
    pixelFormatInfo,
    PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1
} from './constants.js';

/**
 * A class providing utility functions for textures.
 *
 * @ignore
 */
class TextureUtils {
    /**
     * Calculate the dimension of a texture at a specific mip level.
     *
     * @param {number} dimension - Texture dimension at level 0.
     * @param {number} mipLevel - Mip level.
     * @returns {number} The dimension of the texture at the specified mip level.
     */
    static calcLevelDimension(dimension, mipLevel) {
        return Math.max(dimension >> mipLevel, 1);
    }

    /**
     * Calculate the number of mip levels for a texture with the specified dimensions.
     *
     * @param {number} width - Texture's width.
     * @param {number} height - Texture's height.
     * @param {number} [depth] - Texture's depth layers. Defaults to 1.
     * @returns {number} The number of mip levels required for the texture.
     */
    static calcMipLevelsCount(width, height, depth = 1) {
        return 1 + Math.floor(Math.log2(Math.max(width, height, depth)));
    }

    /**
     * Calculate the size in bytes of the texture level given its format and dimensions.
     *
     * @param {number} width - Texture's width.
     * @param {number} height - Texture's height.
     * @param {number} depth - Texture's depth layers.
     * @param {number} format - Texture's pixel format PIXELFORMAT_***.
     * @returns {number} The number of bytes of GPU memory required for the texture.
     * @ignore
     */
    static calcLevelGpuSize(width, height, depth, format) {

        const formatInfo = pixelFormatInfo.get(format);
        Debug.assert(formatInfo !== undefined, `Invalid pixel format ${format}`);

        const pixelSize = pixelFormatInfo.get(format)?.size ?? 0;
        if (pixelSize > 0) {
            return width * height * depth * pixelSize;
        }

        const blockSize = formatInfo.blockSize ?? 0;
        let blockWidth = Math.floor((width + 3) / 4);
        const blockHeight = Math.floor((height + 3) / 4);
        const blockDepth = Math.floor((depth + 3) / 4);

        if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 ||
            format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
            blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
        }

        return blockWidth * blockHeight * blockDepth * blockSize;
    }

    /**
     * Calculate the GPU memory required for a texture.
     *
     * @param {number} width - Texture's width.
     * @param {number} height - Texture's height.
     * @param {number} layers - Texture's layers.
     * @param {number} format - Texture's pixel format PIXELFORMAT_***.
     * @param {boolean} isVolume - True if the texture is a volume texture, false otherwise.
     * @param {boolean} mipmaps - True if the texture includes mipmaps, false otherwise.
     * @returns {number} The number of bytes of GPU memory required for the texture.
     * @ignore
     */
    static calcGpuSize(width, height, layers, format, isVolume, mipmaps) {
        let result = 0;
        let depth = isVolume ? layers : 1;

        while (1) {
            result += TextureUtils.calcLevelGpuSize(width, height, depth, format);

            // we're done if mipmaps aren't required or we've calculated the smallest mipmap level
            if (!mipmaps || ((width === 1) && (height === 1) && (depth === 1))) {
                break;
            }
            width = Math.max(width >> 1, 1);
            height = Math.max(height >> 1, 1);
            depth = Math.max(depth >> 1, 1);
        }

        return result * (isVolume ? 1 : layers);
    }
}

export { TextureUtils };
