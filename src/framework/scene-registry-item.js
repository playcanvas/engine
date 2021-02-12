/**
 * @class
 * @name pc.SceneRegistryItem
 * @description Item to be stored in the {@link pc.SceneRegistry}.
 * @param {string} name - The name of the scene.
 * @param {string} url - The url of the scene file.
 * @property {string} name - The name of the scene.
 * @property {string} url - The url of the scene file.
 * @property {boolean} loaded - Returns true if the scene data is still being loaded
 */
function SceneRegistryItem(name, url) {
    this.name = name;
    this.url = url;
    this.data = null;
    this._loading = false;
    this._onLoadedCallbacks = [];
}

Object.defineProperty(SceneRegistryItem.prototype, "loaded", {
    get: function () {
        return !!this.data;
    }
});

Object.defineProperty(SceneRegistryItem.prototype, "loading", {
    get: function () {
        return this._loading;
    }
});

export { SceneRegistryItem };
