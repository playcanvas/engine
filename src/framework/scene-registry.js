import { path } from '../core/path.js';
import { Debug } from '../core/debug.js';

import { ABSOLUTE_URL } from './asset/constants.js';

import { SceneRegistryItem } from './scene-registry-item.js';

/**
 * Callback used by {@link SceneRegistry#loadSceneHierarchy}.
 *
 * @callback LoadHierarchyCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {import('./entity.js').Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * Callback used by {@link SceneRegistry#loadSceneSettings}.
 *
 * @callback LoadSettingsCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * Callback used by {@link SceneRegistry#changeScene}.
 *
 * @callback ChangeSceneCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {import('./entity.js').Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * Callback used by {@link SceneRegistry#loadScene}.
 *
 * @callback LoadSceneCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {import('./entity.js').Entity} [entity] - The loaded root entity if no errors were encountered.
 */

/**
 * Callback used by {@link SceneRegistry#loadSceneData}.
 *
 * @callback LoadSceneDataCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 * @param {SceneRegistryItem} [sceneItem] - The scene registry item if no errors were encountered.
 */

/**
 * Container for storing and loading of scenes. An instance of the registry is created on the
 * {@link AppBase} object as {@link AppBase#scenes}.
 *
 * @category Graphics
 */
class SceneRegistry {
    /**
     * @type {import('./app-base.js').AppBase}
     * @private
     */
    _app;

    /**
     * @type {SceneRegistryItem[]}
     * @private
     */
    _list = [];

    /** @private */
    _index = {};

    /** @private */
    _urlIndex = {};

    /**
     * Create a new SceneRegistry instance.
     *
     * @param {import('./app-base.js').AppBase} app - The application.
     */
    constructor(app) {
        this._app = app;
    }

    /** @ignore */
    destroy() {
        this._app = null;
    }

    /**
     * Return the list of scene.
     *
     * @returns {SceneRegistryItem[]} All items in the registry.
     */
    list() {
        return this._list;
    }

    /**
     * Add a new item to the scene registry.
     *
     * @param {string} name - The name of the scene.
     * @param {string} url - The url of the scene file.
     * @returns {boolean} Returns true if the scene was successfully added to the registry, false otherwise.
     */
    add(name, url) {
        if (this._index.hasOwnProperty(name)) {
            Debug.warn('pc.SceneRegistry: trying to add more than one scene called: ' + name);
            return false;
        }

        const item = new SceneRegistryItem(name, url);

        const i = this._list.push(item);
        this._index[item.name] = i - 1;
        this._urlIndex[item.url] = i - 1;

        return true;
    }

    /**
     * Find a Scene by name and return the {@link SceneRegistryItem}.
     *
     * @param {string} name - The name of the scene.
     * @returns {SceneRegistryItem|null} The stored data about a scene or null if no scene with
     * that name exists.
     */
    find(name) {
        if (this._index.hasOwnProperty(name)) {
            return this._list[this._index[name]];
        }

        return null;
    }

    /**
     * Find a scene by the URL and return the {@link SceneRegistryItem}.
     *
     * @param {string} url - The URL to search by.
     * @returns {SceneRegistryItem|null} The stored data about a scene or null if no scene with
     * that URL exists.
     */
    findByUrl(url) {
        if (this._urlIndex.hasOwnProperty(url)) {
            return this._list[this._urlIndex[url]];
        }

        return null;
    }

    /**
     * Remove an item from the scene registry.
     *
     * @param {string} name - The name of the scene.
     */
    remove(name) {
        if (this._index.hasOwnProperty(name)) {
            const idx = this._index[name];
            let item = this._list[idx];

            delete this._urlIndex[item.url];
            // remove from index
            delete this._index[name];

            // remove from list
            this._list.splice(idx, 1);

            // refresh index
            for (let i = 0; i < this._list.length; i++) {
                item = this._list[i];
                this._index[item.name] = i;
                this._urlIndex[item.url] = i;
            }
        }
    }

    /**
     * Private function to load scene data with the option to cache. This allows us to retain
     * expected behavior of loadSceneSettings and loadSceneHierarchy where they don't store loaded
     * data which may be undesired behavior with projects that have many scenes.
     *
     * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
     * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
     * @param {boolean} storeInCache - Whether to store the loaded data in the scene item.
     * @param {LoadSceneDataCallback} callback - The function to call after loading,
     * passed (err, sceneItem) where err is null if no errors occurred.
     * @private
     */
    _loadSceneData(sceneItem, storeInCache, callback) {
        const app = this._app;
        // If it's a sceneItem, we want to be able to cache the data that is loaded so we don't do
        // a subsequent http requests on the same scene later

        // If it's just a URL or scene name then attempt to find the scene item in the registry
        // else create a temp SceneRegistryItem to use for this function as the scene may not have
        // been added to the registry
        let url = sceneItem;
        if (typeof sceneItem === 'string') {
            sceneItem = this.findByUrl(url) || this.find(url) || new SceneRegistryItem('Untitled', url);
        }

        url = sceneItem.url;

        if (!url) {
            callback("Cannot find scene to load");
            return;
        }

        // If we have the data already loaded, no need to do another HTTP request
        if (sceneItem.loaded) {
            callback(null, sceneItem);
            return;
        }

        // include asset prefix if present
        if (app.assets && app.assets.prefix && !ABSOLUTE_URL.test(url)) {
            url = path.join(app.assets.prefix, url);
        }

        sceneItem._onLoadedCallbacks.push(callback);

        if (!sceneItem._loading) {
            // Because we need to load scripts before we instance the hierarchy (i.e. before we
            // create script components), split loading into load and open
            const handler = app.loader.getHandler("hierarchy");

            handler.load(url, (err, data) => {
                sceneItem.data = data;
                sceneItem._loading = false;

                for (let i = 0; i < sceneItem._onLoadedCallbacks.length; i++) {
                    sceneItem._onLoadedCallbacks[i](err, sceneItem);
                }

                // Remove the data if it's not been requested to store in cache
                if (!storeInCache) {
                    sceneItem.data = null;
                }

                sceneItem._onLoadedCallbacks.length = 0;
            });
        }

        sceneItem._loading = true;
    }

    /**
     * Loads and stores the scene data to reduce the number of the network requests when the same
     * scenes are loaded multiple times. Can also be used to load data before calling
     * {@link SceneRegistry#loadSceneHierarchy} and {@link SceneRegistry#loadSceneSettings} to make
     * scene loading quicker for the user.
     *
     * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
     * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
     * @param {LoadSceneDataCallback} callback - The function to call after loading,
     * passed (err, sceneItem) where err is null if no errors occurred.
     * @example
     * const sceneItem = app.scenes.find("Scene Name");
     * app.scenes.loadSceneData(sceneItem, function (err, sceneItem) {
     *     if (err) {
     *         // error
     *     }
     * });
     */
    loadSceneData(sceneItem, callback) {
        this._loadSceneData(sceneItem, true, callback);
    }

    /**
     * Unloads scene data that has been loaded previously using {@link SceneRegistry#loadSceneData}.
     *
     * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
     * {@link SceneRegistry#find} or URL of the scene file. Usually this will be "scene_id.json".
     * @example
     * const sceneItem = app.scenes.find("Scene Name");
     * app.scenes.unloadSceneData(sceneItem);
     */
    unloadSceneData(sceneItem) {
        if (typeof sceneItem === 'string') {
            sceneItem = this.findByUrl(sceneItem);
        }

        if (sceneItem) {
            sceneItem.data = null;
        }
    }

    _loadSceneHierarchy(sceneItem, onBeforeAddHierarchy, callback) {
        this._loadSceneData(sceneItem, false, (err, sceneItem) => {
            if (err) {
                if (callback) {
                    callback(err);
                }
                return;
            }

            if (onBeforeAddHierarchy) {
                onBeforeAddHierarchy(sceneItem);
            }

            const app = this._app;

            // called after scripts are preloaded
            const _loaded = () => {
                // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
                // Split loading into load and open
                const handler = app.loader.getHandler("hierarchy");

                app.systems.script.preloading = true;
                const entity = handler.open(sceneItem.url, sceneItem.data);

                app.systems.script.preloading = false;

                // clear from cache because this data is modified by entity operations (e.g. destroy)
                app.loader.clearCache(sceneItem.url, "hierarchy");

                // add to hierarchy
                app.root.addChild(entity);

                // initialize components
                app.systems.fire('initialize', entity);
                app.systems.fire('postInitialize', entity);
                app.systems.fire('postPostInitialize', entity);

                if (callback) callback(null, entity);
            };

            // load priority and referenced scripts before opening scene
            app._preloadScripts(sceneItem.data, _loaded);
        });
    }

    /**
     * Load a scene file, create and initialize the Entity hierarchy and add the hierarchy to the
     * application root Entity.
     *
     * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
     * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
     * @param {LoadHierarchyCallback} callback - The function to call after loading,
     * passed (err, entity) where err is null if no errors occurred.
     * @example
     * const sceneItem = app.scenes.find("Scene Name");
     * app.scenes.loadSceneHierarchy(sceneItem, function (err, entity) {
     *     if (!err) {
     *         const e = app.root.find("My New Entity");
     *     } else {
     *         // error
     *     }
     * });
     */
    loadSceneHierarchy(sceneItem, callback) {
        this._loadSceneHierarchy(sceneItem, null, callback);
    }

    /**
     * Load a scene file and apply the scene settings to the current scene.
     *
     * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
     * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
     * @param {LoadSettingsCallback} callback - The function called after the settings
     * are applied. Passed (err) where err is null if no error occurred.
     * @example
     * const sceneItem = app.scenes.find("Scene Name");
     * app.scenes.loadSceneSettings(sceneItem, function (err) {
     *     if (!err) {
     *         // success
     *     } else {
     *         // error
     *     }
     * });
     */
    loadSceneSettings(sceneItem, callback) {
        this._loadSceneData(sceneItem, false, (err, sceneItem) => {
            if (!err) {
                this._app.applySceneSettings(sceneItem.data.settings);
                if (callback) {
                    callback(null);
                }
            } else {
                if (callback) {
                    callback(err);
                }
            }
        });
    }

    /**
     * Change to a new scene. Calling this function will load the scene data, delete all
     * entities and graph nodes under `app.root` and load the scene settings and hierarchy.
     *
     * @param {SceneRegistryItem | string} sceneItem - The scene item (which can be found with
     * {@link SceneRegistry#find}, URL of the scene file (e.g."scene_id.json") or name of the scene.
     * @param {ChangeSceneCallback} [callback] - The function to call after loading,
     * passed (err, entity) where err is null if no errors occurred.
     * @example
     * app.scenes.changeScene("Scene Name", function (err, entity) {
     *     if (!err) {
     *         // success
     *     } else {
     *         // error
     *     }
     * });
     */
    changeScene(sceneItem, callback) {
        const app = this._app;

        const onBeforeAddHierarchy = (sceneItem) => {
            // Destroy all nodes on the app.root
            const { children } = app.root;
            while (children.length) {
                children[0].destroy();
            }
            app.applySceneSettings(sceneItem.data.settings);
        };

        this._loadSceneHierarchy(sceneItem, onBeforeAddHierarchy, callback);
    }

    /**
     * Load the scene hierarchy and scene settings. This is an internal method used by the
     * {@link AppBase}.
     *
     * @param {string} url - The URL of the scene file.
     * @param {LoadSceneCallback} callback - The function called after the settings are
     * applied. Passed (err, scene) where err is null if no error occurred and scene is the
     * {@link Scene}.
     */
    loadScene(url, callback) {
        const app = this._app;

        const handler = app.loader.getHandler("scene");

        // include asset prefix if present
        if (app.assets && app.assets.prefix && !ABSOLUTE_URL.test(url)) {
            url = path.join(app.assets.prefix, url);
        }

        handler.load(url, (err, data) => {
            if (!err) {
                const _loaded = () => {
                    // parse and create scene
                    app.systems.script.preloading = true;
                    const scene = handler.open(url, data);

                    // Cache the data as we are loading via URL only
                    const sceneItem = this.findByUrl(url);
                    if (sceneItem && !sceneItem.loaded) {
                        sceneItem.data = data;
                    }

                    app.systems.script.preloading = false;

                    // clear scene from cache because we'll destroy it when we load another one
                    // so data will be invalid
                    app.loader.clearCache(url, "scene");

                    app.loader.patch({
                        resource: scene,
                        type: "scene"
                    }, app.assets);

                    app.root.addChild(scene.root);

                    // Initialize pack settings
                    if (app.systems.rigidbody && typeof Ammo !== 'undefined') {
                        app.systems.rigidbody.gravity.set(scene._gravity.x, scene._gravity.y, scene._gravity.z);
                    }

                    if (callback) {
                        callback(null, scene);
                    }
                };

                // preload scripts before opening scene
                app._preloadScripts(data, _loaded);
            } else {
                if (callback) {
                    callback(err);
                }
            }
        });
    }
}

export { SceneRegistry };
