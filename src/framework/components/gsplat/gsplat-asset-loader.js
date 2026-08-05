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
     * @private
     */
    maxConcurrentLoads = 2;

    /**
     * Maximum number of retry attempts for failed loads.
     *
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
     * Map tracking retry attempts per URL, for genuine load errors only.
     *
     * @type {Map<string, number>}
     * @private
     */
    _retryCount = new Map();

    /**
     * Set of URLs whose load has genuinely, permanently failed: a real error (not a
     * cancellation) was reported and retries are exhausted.
     *
     * @type {Set<string>}
     * @private
     */
    _failed = new Set();

    /**
     * Whether this asset loader has been destroyed.
     *
     * @private
     */
    _destroyed = false;

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
     * Destroys the asset loader and force-unloads all tracked assets, ignoring ref counts.
     * This is used when the octree resource itself is being destroyed.
     */
    destroy() {
        this._destroyed = true;

        // Force-unload all tracked assets
        for (const asset of this._urlToAsset.values()) {
            // Fire 'unload' event to trigger cleanup in parsers (like sog.js)
            asset.fire('unload', asset);

            // Remove event listeners
            asset.off('load');
            asset.off('error');

            this._registry.remove(asset);
            asset.unload();
        }

        this._urlToAsset.clear();
        this._loadQueue.length = 0;
        this._currentlyLoading.clear();
        this._retryCount.clear();
        this._failed.clear();
    }

    /**
     * Checks if the loader can start new loads. Returns false if the 'gsplat' handler
     * has been removed from the registry (e.g., during app destruction).
     *
     * @returns {boolean} True if loading is possible, false otherwise.
     * @private
     */
    _canLoad() {
        return !!this._registry.loader?.getHandler('gsplat');
    }

    /**
     * Initiates loading of a gsplat asset. This is a fire-and-forget operation that starts
     * the loading process. Use getResource() later to check if the asset has finished loading.
     *
     * @param {string} url - The URL of the gsplat file to load.
     */
    load(url) {
        Debug.assert(url);

        const asset = this._urlToAsset.get(url);

        // A previous attempt resolved successfully but produced no usable resource - most
        // commonly because the load was cancelled (aborted) while still in flight, e.g. LOD
        // requirements moved on before it finished. This is not a failure: retry unconditionally
        // whenever something asks for this URL again (callers only poll while they still want
        // it), unless the URL has genuinely, permanently failed via a real error.
        if (asset && asset.loaded && !asset.resource && !this._currentlyLoading.has(url) && !this._failed.has(url)) {
            asset.loaded = false;
        }

        // Skip if already loading or loaded
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
            // Create a new gsplat asset
            asset = new Asset(url, 'gsplat', { url });

            // Assert that registry doesn't already have an asset for this URL
            // If it does, there's a code ownership issue - GSplatAssetLoader should be the only
            // creator of gsplat assets with these URLs
            Debug.assert(!this._registry.getByUrl(url),
                `Asset with URL ${url} already exists in registry but not tracked by GSplatAssetLoader`);

            this._registry.add(asset);

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
        // Don't process if destroyed or already unloaded
        if (this._destroyed || !this._urlToAsset.has(url)) {
            return;
        }

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
        // Don't process if destroyed, handler removed, or already unloaded
        if (this._destroyed || !this._canLoad() || !this._urlToAsset.has(url)) {
            return;
        }

        const retryCount = this._retryCount.get(url) || 0;

        if (retryCount < this.maxRetries) {
            // Increment retry count
            this._retryCount.set(url, retryCount + 1);

            // Reset asset state for retry
            asset.loaded = false;
            asset.loading = false;

            // Retry loading. Re-attach only the 'error' listener - it was consumed by the
            // once() that just fired, and a second consecutive failure would otherwise have
            // nothing left to catch it. Don't touch 'load': the original listener from
            // _startLoading() is still pending (it never fired) and re-adding it would leave
            // two 'load' listeners on this asset, double-invoking _onAssetLoadSuccess on the
            // eventual success.
            Debug.warn(`GSplatAssetLoader: Retrying load for ${url} (attempt ${retryCount + 1}/${this.maxRetries})`);
            asset.once('error', retryErr => this._onAssetLoadError(url, asset, retryErr));
            this._registry.load(asset);
        } else {
            // Max retries exceeded
            Debug.error(`GSplatAssetLoader: Failed to load ${url} after ${this.maxRetries} retries: ${err}`);

            // Remove from currently loading
            this._currentlyLoading.delete(url);

            // Clear retry count
            this._retryCount.delete(url);

            // Mark as genuinely, permanently failed
            this._failed.add(url);

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
        // Don't process queue if destroyed or handler removed
        if (this._destroyed || !this._canLoad()) {
            return;
        }

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
        this._failed.delete(url);

        // Unload the asset
        const asset = this._urlToAsset.get(url);
        if (asset) {
            // IMPORTANT: Fire 'unload' event explicitly before calling asset.unload()
            // This ensures parsers with async loading (like sog.js) can clean up
            // even if the asset hasn't finished loading yet
            // NOTE: Must fire BEFORE removing event listeners
            asset.fire('unload', asset);

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

    /**
     * Checks whether loading a URL has genuinely, permanently failed (a real error, not a
     * cancellation, with retries exhausted).
     *
     * @param {string} url - The URL to check.
     * @returns {boolean} True if the load has permanently failed.
     */
    hasFailed(url) {
        return this._failed.has(url);
    }
}

export { GSplatAssetLoader };
