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
     * @type {Map<import('./graphics-device.js').GraphicsDevice, any>}
     */
    _cache = new Map();

    /**
     * Returns the resources for the supplied device.
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     * @returns {any} The resource for the device.
     */
    get(device, onCreate) {

        if (!this._cache.has(device)) {
            this._cache.set(device, onCreate());

            // when the device is destroyed, destroy and remove its entry
            device.on('destroy', () => {
                this.remove(device);
            });

            // when the context is lost, call optional loseContext on its entry
            device.on('devicelost', () => {
                this._cache.get(device)?.loseContext?.(device);
            });
        }

        return this._cache.get(device);
    }

    /**
     * Destroys and removes the content of the cache associated with the device
     *
     * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
     */
    remove(device) {
        this._cache.get(device)?.destroy?.(device);
        this._cache.delete(device);
    }
}

export { DeviceCache };
