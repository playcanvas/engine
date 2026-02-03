import { DeviceCache } from '../../platform/graphics/device-cache.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GSplatResourceBase } from './gsplat-resource-base.js'
 */

/**
 * Manages deferred destruction of GSplat resources. When a resource is destroyed while
 * still in use (refCount > 0), it is queued here and destroyed later when safe.
 *
 * @ignore
 */
class GSplatResourceCleanup {
    /** @type {DeviceCache} */
    static _cache = new DeviceCache();

    /** @type {Set<GSplatResourceBase>} */
    _pendingDestroy = new Set();

    /**
     * Queue a resource for deferred destruction.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatResourceBase} resource - The resource to destroy later.
     */
    static queueDestroy(device, resource) {
        this._cache.get(device, () => new GSplatResourceCleanup())._pendingDestroy.add(resource);
    }

    /**
     * Process pending resource destructions for a device. Called by GSplatDirector.update().
     *
     * @param {GraphicsDevice} device - The graphics device.
     */
    static process(device) {
        const pending = this._cache.get(device, () => new GSplatResourceCleanup())._pendingDestroy;
        for (const resource of pending) {
            if (resource.refCount === 0) {
                resource._actualDestroy();
                pending.delete(resource);
            }
        }
    }

    /**
     * Called by DeviceCache when device is destroyed.
     * Just releases references - GPU resources are already gone.
     */
    destroy() {
        this._pendingDestroy.clear();
    }
}

export { GSplatResourceCleanup };
