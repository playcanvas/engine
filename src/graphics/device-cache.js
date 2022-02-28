/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * A cache storing shared resources associated with a device. The resources are removed
 * from the cache when the device is destroyed.
 *
 * @ignore
 */
class DeviceCache {
    data = null;

    /** @type {Map<GraphicsDevice, DeviceCache} */
    _cache = new Map();

    /** Destroys data, called when the device is destroyed */
    destroy() {
        this.data?.destroy();
        this.data = null;
    }

    /**
     * Returns instance of a class containing resources for supplied device.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {DeviceCache} The resources for the device.
     */
    getCache(device, onCreate) {
        let entry = this._cache.get(device);

        // if no entry for the device, create it
        if (!entry) {
            entry = new DeviceCache();
            this._cache.set(device, entry);

            if (!entry.data && onCreate) {
                entry.data = onCreate();
            }

            // when the device is destroyed, destroy and remove its entry
            device.on('destroy', () => {
                entry.destroy();
                this._cache.delete(device);
            });
        }

        return entry;
    }
}

export { DeviceCache };
