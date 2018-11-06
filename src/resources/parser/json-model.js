Object.assign(pc, function () {
    'use strict';

    var JSON_PRIMITIVE_TYPE = {
        "points": pc.PRIMITIVE_POINTS,
        "lines": pc.PRIMITIVE_LINES,
        "lineloop": pc.PRIMITIVE_LINELOOP,
        "linestrip": pc.PRIMITIVE_LINESTRIP,
        "triangles": pc.PRIMITIVE_TRIANGLES,
        "trianglestrip": pc.PRIMITIVE_TRISTRIP,
        "trianglefan": pc.PRIMITIVE_TRIFAN
    };

    var JSON_VERTEX_ELEMENT_TYPE = {
        "int8": pc.TYPE_INT8,
        "uint8": pc.TYPE_UINT8,
        "int16": pc.TYPE_INT16,
        "uint16": pc.TYPE_UINT16,
        "int32": pc.TYPE_INT32,
        "uint32": pc.TYPE_UINT32,
        "float32": pc.TYPE_FLOAT32
    };

    // Take PlayCanvas JSON model data and create pc.Model
    var JsonModelParser = function (device) {
        this._device = device;
        this._defaultMaterial = pc.getDefaultMaterial();
    };

    Object.assign(JsonModelParser.prototype, {
        parse: function (data) {
            var modelData = data.model;
            if (!modelData) {
                return null;
            }

            if (modelData.version <= 1) {
                // #ifdef DEBUG
                console.warn("JsonModelParser#parse: Trying to parse unsupported model format.");
                // #endif
                return null;
            }

            // NODE HIERARCHY
            var nodes = this._parseNodes(data);

            // SKINS
            var skins = this._parseSkins(data, nodes);

            // MORPHS
            var morphs = this._parseMorphs(data, nodes);

            // VERTEX BUFFERS
            var vertexBuffers = this._parseVertexBuffers(data);

            // INDEX BUFFER
            var indices = this._parseIndexBuffers(data, vertexBuffers);

            // MESHES
            var meshes = this._parseMeshes(data, skins.skins, morphs.morphs, vertexBuffers, indices.buffer, indices.data);

            this._initMorphs(data, morphs.morphs, vertexBuffers, meshes);

            // MESH INSTANCES
            var meshInstances = this._parseMeshInstances(data, nodes, meshes, skins.skins, skins.instances, morphs.morphs, morphs.instances);

            var model = new pc.Model();
            model.graph = nodes[0];
            model.meshInstances = meshInstances;
            model.skinInstances = skins.instances;
            model.morphInstances = morphs.instances;
            model.getGraph().syncHierarchy();

            return model;
        },

        _parseNodes: function (data) {
            var modelData = data.model;
            var nodes = [];
            var i;

            for (i = 0; i < modelData.nodes.length; i++) {
                var nodeData = modelData.nodes[i];

                var node = new pc.GraphNode();
                node.setName(nodeData.name);
                node.setLocalPosition(nodeData.position[0], nodeData.position[1], nodeData.position[2]);
                node.setLocalEulerAngles(nodeData.rotation[0], nodeData.rotation[1], nodeData.rotation[2]);
                node.setLocalScale(nodeData.scale[0], nodeData.scale[1], nodeData.scale[2]);
                node.scaleCompensation = !!nodeData.scaleCompensation;

                nodes.push(node);
            }

            for (i = 1; i < modelData.parents.length; i++) {
                nodes[modelData.parents[i]].addChild(nodes[i]);
            }

            return nodes;
        },

        _parseSkins: function (data, nodes) {
            var modelData = data.model;
            var skins = [];
            var skinInstances = [];
            var i, j;

            if (!this._device.supportsBoneTextures && modelData.skins.length > 0) {
                var boneLimit = this._device.getBoneLimit();
                pc.partitionSkin(modelData, null, boneLimit);
            }

            for (i = 0; i < modelData.skins.length; i++) {
                var skinData = modelData.skins[i];

                var inverseBindMatrices = [];
                for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
                    var ibm = skinData.inverseBindMatrices[j];
                    inverseBindMatrices[j] = new pc.Mat4().set(ibm);
                }

                var skin = new pc.Skin(this._device, inverseBindMatrices, skinData.boneNames);
                skins.push(skin);

                var skinInstance = new pc.SkinInstance(skin);
                // Resolve bone IDs to actual graph nodes
                var bones = [];
                for (j = 0; j < skin.boneNames.length; j++) {
                    var boneName = skin.boneNames[j];
                    var bone = nodes[0].findByName(boneName);
                    bones.push(bone);
                }
                skinInstance.bones = bones;
                skinInstances.push(skinInstance);
            }

            return {
                skins: skins,
                instances: skinInstances
            };
        },

        _parseMorphs: function (data, nodes) {
            var modelData = data.model;
            var morphs = [];
            var morphInstances = [];
            var i, j;

            var targets, morphTarget, morphTargetArray;

            if (modelData.morphs) {
                for (i = 0; i < modelData.morphs.length; i++) {
                    targets = modelData.morphs[i].targets;
                    morphTargetArray = [];

                    for (j = 0; j < targets.length; j++) {
                        var targetAabb = targets[j].aabb;

                        var min = targetAabb.min;
                        var max = targetAabb.max;
                        var aabb = new pc.BoundingBox(
                            new pc.Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                            new pc.Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
                        );

                        morphTarget = new pc.MorphTarget({ indices: targets[j].indices,
                            deltaPositions: targets[j].deltaPositions,
                            deltaNormals: targets[j].deltaNormals,
                            name: targets[j].name,
                            aabb: aabb });

                        morphTargetArray.push(morphTarget);
                    }

                    var morph = new pc.Morph(morphTargetArray);
                    morphs.push(morph);

                    var morphInstance = new pc.MorphInstance(morph);
                    morphInstances.push(morphInstance);
                }
            }

            return {
                morphs: morphs,
                instances: morphInstances
            };
        },

        // optimized pc.calculateTangents for many calls with different index buffer but same vertex buffer
        _calculateTangentsMorphTarget: function (positions, normals, uvs, indices,
            tan1, tan2, mtIndices, tangents) {
            var sdirx, sdiry, sdirz;
            var tdirx, tdiry, tdirz;
            var v1x, v1y, v1z;
            var v2x, v2y, v2z;
            var v3x, v3y, v3z;
            var w1x, w1y;
            var w2x, w2y;
            var w3x, w3y;
            var t1x, t1y, t1z;
            var t2x, t2y, t2z;
            var nx, ny, nz;

            var triangleCount;
            var i1, i2, i3;
            var x1, x2, y1, y2, z1, z2, s1, s2, t1, t2, r;
            var i, j; // Loop counter
            var area, ndott, mtIndexCount, len;

            triangleCount = indices.length / 3;

            area = 0.0;

            for (i = 0; i < triangleCount; i++) {
                i1 = indices[i * 3];
                i2 = indices[i * 3 + 1];
                i3 = indices[i * 3 + 2];

                v1x = positions[i1 * 3];
                v1y = positions[i1 * 3 + 1];
                v1z = positions[i1 * 3 + 2];

                v2x = positions[i2 * 3];
                v2y = positions[i2 * 3 + 1];
                v2z = positions[i2 * 3 + 2];

                v3x = positions[i3 * 3];
                v3y = positions[i3 * 3 + 1];
                v3z = positions[i3 * 3 + 2];

                w1x = uvs[i1 * 2];
                w1y = uvs[i1 * 2 + 1];

                w2x = uvs[i2 * 2];
                w2y = uvs[i2 * 2 + 1];

                w3x = uvs[i3 * 2];
                w3y = uvs[i3 * 2 + 1];

                x1 = v2x - v1x;
                x2 = v3x - v1x;
                y1 = v2y - v1y;
                y2 = v3y - v1y;
                z1 = v2z - v1z;
                z2 = v3z - v1z;

                s1 = w2x - w1x;
                s2 = w3x - w1x;
                t1 = w2y - w1y;
                t2 = w3y - w1y;

                area = s1 * t2 - s2 * t1;

                // area can 0.0 for degenerate triangles or bad uv coordinates
                if (area == 0.0) {
                    // fallback to default values
                    sdirx = 0;
                    sdiry = 1;
                    sdirz = 0;

                    tdirx = 1;
                    tdiry = 0;
                    tdirz = 0;
                } else {
                    r = 1.0 / area;
                    sdirx = (t2 * x1 - t1 * x2) * r;
                    sdiry = (t2 * y1 - t1 * y2) * r;
                    sdirz = (t2 * z1 - t1 * z2) * r;

                    tdirx = (s1 * x2 - s2 * x1) * r;
                    tdiry = (s1 * y2 - s2 * y1) * r;
                    tdirz = (s1 * z2 - s2 * z1) * r;
                }

                tan1[i1 * 3 + 0] += sdirx;
                tan1[i1 * 3 + 1] += sdiry;
                tan1[i1 * 3 + 2] += sdirz;
                tan1[i2 * 3 + 0] += sdirx;
                tan1[i2 * 3 + 1] += sdiry;
                tan1[i2 * 3 + 2] += sdirz;
                tan1[i3 * 3 + 0] += sdirx;
                tan1[i3 * 3 + 1] += sdiry;
                tan1[i3 * 3 + 2] += sdirz;

                tan2[i1 * 3 + 0] += tdirx;
                tan2[i1 * 3 + 1] += tdiry;
                tan2[i1 * 3 + 2] += tdirz;
                tan2[i2 * 3 + 0] += tdirx;
                tan2[i2 * 3 + 1] += tdiry;
                tan2[i2 * 3 + 2] += tdirz;
                tan2[i3 * 3 + 0] += tdirx;
                tan2[i3 * 3 + 1] += tdiry;
                tan2[i3 * 3 + 2] += tdirz;
            }

            mtIndexCount = mtIndices.length;
            for (j = 0; j < mtIndexCount; j++) {
                i = mtIndices[j];

                nx = normals[i * 3];
                ny = normals[i * 3 + 1];
                nz = normals[i * 3 + 2];

                t1x = tan1[i * 3];
                t1y = tan1[i * 3 + 1];
                t1z = tan1[i * 3 + 2];

                t2x = tan2[i * 3];
                t2y = tan2[i * 3 + 1];
                t2z = tan2[i * 3 + 2];

                // Gram-Schmidt orthogonalize
                ndott = nx * t1x + ny * t1y + nz * t1z;
                v1x = nx * ndott;
                v1y = ny * ndott;
                v1z = nz * ndott;

                // Calculate handedness
                v2x = ny * t1z - t1y * nz;
                v2y = nz * t1x - t1z * nx;
                v2z = nx * t1y - t1x * ny;

                t1x -= v1x;
                t1y -= v1y;
                t1z -= v1z;
                len = 1.0 / Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z);
                t1x *= len;
                t1y *= len;
                t1z *= len;

                tangents[i * 4]     = t1x;
                tangents[i * 4 + 1] = t1y;
                tangents[i * 4 + 2] = t1z;

                // Calculate handedness
                tangents[i * 4 + 3] = ((v2x * t2x + v2y * t2y + v2z * t2z) < 0.0) ? -1.0 : 1.0;
            }

            return tangents;
        },

        _initMorphs: function (data, morphs, vertexBuffers, meshes) {
            var modelData = data.model;

            var i, j;
            var target, k, l, index;
            var triA, triB, triC;
            var flagged;
            var basePos;
            var baseNorm;
            var baseUv;
            var numVerts;
            var numIndices;
            var tpos, tnorm;
            var vertexData;
            var mtTriIndices = [];

            var processed = [];
            var vid;

            for (i = 0; i < meshes.length; i++) {
                vid = modelData.meshes[i].vertices;
                if (processed[vid]) continue;
                vertexData = modelData.vertices[vid];
                if (!vertexData.tangent) continue;
                var tangents = new Float32Array(vertexData.tangent.data);
                processed[vid] = true;

                if (vertexData.position && vertexData.normal && vertexData.texCoord0) {
                    // Calculate tangents for morph targets
                    var indices = [];
                    for (j = 0; j < modelData.meshes.length; j++) {
                        if (modelData.meshes[j].vertices === vid) {
                            indices = indices.concat(modelData.meshes[j].indices);
                        }
                    }

                    basePos = vertexData.position.data;
                    baseNorm = vertexData.normal.data;
                    baseUv = vertexData.texCoord0.data;
                    numVerts = basePos.length / 3;
                    numIndices = indices.length;
                    var targetTangents = new Float32Array(numVerts * 4);
                    var tan1 = new Float32Array(numVerts * 3);
                    var tan2 = new Float32Array(numVerts * 3);
                    tpos = new Float32Array(numVerts * 3);
                    tpos.set(basePos);
                    tnorm = new Float32Array(numVerts * 3);
                    tnorm.set(baseNorm);

                    for (j = 0; j < morphs.length; j++) {
                        if (modelData.meshes[i].morph !== j) continue;

                        for (k = 0; k < morphs[j]._targets.length; k++) {
                            target = morphs[j]._targets[k];

                            var mtIndices = target.indices;
                            var numMtIndices = mtIndices.length;
                            if (numMtIndices === 0) continue;

                            target.deltaTangents = new Float32Array(numMtIndices * 4);

                            // Flag vertices affected by this morph target
                            if (!flagged || flagged.length < numVerts) {
                                flagged = new Uint8Array(numVerts);
                            } else {
                                for (l = 0; l < numVerts; l++) {
                                    flagged[l] = 0;
                                }
                            }

                            for (l = 0; l < numMtIndices; l++) {
                                index = mtIndices[l];
                                flagged[index] = 1;
                            }

                            // Collect affected triangles
                            var numMtTriIndices = 0;
                            for (l = 0; l < numIndices; l += 3) {
                                triA = indices[l];
                                triB = indices[l + 1];
                                triC = indices[l + 2];
                                if (flagged[triA] || flagged[triB] || flagged[triC]) {
                                    mtTriIndices[numMtTriIndices] = triA;
                                    mtTriIndices[numMtTriIndices + 1] = triB;
                                    mtTriIndices[numMtTriIndices + 2] = triC;
                                    numMtTriIndices += 3;
                                }
                            }
                            mtTriIndices.length = numMtTriIndices;

                            // Generate morphed position/normal
                            var deltaPos = target.deltaPositions;
                            var deltaNorm = target.deltaNormals;
                            for (l = 0; l < numMtIndices; l++) {
                                index = mtIndices[l];
                                tpos[index * 3] += deltaPos[l * 3];
                                tpos[index * 3 + 1] += deltaPos[l * 3 + 1];
                                tpos[index * 3 + 2] += deltaPos[l * 3 + 2];

                                // the result should be already almost normalized, so no additional normalize
                                tnorm[index * 3] += deltaNorm[l * 3];
                                tnorm[index * 3 + 1] += deltaNorm[l * 3 + 1];
                                tnorm[index * 3 + 2] += deltaNorm[l * 3 + 2];
                            }

                            // Generate tangents
                            this._calculateTangentsMorphTarget(tpos,
                                                               tnorm,
                                                               baseUv,
                                                               mtTriIndices,
                                                               tan1, tan2, mtIndices, targetTangents);

                            // Generate tangent deltas
                            var deltaTangents = target.deltaTangents;
                            for (l = 0; l < numMtIndices; l++) {
                                index = mtIndices[l];
                                deltaTangents[l * 4] = targetTangents[l * 4] - tangents[index * 4];
                                deltaTangents[l * 4 + 1] = targetTangents[l * 4 + 1] - tangents[index * 4 + 1];
                                deltaTangents[l * 4 + 2] = targetTangents[l * 4 + 2] - tangents[index * 4 + 2];
                                deltaTangents[l * 4 + 3] = targetTangents[l * 4 + 3] - tangents[index * 4 + 3];
                            }

                            // If it's not the final morph target, do some clean up before the next one
                            if (k === morphs[j]._targets.length - 1) continue;
                            for (l = 0; l < numIndices; l += 3) {
                                triA = indices[l];
                                triB = indices[l + 1];
                                triC = indices[l + 2];

                                tan1[triA * 3 + 0] = 0;
                                tan1[triA * 3 + 1] = 0;
                                tan1[triA * 3 + 2] = 0;
                                tan1[triB * 3 + 0] = 0;
                                tan1[triB * 3 + 1] = 0;
                                tan1[triB * 3 + 2] = 0;
                                tan1[triC * 3 + 0] = 0;
                                tan1[triC * 3 + 1] = 0;
                                tan1[triC * 3 + 2] = 0;

                                tan2[triA * 3 + 0] = 0;
                                tan2[triA * 3 + 1] = 0;
                                tan2[triA * 3 + 2] = 0;
                                tan2[triB * 3 + 0] = 0;
                                tan2[triB * 3 + 1] = 0;
                                tan2[triB * 3 + 2] = 0;
                                tan2[triC * 3 + 0] = 0;
                                tan2[triC * 3 + 1] = 0;
                                tan2[triC * 3 + 2] = 0;
                            }
                            for (l = 0; l < numMtIndices; l++) {
                                index = target.indices[l];
                                tpos[index * 3] = basePos[index * 3];
                                tpos[index * 3 + 1] = basePos[index * 3 + 1];
                                tpos[index * 3 + 2] = basePos[index * 3 + 2];

                                tnorm[index * 3] = baseNorm[index * 3];
                                tnorm[index * 3 + 1] = baseNorm[index * 3 + 1];
                                tnorm[index * 3 + 2] = baseNorm[index * 3 + 2];
                            }
                        }
                    }
                }
            }
        },

        _parseVertexBuffers: function (data) {
            var modelData = data.model;
            var vertexBuffers = [];
            var attribute, attributeName;
            var attributeMap = {
                position: pc.SEMANTIC_POSITION,
                normal: pc.SEMANTIC_NORMAL,
                tangent: pc.SEMANTIC_TANGENT,
                blendWeight: pc.SEMANTIC_BLENDWEIGHT,
                blendIndices: pc.SEMANTIC_BLENDINDICES,
                color: pc.SEMANTIC_COLOR,
                texCoord0: pc.SEMANTIC_TEXCOORD0,
                texCoord1: pc.SEMANTIC_TEXCOORD1,
                texCoord2: pc.SEMANTIC_TEXCOORD2,
                texCoord3: pc.SEMANTIC_TEXCOORD3,
                texCoord4: pc.SEMANTIC_TEXCOORD4,
                texCoord5: pc.SEMANTIC_TEXCOORD5,
                texCoord6: pc.SEMANTIC_TEXCOORD6,
                texCoord7: pc.SEMANTIC_TEXCOORD7
            };

            var i, j;
            for (i = 0; i < modelData.vertices.length; i++) {
                var vertexData = modelData.vertices[i];

                var formatDesc = [];
                for (attributeName in vertexData) {
                    attribute = vertexData[attributeName];

                    formatDesc.push({
                        semantic: attributeMap[attributeName],
                        components: attribute.components,
                        type: JSON_VERTEX_ELEMENT_TYPE[attribute.type],
                        normalize: (attributeMap[attributeName] === pc.SEMANTIC_COLOR)
                    });
                }
                var vertexFormat = new pc.VertexFormat(this._device, formatDesc);

                // Create the vertex buffer
                var numVertices = vertexData.position.data.length / vertexData.position.components;
                var vertexBuffer = new pc.VertexBuffer(this._device, vertexFormat, numVertices);

                var iterator = new pc.VertexIterator(vertexBuffer);
                for (j = 0; j < numVertices; j++) {
                    for (attributeName in vertexData) {
                        attribute = vertexData[attributeName];

                        switch (attribute.components) {
                            case 1:
                                iterator.element[attributeMap[attributeName]].set(attribute.data[j]);
                                break;
                            case 2:
                                iterator.element[attributeMap[attributeName]].set(attribute.data[j * 2], attribute.data[j * 2 + 1]);
                                break;
                            case 3:
                                iterator.element[attributeMap[attributeName]].set(attribute.data[j * 3], attribute.data[j * 3 + 1], attribute.data[j * 3 + 2]);
                                break;
                            case 4:
                                iterator.element[attributeMap[attributeName]].set(attribute.data[j * 4], attribute.data[j * 4 + 1], attribute.data[j * 4 + 2], attribute.data[j * 4 + 3]);
                                break;
                        }
                    }
                    iterator.next();
                }
                iterator.end();

                vertexBuffers.push(vertexBuffer);
            }

            return vertexBuffers;
        },

        _parseIndexBuffers: function (data, vertexBuffers) {
            var modelData = data.model;
            var indexBuffer = null;
            var indexData = null;
            var i;

            // Count the number of indices in the model
            var numIndices = 0;
            for (i = 0; i < modelData.meshes.length; i++) {
                var meshData = modelData.meshes[i];
                if (meshData.indices !== undefined) {
                    numIndices += meshData.indices.length;
                }
            }

            // Create an index buffer big enough to store all indices in the model
            var maxVerts = 0;
            for (i = 0; i < vertexBuffers.length; i++) {
                maxVerts = Math.max(maxVerts, vertexBuffers[i].numVertices);
            }
            if (numIndices > 0) {
                if (maxVerts > 0xFFFF && this._device.extUintElement) {
                    indexBuffer = new pc.IndexBuffer(this._device, pc.INDEXFORMAT_UINT32, numIndices);
                    indexData = new Uint32Array(indexBuffer.lock());
                } else {
                    indexBuffer = new pc.IndexBuffer(this._device, pc.INDEXFORMAT_UINT16, numIndices);
                    indexData = new Uint16Array(indexBuffer.lock());
                }
            }

            return {
                buffer: indexBuffer,
                data: indexData
            };
        },

        _parseMeshes: function (data, skins, morphs, vertexBuffers, indexBuffer, indexData) {
            var modelData = data.model;

            var meshes = [];
            var indexBase = 0;
            var i;

            for (i = 0; i < modelData.meshes.length; i++) {
                var meshData = modelData.meshes[i];

                var meshAabb = meshData.aabb;
                var min = meshAabb.min;
                var max = meshAabb.max;
                var aabb = new pc.BoundingBox(
                    new pc.Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                    new pc.Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
                );

                var indexed = (meshData.indices !== undefined);
                var mesh = new pc.Mesh();
                mesh.vertexBuffer = vertexBuffers[meshData.vertices];
                mesh.indexBuffer[0] = indexed ? indexBuffer : null;
                mesh.primitive[0].type = JSON_PRIMITIVE_TYPE[meshData.type];
                mesh.primitive[0].base = indexed ? (meshData.base + indexBase) : meshData.base;
                mesh.primitive[0].count = meshData.count;
                mesh.primitive[0].indexed = indexed;
                mesh.skin = (meshData.skin !== undefined) ? skins[meshData.skin] : null;
                mesh.morph = (meshData.morph !== undefined) ? morphs[meshData.morph] : null;
                mesh.aabb = aabb;

                if (indexed) {
                    // Create the index buffer
                    indexData.set(meshData.indices, indexBase);
                    indexBase += meshData.indices.length;
                }

                meshes.push(mesh);
            }

            if (indexBuffer !== null) {
                indexBuffer.unlock();
            }

            return meshes;
        },

        _parseMeshInstances: function (data, nodes, meshes, skins, skinInstances, morphs, morphInstances) {
            var modelData = data.model;
            var meshInstances = [];
            var i;

            for (i = 0; i < modelData.meshInstances.length; i++) {
                var meshInstanceData = modelData.meshInstances[i];

                var node = nodes[meshInstanceData.node];
                var mesh = meshes[meshInstanceData.mesh];

                var meshInstance = new pc.MeshInstance(node, mesh, this._defaultMaterial);

                if (mesh.skin) {
                    var skinIndex = skins.indexOf(mesh.skin);
                    // #ifdef DEBUG
                    if (skinIndex === -1) {
                        throw new Error('Mesh\'s skin does not appear in skin array.');
                    }
                    // #endif
                    meshInstance.skinInstance = skinInstances[skinIndex];
                }

                if (mesh.morph) {
                    var morphIndex = morphs.indexOf(mesh.morph);
                    // #ifdef DEBUG
                    if (morphIndex === -1) {
                        throw new Error('Mesh\'s morph does not appear in morph array.');
                    }
                    // #endif
                    meshInstance.morphInstance = morphInstances[morphIndex];
                }

                meshInstances.push(meshInstance);
            }

            return meshInstances;
        }
    });

    return {
        JsonModelParser: JsonModelParser
    };
}());
