Object.assign(pc, function () {
    /**
     * @name pc.AssetReference
     * @description An object that manages the case where an object holds a reference to an asset and needs to be notified when
     * changes occur in the asset. e.g. notifications include load, add and remove events.
     * @param {String} propertyName The name of the property that the asset is stored under, passed into callbacks to enable updating.
     * @param {pc.Asset|Object} parent The parent object that contains the asset reference, passed into callbacks to enable updating. Currently an asset, but could be component or other.
     * @param {pc.AssetRegistry} registry The asset registry that stores all assets.
     * @param {Object} callbacks A set of functions called when the asset state changes: load, add, remove.
     * @param {Object} [callbacks.load] The function called when the asset loads load(propertyName, parent, asset).
     * @param {Object} [callbacks.add] The function called when the asset is added to the registry add(propertyName, parent, asset).
     * @param {Object} [callbacks.remove] The function called when the asset is remove from the registry remove(propertyName, parent, asset).
     * @param {Object} scope The scope to call the callbacks in
     * @property {Number} id Get or set the asset id which this references. One of either id or url must be set to initialize an asset reference.
     * @property {String} url Get or set the asset url which this references. One of either id or url must be called to initialize an asset reference.
     * @example
     *
     * var reference = new pc.AssetReference('textureAsset', this, this.app.assets, {
     *     load: this.onTextureAssetLoad,
     *     add: this.onTextureAssetAdd,
     *     remove: this.onTextureAssetRemove
     * }, this);
     * reference.id = this.textureAsset.id;
     */
    var AssetReference = function (propertyName, parent, registry, callbacks, scope) {
        this.propertyName = propertyName;
        this.parent = parent;

        this._scope = scope;
        this._registry = registry;

        this.id = null;
        this.url = null;
        this.asset = null;

        this._onAssetLoad = callbacks.load;
        this._onAssetAdd = callbacks.add;
        this._onAssetRemove = callbacks.remove;
    };

    AssetReference.prototype._bind = function () {
        if (this.id) {
            if (this._onAssetLoad) this._registry.on("load:" + this.id, this._onLoad, this);
            if (this._onAssetAdd) this._registry.once("add:" + this.id, this._onAdd, this);
            if (this._onAssetRemove) this._registry.on("remove:" + this.id, this._onRemove, this);
        }

        if (this.url) {
            if (this._onAssetLoad) this._registry.on("load:url:" + this.url, this._onLoad, this);
            if (this._onAssetAdd) this._registry.once("add:url:" + this.url, this._onAdd, this);
            if (this._onAssetRemove) this._registry.on("remove:url:" + this.url, this._onRemove, this);
        }
    };

    AssetReference.prototype._unbind = function () {
        if (this.id) {
            if (this._onAssetLoad) this._registry.off('load:' + this.id, this._onLoad, this);
            if (this._onAssetAdd) this._registry.off('add:' + this.id, this._onAdd, this);
            if (this._onAssetRemove) this._registry.off('remove:' + this.id, this._onRemove, this);
        }
        if (this.url) {
            if (this._onAssetLoad) this._registry.off('load:' + this.url, this._onLoad, this);
            if (this._onAssetAdd) this._registry.off('add:' + this.url, this._onAdd, this);
            if (this._onAssetRemove) this._registry.off('remove:' + this.url, this._onRemove, this);
        }
    };

    AssetReference.prototype._onLoad = function (asset) {
        this._onAssetLoad.call(this._scope, this.propertyName, this.parent, asset);
    };

    AssetReference.prototype._onAdd = function (asset) {
        this._onAssetAdd.call(this._scope, this.propertyName, this.parent, asset);
    };

    AssetReference.prototype._onRemove = function (asset) {
        this._onAssetRemove.call(this._scope, this.propertyName, this.parent, asset);
    };

    Object.defineProperty(AssetReference.prototype, 'id', {
        get: function () {
            return this._id;
        },
        set: function (value) {
            if (this.url) throw Error("Can't set id and url");

            this._unbind();

            this._id = value;
            this.asset = this._registry.get(this._id);

            this._bind();
        }
    });

    Object.defineProperty(AssetReference.prototype, 'url', {
        get: function () {
            return this._url;
        },
        set: function (value) {
            if (this.id) throw Error("Can't set id and url");

            this._unbind();

            this._url = value;
            this.asset = this._registry.getByUrl(this._url);

            this._bind();
        }
    });

    return {
        AssetReference: AssetReference
    };
}());
