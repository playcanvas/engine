import { Mat4 } from '../../math/mat4.js';
import { Vec3 } from '../../math/vec3.js';

import { BoundingBox } from '../../shape/bounding-box.js';

import {
    INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINES, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1,
    SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from '../../graphics/constants.js';
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

const JSON_PRIMITIVE_TYPE = {
    "points": PRIMITIVE_POINTS,
    "lines": PRIMITIVE_LINES,
    "lineloop": PRIMITIVE_LINELOOP,
    "linestrip": PRIMITIVE_LINESTRIP,
    "triangles": PRIMITIVE_TRIANGLES,
    "trianglestrip": PRIMITIVE_TRISTRIP,
    "trianglefan": PRIMITIVE_TRIFAN
};

const JSON_VERTEX_ELEMENT_TYPE = {
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
        const modelData = data.model;
        if (!modelData) {
            return null;
        }

        if (modelData.version <= 1) {
            // #if _DEBUG
            console.warn("JsonModelParser#parse: Trying to parse unsupported model format.");
            // #endif
            return null;
        }

        // NODE HIERARCHY
        const nodes = this._parseNodes(data);

        // SKINS
        const skins = this._parseSkins(data, nodes);

        // VERTEX BUFFERS
        const vertexBuffers = this._parseVertexBuffers(data);

        // INDEX BUFFER
        const indices = this._parseIndexBuffers(data, vertexBuffers);

        // MORPHS
        const morphs = this._parseMorphs(data, nodes, vertexBuffers);

        // MESHES
        const meshes = this._parseMeshes(data, skins.skins, morphs.morphs, vertexBuffers, indices.buffer, indices.data);

        // MESH INSTANCES
        const meshInstances = this._parseMeshInstances(data, nodes, meshes, skins.skins, skins.instances, morphs.morphs, morphs.instances);

        const model = new Model();
        model.graph = nodes[0];
        model.meshInstances = meshInstances;
        model.skinInstances = skins.instances;
        model.morphInstances = morphs.instances;
        model.getGraph().syncHierarchy();

        return model;
    }

    _parseNodes(data) {
        const modelData = data.model;
        const nodes = [];
        let i;

        for (i = 0; i < modelData.nodes.length; i++) {
            const nodeData = modelData.nodes[i];

            const node = new GraphNode(nodeData.name);
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
        const modelData = data.model;
        const skins = [];
        const skinInstances = [];
        let i, j;

        if (!this._device.supportsBoneTextures && modelData.skins.length > 0) {
            const boneLimit = this._device.getBoneLimit();
            partitionSkin(modelData, null, boneLimit);
        }

        for (i = 0; i < modelData.skins.length; i++) {
            const skinData = modelData.skins[i];

            const inverseBindMatrices = [];
            for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
                const ibm = skinData.inverseBindMatrices[j];
                inverseBindMatrices[j] = new Mat4().set(ibm);
            }

            const skin = new Skin(this._device, inverseBindMatrices, skinData.boneNames);
            skins.push(skin);

            const skinInstance = new SkinInstance(skin);
            // Resolve bone IDs to actual graph nodes
            const bones = [];
            for (j = 0; j < skin.boneNames.length; j++) {
                const boneName = skin.boneNames[j];
                const bone = nodes[0].findByName(boneName);
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
        for (let i = 0; i < modelData.meshes.length; i++) {
            const meshData = modelData.meshes[i];

            if (meshData.morph === morphIndex) {
                const vertexBuffer = vertexBuffers[meshData.vertices];
                return vertexBuffer.numVertices;
            }
        }
        return undefined;
    }

    _parseMorphs(data, nodes, vertexBuffers) {
        const modelData = data.model;
        const morphs = [];
        const morphInstances = [];
        let i, j, vertexCount;

        let targets, morphTarget, morphTargetArray;

        if (modelData.morphs) {

            // convert sparse morph target vertex data to full format
            const sparseToFull = function (data, indices, totalCount) {
                const full = new Float32Array(totalCount * 3);
                for (let s = 0; s < indices.length; s++) {
                    const dstIndex = indices[s] * 3;
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
                    const targetAabb = targets[j].aabb;

                    const min = targetAabb.min;
                    const max = targetAabb.max;
                    const aabb = new BoundingBox(
                        new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                        new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
                    );

                    // convert sparse to full format
                    const indices = targets[j].indices;
                    let deltaPositions = targets[j].deltaPositions;
                    let deltaNormals = targets[j].deltaNormals;
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

                const morph = new Morph(morphTargetArray, this._device);
                morphs.push(morph);

                const morphInstance = new MorphInstance(morph);
                morphInstances.push(morphInstance);
            }
        }

        return {
            morphs: morphs,
            instances: morphInstances
        };
    }

    _parseVertexBuffers(data) {
        const modelData = data.model;
        const vertexBuffers = [];
        const attributeMap = {
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

        for (let i = 0; i < modelData.vertices.length; i++) {
            const vertexData = modelData.vertices[i];

            const formatDesc = [];
            for (const attributeName in vertexData) {
                const attribute = vertexData[attributeName];

                formatDesc.push({
                    semantic: attributeMap[attributeName],
                    components: attribute.components,
                    type: JSON_VERTEX_ELEMENT_TYPE[attribute.type],
                    normalize: (attributeMap[attributeName] === SEMANTIC_COLOR)
                });
            }
            const vertexFormat = new VertexFormat(this._device, formatDesc);

            // Create the vertex buffer
            const numVertices = vertexData.position.data.length / vertexData.position.components;
            const vertexBuffer = new VertexBuffer(this._device, vertexFormat, numVertices);

            const iterator = new VertexIterator(vertexBuffer);
            for (let j = 0; j < numVertices; j++) {
                for (const attributeName in vertexData) {
                    const attribute = vertexData[attributeName];

                    switch (attribute.components) {
                        case 1:
                            iterator.element[attributeMap[attributeName]].set(attribute.data[j]);
                            break;
                        case 2:
                            iterator.element[attributeMap[attributeName]].set(attribute.data[j * 2], 1.0 - attribute.data[j * 2 + 1]);
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
        const modelData = data.model;
        let indexBuffer = null;
        let indexData = null;
        let i;

        // Count the number of indices in the model
        let numIndices = 0;
        for (i = 0; i < modelData.meshes.length; i++) {
            const meshData = modelData.meshes[i];
            if (meshData.indices !== undefined) {
                numIndices += meshData.indices.length;
            }
        }

        // Create an index buffer big enough to store all indices in the model
        let maxVerts = 0;
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
        const modelData = data.model;

        const meshes = [];
        let indexBase = 0;

        for (let i = 0; i < modelData.meshes.length; i++) {
            const meshData = modelData.meshes[i];

            const meshAabb = meshData.aabb;
            const min = meshAabb.min;
            const max = meshAabb.max;
            const aabb = new BoundingBox(
                new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5),
                new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5)
            );

            const indexed = (meshData.indices !== undefined);
            const mesh = new Mesh(this._device);
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
        const modelData = data.model;
        const meshInstances = [];
        let i;

        for (i = 0; i < modelData.meshInstances.length; i++) {
            const meshInstanceData = modelData.meshInstances[i];

            const node = nodes[meshInstanceData.node];
            const mesh = meshes[meshInstanceData.mesh];

            const meshInstance = new MeshInstance(mesh, Material.defaultMaterial, node);

            if (mesh.skin) {
                const skinIndex = skins.indexOf(mesh.skin);
                // #if _DEBUG
                if (skinIndex === -1) {
                    throw new Error('Mesh\'s skin does not appear in skin array.');
                }
                // #endif
                meshInstance.skinInstance = skinInstances[skinIndex];
            }

            if (mesh.morph) {
                const morphIndex = morphs.indexOf(mesh.morph);
                // #if _DEBUG
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
