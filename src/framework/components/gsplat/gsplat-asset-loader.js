import { Debug } from '../../../core/debug.js';
import { Asset } from '../../asset/asset.js';
import { GSplatAssetLoaderBase } from '../../../scene/gsplat-unified/gsplat-asset-loader-base.js';

/**
 * @import { AssetRegistry } from '../../asset/asset-registry.js'
 */

/**
 * A utility class for programmatically loading and unloading gsplat resources. This class provides
 * a simple interface for loading gsplat assets dynamically and manages their lifecycle, including
 * keeping track of loaded assets for efficient unloading.
 *
 * @category Asset
 * @ignore
 */
class GSplatAssetLoader extends GSplatAssetLoaderBase {
    /**
     * Map of URL to Asset instances that this loader has created.
     *
     * @type {Map<string, Asset>}
     * @private
     */
    _urlToAsset = new Map();

    /**
     * The asset registry to use for loading assets.
     *
     * @type {AssetRegistry}
     * @private
     */
    _registry;

    /**
     * Create a new GSplatAssetLoader.
     *
     * @param {AssetRegistry} registry - The asset registry to use for loading assets.
     */
    constructor(registry) {
        super();
        this._registry = registry;
    }

    /**
     * Initiates loading of a gsplat asset. This is a fire-and-forget operation that starts
     * the loading process. Use getResource() later to check if the asset has finished loading.
     *
     * @param {string} url - The URL of the gsplat file to load.
     */
    load(url) {
        Debug.assert(url);

        // Check if we already have this asset tracked
        let asset = this._urlToAsset.get(url);

        if (!asset) {
            // Check if the asset registry already has this asset
            asset = this._registry.getByUrl(url);

            if (!asset) {
                // Create a new gsplat asset
                asset = new Asset(url, 'gsplat', { url });
                this._registry.add(asset);
            }

            // Track this asset in our map
            this._urlToAsset.set(url, asset);
        }

        // Start loading the asset if it's not already loaded or loading
        if (!asset.loaded && !asset.loading) {
            this._registry.load(asset);
        }
    }

    /**
     * Unloads an asset that was previously loaded by this loader. The asset resource will be
     * destroyed and freed from memory.
     *
     * @param {string} url - The URL of the asset to unload.
     */
    unload(url) {
        const asset = this._urlToAsset.get(url);
        if (asset) {
            this._registry.remove(asset);
            asset.unload();
            this._urlToAsset.delete(url);
        }
    }

    /**
     * Gets the resource for a given URL if it has been loaded by this loader.
     * Use this when you just need the loaded resource data.
     *
     * @param {string} url - The URL of the asset to retrieve the resource from.
     * @returns {object|undefined} The loaded resource if found and loaded, undefined otherwise.
     */
    getResource(url) {
        const asset = this._urlToAsset.get(url);
        return asset?.resource;
    }
}

export { GSplatAssetLoader };
