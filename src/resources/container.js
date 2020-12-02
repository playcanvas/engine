import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { Asset } from '../asset/asset.js';

import { GlbParser } from './parser/glb-parser.js';
import { Entity } from '../framework/entity.js';
import { MeshInstance } from '../scene/mesh-instance.js';
import { SkinInstance } from '../scene/skin-instance.js';

/**
 * @class
 * @name pc.ContainerResource
 * @classdesc Container for a list of animations, textures, materials and a model.
 * @param {object} data - The loaded GLB data.
 * @property {pc.Asset[]} animations - Array of assets of animations in the GLB container.
 * @property {pc.Asset[]} textures - Array of assets of textures in the GLB container.
 * @property {pc.Asset[]} materials - Array of assets of materials in the GLB container.
 */
function ContainerResource(data) {
    this.data = data;
    this.model = null;
    this.renders = [];
    this.materials = [];
    this.textures = [];
    this.animations = [];
    this.registry = null;
}

Object.assign(ContainerResource.prototype, {

    instantiateModelEntity: function (options) {

        var entity = new pc.Entity();
        entity.addComponent("model", Object.assign( { type: "asset", asset: this.model }, options));
        return entity;
    },

    instantiateRenderEntity: function (options) {

        // helper function to recursively clone a hierarchy while converting ModelComponent to RenderComponents
        var cloneToEntity = function (skinInstances, model, node) {

            if (node) {
                var entity = new Entity();
                node._cloneInternal(entity);

                // find all mesh instances attached to this node
                var attachedMi = null;
                for (var m = 0; m < model.meshInstances.length; m++) {
                    var mi = model.meshInstances[m];
                    if (mi.node === node) {

                        // clone mesh instance
                        var cloneMi = new MeshInstance(entity, mi.mesh, mi.material);

                        // clone morph instance
                        if (mi.morphInstance) {
                            cloneMi.morphInstance = mi.morphInstance.clone();
                        }

                        // skin instance - store info to clone later after the hierarchy is created
                        if (mi.skinInstance) {
                            skinInstances.push({
                                src: mi.skinInstance,
                                dst: cloneMi
                            });
                        }

                        // add it to list
                        if (!attachedMi) {
                            attachedMi = [];
                        }
                        attachedMi.push(cloneMi);
                    }
                }

                // create render components for mesh instances
                if (attachedMi) {
                    entity.addComponent("render", Object.assign( { type: "asset" }, options));
                    entity.render.meshInstances = attachedMi;
                }

                // recursivelly clone children
                var children = node.children;
                for (var i = 0; i < children.length; i++) {
                    var childClone = cloneToEntity(skinInstances, model, children[i]);
                    entity.addChild(childClone);
                }

                return entity;
            }

            return null;
        };

        // clone GraphNode hierarchy from model to Entity hierarchy
        var skinInstances = [];
        var entity = cloneToEntity(skinInstances, this.model.resource, this.model.resource.graph);

        // clone skin instances - now that all entities (bones) are created
        for (var i = 0; i < skinInstances.length; i++) {
            var srcSkinInstance = skinInstances[i].src;
            var dstMeshInstance = skinInstances[i].dst;

            var skin = srcSkinInstance.skin;
            var cloneSkinInstance = new SkinInstance(skin);

            // Resolve bone IDs to cloned entities
            var bones = [];
            for (var j = 0; j < skin.boneNames.length; j++) {
                var boneName = skin.boneNames[j];
                var bone = entity.findByName(boneName);
                bones.push(bone);
            }

            cloneSkinInstance.bones = bones;
            dstMeshInstance.skinInstance = cloneSkinInstance;
        }

        return entity;
    },

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

            // render assets
            var renders = [];
            for (i = 0; i < data.meshes.length; ++i) {
                renders.push(createAsset('render', data.meshes[i], i));
            }

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
            container.renders = renders;
            container.materials = materials;
            container.textures = data.textures; // texture assets are created directly
            container.animations = animations;
            container.registry = assets;
        }
    }
});

export { ContainerHandler, ContainerResource };
