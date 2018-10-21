Object.assign(pc, function () {

    /**
     * @private
     * @constructor
     * @name pc.SceneRegistryItem
     * @description Item to be stored in the {@link pc.SceneRegistry}
     * @param {String} name The name of the scene
     * @param {String} url The url of the scene file
     */
    var SceneRegistryItem = function (name, url) {
        this.name = name;
        this.url = url;
    };

    /**
     * @private
     * @constructor
     * @name pc.SceneRegistry
     * @description Container for storing the name and url for scene files
     * @param {pc.Application} app The application
     */
    var SceneRegistry = function (app) {
        this._app = app;
        this._list = [];
        this._index = {};
        this._urlIndex = {};
    };

    SceneRegistry.prototype.destroy = function () {
        this._app = null;
    };

    /**
     * @private
     * @function
     * @name pc.SceneRegistry#list
     * @description return the list of scene
     * @returns {pc.SceneRegistryItem[]} All items in the registry
     */
    SceneRegistry.prototype.list = function () {
        return this._list;
    };

    /**
     * @private
     * @function
     * @name  pc.SceneRegistry#add
     * @description  Add a new item to the scene registry
     * @param {String} name The name of the scene
     * @param {String} url  The url of the scene file
     * @returns {Boolean} Returns true if the scene was successfully added to the registry, false otherwise
     */
    SceneRegistry.prototype.add = function (name, url) {
        if (this._index.hasOwnProperty(name)) {
            // #ifdef DEBUG
            console.warn('pc.SceneRegistry: trying to add more than one scene called: ' + name);
            // #endif
            return false;
        }

        var item = new pc.SceneRegistryItem(name, url);

        var i = this._list.push(item);
        this._index[item.name] = i - 1;
        this._urlIndex[item.url] = i - 1;

        return true;
    };

    /**
     * @private
     * @function
     * @name  pc.SceneRegistry#find
     * @description  Find a Scene by name and return the {@link pc.SceneRegistryItem}
     * @param  {String} name The name of the scene
     * @returns {pc.SceneRegistryItem} The stored data about a scene
     */
    SceneRegistry.prototype.find = function (name) {
        if (this._index.hasOwnProperty(name)) {
            return this._list[this._index[name]];
        }
        return null;

    };

    /**
     * @private
     * @function
     * @name  pc.SceneRegistry#findByUrl
     * @description  Find a scene by the URL and return the {@link pc.SceneRegistryItem}
     * @param  {String} url The URL to search by
     * @returns {pc.SceneRegistryItem} The stored data about a scene
     */
    SceneRegistry.prototype.findByUrl = function (url) {
        if (this._urlIndex.hasOwnProperty(url)) {
            return this._list[this._urlIndex[url]];
        }
        return null;
    };

    /**
     * @private
     * @function
     * @name  pc.SceneRegistry#remove
     * @description  Remove an item from the scene registry
     * @param  {String} name The name of the scene
     */
    SceneRegistry.prototype.remove = function (name) {
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
    };


    /**
     * @private
     * @function
     * @name pc.SceneRegistry#loadSceneHierarchy
     * @description Load a scene file, create and initialize the Entity hierarchy
     * and add the hierarchy to the application root Entity.
     * @param {String} url The URL of the scene file. Usually this will be "scene_id.json"
     * @param {Function} callback The function to call after loading, passed (err, entity) where err is null if no errors occurred.
     * @example
     *
     * var url = app.getSceneUrl("Scene Name");
     * app.loadSceneHierarchy(url, function (err, entity) {
     *     if (!err) {
     *       var e = app.root.find("My New Entity");
     *     } else {
     *       // error
     *     }
     *   }
     * });
     */
    SceneRegistry.prototype.loadSceneHierarchy = function (url, callback) {
        var self = this;

        // Because we need to load scripts before we instance the hierarchy (i.e. before we create script components)
        // Split loading into load and open
        var handler = this._app.loader.getHandler("hierarchy");

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !pc.ABSOLUTE_URL.test(url)) {
            url = pc.path.join(this._app.assets.prefix, url);
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
                pc.ComponentSystem.initialize(entity);
                pc.ComponentSystem.postInitialize(entity);

                if (callback) callback(err, entity);
            };

            // load priority and referenced scripts before opening scene
            self._app._preloadScripts(data, _loaded);
        });
    };

    /**
     * @private
     * @function
     * @name pc.SceneRegistry#loadSceneSettings
     * @description Load a scene file and apply the scene settings to the current scene
     * @param {String} url The URL of the scene file. This can be looked up using app.getSceneUrl
     * @param {Function} callback The function called after the settings are applied. Passed (err) where err is null if no error occurred.
     * @example
     *
     * var url = app.getSceneUrl("Scene Name");
     * app.loadSceneSettings(url, function (err) {
     *     if (!err) {
     *       // success
     *     } else {
     *       // error
     *     }
     *   }
     * });
     */
    SceneRegistry.prototype.loadSceneSettings = function (url, callback) {
        var self = this;

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !pc.ABSOLUTE_URL.test(url)) {
            url = pc.path.join(this._app.assets.prefix, url);
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
    };

    /**
     * @private
     * @function
     * @name  pc.SceneRegistry#loadScene
     * @description Load the scene hierarchy and scene settings. This is an internal method used by the pc.Application
     * @param  {String}   url      The URL of the scene file
     * @param  {Function} callback The function called after the settings are applied. Passed (err, scene) where err is null if no error occurred and scene is the pc.Scene
     */
    SceneRegistry.prototype.loadScene =  function (url, callback) {
        var self = this;

        var handler = this._app.loader.getHandler("scene");

        // include asset prefix if present
        if (this._app.assets && this._app.assets.prefix && !pc.ABSOLUTE_URL.test(url)) {
            url = pc.path.join(this._app.assets.prefix, url);
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
                        self._app.systems.rigidbody.setGravity(scene._gravity.x, scene._gravity.y, scene._gravity.z);
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
    };

    return {
        SceneRegistry: SceneRegistry,
        SceneRegistryItem: SceneRegistryItem
    };

}());
