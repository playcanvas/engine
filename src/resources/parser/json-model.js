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

            ////////////////////
            // VERTEX BUFFERS //
            ////////////////////
            var vertexBuffers = this._parseVertexBuffers(data);

            //////////////////
            // INDEX BUFFER //
            //////////////////
            var indices = this._parseIndexBuffers(data, vertexBuffers);

            ////////////
            // MESHES //
            ////////////
            var meshes = this._parseMeshes(data, skins.skins, vertexBuffers, indices.buffer, indices.data);

            ////////////////////
            // MESH INSTANCES //
            ////////////////////
            var meshInstances = this._parseMeshInstances(data, nodes, meshes, skins.skins, skins.instances);

            var model = new pc.Model();
            model.graph = nodes[0];
            model.meshInstances = meshInstances;
            model.skinInstances = skins.instances;
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

                // Check to see if we need to generate tangents
                if (vertexData.position && vertexData.normal && vertexData.texCoord0) {
                    var indices = [];
                    for (j = 0; j < modelData.meshes.length; j++) {
                        if (modelData.meshes[j].vertices === i) {
                            indices = indices.concat(modelData.meshes[j].indices);
                        }
                    }
                    var tangents = pc.calculateTangents(vertexData.position.data, vertexData.normal.data, vertexData.texCoord0.data, indices);
                    vertexData.tangent = { type: "float32", components: 4, data: tangents };
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

        _parseMeshes: function (data, skins, vertexBuffers, indexBuffer, indexData) {
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

        _parseMeshInstances: function (data, nodes, meshes, skins, skinInstances) {
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
                    if (skinIndex === -1) {
                        throw new Error('Mesh\'s skin does not appear in skin array.');
                    }
                    meshInstance.skinInstance = skinInstances[skinIndex];
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
