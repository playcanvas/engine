pc.extend(pc, function () {

    // auto incrementing number for asset ids
    var assetIdCounter = 0;

    var ABSOLUTE_URL = new RegExp(
        '^' + // beginning of the url
        '\\s*' +  // ignore leading spaces (some browsers trim the url automatically, but we can't assume that)
        '(?:' +  // beginning of protocol scheme (non-captured regex group)
        '[a-z]+[a-z0-9\\-\\+\\.]*' + // protocol scheme must (RFC 3986) consist of "a letter and followed by any combination of letters, digits, plus ("+"), period ("."), or hyphen ("-")."
        ':' + // protocol scheme must end with colon character
        ')?' + // end of optional scheme group, the group is optional since the string may be a protocol-relative absolute URL
        '//', // a absolute url must always begin with two forward slash characters (ignoring any leading spaces and protocol scheme)
        'i' // non case-sensitive flag
    );

    /**
    * @name pc.Asset
    * @class An asset record of a file or data resource that can be loaded by the engine.
    * The asset contains three important fields:<br/>
    * <strong>file</strong>: contains the details of a file (filename, url) which contains the resource data, e.g. an image file for a texture asset<br/>
    * <strong>data</strong>: contains a JSON blob which contains either the resource data for the asset (e.g. material data) or additional data for the file (e.g. material mappings for a model)<br/>
    * <strong>resource</strong>: contains the final resource when it is loaded. (e.g. a {@link pc.StandardMaterial} or a {@link pc.Texture})<br/>
    *
    * See the {@link pc.AssetRegistry} for details on loading resources from assets.
    * @property {String} name The name of the asset
    * @property {Number} id The asset id
    * @property {String} type The type of the asset. One of ["animation", "audio", "binary", "cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "text", "texture"]
    * @property {pc.Tags} tags Interface for tagging. Allows to find assets by tags using {@link pc.AssetRegistry#findByTag} method.
    * @property {Object} file The file details or null if no file
    * @property {String} [file.url] The URL of the resource file that contains the asset data
    * @property {String} [file.filename] The filename of the resource file
    * @property {Number} [file.size] The size of the resource file
    * @property {String} [file.hash] The MD5 hash of the resource file data and the Asset data field
    * @property {Object} data JSON data that contains either the complete resource data (e.g. in the case of a material) or additional data (e.g. in the case of a model it contains mappings from mesh to material)
    * @property {Object} resource A reference to the resource when the asset is loaded. e.g. a {@link pc.Texture} or a {@link pc.Model}
    * @property {Array} resources A reference to the resources of the asset when it's loaded. An asset can hold more runtime resources than one e.g. cubemaps
    * @property {Boolean} preload If true the asset will be loaded during the preload phase of application set up.
    * @property {Boolean} loaded True if the resource is loaded. e.g. if asset.resource is not null
    * @property {pc.AssetRegistry} registry The asset registry that this Asset belongs to
    * @description Create a new Asset record. Generally, Assets are created in the loading process and you won't need to create them by hand.
    * @param {String} name A non-unique but human-readable name which can be later used to retrieve the asset.
    * @param {String} type Type of asset. One of ["animation", "audio", "binary", "cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "text", "texture"]
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
        this._id = ++assetIdCounter;

        this.name = name || '';
        this.type = type;
        this.tags = new pc.Tags(this);
        this._preload = false;

        this.variants = new pc.AssetVariants(this);

        this._file = null;
        this._data = data || { };

        // This is where the loaded resource will be
        // this.resource = null;
        this._resources = [ ];

        // is resource loaded
        this.loaded = false;
        this.loading = false;

        this.registry = null;

        pc.events.attach(this);

        if (file) this.file = file;
    };

    /**
    * @event
    * @name pc.Asset#load
    * @description Fired when the asset has completed loading
    * @param {pc.Asset} asset The asset that was loaded
    */

    /**
    * @event
    * @name pc.Asset#remove
    * @description Fired when the asset is removed from the asset registry
    * @param {pc.Asset} asset The asset that was removed
    */

    /**
    * @event
    * @name pc.Asset#error
    * @description Fired if the asset encounters an error while loading
    * @param {String} err The error message
    * @param {pc.Asset} asset The asset that generated the error
    */

    /**
    * @event
    * @name pc.Asset#change
    * @description Fired when one of the asset properties `file`, `data`, `resource` or `resources` is changed
    * @param {pc.Asset} asset The asset that was loaded
    * @param {String} property The name of the property that changed
    * @param {*} value The new property value
    * @param {*} oldValue The old property value
    */

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
            var file = this.getPreferredFile();

            if (! file || ! file.url)
                return null;

            return this.registry && this.registry.prefix &&
                ! ABSOLUTE_URL.test(file.url) ? this.registry.prefix + file.url : file.url;
        },

        getPreferredFile: function() {
            if (! this.file)
                return null;

            if (this.type === 'texture') {
                var device = this.registry._loader.getHandler('texture')._device;

                if (this.variants.pvr && device.extCompressedTexturePVRTC) {
                    return this.variants.pvr;
                } else if (this.variants.dxt && device.extCompressedTextureS3TC) {
                    return this.variants.dxt;
                } else if (this.variants.etc1 && device.extCompressedTextureETC1) {
                    return this.variants.etc1;
                }
            }

            return this.file;
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

        reload: function() {
            // no need to be reloaded
            if (! this.loaded)
                return;

            if (this.type === 'cubemap') {
                this.registry._loader.patch(this, this.registry);
            } else {
                this.loaded = false;
                this.registry.load(this);
            }
        },

        /**
        * @function
        * @name pc.Asset#unload
        * @description Destroys the associated resource and marks asset as unloaded.
        * @example
        * var asset = app.assets.find("My Asset");
        * asset.unload();
        * // asset.resource is null
        */
        unload: function () {
            this.fire('unload', this);
            this.registry.fire('unload:' + this.id, this);

            if (this.resource && this.resource.destroy) {
                this.resource.destroy();
            }
            this.resource = null;
            this.loaded = false;

            var url = this.getFileUrl();
            // remove resource from loader cache
            if (this.type !== "script" && this.file && this.file.hash) {
                url += "&t=" + this.file.hash;
            }
            this.registry._loader.clearCache(url, this.type);
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
            // set/unset file property of file hash been changed

            if (!! value !== !! this._file || (value && this._file && value.hash !== this._file)) {
                if (value) {
                    if (! this._file)
                        this._file = { };

                    this._file.url = value.url;
                    this._file.filename = value.filename;
                    this._file.hash = value.hash;
                    this._file.size = value.size;
                    this._file.variants = this.variants;

                    if (value.hasOwnProperty('variants')) {
                        this.variants.clear();

                        if (value.variants) {
                            for(var key in value.variants) {
                                if (! value.variants[key])
                                    continue;

                                this.variants[key] = value.variants[key];
                            }
                        }
                    }

                    this.fire('change', this, 'file', this._file, this._file);
                    this.reload();
                } else {
                    this._file = null;
                    this.variants.clear();
                }
            } else if (value && this._file && value.hasOwnProperty('variants')) {
                this.variants.clear();

                if (value.variants) {
                    for(var key in value.variants) {
                        if (! value.variants[key])
                            continue;

                        this.variants[key] = value.variants[key];
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

    Object.defineProperty(Asset.prototype, 'preload', {
        get: function() {
            return this._preload;
        },
        set: function(value) {
            if (this._preload === !! value)
                return;

            this._preload = value;
            if (this._preload && ! this.loaded && ! this.loading && this.registry)
                this.registry.load(this);
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
        ASSET_CUBEMAP: 'cubemap',
        ASSET_SHADER: 'shader',
        ASSET_CSS: 'css',
        ASSET_HTML: 'html',
        ASSET_SCRIPT: 'script',
        ABSOLUTE_URL: ABSOLUTE_URL
    };
}());
