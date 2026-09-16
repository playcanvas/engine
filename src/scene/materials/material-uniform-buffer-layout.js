import { Debug } from '../../core/debug.js';
import { BindGroupFormat, BindUniformBufferFormat } from '../../platform/graphics/bind-group-format.js';
import {
    SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, UNIFORM_BUFFER_DEFAULT_SLOT_NAME
} from '../../platform/graphics/constants.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { MaterialProperty } from './material-property.js'
 */

/**
 * The uniform buffer layout shared by all materials with the same typed properties: the format of
 * the uniform buffer and the format of the bind group holding that single buffer. Layouts are
 * created per device and cached by their key.
 *
 * @ignore
 */
class MaterialUniformBufferLayout {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} key - The layout key.
     * @param {MaterialProperty[]} properties - The properties, in layout order.
     */
    constructor(device, key, properties) {
        /**
         * The key of the layout, see {@link getMaterialLayoutKey}.
         *
         * @type {string}
         */
        this.key = key;

        /**
         * The format of the material uniform buffer.
         *
         * @type {UniformBufferFormat}
         */
        this.uniformBufferFormat = new UniformBufferFormat(device, properties.map((property) => {
            return new UniformFormat(property.uniformName, property.type, property.count);
        }), { pack: true });

        /**
         * The format of the bind group containing the material uniform buffer.
         *
         * @type {BindGroupFormat}
         */
        this.bindGroupFormat = new BindGroupFormat(device, [
            new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)
        ]);
    }

    destroy() {
        this.bindGroupFormat.destroy();
    }
}

/**
 * The layouts of one device, by key.
 *
 * @ignore
 */
class MaterialLayoutCache extends Map {
    destroy() {
        this.forEach(layout => layout.destroy());
        this.clear();
    }
}

const _layoutCache = new DeviceCache();

/**
 * Orders properties for the layout: by their layout key, so that the same set of properties
 * produces the same layout regardless of the order they were declared in.
 *
 * @param {MaterialProperty[]} properties - The properties.
 * @returns {MaterialProperty[]} The properties in layout order.
 */
const sortProperties = (properties) => {
    return properties.slice().sort((a, b) => (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)));
};

/**
 * Returns the key identifying the uniform buffer layout of a set of typed properties. The key
 * does not depend on the order of the properties.
 *
 * @param {MaterialProperty[]} properties - The properties.
 * @returns {string} The layout key.
 * @ignore
 */
const getMaterialLayoutKey = (properties) => {
    return sortProperties(properties).map(property => property.key).join(',');
};

/**
 * Gets the uniform buffer layout for a set of typed properties on a device, creating it on first
 * use. Materials with the same properties share one layout, whatever the order of the
 * properties.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {MaterialProperty[]} properties - The properties.
 * @returns {MaterialUniformBufferLayout} The layout.
 * @ignore
 */
const getMaterialLayout = (device, properties) => {
    const layouts = _layoutCache.get(device, () => new MaterialLayoutCache());
    const sorted = sortProperties(properties);
    const key = sorted.map(property => property.key).join(',');
    let layout = layouts.get(key);
    if (!layout) {
        Debug.assert(new Set(sorted.map(property => property.uniformName)).size === sorted.length,
            'Material properties must use unique uniform names.', sorted);
        layout = new MaterialUniformBufferLayout(device, key, sorted);
        layouts.set(key, layout);
    }
    return layout;
};

export { MaterialUniformBufferLayout, getMaterialLayoutKey, getMaterialLayout };
