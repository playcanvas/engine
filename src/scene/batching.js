import { now } from  '../core/time.js';

import { Vec3 } from '../math/vec3.js';
import { Mat4 } from '../math/mat4.js';

import { BoundingBox } from '../shape/bounding-box.js';

import {
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES,
    TYPE_FLOAT32,
    typedArrayIndexFormats, typedArrayTypes, typedArrayTypesByteSize
} from '../graphics/graphics.js';
import { shaderChunks } from '../graphics/program-lib/chunks/chunks.js';

import { LAYERID_WORLD, SPRITE_RENDERMODE_SIMPLE } from './constants.js';
import { Mesh } from './mesh.js';
import { MeshInstance } from './mesh-instance.js';
import { Model } from './model.js';
import { SkinInstance } from './skin-instance.js';

/**
 * @class
 * @name pc.Batch
 * @classdesc Holds information about batched mesh instances. Created in {@link pc.BatchManager#create}.
 * @param {pc.MeshInstance[]} meshInstances - The mesh instances to be batched.
 * @param {boolean} dynamic - Whether this batch is dynamic (supports transforming mesh instances at runtime).
 * @param {number} batchGroupId - Link this batch to a specific batch group. This is done automatically with default batches.
 * @property {pc.MeshInstance[]} origMeshInstances An array of original mesh instances, from which this batch was generated.
 * @property {pc.MeshInstance} meshInstance A single combined mesh instance, the result of batching.
 * @property {pc.Model} model A handy model object.
 * @property {boolean} dynamic Whether this batch is dynamic (supports transforming mesh instances at runtime).
 * @property {number} [batchGroupId] Link this batch to a specific batch group. This is done automatically with default batches.
 */
function Batch(meshInstances, dynamic, batchGroupId) {
    this.origMeshInstances = meshInstances;
    this._aabb = new BoundingBox();
    this.meshInstance = null;
    this.model = null;
    this.dynamic = dynamic;
    this.batchGroupId = batchGroupId;
    this.refCounter = 0;
}

/**
 * @class
 * @name pc.BatchGroup
 * @classdesc Holds mesh batching settings and a unique id. Created via {@link pc.BatchManager#addGroup}.
 * @param {number} id - Unique id. Can be assigned to model and element components.
 * @param {string} name - The name of the group.
 * @param {boolean} dynamic - Whether objects within this batch group should support transforming at runtime.
 * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched objects.
 * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
 * @param {number[]} [layers] - Layer ID array. Default is [pc.LAYERID_WORLD]. The whole batch group will belong
 * to these layers. Layers of source models will be ignored.
 * @property {boolean} dynamic Whether objects within this batch group should support transforming at runtime.
 * @property {number} maxAabbSize Maximum size of any dimension of a bounding box around batched objects.
 * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
 * @property {number} id Unique id. Can be assigned to model and element components.
 * @property {string} name Name of the group.
 * @property {number[]} [layers] Layer ID array. Default is [pc.LAYERID_WORLD]. The whole batch group will belong
 * to these layers. Layers of source models will be ignored.
 */
function BatchGroup(id, name, dynamic, maxAabbSize, layers) {
    this.dynamic = dynamic;
    this.maxAabbSize = maxAabbSize;
    this.id = id;
    this.name = name;
    this.layers = layers === undefined ? [LAYERID_WORLD] : layers;
    this._ui = false;
    this._sprite = false;
    this._obj = {
        model: [],
        element: [],
        sprite: []
    };
}

BatchGroup.MODEL = 'model';
BatchGroup.ELEMENT = 'element';
BatchGroup.SPRITE = 'sprite';

// Class derived from SkinInstance with changes to make it suitable for batching
function SkinBatchInstance(device, nodes, rootNode) {
    SkinInstance.call(this);

    var numBones = nodes.length;
    SkinInstance.prototype.init.call(this, device, numBones);

    this.device = device;
    this.rootNode = rootNode;

    // Unique bones per clone
    this.bones = nodes;
}

SkinBatchInstance.prototype = Object.create(SkinBatchInstance.prototype);
SkinBatchInstance.prototype.constructor = SkinBatchInstance;

Object.assign(SkinBatchInstance.prototype, {
    updateMatrices: function (rootNode) {
    },

    updateMatrixPalette: function () {
        var pe;
        var mp = this.matrixPalette;
        var base;

        var count = this.bones.length;
        for (var i = 0; i < count; i++) {
            pe = this.bones[i].getWorldTransform().data;

            // Copy the matrix into the palette, ready to be sent to the vertex shader, transpose matrix from 4x4 to 4x3 format as well
            base = i * 12;
            mp[base] = pe[0];
            mp[base + 1] = pe[4];
            mp[base + 2] = pe[8];
            mp[base + 3] = pe[12];
            mp[base + 4] = pe[1];
            mp[base + 5] = pe[5];
            mp[base + 6] = pe[9];
            mp[base + 7] = pe[13];
            mp[base + 8] = pe[2];
            mp[base + 9] = pe[6];
            mp[base + 10] = pe[10];
            mp[base + 11] = pe[14];
        }

        SkinInstance.prototype.uploadBones.call(this, this.device);
    }
});

/**
 * @class
 * @name pc.BatchManager
 * @classdesc Glues many mesh instances into a single one for better performance.
 * @param {pc.GraphicsDevice} device - The graphics device used by the batch manager.
 * @param {pc.Entity} root - The entity under which batched models are added.
 * @param {pc.Scene} scene - The scene that the batch manager affects.
 */
function BatchManager(device, root, scene) {
    this.device = device;
    this.rootNode = root;
    this.scene = scene;
    this._init = false;

    this._batchGroups = {};
    this._batchGroupCounter = 0;
    this._batchList = [];
    this._dirtyGroups = [];

    // #ifdef PROFILER
    this._stats = {
        createTime: 0,
        updateLastFrameTime: 0
    };
    // #endif
}

// TODO: rename destroy() to something else and rename this to destroy
BatchManager.prototype.destroyManager = function () {
    this.device = null;
    this.rootNode = null;
    this.scene = null;
    this._batchGroups = {};
    this._batchList = [];
    this._dirtyGroups = [];
};

/**
 * @function
 * @name pc.BatchManager#addGroup
 * @description Adds new global batch group.
 * @param {string} name - Custom name.
 * @param {boolean} dynamic - Is this batch group dynamic? Will these objects move/rotate/scale after being batched?
 * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched objects.
 * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
 * @param {number} [id] - Optional custom unique id for the group (will be generated automatically otherwise).
 * @param {number[]} [layers] - Optional layer ID array. Default is [pc.LAYERID_WORLD]. The whole batch group will
 * belong to these layers. Layers of source models will be ignored.
 * @returns {pc.BatchGroup} Group object.
 */
BatchManager.prototype.addGroup = function (name, dynamic, maxAabbSize, id, layers) {
    if (id === undefined) {
        id = this._batchGroupCounter;
        this._batchGroupCounter++;
    }

    if (this._batchGroups[id]) {
        // #ifdef DEBUG
        console.error("batch group with id " + id + " already exists");
        // #endif
        return;
    }

    var group;
    this._batchGroups[id] = group = new BatchGroup(id, name, dynamic, maxAabbSize, layers);

    return group;
};

/**
 * @function
 * @name pc.BatchManager#removeGroup
 * @description Remove global batch group by id.
 * Note, this traverses the entire scene graph and clears the batch group id from all components.
 * @param {number} id - Batch Group ID.
 */
BatchManager.prototype.removeGroup = function (id) {
    if (!this._batchGroups[id]) {
        // #ifdef DEBUG
        console.error("batch group with id " + id + " doesn't exist");
        // #endif
        return;
    }

    // delete batches with matching id
    var newBatchList = [];
    for (var i = 0; i < this._batchList.length; i++) {
        if (this._batchList[i].batchGroupId !== id) {
            newBatchList.push(this._batchList[i]);
            continue;
        }
        this.destroy(this._batchList[i]);
    }
    this._batchList = newBatchList;
    this._removeModelsFromBatchGroup(this.rootNode, id);

    delete this._batchGroups[id];
};

/**
 * @function
 * @name pc.BatchManager#markGroupDirty
 * @description Mark a specific batch group as dirty. Dirty groups are re-batched before the next frame is rendered.
 * Note, re-batching a group is a potentially expensive operation.
 * @param  {number} id - Batch Group ID to mark as dirty.
 */
BatchManager.prototype.markGroupDirty = function (id) {
    if (this._dirtyGroups.indexOf(id) < 0) {
        this._dirtyGroups.push(id);
    }
};

/**
 * @function
 * @name pc.BatchManager#getGroupByName
 * @description Retrieves a {@link pc.BatchGroup} object with a corresponding name, if it exists, or null otherwise.
 * @param {string} name - Name.
 * @returns {pc.BatchGroup} Group object.
 */
BatchManager.prototype.getGroupByName = function (name) {
    var groups = this._batchGroups;
    for (var group in groups) {
        if (!groups.hasOwnProperty(group)) continue;
        if (groups[group].name === name) {
            return groups[group];
        }
    }
    return null;
};

/**
 * @private
 * @function
 * @name pc.BatchManager#getBatches
 * @description  Return a list of all {@link pc.Batch} objects that belong to the Batch Group supplied.
 * @param  {number} batchGroupId - The id of the batch group.
 * @returns {pc.Batch[]} A list of batches that are used to render the batch group.
 */
BatchManager.prototype.getBatches = function (batchGroupId) {
    var results = [];
    var len = this._batchList.length;
    for (var i = 0; i < len; i++) {
        var batch = this._batchList[i];
        if (batch.batchGroupId === batchGroupId) {
            results.push(batch);
        }
    }

    return results;
};

// traverse full hierarchy and clear the batch group id from all model, element and sprite components
BatchManager.prototype._removeModelsFromBatchGroup = function (node, id) {
    if (!node.enabled) return;

    if (node.model && node.model.batchGroupId === id) {
        node.model.batchGroupId = -1;
    }
    if (node.element && node.element.batchGroupId === id) {
        node.element.batchGroupId = -1;
    }
    if (node.sprite && node.sprite.batchGroupId === id) {
        node.sprite.batchGroupId = -1;
    }

    for (var i = 0; i < node._children.length; i++) {
        this._removeModelsFromBatchGroup(node._children[i], id);
    }
};

BatchManager.prototype.insert = function (type, groupId, node) {
    var group = this._batchGroups[groupId];
    if (group) {
        if (group._obj[type].indexOf(node) < 0) {
            group._obj[type].push(node);
            this.markGroupDirty(groupId);
        }
    } else {
        // #ifdef DEBUG
        console.warn('Invalid batch ' + groupId + ' insertion');
        // #endif
    }
};

BatchManager.prototype.remove = function (type, groupId, node) {
    var group = this._batchGroups[groupId];
    if (group) {
        var idx = group._obj[type].indexOf(node);
        if (idx >= 0) {
            group._obj[type].splice(idx, 1);
            this.markGroupDirty(groupId);
        }
    } else {
        // #ifdef DEBUG
        console.warn('Invalid batch ' + groupId + ' insertion');
        // #endif
    }
};

BatchManager.prototype._extractModel = function (node, arr, group, groupMeshInstances) {
    if (!node.model || !node.model.model) return arr;

    var i;
    if (node.model.isStatic) {
        // static mesh instances can be in both drawCall array with _staticSource linking to original
        // and in the original array as well, if no triangle splitting was done
        var drawCalls = this.scene.drawCalls;
        var nodeMeshInstances = node.model.meshInstances;
        for (i = 0; i < drawCalls.length; i++) {
            if (!drawCalls[i]._staticSource) continue;
            if (nodeMeshInstances.indexOf(drawCalls[i]._staticSource) < 0) continue;
            arr.push(drawCalls[i]);
        }
        for (i = 0; i < nodeMeshInstances.length; i++) {
            if (drawCalls.indexOf(nodeMeshInstances[i]) >= 0) {
                arr.push(nodeMeshInstances[i]);
            }
        }
    } else {
        arr = groupMeshInstances[node.model.batchGroupId] = arr.concat(node.model.meshInstances);
    }

    node.model.removeModelFromLayers();

    // #ifdef DEBUG
    node.model._batchGroup = group;
    // #endif
    return arr;
};

BatchManager.prototype._extractElement = function (node, arr, group) {
    if (!node.element) return;
    var valid = false;
    if (node.element._text && node.element._text._model.meshInstances.length > 0) {
        arr.push(node.element._text._model.meshInstances[0]);
        node.element.removeModelFromLayers(node.element._text._model);

        valid = true;
    } else if (node.element._image) {
        arr.push(node.element._image._renderable.meshInstance);
        node.element.removeModelFromLayers(node.element._image._renderable.model);

        if (node.element._image._renderable.unmaskMeshInstance) {
            arr.push(node.element._image._renderable.unmaskMeshInstance);
            if (!node.element._image._renderable.unmaskMeshInstance.stencilFront ||
                !node.element._image._renderable.unmaskMeshInstance.stencilBack) {
                node.element._dirtifyMask();
                node.element._onPrerender();
            }
        }

        valid = true;
    }

    if (valid) {
        group._ui = true;
        // #ifdef DEBUG
        node.element._batchGroup = group;
        // #endif
    }
};

// traverse scene hierarchy down from `node` and collect all components that are marked
// with a batch group id. Remove from layers any models that these components contains.
// Fill the `groupMeshInstances` with all the mesh instances to be included in the batch groups,
// indexed by batch group id.
BatchManager.prototype._collectAndRemoveModels = function (groupMeshInstances, groupIds) {
    var node, group, arr, id;
    for (var g = 0; g < groupIds.length; g++) {
        id = groupIds[g];
        group = this._batchGroups[id];
        if (!group) continue;
        arr = groupMeshInstances[id];
        if (!arr) arr = groupMeshInstances[id] = [];

        for (var m = 0; m < group._obj.model.length; m++) {
            arr = this._extractModel(group._obj.model[m], arr, group, groupMeshInstances);
        }

        for (var e = 0; e < group._obj.element.length; e++) {
            this._extractElement(group._obj.element[e], arr, group);
        }

        for (var s = 0; s < group._obj.sprite.length; s++) {
            node = group._obj.sprite[s];
            if (node.sprite && node.sprite._meshInstance &&
                (group.dynamic || node.sprite.sprite._renderMode === SPRITE_RENDERMODE_SIMPLE)) {
                arr.push(node.sprite._meshInstance);
                node.sprite.removeModelFromLayers();
                group._sprite = true;
                node.sprite._batchGroup = group;
            }
        }
    }
};

/**
 * @function
 * @name pc.BatchManager#generate
 * @description Destroys all batches and creates new based on scene models. Hides original models. Called by engine automatically on app start, and if batchGroupIds on models are changed.
 * @param {number[]} [groupIds] - Optional array of batch group IDs to update. Otherwise all groups are updated.
 */
BatchManager.prototype.generate = function (groupIds) {
    var i, j;
    var groupMeshInstances = {};

    if (!groupIds) {
        // Full scene
        groupIds = Object.keys(this._batchGroups);
    }

    // delete old batches with matching batchGroupId
    var newBatchList = [];
    for (i = 0; i < this._batchList.length; i++) {
        if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
            newBatchList.push(this._batchList[i]);
            continue;
        }
        this.destroy(this._batchList[i]);
    }
    this._batchList = newBatchList;

    // collect
    this._collectAndRemoveModels(groupMeshInstances, groupIds);

    if (groupIds === this._dirtyGroups) {
        this._dirtyGroups.length = 0;
    } else {
        var newDirtyGroups = [];
        for (i = 0; i < this._dirtyGroups.length; i++) {
            if (groupIds.indexOf(this._dirtyGroups[i]) < 0) newDirtyGroups.push(this._dirtyGroups[i]);
        }
        this._dirtyGroups = newDirtyGroups;
    }

    var group, lists, groupData, batch;
    for (var groupId in groupMeshInstances) {
        if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
        group = groupMeshInstances[groupId];

        groupData = this._batchGroups[groupId];
        if (!groupData) {
            // #ifdef DEBUG
            console.error("batch group " + groupId + " not found");
            // #endif
            continue;
        }

        lists = this.prepare(group, groupData.dynamic, groupData.maxAabbSize, groupData._ui || groupData._sprite);
        for (i = 0; i < lists.length; i++) {
            batch = this.create(lists[i], groupData.dynamic, parseInt(groupId, 10));
            if (!batch) continue;
            for (j = 0; j < groupData.layers.length; j++) {
                var layer = this.scene.layers.getLayerById(groupData.layers[j]);
                if (layer)
                    layer.addMeshInstances(batch.model.meshInstances);
            }
        }
    }
};

function paramsIdentical(a, b) {
    if (a && !b) return false;
    if (!a && b) return false;
    a = a.data;
    b = b.data;
    if (a === b) return true;
    if (a instanceof Float32Array && b instanceof Float32Array) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    return false;
}

function equalParamSets(params1, params2) {
    var param;
    for (param in params1) { // compare A -> B
        if (params1.hasOwnProperty(param) && !paramsIdentical(params1[param], params2[param]))
            return false;
    }
    for (param in params2) { // compare B -> A
        if (params2.hasOwnProperty(param) && !paramsIdentical(params2[param], params1[param]))
            return false;
    }
    return true;
}

function equalLightLists(lightList1, lightList2) {
    var k;
    for (k = 0; k < lightList1.length; k++) {
        if (lightList2.indexOf(lightList1[k]) < 0)
            return false;
    }
    for (k = 0; k < lightList2.length; k++) {
        if (lightList1.indexOf(lightList2[k]) < 0)
            return false;
    }
    return  true;
}

var worldMatX = new Vec3();
var worldMatY = new Vec3();
var worldMatZ = new Vec3();
function getScaleSign(mi) {
    var wt = mi.node.worldTransform;
    wt.getX(worldMatX);
    wt.getY(worldMatY);
    wt.getZ(worldMatZ);
    worldMatX.cross(worldMatX, worldMatY);
    return worldMatX.dot(worldMatZ) >= 0 ? 1 : -1;
}

/**
 * @function
 * @name pc.BatchManager#prepare
 * @description Takes a list of mesh instances to be batched and sorts them into lists one for each draw call.
 * The input list will be split, if:
 *
 * * Mesh instances use different materials.
 * * Mesh instances have different parameters (e.g. lightmaps or static lights).
 * * Mesh instances have different shader defines (shadow receiving, being aligned to screen space, etc).
 * * Too many vertices for a single batch (65535 is maximum).
 * * Too many instances for a single batch (hardware-dependent, expect 128 on low-end and 1024 on high-end).
 * * Bounding box of a batch is larger than maxAabbSize in any dimension.
 *
 * @param {pc.MeshInstance[]} meshInstances - Input list of mesh instances
 * @param {boolean} dynamic - Are we preparing for a dynamic batch? Instance count will matter then (otherwise not).
 * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched objects.
 * @param {boolean} translucent - Are we batching UI elements or sprites
 * This is useful to keep a balance between the number of draw calls and the number of drawn triangles, because smaller batches can be hidden when not visible in camera.
 * @returns {pc.MeshInstance[][]} An array of arrays of mesh instances, each valid to pass to {@link pc.BatchManager#create}.
 */
BatchManager.prototype.prepare = function (meshInstances, dynamic, maxAabbSize, translucent) {
    if (meshInstances.length === 0) return [];
    if (maxAabbSize === undefined) maxAabbSize = Number.POSITIVE_INFINITY;
    var halfMaxAabbSize = maxAabbSize * 0.5;
    var maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;

    // maximum number of vertices that can be used in batch depends on 32bit index buffer support (do this for non-indexed as well,
    // as in some cases (UI elements) non-indexed geometry gets batched into indexed)
    var maxNumVertices = this.device.extUintElement ? 0xffffffff : 0xffff;

    var material, layer, vertCount, params, lightList, defs, stencil, staticLights, scaleSign, drawOrder, indexed, vertexFormatBatchingHash;
    var aabb = new BoundingBox();
    var testAabb = new BoundingBox();
    var skipTranslucentAabb = null;
    var mi, sf;

    var lists = [];
    var i, j = 0;
    if (translucent) {
        meshInstances.sort(function (a, b) {
            return a.drawOrder - b.drawOrder;
        });
    }
    var meshInstancesLeftA = meshInstances;
    var meshInstancesLeftB;

    var skipMesh = translucent ? function (mi) {
        if (skipTranslucentAabb) {
            skipTranslucentAabb.add(mi.aabb);
        } else {
            skipTranslucentAabb = mi.aabb.clone();
        }
        meshInstancesLeftB.push(mi);
    } : function (mi) {
        meshInstancesLeftB.push(mi);
    };

    while (meshInstancesLeftA.length > 0) {
        lists[j] = [meshInstancesLeftA[0]];
        meshInstancesLeftB = [];
        material = meshInstancesLeftA[0].material;
        layer = meshInstancesLeftA[0].layer;
        defs = meshInstancesLeftA[0]._shaderDefs;
        params = meshInstancesLeftA[0].parameters;
        stencil = meshInstancesLeftA[0].stencilFront;
        lightList = meshInstancesLeftA[0]._staticLightList;
        vertCount = meshInstancesLeftA[0].mesh.vertexBuffer.getNumVertices();
        drawOrder = meshInstancesLeftA[0].drawOrder;
        aabb.copy(meshInstancesLeftA[0].aabb);
        scaleSign = getScaleSign(meshInstancesLeftA[0]);
        vertexFormatBatchingHash = meshInstancesLeftA[0].mesh.vertexBuffer.format.batchingHash;
        indexed = meshInstancesLeftA[0].mesh.primitive[0].indexed;
        skipTranslucentAabb = null;

        for (i = 1; i < meshInstancesLeftA.length; i++) {
            mi = meshInstancesLeftA[i];

            // Split by instance number
            if (dynamic && lists[j].length >= maxInstanceCount) {
                meshInstancesLeftB = meshInstancesLeftB.concat(meshInstancesLeftA.slice(i));
                break;
            }

            // Split by material, layer (legacy), vertex format & index compatibility, shader defines, static source, vert count, overlapping UI
            if ((material !== mi.material) ||
                (layer !== mi.layer) ||
                (vertexFormatBatchingHash !== mi.mesh.vertexBuffer.format.batchingHash) ||
                (indexed !== mi.mesh.primitive[0].indexed) ||
                (defs !== mi._shaderDefs) ||
                (vertCount + mi.mesh.vertexBuffer.getNumVertices() > maxNumVertices)) {
                skipMesh(mi);
                continue;
            }
            // Split by AABB
            testAabb.copy(aabb);
            testAabb.add(mi.aabb);
            if (testAabb.halfExtents.x > halfMaxAabbSize ||
                testAabb.halfExtents.y > halfMaxAabbSize ||
                testAabb.halfExtents.z > halfMaxAabbSize) {
                skipMesh(mi);
                continue;
            }
            // Split stencil mask (UI elements), both front and back expected to be the same
            if (stencil) {
                if (!(sf = mi.stencilFront) || stencil.func != sf.func || stencil.zpass != sf.zpass) {
                    skipMesh(mi);
                    continue;
                }
            }
            // Split by negative scale
            if (scaleSign != getScaleSign(mi)) {
                skipMesh(mi);
                continue;
            }

            // Split by parameters
            if (!equalParamSets(params, mi.parameters)) {
                skipMesh(mi);
                continue;
            }
            // Split by static light list
            staticLights = mi._staticLightList;
            if (lightList && staticLights) {
                if (!equalLightLists(lightList, staticLights)) {
                    skipMesh(mi);
                    continue;
                }
            } else if (lightList || staticLights) { // Split by static/non static
                skipMesh(mi);
                continue;
            }

            if (translucent && skipTranslucentAabb && skipTranslucentAabb.intersects(mi.aabb) && mi.drawOrder !== drawOrder) {
                skipMesh(mi);
                continue;
            }

            aabb.add(mi.aabb);
            vertCount += mi.mesh.vertexBuffer.getNumVertices();
            lists[j].push(mi);
        }

        j++;
        meshInstancesLeftA = meshInstancesLeftB;
    }

    return lists;
};

/**
 * @function
 * @name pc.BatchManager#create
 * @description Takes a mesh instance list that has been prepared by {@link pc.BatchManager#prepare}, and returns a {@link pc.Batch} object. This method assumes that all mesh instances provided can be rendered in a single draw call.
 * @param {pc.MeshInstance[]} meshInstances - Input list of mesh instances.
 * @param {boolean} dynamic - Is it a static or dynamic batch? Will objects be transformed after batching?
 * @param {number} [batchGroupId] - Link this batch to a specific batch group. This is done automatically with default batches.
 * @returns {pc.Batch} The resulting batch object.
 */
BatchManager.prototype.create = function (meshInstances, dynamic, batchGroupId) {

    // #ifdef PROFILER
    var time = now();
    // #endif

    if (!this._init) {
        var boneLimit = "#define BONE_LIMIT " + this.device.getBoneLimit() + "\n";
        this.transformVS = boneLimit + "#define DYNAMICBATCH\n" + shaderChunks.transformVS;
        this.skinTexVS = shaderChunks.skinBatchTexVS;
        this.skinConstVS = shaderChunks.skinBatchConstVS;
        this.vertexFormats = {};
        this._init = true;
    }

    var i, j;
    var streams = null, stream;
    var semantic;
    var material = null;
    var mesh, elems, numVerts;
    var batchNumVerts = 0;
    var batchNumIndices = 0;
    var batch = null;

    for (i = 0; i < meshInstances.length; i++) {
        if (meshInstances[i].visible) {

            // vertex counts
            mesh = meshInstances[i].mesh;
            numVerts = mesh.vertexBuffer.numVertices;
            batchNumVerts += numVerts;

            // index counts (handles special case of TRI-FAN-type non-indexed primitive used by UI)
            batchNumIndices += mesh.primitive[0].indexed ? mesh.primitive[0].count :
                (mesh.primitive[0].type == PRIMITIVE_TRIFAN && mesh.primitive[0].count === 4 ? 6 : 0);

            // if first mesh
            if (!streams) {

                // material
                material = meshInstances[i].material;

                // collect used vertex buffer semantic information from first mesh (they all match)
                streams = {};
                elems = mesh.vertexBuffer.format.elements;
                for (j = 0; j < elems.length; j++) {
                    semantic = elems[j].name;
                    streams[semantic] = {
                        numComponents: elems[j].numComponents,
                        dataType: elems[j].dataType,
                        normalize: elems[j].normalize,
                        count: 0
                    };
                }

                // for dynamic meshes we need bone indices
                if (dynamic) {
                    streams[SEMANTIC_BLENDINDICES] = {
                        numComponents: 1,
                        dataType: TYPE_FLOAT32,
                        normalize: false,
                        count: 0
                    };
                }
            }
        }
    }

    // if anything to batch
    if (streams) {

        batch = new Batch(meshInstances, dynamic, batchGroupId);
        this._batchList.push(batch);

        var indexBase, numIndices, indexData;
        var verticesOffset = 0;
        var indexOffset = 0;
        var transform, vec = new Vec3();

        // allocate indices
        var indexArrayType = batchNumVerts <= 0xffff ? Uint16Array : Uint32Array;
        var indices = new indexArrayType(batchNumIndices);

        // allocate typed arrays to store final vertex stream data
        for (semantic in streams) {
            stream = streams[semantic];
            stream.typeArrayType = typedArrayTypes[stream.dataType];
            stream.elementByteSize = typedArrayTypesByteSize[stream.dataType];
            stream.buffer = new stream.typeArrayType(batchNumVerts * stream.numComponents);
        }

        // build vertex and index data for final mesh
        for (i = 0; i < meshInstances.length; i++) {
            if (!meshInstances[i].visible)
                continue;

            mesh = meshInstances[i].mesh;
            numVerts = mesh.vertexBuffer.numVertices;

            // matrix to transform vertices to world space for static batching
            if (!dynamic) {
                transform = meshInstances[i].node.getWorldTransform();
            }

            for (semantic in streams) {
                if (semantic !== SEMANTIC_BLENDINDICES) {
                    stream = streams[semantic];

                    // get vertex stream to typed view subarray
                    var subarray = new stream.typeArrayType(stream.buffer.buffer, stream.elementByteSize * stream.count);
                    var totalComponents = mesh.getVertexStream(semantic, subarray) * stream.numComponents;
                    stream.count += totalComponents;

                    // transform position, normal and tangent to world space
                    if (!dynamic && stream.numComponents >= 3) {
                        if (semantic == SEMANTIC_POSITION || semantic == SEMANTIC_NORMAL || semantic == SEMANTIC_TANGENT) {
                            transform.transformFunction = semantic == SEMANTIC_POSITION ? Mat4.prototype.transformPoint : Mat4.prototype.transformVector;

                            for (j = 0; j < totalComponents; j += stream.numComponents) {
                                vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
                                transform.transformFunction(vec, vec);
                                subarray[j] = vec.x;
                                subarray[j + 1] = vec.y;
                                subarray[j + 2] = vec.z;
                            }
                        }
                    }
                }
            }

            // bone index is mesh index
            if (dynamic) {
                stream = streams[SEMANTIC_BLENDINDICES];
                for (j = 0; j < numVerts; j++)
                    stream.buffer[stream.count++] = i;
            }

            // index buffer
            if (mesh.primitive[0].indexed) {
                indexBase = mesh.primitive[0].base;
                numIndices = mesh.primitive[0].count;

                // source index buffer data mapped to its format
                var srcFormat = mesh.indexBuffer[0].getFormat();
                indexData = new typedArrayIndexFormats[srcFormat](mesh.indexBuffer[0].storage);
            } else if (mesh.primitive[0].type == PRIMITIVE_TRIFAN && mesh.primitive[0].count === 4) {
                // Special case for UI image elements
                indexBase = 0;
                numIndices = 6;
                indexData = [0, 1, 3, 2, 3, 1];
            } else {
                numIndices = 0;
                continue;
            }

            for (j = 0; j < numIndices; j++) {
                indices[j + indexOffset] = indexData[indexBase + j] + verticesOffset;
            }

            indexOffset += numIndices;
            verticesOffset += numVerts;
        }

        // Create mesh
        mesh = new Mesh(this.device);
        for (semantic in streams) {
            stream = streams[semantic];
            mesh.setVertexStream(semantic, stream.buffer, stream.numComponents, undefined, stream.dataType, stream.normalize);
        }

        if (indices.length > 0)
            mesh.setIndices(indices);

        mesh.update(PRIMITIVE_TRIANGLES, false);

        // Patch the material
        if (dynamic) {
            material = material.clone();
            material.chunks.transformVS = this.transformVS;
            material.chunks.skinTexVS = this.skinTexVS;
            material.chunks.skinConstVS = this.skinConstVS;
            material.update();
        }

        // Create meshInstance
        var meshInstance = new MeshInstance(this.rootNode, mesh, material);
        meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
        meshInstance.parameters = batch.origMeshInstances[0].parameters;
        meshInstance.isStatic = batch.origMeshInstances[0].isStatic;
        meshInstance.layer = batch.origMeshInstances[0].layer;
        meshInstance._staticLightList = batch.origMeshInstances[0]._staticLightList;
        meshInstance._shaderDefs = batch.origMeshInstances[0]._shaderDefs;

        // meshInstance culling - don't cull UI elements, as they use custom culling Component.isVisibleForCamera
        meshInstance.cull = batch.origMeshInstances[0].cull;
        var batchGroup = this._batchGroups[batchGroupId];
        if (batchGroup && batchGroup._ui)
            meshInstance.cull = false;

        if (dynamic) {
            // Create skinInstance
            var nodes = [];
            for (i = 0; i < batch.origMeshInstances.length; i++) {
                nodes.push(batch.origMeshInstances[i].node);
            }
            meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
        }

        // disable aabb update, gets updated manually by batcher
        meshInstance._updateAabb = false;

        meshInstance.drawOrder = batch.origMeshInstances[0].drawOrder;
        meshInstance.stencilFront = batch.origMeshInstances[0].stencilFront;
        meshInstance.stencilBack = batch.origMeshInstances[0].stencilBack;
        meshInstance.flipFaces = getScaleSign(batch.origMeshInstances[0]) < 0;
        batch.meshInstance = meshInstance;
        this.update(batch);

        var newModel = new Model();
        newModel.meshInstances = [batch.meshInstance];
        newModel.castShadows = batch.origMeshInstances[0].castShadows;

        batch.model = newModel;
    }

    // #ifdef PROFILER
    this._stats.createTime += now() - time;
    // #endif

    return batch;
};

/**
 * @private
 * @function
 * @name pc.BatchManager#update
 * @description Updates bounding box for a batch. Called automatically.
 * @param {pc.Batch} batch - A batch object.
 */
BatchManager.prototype.update = function (batch) {
    batch._aabb.copy(batch.origMeshInstances[0].aabb);
    for (var i = 1; i < batch.origMeshInstances.length; i++) {
        batch._aabb.add(batch.origMeshInstances[i].aabb); // this is the slowest part
    }
    batch.meshInstance.aabb = batch._aabb;
    batch._aabb._radiusVer = -1;
    batch.meshInstance._aabbVer = 0;
};

/**
 * @private
 * @function
 * @name pc.BatchManager#updateAll
 * @description Updates bounding boxes for all dynamic batches. Called automatically.
 */
BatchManager.prototype.updateAll = function () {
    // TODO: only call when needed. Applies to skinning matrices as well

    if (this._dirtyGroups.length > 0) {
        this.generate(this._dirtyGroups);
    }

    // #ifdef PROFILER
    var time = now();
    // #endif

    for (var i = 0; i < this._batchList.length; i++) {
        if (!this._batchList[i].dynamic) continue;
        this.update(this._batchList[i]);
    }

    // #ifdef PROFILER
    this._stats.updateLastFrameTime = now() - time;
    // #endif
};

/**
 * @function
 * @name pc.BatchManager#clone
 * @description Clones a batch. This method doesn't rebuild batch geometry, but only creates a new model and batch objects, linked to different source mesh instances.
 * @param {pc.Batch} batch - A batch object.
 * @param {pc.MeshInstance[]} clonedMeshInstances - New mesh instances.
 * @returns {pc.Batch} New batch object.
 */
BatchManager.prototype.clone = function (batch, clonedMeshInstances) {
    var batch2 = new Batch(clonedMeshInstances, batch.dynamic, batch.batchGroupId);
    this._batchList.push(batch2);

    var nodes = [];
    for (var i = 0; i < clonedMeshInstances.length; i++) {
        nodes.push(clonedMeshInstances[i].node);
    }

    batch2.meshInstance = new MeshInstance(batch.meshInstance.node, batch.meshInstance.mesh, batch.meshInstance.material);
    batch2.meshInstance._updateAabb = false;
    batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
    batch2.meshInstance.isStatic = clonedMeshInstances[0].isStatic;
    batch2.meshInstance.cull = clonedMeshInstances[0].cull;
    batch2.meshInstance.layer = clonedMeshInstances[0].layer;
    batch2.meshInstance._staticLightList = clonedMeshInstances[0]._staticLightList;

    if (batch.dynamic) {
        batch2.meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
    }

    batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
    batch2.meshInstance._shader = batch.meshInstance._shader;

    var newModel = new Model();

    newModel.meshInstances = [batch2.meshInstance];
    newModel.castShadows = batch.origMeshInstances[0].castShadows;
    batch2.model = newModel;

    return batch2;
};

/**
 * @private
 * @function
 * @name pc.BatchManager#destroy
 * @description Mark the batches ref counter to 0, remove the batch model out of all layers and destroy it.
 * @param {pc.Batch} batch - A batch object.
 */
BatchManager.prototype.destroy = function (batch) {
    batch.refCounter = 0;
    if (!batch.model)
        return;
    var layers = this._batchGroups[batch.batchGroupId].layers;
    for (var i = 0; i < layers.length; i++) {
        var layer = this.scene.layers.getLayerById(layers[i]);
        if (layer)
            layer.removeMeshInstances(batch.model.meshInstances);
    }
    batch.model.destroy();
};

/**
 * @private
 * @function
 * @name pc.BatchManager#decrement
 * @description Decrements reference counter on a batch. If it's zero, the batch is removed from scene, and its geometry is deleted from memory.
 * @param {pc.Batch} batch - A batch object.
 */
BatchManager.prototype.decrement = function (batch) {
    batch.refCounter--;
    if (batch.refCounter === 0) {
        this.destroy(batch);
    }
};

export { Batch, BatchGroup, BatchManager };
