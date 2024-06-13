/**
 * An object that manages the case where an object holds a reference to an asset and needs to be
 * notified when changes occur in the asset. e.g. notifications include load, add and remove
 * events.
 *
 * @category Asset
 */
class AssetReference {
    /**
     * Create a new AssetReference instance.
     *
     * @param {string} propertyName - The name of the property that the asset is stored under,
     * passed into callbacks to enable updating.
     * @param {import('./asset.js').Asset|object} parent - The parent object that contains the
     * asset reference, passed into callbacks to enable updating. Currently an asset, but could be
     * component or other.
     * @param {import('./asset-registry.js').AssetRegistry} registry - The asset registry that
     * stores all assets.
     * @param {object} callbacks - A set of functions called when the asset state changes: load,
     * add, remove.
     * @param {object} [callbacks.load] - The function called when the asset loads
     * load(propertyName, parent, asset).
     * @param {object} [callbacks.add] - The function called when the asset is added to the
     * registry add(propertyName, parent, asset).
     * @param {object} [callbacks.remove] - The function called when the asset is remove from the
     * registry remove(propertyName, parent, asset).
     * @param {object} [callbacks.unload] - The function called when the asset is unloaded
     * unload(propertyName, parent, asset).
     * @param {object} [scope] - The scope to call the callbacks in.
     * @example
     * const reference = new pc.AssetReference('textureAsset', this, this.app.assets, {
     *     load: this.onTextureAssetLoad,
     *     add: this.onTextureAssetAdd,
     *     remove: this.onTextureAssetRemove
     * }, this);
     * reference.id = this.textureAsset.id;
     */
    constructor(propertyName, parent, registry, callbacks, scope) {
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
        this._onAssetUnload = callbacks.unload;
    }

    /**
     * Sets the asset id which this references. One of either id or url must be set to
     * initialize an asset reference.
     *
     * @type {number}
     */
    set id(value) {
        if (this.url) throw Error('Can\'t set id and url');

        this._unbind();

        this._id = value;
        this.asset = this._registry.get(this._id);

        this._bind();
    }

    /**
     * Gets the asset id which this references.
     *
     * @type {number}
     */
    get id() {
        return this._id;
    }

    /**
     * Sets the asset url which this references. One of either id or url must be called to
     * initialize an asset reference.
     *
     * @type {string|null}
     */
    set url(value) {
        if (this.id) throw Error('Can\'t set id and url');

        this._unbind();

        this._url = value;
        this.asset = this._registry.getByUrl(this._url);

        this._bind();
    }

    /**
     * Gets the asset url which this references.
     *
     * @type {string|null}
     */
    get url() {
        return this._url;
    }

    _bind() {
        if (this.id) {
            if (this._onAssetLoad) this._registry.on('load:' + this.id, this._onLoad, this);
            if (this._onAssetAdd) this._registry.once('add:' + this.id, this._onAdd, this);
            if (this._onAssetRemove) this._registry.on('remove:' + this.id, this._onRemove, this);
            if (this._onAssetUnload) this._registry.on('unload:' + this.id, this._onUnload, this);
        }

        if (this.url) {
            if (this._onAssetLoad) this._registry.on('load:url:' + this.url, this._onLoad, this);
            if (this._onAssetAdd) this._registry.once('add:url:' + this.url, this._onAdd, this);
            if (this._onAssetRemove) this._registry.on('remove:url:' + this.url, this._onRemove, this);
        }
    }

    _unbind() {
        if (this.id) {
            if (this._onAssetLoad) this._registry.off('load:' + this.id, this._onLoad, this);
            if (this._onAssetAdd) this._registry.off('add:' + this.id, this._onAdd, this);
            if (this._onAssetRemove) this._registry.off('remove:' + this.id, this._onRemove, this);
            if (this._onAssetUnload) this._registry.off('unload:' + this.id, this._onUnload, this);
        }
        if (this.url) {
            if (this._onAssetLoad) this._registry.off('load:' + this.url, this._onLoad, this);
            if (this._onAssetAdd) this._registry.off('add:' + this.url, this._onAdd, this);
            if (this._onAssetRemove) this._registry.off('remove:' + this.url, this._onRemove, this);
        }
    }

    _onLoad(asset) {
        this._onAssetLoad.call(this._scope, this.propertyName, this.parent, asset);
    }

    _onAdd(asset) {
        this.asset = asset;
        this._onAssetAdd.call(this._scope, this.propertyName, this.parent, asset);
    }

    _onRemove(asset) {
        this._onAssetRemove.call(this._scope, this.propertyName, this.parent, asset);
        this.asset = null;
    }

    _onUnload(asset) {
        this._onAssetUnload.call(this._scope, this.propertyName, this.parent, asset);
    }
}

export { AssetReference };
