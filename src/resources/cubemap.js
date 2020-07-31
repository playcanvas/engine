import {
    ADDRESS_CLAMP_TO_EDGE,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR
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
}

Object.assign(CubemapHandler.prototype, {
    load: function (url, callback, asset) {
        this.loadAssets(asset, callback);
    },

    open: function (url, data, asset) {
        // caller will set our return value to asset.resources[0]. We've already set resources[0],
        // but we must return it again here so it doesn't get overwritten.
        return asset ? asset.resource : null;
    },

    patch: function (asset, registry) {
        this.loadAssets(asset, function (err, result) {
            if (err) {
                // fire error event if patch failed
                registry.fire('error', asset);
                registry.fire('error:' + asset.id, err, asset);
                asset.fire('error', asset);
            }
            // nothing to do since asset:change would have been raised if
            // resources were changed.
        });
    },

    // get the list of dependent asset ids for the cubemap
    getAssetIds: function (cubemapAsset) {
        var result = [];

        // prefiltered cubemap is stored at index 0
        result[0] = cubemapAsset.file;

        // faces are stored at index 1..6
        if ((cubemapAsset.loadFaces || !cubemapAsset.file) && cubemapAsset.data && cubemapAsset.data.textures) {
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
            }
            // else {
            return assetIdA.url === assetIdB.url;       // file/url structure with url and filename
        }
        // else {
        return (assetIdA !== null) === (assetIdB !== null);
    },

    // update the cubemap resources given a newly loaded set of assets with their corresponding ids
    update: function (cubemapAsset, assetIds, assets) {
        var assetData = cubemapAsset.data || {};
        var oldAssets = cubemapAsset._handlerState.assets;
        var oldResources = cubemapAsset._resources;
        var tex, mip, i;

        // faces, prelit cubemap 128, 64, 32, 16, 8, 4
        var resources = [null, null, null, null, null, null, null];

        // texture type used for faces and prelit cubemaps are both taken from
        // cubemap.data.rgbm
        var getType = function () {
            if (assetData.hasOwnProperty('type')) {
                return assetData.type;
            }
            if (assetData.hasOwnProperty('rgbm')) {
                return assetData.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
            }
            return null;
        };

        // handle the prelit data
        if (!cubemapAsset.loaded || assets[0] !== oldAssets[0]) {
            // prelit asset changed
            if (assets[0]) {
                tex = assets[0].resource;
                for (i = 0; i < 6; ++i) {
                    var prelitLevels = [tex._levels[i]];

                    // construct full prem chain on highest prefilter cubemap on ios
                    if (i === 0 && this._device.useTexCubeLod) {
                        for (mip = 1; mip < tex._levels.length; ++mip) {
                            prelitLevels[mip] = tex._levels[mip];
                        }
                    }

                    var prelit = new Texture(this._device, {
                        name: cubemapAsset.name + '_prelitCubemap' + (tex.width >> i),
                        cubemap: true,
                        type: getType() || pc.TEXTURETYPE_RGBM,
                        width: tex.width >> i,
                        height: tex.height >> i,
                        format: tex.format,
                        levels: prelitLevels,
                        fixCubemapSeams: true,
                        addressU: ADDRESS_CLAMP_TO_EDGE,
                        addressV: ADDRESS_CLAMP_TO_EDGE
                    });

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
        if (!cubemapAsset.loaded || !this.cmpArrays(faceAssets, oldAssets.slice(1))) {
            // face assets have changed
            if (faceAssets.indexOf(null) === -1) {
                // extract cubemap level data from face textures
                var faceTextures = faceAssets.map(function (asset) {
                    return asset.resource;
                });
                var faceLevels = [];
                for (mip = 0; mip < faceTextures[0]._levels.length; ++mip) {
                    faceLevels.push(faceTextures.map(function (faceTexture) {  // eslint-disable-line no-loop-func
                        return faceTexture._levels[mip];
                    }));
                }

                var identifyType = function (texture) {
                    return (texture.type === pc.TEXTURETYPE_DEFAULT &&
                        texture.format === pc.PIXELFORMAT_R8_G8_B8_A8) ?
                        pc.TEXTURETYPE_RGBM :
                        texture.type;
                };

                var faces = new Texture(this._device, {
                    name: cubemapAsset.name + '_faces',
                    cubemap: true,
                    type: getType() || identifyType(faceTextures[0]),
                    width: faceTextures[0].width,
                    height: faceTextures[0].height,
                    format: faceTextures[0].format,
                    levels: faceLevels,
                    minFilter: assetData.hasOwnProperty('minFilter') ? assetData.minFilter : faceTextures[0].minFilter,
                    magFilter: assetData.hasOwnProperty('magFilter') ? assetData.magFilter : faceTextures[0].magFilter,
                    anisotropy: assetData.hasOwnProperty('anisotropy') ? assetData.anisotropy : 1,
                    addressU: ADDRESS_CLAMP_TO_EDGE,
                    addressV: ADDRESS_CLAMP_TO_EDGE,
                    fixCubemapSeams: !!assets[0]
                });

                resources[0] = faces;
            }
        } else {
            // no faces changed so keep existing faces cubemap
            resources[0] = oldResources[0] || null;
        }

        // check if any resource changed
        if (!this.cmpArrays(resources, oldResources)) {
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
        var registry = self._registry;

        // one of the dependent assets has finished loading
        var awaiting = 7;
        var onReady = function (index, asset) {
            assets[index] = asset;
            awaiting--;

            if (awaiting === 0) {
                // all dependent assets are finished loading, set them as the active resources
                self.update(cubemapAsset, assetIds, assets);
                callback(null, cubemapAsset.resources);
            }
        };

        // handle a texture asset finished loading.
        // the engine is unable to flip ImageBitmaps (to orient them correctly for cubemaps)
        // so we do that here.
        var onLoad = function (index, asset) {
            var level0 = asset && asset.resource && asset.resource._levels[0];
            if (level0 && typeof ImageBitmap !== 'undefined' && level0 instanceof ImageBitmap) {
                createImageBitmap(level0, {
                    premultiplyAlpha: 'none',
                    imageOrientation: 'flipY'
                })
                    .then( function (imageBitmap) {
                        asset.resource._levels[0] = imageBitmap;
                        onReady(index, asset);
                    })
                    .catch( function (e) {
                        callback(e);
                    });
            } else {
                onReady(index, asset);
            }
        };

        // handle an asset load failure
        var onError = function (index, err, asset) {
            callback(err);
        };

        // process the texture asset
        var processTexAsset = function (index, texAsset) {
            if (texAsset.loaded) {
                // asset already exists
                onLoad(index, texAsset);
            } else {
                // asset is not loaded, register for load and error events
                registry.once('load:' + texAsset.id, onLoad.bind(self, index));
                registry.once('error:' + texAsset.id, onError.bind(self, index));
                if (!texAsset.loading) {
                    // kick off load if it's not already
                    registry.load(texAsset);
                }
            }
        };

        var texAsset;
        for (var i = 0; i < 7; ++i) {
            var assetId = assetIds[i];

            if (!assetId) {
                // no asset
                onReady(i, null);
            } else if (self.compareAssetIds(assetId, loadedAssetIds[i])) {
                // asset id hasn't changed from what is currently set
                onReady(i, loadedAssets[i]);
            } else if (parseInt(assetId, 10) === assetId) {
                // assetId is an asset id
                texAsset = registry.get(assetId);
                if (texAsset) {
                    processTexAsset(i, texAsset);
                } else {
                    // if we are unable to find the dependent asset, then we introduce here an
                    // asynchronous step. this gives the caller (for example the scene loader)
                    // a chance to add the dependent scene texture to registry before we attempt
                    // to get the asset again.
                    setTimeout(function (index, assetId_) {
                        var texAsset = registry.get(assetId_);
                        if (texAsset) {
                            processTexAsset(index, texAsset);
                        } else {
                            onError(index, "failed to find dependent cubemap asset=" + assetId_);
                        }
                    }.bind(null, i, assetId));
                }
            } else {
                // assetId is a url or file object and we're responsible for creating it
                var file = (typeof assetId === "string") ? {
                    url: assetId,
                    filename: assetId
                } : assetId;
                texAsset = new Asset(cubemapAsset.name + "_part_" + i, "texture", file);
                registry.add(texAsset);
                registry.once('load:' + texAsset.id, onLoad.bind(self, i));
                registry.once('error:' + texAsset.id, onError.bind(self, i));
                registry.load(texAsset);
            }
        }
    }
});

export { CubemapHandler };
