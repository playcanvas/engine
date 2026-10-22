import { DeviceCache } from '../../../platform/graphics/device-cache.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { ICON_GLYPHS } from './icon-glyphs.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { OverlayIcon } from './icon-glyphs.js'
 */

// the pixels per css pixel of the glyphs, enough for high dpi screens
const ICON_SCALE = 4;

const deviceCache = new DeviceCache();

/**
 * Gets the textures of the icon glyphs on a device, created once and shared. Each texture is
 * blank until its glyph decodes.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {Record<OverlayIcon, Texture>} The textures.
 */
const getIconTextures = device => deviceCache.get(device, () => {
    const textures = /** @type {Record<OverlayIcon, Texture>} */ ({});
    for (const [kind, content] of Object.entries(ICON_GLYPHS)) {
        const image = new Image();
        const size = 24 * ICON_SCALE;
        const texture = new Texture(device, {
            name: `gizmo-icon-${kind}`,
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            mipmaps: true,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        image.onload = () => {
            if (texture.device) {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = size;
                canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
                texture.setSource(canvas);
            }
        };
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24" fill="none" stroke="white" stroke-width="1.6">${content}</svg>`;
        image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        textures[/** @type {OverlayIcon} */ (kind)] = texture;
    }
    return {
        textures,
        destroy: () => Object.values(textures).forEach(texture => texture.destroy())
    };
}).textures;

export { getIconTextures };
