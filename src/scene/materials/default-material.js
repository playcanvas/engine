import { DeviceCache } from '../../graphics/device-cache.js';

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
    return defaultMaterialDeviceCache.get(device);
}

/**
 * Assigns the default material to device cache
 *
 * @param {GraphicsDevice} device - The graphics device used to own the material.
 * @param {StandardMaterial} material - The instance of {@link StandardMaterial}
 * @ignore
 */
function setDefaultMaterial(device, material) {
    defaultMaterialDeviceCache.get(device, () => {
        return material;
    });
}

export { setDefaultMaterial, getDefaultMaterial };
