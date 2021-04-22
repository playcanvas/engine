import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { Asset } from '../asset/asset.js';

import { GlbParser } from './parser/glb-parser.js';
import { Entity } from '../framework/entity.js';
import { MeshInstance } from '../scene/mesh-instance.js';
import { SkinInstance } from '../scene/skin-instance.js';

/**
 * @class
 * @name ContainerResource
 * @classdesc Container for a list of animations, textures, materials and a model.
 * @param {object} data - The loaded GLB data.
 * @property {Asset[]} animations - Array of assets of animations in the GLB container.
 * @property {Asset[]} textures - Array of assets of textures in the GLB container.
 * @property {Asset[]} materials - Array of assets of materials in the GLB container.
 * @property {Asset[]} renders - Array of assets of renders in the GLB container.
 */
class ContainerResource {
    constructor(data) {
        this.data = data;
        this.model = null;
        this.renders = [];
        this.materials = [];
        this.textures = [];
        this.animations = [];
        this.registry = null;
    }

    /**
     * @function
     * @name ContainerResource#instantiateModelEntity
     * @description Instantiates an entity with a model component.
     * @param {object} [options] - The initialization data for the model component type {@link ModelComponent}.
     * @returns {Entity} A single entity with a model component. Model component internally contains a hierarchy based on {@link GraphNode}.
     * @example
     * // load a glb file and instantiate an entity with a model component based on it
     * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
     *     var entity = asset.resource.instantiateModelEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     * });
     */
    instantiateModelEntity(options) {
        const entity = new Entity();
        entity.addComponent("model", Object.assign({ type: "asset", asset: this.model }, options));
        return entity;
    }

    /**
     * @function
     * @name ContainerResource#instantiateRenderEntity
     * @description Instantiates an entity with a render component.
     * @param {object} [options] - The initialization data for the render component type {@link RenderComponent}.
     * @returns {Entity} A hierarachy of entities with render components on entities containing renderable geometry.
     * @example
     * // load a glb file and instantiate an entity with a model component based on it
     * app.assets.loadFromUrl("statue.glb", "container", function (err, asset) {
     *     var entity = asset.resource.instantiateRenderEntity({
     *         castShadows: true
     *     });
     *     app.root.addChild(entity);
     * });
     */
    instantiateRenderEntity(options) {
        // helper function to recursively clone a hierarchy while converting ModelComponent to RenderComponents
        const cloneToEntity = function (skinInstances, model, node) {

            if (node) {
                const entity = new Entity();
                node._cloneInternal(entity);

                // find all mesh instances attached to this node
                let attachedMi = null;
                for (let m = 0; m < model.meshInstances.length; m++) {
                    const mi = model.meshInstances[m];
                    if (mi.node === node) {

                        // clone mesh instance
                        const cloneMi = new MeshInstance(mi.mesh, mi.material, entity);

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
                    entity.addComponent("render", Object.assign({ type: "asset" }, options));
                    entity.render.meshInstances = attachedMi;
                }

                // recursivelly clone children
                const children = node.children;
                for (let i = 0; i < children.length; i++) {
                    const childClone = cloneToEntity(skinInstances, model, children[i]);
                    entity.addChild(childClone);
                }

                return entity;
            }

            return null;
        };

        // clone GraphNode hierarchy from model to Entity hierarchy
        const skinInstances = [];
        const entity = cloneToEntity(skinInstances, this.model.resource, this.model.resource.graph);

        // clone skin instances - now that all entities (bones) are created
        for (let i = 0; i < skinInstances.length; i++) {
            const srcSkinInstance = skinInstances[i].src;
            const dstMeshInstance = skinInstances[i].dst;

            const skin = srcSkinInstance.skin;
            const cloneSkinInstance = new SkinInstance(skin);

            // Resolve bone IDs to cloned entities
            const bones = [];
            for (let j = 0; j < skin.boneNames.length; j++) {
                const boneName = skin.boneNames[j];
                const bone = entity.findByName(boneName);
                bones.push(bone);
            }

            cloneSkinInstance.bones = bones;
            dstMeshInstance.skinInstance = cloneSkinInstance;
        }

        return entity;
    }

    destroy() {
        const registry = this.registry;

        const destroyAsset = function (asset) {
            registry.remove(asset);
            asset.unload();
        };

        const destroyAssets = function (assets) {
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

        if (this.renders) {
            destroyAssets(this.renders);
            this.renders = null;
        }

        if (this.model) {
            destroyAsset(this.model);
            this.model = null;
        }

        this.data = null;
        this.assets = null;
    }
}

/**
 * @class
 * @name ContainerHandler
 * @implements {ResourceHandler}
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
 *         preprocess(gltfTexture) { console.log("texture preprocess"); }
 *     },
 * });
 * ```
 * @param {GraphicsDevice} device - The graphics device that will be rendering.
 * @param {StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
 */
class ContainerHandler {
    constructor(device, defaultMaterial) {
        this._device = device;
        this._defaultMaterial = defaultMaterial;
        this.maxRetries = 0;
    }

    _getUrlWithoutParams(url) {
        return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
    }

    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        const options = {
            responseType: Http.ResponseType.ARRAY_BUFFER,
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };

        const self = this;

        // parse downloaded file data
        const parseData = function (arrayBuffer) {
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
    }

    open(url, data, asset) {
        return data;
    }

    // Create assets to wrap the loaded engine resources - model, materials, textures and animations.
    patch(asset, assets) {
        const container = asset.resource;
        const data = container && container.data;

        if (data) {
            const createAsset = function (type, resource, index) {
                const subAsset = new Asset(asset.name + '/' + type + '/' + index, type, {
                    url: ''
                });
                subAsset.resource = resource;
                subAsset.loaded = true;
                assets.add(subAsset);
                return subAsset;
            };

            let i;

            // create model asset
            const model = createAsset('model', GlbParser.createModel(data, this._defaultMaterial), 0);

            // render assets
            const renders = [];
            for (i = 0; i < data.renders.length; ++i) {
                renders.push(createAsset('render', data.renders[i], i));
            }

            // create material assets
            const materials = [];
            for (i = 0; i < data.materials.length; ++i) {
                materials.push(createAsset('material', data.materials[i], i));
            }

            // create animation assets
            const animations = [];
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
}

export { ContainerHandler, ContainerResource };
