pc.extend(pc, function () {

    var Batch = function (meshInstances, isDynamic) {
        this.origMeshInstances = meshInstances;
        this._aabb = new pc.BoundingBox();
        this.meshInstance = null;
        this.model = null;
        this.isDynamic = isDynamic;
    };

    var BatchGroup = function (isDynamic, maxAabbSize) {
        this.isDynamic = isDynamic;
        this.maxAabbSize = maxAabbSize;
        this.name = "Group";
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
     * @name pc.Batching
     * @class Glues many mesh instances together
     */
    var Batching = function (device, root, scene) {
        this.device = device;
        this.rootNode = root;
        this.scene = scene;
        this._init = false;

        this.batchGroups = {};

        this._stats = {
            time: 0
        };
    };

    Batching.prototype._collectAndRemoveModels = function(node, groupMeshInstances) {
        if (!node.enabled) return;
        if (!node.model) return;
        if (node.model.batchGroup < 0) return;
        if (!node.model.model) return;
        if (!node.model.enabled) return;

        var arr = groupMeshInstances[node.model.batchGroup];
        if (!arr) arr = groupMeshInstances[node.model.batchGroup] = [];
        arr = arr.concat(node.model.meshInstances);

        this.scene.removeModel(node.model);

        for(var i = 0; i < node._children.length; i++) {
            this._collectAndRemoveModels(node._children[i], groupMeshInstances);
        }
    };

    Batching.prototype._registerEntities = function(batch, meshInstances) {
        var node;
        var ents = [];
        for(var i=0; i<meshInstances.length; i++) {
            node = meshInstances[i].node;
            while(node._app && node._parent) {
                node = node._parent;
            }
            if (!node._app) continue;
            // node is entity
            ents.push(node);
        }
        this.register(batch, ents);
    };

    Batching.prototype.generateBatchesForModels = function(nodes) {
        var i;
        var groupMeshInstances = {};

        if (!nodes) {
            // Full scene

            // delete old batches
            // TODO

            // collect
            this._collectAndRemoveModels(this.rootNode, groupMeshInstances);
        } else {
            // Selected entities

            // delete old batches
            // TODO

            // collect
            for(i=0; i<nodes.length; i++) {
                this._collectAndRemoveModels(nodes[i], groupMeshInstances);
            }
        }

        var group, lists, groupData, j, batch;
        for(var groupId in groupMeshInstances) {
            if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
            group = groupMeshInstances[groupId];

            groupData = this.batchGroups[groupId];
            if (!groupData) {
                // #ifdef DEBUG
                console.error("batch group " + groupId + " not found");
                // #endif
                continue;
            }

            lists = this.prepare(group, groupData.isDynamic, groupData.maxAabbSize);
            for(j=0; j<lists.length; j++) {
                batch = this.create(lists[i], groupData.isDynamic);
                this.scene.addModel(batch.model);
                this._registerEntities(batch, group);
            }
        }
    };

    /**
     * @function
     * @name pc.Batching#prepare
     * @description Takes a list of mesh instances to be batched and sorts them into lists one for each draw call.
     */
    Batching.prototype.prepare = function(meshInstances, isDynamic, maxAabbSize) {
        if (meshInstances.length === 0) return [];
        if (maxAabbSize === undefined) maxAabbSize = Number.POSITIVE_INFINITY;
        var halfMaxAabbSize = maxAabbSize * 0.5;
        var maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;
        
        var i;
        var material, layer, vertCount, params, params2, param, paramFailed, lightList;
        var aabb = new pc.BoundingBox();
        var testAabb = new pc.BoundingBox();
        
        var lists = [];
        var j = 0;
        var meshInstancesLeft = meshInstances;
        var meshInstancesLeft2;

        var k;
        
        while(meshInstancesLeft.length > 0) {
            lists[j] = [];
            meshInstancesLeft2 = [];
            material = meshInstancesLeft[0].material;
            layer = meshInstancesLeft[0].layer;
            params = meshInstancesLeft[0].parameters;
            lightList = meshInstancesLeft[0]._staticLightList;
            vertCount = meshInstancesLeft[0].mesh.vertexBuffer.getNumVertices();
            aabb.copy(meshInstancesLeft[0].aabb);
            
            for(i=0; i<meshInstancesLeft.length; i++) {

                if (i > 0) {
                    // Split by material
                    if (material !== meshInstancesLeft[i].material) {
                        meshInstancesLeft2.push(meshInstancesLeft[i]);
                        continue;
                    }
                    // Split by layer
                    if (layer !== meshInstancesLeft[i].layer) {
                        meshInstancesLeft2.push(meshInstancesLeft[i]);
                        continue;
                    }
                    // Split by static source
                    // 
                    // Split by vert count
                    if (vertCount + meshInstancesLeft[i].mesh.vertexBuffer.getNumVertices() > 0xFFFF) {
                        meshInstancesLeft2.push(meshInstancesLeft[i]);
                        continue;
                    }
                    // Split by AABB
                    testAabb.copy(aabb);
                    testAabb.add(meshInstancesLeft[i].aabb);
                    if (testAabb.halfExtents.x > halfMaxAabbSize || 
                        testAabb.halfExtents.y > halfMaxAabbSize || 
                        testAabb.halfExtents.z > halfMaxAabbSize) {
                        meshInstancesLeft2.push(meshInstancesLeft[i]);
                        continue;
                    }
                    // Split by parameters
                    params2 = meshInstancesLeft[i].parameters;
                    paramFailed = false;
                    for(param in params) { // compare A -> B
                        if (!params.hasOwnProperty(param)) continue;
                        if (params[param] !== params2[param]) {
                            paramFailed = true;
                            break;
                        }
                    }
                    if (!paramFailed) {
                        for(param in params2) { // compare B -> A
                            if (!params2.hasOwnProperty(param)) continue;
                            if (params2[param] !== params[param]) {
                                paramFailed = true;
                                break;
                            }
                        }
                    }
                    if (paramFailed) {
                        meshInstancesLeft2.push(meshInstancesLeft[i]);
                        continue;
                    }
                    // Split by static/non static
                    params2 = meshInstancesLeft[i]._staticLightList;
                    if ((lightList && !params2) || (!lightList && params2)) {
                        console.log("!");
                        meshInstancesLeft2.push(meshInstancesLeft[i]);
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
                            meshInstancesLeft2.push(meshInstancesLeft[i]);
                            continue;
                        }
                    }
                }

                aabb.add(meshInstancesLeft[i].aabb);
                vertCount += meshInstancesLeft[i].mesh.vertexBuffer.getNumVertices();
                lists[j].push(meshInstancesLeft[i]);
                
                // Split by instance number
                if (isDynamic && lists[j].length === maxInstanceCount) {
                    if (i === meshInstancesLeft.length) {
                        meshInstancesLeft2 = [];
                    } else {
                        meshInstancesLeft2 = meshInstancesLeft.slice(i + 1);
                    }
                    break;
                }
            }
            j++;
            meshInstancesLeft = meshInstancesLeft2;
        }
        
        return lists;
    };

    /**
     * @function
     * @name pc.Batching#create
     * @description Takes a mesh instance list that has been prepared by prepare(), and returns a pc.Batch object. This method assumes that all mesh instances provided can be rendered in a single draw call.
     */
    Batching.prototype.create = function(meshInstances, isDynamic) {

        if (!this._init) {
            var boneLimit = "#define BONE_LIMIT " + this.device.getBoneLimit() + "\n";
            this.transformVS = boneLimit + pc.shaderChunks.transformBatchSkinnedVS;
            this.skinTexVS = pc.shaderChunks.skinTexVS.replace("attribute vec4 vertex_boneIndices", "attribute float vertex_boneIndices");
            this.skinConstVS = pc.shaderChunks.skinConstVS.replace("attribute vec4 vertex_boneIndices", "attribute float vertex_boneIndices");
            this.vertexFormats = {};
            this._init = true;
        }

        var i, j;
        var batch = new pc.Batch(meshInstances, isDynamic);
                
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
                // #ifdef DEBUG
                if (material !== meshInstances[i].material) {
                    console.error("batching.create: multiple materials");
                    return;
                }
                // #endif
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
            console.error("batching.create: no position");
            // #endif
            return;
        }
        
        // Create buffers
        var entityIndexSizeF = isDynamic ? 1 : 0;
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
        if (!isDynamic) {
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
            if (isDynamic) {
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
        if (isDynamic)  vertexFormatId |= 1 << 5;
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
            if (isDynamic) {
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

        if (isDynamic) {
            // Patch the material
            material = material.clone();
            material.chunks.transformSkinnedVS = this.transformVS;
            material.chunks.skinTexVS = this.skinTexVS;
            material.chunks.skinConstVS = this.skinConstVS;
            material.update();
        }
        
        // Create node
        var meshInstance = new pc.MeshInstance(this.rootNode, mesh, material);
        meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
        meshInstance.parameters = batch.origMeshInstances[0].parameters;
        meshInstance.isStatic = batch.origMeshInstances[0].isStatic;
        meshInstance._staticLightList = batch.origMeshInstances[0]._staticLightList;

        if (isDynamic) {
            // Create skinInstance
            var nodes = [];
            for(i=0; i<batch.origMeshInstances.length; i++) {
                nodes.push(batch.origMeshInstances[i].node);
            }
            var skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
            meshInstance.skinInstance = skinInstance;
        }
        
        meshInstance._updateAabb = false;
        batch.meshInstance = meshInstance;
        this.update(batch);
        
        var newModel = new pc.Model();
        
        newModel.meshInstances = [batch.meshInstance];
        newModel.castShadows = batch.origMeshInstances[0].castShadows;
        batch.model = newModel;
        
        return batch;
    };

    // Update batch AABB
    Batching.prototype.update = function(batch) {    
        batch._aabb.copy(batch.origMeshInstances[0].aabb);
        for(var i=0; i<batch.origMeshInstances.length; i++) {
            if (i > 0) batch._aabb.add(batch.origMeshInstances[i].aabb);
        }
        batch.meshInstance.aabb = batch._aabb;
        batch._aabb._radiusVer = -1;
        batch.meshInstance._aabbVer = 0;
    };

    Batching.prototype.cloneBatch = function(batch, clonedMeshInstances) {
        var batch2 = new pc.Batch(clonedMeshInstances, batch.isDynamic);
        
        var nodes = [];
        for(var i=0; i<clonedMeshInstances.length; i++) {
            nodes.push(clonedMeshInstances[i].node);
        }
        
        batch2.meshInstance = new pc.MeshInstance(batch.meshInstance.node, batch.meshInstance.mesh, batch.meshInstance.material);
        batch2.meshInstance._updateAabb = false;
        batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
        batch2.meshInstance.isStatic = clonedMeshInstances[0].isStatic;
        batch2.meshInstance._staticLightList = clonedMeshInstances[0]._staticLightList;
        
        var skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
        batch2.meshInstance.skinInstance = skinInstance;
        
        batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
        batch2.meshInstance._shader = batch.meshInstance._shader;
        
        return batch2;
    };

    Batching.prototype.destroyBatch = function(batch) {
        batch.refCounter--;
        if (batch.refCounter === 0) {
            this.scene.removeModel(batch.model);
            batch.model.destroy();
        }
    };

    Batching.prototype.register = function(batch, entities) {
        batch.refCounter = entities.length;
        var self = this;
        var callback = function() {
            self.destroyBatch(batch);
        };
        for(var i=0; i<entities.length; i++) {
            entities[i].once('destroy', callback);
        }
    };

    return {
        Batch: Batch,
        SkinBatchInstance: SkinBatchInstance,
        Batching: Batching
    };
}());
