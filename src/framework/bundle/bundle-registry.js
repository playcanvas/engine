/**
 * Keeps track of which assets are in bundles and loads files from bundles.
 *
 * @ignore
 */
class BundleRegistry {
    /**
     * Index of bundle assets.
     * @type {Map<number, import('../asset/asset.js').Asset>}
     * @private
     */
    _idToBundle = new Map();

    /**
     * Index of asset id to set of bundle assets.
     * @type {Map<number, Set<import('../asset/asset.js').Asset>>}
     * @private
     */
    _assetToBundles = new Map();

    /**
     * Index of file url to set of bundle assets.
     * @type {Map<string, Set<import('../asset/asset.js').Asset>>}
     * @private
     */
    _urlsToBundles = new Map();

    /**
     * Index of file request to load callbacks.
     * @type {Map<string, function[]>}
     * @private
     */
    _fileRequests = new Map();

    /**
     * Create a new BundleRegistry instance.
     *
     * @param {import('../asset/asset-registry.js').AssetRegistry} assets - The asset registry.
     */
    constructor(assets) {
        this._assets = assets;
        this._assets.bundles = this;
        this._assets.on('add', this._onAssetAdd, this);
        this._assets.on('remove', this._onAssetRemove, this);
    }

    /**
     * Called when asset is added to AssetRegistry.
     *
     * @param {import('../asset/asset.js').Asset} asset - The asset that has been added.
     * @private
     */
    _onAssetAdd(asset) {
        // if this is a bundle asset then add it and
        // index its referenced assets
        if (asset.type === 'bundle') {
            this._idToBundle.set(asset.id, asset);
            this._assets.on(`load:start:${asset.id}`, this._onBundleLoadStart, this);
            this._assets.on(`load:${asset.id}`, this._onBundleLoad, this);
            this._assets.on(`error:${asset.id}`, this._onBundleError, this);

            const assetIds = asset.data.assets;
            for (let i = 0; i < assetIds.length; i++) {
                this._indexAssetInBundle(assetIds[i], asset);
            }
        } else {
            // if this is not a bundle then index its URLs
            if (this._assetToBundles.has(asset.id)) {
                this._indexAssetFileUrls(asset);
            }
        }
    }

    _unbindAssetEvents(id) {
        this._assets.off('load:start:' + id, this._onBundleLoadStart, this);
        this._assets.off('load:' + id, this._onBundleLoad, this);
        this._assets.off('error:' + id, this._onBundleError, this);
    }

    // Index the specified asset id and its file URLs so that
    // the registry knows that the asset is in that bundle
    _indexAssetInBundle(id, bundle) {
        let bundles = this._assetToBundles.get(id);

        if (!bundles) {
            bundles = new Set();
            this._assetToBundles.set(id, bundles);
        }

        bundles.add(bundle);

        const asset = this._assets.get(id);
        if (asset) this._indexAssetFileUrls(asset);
    }

    // Index the file URLs of the specified asset
    _indexAssetFileUrls(asset) {
        const urls = this._getAssetFileUrls(asset);
        if (!urls) return;

        for (let i = 0; i < urls.length; i++) {
            const bundles = this._assetToBundles.get(asset.id);
            if (!bundles) continue;
            this._urlsToBundles.set(urls[i], bundles);
        }
    }

    // Get all the possible URLs of an asset
    _getAssetFileUrls(asset) {
        let url = asset.getFileUrl();
        if (!url) return null;

        url = url.split('?')[0];
        const urls = [url];

        // a font might have additional files
        // so add them in the list
        if (asset.type === 'font') {
            const numFiles = asset.data.info.maps.length;
            for (let i = 1; i < numFiles; i++) {
                urls.push(url.replace('.png', i + '.png'));
            }
        }

        return urls;
    }

    // Remove asset from internal indexes
    _onAssetRemove(asset) {
        if (asset.type === 'bundle') {
            // remove bundle from index
            this._idToBundle.delete(asset.id);

            // remove event listeners
            this._unbindAssetEvents(asset.id);

            // remove bundle from _assetToBundles and _urlInBundles indexes
            const assetIds = asset.data.assets;
            for (let i = 0; i < assetIds.length; i++) {
                const bundles = this._assetToBundles.get(assetIds[i]);
                if (!bundles) continue;
                bundles.delete(asset);

                if (bundles.size === 0) {
                    this._assetToBundles.delete(assetIds[i]);
                    for (const [url, otherBundles] of this._urlsToBundles) {
                        if (otherBundles !== bundles)
                            continue;
                        this._urlsToBundles.delete(url);
                    }
                }
            }

            // fail any pending requests for this bundle
            this._onBundleError(`Bundle ${asset.id} was removed`);
        } else {
            const bundles = this._assetToBundles.get(asset.id);
            if (!bundles) return;

            this._assetToBundles.delete(asset.id);

            // remove asset urls from _urlsToBundles
            const urls = this._getAssetFileUrls(asset);
            if (!urls) return;
            for (let i = 0; i < urls.length; i++) {
                this._urlsToBundles.delete(urls[i]);
            }
        }
    }

    _onBundleLoadStart(asset) {
        asset.resource.on('add', (url, data) => {
            const callbacks = this._fileRequests.get(url);
            if (!callbacks) return;
            for (let i = 0; i < callbacks.length; i++) {
                callbacks[i](null, data);
            }
            this._fileRequests.delete(url);
        });
    }

    // If we have any pending file requests
    // that can be satisfied by the specified bundle
    // then resolve them
    _onBundleLoad(asset) {
        // this can happen if the asset failed
        // to create its resource
        if (!asset.resource) {
            this._onBundleError(`Bundle ${asset.id} failed to load`);
            return;
        }

        // make sure the registry hasn't been destroyed already
        if (!this._fileRequests)
            return;

        for (const [url, requests] of this._fileRequests) {
            const bundles = this._urlsToBundles.get(url);
            if (!bundles || !bundles.has(asset)) continue;

            const decodedUrl = decodeURIComponent(url);

            let err, data;

            if (asset.resource.has(decodedUrl)) {
                data = asset.resource.get(decodedUrl);
            } else if (asset.resource.loaded) {
                err = `Bundle ${asset.id} does not contain URL ${url}`;
            } else {
                continue;
            }

            for (let i = 0; i < requests.length; i++) {
                requests[i](err, err || data);
            }
            this._fileRequests.delete(url);
        }
    }

    // If we have outstanding file requests for any
    // of the URLs in the specified bundle then search for
    // other bundles that can satisfy these requests.
    // If we do not find any other bundles then fail
    // those pending file requests with the specified error.
    _onBundleError(err) {
        for (const [url, requests] of this._fileRequests) {
            const bundle = this._findLoadedOrLoadingBundleForUrl(url);
            if (!bundle) {
                for (let i = 0; i < requests.length; i++)
                    requests[i](err);

                this._fileRequests.delete(url);
            }
        }
    }

    // Finds a bundle that contains the specified URL but
    // only returns the bundle if it's either loaded or being loaded
    _findLoadedOrLoadingBundleForUrl(url) {
        const bundles = this._urlsToBundles.get(url);
        if (!bundles) return null;

        let candidate = null;

        for (const bundle of bundles) {
            if (bundle.loaded && bundle.resource) {
                return bundle;
            } else if (bundle.loading) {
                candidate = bundle;
            }
        }

        return candidate;
    }

    /**
     * Lists all of the available bundles that reference the specified asset.
     *
     * @param {import('../asset/asset.js').Asset} asset - The asset to search by.
     * @returns {import('../asset/asset.js').Asset[]|null} An array of bundle assets or null if the
     * asset is not in any bundle.
     */
    listBundlesForAsset(asset) {
        const bundles = this._assetToBundles.get(asset.id);
        if (bundles) return Array.from(bundles);
        return null;
    }

    /**
     * Lists all bundle assets.
     *
     * @returns {import('../asset/asset.js').Asset[]} An array of bundle assets.
     */
    list() {
        return Array.from(this._idToBundle.values());
    }

    /**
     * Returns true if there is a bundle that contains the specified URL.
     *
     * @param {string} url - The url.
     * @returns {boolean} True or false.
     */
    hasUrl(url) {
        return this._urlsToBundles.has(url);
    }

    /**
     * Returns true if there is a bundle that contains the specified URL and that bundle is either
     * loaded or currently being loaded.
     *
     * @param {string} url - The url.
     * @returns {boolean} True or false.
     */
    urlIsLoadedOrLoading(url) {
        return !!this._findLoadedOrLoadingBundleForUrl(url);
    }

    /**
     * Loads the specified file URL from a bundle that is either loaded or currently being loaded.
     *
     * @param {string} url - The URL. Make sure you are using a relative URL that does not contain
     * any query parameters.
     * @param {Function} callback - The callback is called when the file has been loaded or if an
     * error occurs. The callback expects the first argument to be the error message (if any) and
     * the second argument is the file blob URL.
     * @example
     * const url = asset.getFileUrl().split('?')[0]; // get normalized asset URL
     * this.app.bundles.loadFile(url, function (err, data) {
     *     // do something with the data
     * });
     */
    loadUrl(url, callback) {
        const bundle = this._findLoadedOrLoadingBundleForUrl(url);
        if (!bundle) {
            callback(`URL ${url} not found in any bundles`);
            return;
        }

        // Only load files from bundles that're explicitly requested to be loaded.
        if (bundle.loaded) {
            const decodedUrl = decodeURIComponent(url);

            if (bundle.resource.has(decodedUrl)) {
                callback(null, bundle.resource.get(decodedUrl));
                return;
            } else if (bundle.resource.loaded) {
                callback(`Bundle ${bundle.id} does not contain URL ${url}`);
                return;
            }
        }

        let callbacks = this._fileRequests.get(url);
        if (!callbacks) {
            callbacks = [];
            this._fileRequests.set(url, callbacks);
        }
        callbacks.push(callback);
    }

    /**
     * Destroys the registry, and releases its resources. Does not unload bundle assets as these
     * should be unloaded by the {@link AssetRegistry}.
     */
    destroy() {
        this._assets.off('add', this._onAssetAdd, this);
        this._assets.off('remove', this._onAssetRemove, this);

        for (const id of this._idToBundle.keys()) {
            this._unbindAssetEvents(id);
        }

        this._assets = null;

        this._idToBundle.clear();
        this._idToBundle = null;

        this._assetToBundles.clear();
        this._assetToBundles = null;

        this._urlsToBundles.clear();
        this._urlsToBundles = null;

        this._fileRequests.clear();
        this._fileRequests = null;
    }
}

export { BundleRegistry };
