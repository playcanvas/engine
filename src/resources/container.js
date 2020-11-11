import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { Asset } from '../asset/asset.js';

import { GlbParser } from './parser/glb-parser.js';

/**
 * @class
 * @name pc.ContainerResource
 * @classdesc Container for a list of animations, textures, materials and a model.
 * @param {object} data - The loaded GLB data.
 * @param {pc.Asset[]} animations - Array of assets of animations in the GLB container.
 * @param {pc.Asset[]} textures - Array of assets of textures in the GLB container.
 * @param {pc.Asset[]} materials - Array of assets of materials in the GLB container.
 */
function ContainerResource(data) {
    this.data = data;
    this.model = null;
    this.materials = [];
    this.textures = [];
    this.animations = [];
    this.registry = null;
}

Object.assign(ContainerResource.prototype, {
    destroy: function () {

        var registry = this.registry;

        var destroyAsset = function (asset) {
            registry.remove(asset);
            asset.unload();
        };

        var destroyAssets = function (assets) {
            assets.forEach(function (asset) {
                destroyAsset(asset);
            });
        };

        // unload and destroy assets
        if (this.animations) {
            destroyAssets(this.animations);
            this.animations = null;
        }

        if (this.textures) {
            destroyAssets(this.textures);
            this.textures = null;
        }

        if (this.materials) {
            destroyAssets(this.materials);
            this.materials = null;
        }

        if (this.model) {
            destroyAsset(this.model);
            this.model = null;
        }

        this.data = null;
        this.assets = null;
    }
});

/**
 * @class
 * @name pc.ContainerHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Loads files that contain multiple resources. For example glTF files can contain
 * textures, models and animations.
 * The asset options object can be used to pass load time callbacks for handling the various resources
 * at different stages of loading. The table below lists the resource types and the corresponding
 * supported process functions.
 * ```
 * |---------------------------------------------------------------------|
 * |  resource   |  preprocess |   process   |processAsync | postprocess |
 * |-------------+-------------+-------------+-------------+-------------|
 * | global      |      x      |             |             |      x      |
 * | node        |      x      |      x      |             |      x      |
 * | animation   |      x      |             |             |      x      |
 * | material    |      x      |      x      |             |      x      |
 * | image       |      x      |             |      x      |      x      |
 * | texture     |      x      |             |      x      |      x      |
 * | buffer      |      x      |             |      x      |      x      |
 * | bufferView  |      x      |             |      x      |      x      |
 * |---------------------------------------------------------------------|
 * ```
 * For example, to receive a texture preprocess callback:
 * ```javascript
 * var containerAsset = new pc.Asset(filename, 'container', { url: url, filename: filename }, null, {
 *     texture: {
 *         preprocess: function (gltfTexture) { console.log("texture preprocess"); }
 *     },
 * });
 * ```
 * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
 * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
 */
function ContainerHandler(device, defaultMaterial) {
    this._device = device;
    this._defaultMaterial = defaultMaterial;
}

Object.assign(ContainerHandler.prototype, {
    _getUrlWithoutParams: function (url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    },

    load: function (url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var options = {
            responseType: Http.ResponseType.ARRAY_BUFFER,
            retry: false
        };

        var self = this;

        // parse downloaded file data
        var parseData = function (arrayBuffer) {
            GlbParser.parseAsync(self._getUrlWithoutParams(url.original),
                                 path.extractPath(url.load),
                                 arrayBuffer,
                                 self._device,
                                 asset.registry,
                                 asset.options,
                                 function (err, result) {
                                     if (err) {
                                         callback(err);
                                     } else {
                                         // return everything
                                         callback(null, new ContainerResource(result));
                                     }
                                 });
        };

        if (asset && asset.file && asset.file.contents) {
            // file data supplied by caller
            parseData(asset.file.contents);
        } else {
            // data requires download
            http.get(url.load, options, function (err, response) {
                if (!callback)
                    return;

                if (err) {
                    callback("Error loading model: " + url.original + " [" + err + "]");
                } else {
                    parseData(response);
                }
            });
        }
    },

    open: function (url, data, asset) {
        return data;
    },

    // Create assets to wrap the loaded engine resources - model, materials, textures and animations.
    patch: function (asset, assets) {
        var container = asset.resource;
        var data = container && container.data;

        if (data) {
            var createAsset = function (type, resource, index) {
                var subAsset = new Asset(asset.name + '/' + type + '/' + index, type, {
                    url: ''
                });
                subAsset.resource = resource;
                subAsset.loaded = true;
                assets.add(subAsset);
                return subAsset;
            };

            var i;

            // create model asset
            var model = createAsset('model', GlbParser.createModel(data, this._defaultMaterial), 0);

            // create material assets
            var materials = [];
            for (i = 0; i < data.materials.length; ++i) {
                materials.push(createAsset('material', data.materials[i], i));
            }

            // create animation assets
            var animations = [];
            for (i = 0; i < data.animations.length; ++i) {
                animations.push(createAsset('animation', data.animations[i], i));
            }

            container.data = null;              // since assets are created, release GLB data
            container.model = model;
            container.materials = materials;
            container.textures = data.textures; // texture assets are created directly
            container.animations = animations;
            container.registry = assets;
        }
    }
});

export { ContainerHandler, ContainerResource };
