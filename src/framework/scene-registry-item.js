/**
 * Item to be stored in the {@link SceneRegistry}.
 *
 * @category Graphics
 */
class SceneRegistryItem {
    /**
     * The name of the scene.
     *
     * @type {string}
     */
    name;

    /**
     * The url of the scene file.
     *
     * @type {string}
     */
    url;

    /** @ignore */
    data = null;

    /** @private */
    _loading = false;

    /** @private */
    _onLoadedCallbacks = [];

    /**
     * Creates a new SceneRegistryItem instance.
     *
     * @param {string} name - The name of the scene.
     * @param {string} url - The url of the scene file.
     */
    constructor(name, url) {
        this.name = name;
        this.url = url;
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
