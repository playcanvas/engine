import { RENDERSTYLE_WIREFRAME } from './constants.js';
import { MeshInstance } from './mesh-instance.js';
import { MorphInstance } from './morph-instance.js';
import { SkinInstance } from './skin-instance.js';

/**
 * @class
 * @name pc.Model
 * @classdesc A model is a graphical object that can be added to or removed from a scene.
 * It contains a hierarchy and any number of mesh instances.
 * @description Creates a new model.
 * @example
 * // Create a new model
 * var model = new pc.Model();
 * @property {pc.GraphNode} graph The root node of the model's graph node hierarchy.
 * @property {pc.MeshInstance[]} meshInstances An array of MeshInstances contained in this model.
 * @property {pc.SkinInstance[]} skinInstances An array of SkinInstances contained in this model.
 * @property {pc.MorphInstance[]} morphInstances An array of MorphInstances contained in this model.
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
        var i;
        var materials = [];
        for (i = 0; i < this.meshInstances.length; i++) {
            var meshInstance = this.meshInstances[i];
            if (materials.indexOf(meshInstance.material) === -1) {
                materials.push(meshInstance.material);
            }
        }
        return materials;
    }

    /**
     * @function
     * @name pc.Model#clone
     * @description Clones a model. The returned model has a newly created hierarchy
     * and mesh instances, but meshes are shared between the clone and the specified
     * model.
     * @returns {pc.Model} A clone of the specified model.
     * @example
     * var clonedModel = model.clone();
     */
    clone() {
        var i, j;

        // Duplicate the node hierarchy
        var srcNodes = [];
        var cloneNodes = [];

        var _duplicate = function (node) {
            var newNode = node.clone();

            srcNodes.push(node);
            cloneNodes.push(newNode);

            for (var idx = 0; idx < node._children.length; idx++) {
                newNode.addChild(_duplicate(node._children[idx]));
            }

            return newNode;
        };

        var cloneGraph = _duplicate(this.graph);
        var cloneMeshInstances = [];
        var cloneSkinInstances = [];
        var cloneMorphInstances = [];

        // Clone the skin instances
        for (i = 0; i < this.skinInstances.length; i++) {
            var skin = this.skinInstances[i].skin;
            var cloneSkinInstance = new SkinInstance(skin);

            // Resolve bone IDs to actual graph nodes
            var bones = [];
            for (j = 0; j < skin.boneNames.length; j++) {
                var boneName = skin.boneNames[j];
                var bone = cloneGraph.findByName(boneName);
                bones.push(bone);
            }
            cloneSkinInstance.bones = bones;

            cloneSkinInstances.push(cloneSkinInstance);
        }

        // Clone the morph instances
        for (i = 0; i < this.morphInstances.length; i++) {
            var morph = this.morphInstances[i].morph;
            var cloneMorphInstance = new MorphInstance(morph);
            cloneMorphInstances.push(cloneMorphInstance);
        }

        // Clone the mesh instances
        for (i = 0; i < this.meshInstances.length; i++) {
            var meshInstance = this.meshInstances[i];
            var nodeIndex = srcNodes.indexOf(meshInstance.node);
            var cloneMeshInstance = new MeshInstance(cloneNodes[nodeIndex], meshInstance.mesh, meshInstance.material);

            if (meshInstance.skinInstance) {
                var skinInstanceIndex = this.skinInstances.indexOf(meshInstance.skinInstance);
                cloneMeshInstance.skinInstance = cloneSkinInstances[skinInstanceIndex];
            }

            if (meshInstance.morphInstance) {
                var morphInstanceIndex = this.morphInstances.indexOf(meshInstance.morphInstance);
                cloneMeshInstance.morphInstance = cloneMorphInstances[morphInstanceIndex];
            }

            cloneMeshInstances.push(cloneMeshInstance);
        }

        var clone = new Model();
        clone.graph = cloneGraph;
        clone.meshInstances = cloneMeshInstances;
        clone.skinInstances = cloneSkinInstances;
        clone.morphInstances = cloneMorphInstances;

        clone.getGraph().syncHierarchy();

        return clone;
    }

    /**
     * @function
     * @name pc.Model#destroy
     * @description Destroys skinning texture and possibly deletes vertex/index buffers of a model.
     * Mesh is reference-counted, so buffers are only deleted if all models with referencing mesh instances were deleted.
     * That means all in-scene models + the "base" one (asset.resource) which is created when the model is parsed.
     * It is recommended to use asset.unload() instead, which will also remove the model from the scene.
     */
    destroy() {
        var meshInstances = this.meshInstances;
        for (var i = 0; i < meshInstances.length; i++) {
            meshInstances[i].destroy();
        }
        this.meshInstances.length = 0;
    }

    /**
     * @function
     * @name pc.Model#generateWireframe
     * @description Generates the necessary internal data for a model to be
     * renderable as wireframe. Once this function has been called, any mesh
     * instance in the model can have its renderStyle property set to
     * pc.RENDERSTYLE_WIREFRAME.
     * @example
     * model.generateWireframe();
     * for (var i = 0; i < model.meshInstances.length; i++) {
     *     model.meshInstances[i].renderStyle = pc.RENDERSTYLE_WIREFRAME;
     * }
     */
    generateWireframe() {
        var i;
        var mesh;

        // Build an array of unique meshes in this model
        var meshes = [];
        for (i = 0; i < this.meshInstances.length; i++) {
            mesh = this.meshInstances[i].mesh;
            if (meshes.indexOf(mesh) === -1) {
                meshes.push(mesh);
            }
        }

        for (i = 0; i < meshes.length; ++i) {
            mesh = meshes[i];
            if (!mesh.primitive[RENDERSTYLE_WIREFRAME]) {
                mesh.generateWireframe();
            }
        }
    }
}

export { Model };
