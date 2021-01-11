import { Mat4 } from '../../math/mat4.js';
import { Vec3 } from '../../math/vec3.js';

import { BoundingBox } from '../../shape/bounding-box.js';

import {
    INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINES, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1,
    SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from '../../graphics/graphics.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';
import { VertexIterator } from '../../graphics/vertex-iterator.js';

import { partitionSkin } from '../../scene/skin-partition.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Model } from '../../scene/model.js';
import { Morph } from '../../scene/morph.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { Skin } from '../../scene/skin.js';
import { SkinInstance } from '../../scene/skin-instance.js';

import { Material } from '../../scene/materials/material.js';

var JSON_PRIMITIVE_TYPE = {
    "points": PRIMITIVE_POINTS,
    "lines": PRIMITIVE_LINES,
    "lineloop": PRIMITIVE_LINELOOP,
    "linestrip": PRIMITIVE_LINESTRIP,
    "triangles": PRIMITIVE_TRIANGLES,
    "trianglestrip": PRIMITIVE_TRISTRIP,
    "trianglefan": PRIMITIVE_TRIFAN
};

var JSON_VERTEX_ELEMENT_TYPE = {
    "int8": TYPE_INT8,
    "uint8": TYPE_UINT8,
    "int16": TYPE_INT16,
    "uint16": TYPE_UINT16,
    "int32": TYPE_INT32,
    "uint32": TYPE_UINT32,
    "float32": TYPE_FLOAT32
};

// Take PlayCanvas JSON model data and create pc.Model
class JsonModelParser {
    constructor(device) {
        this._device = device;
    }

    parse(data) {
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

        // VERTEX BUFFERS
        var vertexBuffers = this._parseVertexBuffers(data);

        // INDEX BUFFER
        var indices = this._parseIndexBuffers(data, vertexBuffers);

        // MORPHS
        var morphs = this._parseMorphs(data, nodes, vertexBuffers);

        // MESHES
        var meshes = this._parseMeshes(data, skins.skins, morphs.morphs, vertexBuffers, indices.buffer, indices.data);

        // MESH INSTANCES
        var meshInstances = this._parseMeshInstances(data, nodes, meshes, skins.skins, skins.instances, morphs.morphs, morphs.instances);

        var model = new Model();
        model.graph = nodes[0];
        model.meshInstances = meshInstances;
        model.skinInstances = skins.instances;
        model.morphInstances = morphs.instances;
        model.getGraph().syncHierarchy();

        return model;
    }

    _parseNodes(data) {
        var modelData = data.model;
        var nodes = [];
        var i;

        for (i = 0; i < modelData.nodes.length; i++) {
            var nodeData = modelData.nodes[i];

            var node = new GraphNode(nodeData.name);
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
    }

    _parseSkins(data, nodes) {
        var modelData = data.model;
        var skins = [];
        var skinInstances = [];
        var i, j;

        if (!this._device.supportsBoneTextures && modelData.skins.length > 0) {
            var boneLimit = this._device.getBoneLimit();
            partitionSkin(modelData, null, boneLimit);
        }

        for (i = 0; i < modelData.skins.length; i++) {
            var skinData = modelData.skins[i];

            var inverseBindMatrices = [];
            for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
                var ibm = skinData.inverseBindMatrices[j];
                inverseBindMatrices[j] = new Mat4().set(ibm);
            }

            var skin = new Skin(this._device, inverseBindMatrices, skinData.boneNames);
            skins.push(skin);

            var skinInstance = new SkinInstance(skin);
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
    }

    // find number of vertices used by a mesh that is using morph target with index morphIndex
    _getMorphVertexCount(modelData, morphIndex, vertexBuffers) {
        for (var i = 0; i < modelData.meshes.length; i++) {
            var meshData = modelData.meshes[i];

            if (meshData.morph === morphIndex) {
                var vertexBuffer = vertexBuffers[meshData.vertices];
                return vertexBuffer.numVertices;
            }
        }
        return undefined;
    }

    _parseMorphs(data, nodes, vertexBuffers) {
        var modelData = data.model;
        var morphs = [];
        var morphInstances = [];
        var i, j, vertexCount;

        var targets, morphTarget, morphTargetArray;

        if (modelData.morphs) {

            // convert sparse morph target vertex data to full format
            var sparseToFull = function (data, indices, totalCount) {
                var full = new Float32Array(totalCount * 3);
                for (var s = 0; s < indices.length; s++) {
                    var dstIndex = indices[s] * 3;
                    full[dstIndex] = data[s * 3];
                    full[dstIndex + 1] = data[s * 3 + 1];
                    full[dstIndex + 2] = data[s * 3 + 2];
                }
                return full;
            };

            for (i = 0; i < modelData.morphs.length; i++) {
                targets = modelData.morphs[i].targets;
                morphTargetArray = [];

                // total number of verticies of the mesh
                vertexCount = this._getMorphVertexCount(modelData, i, vertexBuffers);

                for (j = 0; j < targets.length; j++) {
                    var targetAabb = targets[j].aabb;

                    var min = targetAabb.min;
                    var max = targetAabb.max;
                    var aabb = new BoundingBox(
                        new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                        new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
                    );

                    // convert sparse to full format
                    var indices = targets[j].indices;
                    var deltaPositions = targets[j].deltaPositions;
                    var deltaNormals = targets[j].deltaNormals;
                    if (indices) {
                        deltaPositions = sparseToFull(deltaPositions, indices, vertexCount);
                        deltaNormals = sparseToFull(deltaNormals, indices, vertexCount);
                    }

                    morphTarget = new MorphTarget({ deltaPositions: deltaPositions,
                        deltaNormals: deltaNormals,
                        name: targets[j].name,
                        aabb: aabb });

                    morphTargetArray.push(morphTarget);
                }

                var morph = new Morph(morphTargetArray, this._device);
                morphs.push(morph);

                var morphInstance = new MorphInstance(morph);
                morphInstances.push(morphInstance);
            }
        }

        return {
            morphs: morphs,
            instances: morphInstances
        };
    }

    _parseVertexBuffers(data) {
        var modelData = data.model;
        var vertexBuffers = [];
        var attribute, attributeName;
        var attributeMap = {
            position: SEMANTIC_POSITION,
            normal: SEMANTIC_NORMAL,
            tangent: SEMANTIC_TANGENT,
            blendWeight: SEMANTIC_BLENDWEIGHT,
            blendIndices: SEMANTIC_BLENDINDICES,
            color: SEMANTIC_COLOR,
            texCoord0: SEMANTIC_TEXCOORD0,
            texCoord1: SEMANTIC_TEXCOORD1,
            texCoord2: SEMANTIC_TEXCOORD2,
            texCoord3: SEMANTIC_TEXCOORD3,
            texCoord4: SEMANTIC_TEXCOORD4,
            texCoord5: SEMANTIC_TEXCOORD5,
            texCoord6: SEMANTIC_TEXCOORD6,
            texCoord7: SEMANTIC_TEXCOORD7
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
                    normalize: (attributeMap[attributeName] === SEMANTIC_COLOR)
                });
            }
            var vertexFormat = new VertexFormat(this._device, formatDesc);

            // Create the vertex buffer
            var numVertices = vertexData.position.data.length / vertexData.position.components;
            var vertexBuffer = new VertexBuffer(this._device, vertexFormat, numVertices);

            var iterator = new VertexIterator(vertexBuffer);
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
    }

    _parseIndexBuffers(data, vertexBuffers) {
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
                indexBuffer = new IndexBuffer(this._device, INDEXFORMAT_UINT32, numIndices);
                indexData = new Uint32Array(indexBuffer.lock());
            } else {
                indexBuffer = new IndexBuffer(this._device, INDEXFORMAT_UINT16, numIndices);
                indexData = new Uint16Array(indexBuffer.lock());
            }
        }

        return {
            buffer: indexBuffer,
            data: indexData
        };
    }

    _parseMeshes(data, skins, morphs, vertexBuffers, indexBuffer, indexData) {
        var modelData = data.model;

        var meshes = [];
        var indexBase = 0;
        var i;

        for (i = 0; i < modelData.meshes.length; i++) {
            var meshData = modelData.meshes[i];

            var meshAabb = meshData.aabb;
            var min = meshAabb.min;
            var max = meshAabb.max;
            var aabb = new BoundingBox(
                new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
            );

            var indexed = (meshData.indices !== undefined);
            var mesh = new Mesh(this._device);
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
    }

    _parseMeshInstances(data, nodes, meshes, skins, skinInstances, morphs, morphInstances) {
        var modelData = data.model;
        var meshInstances = [];
        var i;

        for (i = 0; i < modelData.meshInstances.length; i++) {
            var meshInstanceData = modelData.meshInstances[i];

            var node = nodes[meshInstanceData.node];
            var mesh = meshes[meshInstanceData.mesh];

            var meshInstance = new MeshInstance(node, mesh, Material.defaultMaterial);

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
}

export { JsonModelParser };
