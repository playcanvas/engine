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
     * Maximum number of assets that can be loading concurrently.
     *
     * @type {number}
     * @private
     */
    maxConcurrentLoads = 2;

    /**
     * Maximum number of retry attempts for failed loads.
     *
     * @type {number}
     * @private
     */
    maxRetries = 2;

    /**
     * Set of URLs currently being loaded.
     *
     * @type {Set<string>}
     * @private
     */
    _currentlyLoading = new Set();

    /**
     * Queue of URLs waiting to be loaded.
     *
     * @type {string[]}
     * @private
     */
    _loadQueue = [];

    /**
     * Map tracking retry attempts per URL.
     *
     * @type {Map<string, number>}
     * @private
     */
    _retryCount = new Map();

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

        // Skip if already loading or loaded
        const asset = this._urlToAsset.get(url);
        if (asset?.loaded || this._currentlyLoading.has(url)) {
            return;
        }

        // Skip if already queued
        if (this._loadQueue.includes(url)) {
            return;
        }

        // If under concurrent limit, start loading immediately
        if (this._currentlyLoading.size < this.maxConcurrentLoads) {
            this._startLoading(url);
        } else {
            // Otherwise, add to queue
            this._loadQueue.push(url);
        }
    }

    /**
     * Starts loading an asset immediately.
     *
     * @param {string} url - The URL of the gsplat file to load.
     * @private
     */
    _startLoading(url) {
        // Add to currently loading set
        this._currentlyLoading.add(url);

        // Get or create asset
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

        // Attach event listeners
        asset.once('load', () => this._onAssetLoadSuccess(url, asset));
        asset.once('error', err => this._onAssetLoadError(url, asset, err));

        // Start loading the asset
        if (!asset.loaded && !asset.loading) {
            this._registry.load(asset);
        }
    }

    /**
     * Called when an asset successfully loads.
     *
     * @param {string} url - The URL of the loaded asset.
     * @param {Asset} asset - The loaded asset.
     * @private
     */
    _onAssetLoadSuccess(url, asset) {
        // Remove from currently loading
        this._currentlyLoading.delete(url);

        // Clear retry count
        this._retryCount.delete(url);

        // Process next item in queue
        this._processQueue();
    }

    /**
     * Called when an asset fails to load.
     *
     * @param {string} url - The URL of the failed asset.
     * @param {Asset} asset - The asset that failed to load.
     * @param {string|Error} err - The error that occurred.
     * @private
     */
    _onAssetLoadError(url, asset, err) {
        const retryCount = this._retryCount.get(url) || 0;

        if (retryCount < this.maxRetries) {
            // Increment retry count
            this._retryCount.set(url, retryCount + 1);

            // Reset asset state for retry
            asset.loaded = false;
            asset.loading = false;

            // Retry loading
            Debug.warn(`GSplatAssetLoader: Retrying load for ${url} (attempt ${retryCount + 1}/${this.maxRetries})`);
            this._registry.load(asset);
        } else {
            // Max retries exceeded
            Debug.error(`GSplatAssetLoader: Failed to load ${url} after ${this.maxRetries} retries: ${err}`);

            // Remove from currently loading
            this._currentlyLoading.delete(url);

            // Clear retry count
            this._retryCount.delete(url);

            // Process next item in queue
            this._processQueue();
        }
    }

    /**
     * Processes the next item in the load queue if there's capacity.
     *
     * @private
     */
    _processQueue() {
        while (this._currentlyLoading.size < this.maxConcurrentLoads && this._loadQueue.length > 0) {
            const url = this._loadQueue.shift();
            if (url) {
                this._startLoading(url);
            }
        }
    }

    /**
     * Unloads an asset that was previously loaded by this loader. The asset resource will be
     * destroyed and freed from memory.
     *
     * @param {string} url - The URL of the asset to unload.
     */
    unload(url) {
        // Remove from loading state
        this._currentlyLoading.delete(url);

        // Remove from queue if present
        const queueIndex = this._loadQueue.indexOf(url);
        if (queueIndex !== -1) {
            this._loadQueue.splice(queueIndex, 1);
        }

        // Clear retry count
        this._retryCount.delete(url);

        // Unload the asset
        const asset = this._urlToAsset.get(url);
        if (asset) {
            // Remove event listeners
            asset.off('load');
            asset.off('error');

            this._registry.remove(asset);
            asset.unload();
            this._urlToAsset.delete(url);
        }

        // Process queue in case we freed up a slot
        this._processQueue();
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
