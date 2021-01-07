import { EventHandler } from '../core/event-handler.js';

import { Asset } from './asset.js';

/**
 * @private
 * @class
 * @name pc.AssetListLoader
 * @augments pc.EventHandler
 * @classdesc Used to load a group of assets and fires a callback when all assets are loaded.
 * @param {pc.Asset[]|number[]} assetList - An array of pc.Asset objects to load or an array of Asset IDs to load.
 * @param {pc.AssetRegistry} assetRegistry - The application's asset registry.
 */
class AssetListLoader extends EventHandler {
    constructor(assetList, assetRegistry) {
        super();

        this._assets = [];
        this._registry = assetRegistry;
        this._loaded = false;
        this._count = 0; // running count of successfully loaded assets
        this._total = 0; // total assets loader is expecting to load
        this._failed = []; // list of assets that failed to load

        this._waitingAssets = [];

        if (assetList.length && assetList[0] instanceof Asset) {
            // list of pc.Asset
            this._assets = assetList;
        } else {
            // list of Asset IDs
            for (var i = 0; i < assetList.length; i++) {
                var asset = assetRegistry.get(assetList[i]);
                if (asset) {
                    this._assets.push(asset);
                } else {
                    this._waitForAsset(assetList[i]);
                    this._total++;
                }

            }
        }
    }

    destroy() {
        // remove any outstanding listeners
        var self = this;

        this._registry.off("load", this._onLoad);
        this._registry.off("error", this._onError);

        this._waitingAssets.forEach(function (id) {
            self._registry.off("add:" + id, this._onAddAsset);
        });

        this.off("progress");
        this.off("load");
    }

    /**
     * @private
     * @function
     * @name pc.AssetListLoader#load
     * @description Start loading asset list, call done() when all assets have loaded or failed to load.
     * @param {Function} done - Callback called when all assets in the list are loaded. Passed (err, failed) where err is the undefined if no errors are encountered and failed contains a list of assets that failed to load.
     * @param {object} [scope] - Scope to use when calling callback.
     *
     */
    load(done, scope) {
        var i = 0;
        var l = this._assets.length;
        var asset;

        // this._total = l;
        this._count = 0;
        this._failed = [];
        this._callback = done;
        this._scope = scope;

        this._registry.on("load", this._onLoad, this);
        this._registry.on("error", this._onError, this);

        for (i = 0; i < l; i++) {
            asset = this._assets[i];

            if (!asset.loading && !asset.loaded) {
                this._registry.load(asset);
                this._total++;
            }
        }
    }

    /**
     * @private
     * @function
     * @name pc.AssetListLoader#ready
     * @param {Function} done - Callback called when all assets in the list are loaded.
     * @param {object} [scope] - Scope to use when calling callback.
     */
    ready = function (done, scope) {
        scope = scope || this;

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
        var self = this;

        // check this is an asset we care about
        if (this._assets.indexOf(asset) >= 0) {
            this._count++;
            this.fire("progress", asset);
        }

        if (this._count === this._total) {
            // call next tick because we want
            // this to be fired after any other
            // asset load events
            setTimeout(function () {
                self._loadingComplete(self._failed);
            }, 0);
        }
    }

    // called when an asset fails to load
    _onError(err, asset) {
        var self = this;

        // check this is an asset we care about
        if (this._assets.indexOf(asset) >= 0) {
            this._count++;
            this._failed.push(asset);
        }

        if (this._count === this._total) {
            // call next tick because we want
            // this to be fired after any other
            // asset load events
            setTimeout(function () {
                self._loadingComplete(self._failed);
            }, 0);
        }
    }

    // called when a expected asset is added to the asset registry
    _onAddAsset(asset) {
        // remove from waiting list
        var index = this._waitingAssets.indexOf(asset);
        if (index >= 0) {
            this._waitingAssets.splice(index, 1);
        }

        this._assets.push(asset);
        var i;
        var l = this._assets.length;
        for (i = 0; i < l; i++) {
            asset = this._assets[i];

            if (!asset.loading && !asset.loaded) {
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
