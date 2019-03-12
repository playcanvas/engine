Object.assign(pc, function (){
    var LocalizedAsset = function (app) {
        this._app = app;
        app.i18n.on('set:locale', this._onSetLocale, this);

        this._autoLoad = false;

        this._defaultAsset = null;
        this._localizedAsset = null;

        pc.events.attach(this);
    };

    LocalizedAsset.prototype._bindLocalizedAsset = function () {
        if (!this._autoLoad) return;

        var asset = this._app.assets.get(this._localizedAsset);
        if (!asset) return;

        asset.on("load", this._onLocalizedAssetLoad, this);
        asset.on("change", this._onLocalizedAssetChange, this);
        asset.on("remove", this._onLocalizedAssetRemove, this);

        if (asset.resource) {
            this._onLocalizedAssetLoad(asset);
        } else {
            this._app.assets.load(asset);
        }
    };

    LocalizedAsset.prototype._unbindLocalizedAsset = function () {
        var asset = this._app.assets.get(this._localizedAsset);
        if (!asset) return;

        asset.off("load", this._onLocalizedAssetLoad, this);
        asset.off("change", this._onLocalizedAssetChange, this);
        asset.off("remove", this._onLocalizedAssetRemove, this);
    };

    LocalizedAsset.prototype._onLocalizedAssetAdd = function (asset) {
        if (this._localizedAsset !== asset.id) return;

        this._bindLocalizedAsset();
    };

    LocalizedAsset.prototype._onLocalizedAssetLoad = function (asset) {
        this.fire('load', asset);
    };

    LocalizedAsset.prototype._onLocalizedAssetChange = function (asset, name, newValue, oldValue) {
        this.fire('change', asset, name, newValue, oldValue);
    };

    LocalizedAsset.prototype._onLocalizedAssetRemove = function (asset) {
        this.fire('remove', asset);
    };

    LocalizedAsset.prototype._onSetLocale = function (locale) {
        if (!this._defaultAsset) {
            this.localizedAsset = null;
            return;
        }

        var asset = this._app.assets.get(this._defaultAsset);
        if (!asset) {
            this.localizedAsset = this._defaultAsset;
            return;
        }

        var localizedAssetId = asset.getLocalizedAssetId(locale);
        if (!localizedAssetId) {
            this.localizedAsset = this._defaultAsset;
            return;
        }

        this.localizedAsset = localizedAssetId;
    };

    LocalizedAsset.prototype.destroy = function () {
        this.defaultAsset = null;
        this._app.i18n.off('set:locale', this._onSetLocale, this);
        this.off();
    };

    Object.defineProperty(LocalizedAsset.prototype, 'defaultAsset', {
        get: function () {
            return this._defaultAsset;
        },
        set: function (value) {
            var id = value instanceof pc.Asset ? value.id : value;

            this._defaultAsset = id;

            // reset localized asset
            this._onSetLocale(this._app.i18n.locale);
        }
    });

    Object.defineProperty(LocalizedAsset.prototype, 'localizedAsset', {
        get: function () {
            return this._localizedAsset;
        },
        set: function (value) {
            var id = value instanceof pc.Asset ? value.id : value;
            if (this._localizedAsset === id) {
                return;
            }

            if (this._localizedAsset) {
                this._app.assets.off('add:' + this._localizedAsset, this._onLocalizedAssetAdd, this);
                this._unbindLocalizedAsset();
                this._localizedAsset = null;
            }

            this._localizedAsset = id;

            if (this._localizedAsset) {
                var asset = this._app.assets.get(this._localizedAsset);
                if (!asset) {
                    this._app.assets.once('add:' + this._localizedAsset, this._onLocalizedAssetAdd, this);
                } else {
                    this._bindLocalizedAsset();
                }
            }
        }
    });

    Object.defineProperty(LocalizedAsset.prototype, 'autoLoad', {
        get: function () {
            return this._autoLoad;
        },
        set: function (value) {
            if (this._autoLoad === value) return;

            this._autoLoad = value;

            if (this._autoLoad && this._localizedAsset) {
                this._unbindLocalizedAsset();
                this._bindLocalizedAsset();
            }
        }
    });

    return {
        LocalizedAsset: LocalizedAsset
    };
}());
