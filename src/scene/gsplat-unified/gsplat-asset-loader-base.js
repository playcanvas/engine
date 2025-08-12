import { Debug } from '../../core/debug.js';

/**
 * Base class for GSplat asset loaders. This provides the interface that all
 * GSplat asset loaders must implement.
 *
 * @category Asset
 */
class GSplatAssetLoaderBase {
    /**
     * Initiates loading of a gsplat asset. This is a fire-and-forget operation that starts
     * the loading process.
     *
     * @param {string} url - The URL of the gsplat file to load.
     * @abstract
     */
    load(url) {
        Debug.error('GSplatAssetLoaderBase#load: Not implemented');
    }

    /**
     * Unloads an asset that was previously loaded by this loader.
     *
     * @param {string} url - The URL of the asset to unload.
     * @abstract
     */
    unload(url) {
        Debug.error('GSplatAssetLoaderBase#unload: Not implemented');
    }

    /**
     * Gets the resource for a given URL if it has been loaded by this loader.
     *
     * @param {string} url - The URL of the asset to retrieve the resource from.
     * @returns {object|undefined} The loaded resource if found and loaded, undefined otherwise.
     * @abstract
     */
    getResource(url) {
        Debug.error('GSplatAssetLoaderBase#getResource: Not implemented');
    }
}

export { GSplatAssetLoaderBase };
