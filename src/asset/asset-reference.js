Object.assign(pc, function () {
    // designed to help manage the case where a object holds a reference to an asset
    // the asset reference accepts callbacks that can be called when the asset status
    // changes, e.g. the resource is loaded, or the asset is added or removed to the asset registry
    //

    /**
     * @name pc.AssetReference
     * @description An object that manages the case where an object holds a reference to an asset and needs to be notified when
     * changes occur in the asset. e.g. notifications include load, add and remove events.
     * @param {String} propertyName The name of the property that the asset is stored under, passed into callbacks to enable updating.
     * @param {pc.Asset} parent The parent object that contains the asset reference, passed into callbacks to enable updating. Currently an asset, but could be component or other.
     * @param {pc.AssetRegistry} registry The asset registry that stores all assets.
     * @param {Object} callbacks A set of functions called when the asset state changes: load, add, remove.
     * @param {Object} [callbacks.load] The function called when the asset loads load(propertyName, parent, asset).
     * @param {Object} [callbacks.add] The function called when the asset is added to the registry add(propertyName, parent, asset).
     * @param {Object} [callbacks.remove] The function called when the asset is remove from the registry remove(propertyName, parent, asset).
     * @param {Object} scope The scope to call the callbacks in
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

    AssetReference.prototype.setId = function (id) {
        if(this.url) throw Error("Can't set id and url");

        this._unbind();

        this.id = id;
        this.asset = this._registry.get(id);

        this._bind();
    };

    AssetReference.prototype.setUrl = function (url) {
        if(this.id) throw Error("Can't set id and url");

        this._unbind();

        this.url = url
        this.asset = this._registry.getByUrl(url);

        this._bind();
    };

    AssetReference.prototype._bind = function () {
        if (this.id) {
            this._registry.on("load:" + this.id, this._onLoad, this);
            this._registry.once("add:" + this.id, this._onAdd, this);
            this._registry.on("remove:" + this.id, this._onRemove, this);
        }

        if (this.url) {
            this._registry.on("load:url:" + this.id, this._onLoad, this);
            this._registry.once("add:url:" + this.id, this._onAdd, this);
            this._registry.on("remove:url:" + this.id, this._onRemove, this);
        }
    };

    AssetReference.prototype._unbind = function () {
        if (this.id) {
            this._registry.off('load:' + this.id, this._onLoad, this);
            this._registry.off('add:' + this.id, this._onAdd, this);
            this._registry.off('remove:' + this.id, this._onRemove, this);
        }
        if (this.url) {
            this._registry.off('load:' + this.url, this._onLoad, this);
            this._registry.off('add:' + this.url, this._onAdd, this);
            this._registry.off('remove:' + this.url, this._onRemove, this);
        }
    }

    AssetReference.prototype._onLoad = function (asset) {
        this._onAssetLoad.call(this._scope, this.propertyName, this.parent, asset);
    };

    AssetReference.prototype._onAdd = function (asset) {
        this._onAssetAdd.call(this._scope, this.propertyName, this.parent, asset);
    };

    AssetReference.prototype._onRemove = function (asset) {
        this._onAssetRemove.call(this._scope, this.propertyName, this.parent, asset);
    };

    return {
        AssetReference: AssetReference
    }
}())
