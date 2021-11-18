import { RENDERSTYLE_WIREFRAME } from './constants.js';
import { MeshInstance } from './mesh-instance.js';
import { MorphInstance } from './morph-instance.js';
import { SkinInstance } from './skin-instance.js';

/**
 * @class
 * @name Model
 * @classdesc A model is a graphical object that can be added to or removed from a scene.
 * It contains a hierarchy and any number of mesh instances.
 * @description Creates a new model.
 * @example
 * // Create a new model
 * var model = new pc.Model();
 * @property {GraphNode} graph The root node of the model's graph node hierarchy.
 * @property {MeshInstance[]} meshInstances An array of MeshInstances contained in this model.
 * @property {SkinInstance[]} skinInstances An array of SkinInstances contained in this model.
 * @property {MorphInstance[]} morphInstances An array of MorphInstances contained in this model.
 */
class Model {
    constructor() {
        this.graph = null;
        this.meshInstances = [];
        this.skinInstances = [];
        this.morphInstances = [];

        this.cameras = [];
        this.lights = [];

        this._shadersVersion = 0;

        // used by the model component to flag that this model has been assigned
        this._immutable = false;
    }

    getGraph() {
        return this.graph;
    }

    setGraph(graph) {
        this.graph = graph;
    }

    getCameras() {
        return this.cameras;
    }

    setCameras(cameras) {
        this.cameras = cameras;
    }

    getLights() {
        return this.lights;
    }

    setLights(lights) {
        this.lights = lights;
    }

    getMaterials() {
        const materials = [];
        for (let i = 0; i < this.meshInstances.length; i++) {
            const meshInstance = this.meshInstances[i];
            if (materials.indexOf(meshInstance.material) === -1) {
                materials.push(meshInstance.material);
            }
        }
        return materials;
    }

    /**
     * @function
     * @name Model#clone
     * @description Clones a model. The returned model has a newly created hierarchy
     * and mesh instances, but meshes are shared between the clone and the specified
     * model.
     * @returns {Model} A clone of the specified model.
     * @example
     * var clonedModel = model.clone();
     */
    clone() {

        // Duplicate the node hierarchy
        const srcNodes = [];
        const cloneNodes = [];

        const _duplicate = function (node) {
            const newNode = node.clone();

            srcNodes.push(node);
            cloneNodes.push(newNode);

            for (let idx = 0; idx < node._children.length; idx++) {
                newNode.addChild(_duplicate(node._children[idx]));
            }

            return newNode;
        };

        const cloneGraph = _duplicate(this.graph);
        const cloneMeshInstances = [];
        const cloneSkinInstances = [];
        const cloneMorphInstances = [];

        // Clone the skin instances
        for (let i = 0; i < this.skinInstances.length; i++) {
            const skin = this.skinInstances[i].skin;
            const cloneSkinInstance = new SkinInstance(skin);

            // Resolve bone IDs to actual graph nodes
            const bones = [];
            for (let j = 0; j < skin.boneNames.length; j++) {
                const boneName = skin.boneNames[j];
                const bone = cloneGraph.findByName(boneName);
                bones.push(bone);
            }
            cloneSkinInstance.bones = bones;

            cloneSkinInstances.push(cloneSkinInstance);
        }

        // Clone the morph instances
        for (let i = 0; i < this.morphInstances.length; i++) {
            const morph = this.morphInstances[i].morph;
            const cloneMorphInstance = new MorphInstance(morph);
            cloneMorphInstances.push(cloneMorphInstance);
        }

        // Clone the mesh instances
        for (let i = 0; i < this.meshInstances.length; i++) {
            const meshInstance = this.meshInstances[i];
            const nodeIndex = srcNodes.indexOf(meshInstance.node);
            const cloneMeshInstance = new MeshInstance(meshInstance.mesh, meshInstance.material, cloneNodes[nodeIndex]);

            if (meshInstance.skinInstance) {
                const skinInstanceIndex = this.skinInstances.indexOf(meshInstance.skinInstance);
                cloneMeshInstance.skinInstance = cloneSkinInstances[skinInstanceIndex];
            }

            if (meshInstance.morphInstance) {
                const morphInstanceIndex = this.morphInstances.indexOf(meshInstance.morphInstance);
                cloneMeshInstance.morphInstance = cloneMorphInstances[morphInstanceIndex];
            }

            cloneMeshInstances.push(cloneMeshInstance);
        }

        const clone = new Model();
        clone.graph = cloneGraph;
        clone.meshInstances = cloneMeshInstances;
        clone.skinInstances = cloneSkinInstances;
        clone.morphInstances = cloneMorphInstances;

        clone.getGraph().syncHierarchy();

        return clone;
    }

    /**
     * @function
     * @name Model#destroy
     * @description Destroys skinning texture and possibly deletes vertex/index buffers of a model.
     * Mesh is reference-counted, so buffers are only deleted if all models with referencing mesh instances were deleted.
     * That means all in-scene models + the "base" one (asset.resource) which is created when the model is parsed.
     * It is recommended to use asset.unload() instead, which will also remove the model from the scene.
     */
    destroy() {
        const meshInstances = this.meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            meshInstances[i].destroy();
        }
        this.meshInstances.length = 0;
    }

    /**
     * @function
     * @name Model#generateWireframe
     * @description Generates the necessary internal data for a model to be
     * renderable as wireframe. Once this function has been called, any mesh
     * instance in the model can have its renderStyle property set to
     * {@link RENDERSTYLE_WIREFRAME}.
     * @example
     * model.generateWireframe();
     * for (var i = 0; i < model.meshInstances.length; i++) {
     *     model.meshInstances[i].renderStyle = pc.RENDERSTYLE_WIREFRAME;
     * }
     */
    generateWireframe() {
        MeshInstance._prepareRenderStyleForArray(this.meshInstances, RENDERSTYLE_WIREFRAME);
    }
}

export { Model };
