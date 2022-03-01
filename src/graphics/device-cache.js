/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * A cache storing shared resources associated with a device. The resources are removed
 * from the cache when the device is destroyed.
 *
 * @ignore
 */
class DeviceCache {
    /**
     * Cache storing the resource for each GraphicsDevice
     *
     * @type {Map<GraphicsDevice, any}
     */
    _cache = new Map();

    /**
     * Returns the resources for the supplied device.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {any} The resource for the device.
     */
    get(device, onCreate) {
        let entry = this._cache.get(device);

        // if no entry for the device, create it
        if (!entry) {

            if (onCreate) {
                entry = onCreate();
            }
            this._cache.set(device, entry);

            // when the device is destroyed, destroy and remove its entry
            device.on('destroy', () => {
                this._cache.get(device)?.destroy();
                this._cache.delete(device);
            });
        }

        return entry;
    }
}

export { DeviceCache };
