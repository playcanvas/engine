import { path } from '../core/path.js';

import { ABSOLUTE_URL } from '../asset/constants.js';

import { ComponentSystem } from './components/system.js';

import { SceneRegistryItem } from './scene-registry-item.js';

/**
 * @class
 * @name SceneRegistry
 * @description Container for storing the name and url for scene files.
 * @param {Application} app - The application.
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
     * @name SceneRegistry#list
     * @description Return the list of scene.
     * @returns {SceneRegistryItem[]} All items in the registry.
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
     * @description  Find a Scene by name and return the {@link SceneRegistryItem}.
     * @param  {string} name - The name of the scene.
     * @returns {SceneRegistryItem} The stored data about a scene.
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
     * @description  Find a scene by the URL and return the {@link SceneRegistryItem}.
     * @param  {string} url - The URL to search by.
     * @returns {SceneRegistryItem} The stored data about a scene.
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


    /**
     * @function
     * @name SceneRegistry#loadSceneHierarchy
     * @description Load a scene file, create and initialize the Entity hierarchy
     * and add the hierarchy to the application root Entity.
     * @param {string} url - The URL of the scene file. Usually this will be "scene_id.json".
     * @param {callbacks.LoadHierarchy} callback - The function to call after loading,
     * passed (err, entity) where err is null if no errors occurred.
     * @example
     *
     * var url = app.scenes.getSceneUrl("Scene Name");
     * app.scenes.loadSceneHierarchy(url, function (err, entity) {
     *     if (!err) {
     *         var e = app.root.find("My New Entity");
     *     } else {
     *         // error
     *     }
     * });
     */
    loadSceneHierarchy(url, callback) {
        var self = this;

        // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
        // Split loading into load and open
        var handler = this._app.loader.getHandler("hierarchy");

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !ABSOLUTE_URL.test(url)) {
            url = path.join(this._app.assets.prefix, url);
        }

        handler.load(url, function (err, data) {
            if (err) {
                if (callback) callback(err);
                return;
            }

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
     * @name SceneRegistry#loadSceneSettings
     * @description Load a scene file and apply the scene settings to the current scene.
     * @param {string} url - The URL of the scene file. This can be looked up using app.getSceneUrl.
     * @param {callbacks.LoadSettings} callback - The function called after the settings
     * are applied. Passed (err) where err is null if no error occurred.
     * @example
     *
     * var url = app.getSceneUrl("Scene Name");
     * app.loadSceneSettings(url, function (err) {
     *     if (!err) {
     *       // success
     *     } else {
     *       // error
     *     }
     * });
     */
    loadSceneSettings(url, callback) {
        var self = this;

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !ABSOLUTE_URL.test(url)) {
            url = path.join(this._app.assets.prefix, url);
        }

        this._app.loader.load(url, "scenesettings", function (err, settings) {
            if (!err) {
                self._app.applySceneSettings(settings);
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
     * by the pc.Application.
     * @param {string} url - The URL of the scene file.
     * @param {callbacks.LoadScene} callback - The function called after the settings are
     * applied. Passed (err, scene) where err is null if no error occurred and scene is the
     * {@link Scene}.
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
