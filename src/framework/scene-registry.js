import { path } from '../core/path.js';

import { ABSOLUTE_URL } from '../asset/constants.js';

import { ComponentSystem } from './components/system.js';

import { SceneRegistryItem } from './scene-registry-item.js';

/**
 * @class
 * @name pc.SceneRegistry
 * @description Container for storing the name and url for scene files.
 * @param {pc.Application} app - The application.
 */
class SceneRegistry {
    constructor(app) {
        this._app = app;
        this._list = [];
        this._index = {};
        this._urlIndex = {};
    }

    destroy() {
        this._app = null;
    }

    /**
     * @function
     * @name pc.SceneRegistry#list
     * @description Return the list of scene.
     * @returns {pc.SceneRegistryItem[]} All items in the registry.
     */
    list() {
        return this._list;
    }

    /**
     * @function
     * @name  pc.SceneRegistry#add
     * @description  Add a new item to the scene registry.
     * @param {string} name - The name of the scene.
     * @param {string} url -  The url of the scene file.
     * @returns {boolean} Returns true if the scene was successfully added to the registry, false otherwise.
     */
    add(name, url) {
        if (this._index.hasOwnProperty(name)) {
            // #ifdef DEBUG
            console.warn('pc.SceneRegistry: trying to add more than one scene called: ' + name);
            // #endif
            return false;
        }

        var item = new SceneRegistryItem(name, url);

        var i = this._list.push(item);
        this._index[item.name] = i - 1;
        this._urlIndex[item.url] = i - 1;

        return true;
    }

    /**
     * @function
     * @name  pc.SceneRegistry#find
     * @description  Find a Scene by name and return the {@link pc.SceneRegistryItem}.
     * @param  {string} name - The name of the scene.
     * @returns {pc.SceneRegistryItem} The stored data about a scene.
     */
    find(name) {
        if (this._index.hasOwnProperty(name)) {
            return this._list[this._index[name]];
        }

        return null;
    }

    /**
     * @function
     * @name  pc.SceneRegistry#findByUrl
     * @description  Find a scene by the URL and return the {@link pc.SceneRegistryItem}.
     * @param  {string} url - The URL to search by.
     * @returns {pc.SceneRegistryItem} The stored data about a scene.
     */
    findByUrl(url) {
        if (this._urlIndex.hasOwnProperty(url)) {
            return this._list[this._urlIndex[url]];
        }
        return null;
    }

    /**
     * @function
     * @name  pc.SceneRegistry#remove
     * @description  Remove an item from the scene registry.
     * @param  {string} name - The name of the scene.
     */
    remove(name) {
        if (this._index.hasOwnProperty(name)) {
            var i = this._index[name];
            var item = this._list[i];

            delete this._urlIndex[item.url];
            // remove from index
            delete this._index[name];

            // remove from list
            this._list.splice(i, 1);

            // refresh index
            for (i = 0; i < this._list.length; i++) {
                item = this._list[i];
                this._index[item.name] = i;
                this._urlIndex[item.url] = i;
            }
        }
    }

    // Private function to load scene data with the option to cache
    // This allows us to retain expected behavior of loadSceneSettings and loadSceneHierarchy where they
    // don't store loaded data which may be undesired behavior with projects that have many scenes.
    _loadSceneData(sceneItem, storeInCache, callback) {
        // If it's a sceneItem, we want to be able to cache the data
        // that is loaded so we don't do a subsequent http requests
        // on the same scene later

        // If it's just a URL then attempt to find the scene item in
        // the registry else create a temp SceneRegistryItem to use
        // for this function
        var url = sceneItem;

        if (sceneItem instanceof SceneRegistryItem) {
            url = sceneItem.url;
        } else {
            sceneItem = this.findByUrl(url);
            if (!sceneItem) {
                sceneItem = new SceneRegistryItem('Untitled', url);
            }
        }

        if (!sceneItem.url) {
            callback("URL or SceneRegistryItem is null when loading a scene");
            return;
        }

        // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
        // Split loading into load and open
        var handler = this._app.loader.getHandler("hierarchy");

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !ABSOLUTE_URL.test(url)) {
            url = path.join(this._app.assets.prefix, url);
        }

        // If we have the data already loaded, no need to do another HTTP request
        if (sceneItem.loaded) {
            callback(null, sceneItem);
            return;
        }

        sceneItem._onLoadedCallbacks.push(callback);

        if (!sceneItem._loading) {
            handler.load(url, function (err, data) {
                sceneItem.data = data;
                sceneItem._loading = false;

                for (var i = 0; i < sceneItem._onLoadedCallbacks.length; i++) {
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
     * @function
     * @name pc.SceneRegistry#loadSceneData
     * @description Use to load the scene data and handles caching of that data to reduce the number of the network
     * requests when the same scenes are loaded multiple times. Can also be used to load data ahead of
     * {@link pc.SceneRegistry.loadSceneHierarchy} and {@link pc.SceneRegistry.loadSceneSettings} calls to make
     * scene loading quicker for the user.
     * @param {pc.SceneRegistryItem | string} sceneItem - The scene item or URL of the scene file. Usually this will be "scene_id.json".
     * @param {pc.callbacks.LoadSceneData} callback - The function to call after loading,
     * passed (err, sceneItem) where err is null if no errors occurred.
     */
    loadSceneData(sceneItem, callback) {
        this._loadSceneData(sceneItem, true, callback);
    }

    /**
     * @function
     * @name pc.SceneRegistry#unloadSceneData
     * @description Unloads scene data that has been loaded previously.
     * @param {pc.SceneRegistryItem | string} sceneItem - The scene item or URL of the scene file. Usually this will be "scene_id.json".
     * @param {pc.callbacks.UnloadSceneData} callback - The function to call after loading,
     */
    unloadSceneData(sceneItem, callback) {
        var url = sceneItem;

        if (sceneItem instanceof SceneRegistryItem) {
            url = sceneItem.url;
        } else {
            sceneItem = this.findByUrl(url);
            if (!sceneItem) {
                sceneItem = new SceneRegistryItem('Untitled', url);
            }
        }

        sceneItem.data = null;
    }

    /**
     * @function
     * @name pc.SceneRegistry#loadSceneHierarchy
     * @description Load a scene file, create and initialize the Entity hierarchy
     * and add the hierarchy to the application root Entity.
     * @param {pc.SceneRegistryItem | string} sceneItem - The scene item or URL of the scene file. Usually this will be "scene_id.json".
     * @param {pc.callbacks.LoadHierarchy} callback - The function to call after loading,
     * passed (err, entity) where err is null if no errors occurred.
     * @example
     *
     * var sceneItem = app.scenes.find("Scene Name");
     * app.scenes.loadSceneHierarchy(sceneItem, function (err, entity) {
     *     if (!err) {
     *         var e = app.root.find("My New Entity");
     *     } else {
     *         // error
     *     }
     * });
     */
    loadSceneHierarchy(sceneItem, callback) {
        var self = this;

        // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
        // Split loading into load and open
        var handler = this._app.loader.getHandler("hierarchy");

        this._loadSceneData(sceneItem, false, function (err, sceneItem) {
            if (err) {
                if (callback) callback(err);
                return;
            }

            var url = sceneItem.url;
            var data = sceneItem.data;

            // called after scripts are preloaded
            var _loaded = function () {
                self._app.systems.script.preloading = true;
                var entity = handler.open(url, data);

                self._app.systems.script.preloading = false;

                // clear from cache because this data is modified by entity operations (e.g. destroy)
                self._app.loader.clearCache(url, "hierarchy");

                // add to hierarchy
                self._app.root.addChild(entity);

                // initialize components
                ComponentSystem.initialize(entity);
                ComponentSystem.postInitialize(entity);

                if (callback) callback(err, entity);
            };

            // load priority and referenced scripts before opening scene
            self._app._preloadScripts(data, _loaded);
        });
    }

    /**
     * @function
     * @name pc.SceneRegistry#loadSceneSettings
     * @description Load a scene file and apply the scene settings to the current scene.
     * @param {pc.SceneRegistryItem | string} sceneItem - The scene item or URL of the scene file. Usually this will be "scene_id.json".
     * @param {pc.callbacks.LoadSettings} callback - The function called after the settings
     * are applied. Passed (err) where err is null if no error occurred.
     * @example
     *
     * var sceneItem = app.scenes.find("Scene Name");
     * app.scenes.loadSceneHierarchy(sceneItem, function (err, entity) {
     *     if (!err) {
     *         var e = app.root.find("My New Entity");
     *     } else {
     *         // error
     *     }
     * });
     */
    loadSceneSettings(sceneItem, callback) {
        var self = this;

        this._loadSceneData(sceneItem, false, function (err, sceneItem) {
            if (!err) {
                self._app.applySceneSettings(sceneItem.data.settings);
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
     * @function
     * @name  pc.SceneRegistry#loadScene
     * @description Load the scene hierarchy and scene settings. This is an internal method used
     * by the {pc.Application}.
     * @param {string} url - The URL of the scene file.
     * @param {pc.callbacks.LoadScene} callback - The function called after the settings are
     * applied. Passed (err, scene) where err is null if no error occurred and scene is the
     * {@link pc.Scene}.
     */
    loadScene(url, callback) {
        var self = this;

        var handler = this._app.loader.getHandler("scene");

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !ABSOLUTE_URL.test(url)) {
            url = path.join(this._app.assets.prefix, url);
        }

        handler.load(url, function (err, data) {
            if (!err) {
                var _loaded = function () {
                    // parse and create scene
                    self._app.systems.script.preloading = true;
                    var scene = handler.open(url, data);

                    // Cache the data as we are loading via URL only
                    var sceneItem = self.findByUrl(url);
                    if (sceneItem && !sceneItem.loaded) {
                        sceneItem.data = data;
                    }

                    self._app.systems.script.preloading = false;

                    // clear scene from cache because we'll destroy it when we load another one
                    // so data will be invalid
                    self._app.loader.clearCache(url, "scene");

                    self._app.loader.patch({
                        resource: scene,
                        type: "scene"
                    }, self._app.assets);

                    self._app.root.addChild(scene.root);

                    // Initialise pack settings
                    if (self._app.systems.rigidbody && typeof Ammo !== 'undefined') {
                        self._app.systems.rigidbody.gravity.set(scene._gravity.x, scene._gravity.y, scene._gravity.z);
                    }

                    if (callback) {
                        callback(null, scene);
                    }
                };

                // preload scripts before opening scene
                self._app._preloadScripts(data, _loaded);
            } else {
                if (callback) {
                    callback(err);
                }
            }
        });
    }
}

export { SceneRegistry };
