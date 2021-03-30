/**
 * @class
 * @name SceneRegistryItem
 * @description Item to be stored in the {@link SceneRegistry}.
 * @param {string} name - The name of the scene.
 * @param {string} url - The url of the scene file.
 * @property {string} name - The name of the scene.
 * @property {string} url - The url of the scene file.
 * @property {boolean} loaded - Returns true if the scene data is still being loaded.
 */
class SceneRegistryItem {
    constructor(name, url) {
        this.name = name;
        this.url = url;
        this.data = null;
        this._loading = false;
        this._onLoadedCallbacks = [];
    }

    get loaded() {
        return !!this.data;
    }

    get loading() {
        return this._loading;
    }
}

export { SceneRegistryItem };
