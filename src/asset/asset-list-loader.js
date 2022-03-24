import { EventHandler } from '../core/event-handler.js';

import { Asset } from './asset.js';

/**
 * Used to load a group of assets and fires a callback when all assets are loaded.
 *
 * @augments EventHandler
 */
class AssetListLoader extends EventHandler {
    /**
     * Create a new AssetListLoader using a list of assets to load and the asset registry used to load and manage them.
     *
     * @param {Asset[]|number[]} assetList - An array of {@link Asset} objects to load or an array of Asset IDs to load.
     * @param {AssetRegistry} assetRegistry - The application's asset registry.
     * @example
     * const assetListLoader = new pc.AssetListLoader([
     *     new pc.Asset("texture1", "texture", { url: 'http://example.com/my/assets/here/texture1.png') }),
     *     new pc.Asset("texture2", "texture", { url: 'http://example.com/my/assets/here/texture2.png') })
     * ], pc.app.assets);
     */
    constructor(assetList, assetRegistry) {
        super();
        this._assets = [];
        this._loadingAssets = new Set();
        this._registry = assetRegistry;
        this._loaded = false;
        this._count = 0; // running count of successfully loaded assets
        this._failed = []; // list of assets that failed to load

        this._waitingAssets = [];

        if (assetList.length && assetList[0] instanceof Asset) {
            assetList.forEach((asset, i, array) => {
                // filter out duplicates
                if (array.indexOf(asset) !== i) {
                    return;
                }
                if (!asset.registry) {
                    asset.registry = assetRegistry;
                }
                this._assets.push(asset);
            });
        } else {
            // list of Asset IDs
            assetList.forEach((assetId, i, array) => {
                // filter out duplicates
                if (array.indexOf(assetId) !== i) {
                    return;
                }
                const asset = assetRegistry.get(assetList[i]);
                if (asset) {
                    this._assets.push(asset);
                } else {
                    this._waitForAsset(assetList[i]);
                }
            });
        }
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

    /**
     * Start loading asset list, call done() when all assets have loaded or failed to load.
     *
     * @param {Function} done - Callback called when all assets in the list are loaded. Passed (err, failed) where err is the undefined if no errors are encountered and failed contains a list of assets that failed to load.
     * @param {object} [scope] - Scope to use when calling callback.
     */
    load(done, scope) {
        const l = this._assets.length;
        let asset;

        this._count = 0;
        this._failed = [];
        this._callback = done;
        this._scope = scope;
        this._loaded = false;

        this._registry.on("load", this._onLoad, this);
        this._registry.on("error", this._onError, this);

        let loadingAssets = false;
        for (let i = 0; i < l; i++) {
            asset = this._assets[i];

            // Track assets that are not loaded or are currently loading
            // as some assets may be loading by this call
            if (!asset.loaded) {
                loadingAssets = true;
                this._loadingAssets.add(asset);
                this._registry.add(asset);
            }
        }
        this._loadingAssets.forEach((asset) => {
            this._registry.load(asset);
        });
        if (!loadingAssets && this._waitingAssets.length === 0) {
            this.fire("load", this._assets);
        }
    }

    /**
     * Sets a callback which will be called when all assets in the list have been loaded or failed to load.
     *
     * @param {Function} done - Callback called when all assets in the list are loaded.
     * @param {object} [scope] - Scope to use when calling callback.
     */
    ready(done, scope = this) {
        if (this._loaded) {
            done.call(scope, this._assets);
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

        if (this._failed && this._failed.length) {
            if (this._callback) {
                this._callback.call(this._scope, "Failed to load some assets", this._failed);
            }
            this.fire("error", this._failed);
        } else {
            if (this._callback) {
                this._callback.call(this._scope);
            }
            this.fire("load", this._assets);
        }
    }

    // called when an (any) asset is loaded
    _onLoad(asset) {
        // check this is an asset we care about
        if (this._loadingAssets.has(asset)) {
            this._count++;
            this.fire("progress", asset);
        }

        if (this._count === this._loadingAssets.size) {
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
            this._count++;
            this._failed.push(asset);
        }

        if (this._count === this._loadingAssets.size) {
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
        const index = this._waitingAssets.indexOf(asset);
        if (index >= 0) {
            this._waitingAssets.splice(index, 1);
        }

        this._assets.push(asset);
        const l = this._assets.length;
        for (let i = 0; i < l; i++) {
            asset = this._assets[i];
            if (!asset.loaded) {
                this._loadingAssets.add(asset);
                this._registry.load(asset);
            }
        }
    }

    _waitForAsset(assetId) {
        this._waitingAssets.push(assetId);
        this._registry.once('add:' + assetId, this._onAddAsset, this);
    }
}

export { AssetListLoader };
