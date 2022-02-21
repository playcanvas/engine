/** @typedef {import('../scene/materials/material.js').Material} Material */
/** @typedef {import('./texture.js').Texture} Texture */
/** @typedef {import('./vertex-buffer.js').VertexBuffer} VertexBuffer */
/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

/**
 * A cache storing shared resources associated with a device. The resources are removed
 * from the cache when the device is destroyed.
 *
 * @ignore
 */
class DeviceResourceCache {
    /**
     * An instance of a material which is used when a material is missing.
     *
     * @type {Material}
     */
    defaultMaterial;

    /**
     * An instance of a default parameter texture used by the particle emitter.
     *
     * @type {Texture}
     */
    particleEmitterDefaultParamTexture;

    /**
     * Vertex buffer containing a quad mesh used by post-effects.
     *
     * @type {VertexBuffer}
     */
    postEffectQuadVB;

    /** Textures created by reproject-texture module */
    reprojectTextureCache;

    /** @type {Map<GraphicsDevice, DeviceResourceCache} */
    static _cache = new Map();

    /** Delete resources, called when the device is destroyed */
    destroy() {
        this.defaultMaterial?.destroy();
        this.defaultMaterial = null;

        this.particleEmitterDefaultParamTexture?.destroy();
        this.particleEmitterDefaultParamTexture = null;

        this.postEffectQuadVB?.destroy();
        this.postEffectQuadVB = null;

        this.reprojectTextureCache?.destroy();
        this.reprojectTextureCache = null;
    }

    /**
     * Returns instance of a class containing resources for supplied device.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {DeviceResourceCache} The resources for the device.
     */
    static get(device) {
        let entry = this._cache.get(device);

        // if no entry for the device, create it
        if (!entry) {
            entry = new DeviceResourceCache();
            this._cache.set(device, entry);

            // when the device is destroyed, destroy and remove its entry
            device.on('destroy', () => {
                entry.destroy();
                this._cache.delete(device);
            });
        }

        return entry;
    }
}

export { DeviceResourceCache };
