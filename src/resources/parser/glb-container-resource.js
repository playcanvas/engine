import { Asset } from '../../asset/asset.js';
import { Entity } from '../../framework/entity.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { SkinInstance } from '../../scene/skin-instance.js';
import { SkinInstanceCache } from '../../scene/skin-instance-cache.js';
import { Model } from '../../scene/model.js';

// Container resource returned by the GlbParser. Implements the ContainerResource interface.
class GlbContainerResource {
    constructor(data, asset, assets, defaultMaterial) {
        const createAsset = function (type, resource, index) {
            const subAsset = GlbContainerResource.createAsset(asset.name, type, resource, index);
            assets.add(subAsset);
            return subAsset;
        };

        // render assets
        const renders = [];
        for (let i = 0; i < data.renders.length; ++i) {
            renders.push(createAsset('render', data.renders[i], i));
        }

        // create material assets
        const materials = [];
        for (let i = 0; i < data.materials.length; ++i) {
            materials.push(createAsset('material', data.materials[i], i));
        }

        // create animation assets
        const animations = [];
        for (let i = 0; i < data.animations.length; ++i) {
            animations.push(createAsset('animation', data.animations[i], i));
        }

        this.data = data;
        this._model = null;
        this._assetName = asset.name;
        this._assets = assets;
        this._defaultMaterial = defaultMaterial;
        this.renders = renders;
        this.materials = materials;
        this.textures = data.textures; // texture assets are created directly
        this.animations = animations;
    }

    get model() {
        if (!this._model) {
            // create model only when needed
            const model = GlbContainerResource.createModel(this.data, this._defaultMaterial);
            const modelAsset = GlbContainerResource.createAsset(this._assetName, 'model', model, 0);
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

    instantiateModelEntity(options) {
        const entity = new Entity();
        entity.addComponent("model", Object.assign({ type: "asset", asset: this.model }, options));
        return entity;
    }

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
                    // cannot clone the component as additional entity has a rotation to handle different light direction
                    if (glb.lights) {
                        const lightEntity = glb.lights.get(gltfNode);
                        if (lightEntity) {
                            entity.addChild(lightEntity.clone());
                        }
                    }

                    // camera
                    if (glb.cameras) {
                        const cameraEntity = glb.cameras.get(gltfNode);
                        if (cameraEntity) {
                            // clone camera component into the entity
                            cameraEntity.camera.system.cloneComponent(cameraEntity, entity);
                        }
                    }
                }
            }

            // create render components for mesh instances
            if (attachedMi) {
                entity.addComponent("render", Object.assign({
                    type: "asset",
                    meshInstances: attachedMi,
                    rootBone: root
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
            data.meshInstance.skinInstance = SkinInstanceCache.createCachedSkinedInstance(data.meshInstance.mesh.skin, data.rootBone, data.entity);
        });

        // return the scene hierarachy created from scene clones
        return GlbContainerResource.createSceneHierarchy(sceneClones, "Entity");
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
        model.graph = GlbContainerResource.createSceneHierarchy(glb.scenes, "GraphNode");

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
        const registry = this._assets;

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

export { GlbContainerResource };
