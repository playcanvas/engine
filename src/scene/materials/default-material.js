import { Debug } from '../../core/debug.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { StandardMaterial } from './standard-material.js'
 */

// device cache storing default material
const defaultMaterialDeviceCache = new DeviceCache();

/**
 * Returns default material, which is a material used instead of null material.
 *
 * @param {GraphicsDevice} device - The graphics device used to own the material.
 * @returns {StandardMaterial} The default instance of {@link StandardMaterial}.
 */
function getDefaultMaterial(device) {
    const material = defaultMaterialDeviceCache.get(device);
    Debug.assert(material);
    return material;
}

/**
 * Assigns the default material to device cache
 *
 * @param {GraphicsDevice} device - The graphics device used to own the material.
 * @param {StandardMaterial} material - The instance of {@link StandardMaterial}.
 */
function setDefaultMaterial(device, material) {
    Debug.assert(material);
    defaultMaterialDeviceCache.get(device, () => {
        return material;
    });
}

export { setDefaultMaterial, getDefaultMaterial };
