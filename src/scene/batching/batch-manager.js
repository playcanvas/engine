import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';

import {
    PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES,
    TYPE_FLOAT32,
    typedArrayIndexFormats, typedArrayTypes, typedArrayTypesByteSize
} from '../../platform/graphics/constants.js';

import { SPRITE_RENDERMODE_SIMPLE } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { Batch } from './batch.js';
import { BatchGroup } from './batch-group.js';
import { SkinBatchInstance } from './skin-batch-instance.js';

function paramsIdentical(a, b) {
    if (a && !b) return false;
    if (!a && b) return false;
    a = a.data;
    b = b.data;
    if (a === b) return true;
    if (a instanceof Float32Array && b instanceof Float32Array) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    return false;
}

function equalParamSets(params1, params2) {
    for (const param in params1) { // compare A -> B
        if (params1.hasOwnProperty(param) && !paramsIdentical(params1[param], params2[param]))
            return false;
    }
    for (const param in params2) { // compare B -> A
        if (params2.hasOwnProperty(param) && !paramsIdentical(params2[param], params1[param]))
            return false;
    }
    return true;
}

const _triFanIndices = [0, 1, 3, 2, 3, 1];
const _triStripIndices = [0, 1, 3, 0, 3, 2];

const mat3 = new Mat3();

function getScaleSign(mi) {
    return mi.node.worldTransform.scaleSign;
}

/**
 * Glues many mesh instances into a single one for better performance.
 *
 * @category Graphics
 */
class BatchManager {
    /**
     * Create a new BatchManager instance.
     *
     * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device used by the batch manager.
     * @param {import('../../framework/entity.js').Entity} root - The entity under which batched
     * models are added.
     * @param {import('../scene.js').Scene} scene - The scene that the batch manager affects.
     */
    constructor(device, root, scene) {
        this.device = device;
        this.rootNode = root;
        this.scene = scene;
        this._init = false;

        this._batchGroups = {};
        this._batchGroupCounter = 0;
        this._batchList = [];
        this._dirtyGroups = [];

        // #if _PROFILER
        this._stats = {
            createTime: 0,
            updateLastFrameTime: 0
        };
        // #endif
    }

    destroy() {
        this.device = null;
        this.rootNode = null;
        this.scene = null;
        this._batchGroups = {};
        this._batchList = [];
        this._dirtyGroups = [];
    }

    /**
     * Adds new global batch group.
     *
     * @param {string} name - Custom name.
     * @param {boolean} dynamic - Is this batch group dynamic? Will these objects move/rotate/scale
     * after being batched?
     * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched
     * objects.
     * {@link BatchManager#prepare} will split objects into local groups based on this size.
     * @param {number} [id] - Optional custom unique id for the group (will be generated
     * automatically otherwise).
     * @param {number[]} [layers] - Optional layer ID array. Default is [{@link LAYERID_WORLD}].
     * The whole batch group will belong to these layers. Layers of source models will be ignored.
     * @returns {BatchGroup} Group object.
     */
    addGroup(name, dynamic, maxAabbSize, id, layers) {
        if (id === undefined) {
            id = this._batchGroupCounter;
            this._batchGroupCounter++;
        }

        if (this._batchGroups[id]) {
            Debug.error(`Batch group with id ${id} already exists.`);
            return undefined;
        }

        const group = new BatchGroup(id, name, dynamic, maxAabbSize, layers);
        this._batchGroups[id] = group;

        return group;
    }

    /**
     * Remove global batch group by id. Note, this traverses the entire scene graph and clears the
     * batch group id from all components.
     *
     * @param {number} id - Batch Group ID.
     */
    removeGroup(id) {
        if (!this._batchGroups[id]) {
            Debug.error(`Batch group with id ${id} doesn't exist.`);
            return;
        }

        // delete batches with matching id
        const newBatchList = [];
        for (let i = 0; i < this._batchList.length; i++) {
            if (this._batchList[i].batchGroupId === id) {
                this.destroyBatch(this._batchList[i]);
            } else {
                newBatchList.push(this._batchList[i]);
            }
        }
        this._batchList = newBatchList;
        this._removeModelsFromBatchGroup(this.rootNode, id);

        delete this._batchGroups[id];
    }

    /**
     * Mark a specific batch group as dirty. Dirty groups are re-batched before the next frame is
     * rendered. Note, re-batching a group is a potentially expensive operation.
     *
     * @param {number} id - Batch Group ID to mark as dirty.
     */
    markGroupDirty(id) {
        if (this._dirtyGroups.indexOf(id) < 0) {
            this._dirtyGroups.push(id);
        }
    }

    /**
     * Retrieves a {@link BatchGroup} object with a corresponding name, if it exists, or null
     * otherwise.
     *
     * @param {string} name - Name.
     * @returns {BatchGroup|null} The batch group matching the name or null if not found.
     */
    getGroupByName(name) {
        const groups = this._batchGroups;
        for (const group in groups) {
            if (!groups.hasOwnProperty(group)) continue;
            if (groups[group].name === name) {
                return groups[group];
            }
        }
        return null;
    }

    /**
     * Return a list of all {@link Batch} objects that belong to the Batch Group supplied.
     *
     * @param {number} batchGroupId - The id of the batch group.
     * @returns {Batch[]} A list of batches that are used to render the batch group.
     * @private
     */
    getBatches(batchGroupId) {
        const results = [];
        const len = this._batchList.length;
        for (let i = 0; i < len; i++) {
            const batch = this._batchList[i];
            if (batch.batchGroupId === batchGroupId) {
                results.push(batch);
            }
        }

        return results;
    }

    // traverse full hierarchy and clear the batch group id from all model, element and sprite components
    _removeModelsFromBatchGroup(node, id) {
        if (!node.enabled) return;

        if (node.model && node.model.batchGroupId === id) {
            node.model.batchGroupId = -1;
        }
        if (node.render && node.render.batchGroupId === id) {
            node.render.batchGroupId = -1;
        }
        if (node.element && node.element.batchGroupId === id) {
            node.element.batchGroupId = -1;
        }
        if (node.sprite && node.sprite.batchGroupId === id) {
            node.sprite.batchGroupId = -1;
        }

        for (let i = 0; i < node._children.length; i++) {
            this._removeModelsFromBatchGroup(node._children[i], id);
        }
    }

    insert(type, groupId, node) {
        const group = this._batchGroups[groupId];
        Debug.assert(group, `Invalid batch ${groupId} insertion`);

        if (group) {
            if (group._obj[type].indexOf(node) < 0) {
                group._obj[type].push(node);
                this.markGroupDirty(groupId);
            }
        }
    }

    remove(type, groupId, node) {
        const group = this._batchGroups[groupId];
        Debug.assert(group, `Invalid batch ${groupId} insertion`);

        if (group) {
            const idx = group._obj[type].indexOf(node);
            if (idx >= 0) {
                group._obj[type].splice(idx, 1);
                this.markGroupDirty(groupId);
            }
        }
    }

    _extractRender(node, arr, group, groupMeshInstances) {
        if (node.render) {
            arr = groupMeshInstances[node.render.batchGroupId] = arr.concat(node.render.meshInstances);
            node.render.removeFromLayers();
        }

        return arr;
    }

    _extractModel(node, arr, group, groupMeshInstances) {
        if (node.model && node.model.model) {
            arr = groupMeshInstances[node.model.batchGroupId] = arr.concat(node.model.meshInstances);
            node.model.removeModelFromLayers();

            // #if _DEBUG
            node.model._batchGroup = group;
            // #endif
        }

        return arr;
    }

    _extractElement(node, arr, group) {
        if (!node.element) return;
        let valid = false;
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
            // #if _DEBUG
            node.element._batchGroup = group;
            // #endif
        }
    }

    // traverse scene hierarchy down from `node` and collect all components that are marked
    // with a batch group id. Remove from layers any models that these components contains.
    // Fill the `groupMeshInstances` with all the mesh instances to be included in the batch groups,
    // indexed by batch group id.
    _collectAndRemoveMeshInstances(groupMeshInstances, groupIds) {
        for (let g = 0; g < groupIds.length; g++) {
            const id = groupIds[g];
            const group = this._batchGroups[id];
            if (!group) continue;
            let arr = groupMeshInstances[id];
            if (!arr) arr = groupMeshInstances[id] = [];

            for (let m = 0; m < group._obj.model.length; m++) {
                arr = this._extractModel(group._obj.model[m], arr, group, groupMeshInstances);
            }

            for (let r = 0; r < group._obj.render.length; r++) {
                arr = this._extractRender(group._obj.render[r], arr, group, groupMeshInstances);
            }

            for (let e = 0; e < group._obj.element.length; e++) {
                this._extractElement(group._obj.element[e], arr, group);
            }

            for (let s = 0; s < group._obj.sprite.length; s++) {
                const node = group._obj.sprite[s];
                if (node.sprite && node.sprite._meshInstance &&
                    (group.dynamic || node.sprite.sprite._renderMode === SPRITE_RENDERMODE_SIMPLE)) {
                    arr.push(node.sprite._meshInstance);
                    node.sprite.removeModelFromLayers();
                    group._sprite = true;
                    node.sprite._batchGroup = group;
                }
            }
        }
    }

    /**
     * Destroys all batches and creates new based on scene models. Hides original models. Called by
     * engine automatically on app start, and if batchGroupIds on models are changed.
     *
     * @param {number[]} [groupIds] - Optional array of batch group IDs to update. Otherwise all
     * groups are updated.
     */
    generate(groupIds) {
        const groupMeshInstances = {};

        if (!groupIds) {
            // Full scene
            groupIds = Object.keys(this._batchGroups);
        }

        // delete old batches with matching batchGroupId
        const newBatchList = [];
        for (let i = 0; i < this._batchList.length; i++) {
            if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
                newBatchList.push(this._batchList[i]);
                continue;
            }
            this.destroyBatch(this._batchList[i]);
        }
        this._batchList = newBatchList;

        // collect
        this._collectAndRemoveMeshInstances(groupMeshInstances, groupIds);

        if (groupIds === this._dirtyGroups) {
            this._dirtyGroups.length = 0;
        } else {
            const newDirtyGroups = [];
            for (let i = 0; i < this._dirtyGroups.length; i++) {
                if (groupIds.indexOf(this._dirtyGroups[i]) < 0) newDirtyGroups.push(this._dirtyGroups[i]);
            }
            this._dirtyGroups = newDirtyGroups;
        }

        let group, lists, groupData, batch;
        for (const groupId in groupMeshInstances) {
            if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
            group = groupMeshInstances[groupId];

            groupData = this._batchGroups[groupId];
            if (!groupData) {
                Debug.error(`batch group ${groupId} not found`);
                continue;
            }

            lists = this.prepare(group, groupData.dynamic, groupData.maxAabbSize, groupData._ui || groupData._sprite);
            for (let i = 0; i < lists.length; i++) {
                batch = this.create(lists[i], groupData.dynamic, parseInt(groupId, 10));
                if (batch) {
                    batch.addToLayers(this.scene, groupData.layers);
                }
            }
        }
    }


    /**
     * Takes a list of mesh instances to be batched and sorts them into lists one for each draw
     * call. The input list will be split, if:
     *
     * - Mesh instances use different materials.
     * - Mesh instances have different parameters (e.g. lightmaps or static lights).
     * - Mesh instances have different shader defines (shadow receiving, being aligned to screen
     * space, etc).
     * - Too many vertices for a single batch (65535 is maximum).
     * - Too many instances for a single batch (hardware-dependent, expect 128 on low-end and 1024
     * on high-end).
     * - Bounding box of a batch is larger than maxAabbSize in any dimension.
     *
     * @param {MeshInstance[]} meshInstances - Input list of mesh instances
     * @param {boolean} dynamic - Are we preparing for a dynamic batch? Instance count will matter
     * then (otherwise not).
     * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched
     * objects.
     * @param {boolean} translucent - Are we batching UI elements or sprites
     * This is useful to keep a balance between the number of draw calls and the number of drawn
     * triangles, because smaller batches can be hidden when not visible in camera.
     * @returns {MeshInstance[][]} An array of arrays of mesh instances, each valid to pass to
     * {@link BatchManager#create}.
     */
    prepare(meshInstances, dynamic, maxAabbSize = Number.POSITIVE_INFINITY, translucent) {
        if (meshInstances.length === 0) return [];
        const halfMaxAabbSize = maxAabbSize * 0.5;
        const maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;

        // maximum number of vertices that can be used in batch depends on 32bit index buffer support (do this for non-indexed as well,
        // as in some cases (UI elements) non-indexed geometry gets batched into indexed)
        const maxNumVertices = this.device.extUintElement ? 0xffffffff : 0xffff;

        const aabb = new BoundingBox();
        const testAabb = new BoundingBox();
        let skipTranslucentAabb = null;
        let sf;

        const lists = [];
        let j = 0;
        if (translucent) {
            meshInstances.sort(function (a, b) {
                return a.drawOrder - b.drawOrder;
            });
        }
        let meshInstancesLeftA = meshInstances;
        let meshInstancesLeftB;

        const skipMesh = translucent ? function (mi) {
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
            const material = meshInstancesLeftA[0].material;
            const layer = meshInstancesLeftA[0].layer;
            const defs = meshInstancesLeftA[0]._shaderDefs;
            const params = meshInstancesLeftA[0].parameters;
            const stencil = meshInstancesLeftA[0].stencilFront;
            let vertCount = meshInstancesLeftA[0].mesh.vertexBuffer.getNumVertices();
            const drawOrder = meshInstancesLeftA[0].drawOrder;
            aabb.copy(meshInstancesLeftA[0].aabb);
            const scaleSign = getScaleSign(meshInstancesLeftA[0]);
            const vertexFormatBatchingHash = meshInstancesLeftA[0].mesh.vertexBuffer.format.batchingHash;
            const indexed = meshInstancesLeftA[0].mesh.primitive[0].indexed;
            skipTranslucentAabb = null;

            for (let i = 1; i < meshInstancesLeftA.length; i++) {
                const mi = meshInstancesLeftA[i];

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
                    if (!(sf = mi.stencilFront) || stencil.func !== sf.func || stencil.zpass !== sf.zpass) {
                        skipMesh(mi);
                        continue;
                    }
                }
                // Split by negative scale
                if (scaleSign !== getScaleSign(mi)) {
                    skipMesh(mi);
                    continue;
                }

                // Split by parameters
                if (!equalParamSets(params, mi.parameters)) {
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
    }

    collectBatchedMeshData(meshInstances, dynamic) {

        let streams = null;
        let batchNumVerts = 0;
        let batchNumIndices = 0;
        let material = null;

        for (let i = 0; i < meshInstances.length; i++) {
            if (meshInstances[i].visible) {

                // vertex counts
                const mesh = meshInstances[i].mesh;
                const numVerts = mesh.vertexBuffer.numVertices;
                batchNumVerts += numVerts;

                // index count
                if (mesh.primitive[0].indexed) {
                    batchNumIndices += mesh.primitive[0].count;
                } else {
                    // special case of fan / strip non-indexed primitive used by UI
                    const primitiveType = mesh.primitive[0].type;
                    if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
                        if (mesh.primitive[0].count === 4)
                            batchNumIndices += 6;
                    }
                }

                // if first mesh
                if (!streams) {

                    // material
                    material = meshInstances[i].material;

                    // collect used vertex buffer semantic information from first mesh (they all match)
                    streams = {};
                    const elems = mesh.vertexBuffer.format.elements;
                    for (let j = 0; j < elems.length; j++) {
                        const semantic = elems[j].name;
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

        return {
            streams: streams,
            batchNumVerts: batchNumVerts,
            batchNumIndices: batchNumIndices,
            material: material
        };
    }

    /**
     * Takes a mesh instance list that has been prepared by {@link BatchManager#prepare}, and
     * returns a {@link Batch} object. This method assumes that all mesh instances provided can be
     * rendered in a single draw call.
     *
     * @param {MeshInstance[]} meshInstances - Input list of mesh instances.
     * @param {boolean} dynamic - Is it a static or dynamic batch? Will objects be transformed
     * after batching?
     * @param {number} [batchGroupId] - Link this batch to a specific batch group. This is done
     * automatically with default batches.
     * @returns {Batch} The resulting batch object.
     */
    create(meshInstances, dynamic, batchGroupId) {

        // #if _PROFILER
        const time = now();
        // #endif

        if (!this._init) {
            const boneLimit = '#define BONE_LIMIT ' + this.device.getBoneLimit() + '\n';
            this.transformVS = boneLimit + '#define DYNAMICBATCH\n' + shaderChunks.transformVS;
            this.skinTexVS = shaderChunks.skinBatchTexVS;
            this.skinConstVS = shaderChunks.skinBatchConstVS;
            this.vertexFormats = {};
            this._init = true;
        }

        let stream = null;
        let semantic;
        let mesh, numVerts;
        let batch = null;

        // find out vertex streams and counts
        const batchData = this.collectBatchedMeshData(meshInstances, dynamic);

        // if anything to batch
        if (batchData.streams) {

            const streams = batchData.streams;
            let material = batchData.material;
            const batchNumVerts = batchData.batchNumVerts;
            const batchNumIndices = batchData.batchNumIndices;

            batch = new Batch(meshInstances, dynamic, batchGroupId);
            this._batchList.push(batch);

            let indexBase, numIndices, indexData;
            let verticesOffset = 0;
            let indexOffset = 0;
            let transform;
            const vec = new Vec3();

            // allocate indices
            const indexArrayType = batchNumVerts <= 0xffff ? Uint16Array : Uint32Array;
            const indices = new indexArrayType(batchNumIndices);

            // allocate typed arrays to store final vertex stream data
            for (semantic in streams) {
                stream = streams[semantic];
                stream.typeArrayType = typedArrayTypes[stream.dataType];
                stream.elementByteSize = typedArrayTypesByteSize[stream.dataType];
                stream.buffer = new stream.typeArrayType(batchNumVerts * stream.numComponents);
            }

            // build vertex and index data for final mesh
            for (let i = 0; i < meshInstances.length; i++) {
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
                        const subarray = new stream.typeArrayType(stream.buffer.buffer, stream.elementByteSize * stream.count);
                        const totalComponents = mesh.getVertexStream(semantic, subarray) * stream.numComponents;
                        stream.count += totalComponents;

                        // transform position, normal and tangent to world space
                        if (!dynamic && stream.numComponents >= 3) {
                            if (semantic === SEMANTIC_POSITION) {
                                for (let j = 0; j < totalComponents; j += stream.numComponents) {
                                    vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
                                    transform.transformPoint(vec, vec);
                                    subarray[j] = vec.x;
                                    subarray[j + 1] = vec.y;
                                    subarray[j + 2] = vec.z;
                                }
                            } else if (semantic === SEMANTIC_NORMAL || semantic === SEMANTIC_TANGENT) {

                                // handle non-uniform scale by using transposed inverse matrix to transform vectors
                                mat3.invertMat4(transform).transpose();

                                for (let j = 0; j < totalComponents; j += stream.numComponents) {
                                    vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
                                    mat3.transformVector(vec, vec);
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
                    for (let j = 0; j < numVerts; j++)
                        stream.buffer[stream.count++] = i;
                }

                // index buffer
                if (mesh.primitive[0].indexed) {
                    indexBase = mesh.primitive[0].base;
                    numIndices = mesh.primitive[0].count;

                    // source index buffer data mapped to its format
                    const srcFormat = mesh.indexBuffer[0].getFormat();
                    indexData = new typedArrayIndexFormats[srcFormat](mesh.indexBuffer[0].storage);

                } else { // non-indexed

                    const primitiveType = mesh.primitive[0].type;
                    if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
                        if (mesh.primitive[0].count === 4) {
                            indexBase = 0;
                            numIndices = 6;
                            indexData = primitiveType === PRIMITIVE_TRIFAN ? _triFanIndices : _triStripIndices;
                        } else {
                            numIndices = 0;
                            continue;
                        }
                    }
                }

                for (let j = 0; j < numIndices; j++) {
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
            const meshInstance = new MeshInstance(mesh, material, this.rootNode);
            meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
            meshInstance.parameters = batch.origMeshInstances[0].parameters;
            meshInstance.layer = batch.origMeshInstances[0].layer;
            meshInstance._shaderDefs = batch.origMeshInstances[0]._shaderDefs;

            // meshInstance culling - don't cull UI elements, as they use custom culling Component.isVisibleForCamera
            meshInstance.cull = batch.origMeshInstances[0].cull;
            const batchGroup = this._batchGroups[batchGroupId];
            if (batchGroup && batchGroup._ui)
                meshInstance.cull = false;

            if (dynamic) {
                // Create skinInstance
                const nodes = [];
                for (let i = 0; i < batch.origMeshInstances.length; i++) {
                    nodes.push(batch.origMeshInstances[i].node);
                }
                meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
            }

            // disable aabb update, gets updated manually by batcher
            meshInstance._updateAabb = false;

            meshInstance.drawOrder = batch.origMeshInstances[0].drawOrder;
            meshInstance.stencilFront = batch.origMeshInstances[0].stencilFront;
            meshInstance.stencilBack = batch.origMeshInstances[0].stencilBack;
            meshInstance.flipFacesFactor = getScaleSign(batch.origMeshInstances[0]);
            meshInstance.castShadow = batch.origMeshInstances[0].castShadow;

            batch.meshInstance = meshInstance;
            batch.updateBoundingBox();
        }

        // #if _PROFILER
        this._stats.createTime += now() - time;
        // #endif

        return batch;
    }

    /**
     * Updates bounding boxes for all dynamic batches. Called automatically.
     *
     * @ignore
     */
    updateAll() {
        // TODO: only call when needed. Applies to skinning matrices as well

        if (this._dirtyGroups.length > 0) {
            this.generate(this._dirtyGroups);
        }

        // #if _PROFILER
        const time = now();
        // #endif

        for (let i = 0; i < this._batchList.length; i++) {
            if (!this._batchList[i].dynamic) continue;
            this._batchList[i].updateBoundingBox();
        }

        // #if _PROFILER
        this._stats.updateLastFrameTime = now() - time;
        // #endif
    }

    /**
     * Clones a batch. This method doesn't rebuild batch geometry, but only creates a new model and
     * batch objects, linked to different source mesh instances.
     *
     * @param {Batch} batch - A batch object.
     * @param {MeshInstance[]} clonedMeshInstances - New mesh instances.
     * @returns {Batch} New batch object.
     */
    clone(batch, clonedMeshInstances) {
        const batch2 = new Batch(clonedMeshInstances, batch.dynamic, batch.batchGroupId);
        this._batchList.push(batch2);

        const nodes = [];
        for (let i = 0; i < clonedMeshInstances.length; i++) {
            nodes.push(clonedMeshInstances[i].node);
        }

        batch2.meshInstance = new MeshInstance(batch.meshInstance.mesh, batch.meshInstance.material, batch.meshInstance.node);
        batch2.meshInstance._updateAabb = false;
        batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
        batch2.meshInstance.cull = clonedMeshInstances[0].cull;
        batch2.meshInstance.layer = clonedMeshInstances[0].layer;

        if (batch.dynamic) {
            batch2.meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
        }

        batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
        batch2.meshInstance._shader = batch.meshInstance._shader.slice();

        batch2.meshInstance.castShadow = batch.meshInstance.castShadow;

        return batch2;
    }

    /**
     * Removes the batch model from all layers and destroys it.
     *
     * @param {Batch} batch - A batch object.
     * @private
     */
    destroyBatch(batch) {
        batch.destroy(this.scene, this._batchGroups[batch.batchGroupId].layers);
    }
}

export { BatchManager };
