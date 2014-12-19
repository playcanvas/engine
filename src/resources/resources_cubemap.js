pc.extend(pc.resources, function () {

    function onTextureAssetChanged (asset, attribute, newValue, oldValue) {
        if (attribute !== 'resource') {
            return;
        }

        var cubemap = this;
        var sources = cubemap.getSource();
        var dirty = false;

        if (oldValue) {
            var oldImage = oldValue.getSource();
            for (var i = 0; i < sources.length; i++) {
                if (sources[i] === oldImage) {
                    sources[i] = newValue.getSource();
                    dirty = true;
                }
            }
        }

        if (dirty) {
            cubemap.setSource(sources);
        } else {
            asset.off('change', onTextureAssetChanged, cubemap);
        }
    }

    var CubemapResourceHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
    };
    CubemapResourceHandler = pc.inherits(CubemapResourceHandler, pc.resources.ResourceHandler);

    CubemapResourceHandler.prototype.load = function (request, options) {
        var promise = null;

        if (pc.string.startsWith(request.canonical, "asset://")) {
            // Loading from asset (platform)
            promise = new pc.promise.Promise(function (resolve, reject) {
                var asset = this._getAssetFromRequest(request);
                if (!asset) {
                    reject(pc.string.format("Can't load cubemap, asset {0} not found", request.canonical));
                }

                // load images before resolving the promise to make sure
                // we have them when we create the cubemap, otherwise this will
                // cause issues in cases like cubemaps used in materials which will be
                // rendered without textures in the Designer
                this._loadCubemapImages(null, asset.data).then(function (images) {
                    var data = pc.extend({}, asset.data);
                    data.images = images;
                    resolve(data);
                }, function (error) {
                    reject(error);
                });

            }.bind(this));
        } else {
            // Loading from URL (engine-only)
            // Load cubemap data from a file (as opposed to from an asset)
            promise = new pc.promise.Promise(function (resolve, reject) {
                pc.net.http.get(request.canonical, function(response) {
                    var data = pc.extend({}, response);
                    var textures = response.textures;
                    if (textures.length) {
                        // Create and load all referenced textures
                        var assets = [];
                        textures.forEach(function (path) {
                             var filename = pc.path.getBasename(path);
                             var url = pc.path.join(pc.path.split(request.canonical)[0], path);
                             assets.push(new pc.asset.Asset(filename, 'texture', {
                                 url: url
                             }));
                        });

                        this._assets.load(assets).then(function (responses) {
                             // Only when referenced assets are loaded do we resolve the cubemap load
                            data.images = responses.map(function (texture) {
                                return texture.getSource();
                            });

                            resolve(data);
                         }, function (error) {
                            reject(error);
                         });
                    } else {
                        resolve(data);
                    }
                }.bind(this), {
                    error: function () {
                        reject();
                    }
                });
            }.bind(this));
        }

        return promise;
    };

    CubemapResourceHandler.prototype.open = function (data, request, options) {
        var cubemap = null;

        // create cubemap
        if (request.result) {
            cubemap = request.result;
        } else {
            cubemap = new pc.Texture(this._device, {
                format: pc.PIXELFORMAT_R8_G8_B8,
                cubemap: true
            });
        }

        var images = data.images;
        delete data.images;

        this._updateCubemapData(cubemap, data, images);

        // make sure we update the cubemap if the asset changes
        var asset = this._getAssetFromRequest(request);
        asset.on('change', function (asset, attribute, value) {
            if (attribute === 'data') {
                this._loadCubemapImages(cubemap, value).then(function (images) {
                    this._updateCubemapData(cubemap, value, images);
                }.bind(this));
            }
        }, this);

        return cubemap;
    };

    // Checks if there are 6 non-null images with the correct dimensions in the specified array
    CubemapResourceHandler.prototype._areValidImages = function (images) {
        var result = images && images.length === 6;
        var error;

        if (result) {
            var width = images[0] ? images[0].width : null;
            var height = images[0] ? images[0].height : null;

            for (var i = 0; i < 6; i++) {
                if (!images[i]) {
                    result = false;
                    break;
                }


                if ((!images[i] instanceof HTMLCanvasElement) ||
                    (!images[i] instanceof HTMLImageElement) ||
                    (!images[i] instanceof HTMLVideoElement)) {
                    error = 'Cubemap source is not an instance of HTMLCanvasElement, HTMLImageElement or HTMLVideoElement.';
                    result = false;
                    break;
                }

                if (images[i].width !== width  || images[i].height !== height) {
                    error = 'Cubemap sources do not all share the same dimensions.';
                    result = false;
                    break;
                }
            }

        }

        if (error) {
            alert(error);
        }

        return result;
    };

    // Loads the images of the cubemap - Returns a promise
    CubemapResourceHandler.prototype._loadCubemapImages = function (cubemap, data) {
        var self = this;
        var promise = new pc.promise.Promise(function (resolve, reject) {
            if (data.textures) {
                var assets = [];

                // check if we have 6 assets
                for (var i = 0; i < 6; i++) {
                    if (data.textures[i]) {
                        var asset = self._assets.getAssetById(data.textures[i]);
                        if (asset) {
                            assets.push(asset);
                        } else {
                            reject(pc.string.format('Could not load cubemap - Texture {0} not found', data.textures[i]));
                            return;
                        }
                    } else {
                        // one texture is missing so just return
                        resolve(null);
                        return;
                    }
                }

                // update sources with the new images
                self._assets.load(assets).then(function (textures) {
                    // resolve with new images
                    resolve(textures.map(function (texture) {
                        return texture.getSource();
                    }));
                }, function (error) {
                    reject(error);
                });
            } else {
                // no textures provided so just return
                resolve(null);
            }
        });

        return promise;
    };

    // Updates cubemap data and reloads textures
    CubemapResourceHandler.prototype._updateCubemapData = function (cubemap, data, images) {
        if (cubemap.name !== data.name) {
            cubemap.name = data.name;
        }

        if (cubemap.minFilter !== data.minFilter) {
            cubemap.minFilter = data.minFilter;
        }

        if (cubemap.magFilter !== data.magFilter) {
            cubemap.magFilter = data.magFilter;
        }

        if (cubemap.addressU !== pc.ADDRESS_CLAMP_TO_EDGE) {
            cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        }

        if (cubemap.addressV !== pc.ADDRESS_CLAMP_TO_EDGE) {
            cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        }

        if (cubemap.maxAnisotropy !== data.anisotropy) {
            cubemap.maxAnisotropy = data.anisotropy;
        }

        if (this._areValidImages(images)) {
            cubemap.setSource(images);
        }

        // register change handlers for texture assets
        var textures = {};
        if (data.textures) {
            for (var i = 0; i < 6; i++) {
                if (data.textures[i]) {
                    var asset = this._assets.getAssetById(data.textures[i]);
                    if (asset) {
                        textures[asset.id] = asset;
                    }
                }
            }
        }

        for (var id in textures) {
            textures[id].off('change', onTextureAssetChanged, cubemap);
            textures[id].on('change', onTextureAssetChanged, cubemap);
        }

    };

    CubemapResourceHandler.prototype._getAssetFromRequest = function (request) {
        if (pc.string.startsWith(request.canonical, "asset://")) {
            return this._assets.getAssetById(parseInt(request.canonical.slice(8)));
        } else {
            return this._assets.getAssetByUrl(request.canonical);
        }
    };

    var CubemapRequest = function (identifier) {
    };
    CubemapRequest = pc.inherits(CubemapRequest, pc.resources.ResourceRequest);
    CubemapRequest.prototype.type = "cubemap";
    CubemapRequest.prototype.Type = pc.Texture;

    return {
        CubemapResourceHandler: CubemapResourceHandler,
        CubemapRequest: CubemapRequest
    };
}())    ;
