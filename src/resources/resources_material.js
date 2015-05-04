pc.extend(pc, function () {
    'use strict';

    // function onTextureAssetChanged (asset, attribute, newValue, oldValue) {
    //     if (attribute !== 'resource') {
    //         return;
    //     }

    //     var material = this;
    //     var dirty = false;

    //     if (oldValue) {
    //         for (var key in material) {
    //             if (material.hasOwnProperty(key)) {
    //                 if (material[key] === oldValue) {
    //                     material[key] = newValue;
    //                     dirty = true;
    //                 }
    //             }
    //         }
    //     }

    //     if (dirty) {
    //         material.update();
    //     } else {
    //         asset.off('change', onTextureAssetChanged, material);
    //     }
    // }

    var MaterialHandler = function (assets) {
        this._assets = assets;
    };

    MaterialHandler.prototype = {
        load: function (url, callback) {
            if (pc.string.startsWith(url, "asset://")) {

            } else {
                // Loading from URL (engine-only)
                pc.net.http.get(url, function(response) {
                    if (callback) {
                        callback(null, response);
                    }
                }, {
                    error: function (status, xhr, e) {
                        if (callback) {
                            callback(pc.string.format("Error loading material: {0} [{1}]", url, status));
                        }
                    }
                });
            }
        },

        open: function (url, data) {
            var material = new pc.PhongMaterial();
            material.init(data);
            return material;
        },

        patch: function (asset, assets) {
            this._updatePhongMaterial(asset.resource, asset.data, assets);

            // handle changes to the material
            asset.off('change', this._onAssetChange, this);
            asset.on('change', this._onAssetChange, this);
        },

        _onAssetChange: function (asset, attribute, value) {
            if (attribute === 'data') {
                this._updatePhongMaterial(asset.resource, value, this._assets);
            }
        },

        _updatePhongMaterial: function (material, data, assets) {
            data.parameters.push({
                name: 'shadingModel',
                type: 'float',
                data: data.shader === 'blinn' ? pc.SPECULAR_BLINN : pc.SPECULAR_PHONG
            });

            var pathMapping = (data.mapping_format === "path");
            var asset;
            var id;

            // Replace texture ids with actual textures
            // Should we copy 'data' here instead of updating in place?
            data.parameters.forEach(function (param, i) {
                if (param.type === 'texture' && param.data && !(param.data instanceof pc.Texture)) {
                    if (pathMapping) {
                        asset = assets.getByUrl(param.data);
                    } else {
                        id = param.data;
                        asset = assets.get(param.data);
                    }

                    if (asset) {
                        asset.ready(function (asset) {
                            data.parameters[i].data = asset.resource;
                            material.init(data); // Q: better just to update single field?
                        });
                        assets.load(asset);
                    } else if (id) {
                        assets.once("add:" + id, function (asset) {
                            asset.ready(function (asset) {
                                data.parameters[i].data = asset.resource;
                                material.init(data);
                            });
                            assets.load(asset);
                        });
                    }
                } else if (param.type === 'cubemap' && param.data && !(param.data instanceof pc.Texture)) {
                    if (pathMapping) {
                        asset = assets.getByUrl(param.data);
                    } else {
                        id = param.data;
                        asset = assets.get(param.data);
                    }

                    if (asset) {
                        asset.ready(function (asset) {
                            param.data = asset.resource;
                            material.init(data);
                        });
                        assets.load(asset);
                    } else if (id) {
                        assets.once("add:" + id, function (asset) {
                            asset.ready(function (asset) {
                                param.data = asset.resource;
                                material.init(data);
                            });
                            assets.load(asset);
                        });
                    }
                }
            });

            // for (var id in textures) {
            //     textures[id].off('change', onTextureAssetChanged, material);
            //     textures[id].on('change', onTextureAssetChanged, material);
            // }

            material.init(data);
        }
    };

    return {
        MaterialHandler: MaterialHandler
    };
}());
