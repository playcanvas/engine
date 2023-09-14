import { Debug } from '../../core/debug.mjs';

import { DeviceCache } from '../../platform/graphics/device-cache.mjs';

// device cache storing default material
const defaultMaterialDeviceCache = new DeviceCache();

/**
 * Returns default material, which is a material used instead of null material.
 *
 * @param {import('../../platform/graphics/graphics-device.mjs').GraphicsDevice} device - The
 * graphics device used to own the material.
 * @returns {import('./standard-material.mjs').StandardMaterial} The default instance of
 * {@link StandardMaterial}.
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
 * @param {import('../../platform/graphics/graphics-device.mjs').GraphicsDevice} device - The
 * graphics device used to own the material.
 * @param {import('./standard-material.mjs').StandardMaterial} material - The instance of
 * {@link StandardMaterial}.
 * @ignore
 */
function setDefaultMaterial(device, material) {
    Debug.assert(material);
    defaultMaterialDeviceCache.get(device, () => {
        return material;
    });
}

export { setDefaultMaterial, getDefaultMaterial };
