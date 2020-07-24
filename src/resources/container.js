import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { Asset } from '../asset/asset.js';

import { GlbParser } from './parser/glb-parser.js';

/**
 * @class
 * @name pc.ContainerResource
 * @classdesc Container for a list of animations, textures, materials, models, scenes (as entities)
 * and a default scene (as entity). Entities in scene hierarchies will have model and animation components
 * attached to them.
 * @param {object} data - The loaded GLB data.
 * @property {pc.Entity|null} scene The root entity of the default scene.
 * @property {pc.Entity[]} scenes The root entities of all scenes.
 * @property {pc.CameraComponent[]} cameras Camera components.
 * @property {pc.LightComponent[]} lights Light components.
 * @property {pc.Entity[]} nodes Entity per GLB node.
 * @property {pc.Asset[]} materials Material assets.
 * @property {pc.Asset[]} textures Texture assets per GLB image.
 * @property {pc.Asset[]} animations Animation assets.
 * @property {number[][]} nodeAnimations Animation asset indices per node.
 * @property {pc.Asset[]} models Model assets per GLB mesh.
 * @property {pc.AssetRegistry} registry The asset registry.
 */
function ContainerResource(data) {
    this.data = data;
    this.scene = null;
    this.scenes = [];
    this.cameras = [];
    this.lights = [];
    this.nodes = [];
    this.materials = [];
    this.textures = [];
    this.animations = [];
    this.nodeAnimations = [];
    this.models = [];
    this._nodeModels = [];
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
                if (asset) {
                    destroyAsset(asset);
                }
            });
        };

        // destroy entities
        if (this.scene) {
            this.scene.destroy();
            this.scene = null;
        }

        if (this.scenes) {
            this.scenes.forEach(function (scene) {
                scene.destroy();
            });
            this.scenes = null;
        }

        if (this.cameras) {
            this.cameras = null;
        }

        if (this.lights) {
            this.lights = null;
        }

        if (this.nodes) {
            this.nodes.forEach(function (node) {
                node.destroy();
            });
            this.nodes = null;
        }

        // unload and destroy assets
        if (this.animations) {
            destroyAssets(this.animations);
            this.animations = null;
        }

        if (this.nodeAnimations) {
            this.nodeAnimations = null;
        }

        if (this.models) {
            destroyAssets(this.models);
            this.models = null;
        }

        if (this._nodeModels) {
            destroyAssets(this._nodeModels);
            this._nodeModels = null;
        }

        if (this.textures) {
            destroyAssets(this.textures);
            this.textures = null;
        }

        if (this.materials) {
            destroyAssets(this.materials);
            this.materials = null;
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
 * textures, scenes and animations.
 * The asset options object can be used for passing in load time callbacks to handle the various resources
 * at different stages of loading as follows:
 * ```
 * |---------------------------------------------------------------------|
 * |  resource   |  preprocess |   process   |processAsync | postprocess |
 * |-------------+-------------+-------------+-------------+-------------|
 * | global      |      x      |             |             |      x      |
 * | node        |      x      |      x      |             |      x      |
 * | scene       |      x      |      x      |             |      x      |
 * | camera      |      x      |      x      |             |      x      |
 * | animation   |      x      |             |             |      x      |
 * | material    |      x      |      x      |             |      x      |
 * | texture     |      x      |             |      x      |      x      |
 * | buffer      |      x      |             |      x      |      x      |
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
                                 self._defaultMaterial,
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

    // Create assets to wrap the loaded engine resources - models, materials, textures and animations.
    patch: function (asset, assets) {
        var createAsset = function (type, resource, index) {
            var subAsset = new Asset(asset.name + '/' + type + '/' + index, type, {
                url: ''
            });
            subAsset.resource = resource;
            subAsset.loaded = true;
            assets.add(subAsset);
            return subAsset;
        };

        var container = asset.resource;
        var data = container.data;

        // create model assets
        var modelAssets = data.models.map(function (model, index) {
            return createAsset('model', model, index);
        });

        // create node model assets
        var nodeModelAssets = data.nodeModels.map(function (model, index) {
            return model !== null ? createAsset('model', model, index) : null;
        });

        // create material assets
        var materialAssets = data.materials.map(function (material, index) {
            return createAsset('material', material, index);
        });

        // create animation assets
        var animationAssets = data.animations.map(function (animation, index) {
            return createAsset('animation', animation, index);
        });

        // add model components to nodes
        data.nodes.forEach(function (node, nodeIndex) {
            var modelAsset = nodeModelAssets[nodeIndex];
            if (modelAsset !== null) {
                node.addComponent('model', {
                    type: 'asset',
                    asset: modelAsset
                });
            }
        });

        container.data = null;                      // since assets are created, release GLB data
        container.scene = data.scene;               // scenes are not wrapped in an Asset
        container.scenes = data.scenes;             // scenes are not wrapped in an Asset
        container.cameras = data.cameras;           // camera components are not wrapped in an Asset
        container.lights = data.lights;             // light components are not wrapped in an Asset
        container.nodes = data.nodes;               // nodes are not wrapped in an Asset
        container.materials = materialAssets;
        container.textures = data.textures;         // texture assets are created in parser
        container.animations = animationAssets;
        container.nodeAnimations = data.nodeAnimations;
        container.models = modelAssets;
        container._nodeModels = nodeModelAssets;    // keep model refs for when container is destroyed
        container.registry = assets;
    }
});

export { ContainerHandler, ContainerResource };
