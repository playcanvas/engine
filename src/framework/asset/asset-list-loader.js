import { EventHandler } from '../../core/event-handler.js';

import { Asset } from './asset.js';

/**
 * Used to load a group of assets and fires a callback when all assets are loaded.
 *
 * ```javascript
 * const assets = [
 *     new Asset('model', 'container', { url: `http://example.com/asset.glb` }),
 *     new Asset('styling', 'css', { url: `http://example.com/asset.css` })
 * ];
 * const assetListLoader = new AssetListLoader(assets, app.assets);
 * assetListLoader.load((err, failed) => {
 *     if (err) {
 *         console.error(`${failed.length} assets failed to load`);
 *     } else {
 *         console.log(`${assets.length} assets loaded`);
 *    }
 * });
 * ```
 *
 * @category Asset
 */
class AssetListLoader extends EventHandler {
    /**
     * Create a new AssetListLoader using a list of assets to load and the asset registry used to load and manage them.
     *
     * @param {Asset[]|number[]} assetList - An array of {@link Asset} objects to load or an array of Asset IDs to load.
     * @param {import('./asset-registry.js').AssetRegistry} assetRegistry - The application's asset registry.
     * @example
     * const assetListLoader = new pc.AssetListLoader([
     *     new pc.Asset("texture1", "texture", { url: 'http://example.com/my/assets/here/texture1.png') }),
     *     new pc.Asset("texture2", "texture", { url: 'http://example.com/my/assets/here/texture2.png') })
     * ], app.assets);
     */
    constructor(assetList, assetRegistry) {
        super();
        this._assets = new Set();
        this._loadingAssets = new Set();
        this._waitingAssets = new Set();
        this._registry = assetRegistry;
        this._loading = false;
        this._loaded = false;
        this._failed = []; // list of assets that failed to load

        assetList.forEach((a) => {
            if (a instanceof Asset) {
                if (!a.registry) {
                    a.registry = assetRegistry;
                }
                this._assets.add(a);
            } else {
                const asset = assetRegistry.get(a);
                if (asset) {
                    this._assets.add(asset);
                } else {
                    this._waitForAsset(a);
                }
            }
        });
    }

    /**
     * Removes all references to this asset list loader.
     */
    destroy() {
        // remove any outstanding listeners
        const self = this;

        this._registry.off("load", this._onLoad);
        this._registry.off("error", this._onError);

        this._waitingAssets.forEach(function (id) {
            self._registry.off("add:" + id, this._onAddAsset);
        });

        this.off("progress");
        this.off("load");
    }

    _assetHasDependencies(asset) {
        return (asset.type === 'model' && asset.file?.url && asset.file.url && asset.file.url.match(/.json$/g));
    }

    /**
     * Start loading asset list, call done() when all assets have loaded or failed to load.
     *
     * @param {Function} done - Callback called when all assets in the list are loaded. Passed (err, failed) where err is the undefined if no errors are encountered and failed contains a list of assets that failed to load.
     * @param {object} [scope] - Scope to use when calling callback.
     */
    load(done, scope) {
        if (this._loading) {
            // #if _DEBUG
            console.debug("AssetListLoader: Load function called multiple times.");
            // #endif
            return;
        }
        this._loading = true;
        this._callback = done;
        this._scope = scope;

        this._registry.on("load", this._onLoad, this);
        this._registry.on("error", this._onError, this);

        let loadingAssets = false;
        this._assets.forEach((asset) => {
            // Track assets that are not loaded or are currently loading
            // as some assets may be loading by this call
            if (!asset.loaded) {
                loadingAssets = true;
                // json based models should be loaded with the loadFromUrl function so that their dependencies can be loaded too.
                if (this._assetHasDependencies(asset)) {
                    this._registry.loadFromUrl(asset.file.url, asset.type, (err, loadedAsset) => {
                        if (err) {
                            this._onError(err, asset);
                            return;
                        }
                        this._onLoad(asset);
                    });
                }
                this._loadingAssets.add(asset);
                this._registry.add(asset);
            }
        });
        this._loadingAssets.forEach((asset) => {
            if (!this._assetHasDependencies(asset)) {
                this._registry.load(asset);
            }
        });
        if (!loadingAssets && this._waitingAssets.size === 0) {
            this._loadingComplete();
        }
    }

    /**
     * Sets a callback which will be called when all assets in the list have been loaded.
     *
     * @param {Function} done - Callback called when all assets in the list are loaded.
     * @param {object} [scope] - Scope to use when calling callback.
     */
    ready(done, scope = this) {
        if (this._loaded) {
            done.call(scope, Array.from(this._assets));
        } else {
            this.once("load", function (assets) {
                done.call(scope, assets);
            });
        }
    }

    // called when all assets are loaded
    _loadingComplete() {
        if (this._loaded) return;
        this._loaded = true;
        this._registry.off("load", this._onLoad, this);
        this._registry.off("error", this._onError, this);

        if (this._failed.length) {
            if (this._callback) {
                this._callback.call(this._scope, "Failed to load some assets", this._failed);
            }
            this.fire("error", this._failed);
        } else {
            if (this._callback) {
                this._callback.call(this._scope);
            }
            this.fire("load", Array.from(this._assets));
        }
    }

    // called when an (any) asset is loaded
    _onLoad(asset) {
        // check this is an asset we care about
        if (this._loadingAssets.has(asset)) {
            this.fire("progress", asset);
            this._loadingAssets.delete(asset);
        }

        if (this._loadingAssets.size === 0) {
            // call next tick because we want
            // this to be fired after any other
            // asset load events
            setTimeout(() => {
                this._loadingComplete(this._failed);
            }, 0);
        }
    }

    // called when an asset fails to load
    _onError(err, asset) {
        // check this is an asset we care about
        if (this._loadingAssets.has(asset)) {
            this._failed.push(asset);
            this._loadingAssets.delete(asset);
        }

        if (this._loadingAssets.size === 0) {
            // call next tick because we want
            // this to be fired after any other
            // asset load events
            setTimeout(() => {
                this._loadingComplete(this._failed);
            }, 0);
        }
    }

    // called when a expected asset is added to the asset registry
    _onAddAsset(asset) {
        // remove from waiting list
        this._waitingAssets.delete(asset);

        this._assets.add(asset);
        if (!asset.loaded) {
            this._loadingAssets.add(asset);
            this._registry.load(asset);
        }
    }

    _waitForAsset(assetId) {
        this._waitingAssets.add(assetId);
        this._registry.once('add:' + assetId, this._onAddAsset, this);
    }
}

export { AssetListLoader };
