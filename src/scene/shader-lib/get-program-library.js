import { Debug } from '../../core/debug.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

// Device cache storing a program library
const programLibraryDeviceCache = new DeviceCache();

/**
 * Returns program library for a specified instance of a device.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device used to own the program library.
 * @returns {import('./program-library.js').ProgramLibrary} The instance of {@link ProgramLibrary}
 * @ignore
 */
function getProgramLibrary(device) {
    const library = programLibraryDeviceCache.get(device);
    Debug.assert(library);
    return library;
}

/**
 * Assigns the program library to device cache.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device used to own the program library.
 * @param {import('./program-library.js').ProgramLibrary} library - The instance of
 * {@link ProgramLibrary}.
 * @ignore
 */
function setProgramLibrary(device, library) {
    Debug.assert(library);
    programLibraryDeviceCache.get(device, () => {
        return library;
    });
}

export { getProgramLibrary, setProgramLibrary };
