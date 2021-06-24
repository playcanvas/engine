import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { Asset } from '../asset/asset.js';

import { GlbParser } from './parser/glb-parser.js';

import { Entity } from '../framework/entity.js';

import { MeshInstance } from '../scene/mesh-instance.js';
import { MorphInstance } from '../scene/morph-instance.js';
import { SkinInstance } from '../scene/skin-instance.js';
import { SkinInstanceCache } from '../scene/skin-instance-cache.js';
import { Model } from '../scene/model.js';

/**
 * @class
 * @name ContainerResource
 * @classdesc Container for a list of animations, textures, materials, renders and a model.
 * @param {object} data - The loaded GLB data.
 * @property {Asset[]} animations - Array of assets of animations in the GLB container.
 * @property {Asset[]} textures - Array of assets of textures in the GLB container.
 * @property {Asset[]} materials - Array of assets of materials in the GLB container.
 * @property {Asset[]} renders - Array of assets of renders in the GLB container.
 */
class ContainerResource {
    constructor(data) {
        this.data = data;
        this._model = null;
        this.renders = [];
        this.materials = [];
        this.textures = [];
        this.animations = [];
        this.registry = null;
        this._defaultMaterial = null;
        this._assetName = null;
        this._assets = null;
    }

    get model() {
        if (!this._model) {
            // create model only when needed
            const model = ContainerResource.createModel(this.data, this._defaultMaterial);
            const modelAsset = ContainerResource.createAsset(this._assetName, 'model', model, 0);
            this._assets.add(modelAsset);
            this._model = modelAsset;
        }
        return this._model;
    }

    static createAsset(assetName, type, resource, index) {
        const subAsset = new Asset(assetName + '/' + type + '/' + index, type, {
            url: ''
        });
        subAsset.resource = resource;
        subAsset.loaded = true;
        return subAsset;
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

        const defaultMaterial = this._defaultMaterial;
        const skinedMeshInstances = [];

        const createMeshInstance = function (root, entity, mesh, materials, skins, gltfNode) {

            // clone mesh instance
            const material = (mesh.materialIndex === undefined) ? defaultMaterial : materials[mesh.materialIndex];
            const meshInstance = new MeshInstance(mesh, material);

            // create morph instance
            if (mesh.morph) {
                meshInstance.morphInstance = new MorphInstance(mesh.morph);
            }

            // store data to create skin instance after the hierarchy is created
            if (gltfNode.hasOwnProperty('skin')) {
                skinedMeshInstances.push({
                    meshInstance: meshInstance,
                    skin: skins[gltfNode.skin],
                    rootBone: root,
                    entity: entity
                });
            }

            return meshInstance;
        };

        // helper function to recursively clone a hierarchy of GraphNodes to Entities
        const cloneHierarchy = function (root, node, glb) {

            const entity = new Entity();
            node._cloneInternal(entity);

            // first entity becomes the root
            if (!root) root = entity;

            // find all components needed for this node
            let attachedMi = null;
            for (let i = 0; i < glb.nodes.length; i++) {
                const glbNode = glb.nodes[i];
                if (glbNode === node) {
                    const gltfNode = glb.gltf.nodes[i];

                    // mesh
                    if (gltfNode.hasOwnProperty('mesh')) {
                        const meshGroup = glb.renders[gltfNode.mesh].meshes;
                        for (var mi = 0; mi < meshGroup.length; mi++) {
                            const mesh = meshGroup[mi];
                            if (mesh) {
                                const cloneMi = createMeshInstance(root, entity, mesh, glb.materials, glb.skins, gltfNode);

                                // add it to list
                                if (!attachedMi) {
                                    attachedMi = [];
                                }
                                attachedMi.push(cloneMi);
                            }
                        }
                    }

                    // light - clone (additional child) entity with the light component
                    if (glb.lights) {
                        const lightEntity = glb.lights.get(gltfNode);
                        if (lightEntity) {
                            entity.addChild(lightEntity.clone());
                        }
                    }
                }
            }

            // create render components for mesh instances
            if (attachedMi) {
                entity.addComponent("render", Object.assign({
                    type: "asset",
                    meshInstances: attachedMi
                }, options));
            }

            // recursivelly clone children
            const children = node.children;
            for (let i = 0; i < children.length; i++) {
                const childClone = cloneHierarchy(root, children[i], glb);
                entity.addChild(childClone);
            }

            return entity;
        };

        // clone scenes hierarchies
        const sceneClones = [];
        for (const scene of this.data.scenes) {
            sceneClones.push(cloneHierarchy(null, scene, this.data));
        }

        // now that the hierarchy is created, create skin instances and resolve bones using the hierarchy
        skinedMeshInstances.forEach((data) => {
            data.meshInstance.mesh.skin = data.skin;
            data.meshInstance.skinInstance = SkinInstanceCache.createCachedSkinedInstance(data.skin, data.rootBone, data.entity);
        });

        // return the scene hierarachy created from scene clones
        return ContainerResource.createSceneHierarchy(sceneClones, "Entity");
    }

    // helper function to create a single hierarchy from an array of nodes
    static createSceneHierarchy(sceneNodes, nodeType) {

        // create a single root of the hierarchy - either the single scene, or a new Entity parent if multiple scenes
        let root = null;
        if (sceneNodes.length === 1) {
            // use scene if only one
            root = sceneNodes[0];
        } else {
            // create group node for all scenes
            root = new nodeType('SceneGroup');
            for (const scene of sceneNodes) {
                root.addChild(scene);
            }
        }

        return root;
    }

    // create a pc.Model from the parsed GLB data structures
    static createModel(glb, defaultMaterial) {

        const createMeshInstance = function (model, mesh, skins, skinInstances, materials, node, gltfNode) {
            const material = (mesh.materialIndex === undefined) ? defaultMaterial : materials[mesh.materialIndex];
            const meshInstance = new MeshInstance(mesh, material, node);

            if (mesh.morph) {
                const morphInstance = new MorphInstance(mesh.morph);
                meshInstance.morphInstance = morphInstance;
                model.morphInstances.push(morphInstance);
            }

            if (gltfNode.hasOwnProperty('skin')) {
                const skinIndex = gltfNode.skin;
                const skin = skins[skinIndex];
                mesh.skin = skin;

                const skinInstance = skinInstances[skinIndex];
                meshInstance.skinInstance = skinInstance;
                model.skinInstances.push(skinInstance);
            }

            model.meshInstances.push(meshInstance);
        };

        const model = new Model();

        // create skinInstance for each skin
        const skinInstances = [];
        for (const skin of glb.skins) {
            const skinInstance = new SkinInstance(skin);
            skinInstance.bones = skin.bones;
            skinInstances.push(skinInstance);
        }

        // node hierarchy for the model
        model.graph = ContainerResource.createSceneHierarchy(glb.scenes, "GraphNode");

        // create mesh instance for meshes on nodes that are part of hierarchy
        for (let i = 0; i < glb.nodes.length; i++) {
            const node = glb.nodes[i];
            if (node.root === model.graph) {
                const gltfNode = glb.gltf.nodes[i];
                if (gltfNode.hasOwnProperty('mesh')) {
                    const meshGroup = glb.renders[gltfNode.mesh].meshes;
                    for (var mi = 0; mi < meshGroup.length; mi++) {
                        const mesh = meshGroup[mi];
                        if (mesh) {
                            createMeshInstance(model, mesh, glb.skins, skinInstances, glb.materials, node, gltfNode);
                        }
                    }
                }
            }
        }

        return model;
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

        if (this._model) {
            destroyAsset(this._model);
            this._model = null;
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
 * | light       |      x      |      x      |             |      x      |
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
                const subAsset = ContainerResource.createAsset(asset.name, type, resource, index);
                assets.add(subAsset);
                return subAsset;
            };

            let i;

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

            container._assetName = asset.name;
            container._assets = assets;
            container.renders = renders;
            container.materials = materials;
            container.textures = data.textures; // texture assets are created directly
            container.animations = animations;
            container.registry = assets;
            container._defaultMaterial = this._defaultMaterial;
        }
    }
}

export { ContainerHandler, ContainerResource };
