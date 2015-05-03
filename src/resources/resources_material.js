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

    var MaterialHandler = function () {
    };

    MaterialHandler.prototype = {
        load: function (url, callback) {
            if (pc.string.startsWith(url, "asset://")) {
                // Loading from asset (platform)
                // promise = new pc.promise.Promise(function (resolve, reject) {
                //     var asset = this._getAssetFromRequest(request);
                //     if (!asset) {
                //         reject(pc.string("Can't load material, asset %s not found", request.canonical));
                //     }
                //     resolve(asset.data);
                // }.bind(this));
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

            // asset.on('change', function (asset, attribute, value) {
            //     if (attribute === 'data') {
            //         this._updatePhongMaterial(material, value, request);
            //     }
            // }, this);

            return material;
        },

        patch: function (asset, assets) {
            this._updatePhongMaterial(asset.resource, asset.data, assets);

            // handle changes to the material
            // asset.on('change', function (asset, attribute, value) {
            //     if (attribute === 'data') {
            //         this._updatePhongMaterial(material, value, request);
            //     }
            // }, this);
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
                    } else if (id) {
                        assets.once("add:" + id, function (asset) {
                            asset.ready(function (asset) {
                                data.parameters[i].data = asset.resource;
                                material.init(data);
                            });
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
                    } else if (id) {
                        assets.once("add:" + id, function (asset) {
                            asset.ready(function (asset) {
                                param.data = asset.resource;
                                material.init(data);
                            });
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
