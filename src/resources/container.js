import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { Asset } from '../asset/asset.js';

import { GlbParser } from './parser/glb-parser.js';

/**
 * Maps an entity to a number of animation assets. Animations can be added to the node with either
 * pc.AnimationComponent or pc.AnimComponent.
 *
 * @typedef {object} pc.ContainerResourceAnimationMapping
 * @property {pc.Entity} node Entity that should be animated.
 * @property {number[]} animations Indexes of animations assets to be assigned to node.
 */

/**
 * @class
 * @name pc.ContainerResource
 * @classdesc Container for a list of animations, textures, materials, models, scenes (as entities)
 * and a default scene (as entity). Entities in scene hierarchies will have model and animation components
 * attached to them.
 * @param {object} data - The loaded GLB data.
 * @property {pc.Entity|null} scene The root entity of the default scene.
 * @property {pc.Entity[]} scenes The root entities of all scenes.
 * @property {pc.Asset[]} materials Material assets.
 * @property {pc.Asset[]} textures Texture assets.
 * @property {pc.Asset[]} animations Animation assets.
 * @property {pc.ContainerResourceAnimationMapping[]} nodeAnimations Mapping of animations to node entities.
 * @property {pc.AssetRegistry} registry The asset registry.
 */
function ContainerResource(data) {
    this.data = data;
    this.scene = null;
    this.scenes = [];
    this.materials = [];
    this.textures = [];
    this.animations = [];
    this.nodeAnimations = [];
    this.models = [];
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
            assets.forEach(destroyAsset);
        };

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

        http.get(url.load, options, function (err, response) {
            if (!callback)
                return;

            if (!err) {
                GlbParser.parseAsync(self._getUrlWithoutParams(url.original),
                                     path.extractPath(url.load),
                                     response,
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
            } else {
                callback("Error loading model: " + url.original + " [" + err + "]");
            }
        });
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

        // create material assets
        var materialAssets = data.materials.map(function (material, index) {
            return createAsset('material', material, index);
        });

        // create animation assets
        var animationAssets = data.animations.map(function (animation, index) {
            return createAsset('animation', animation, index);
        });

        // create mapping from nodes to animations
        var nodeAnimations = data.nodes
            .map(function (node, nodeIndex) {
                return {
                    node: node,
                    animations: data.nodeComponents[nodeIndex].animations
                };
            }).filter(function (mapping) {
                return mapping.animations.length > 0;
            });

        // add model components to nodes
        data.nodes.forEach(function (node, nodeIndex) {
            var components = data.nodeComponents[nodeIndex];
            if (components.model !== null) {
                node.addComponent('model', {
                    type: 'asset',
                    asset: modelAssets[components.model]
                });
            }
        });

        container.data = null;              // since assets are created, release GLB data
        container.scene = data.scene;       // scenes are not wrapped in an Asset
        container.scenes = data.scenes;     // scenes are not wrapped in an Asset
        container.materials = materialAssets;
        container.textures = data.textures; // texture assets are created directly
        container.animations = animationAssets;
        container.nodeAnimations = nodeAnimations;
        container.models = modelAssets;
        container.registry = assets;
    }
});

export { ContainerHandler, ContainerResource };
