/**
 * @import { GraphicsDevice } from './graphics-device.js'
 */

import { Debug } from '../../core/debug.js';

/**
 * A cache storing shared resources associated with a device. The resources are removed
 * from the cache when the device is destroyed.
 */
class DeviceCache {
    /**
     * Cache storing the resource for each GraphicsDevice
     *
     * @type {Map<string, any>}
     */
    _cache = new Map();

    /**
     * Returns the resources for the supplied device.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {() => any} onCreate - A function that creates the resource for the device.
     * @returns {any} The resource for the device.
     */
    get(device, onCreate) {
        const cacheId = device?.canvas.id
        // Check if the device has a canvas, and if the canvas has a non null id
        Debug.assert(cacheId, 'Canvas element should have a unique id')

        if (!this._cache.has(cacheId)) {
            Debug.assert(onCreate, 'No cached device has been found and create callback is invalid ')
            this._cache.set(cacheId, onCreate());

            // when the device is destroyed, destroy and remove its entry
            device.on('destroy', () => {
                this.remove(device);
            });

            // when the context is lost, call optional loseContext on its entry
            device.on('devicelost', () => {
                this._cache.get(cacheId)?.loseContext?.(device);
            });
        }

        return this._cache.get(cacheId);
    }

    /**
     * Destroys and removes the content of the cache associated with the device
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    remove(device) {
        const cacheId = device?.canvas.id
        this._cache.get(cacheId)?.destroy?.(device);
        this._cache.delete(cacheId);
    }
}

export { DeviceCache };
