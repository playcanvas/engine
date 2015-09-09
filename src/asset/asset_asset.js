pc.extend(pc, function () {

    // auto incrementing number for asset ids
    var assetIdCounter = -1;

    /**
    * @name pc.Asset
    * @class An asset record of a file or data resource that can be loaded by the engine.
    * The asset contains three important fields:<br/>
    * <strong>file</strong>: contains the details of a file (filename, url) which contains the resource data, e.g. an image file for a texture asset<br/>
    * <strong>data</strong>: contains a JSON blob which contains either the resource data for the asset (e.g. material data) or additional data for the file (e.g. material mappings for a model)<br/>
    * <strong>resource</strong>: contains the final resource when it is loaded. (e.g. a {@link pc.PhongMaterial} or a {@link pc.Texture})<br/>
    *
    * See the {@link pc.AssetRegistry} for details on loading resources from assets.
    * @property {String} name The name of the asset
    * @property {Number} id The asset id
    * @property {String} type The type of the asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture", "cubemap", "html", "css"]
    * @property {pc.Tags} tags Interface for tagging
    * @property {Object} file The file details or null if no file
    * @property {String} [file.url] The URL of the resource file that contains the asset data
    * @property {String} [file.filename] The filename of the resource file
    * @property {Number} [file.size] The size of the resource file
    * @property {String} [file.hash] The MD5 hash of the resource file data and the Asset data field.
    * @property {Object} data JSON data that contains either the complete resource data (e.g. in the case of a material) or additional data (e.g. in the case of a model it contains mappings from mesh to material)
    * @property {Object} resource A reference to the resource when the asset is loaded. e.g. a {@link pc.Texture} or a {@link pc.Model}
    * @property {Array} resources A reference to the resources of the asset when it's loaded (an asset can hold more runtime resources than one e.g. cubemaps)
    * @property {Boolean} preload If true the asset will be loaded during the preload phase of application set up.
    * @property {Boolean} loaded True if the resource is loaded e.g. if asset.resource is not null
    * @constructor Create a new Asset record. Generally, Assets are created in the loading process and you won't need to create them by hand.
    * @param {String} name A non-unique but human-readable name which can be later used to retrieve the asset.
    * @param {String} type Type of asset. One of ["animation", "audio", "image", "json", "material", "model", "text", "texture", "cubemap"]
    * @param {Object} file Details about the file the asset is made from. At the least must contain the 'url' field. For assets that don't contain file data use null.
    * @example
    * var file = {
    *   filename: "filename.txt",
    *   url: "/example/filename.txt",
    * }
    * @param {Object} [data] JSON object with additional data about the asset (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of materials)
    * @example
    * var asset = new pc.Asset("a texture", "texture", {
    *     url: "http://example.com/my/assets/here/texture.png"
    * });
    */
    var Asset = function (name, type, file, data) {
        var file, data// optional arguments

        this._id = ++assetIdCounter;

        this.name = arguments[0];
        this.type = arguments[1];
        this.tags = new pc.Tags(this);
        this.preload = false;

        this._file = arguments[2] ? {
            filename: file.filename,
            size: file.size,
            hash: file.hash,
            url: file.url
        } : null;

        this._data = arguments[3] || {};

        // This is where the loaded resource will be
        // this.resource = null;
        this._resources = [];

        // is resource loaded
        this.loaded = false;
        this.loading = false;

        pc.events.attach(this);
    };


    Asset.prototype = {
        /**
        * @name pc.Asset#getFileUrl
        * @function
        * @description Return the URL required to fetch the file for this asset.
        * @returns {String} The URL
        * @example
        * var assets = app.assets.find("My Image", "texture");
        * var img = "&lt;img src='" + assets[0].getFileUrl() + "'&gt;";
        */
        getFileUrl: function () {
            if (!this.file) {
                return null;
            }

            return this.file.url;
        },

        /**
        * @function
        * @name pc.Asset#ready
        * @description Take a callback which is called as soon as the asset is loaded. If the asset is already loaded the callback is called straight away
        * @param {Function} callback The function called when the asset is ready. Passed the (asset) arguments
        * @example
        * var asset = app.assets.find("My Asset");
        * asset.ready(function (asset) {
        *   // asset loaded
        * });
        * app.assets.load(asset);
        */
        ready: function (callback, scope) {
            scope = scope || this;

            if (this.resource) {
                callback.call(scope, this);
            } else {
                this.once("load", function (asset) {
                    callback.call(scope, asset);
                });
            }
        },

        /**
        * @function
        * @name pc.Asset#unload
        * @description Mark asset as unloaded and delete reference to resource
        * @example
        * var asset = app.assets.find("My Asset");
        * asset.unloade();
        * // asset.resource is null
        */
        unload: function () {
            this.resource = null;
            this.loaded = false;
        }
    };


    Object.defineProperty(Asset.prototype, 'id', {
        get: function() {
            return this._id;
        },

        set: function (value) {
            this._id = value;
            if (value > assetIdCounter)
                assetIdCounter = value;
        }
    });

    Object.defineProperty(Asset.prototype, 'file', {
        get: function() {
            return this._file;
        },

        set: function (value) {
            // fire change event when the file changes
            // so that we reload it if necessary
            var old = this._file;
            this._file = value;
            // check if we set a new file or if the hash has changed
            if (! value || ! old || (value && old && value.hash !== old.hash)) {
                this.fire('change', this, 'file', value, old);

                // trigger reloading
                if (this.loaded) {
                    if (this.type === 'cubemap') {
                        this.registry._loader.patch(this, this.registry);
                    } else {
                        this.loaded = false;
                        this.registry.load(this);
                    }
                }
            }
        }
    });

    Object.defineProperty(Asset.prototype, 'data', {
        get: function() {
            return this._data;
        },

        set: function (value) {
            // fire change event when data changes
            // because the asset might need reloading if that happens
            var old = this._data;
            this._data = value;
            if (value !== old) {
                this.fire('change', this, 'data', value, old);

                if (this.loaded)
                    this.registry._loader.patch(this, this.registry);
            }
        }
    });

    Object.defineProperty(Asset.prototype, 'resource', {
        get: function () {
            return this._resources[0];
        },

        set: function (value) {
            var _old = this._resources[0];
            this._resources[0] = value;
            this.fire('change', this, 'resource', value, _old);
        }
    });

    Object.defineProperty(Asset.prototype, 'resources', {
        get: function () {
            return this._resources;
        },

        set: function (value) {
            var _old = this._resources;
            this._resources = value;
            this.fire('change', this, 'resources', value, _old);
        }
    });

    return {
        Asset: Asset,
        ASSET_ANIMATION: 'animation',
        ASSET_AUDIO: 'audio',
        ASSET_IMAGE: 'image',
        ASSET_JSON: 'json',
        ASSET_MODEL: 'model',
        ASSET_MATERIAL: 'material',
        ASSET_TEXT: 'text',
        ASSET_TEXTURE: 'texture',
        ASSET_CUBEMAP: 'cubemap'
    };
}());
