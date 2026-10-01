import { BindGroupFormat, BindUniformBufferFormat } from './bind-group-format.js';
import { SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import { DeviceCache } from './device-cache.js';

/**
 * @import { BindTextureFormat } from './bind-group-format.js'
 * @import { GraphicsDevice } from './graphics-device.js'
 */

/**
 * The view bind group formats of one device, by key. They are shared by all shaders declaring the
 * same view textures, and live as long as the device, as the renderer keeps bind groups of them
 * past the lifetime of any one shader.
 *
 * @ignore
 */
class ViewBindGroupFormatCache extends Map {
    destroy() {
        this.forEach(format => format.destroy());
        this.clear();
    }
}

const _formatCache = new DeviceCache();

const byName = (a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));

/**
 * Returns the format of a view bind group: the view uniform buffer at binding 0, followed by the
 * textures. The textures are ordered by name, so shaders declaring the same textures in any order
 * share one format - and so one bind group per pass.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {BindTextureFormat[]} textureFormats - The formats of the textures, which are sorted in
 * place. When a matching format is cached, they are not used.
 * @returns {BindGroupFormat} The shared format.
 * @ignore
 */
const getViewBindGroupFormat = (device, textureFormats) => {
    textureFormats.sort(byName);
    const formats = [
        new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT),
        ...textureFormats
    ];

    // the slots follow from the order and the samplers, which the resource keys include
    const key = formats.map(format => format.key).join(',');

    const cache = _formatCache.get(device, () => new ViewBindGroupFormatCache());
    let format = cache.get(key);
    if (!format) {
        format = new BindGroupFormat(device, formats);
        cache.set(key, format);
    }
    return format;
};

export { getViewBindGroupFormat };
