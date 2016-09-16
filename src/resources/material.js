pc.extend(pc, function () {
    'use strict';

    var PARAMETER_TYPES = {
        ambient: 'vec3',
        ambientTnumber: 'boolean',
        aoMap: 'texture',
        aoMapVertexColor: 'boolean',
        aoMapChannel: 'string',
        aoMapUv: 'number',
        aoMapTiling: 'vec2',
        aoMapOffset: 'vec2',
        occludeSpecular: 'boolean',
        diffuse: 'vec3',
        diffuseMap: 'texture',
        diffuseMapVertexColor: 'boolean',
        diffuseMapChannel: 'string',
        diffuseMapUv: 'number',
        diffuseMapTiling: 'vec2',
        diffuseMapOffset: 'vec2',
        diffuseMapTnumber: 'boolean',
        specular: 'vec3',
        specularMapVertexColor: 'boolean',
        specularMapChannel: 'string',
        specularMapUv: 'number',
        specularMap: 'texture',
        specularMapTiling: 'vec2',
        specularMapOffset: 'vec2',
        specularMapTnumber: 'boolean',
        specularAntialias: 'boolean',
        useMetalness: 'boolean',
        metalnessMap: 'texture',
        metalnessMapVertexColor: 'boolean',
        metalnessMapChannel: 'string',
        metalnessMapUv: 'number',
        metalnessMapTiling: 'vec2',
        metalnessMapOffset: 'vec2',
        metalnessMapTnumber: 'boolean',
        metalness: 'number',
        conserveEnergy: 'boolean',
        shininess: 'number',
        glossMap: 'texture',
        glossMapVertexColor: 'boolean',
        glossMapChannel: 'string',
        glossMapUv: 'number',
        glossMapTiling: 'vec2',
        glossMapOffset: 'vec2',
        fresnelModel: 'number',
        fresnelFactor: 'float',
        emissive: 'vec3',
        emissiveMap: 'texture',
        emissiveMapVertexColor: 'boolean',
        emissiveMapChannel: 'string',
        emissiveMapUv: 'number',
        emissiveMapTiling: 'vec2',
        emissiveMapOffset: 'vec2' ,
        emissiveMapTint: 'boolean',
        emissiveIntensity: 'number',
        normalMap: 'texture',
        normalMapTiling: 'vec2',
        normalMapOffset: 'vec2',
        normalMapUv: 'number',
        bumpMapFactor: 'number',
        heightMap: 'texture',
        heightMapChannel: 'string',
        heightMapUv: 'number',
        heightMapTiling: 'vec2',
        heightMapOffset: 'vec2',
        heightMapFactor: 'number',
        alphaTest: 'number',
        opacity: 'number',
        opacityMap: 'texture',
        opacityMapVertexColor: 'boolean',
        opacityMapChannel: 'string',
        opacityMapUv: 'number',
        opacityMapTiling: 'vec2',
        opacityMapOffset: 'vec2',
        reflectivity: 'number',
        refraction: 'number',
        refractionIndex: 'number',
        sphereMap: 'texture',
        cubeMap: 'cubemap',
        cubeMapProjection: 'number',
        cubeMapProjectionBox: 'boundingbox',
        lightMap: 'texture',
        lightMapVertexColor: 'boolean',
        lightMapChannel: 'string',
        lightMapUv: 'number',
        lightMapTiling: 'vec2',
        lightMapOffset: 'vec2',
        depthTest: 'boolean' ,
        depthWrite: 'boolean',
        cull: 'number',
        blendType: 'number',
        shadowSampleType: 'number',
        shadingModel: 'number'
    };

    var onCubemapAssetLoad = function (asset, attribute, newValue, oldValue) {
        var props = [
            'cubeMap',
            'prefilteredCubeMap128',
            'prefilteredCubeMap64',
            'prefilteredCubeMap32',
            'prefilteredCubeMap16',
            'prefilteredCubeMap8',
            'prefilteredCubeMap4'
        ];

        for (var i = 0; i < props.length; i++) {
            if (this[props[i]] !== asset.resources[i])
                this[props[i]] = asset.resources[i];
        }

        this.update();
    };

    var MaterialHandler = function (assets) {
        this._assets = assets;
    };

    MaterialHandler.prototype = {
        load: function (url, callback) {
            // Loading from URL (engine-only)
            pc.http.get(url, function(err, response) {
                if (!err) {
                    if (callback) {
                        callback(null, response);
                    }
                } else {
                    if (callback) {
                        callback(pc.string.format("Error loading material: {0} [{1}]", url, err));
                    }
                }
            });
        },

        open: function (url, data) {
            var material = new pc.StandardMaterial();

            // TODO: this is a bit of a mess,
            // Probably should create a new data block for the material
            // and put it on the asset. This preserves originally loaded asset data
            // and can be removed/cleared when asset is unloaded.
            if (!data.parameters) {
                this._createParameters(data);
            }

            material.init(data);
            material._data = data; // temp storage in case we need this during patching (engine-only)
            return material;
        },

        // creates parameters array from data dictionary
        _createParameters: function (data) {
            var parameters = [];

            if (!data.shadingModel) {
                data.shadingModel = data.shader === 'blinn' ? pc.SPECULAR_BLINN : pc.SPECULAR_PHONG;
            }

            var shader = data.shader;

            // remove shader for the following loop
            delete data.shader;

            for (var key in data) {
                if (!data.hasOwnProperty(key)) continue;

                parameters.push({
                    name: key,
                    type: PARAMETER_TYPES[key],
                    data: data[key]
                });
            }

            data.shader = shader;

            data.parameters = parameters;
        },

        patch: function (asset, assets) {
            if (asset.data.shader === undefined) {
                // for engine-only users restore original material data
                asset.data = asset.resource._data;
                delete asset.resource._data;
            }
            this._updateStandardMaterial(asset, asset.data, assets);

            // handle changes to the material
            asset.off('change', this._onAssetChange, this);
            asset.on('change', this._onAssetChange, this);
            asset.on('unload', this._onAssetUnload, this);
        },

        _onAssetChange: function (asset, attribute, value) {
            if (attribute === 'data') {
                this._updateStandardMaterial(asset, value, this._assets);
            }
        },

        _onAssetUnload: function (asset) {
            // remove the parameter block we created which includes texture references
            delete asset.data.parameters;
            delete asset.data.chunks;
            delete asset.data.name;
        },

        _updateStandardMaterial: function (asset, data, assets) {
            var material = asset.resource;
            var dir;

            if (asset.file) {
                dir = pc.path.getDirectory(asset.getFileUrl());
            }

            data.name = asset.name;

            if (!data.parameters)
                this._createParameters(data);

            var pathMapping = (data.mapping_format === "path");

            data.chunks = asset.resource.chunks;

            // Replace texture ids with actual textures
            // Should we copy 'data' here instead of updating in place?
            // TODO: This calls material.init() for _every_ texture and cubemap field in the texture with an asset. Combine this into one call to init!
            data.parameters.forEach(function (param, i) {
                var id;

                if (param.type === 'texture') {
                    if (! material._assetHandlers)
                        material._assetHandlers = { };

                    // asset handler
                    var handler = material._assetHandlers[param.name];

                    if (param.data && !(param.data instanceof pc.Texture)) {
                        if (pathMapping) {
                            asset = assets.getByUrl(pc.path.join(dir, param.data));
                        } else {
                            id = param.data;
                            asset = assets.get(param.data);
                        }

                        // unbind events
                        if (handler) {
                            assets.off('load:' + handler.id, handler.bind);
                            assets.off('add:' + handler.id, handler.add);
                            assets.off('remove:' + handler.id, handler.remove);
                            if (handler.url) {
                                assets.off('add:url:' + handler.url, handler.add);
                                assets.off('remove:url:' + handler.url, handler.remove);
                            }
                            material._assetHandlers[param.name] = null;
                        }

                        // bind events
                        handler = material._assetHandlers[param.name] = {
                            id: id,
                            url: pathMapping ? pc.path.join(dir, param.data) : '',
                            bind: function(asset) {
                                // TODO
                                // update specific param instead of all of them
                                data.parameters[i].data = asset.resource;
                                material[data.parameters[i].name] = asset.resource;
                                material.update();
                            },
                            add: function(asset) {
                                assets.load(asset);
                            },
                            remove: function (asset) {
                                if (material[data.parameters[i].name] === asset.resource) {
                                    data.parameters[i].data = null;
                                    material[data.parameters[i].name] = null;
                                    material.update();
                                }
                            }
                        };

                        // listen load events on texture
                        if (id) {
                            assets.on('load:' + id, handler.bind);
                            assets.on('remove:' + id, handler.remove);
                        } else if (pathMapping) {
                            assets.on("load:url:" + pc.path.join(dir, param.data), handler.bind);
                            assets.on('remove:url:' + pc.path.join(dir, param.data), handler.remove);
                        }

                        if (asset) {
                            if (asset.resource) {
                                handler.bind(asset);
                            }

                            assets.load(asset);
                        } else if (id) {
                            assets.once('add:' + id, handler.add);
                        } else if (pathMapping) {
                            assets.once('add:url:' + handler.url, handler.add);
                        }
                    } else if (handler && ! param.data) {
                        // unbind events
                        assets.off('load:' + handler.id, handler.bind);
                        assets.off('add:' + handler.id, handler.add);
                        assets.off('remove:' + handler.id, handler.remove);
                        if (handler.url) {
                            assets.off('add:url:' + handler.url, handler.add);
                            assets.off('remove:url:' + handler.url, handler.remove);
                        }
                        material._assetHandlers[param.name] = null;
                    }
                } else if (param.type === 'cubemap' && param.data && !(param.data instanceof pc.Texture)) {
                    if (pathMapping) {
                        asset = assets.getByUrl(pc.path.join(dir, param.data));
                    } else {
                        id = param.data;
                        asset = assets.get(param.data);
                    }

                    var onAdd = function(asset) {
                        if (data.shadingModel === pc.SPECULAR_PHONG)
                            asset.loadFaces = true;

                        asset.ready(onReady);
                        assets.load(asset);
                    };

                    var onReady = function(asset) {
                        param.data = asset.resource;
                        // if this is a prefiltered map, then extra resources are present
                        if (asset.resources.length > 1) {
                            data.parameters.push({
                                name: 'prefilteredCubeMap128',
                                data: asset.resources[1]
                            });
                            data.parameters.push({
                                name: 'prefilteredCubeMap64',
                                data: asset.resources[2]
                            });
                            data.parameters.push({
                                name: 'prefilteredCubeMap32',
                                data: asset.resources[3]
                            });
                            data.parameters.push({
                                name: 'prefilteredCubeMap16',
                                data: asset.resources[4]
                            });
                            data.parameters.push({
                                name: 'prefilteredCubeMap8',
                                data: asset.resources[5]
                            });
                            data.parameters.push({
                                name: 'prefilteredCubeMap4',
                                data: asset.resources[6]
                            });
                        }
                        material.init(data);

                        asset.off('load', onCubemapAssetLoad, material);
                        asset.on('load', onCubemapAssetLoad, material);
                    };

                    if (asset) {
                        onAdd(asset);
                    } else if (id) {
                        assets.once("add:" + id, onAdd);
                    } else if (pathMapping) {
                        assets.once("add:url:" + pc.path.join(dir, param.data), function (asset) {
                            asset.ready(function (asset) {
                                // TODO
                                // update specific param instead of all of them
                                data.parameters[i].data = asset.resource;
                                material.init(data);

                                asset.off('load', onCubemapAssetLoad, material);
                                asset.on('load', onCubemapAssetLoad, material);
                            });
                            assets.load(asset);
                        });
                    }
                }
            });

            material.init(data);
        }
    };

    return {
        MaterialHandler: MaterialHandler,
        getMaterialParamType: function (name) {
            return PARAMETER_TYPES[name];
        }
    };
}());
