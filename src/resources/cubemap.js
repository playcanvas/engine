import {
    ADDRESS_CLAMP_TO_EDGE,
    PIXELFORMAT_R8_G8_B8_A8,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM
} from '../graphics/graphics.js';

import { Asset } from '../asset/asset.js';
import { Texture } from '../graphics/texture.js';

/**
 * @class
 * @name pc.CubemapHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading cubemap {@link pc.Texture} resources.
 * @param {pc.GraphicsDevice} device - The graphics device.
 * @param {pc.AssetRegistry} assets - The asset registry.
 * @param {pc.ResourceLoader} loader - The resource loader.
 */
function CubemapHandler(device, assets, loader) {
    this._device = device;
    this._registry = assets;
    this._loader = loader;
};

Object.assign(CubemapHandler.prototype, {
    load: function (url, callback, asset) {
        this.loadAssets(asset, callback);
    },

    open: function (url, data, asset) {
        // nothing to do
        return asset ? asset.resource : null;
    },

    patch: function (asset, registry) {
        // TODO: check is assets are already busy loading first
        this.loadAssets(asset, function (err, result) {
            if (err) {
                registry.fire('error', asset);
                registry.fire('error:' + asset.id, err, asset);
                asset.fire('error', asset);
            } else {
                registry.fire('load', asset);
                registry.fire('load:' + asset.id, asset);
                asset.fire('load', asset);
            }
        });
    },

    // get the list of dependent asset ids for the cubemap
    getAssetIds: function (cubemapAsset) {
        var result = [];

        // prefiltered cubemap is stored at index 0
        result[0] = cubemapAsset.file;

        // faces are stored at index 1..6
        if (cubemapAsset.data && cubemapAsset.data.textures) {
            for (var i = 0; i < 6; ++i) {
                result[i + 1] = cubemapAsset.data.textures[i];
            }
        } else {
            result[1] = result[2] = result[3] = result[4] = result[5] = result[6] = null;
        }

        return result;
    },

    // test whether two assets ids are the same
    compareAssetIds: function (assetIdA, assetIdB) {
        if (assetIdA && assetIdB) {
            if (parseInt(assetIdA, 10) === assetIdA || typeof assetIdA === "string") {
                return assetIdA === assetIdB;           // id or url
            } else {
                return assetIdA.url === assetIdB.url;   // file/url structure with url and filename
            }
        } else {
            return (assetIdA !== null) === (assetIdB !== null);
        }
    },

    // bitmoji paint cookie
    // document.cookie = "tutorialCompleted=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/939720;";

    // update the cubemap resources given a newly loaded set of assets with their corresponding ids
    update: function (cubemapAsset, assetIds, assets) {
        var oldAssets = cubemapAsset._handlerState.assets;
        var oldResources = cubemapAsset._resources;
        var tex, mip, i;

        // faces, prelit cubemap 128, 64, 32, 16, 8, 4
        var resources = [null, null, null, null, null, null, null];

        // handle the prelit data
        if (assets[0] !== oldAssets[0]) {
            // prelit asset changed
            if (assets[0]) {
                tex = assets[0].resource;
                for (i = 0; i < 6; ++i) {
                    var prelit = new Texture(this._device, {
                        name: cubemapAsset.name + '_prelitCubemap' + i,
                        cubemap: true,
                        fixCubemapSeams: true,
                        mipmaps: true,
                        format: tex.format,
                        type: cubemapAsset.data.type || TEXTURETYPE_DEFAULT,
                        width: tex.width >> i,
                        height: tex.height >> i
                    });

                    // set level 0
                    prelit._levels[0] = tex._levels[i];

                    // construct full prem chain in the case of ios
                    if (this._device.useTexCubeLod) {
                        for (mip = 1; mip < tex._levels.length; ++mip) {
                            prelit._levels[mip] = tex._levels[mip];
                        }
                    }

                    prelit.upload();
                    resources[i + 1] = prelit;
                }
            }
        } else {
            // prelit asset didn't change so keep the existing cubemap resources
            resources[1] = oldResources[1] || null;
            resources[2] = oldResources[2] || null;
            resources[3] = oldResources[3] || null;
            resources[4] = oldResources[4] || null;
            resources[5] = oldResources[5] || null;
            resources[6] = oldResources[6] || null;
        }

        var faceAssets = assets.slice(1);
        if (!this.cmpArrays(faceAssets, oldAssets.slice(1))) {
            // face assets have changed
            if (faceAssets.indexOf(null) === -1) {
                // extract cubemap level data from face textures
                var faceTextures = faceAssets.map(function (asset) {
                    return asset.resource;
                });
                var levels = [];
                for (mip = 0; mip < faceTextures[0]._levels.length; ++mip) {
                    levels.push(faceTextures.map(function (faceTexture) {  // eslint-disable-line no-loop-func
                        return faceTexture._levels[mip];
                    }));
                }

                var faces = new pc.Texture(this._device, {
                    name: cubemapAsset.name + '_faces',
                    cubemap: true,
                    rgbm: faceAssets[0].resource.rgbm,
                    width: faceAssets[0].resource.width,
                    height: faceAssets[0].resource.height,
                    format: faceAssets[0].resource.format,
                    levels: levels
                });

                resources[0] = faces;
            }
        } else {
            // no faces changed so keep existing faces cubemap
            resources[0] = oldResources[0];
        }

        // set the new resources, change events will fire
        cubemapAsset.resources = resources;
        cubemapAsset._handlerState.assetIds = assetIds;
        cubemapAsset._handlerState.assets = assets;

        // destroy the old cubemap resources that are not longer needed
        for (i = 0; i < oldResources.length; ++i) {
            if (oldResources[i] !== null && resources.indexOf(oldResources[i]) === -1) {
                oldResources[i].destroy();
            }
        }

        // destroy old assets which have been replaced
        for (i = 0; i < oldAssets.length; ++i) {
            if (oldAssets[i] !== null && assets.indexOf(oldAssets[i]) === -1) {
                oldAssets[i].unload();
            }
        }
    },

    cmpArrays: function (arr1, arr2) {
        if (arr1.length !== arr2.length) {
            return false;
        }
        for (var i = 0; i < arr1.length; ++i) {
            if (arr1[i] !== arr2[i]) {
                return false;
            }
        }
        return true;
    },

    loadAssets: function (cubemapAsset, callback) {
        // initialize asset structures for tracking load requests
        if (!cubemapAsset.hasOwnProperty('_handlerState')) {
            cubemapAsset._handlerState = {
                // the list of requested asset ids in order of [prelit cubemap, 6 faces]
                assetIds: [null, null, null, null, null, null, null],
                // the dependent (loaded, active) texture assets
                assets: [null, null, null, null, null, null, null]
            };
        }

        var self = this;
        var assetIds = self.getAssetIds(cubemapAsset);
        var assets = [null, null, null, null, null, null, null];
        var loadedAssetIds = cubemapAsset._handlerState.assetIds;
        var loadedAssets = cubemapAsset._handlerState.assets;

        // one of the dependent assets has finished loading
        var awaiting = 7;
        var onLoad = function(index, asset) {
            assets[index] = asset;
            awaiting--;

            if (awaiting === 0) {
                // all dependent assets are finished loading, set them as the active resources
                self.update(cubemapAsset, assetIds, assets);
                callback(null, cubemapAsset.resources);
            }
        };

        // handle an asset load failure
        var onError = function (index, err, asset) {
            callback(err);
            return;
        };

        var registry = self._registry;
        var texAsset;
        for (var i = 0; i < 7; ++i) {
            var assetId = assetIds[i];

            if (!assetId) {
                // no asset
                onLoad(i, null);
            } else if (self.compareAssetIds(assetId, loadedAssetIds[i])) {
                // asset id hasn't changed from what is currently set
                onLoad(i, loadedAssets[i]);
            } else if (parseInt(assetId, 10) === assetId) {
                // assetId is an asset id
                texAsset = registry.get(assetId);
                if (texAsset) {
                    if (texAsset.loaded) {
                        // asset already exists
                        onLoad(i, texAsset);
                    } else {
                        // asset is not loaded, register for load and error events
                        registry.once('load:' + assetId, onLoad.bind(self, i));
                        registry.once('error:' + assetId, onError.bind(self, i));
                        if (!texAsset.loading) {
                            // kick off load if it's not already
                            registry.load(texAsset);
                        }
                    }
                } else {
                    // asset hasn't been created yet, wait till it is
                    registry.on('add:' + assetId, function (index, texAsset) {
                        // store the face asset and kick off loading immediately
                        registry.once('load:' + assetId, onLoad.bind(self, index));
                        registry.once('error:' + assetId, onError.bind(self, index));
                        registry.load(texAsset);
                    }.bind(null, i));
                }
            } else {
                // assetId is a url or file object and we're responsible for creating it
                var file = (typeof assetId === "string") ? {
                    url: assetId,
                    filename: assetId
                } : assetId;
                texAsset = new pc.Asset(cubemapAsset.name + "_part_" + i, "texture", file, cubemapAsset.data.faceData);
                registry.add(texAsset);
                registry.once('load:' + texAsset.id, onLoad.bind(self, i));
                registry.once('error:' + texAsset.id, onError.bind(self, i));
                registry.load(texAsset);
            }
        }
    }
});

export { CubemapHandler };
