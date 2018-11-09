Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.AssetListLoader
     * @classdesc Used to load a group of assets and fires a callback when all assets are loaded
     * @param {pc.Asset[]} assetList An array of pc.Asset objects to load
     * @param {pc.AssetRegistry} assetRegistry The application's asset registry
     */
    var AssetListLoader = function (assetList, assetRegistry) {
        this._assets = assetList;
        this._registry = assetRegistry;
        this._loaded = false;

        pc.events.attach(this);
    };


    /**
     * @function
     * @name pc.AssetListLoader#load
     * @param {Function} done Callback called when all assets in the list are loaded
     *
     */
    AssetListLoader.prototype.load = function (done) {
        var self = this;

        var i = 0;
        var l = this._assets.length;
        var asset;

        var total = 0;
        var count = 0;
        var failed = [];

        /* eslint-disable no-use-before-define */
        var _done = function (failed) {
            self._loaded = true;
            self._registry.off("load", _onLoad, this);

            if (failed && failed.length) {
                if (done) {
                    done("Failed to load some assets", failed);
                }
                self.fire("error", failed);
            } else {
                if (done) done();
                self.fire("load", this._assets);
            }
        };
        /* eslint-enable no-use-before-define */

        var _onLoad = function (asset) {
            if (self._assets.indexOf(asset) >= 0) {
                count++;
            }

            if (count === total) {
                // call next tick because we want
                // this to be fired after any other
                // asset load events
                setTimeout(function () {
                    _done(failed);
                }, 0);
            }
        };

        var _onError = function (err, asset) {
            if (self._assets.indexOf(asset) >= 0) {
                count++;
                failed.push(asset);
            }

            if (count === total) {
                // call next tick because we want
                // this to be fired after any other
                // asset load events
                setTimeout(function () {
                    _done(failed);
                }, 0);
            }
        }

        this._registry.on("load", _onLoad, this);
        this._registry.on("error", _onError, this);

        for (i = 0; i < l; i++) {
            asset = this._assets[i];

            if (!asset.loading && !asset.loaded) {
                this._registry.load(asset);
                total++;
            }
        }
    };


    /**
     * @function
     * @name pc.AssetListLoader#ready
     * @param {Function} done Callback called when all assets in the list are loaded
     * @param {Object} scope Scope to use when calling callback
     */
    AssetListLoader.prototype.ready = function (done, scope) {
        scope = scope || this;

        if (this._loaded) {
            done.call(scope, this._assets);
        } else {
            this.once("load", function (assets) {
                done.call(scope, assets);
            });
        }
    };

    return {
        AssetListLoader: AssetListLoader
    };

}());
