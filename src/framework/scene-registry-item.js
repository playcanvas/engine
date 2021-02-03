/**
 * @class
 * @name pc.SceneRegistryItem
 * @description Item to be stored in the {@link pc.SceneRegistry}.
 * @param {string} name - The name of the scene.
 * @param {string} url - The url of the scene file.
 * @property {string} name - The name of the scene.
 * @property {string} url - The url of the scene file.
 */
class SceneRegistryItem {
    constructor(name, url) {
        this.name = name;
        this.url = url;
    }
}

export { SceneRegistryItem };
