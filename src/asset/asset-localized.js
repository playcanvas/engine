Object.assign(pc, function (){
    var LocalizedAsset = function (app) {
        this._app = app;
        app.i18n.on('set:locale', this._onSetLocale, this);

        this._autoLoad = false;
        this._disableLocalization = false;

        this._defaultAsset = null;
        this._localizedAsset = null;

        pc.events.attach(this);
    };

    LocalizedAsset.prototype._bindDefaultAsset = function () {
        var asset = this._app.assets.get(this._defaultAsset);
        if (!asset) {
            this._app.assets.once('add:' + this._defaultAsset, this._onDefaultAssetAdd, this);
        } else {
            this._onDefaultAssetAdd(asset);
        }
    };

    LocalizedAsset.prototype._unbindDefaultAsset = function () {
        if (!this._defaultAsset) return;

        this._app.assets.off('add:' + this._defaultAsset, this._onDefaultAssetAdd, this);

        var asset = this._app.assets.get(this._defaultAsset);
        if (!asset) return;

        asset.off('add:localized', this._onLocaleAdd, this);
        asset.off('remove:localized', this._onLocaleRemove, this);
        asset.off('remove', this._onDefaultAssetRemove, this);
    };

    LocalizedAsset.prototype._onDefaultAssetAdd = function (asset) {
        if (this._defaultAsset !== asset.id) return;

        asset.on('add:localized', this._onLocaleAdd, this);
        asset.on('remove:localized', this._onLocaleRemove, this);
        asset.once('remove', this._onDefaultAssetRemove, this);
    };

    LocalizedAsset.prototype._onDefaultAssetRemove = function (asset) {
        if (this._defaultAsset !== asset.id) return;
        asset.off('add:localized', this._onLocaleAdd, this);
        asset.off('remove:localized', this._onLocaleAdd, this);
        this._app.assets.once('add:' + this._defaultAsset, this._onDefaultAssetAdd, this);
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
        if (this._localizedAsset === asset.id) {
            this.localizedAsset = this._defaultAsset;
        }
        this.fire('remove', asset);
    };

    LocalizedAsset.prototype._onLocaleAdd = function (locale, assetId) {
        if (this._app.i18n.locale !== locale) return;

        // reset localized asset
        this._onSetLocale(locale);
    };

    LocalizedAsset.prototype._onLocaleRemove = function (locale, assetId) {
        if (this._app.i18n.locale !== locale) return;

        // reset localized asset
        this._onSetLocale(locale);
    };

    LocalizedAsset.prototype._onSetLocale = function (locale) {
        if (!this._defaultAsset) {
            this.localizedAsset = null;
            return;
        }

        var asset = this._app.assets.get(this._defaultAsset);
        if (!asset || this._disableLocalization) {
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

            if (this._defaultAsset === id) return;

            if (this._defaultAsset) {
                this._unbindDefaultAsset();
            }

            this._defaultAsset = id;

            if (this._defaultAsset) {
                this._bindDefaultAsset();
            }

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

    Object.defineProperty(LocalizedAsset.prototype, 'disableLocalization', {
        get: function () {
            return this._disableLocalization;
        },
        set: function (value) {
            if (this._disableLocalization === value) return;

            this._disableLocalization = value;

            // reset localized asset
            this._onSetLocale(this._app.i18n.locale);
        }
    });

    return {
        LocalizedAsset: LocalizedAsset
    };
}());
