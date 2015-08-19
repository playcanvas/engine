pc.extend(pc, function () {
    /**
     * @name pc.ModelHandler
     * @class Resource Handler for creating pc.Model resources
     * @description {@link pc.ResourceHandler} use to load 3D model resources
     * @param {pc.GraphicsDevice} device The graphics device that will be rendering
     */
    var ModelHandler = function (device) {
        this._device = device;
    };

    ModelHandler.DEFAULT_MATERIAL = new pc.PhongMaterial();

    ModelHandler.prototype = {
        /**
         * @function
         * @name pc.ModelHandler#load
         * @description Fetch model data from a remote url
         */
        load: function (url, callback) {
            pc.net.http.get(url, function (response) {
                if (callback) {
                    callback(null, response);
                }
            }, {
                error: function (status, xhr, e) {
                    if (callback) {
                        callback(pc.string.format("Error loading model: {0} [{1}]", url, status));
                    }
                }
            });
        },

         /**
         * @function
         * @name pc.ModelHandler#open
         * @description Process data in deserialized format into a pc.Model object
         * @param {Object} data The data from model file deserialized into a Javascript Object
         */
        open: function (url, data) {
            var model = null;
            if (data.model.version <= 1) {
                logERROR(pc.string.format("Asset: {0}, is an old model format. Upload source assets to re-import.", url));
            } else if (data.model.version >= 2) {
                var parser = new pc.JsonModelParser(this._device);
                model = parser.parse(data);
            }

            return model;
        },

        patch: function (asset, assets) {
            var resource = asset.resource;
            var data = asset.data;

            resource.meshInstances.forEach(function (meshInstance, i) {
                if (data.mapping) {
                    var handleMaterial = function(asset) {
                        if (asset.resource) {
                            meshInstance.material = asset.resource;
                        } else {
                            asset.once('load', handleMaterial);
                            assets.load(asset);
                        }

                        asset.once('remove', function(asset) {
                            if (meshInstance.material === asset.resource)
                                meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;
                        });
                    };

                    var id = data.mapping[i].material;
                    var url = data.mapping[i].path;

                    if (id !== undefined) { // id mapping
                        if (! id) {
                            meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;
                        } else {
                            var material = assets.get(id);
                            if (material) {
                                handleMaterial(material);
                            } else {
                                assets.once('add:' + id, handleMaterial);
                            }
                        }
                    } else if (url !== undefined && url) {
                        // url mapping
                        var fileUrl = asset.getFileUrl();
                        var dirUrl = pc.path.getDirectory(fileUrl);
                        var path = pc.path.join(dirUrl, data.mapping[i].path);
                        var material = assets.getByUrl(path);

                        if (material) {
                            handleMaterial(material);
                        } else {
                            assets.once('add:url:' + path, handleMaterial);
                        }
                    }
                }
            });
        },
    };

    return {
        ModelHandler: ModelHandler
    };
}());
