import { Debug } from '../../core/debug.js';
import { DeviceCache } from '../../graphics/device-cache.js';

/** @typedef {import('../../graphics/graphics-device.js').GraphicsDevice} GraphicsDevice */
/** @typedef {import('./standard-material.js').StandardMaterial} StandardMaterial */

// device cache storing default material
const defaultMaterialDeviceCache = new DeviceCache();

/**
 * Returns default material, which is a material used instad of null material.
 *
 * @param {GraphicsDevice} device - The graphics device used to own the material.
 * @returns {StandardMaterial} The default instance of {@link StandardMaterial}
 * @ignore
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
 * @param {StandardMaterial} material - The instance of {@link StandardMaterial}
 * @ignore
 */
function setDefaultMaterial(device, material) {
    Debug.assert(material);
    defaultMaterialDeviceCache.get(device, () => {
        return material;
    });
}

export { setDefaultMaterial, getDefaultMaterial };
