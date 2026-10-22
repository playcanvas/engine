import { DeviceCache } from '../../../platform/graphics/device-cache.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

// the texture size of an icon, 24 css pixels at 4 pixels each for high dpi screens
const ICON_TEXTURE_SIZE = 96;

const deviceCache = new DeviceCache();

/**
 * Gets the texture of an icon on a device, created once and shared. The texture is blank until
 * the SVG decodes.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} svg - The SVG markup of the icon.
 * @returns {Texture} The texture.
 */
const getIconTexture = (device, svg) => {
    const cache = deviceCache.get(device, () => {
        const textures = new Map();
        return {
            textures,
            destroy: () => {
                for (const texture of textures.values()) {
                    texture.destroy();
                }
            }
        };
    });

    let texture = cache.textures.get(svg);
    if (!texture) {
        const size = ICON_TEXTURE_SIZE;
        texture = new Texture(device, {
            name: 'gizmo-icon',
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        cache.textures.set(svg, texture);

        const image = new Image();
        image.onload = () => {
            if (texture.device) {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = size;
                canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
                texture.setSource(canvas);
            }
        };
        image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    return texture;
};

export { getIconTexture };
