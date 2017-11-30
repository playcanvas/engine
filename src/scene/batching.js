pc.extend(pc, function () {

    /**
     * @name pc.Batch
     * @class Holds information about batched mesh instances. Created in {@link pc.BatchManager#create}.
     * @property {Array} origMeshInstances An array of original mesh instances, from which this batch was generated.
     * @property {pc.MeshInstance} meshInstance A single combined mesh instance, the result of batching.
     * @property {pc.Model} model A handy model object, ready to use in {@link pc.Scene#addModel} and {@link pc.Scene#removeModel}.
     * @property {Boolean} dynamic Whether this batch is dynamic (supports transforming mesh instances at runtime).
     * @property {Number} [batchGroupId] Link this batch to a specific batch group. This is done automatically with default batches.
     */
    var Batch = function (meshInstances, dynamic, batchGroupId) {
        this.origMeshInstances = meshInstances;
        this._aabb = new pc.BoundingBox();
        this.meshInstance = null;
        this.model = null;
        this.dynamic = dynamic;
        this.batchGroupId = batchGroupId;
    };

    /**
     * @name pc.BatchGroup
     * @class Holds mesh batching settings and a unique id. Created via {@link pc.BatchManager#addGroup}.
     * @property {Boolean} dynamic Whether objects within this batch group should support transforming at runtime.
     * @property {Number} maxAabbSize Maximum size of any dimension of a bounding box around batched objects.
     * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
     * @property {Number} id Unique id. Can be assigned to model and element components.
     * @property {String} name Name of the group.
     */
    var BatchGroup = function (id, name, dynamic, maxAabbSize) {
        this.dynamic = dynamic;
        this.maxAabbSize = maxAabbSize;
        this.id = id;
        this.name = name;
    };

    // Modified SkinInstance for batching
    // Doesn't contain bind matrices, simplier
    var SkinBatchInstance = function (device, nodes, rootNode) {
        this.device = device;
        this.rootNode = rootNode;
        this._dirty = true;

        // Unique per clone
        this.bones = nodes;

        var numBones = nodes.length;

        if (device.supportsBoneTextures) {
            var size;
            if (numBones > 256)
                size = 64;
            else if (numBones > 64)
                size = 32;
            else if (numBones > 16)
                size = 16;
            else
                size = 8;

            this.boneTexture = new pc.Texture(device, {
                width: size,
                height: size,
                format: pc.PIXELFORMAT_RGBA32F,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST
            });
            this.matrixPalette = this.boneTexture.lock();
        } else {
            this.matrixPalette = new Float32Array(numBones * 16);
        }
    };

    SkinBatchInstance.prototype = {

        updateMatrices: function () {
        },

        updateMatrixPalette: function () {
            var pe;
            var mp = this.matrixPalette;
            var base;

            for (var i = this.bones.length - 1; i >= 0; i--) {
                pe = this.bones[i].getWorldTransform().data;

                // Copy the matrix into the palette, ready to be sent to the vertex shader
                base = i * 16;
                mp[base] = pe[0];
                mp[base + 1] = pe[1];
                mp[base + 2] = pe[2];
                mp[base + 3] = pe[3];
                mp[base + 4] = pe[4];
                mp[base + 5] = pe[5];
                mp[base + 6] = pe[6];
                mp[base + 7] = pe[7];
                mp[base + 8] = pe[8];
                mp[base + 9] = pe[9];
                mp[base + 10] = pe[10];
                mp[base + 11] = pe[11];
                mp[base + 12] = pe[12];
                mp[base + 13] = pe[13];
                mp[base + 14] = pe[14];
                mp[base + 15] = pe[15];
            }

            if (this.device.supportsBoneTextures) {
                this.boneTexture.lock();
                this.boneTexture.unlock();
            }
        }
    };

    /**
     * @name pc.BatchManager
     * @class Glues many mesh instances into a single one for better performance.
     */
    var BatchManager = function (device, root, scene) {
        this.device = device;
        this.rootNode = root;
        this.scene = scene;
        this._init = false;

        this._batchGroups = {};
        this._batchGroupCounter = 0;
        this._batchList = [];

        // #ifdef PROFILER
        this._stats = {
            createTime: 0,
            updateLastFrameTime: 0
        };
        // #endif
    };

    /**
     * @function
     * @name pc.BatchManager#addGroup
     * @description Adds new global batch group.
     * @param {String} name Custom name
     * @param {Boolean} dynamic Is this batch group dynamic? Will these objects move/rotate/scale after being batched?
     * @param {Number} maxAabbSize Maximum size of any dimension of a bounding box around batched objects.
     * {@link pc.BatchManager#prepare} will split objects into local groups based on this size.
     * @param {Number} [id] Optional custom unique id for the group (will be generated automatically otherwise).
     * @returns {pc.BatchGroup} Group object.
     */
    BatchManager.prototype.addGroup = function(name, dynamic, maxAabbSize, id) {
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
        this._batchGroups[id] = group = new pc.BatchGroup(id, name, dynamic, maxAabbSize);

        return group;
    };

    /**
     * @function
     * @name pc.BatchManager#removeGroup
     * @description Remove global batch group by id.
     * @param {String} id Group id
     */
    BatchManager.prototype.removeGroup = function(id) {
        if (!this._batchGroups[id]) {
            // #ifdef DEBUG
            console.error("batch group with id " + id + " doesn't exist");
            // #endif
            return;
        }

        // delete batches with matching id
        var newBatchList = [];
        for(var i=0; i<this._batchList.length; i++) {
            if (this._batchList[i].batchGroupId !== id) {
                newBatchList.push(this._batchList[i]);
                continue;
            }
            this._batchList[i].refCounter = 1;
            this.destroy(this._batchList[i]);
        }
        this._batchList = newBatchList;
        this._removeModelsFromBatchGroup(this.rootNode, id);

        delete this._batchGroups[id];
    };

    BatchManager.prototype._removeModelsFromBatchGroup = function(node, id) {
        if (!node.enabled) return;

        if (node.model && node.model.batchGroupId === id) {
            node.model.batchGroupId = -1;
        }
        if (node.element && node.element.batchGroupId === id) {
            node.element.batchGroupId = -1;
        }

        for(var i = 0; i < node._children.length; i++) {
            this._removeModelsFromBatchGroup(node._children[i], id);
        }
    };

    BatchManager.prototype._collectAndRemoveModels = function(node, groupMeshInstances, groupIds) {
        if (!node.enabled) return;

        var i;
        if (node.model && node.model.batchGroupId >= 0 && node.model.model && node.model.enabled) {
            if (!groupIds || (groupIds && groupIds.indexOf(node.model.batchGroupId) >= 0)) {
                var arr = groupMeshInstances[node.model.batchGroupId];
                if (!arr) arr = groupMeshInstances[node.model.batchGroupId] = [];

                if (node.model.isStatic) {
                    // static mesh instances can be in both drawCall array with _staticSource linking to original
                    // and in the original array as well, if no triangle splitting was done
                    var drawCalls = this.scene.drawCalls;
                    var nodeMeshInstances = node.model.meshInstances;
                    for(i=0; i<drawCalls.length; i++) {
                        if (!drawCalls[i]._staticSource) continue;
                        if (nodeMeshInstances.indexOf(drawCalls[i]._staticSource) < 0) continue;
                        groupMeshInstances[node.model.batchGroupId].push(drawCalls[i]);
                    }
                    for(i=0; i<nodeMeshInstances.length; i++) {
                        if (drawCalls.indexOf(nodeMeshInstances[i]) >= 0) {
                            groupMeshInstances[node.model.batchGroupId].push(nodeMeshInstances[i]);
                        }
                    }
                } else {
                    groupMeshInstances[node.model.batchGroupId] = arr.concat(node.model.meshInstances);
                }

                this.scene.removeModel(node.model.model);
                // #ifdef DEBUG
                node.model._batchGroup = this._batchGroups[node.model.batchGroupId];
                // #endif
            }
        }

        if (node.element && node.element.batchGroupId >= 0 && node.element.enabled) {
            if (!groupIds || (groupIds && groupIds.indexOf(node.element.batchGroupId) >= 0)) {
                var arr = groupMeshInstances[node.element.batchGroupId];
                if (!arr) arr = groupMeshInstances[node.element.batchGroupId] = [];
                var valid = false;
                if (node.element._text) {
                    groupMeshInstances[node.element.batchGroupId].push(node.element._text._model.meshInstances[0]);
                    this.scene.removeModel(node.element._text._model);
                    valid = true;
                } else if (node.element._image) {
                    groupMeshInstances[node.element.batchGroupId].push(node.element._image._model.meshInstances[0]);
                    this.scene.removeModel(node.element._image._model);
                    valid = true;
                }
                // #ifdef DEBUG
                if (valid) {
                    node.element._batchGroup = this._batchGroups[node.element.batchGroupId];
                }
                // #endif
            }
        }

        for(i = 0; i < node._children.length; i++) {
            this._collectAndRemoveModels(node._children[i], groupMeshInstances, groupIds);
        }
    };

    BatchManager.prototype._registerEntities = function(batch, meshInstances) {
        var node;
        var ents = [];
        for(var i=0; i<meshInstances.length; i++) {
            node = meshInstances[i].node;
            while(!node._app && node._parent) {
                node = node._parent;
            }
            if (!node._app) continue;
            // node is entity
            ents.push(node);
        }
        this.register(batch, ents);
    };

    /**
     * @function
     * @name pc.BatchManager#generate
     * @description Destroys all batches and creates new based on scene models. Hides original models. Called by engine automatically on app start.
     * @param {Array} [groupIds] Optional array of batch group IDs to update. Otherwise all groups are updated.
     */
    BatchManager.prototype.generate = function(groupIds) {
        var i;
        var groupMeshInstances = {};

        if (!groupIds) {
            // Full scene

            // delete old batches
            for(i=0; i<this._batchList.length; i++) {
                this._batchList[i].refCounter = 1;
                this.destroy(this._batchList[i]);
            }
            this._batchList.length = 0;

            // collect
            this._collectAndRemoveModels(this.rootNode, groupMeshInstances);
        } else {
            // Selected groups

            // delete old batches with matching batchGroupId
            var newBatchList = [];
            for(i=0; i<this._batchList.length; i++) {
                if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
                    newBatchList.push(this._batchList[i]);
                    continue;
                }
                this._batchList[i].refCounter = 1;
                this.destroy(this._batchList[i]);
            }
            this._batchList = newBatchList;

            // collect
            this._collectAndRemoveModels(this.rootNode, groupMeshInstances, groupIds);
        }

        var group, lists, groupData, batch;
        for(var groupId in groupMeshInstances) {
            if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
            group = groupMeshInstances[groupId];

            groupData = this._batchGroups[groupId];
            if (!groupData) {
                // #ifdef DEBUG
                console.error("batch group " + groupId + " not found");
                // #endif
                continue;
            }

            lists = this.prepare(group, groupData.dynamic, groupData.maxAabbSize);
            for(i=0; i<lists.length; i++) {
                batch = this.create(lists[i], groupData.dynamic, parseInt(groupId));
                this.scene.addModel(batch.model);
                this._registerEntities(batch, lists[i]);
            }
        }
    };

    /**
     * @function
     * @name pc.BatchManager#getGroupByName
     * @description Retrieves a {@link pc.BatchGroup} object with a corresponding name, if it exists, or null otherwise.
     * @param {String} name Name
     * @returns {pc.BatchGroup} Group object.
     */
    BatchManager.prototype.getGroupByName = function(name) {
        var groups = this._batchGroups;
        for(var group in groups) {
            if (!groups.hasOwnProperty(group)) continue;
            if (groups[group].name === name) {
                return groups[group];
            }
        }
        return null;
    };

    function paramsIdentical(a, b) {
        if (a && !b) return false;
        if (!a && b) return false;
        a = a.data;
        b = b.data;
        if (a === b) return true;
        if (a instanceof Float32Array && b instanceof Float32Array) {
            if (a.length !== b.length) return false;
            for(var i=0; i<a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }
        return false;
    }

    /**
     * @function
     * @name pc.BatchManager#prepare
     * @description Takes a list of mesh instances to be batched and sorts them into lists one for each draw call.
     * The input list will be split, if:
     * <ul>
     *     <li>Mesh instances use different materials</li>
     *     <li>Mesh instances have different parameters (e.g. lightmaps or static lights)</li>
     *     <li>Mesh instances have different layers</li>
     *     <li>Mesh instances have different shader defines (shadow receiving, being aligned to screen space, etc)</li>
     *     <li>Too many vertices for a single batch (65535 is maximum)</li>
     *     <li>Too many instances for a single batch (hardware-dependent, expect 128 on low-end and 1024 on high-end)</li>
     *     <li>Bounding box of a batch is larger than maxAabbSize in any dimension</li>
     * </ul>
     * @param {Array} meshInstances Input list of mesh instances
     * @param {Boolean} dynamic Are we preparing for a dynamic batch? Instance count will matter then (otherwise not).
     * @param {Number} maxAabbSize Maximum size of any dimension of a bounding box around batched objects.
     * This is useful to keep a balance between the number of draw calls and the number of drawn triangles, because smaller batches can be hidden when not visible in camera.
     * @returns {Array} An array of arrays of mesh instances, each valid to pass to {@link pc.BatchManager#create}.
     */
    BatchManager.prototype.prepare = function(meshInstances, dynamic, maxAabbSize) {
        if (meshInstances.length === 0) return [];
        if (maxAabbSize === undefined) maxAabbSize = Number.POSITIVE_INFINITY;
        var halfMaxAabbSize = maxAabbSize * 0.5;
        var maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;

        var i;
        var material, layer, vertCount, params, params2, param, paramFailed, lightList, defs;
        var aabb = new pc.BoundingBox();
        var testAabb = new pc.BoundingBox();

        var lists = [];
        var j = 0;
        var meshInstancesLeftA = meshInstances;
        var meshInstancesLeftB;

        var k;

        while(meshInstancesLeftA.length > 0) {
            lists[j] = [];
            meshInstancesLeftB = [];
            material = meshInstancesLeftA[0].material;
            layer = meshInstancesLeftA[0].layer;
            defs = meshInstancesLeftA[0]._shaderDefs;
            params = meshInstancesLeftA[0].parameters;
            lightList = meshInstancesLeftA[0]._staticLightList;
            vertCount = meshInstancesLeftA[0].mesh.vertexBuffer.getNumVertices();
            aabb.copy(meshInstancesLeftA[0].aabb);

            for(i=0; i<meshInstancesLeftA.length; i++) {

                if (i > 0) {
                    // Split by material
                    if (material !== meshInstancesLeftA[i].material) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by layer
                    if (layer !== meshInstancesLeftA[i].layer) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by shader defines
                    if (defs !== meshInstancesLeftA[i]._shaderDefs) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by static source
                    //
                    // Split by vert count
                    if (vertCount + meshInstancesLeftA[i].mesh.vertexBuffer.getNumVertices() > 0xFFFF) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by AABB
                    testAabb.copy(aabb);
                    testAabb.add(meshInstancesLeftA[i].aabb);
                    if (testAabb.halfExtents.x > halfMaxAabbSize ||
                        testAabb.halfExtents.y > halfMaxAabbSize ||
                        testAabb.halfExtents.z > halfMaxAabbSize) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by parameters
                    params2 = meshInstancesLeftA[i].parameters;
                    paramFailed = false;
                    for(param in params) { // compare A -> B
                        if (!params.hasOwnProperty(param)) continue;
                        if (!paramsIdentical(params[param], params2[param])) {
                            paramFailed = true;
                            break;
                        }
                    }
                    if (!paramFailed) {
                        for(param in params2) { // compare B -> A
                            if (!params2.hasOwnProperty(param)) continue;
                            if (!paramsIdentical(params2[param], params[param])) {
                                paramFailed = true;
                                break;
                            }
                        }
                    }
                    if (paramFailed) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by static/non static
                    params2 = meshInstancesLeftA[i]._staticLightList;
                    if ((lightList && !params2) || (!lightList && params2)) {
                        meshInstancesLeftB.push(meshInstancesLeftA[i]);
                        continue;
                    }
                    // Split by static light list
                    if (lightList && params2) {
                        paramFailed = false;
                        for(k=0; k<lightList.length; k++) {
                            if (params2.indexOf(lightList[k]) < 0) {
                                paramFailed = true;
                                break;
                            }
                        }
                        for(k=0; k<params2.length; k++) {
                            if (lightList.indexOf(params2[k]) < 0) {
                                paramFailed = true;
                                break;
                            }
                        }
                        if (paramFailed) {
                            meshInstancesLeftB.push(meshInstancesLeftA[i]);
                            continue;
                        }
                    }
                }

                aabb.add(meshInstancesLeftA[i].aabb);
                vertCount += meshInstancesLeftA[i].mesh.vertexBuffer.getNumVertices();
                lists[j].push(meshInstancesLeftA[i]);

                // Split by instance number
                if (dynamic && lists[j].length === maxInstanceCount) {
                    if (i === meshInstancesLeftA.length) {
                        meshInstancesLeftB = [];
                    } else {
                        meshInstancesLeftB = meshInstancesLeftA.slice(i + 1);
                    }
                    break;
                }
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
     * @param {Array} meshInstances Input list of mesh instances
     * @param {Boolean} dynamic Is it a static or dynamic batch? Will objects be transformed after batching?
     * @param {Number} [batchGroupId] Link this batch to a specific batch group. This is done automatically with default batches.
     * @returns {pc.Batch} The resulting batch object.
     */
    BatchManager.prototype.create = function(meshInstances, dynamic, batchGroupId) {

        // #ifdef PROFILER
        var time = pc.now();
        // #endif

        if (!this._init) {
            var boneLimit = "#define BONE_LIMIT " + this.device.getBoneLimit() + "\n";
            this.transformVS = boneLimit + pc.shaderChunks.transformBatchSkinnedVS;
            this.transformElementVS = boneLimit + pc.shaderChunks.transformScreenSpaceBatchSkinnedVS;
            this.skinTexVS = pc.shaderChunks.skinBatchTexVS;
            this.skinConstVS = pc.shaderChunks.skinBatchConstVS;
            this.vertexFormats = {};
            this._init = true;
        }

        var i, j;
        var batch = new pc.Batch(meshInstances, dynamic, batchGroupId);
        this._batchList.push(batch);

        // Check which vertex format and buffer size are needed, find out material
        var material = null;
        var mesh, elems, numVerts, vertSize, index;
        var hasPos, hasNormal, hasUv, hasUv2, hasTangent;
        var batchNumVerts = 0;
        var batchNumIndices = 0;
        for(i=0; i<meshInstances.length; i++) {
            if (!material) {
                material = meshInstances[i].material;
            } else {
                if (material !== meshInstances[i].material) {
                    // #ifdef DEBUG
                    console.error("BatchManager.create: multiple materials");
                    // #endif
                    return;
                }
            }
            mesh = meshInstances[i].mesh;
            elems = mesh.vertexBuffer.format.elements;
            numVerts = mesh.vertexBuffer.numVertices;
            batchNumVerts += numVerts;
            for(j=0; j<elems.length; j++) {
                if (elems[j].name === pc.SEMANTIC_POSITION) {
                    hasPos = true;
                } else if (elems[j].name === pc.SEMANTIC_NORMAL) {
                    hasNormal = true;
                } else if (elems[j].name === pc.SEMANTIC_TEXCOORD0) {
                    hasUv = true;
                } else if (elems[j].name === pc.SEMANTIC_TEXCOORD1) {
                    hasUv2 = true;
                } else if (elems[j].name === pc.SEMANTIC_TANGENT) {
                    hasTangent = true;
                }
            }
            batchNumIndices += mesh.primitive[0].count;
        }
        if (!hasPos) {
            // #ifdef DEBUG
            console.error("BatchManager.create: no position");
            // #endif
            return;
        }

        // Create buffers
        var entityIndexSizeF = dynamic ? 1 : 0;
        var batchVertSizeF = 3 + (hasNormal ? 3 : 0) + (hasUv ? 2 : 0) +  (hasUv2 ? 2 : 0) + (hasTangent ? 4 : 0) + entityIndexSizeF;
        var batchOffsetNF = 3;
        var batchOffsetUF = hasNormal ? 3*2 : 3;
        var batchOffsetU2F = (hasNormal ? 3*2 : 3) + (hasUv ? 2 : 0);
        var batchOffsetTF = (hasNormal ? 3*2 : 3) + (hasUv ? 2 : 0) + (hasUv2 ? 2 : 0);
        var batchOffsetEF = (hasNormal ? 3*2 : 3) + (hasUv ? 2 : 0) + (hasUv2 ? 2 : 0)+ (hasTangent ? 4 : 0);

        var batchData = new Float32Array(new ArrayBuffer(batchNumVerts * batchVertSizeF * 4));

        var indexBuffer = new pc.IndexBuffer(this.device, pc.INDEXFORMAT_UINT16, batchNumIndices, pc.BUFFER_STATIC);
        var batchIndexData = new Uint16Array(indexBuffer.lock());
        var matrices = new Float32Array(meshInstances.length * 16);
        var vertSizeF;

        // Fill vertex/index/matrix buffers
        var data, indexBase, numIndices, indexData, mtx;
        var verticesOffset = 0;
        var indexOffset = 0;
        var vbOffset = 0;
        var offsetPF, offsetNF, offsetUF, offsetU2F, offsetTF;
        var transform, vec, vecData;
        if (!dynamic) {
            vec = new pc.Vec3();
            vecData = vec.data;
        }

        for(i=0; i<meshInstances.length; i++) {
            mesh = meshInstances[i].mesh;
            elems = mesh.vertexBuffer.format.elements;
            numVerts = mesh.vertexBuffer.numVertices;
            vertSize = mesh.vertexBuffer.format.size;
            vertSizeF = vertSize / 4;
            for(j=0; j<elems.length; j++) {
                if (elems[j].name === pc.SEMANTIC_POSITION) {
                    offsetPF = elems[j].offset / 4;
                } else if (elems[j].name === pc.SEMANTIC_NORMAL) {
                    offsetNF = elems[j].offset / 4;
                } else if (elems[j].name === pc.SEMANTIC_TEXCOORD0) {
                    offsetUF = elems[j].offset / 4;
                } else if (elems[j].name === pc.SEMANTIC_TEXCOORD1) {
                    offsetU2F = elems[j].offset / 4;
                } else if (elems[j].name === pc.SEMANTIC_TANGENT) {
                    offsetTF = elems[j].offset / 4;
                }
            }
            data = new Float32Array(mesh.vertexBuffer.storage);
            if (dynamic) {
                // Dynamic: store mesh instances without transformation (will be applied later in the shader)
                for(j=0; j<numVerts; j++) {
                    batchData[j * batchVertSizeF + vbOffset] =          data[j * vertSizeF + offsetPF];
                    batchData[j * batchVertSizeF + vbOffset + 1] =      data[j * vertSizeF + offsetPF + 1];
                    batchData[j * batchVertSizeF + vbOffset + 2] =      data[j * vertSizeF + offsetPF + 2];
                    if (hasNormal) {
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetNF] =      data[j * vertSizeF + offsetNF];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetNF + 1] =      data[j * vertSizeF + offsetNF + 1];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetNF + 2] =      data[j * vertSizeF + offsetNF + 2];
                    }
                    if (hasUv) {
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetUF] =      data[j * vertSizeF + offsetUF];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetUF + 1] =      data[j * vertSizeF + offsetUF + 1];
                    }
                    if (hasUv2) {
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetU2F] =      data[j * vertSizeF + offsetU2F];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetU2F + 1] =      data[j * vertSizeF + offsetU2F + 1];
                    }
                    if (hasTangent) {
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF] =      data[j * vertSizeF + offsetTF];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF + 1] =      data[j * vertSizeF + offsetTF + 1];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF + 2] =      data[j * vertSizeF + offsetTF + 2];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF + 3] =      data[j * vertSizeF + offsetTF + 3];
                    }
                    batchData[j * batchVertSizeF + batchOffsetEF + vbOffset] = i;
                }
            } else {
                // Static: pre-transform vertices
                transform = meshInstances[i].node.getWorldTransform();
                for(j=0; j<numVerts; j++) {
                    vec.set(data[j * vertSizeF + offsetPF],
                            data[j * vertSizeF + offsetPF + 1],
                            data[j * vertSizeF + offsetPF + 2]);
                    transform.transformPoint(vec, vec);
                    batchData[j * batchVertSizeF + vbOffset] =     vecData[0];
                    batchData[j * batchVertSizeF + vbOffset + 1] = vecData[1];
                    batchData[j * batchVertSizeF + vbOffset + 2] = vecData[2];
                    if (hasNormal) {
                        vec.set(data[j * vertSizeF + offsetNF],
                                data[j * vertSizeF + offsetNF + 1],
                                data[j * vertSizeF + offsetNF + 2]);
                        transform.transformVector(vec, vec);
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetNF] =    vecData[0];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetNF +1] = vecData[1];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetNF +2] = vecData[2];
                    }
                    if (hasUv) {
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetUF] =      data[j * vertSizeF + offsetUF];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetUF + 1] =      data[j * vertSizeF + offsetUF + 1];
                    }
                    if (hasUv2) {
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetU2F] =      data[j * vertSizeF + offsetU2F];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetU2F + 1] =      data[j * vertSizeF + offsetU2F + 1];
                    }
                    if (hasTangent) {
                        vec.set(data[j * vertSizeF + offsetTF],
                                data[j * vertSizeF + offsetTF + 1],
                                data[j * vertSizeF + offsetTF + 2]);
                        transform.transformVector(vec, vec);
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF] =    vecData[0];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF +1] = vecData[1];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF +2] = vecData[2];
                        batchData[j * batchVertSizeF + vbOffset + batchOffsetTF +3] = data[j * vertSizeF + offsetTF + 3];
                    }
                }
            }

            indexBase = mesh.primitive[0].base;
            numIndices = mesh.primitive[0].count;
            indexData = new Uint16Array(mesh.indexBuffer[0].storage);
            for(j=0; j<numIndices; j++) {
                batchIndexData[j + indexOffset] = indexData[indexBase + j] + verticesOffset;
            }
            indexOffset += numIndices;
            verticesOffset += numVerts;
            vbOffset = verticesOffset * batchVertSizeF;
        }

        // Create the vertex format
        var vertexFormatId = 0;
        if (hasNormal)  vertexFormatId |= 1 << 1;
        if (hasUv)      vertexFormatId |= 1 << 2;
        if (hasUv2)     vertexFormatId |= 1 << 3;
        if (hasTangent) vertexFormatId |= 1 << 4;
        if (dynamic)  vertexFormatId |= 1 << 5;
        var vertexFormat = this.vertexFormats[vertexFormatId];
        if (!vertexFormat) {
            var formatDesc = [];
            formatDesc.push({
                semantic: pc.SEMANTIC_POSITION,
                components: 3,
                type: pc.ELEMENTTYPE_FLOAT32,
                normalize: false
            });
            if (hasNormal) {
                formatDesc.push({
                    semantic: pc.SEMANTIC_NORMAL,
                    components: 3,
                    type: pc.ELEMENTTYPE_FLOAT32,
                    normalize: false
                });
            }
            if (hasUv) {
                formatDesc.push({
                    semantic: pc.SEMANTIC_TEXCOORD0,
                    components: 2,
                    type: pc.ELEMENTTYPE_FLOAT32,
                    normalize: false
                });
            }
            if (hasUv2) {
                formatDesc.push({
                    semantic: pc.SEMANTIC_TEXCOORD1,
                    components: 2,
                    type: pc.ELEMENTTYPE_FLOAT32,
                    normalize: false
                });
            }
            if (hasTangent) {
                formatDesc.push({
                    semantic: pc.SEMANTIC_TANGENT,
                    components: 4,
                    type: pc.ELEMENTTYPE_FLOAT32,
                    normalize: false
                });
            }
            if (dynamic) {
                formatDesc.push({
                    semantic: pc.SEMANTIC_BLENDINDICES,
                    components: 1,
                    type: pc.ELEMENTTYPE_FLOAT32,
                    normalize: false
                });
            }
            vertexFormat = this.vertexFormats[vertexFormatId] = new pc.VertexFormat(this.device, formatDesc);
        }

        // Upload data to GPU
        var vertexBuffer = new pc.VertexBuffer(this.device, vertexFormat, batchNumVerts, pc.BUFFER_STATIC, batchData.buffer);
        indexBuffer.unlock();

        // Create mesh
        mesh = new pc.Mesh();
        mesh.vertexBuffer = vertexBuffer;
        mesh.indexBuffer[0] = indexBuffer;
        mesh.primitive[0].type = batch.origMeshInstances[0].mesh.primitive[0].type;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = batchNumIndices;
        mesh.primitive[0].indexed = true;
        mesh.cull = false;

        if (dynamic) {
            // Patch the material
            material = material.clone();
            material.chunks.transformSkinnedVS = (batch.origMeshInstances[0]._shaderDefs & pc.SHADERDEF_SCREENSPACE) ? this.transformElementVS : this.transformVS;
            material.chunks.skinTexVS = this.skinTexVS;
            material.chunks.skinConstVS = this.skinConstVS;
            material.update();
        }

        // Create meshInstance
        var meshInstance = new pc.MeshInstance(this.rootNode, mesh, material);
        meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
        meshInstance.parameters = batch.origMeshInstances[0].parameters;
        meshInstance.isStatic = batch.origMeshInstances[0].isStatic;
        meshInstance._staticLightList = batch.origMeshInstances[0]._staticLightList;

        if (dynamic) {
            // Create skinInstance
            var nodes = [];
            for(i=0; i<batch.origMeshInstances.length; i++) {
                nodes.push(batch.origMeshInstances[i].node);
            }
            meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
        }

        meshInstance._updateAabb = false;
        batch.meshInstance = meshInstance;
        this.update(batch);

        var newModel = new pc.Model();

        newModel.meshInstances = [batch.meshInstance];
        newModel.castShadows = batch.origMeshInstances[0].castShadows;
        batch.model = newModel;

        // #ifdef PROFILER
        this._stats.createTime += pc.now() - time;
        // #endif

        return batch;
    };

    /**
     * @private
     * @function
     * @name pc.BatchManager#update
     * @description Updates bounding box for a batch. Called automatically.
     * @param {pc.Batch} batch A batch object
     */
    BatchManager.prototype.update = function(batch) {
        batch._aabb.copy(batch.origMeshInstances[0].aabb);
        for(var i=0; i<batch.origMeshInstances.length; i++) {
            if (i > 0) batch._aabb.add(batch.origMeshInstances[i].aabb); // this is the slowest part
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
    BatchManager.prototype.updateAll = function() {
        // TODO: only call when needed. Applies to skinning matrices as well

        // #ifdef PROFILER
        var time = pc.now();
        // #endif

        for(var i=0; i<this._batchList.length; i++) {
            if (!this._batchList[i].dynamic) continue;
            this.update(this._batchList[i]);
        }

        // #ifdef PROFILER
        this._stats.updateLastFrameTime = pc.now() - time;
        // #endif
    };

    /**
     * @function
     * @name pc.BatchManager#clone
     * @description Clones a batch. This method doesn't rebuild batch geometry, but only creates a new model and batch objects, linked to different source mesh instances.
     * @param {pc.Batch} batch A batch object
     * @param {Array} clonedMeshInstances New mesh instances
     * @returns {pc.Batch} New batch object
     */
    BatchManager.prototype.clone = function(batch, clonedMeshInstances) {
        var batch2 = new pc.Batch(clonedMeshInstances, batch.dynamic, batch.batchGroupId);
        this._batchList.push(batch2);

        var nodes = [];
        for(var i=0; i<clonedMeshInstances.length; i++) {
            nodes.push(clonedMeshInstances[i].node);
        }

        batch2.meshInstance = new pc.MeshInstance(batch.meshInstance.node, batch.meshInstance.mesh, batch.meshInstance.material);
        batch2.meshInstance._updateAabb = false;
        batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
        batch2.meshInstance.isStatic = clonedMeshInstances[0].isStatic;
        batch2.meshInstance._staticLightList = clonedMeshInstances[0]._staticLightList;

        if (batch.dynamic) {
        	batch2.meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
        }

        batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
        batch2.meshInstance._shader = batch.meshInstance._shader;

        var newModel = new pc.Model();

        newModel.meshInstances = [batch2.meshInstance];
        newModel.castShadows = batch.origMeshInstances[0].castShadows;
        batch2.model = newModel;

        return batch2;
    };

    /**
     * @function
     * @name pc.BatchManager#destroy
     * @description Decrements reference counter on a batch. If it's zero, the batch is removed from scene, and its geometry is deleted from memory.
     * @param {pc.Batch} batch A batch object
     */
    BatchManager.prototype.destroy = function(batch) {
        batch.refCounter--;
        if (batch.refCounter === 0) {
            this.scene.removeModel(batch.model);
            batch.model.destroy();
        }
    };

    /**
     * @function
     * @name pc.BatchManager#register
     * @description Registers entities as used inside the batch, and sets batch's reference counter to entity count.
     * If these entities are destroyed, {@link pc.BatchManager#destroy} will be called on the batch.
     * @param {pc.Batch} batch A batch object
     * @param {Array} entities An array of pc.Entity
     */
    BatchManager.prototype.register = function(batch, entities) {
        batch.refCounter = entities.length;
        var self = this;
        var callback = function() {
            self.destroy(batch);
        };
        for(var i=0; i<entities.length; i++) {
            entities[i].once('destroy', callback);
        }
    };

    return {
        Batch: Batch,
        BatchGroup: BatchGroup,
        BatchManager: BatchManager
    };
}());
