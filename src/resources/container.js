Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ContainerResource
     * @classdesc Resource handler used for loading {@link pc.Model} resources.
     * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
     * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
     */
    var ContainerResource = function (data) {
        this.data = data;
    };

    Object.assign(ContainerResource.prototype, {
        destroy: function () {
            var i;

            if (this.animations) {
                for (i = 0; i < this.animations.length; ++i) {
                    this.assets.remove(this.animations[i]);
                    this.animations[i].unload();
                }
                this.animations = null;
            }

            if (this.textures) {
                for (i = 0; i < this.textures.length; ++i) {
                    this.assets.remove(this.textures[i]);
                    this.textures[i].unload();
                }
                this.textures = null;
            }

            if (this.model) {
                this.assets.remove(this.model);
                this.model.unload();
                this.model = null;
            }

            var textures = this.data.textures;
            for (var i=0; i<textures.length; ++i) {
                textures[i].destroy();
            }

            this.data = null;
            this.assets = null;
        }
    });

    /**
     * @class
     * @name pc.ContainerHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading {@link pc.Model} resources.
     * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
     * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
     */
    var ContainerHandler = function (device, defaultMaterial) {
        this._device = device;
        this._defaultMaterial = defaultMaterial;
    };

    Object.assign(ContainerHandler.prototype, {
        /**
         * @function
         * @name pc.ContainerHandler#load
         * @description Fetch model data from a remote url.
         * @param {string} url - The URL of the model data.
         * @param {pc.callbacks.ResourceHandler} callback - Callback function called when the load completes. The
         * callback is of the form fn(err, response), where err is a String error message in
         * the case where the load fails, and response is the model data that has been
         * successfully loaded.
         */
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var options = {
                responseType: pc.Http.ResponseType.ARRAY_BUFFER,
                retry: false
            };

            pc.http.get(url.load, options, function (err, response) {
                if (!callback)
                    return;

                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading model: {0} [{1}]", url.original, err));
                }
            });
        },

        openAsync: function (url, data, asset, callback) {
            var self = this;
            pc.GlbParser.parse(data, this._device, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    // return everything
                    callback(null, new ContainerResource(result));
                }
            });
            return true;
        },

        patch: function (asset, assets) {
            var createAsset = function (type, resource, index) {
                var subAsset = new pc.Asset(asset.name + '/' + type + '/' + index, type, {
                    url: ''
                });
                subAsset.resource = resource;
                subAsset.loaded = true;
                assets.add(subAsset);
                return subAsset;
            };

            var resource = asset.resource;
            var data = resource.data;
            var i;

            // create model asset
            var model = createAsset('model', pc.GlbParser.createModel(data, this._defaultMaterial), 0);

            // create animation assets
            var animations = [];
            for (i = 0; i < data.animations.length; ++i) {
                animations.push(createAsset('animation', data.animations[i], i));
            }

            // create texture assets
            var textures = [];
            for (i = 0; i < textures.length; ++i) {
                textures.push(createAsset('texture', data.textures[i], i));
            }

            resource.model = model;
            resource.animations = animations;
            resource.textures = textures;
            resource.assets = assets;
        }
    });

    return {
        ContainerHandler: ContainerHandler
    };
}());
