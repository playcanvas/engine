/**
 * Item to be stored in the {@link SceneRegistry}.
 */
class SceneRegistryItem {
    /**
     * Creates a new SceneRegistryItem instance.
     *
     * @param {string} name - The name of the scene.
     * @param {string} url - The url of the scene file.
     */
    constructor(name, url) {
        /**
         * The name of the scene.
         *
         * @type {string}
         */
        this.name = name;
        /**
         * The url of the scene file.
         *
         * @type {string}
         */
        this.url = url;
        this.data = null;
        this._loading = false;
        this._onLoadedCallbacks = [];
    }

    /**
     * Returns true if the scene data has loaded.
     *
     * @type {boolean}
     */
    get loaded() {
        return !!this.data;
    }

    /**
     * Returns true if the scene data is still being loaded.
     *
     * @type {boolean}
     */
    get loading() {
        return this._loading;
    }
}

export { SceneRegistryItem };
