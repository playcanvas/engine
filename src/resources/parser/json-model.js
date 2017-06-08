pc.extend(pc, function () {
    'use strict';

    var JSON_PRIMITIVE_TYPE = {
        "points":        pc.PRIMITIVE_POINTS,
        "lines":         pc.PRIMITIVE_LINES,
        "lineloop":      pc.PRIMITIVE_LINELOOP,
        "linestrip":     pc.PRIMITIVE_LINESTRIP,
        "triangles":     pc.PRIMITIVE_TRIANGLES,
        "trianglestrip": pc.PRIMITIVE_TRISTRIP,
        "trianglefan":   pc.PRIMITIVE_TRIFAN
    };

    var JSON_VERTEX_ELEMENT_TYPE = {
        "int8":    pc.ELEMENTTYPE_INT8,
        "uint8":   pc.ELEMENTTYPE_UINT8,
        "int16":   pc.ELEMENTTYPE_INT16,
        "uint16":  pc.ELEMENTTYPE_UINT16,
        "int32":   pc.ELEMENTTYPE_INT32,
        "uint32":  pc.ELEMENTTYPE_UINT32,
        "float32": pc.ELEMENTTYPE_FLOAT32
    };

    // Take PlayCanvas JSON model data and create pc.Model
    var JsonModelParser = function (device) {
        this._device = device;
    };

    JsonModelParser.prototype = {
        parse: function (data) {
            var modelData = data.model;

            ////////////////////
            // NODE HIERARCHY //
            ////////////////////
            var nodes = this._parseNodes(data);

            ///////////
            // SKINS //
            ///////////
            var skins = this._parseSkins(data, nodes);

            ///////////
            // MORPHS //
            ///////////
            var morphs = this._parseMorphs(data, nodes);

            ////////////////////
            // VERTEX BUFFERS //
            ////////////////////
            var vertexBuffers = this._parseVertexBuffers(data, morphs.morphs);

            //////////////////
            // INDEX BUFFER //
            //////////////////
            var indices = this._parseIndexBuffers(data, vertexBuffers);

            ////////////
            // MESHES //
            ////////////
            var meshes = this._parseMeshes(data, skins.skins, morphs.morphs, vertexBuffers, indices.buffer, indices.data);

            ////////////////////
            // MESH INSTANCES //
            ////////////////////
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
                node.scaleCompensation = nodeData.scaleCompensation;

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
                    inverseBindMatrices[j] = new pc.Mat4(ibm[0], ibm[1], ibm[2], ibm[3],
                                                         ibm[4], ibm[5], ibm[6], ibm[7],
                                                         ibm[8], ibm[9], ibm[10], ibm[11],
                                                         ibm[12], ibm[13], ibm[14], ibm[15]);
                }

                var skin = new pc.Skin(this._device, inverseBindMatrices, skinData.boneNames);
                skins.push(skin);

                var skinInstance = new pc.SkinInstance(skin, nodes[0]);
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
            var i, j, k;

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

                        morphTarget = new pc.MorphTarget({indices: targets[j].indices,
                                                          deltaPositions: targets[j].deltaPositions,
                                                          deltaNormals: targets[j].deltaNormals,
                                                          name: targets[j].name,
                                                          aabb: aabb});
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

        _parseVertexBuffers: function (data, morphs) {
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
            var target, k, l, index;

            for (i = 0; i < modelData.vertices.length; i++) {
                var vertexData = modelData.vertices[i];

                // Check to see if we need to generate tangents
                if (vertexData.position && vertexData.normal && vertexData.texCoord0) {
                    var indices = [];
                    for (j = 0; j < modelData.meshes.length; j++) {
                        if (modelData.meshes[j].vertices === i) {
                            indices = indices.concat(modelData.meshes[j].indices);
                        }
                    }
                    // Calculate main tangents
                    var tangents = pc.calculateTangents(vertexData.position.data, vertexData.normal.data, vertexData.texCoord0.data, indices);
                    vertexData.tangent = { type: "float32", components: 4, data: tangents };

                    // Calculate tangents for morph targets
                    for(j=0; j<morphs.length; j++) {
                        for(k=0; k<morphs[j]._targets.length; k++) {
                            target = morphs[j]._targets[k];
                            var tpos = new Float32Array(vertexData.position.data.length);
                            tpos.set(vertexData.position.data);
                            var tnorm = new Float32Array(vertexData.position.data.length);
                            tnorm.set(vertexData.normal.data);
                            target.deltaTangents = new Float32Array(target.indices.length * 4);
                            for(l=0; l<target.indices.length; l++) {
                                index = target.indices[l];
                                tpos[index*3] = vertexData.position.data[index*3] + target.deltaPositions[l*3];
                                tpos[index*3+1] = vertexData.position.data[index*3+1] + target.deltaPositions[l*3+1];
                                tpos[index*3+2] = vertexData.position.data[index*3+2] + target.deltaPositions[l*3+2];

                                tnorm[index*3] = vertexData.normal.data[index*3] + target.deltaNormals[l*3];
                                tnorm[index*3+1] = vertexData.normal.data[index*3+1] + target.deltaNormals[l*3+1];
                                tnorm[index*3+2] = vertexData.normal.data[index*3+2] + target.deltaNormals[l*3+2];
                            }
                            var targetTangents = pc.calculateTangents(tpos, tnorm, vertexData.texCoord0.data, indices);
                            for(l=0; l<target.indices.length; l++) {
                                index = target.indices[l];
                                target.deltaTangents[l*4] = targetTangents[index*4] - tangents[index*4];
                                target.deltaTangents[l*4+1] = targetTangents[index*4+1] - tangents[index*4+1];
                                target.deltaTangents[l*4+2] = targetTangents[index*4+2] - tangents[index*4+2];
                                target.deltaTangents[l*4+3] = targetTangents[index*4+3] - tangents[index*4+3];

                            }
                        }
                    }
                }

                var formatDesc = [];
                for(attributeName in vertexData) {
                    attribute = vertexData[attributeName];

                    var attribType = attribute.type;
                    if (!this._device.supportsUnsignedByte) {
                        if (attribType === "uint8") {
                            attribType = "float32";
                        }
                        if (attribType === "int8") {
                            attribType = "float32";
                        }
                    }

                    formatDesc.push({
                        semantic: attributeMap[attributeName],
                        components: attribute.components,
                        type: JSON_VERTEX_ELEMENT_TYPE[attribType],
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

                var meshInstance = new pc.MeshInstance(node, mesh, pc.ModelHandler.DEFAULT_MATERIAL);

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
    };

    return {
        JsonModelParser: JsonModelParser
    };
}());
