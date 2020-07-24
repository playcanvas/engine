import { path } from '../../core/path.js';
import { Color } from '../../core/color.js';

import { http } from '../../net/http.js';

import { math } from '../../math/math.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';

import { BoundingBox } from '../../shape/bounding-box.js';

import {
    typedArrayTypes, typedArrayToType,
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    BUFFER_STATIC,
    CULLFACE_NONE, CULLFACE_BACK,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINES, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from '../../graphics/graphics.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';

import {
    BLEND_NONE, BLEND_NORMAL, PROJECTION_PERSPECTIVE, PROJECTION_ORTHOGRAPHIC, ASPECT_MANUAL, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED
} from '../../scene/constants.js';
import { calculateNormals } from '../../scene/procedural.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Entity } from '../../framework/entity.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Model } from '../../scene/model.js';
import { Morph } from '../../scene/morph.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { Skin, SkinInstance } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';

import { AnimCurve, AnimData, AnimTrack } from '../../anim/anim.js';
import { INTERPOLATION_CUBIC, INTERPOLATION_LINEAR, INTERPOLATION_STEP } from '../../anim/constants.js';

import { Asset } from '../../asset/asset.js';

// TODO: this is a nasty dependency. property-locator should be moved to src/anim.
import { AnimPropertyLocator } from '../../framework/components/anim/property-locator.js';

var isDataURI = function (uri) {
    return /^data:.*,.*$/i.test(uri);
};

var getDataURIMimeType = function (uri) {
    return uri.substring(uri.indexOf(":") + 1, uri.indexOf(";"));
};

var getNumComponents = function (accessorType) {
    switch (accessorType) {
        case 'SCALAR': return 1;
        case 'VEC2': return 2;
        case 'VEC3': return 3;
        case 'VEC4': return 4;
        case 'MAT2': return 4;
        case 'MAT3': return 9;
        case 'MAT4': return 16;
        default: return 3;
    }
};

var getComponentType = function (componentType) {
    switch (componentType) {
        case 5120: return TYPE_INT8;
        case 5121: return TYPE_UINT8;
        case 5122: return TYPE_INT16;
        case 5123: return TYPE_UINT16;
        case 5124: return TYPE_INT32;
        case 5125: return TYPE_UINT32;
        case 5126: return TYPE_FLOAT32;
        default: return 0;
    }
};

var getComponentSizeInBytes = function (componentType) {
    switch (componentType) {
        case 5120: return 1;    // int8
        case 5121: return 1;    // uint8
        case 5122: return 2;    // int16
        case 5123: return 2;    // uint16
        case 5124: return 4;    // int32
        case 5125: return 4;    // uint32
        case 5126: return 4;    // float32
        default: return 0;
    }
};

var getComponentDataType = function (componentType) {
    switch (componentType) {
        case 5120: return Int8Array;
        case 5121: return Uint8Array;
        case 5122: return Int16Array;
        case 5123: return Uint16Array;
        case 5124: return Int32Array;
        case 5125: return Uint32Array;
        case 5126: return Float32Array;
        default: return null;
    }
};

var getAccessorData = function (accessor, bufferViews, buffers) {
    var bufferViewIdx;
    var count;
    if (accessor.hasOwnProperty("sparse")) {
        bufferViewIdx = accessor.sparse.values.bufferView;
        count = accessor.sparse.count;
    } else {
        bufferViewIdx = accessor.bufferView;
        count = accessor.count;
    }

    var bufferView = bufferViews[bufferViewIdx];
    var typedArray = buffers[bufferView.buffer];
    var accessorByteOffset = accessor.hasOwnProperty('byteOffset') ? accessor.byteOffset : 0;
    var bufferViewByteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
    var byteOffset = typedArray.byteOffset + accessorByteOffset + bufferViewByteOffset;
    var length = count * getNumComponents(accessor.type);

    var dataType = getComponentDataType(accessor.componentType);
    return dataType ? new dataType(typedArray.buffer, byteOffset, length) : null;
};

var getSparseAccessorIndices = function (accessor, bufferViews, buffers) {
    var bufferView = bufferViews[accessor.sparse.indices.bufferView];
    var typedArray = buffers[bufferView.buffer];
    var bufferViewByteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
    var byteOffset = typedArray.byteOffset + bufferViewByteOffset;
    var length = accessor.sparse.count;

    switch (accessor.sparse.indices.componentType) {
        case 5120: return new Int8Array(typedArray.buffer, byteOffset, length);
        case 5121: return new Uint8Array(typedArray.buffer, byteOffset, length);
        case 5122: return new Int16Array(typedArray.buffer, byteOffset, length);
        case 5123: return new Uint16Array(typedArray.buffer, byteOffset, length);
        case 5124: return new Int32Array(typedArray.buffer, byteOffset, length);
        case 5125: return new Uint32Array(typedArray.buffer, byteOffset, length);
        case 5126: return new Float32Array(typedArray.buffer, byteOffset, length);
        default: return null;
    }
};

var getPrimitiveType = function (primitive) {
    if (!primitive.hasOwnProperty('mode')) {
        return PRIMITIVE_TRIANGLES;
    }

    switch (primitive.mode) {
        case 0: return PRIMITIVE_POINTS;
        case 1: return PRIMITIVE_LINES;
        case 2: return PRIMITIVE_LINELOOP;
        case 3: return PRIMITIVE_LINESTRIP;
        case 4: return PRIMITIVE_TRIANGLES;
        case 5: return PRIMITIVE_TRISTRIP;
        case 6: return PRIMITIVE_TRIFAN;
        default: return PRIMITIVE_TRIANGLES;
    }
};

function getNodePath(targetNode, nodes) {
    var parent = nodes.findIndex(function (node) {
        return node.hasOwnProperty('children') ? node.children.includes(targetNode) : false;
    });
    if (parent !== -1) {
        return getNodePath(parent, nodes).concat([targetNode]);
    }
    return [targetNode];
}

var generateIndices = function (numVertices) {
    var dummyIndices = new Uint16Array(numVertices);
    for (var i = 0; i < numVertices; i++) {
        dummyIndices[i] = i;
    }
    return dummyIndices;
};

var generateNormals = function (sourceDesc, indices) {
    // get positions
    var p = sourceDesc[SEMANTIC_POSITION];
    if (!p || p.components !== 3 || p.size !== p.stride) {
        // NOTE: normal generation only works on tightly packed positions
        return;
    }

    var positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
    var numVertices = p.count;

    // generate indices if necessary
    if (!indices) {
        indices = generateIndices(numVertices);
    }

    // generate normals
    var normalsTemp = calculateNormals(positions, indices);
    var normals = new Float32Array(normalsTemp.length);
    normals.set(normalsTemp);

    sourceDesc[SEMANTIC_NORMAL] = {
        buffer: normals.buffer,
        size: 12,
        offset: 0,
        stride: 12,
        count: numVertices,
        components: 3,
        type: TYPE_FLOAT32
    };
};

var flipTexCoordVs = function (vertexBuffer) {
    var i, j;

    var floatOffsets = [];
    var shortOffsets = [];
    var byteOffsets = [];
    for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
        var element = vertexBuffer.format.elements[i];
        if (element.name === SEMANTIC_TEXCOORD0 ||
            element.name === SEMANTIC_TEXCOORD1) {
            switch (element.dataType) {
                case TYPE_FLOAT32:
                    floatOffsets.push({ offset: element.offset / 4 + 1, stride: element.stride / 4 });
                    break;
                case TYPE_UINT16:
                    shortOffsets.push({ offset: element.offset / 2 + 1, stride: element.stride / 2 });
                    break;
                case TYPE_UINT8:
                    byteOffsets.push({ offset: element.offset + 1, stride: element.stride });
                    break;
            }
        }
    }

    var flip = function (offsets, type, one) {
        var typedArray = new type(vertexBuffer.storage);
        for (i = 0; i < offsets.length; ++i) {
            var index = offsets[i].offset;
            var stride = offsets[i].stride;
            for (j = 0; j < vertexBuffer.numVertices; ++j) {
                typedArray[index] = one - typedArray[index];
                index += stride;
            }
        }
    };

    if (floatOffsets.length > 0) {
        flip(floatOffsets, Float32Array, 1.0);
    }
    if (shortOffsets.length > 0) {
        flip(shortOffsets, Uint16Array, 65535);
    }
    if (byteOffsets.length > 0) {
        flip(byteOffsets, Uint8Array, 255);
    }
};


var createVertexBufferInternal = function (device, sourceDesc, disableFlipV) {
    var positionDesc = sourceDesc[SEMANTIC_POSITION];
    var numVertices = positionDesc.count;

    // generate vertexDesc elements
    var vertexDesc = [];
    for (var semantic in sourceDesc) {
        if (sourceDesc.hasOwnProperty(semantic)) {
            vertexDesc.push({
                semantic: semantic,
                components: sourceDesc[semantic].components,
                type: sourceDesc[semantic].type,
                normalize: !!sourceDesc[semantic].normalize
            });
        }
    }

    // order vertexDesc to match the rest of the engine
    var elementOrder = [
        SEMANTIC_POSITION,
        SEMANTIC_NORMAL,
        SEMANTIC_TANGENT,
        SEMANTIC_COLOR,
        SEMANTIC_BLENDINDICES,
        SEMANTIC_BLENDWEIGHT,
        SEMANTIC_TEXCOORD0,
        SEMANTIC_TEXCOORD1
    ];

    // sort vertex elements by engine-ideal order
    vertexDesc.sort(function (lhs, rhs) {
        var lhsOrder = elementOrder.indexOf(lhs.semantic);
        var rhsOrder = elementOrder.indexOf(rhs.semantic);
        return (lhsOrder < rhsOrder) ? -1 : (rhsOrder < lhsOrder ? 1 : 0);
    });

    var i, j, k;
    var source, target, sourceOffset;

    var vertexFormat = new VertexFormat(device, vertexDesc);

    // check whether source data is correctly interleaved
    var isCorrectlyInterleaved = true;
    for (i = 0; i < vertexFormat.elements.length; ++i) {
        target = vertexFormat.elements[i];
        source = sourceDesc[target.name];
        sourceOffset = source.offset - positionDesc.offset;
        if ((source.buffer !== positionDesc.buffer) ||
            (source.stride !== target.stride) ||
            (source.size !== target.size) ||
            (sourceOffset !== target.offset)) {
            isCorrectlyInterleaved = false;
            break;
        }
    }

    // create vertex buffer
    var vertexBuffer = new VertexBuffer(device,
                                        vertexFormat,
                                        numVertices,
                                        BUFFER_STATIC);

    var vertexData = vertexBuffer.lock();
    var targetArray = new Uint32Array(vertexData);
    var sourceArray;

    if (isCorrectlyInterleaved) {
        // copy data
        sourceArray = new Uint32Array(positionDesc.buffer,
                                      positionDesc.offset,
                                      numVertices * vertexBuffer.format.size / 4);
        targetArray.set(sourceArray);
    } else {
        var targetStride, sourceStride;
        // copy data and interleave
        for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
            target = vertexBuffer.format.elements[i];
            targetStride = target.stride / 4;

            source = sourceDesc[target.name];
            sourceArray = new Uint32Array(source.buffer, source.offset, source.count * source.stride / 4);
            sourceStride = source.stride / 4;

            var src = 0;
            var dst = target.offset / 4;
            for (j = 0; j < numVertices; ++j) {
                for (k = 0; k < source.size / 4; ++k) {
                    targetArray[dst + k] = sourceArray[src + k];
                }
                src += sourceStride;
                dst += targetStride;
            }
        }
    }

    if (!disableFlipV) {
        flipTexCoordVs(vertexBuffer);
    }

    vertexBuffer.unlock();

    return vertexBuffer;
};

var createVertexBuffer = function (device, attributes, indices, accessors, bufferViews, buffers, semanticMap, disableFlipV) {

    // build vertex buffer format desc and source
    var sourceDesc = {};
    for (var attrib in attributes) {
        if (attributes.hasOwnProperty(attrib)) {
            var accessor = accessors[attributes[attrib]];
            var bufferView = bufferViews[accessor.bufferView];

            if (semanticMap.hasOwnProperty(attrib)) {
                var semantic = semanticMap[attrib].semantic;
                // store the info we'll need to copy this data into the vertex buffer
                var size = getNumComponents(accessor.type) * getComponentSizeInBytes(accessor.componentType);
                var buffer = buffers[bufferView.buffer];
                sourceDesc[semantic] = {
                    buffer: buffer.buffer,
                    size: size,
                    offset: (accessor.hasOwnProperty('byteOffset') ? accessor.byteOffset : 0) +
                            (bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0) +
                            (buffer.byteOffset),
                    stride: bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size,
                    count: accessor.count,
                    components: getNumComponents(accessor.type),
                    type: getComponentType(accessor.componentType),
                    normalize: accessor.normalized
                };
            }
        }
    }

    // generate normals if they're missing (this should probably be a user option)
    if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
        generateNormals(sourceDesc, indices);
    }

    return createVertexBufferInternal(device, sourceDesc, disableFlipV);
};

var createVertexBufferDraco = function (device, outputGeometry, extDraco, decoder, decoderModule, semanticMap, indices, disableFlipV) {

    var numPoints = outputGeometry.num_points();

    // helper function to decode data stream with id to TypedArray of appropriate type
    var extractDracoAttributeInfo = function (uniqueId) {
        var attribute = decoder.GetAttributeByUniqueId(outputGeometry, uniqueId);
        var numValues = numPoints * attribute.num_components();
        var dracoFormat = attribute.data_type();
        var ptr, values, componentSizeInBytes, storageType;

        // storage format is based on draco attribute data type
        switch (dracoFormat) {

            case decoderModule.DT_UINT8:
                storageType = TYPE_UINT8;
                componentSizeInBytes = 1;
                ptr = decoderModule._malloc(numValues * componentSizeInBytes);
                decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_UINT8, numValues * componentSizeInBytes, ptr);
                values = new Uint8Array(decoderModule.HEAPU8.buffer, ptr, numValues).slice();
                break;

            case decoderModule.DT_UINT16:
                storageType = TYPE_UINT16;
                componentSizeInBytes = 2;
                ptr = decoderModule._malloc(numValues * componentSizeInBytes);
                decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_UINT16, numValues * componentSizeInBytes, ptr);
                values = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numValues).slice();
                break;

            case decoderModule.DT_FLOAT32:
            default:
                storageType = TYPE_FLOAT32;
                componentSizeInBytes = 4;
                ptr = decoderModule._malloc(numValues * componentSizeInBytes);
                decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_FLOAT32, numValues * componentSizeInBytes, ptr);
                values = new Float32Array(decoderModule.HEAPF32.buffer, ptr, numValues).slice();
                break;
        }

        decoderModule._free(ptr);

        return {
            values: values,
            numComponents: attribute.num_components(),
            componentSizeInBytes: componentSizeInBytes,
            storageType: storageType,
            normalized: attribute.normalized()
        };
    };

    // build vertex buffer format desc and source
    var sourceDesc = {};
    var attributes = extDraco.attributes;
    for (var attrib in attributes) {
        if (attributes.hasOwnProperty(attrib) && semanticMap.hasOwnProperty(attrib)) {
            var semanticInfo = semanticMap[attrib];
            var semantic = semanticInfo.semantic;
            var attributeInfo = extractDracoAttributeInfo(attributes[attrib]);

            // store the info we'll need to copy this data into the vertex buffer
            var size = attributeInfo.numComponents * attributeInfo.componentSizeInBytes;
            sourceDesc[semantic] = {
                values: attributeInfo.values,
                buffer: attributeInfo.values.buffer,
                size: size,
                offset: 0,
                stride: size,
                count: numPoints,
                components: attributeInfo.numComponents,
                type: attributeInfo.storageType,
                normalize: attributeInfo.normalized
            };
        }
    }

    // generate normals if they're missing (this should probably be a user option)
    if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
        generateNormals(sourceDesc, indices);
    }

    return createVertexBufferInternal(device, sourceDesc, disableFlipV);
};

var createSkin = function (device, gltfSkin, accessors, bufferViews, nodes, buffers) {
    var i, j, bindMatrix;
    var joints = gltfSkin.joints;
    var numJoints = joints.length;
    var ibp = [];
    if (gltfSkin.hasOwnProperty('inverseBindMatrices')) {
        var inverseBindMatrices = gltfSkin.inverseBindMatrices;
        var ibmData = getAccessorData(accessors[inverseBindMatrices], bufferViews, buffers);
        var ibmValues = [];

        for (i = 0; i < numJoints; i++) {
            for (j = 0; j < 16; j++) {
                ibmValues[j] = ibmData[i * 16 + j];
            }
            bindMatrix = new Mat4();
            bindMatrix.set(ibmValues);
            ibp.push(bindMatrix);
        }
    } else {
        for (i = 0; i < numJoints; i++) {
            bindMatrix = new Mat4();
            ibp.push(bindMatrix);
        }
    }

    var boneNames = [];
    for (i = 0; i < numJoints; i++) {
        boneNames[i] = nodes[joints[i]].name;
    }

    var skeleton = gltfSkin.skeleton;

    var skin = new Skin(device, ibp, boneNames);
    skin.skeleton = nodes[skeleton];

    skin.bones = [];
    for (i = 0; i < joints.length; i++) {
        skin.bones[i] = nodes[joints[i]];
    }

    return skin;
};

var tempMat = new Mat4();
var tempVec = new Vec3();

var createMeshGroup = function (device, gltfMesh, accessors, bufferViews, buffers, callback, disableFlipV) {
    var meshes = [];

    var semanticMap = {
        'POSITION': { semantic: SEMANTIC_POSITION },
        'NORMAL': { semantic: SEMANTIC_NORMAL },
        'TANGENT': { semantic: SEMANTIC_TANGENT },
        'COLOR_0': { semantic: SEMANTIC_COLOR },
        'JOINTS_0': { semantic: SEMANTIC_BLENDINDICES },
        'WEIGHTS_0': { semantic: SEMANTIC_BLENDWEIGHT },
        'TEXCOORD_0': { semantic: SEMANTIC_TEXCOORD0 },
        'TEXCOORD_1': { semantic: SEMANTIC_TEXCOORD1 }
    };

    gltfMesh.primitives.forEach(function (primitive) {

        var primitiveType, vertexBuffer, numIndices;
        var indices = null;
        var mesh = new Mesh(device);
        var canUseMorph = true;

        // try and get draco compressed data first
        if (primitive.hasOwnProperty('extensions')) {
            var extensions = primitive.extensions;
            if (extensions.hasOwnProperty('KHR_draco_mesh_compression')) {

                // access DracoDecoderModule
                var decoderModule = window.DracoDecoderModule;
                if (decoderModule) {
                    var extDraco = extensions.KHR_draco_mesh_compression;
                    if (extDraco.hasOwnProperty('attributes')) {
                        var bufferView = bufferViews[extDraco.bufferView];
                        var arrayBuffer = buffers[bufferView.buffer];
                        var uint8Buffer = new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset + bufferView.byteOffset, bufferView.byteLength);
                        var buffer = new decoderModule.DecoderBuffer();
                        buffer.Init(uint8Buffer, uint8Buffer.length);

                        var decoder = new decoderModule.Decoder();
                        var geometryType = decoder.GetEncodedGeometryType(buffer);

                        var outputGeometry, status;
                        switch (geometryType) {
                            case decoderModule.POINT_CLOUD:
                                primitiveType = PRIMITIVE_POINTS;
                                outputGeometry = new decoderModule.PointCloud();
                                status = decoder.DecodeBufferToPointCloud(buffer, outputGeometry);
                                break;
                            case decoderModule.TRIANGULAR_MESH:
                                primitiveType = PRIMITIVE_TRIANGLES;
                                outputGeometry = new decoderModule.Mesh();
                                status = decoder.DecodeBufferToMesh(buffer, outputGeometry);
                                break;
                            case decoderModule.INVALID_GEOMETRY_TYPE:
                            default:
                                break;
                        }

                        if (!status || !status.ok() || outputGeometry.ptr == 0) {
                            callback("Failed to decode draco compressed asset: " +
                            (status ? status.error_msg() : ('Mesh asset - invalid draco compressed geometry type: ' + geometryType) ));
                            return;
                        }

                        // indices
                        var numFaces = outputGeometry.num_faces();
                        if (geometryType == decoderModule.TRIANGULAR_MESH) {
                            var bit32 = outputGeometry.num_points() > 65535;
                            numIndices = numFaces * 3;
                            var dataSize = numIndices * (bit32 ? 4 : 2);
                            var ptr = decoderModule._malloc(dataSize);

                            if (bit32) {
                                decoder.GetTrianglesUInt32Array(outputGeometry, dataSize, ptr);
                                indices = new Uint32Array(decoderModule.HEAPU32.buffer, ptr, numIndices).slice();
                            } else {
                                decoder.GetTrianglesUInt16Array(outputGeometry, dataSize, ptr);
                                indices = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numIndices).slice();
                            }

                            decoderModule._free( ptr );
                        }

                        // vertices
                        vertexBuffer = createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, semanticMap, indices, disableFlipV);

                        // clean up
                        decoderModule.destroy(outputGeometry);
                        decoderModule.destroy(decoder);
                        decoderModule.destroy(buffer);

                        // morph streams are not compatible with draco compression, disable morphing
                        canUseMorph = false;
                    }
                } else {
                    // #ifdef DEBUG
                    console.warn("File contains draco compressed data, but DracoDecoderModule is not configured.");
                    // #endif
                }
            }
        }

        // if mesh was not constructed from draco data, use uncompressed
        if (!vertexBuffer) {
            indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, buffers) : null;
            vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, buffers, semanticMap, disableFlipV);
            primitiveType = getPrimitiveType(primitive);
        }

        // build the mesh
        mesh.vertexBuffer = vertexBuffer;
        mesh.primitive[0].type = primitiveType;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].indexed = (indices !== null);

        // index buffer
        if (indices !== null) {
            var indexFormat;
            if (indices instanceof Uint8Array) {
                indexFormat = INDEXFORMAT_UINT8;
            } else if (indices instanceof Uint16Array) {
                indexFormat = INDEXFORMAT_UINT16;
            } else {
                // TODO: these indices may need conversion since some old WebGL 1.0 devices
                // don't support 32bit index data
                indexFormat = INDEXFORMAT_UINT32;
            }
            var indexBuffer = new IndexBuffer(device, indexFormat, indices.length, BUFFER_STATIC, indices);
            mesh.indexBuffer[0] = indexBuffer;
            mesh.primitive[0].count = indices.length;
        } else {
            mesh.primitive[0].count = vertexBuffer.numVertices;
        }

        mesh.materialIndex = primitive.material;

        var accessor = accessors[primitive.attributes.POSITION];
        var min = accessor.min;
        var max = accessor.max;
        var aabb = new BoundingBox(
            new Vec3((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2),
            new Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2)
        );
        mesh.aabb = aabb;

        // convert sparse morph target vertex data to full format
        var sparseToFull = function (data, indices, dataType, totalCount) {
            var full = new dataType(totalCount * 3);
            for (var s = 0; s < indices.length; s++) {
                var dstIndex = indices[s] * 3;
                full[dstIndex] = data[s * 3];
                full[dstIndex + 1] = data[s * 3 + 1];
                full[dstIndex + 2] = data[s * 3 + 2];
            }
            return full;
        };

        // morph targets
        if (canUseMorph && primitive.hasOwnProperty('targets')) {
            var targets = [];
            var dataType;

            primitive.targets.forEach(function (target, index) {
                var options = {};

                if (target.hasOwnProperty('POSITION')) {

                    accessor = accessors[target.POSITION];
                    dataType = getComponentDataType(accessor.componentType);

                    options.deltaPositions = getAccessorData(accessor, bufferViews, buffers);
                    options.deltaPositionsType = typedArrayToType[dataType.name];

                    if (accessor.sparse) {
                        options.deltaPositions = sparseToFull(options.deltaPositions, getSparseAccessorIndices(accessor, bufferViews, buffers),
                                                              dataType, mesh.vertexBuffer.numVertices);

                    }

                    if (accessor.hasOwnProperty('min') && accessor.hasOwnProperty('max')) {
                        options.aabb = new BoundingBox();
                        options.aabb.setMinMax(new Vec3(accessor.min), new Vec3(accessor.max));
                    }
                }

                if (target.hasOwnProperty('NORMAL')) {

                    accessor = accessors[target.NORMAL];
                    dataType = getComponentDataType(accessor.componentType);

                    options.deltaNormals = getAccessorData(accessor, bufferViews, buffers);
                    options.deltaNormalsType = typedArrayToType[dataType.name];

                    if (accessor.sparse) {
                        options.deltaNormals = sparseToFull(options.deltaNormals, getSparseAccessorIndices(accessor, bufferViews, buffers),
                                                            dataType, mesh.vertexBuffer.numVertices);
                    }
                }

                if (gltfMesh.hasOwnProperty('extras') &&
                    gltfMesh.extras.hasOwnProperty('targetNames')) {
                    options.name = gltfMesh.extras.targetNames[index];
                } else {
                    options.name = targets.length.toString(10);
                }

                targets.push(new MorphTarget(device, options));
            });

            mesh.morph = new Morph(targets);

            // set default morph target weights if they're specified
            if (gltfMesh.hasOwnProperty('weights')) {
                for (var i = 0; i < gltfMesh.weights.length; ++i) {
                    targets[i].defaultWeight = gltfMesh.weights[i];
                }
            }
        }

        meshes.push(mesh);
    });

    return meshes;
};

var createMaterial = function (gltfMaterial, textures, disableFlipV) {
    // TODO: integrate these shader chunks into the native engine
    var glossChunk = [
        "#ifdef MAPFLOAT",
        "uniform float material_shininess;",
        "#endif",
        "",
        "#ifdef MAPTEXTURE",
        "uniform sampler2D texture_glossMap;",
        "#endif",
        "",
        "void getGlossiness() {",
        "    dGlossiness = 1.0;",
        "",
        "#ifdef MAPFLOAT",
        "    dGlossiness *= material_shininess;",
        "#endif",
        "",
        "#ifdef MAPTEXTURE",
        "    dGlossiness *= texture2D(texture_glossMap, $UV).$CH;",
        "#endif",
        "",
        "#ifdef MAPVERTEX",
        "    dGlossiness *= saturate(vVertexColor.$VC);",
        "#endif",
        "",
        "    dGlossiness = 1.0 - dGlossiness;",
        "",
        "    dGlossiness += 0.0000001;",
        "}"
    ].join('\n');

    var specularChunk = [
        "#ifdef MAPCOLOR",
        "uniform vec3 material_specular;",
        "#endif",
        "",
        "#ifdef MAPTEXTURE",
        "uniform sampler2D texture_specularMap;",
        "#endif",
        "",
        "void getSpecularity() {",
        "    dSpecularity = vec3(1.0);",
        "",
        "    #ifdef MAPCOLOR",
        "        dSpecularity *= material_specular;",
        "    #endif",
        "",
        "    #ifdef MAPTEXTURE",
        "        vec3 srgb = texture2D(texture_specularMap, $UV).$CH;",
        "        dSpecularity *= vec3(pow(srgb.r, 2.2), pow(srgb.g, 2.2), pow(srgb.b, 2.2));",
        "    #endif",
        "",
        "    #ifdef MAPVERTEX",
        "        dSpecularity *= saturate(vVertexColor.$VC);",
        "    #endif",
        "}"
    ].join('\n');

    var uvONE = [1, 1];
    var uvZERO = [0, 0];

    var extractTextureTransform = function (source, material, maps) {
        var map;

        var texCoord = source.texCoord;
        if (texCoord) {
            for (map = 0; map < maps.length; ++map) {
                material[maps[map] + 'MapUv'] = texCoord;
            }
        }

        var scale = uvONE;
        var offset = uvZERO;

        var extensions = source.extensions;
        if (extensions) {
            var textureTransformData = extensions.KHR_texture_transform;
            if (textureTransformData) {
                if (textureTransformData.scale) {
                    scale = textureTransformData.scale;
                }
                if (textureTransformData.offset) {
                    offset = textureTransformData.offset;
                }
            }
        }

        // NOTE: we construct the texture transform specially to compensate for the fact we flip
        // texture coordinate V at load time.
        for (map = 0; map < maps.length; ++map) {
            material[maps[map] + 'MapTiling'] = new Vec2(scale[0], scale[1]);
            material[maps[map] + 'MapOffset'] = new Vec2(offset[0], disableFlipV ? offset[1] : 1.0 - scale[1] - offset[1]);
        }
    };

    var material = new StandardMaterial();

    // glTF dooesn't define how to occlude specular
    material.occludeSpecular = true;

    material.diffuseTint = true;
    material.diffuseVertexColor = true;

    material.specularTint = true;
    material.specularVertexColor = true;

    if (gltfMaterial.hasOwnProperty('name')) {
        material.name = gltfMaterial.name;
    }

    var color, texture;
    if (gltfMaterial.hasOwnProperty('extensions') &&
        gltfMaterial.extensions.hasOwnProperty('KHR_materials_pbrSpecularGlossiness')) {
        var specData = gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness;

        if (specData.hasOwnProperty('diffuseFactor')) {
            color = specData.diffuseFactor;
            // Convert from linear space to sRGB space
            material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
            material.opacity = (color[3] != null) ? color[3] : 1;
        } else {
            material.diffuse.set(1, 1, 1);
            material.opacity = 1;
        }
        if (specData.hasOwnProperty('diffuseTexture')) {
            var diffuseTexture = specData.diffuseTexture;
            texture = textures[diffuseTexture.index];

            material.diffuseMap = texture;
            material.diffuseMapChannel = 'rgb';
            material.opacityMap = texture;
            material.opacityMapChannel = 'a';

            extractTextureTransform(diffuseTexture, material, ['diffuse', 'opacity']);
        }
        material.useMetalness = false;
        if (specData.hasOwnProperty('specularFactor')) {
            color = specData.specularFactor;
            // Convert from linear space to sRGB space
            material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
        } else {
            material.specular.set(1, 1, 1);
        }
        if (specData.hasOwnProperty('glossinessFactor')) {
            material.shininess = 100 * specData.glossinessFactor;
        } else {
            material.shininess = 100;
        }
        if (specData.hasOwnProperty('specularGlossinessTexture')) {
            var specularGlossinessTexture = specData.specularGlossinessTexture;
            material.specularMap = material.glossMap = textures[specularGlossinessTexture.index];
            material.specularMapChannel = 'rgb';
            material.glossMapChannel = 'a';

            extractTextureTransform(specularGlossinessTexture, material, ['gloss', 'metalness']);
        }

        material.chunks.specularPS = specularChunk;

    } else if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
        var pbrData = gltfMaterial.pbrMetallicRoughness;

        if (pbrData.hasOwnProperty('baseColorFactor')) {
            color = pbrData.baseColorFactor;
            // Convert from linear space to sRGB space
            material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
            material.opacity = color[3];
        } else {
            material.diffuse.set(1, 1, 1);
            material.opacity = 1;
        }
        if (pbrData.hasOwnProperty('baseColorTexture')) {
            var baseColorTexture = pbrData.baseColorTexture;
            texture = textures[baseColorTexture.index];

            material.diffuseMap = texture;
            material.diffuseMapChannel = 'rgb';
            material.opacityMap = texture;
            material.opacityMapChannel = 'a';

            extractTextureTransform(baseColorTexture, material, ['diffuse', 'opacity']);
        }
        material.useMetalness = true;
        if (pbrData.hasOwnProperty('metallicFactor')) {
            material.metalness = pbrData.metallicFactor;
        } else {
            material.metalness = 1;
        }
        if (pbrData.hasOwnProperty('roughnessFactor')) {
            material.shininess = 100 * pbrData.roughnessFactor;
        } else {
            material.shininess = 100;
        }
        if (pbrData.hasOwnProperty('metallicRoughnessTexture')) {
            var metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
            material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
            material.metalnessMapChannel = 'b';
            material.glossMapChannel = 'g';

            extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
        }

        material.chunks.glossPS = glossChunk;
    }

    if (gltfMaterial.hasOwnProperty('normalTexture')) {
        var normalTexture = gltfMaterial.normalTexture;
        material.normalMap = textures[normalTexture.index];

        extractTextureTransform(normalTexture, material, ['normal']);

        if (normalTexture.hasOwnProperty('scale')) {
            material.bumpiness = normalTexture.scale;
        }
    }
    if (gltfMaterial.hasOwnProperty('occlusionTexture')) {
        var occlusionTexture = gltfMaterial.occlusionTexture;
        material.aoMap = textures[occlusionTexture.index];
        material.aoMapChannel = 'r';

        extractTextureTransform(occlusionTexture, material, ['ao']);
        // TODO: support 'strength'
    }
    if (gltfMaterial.hasOwnProperty('emissiveFactor')) {
        color = gltfMaterial.emissiveFactor;
        // Convert from linear space to sRGB space
        material.emissive.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
        material.emissiveTint = true;
    } else {
        material.emissive.set(0, 0, 0);
        material.emissiveTint = false;
    }
    if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
        var emissiveTexture = gltfMaterial.emissiveTexture;
        material.emissiveMap = textures[emissiveTexture.index];

        extractTextureTransform(emissiveTexture, material, ['emissive']);
    }
    if (gltfMaterial.hasOwnProperty('alphaMode')) {
        switch (gltfMaterial.alphaMode) {
            case 'MASK':
                material.blendType = BLEND_NONE;
                if (gltfMaterial.hasOwnProperty('alphaCutoff')) {
                    material.alphaTest = gltfMaterial.alphaCutoff;
                } else {
                    material.alphaTest = 0.5;
                }
                break;
            case 'BLEND':
                material.blendType = BLEND_NORMAL;
                break;
            default:
            case 'OPAQUE':
                material.blendType = BLEND_NONE;
                break;
        }
    } else {
        material.blendType = BLEND_NONE;
    }
    if (gltfMaterial.hasOwnProperty('doubleSided')) {
        material.twoSidedLighting = gltfMaterial.doubleSided;
        material.cull = gltfMaterial.doubleSided ? CULLFACE_NONE : CULLFACE_BACK;
    } else {
        material.twoSidedLighting = false;
        material.cull = CULLFACE_BACK;
    }

    // handle unlit material by disabling lighting and copying diffuse colours
    // into emissive.
    if (gltfMaterial.hasOwnProperty('extensions') &&
        gltfMaterial.extensions.hasOwnProperty('KHR_materials_unlit')) {
        material.useLighting = false;

        // copy diffuse into emissive
        material.emissive.copy(material.diffuse);
        material.emissiveTint = material.diffuseTint;
        material.emissiveMap = material.diffuseMap;
        material.emissiveMapUv = material.diffuseMapUv;
        material.emissiveMapTiling.copy(material.diffuseMapTiling);
        material.emissiveMapOffset.copy(material.diffuseMapOffset);
        material.emissiveMapChannel = material.diffuseMapChannel;
        material.emissiveVertexColor = material.diffuseVertexColor;
        material.emissiveVertexColorChannel = material.diffuseVertexColorChannel;

        // blank diffuse
        material.diffuse.set(0, 0, 0);
        material.diffuseTint = false;
        material.diffuseMap = null;
        material.diffuseVertexColor = false;
    }

    material.update();

    return material;
};

// create the anim structure
var createAnimation = function (gltfAnimation, animationIndex, accessors, bufferViews, nodes, nodeEntities, buffers) {

    // create animation data block for the accessor
    var createAnimData = function (accessor) {
        var data = getAccessorData(accessor, bufferViews, buffers);
        // TODO: this assumes data is tightly packed, handle the case data is interleaved
        return new AnimData(getNumComponents(accessor.type), new data.constructor(data));
    };

    var interpMap = {
        "STEP": INTERPOLATION_STEP,
        "LINEAR": INTERPOLATION_LINEAR,
        "CUBICSPLINE": INTERPOLATION_CUBIC
    };

    var inputMap = { };
    var inputs = [];

    var outputMap = { };
    var outputs = [];

    var curves = [];
    var targetRootNodes = [];

    var i;

    // convert samplers
    for (i = 0; i < gltfAnimation.samplers.length; ++i) {
        var sampler = gltfAnimation.samplers[i];

        // get input data
        if (!inputMap.hasOwnProperty(sampler.input)) {
            inputMap[sampler.input] = inputs.length;
            inputs.push(createAnimData(accessors[sampler.input]));
        }

        // get output data
        if (!outputMap.hasOwnProperty(sampler.output)) {
            outputMap[sampler.output] = outputs.length;
            outputs.push(createAnimData(accessors[sampler.output]));
        }

        var interpolation =
            sampler.hasOwnProperty('interpolation') &&
            interpMap.hasOwnProperty(sampler.interpolation) ?
                interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;

        // create curve
        curves.push(new AnimCurve(
            [],
            inputMap[sampler.input],
            outputMap[sampler.output],
            interpolation));
    }

    var quatArrays = [];

    var propertyLocator = new AnimPropertyLocator();
    var transformSchema = {
        'translation': 'localPosition',
        'rotation': 'localRotation',
        'scale': 'localScale',
        'weights': 'weights'
    };

    // convert anim channels
    for (i = 0; i < gltfAnimation.channels.length; ++i) {
        var channel = gltfAnimation.channels[i];
        var target = channel.target;
        var curve = curves[channel.sampler];

        // get node locator path relative to root node
        var targetNodePath = getNodePath(target.node, nodes);
        var targetNodePathNamed = targetNodePath.map(function (node) {
            return nodeEntities[node].name;
        });

        targetRootNodes.push(targetNodePath[0]);
        curve._paths.push(propertyLocator.encode([targetNodePathNamed, 'entity', [transformSchema[target.path]]]));

        // if this target is a set of quaternion keys, make note of its index so we can perform
        // quaternion-specific processing on it.
        if (target.path.startsWith('rotation') && curve.interpolation !== INTERPOLATION_CUBIC) {
            quatArrays.push(curve.output);
        } else if (target.path.startsWith('weights')) {
            // it's a bit strange, but morph target animations implicitly assume there are n output
            // values when there are n morph targets. here we set the number of components explicitly
            // on the output curve data.
            outputs[curve.output]._components = outputs[curve.output].data.length / inputs[curve.input].data.length;
        }
    }

    // sort the list of array indexes so we can skip dups
    quatArrays.sort();

    // run through the quaternion data arrays flipping quaternion keys
    // that don't fall in the same winding order.
    var prevIndex = null;
    var data;
    for (i = 0; i < quatArrays.length; ++i) {
        var index = quatArrays[i];
        // skip over duplicate array indices
        if (i === 0 || index !== prevIndex) {
            data = outputs[index];
            if (data.components === 4) {
                var d = data.data;
                var len = d.length - 4;
                for (var j = 0; j < len; j += 4) {
                    var dp = d[j + 0] * d[j + 4] +
                             d[j + 1] * d[j + 5] +
                             d[j + 2] * d[j + 6] +
                             d[j + 3] * d[j + 7];

                    if (dp < 0) {
                        d[j + 4] *= -1;
                        d[j + 5] *= -1;
                        d[j + 6] *= -1;
                        d[j + 7] *= -1;
                    }
                }
            }
            prevIndex = index;
        }
    }

    // calculate duration of the animation as maximum time value
    var duration = 0;
    for (i = 0; i < inputs.length; i++) {
        data  = inputs[i]._data;
        duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
    }

    return {
        track: new AnimTrack(
            gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : ('animation_' + animationIndex),
            duration,
            inputs,
            outputs,
            curves
        ),
        // return root nodes without duplicates
        targetRootNodes: targetRootNodes.filter(function (rootNode, index, rootNodes) {
            return rootNodes.indexOf(rootNode) === index;
        })
    };
};

var createNode = function (gltfNode, nodeIndex) {
    var entity = new Entity();

    if (gltfNode.hasOwnProperty('name')) {
        // Remove slashes since they interfere with animation curve paths
        entity.name = gltfNode.name.replace(/\//g, '_');
    } else {
        entity.name = 'node_' + nodeIndex;
    }

    // Parse transformation properties
    if (gltfNode.hasOwnProperty('matrix')) {
        tempMat.data.set(gltfNode.matrix);
        tempMat.getTranslation(tempVec);
        entity.setLocalPosition(tempVec);
        tempMat.getEulerAngles(tempVec);
        entity.setLocalEulerAngles(tempVec);
        tempMat.getScale(tempVec);
        entity.setLocalScale(tempVec);
    }

    if (gltfNode.hasOwnProperty('rotation')) {
        var r = gltfNode.rotation;
        entity.setLocalRotation(r[0], r[1], r[2], r[3]);
    }

    if (gltfNode.hasOwnProperty('translation')) {
        var t = gltfNode.translation;
        entity.setLocalPosition(t[0], t[1], t[2]);
    }

    if (gltfNode.hasOwnProperty('scale')) {
        var s = gltfNode.scale;
        entity.setLocalScale(s[0], s[1], s[2]);
    }

    return entity;
};


var createScene = function (sceneData, sceneIndex, nodes) {
    var sceneRoot = new Entity();

    if (sceneData.hasOwnProperty('name')) {
        sceneRoot.name = sceneData.name;
    } else {
        sceneRoot.name = 'scene_' + sceneIndex;
    }

    sceneData.nodes.forEach(function (nodeIndex) {
        var node = nodes[nodeIndex];
        if (node !== undefined) {
            sceneRoot.addChild(node);
        }
    });

    return sceneRoot;
};

var createModel = function (name, meshGroup, materials, defaultMaterial) {
    var model = new Model();
    model.graph = new GraphNode(name);

    meshGroup.forEach(function (mesh) {
        var material = (mesh.materialIndex === undefined) ? defaultMaterial : materials[mesh.materialIndex];
        var meshInstance = new MeshInstance(model.graph, mesh, material);

        if (mesh.morph) {
            var morphInstance = new MorphInstance(mesh.morph);
            if (mesh.weights) {
                for (var wi = 0; wi < mesh.weights.length; wi++) {
                    morphInstance.setWeight(wi, mesh.weights[wi]);
                }
            }

            meshInstance.morphInstance = morphInstance;
            model.morphInstances.push(morphInstance);
        }

        model.meshInstances.push(meshInstance);
    });

    return model;
};

var createCamera = function (gltfCamera, node) {
    var cameraProps = {
        enabled: false
    };

    if (gltfCamera.type === "orthographic") {
        const orthographic = gltfCamera.orthographic;
        const xMag = orthographic.xmag;
        const yMag = orthographic.ymag;
        const aspectRatio = xMag !== undefined ? xMag / yMag  : undefined;

        Object.assign(cameraProps, {
            projection: PROJECTION_ORTHOGRAPHIC,
            aspectRatioMode: aspectRatio !== undefined ? ASPECT_MANUAL : ASPECT_AUTO,
            aspectRatio: aspectRatio,
            orthoHeight: yMag,
            farClip: orthographic.zfar,
            nearClip: orthographic.znear
        });
    } else {
        const perspective = gltfCamera.perspective;
        const aspectRatio = perspective.aspectRatio;

        Object.assign(cameraProps, {
            projection: PROJECTION_PERSPECTIVE,
            aspectRatioMode: aspectRatio !== undefined ? ASPECT_MANUAL : ASPECT_AUTO,
            aspectRatio: aspectRatio,
            fov: perspective.yfov * math.RAD_TO_DEG,
            farClip: perspective.zfar,
            nearClip: perspective.znear
        });
    }

    return node.addComponent("camera", cameraProps);
};

var createLight = function (gltfLight, node) {
    var lightProps = {
        type: gltfLight.type,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED
    };

    if (gltfLight.hasOwnProperty('color')) {
        lightProps.color = new Color(...gltfLight.color);
    }

    if (gltfLight.hasOwnProperty('intensity')) {
        // TODO: Tweak intensity to match glTF specification. Point and spot lights use luminous
        // intensity in candela (lm/sr) while directional lights use illuminance in lux (lm/m2).
        lightProps.intensity = gltfLight.intensity;
    } else {
        lightProps.intensity = 1;
    }

    if (gltfLight.hasOwnProperty('range')) {
        lightProps.range = gltfLight.range;
    } else {
        // TODO: Better way of representing infinite range
        lightProps.range = 99999999;
    }

    if (gltfLight.hasOwnProperty('spot') && gltfLight.spot.hasOwnProperty('innerConeAngle')) {
        lightProps.innerConeAngle = gltfLight.spot.innerConeAngle * math.RAD_TO_DEG;
    } else {
        lightProps.innerConeAngle = 0;
    }

    if (gltfLight.hasOwnProperty('spot') && gltfLight.spot.hasOwnProperty('outerConeAngle')) {
        lightProps.outerConeAngle = gltfLight.spot.outerConeAngle * math.RAD_TO_DEG;
    }

    // Rotate to match light orientation in glTF specification
    const cameraNode = new Entity(node.name);
    cameraNode.rotateLocal(90, 0, 0);
    node.addChild(cameraNode);

    return cameraNode.addComponent("light", lightProps);
};

var createSkins = function (device, gltf, nodes, buffers) {
    if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
        return [];
    }
    return gltf.skins.map(function (gltfSkin) {
        return createSkin(device, gltfSkin, gltf.accessors, gltf.bufferViews, nodes, buffers);
    });
};

var createSkinInstances = function (skins) {
    return skins.map(function (skin) {
        var skinInstance = new SkinInstance(skin);
        skinInstance.bones = skin.bones;
        return skinInstance;
    });
};

var createMeshGroups = function (device, gltf, buffers, callback, disableFlipV) {
    if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 ||
        !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 ||
        !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
        return [];
    }

    return gltf.meshes.map(function (gltfMesh) {
        return createMeshGroup(device, gltfMesh, gltf.accessors, gltf.bufferViews, buffers, callback, disableFlipV);
    });
};

var createMaterials = function (gltf, textures, options, disableFlipV) {
    if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
        return [];
    }

    var preprocess = options && options.material && options.material.preprocess;
    var process = options && options.material && options.material.process || createMaterial;
    var postprocess = options && options.material && options.material.postprocess;

    return gltf.materials.map(function (gltfMaterial) {
        if (preprocess) {
            preprocess(gltfMaterial);
        }
        var material = process(gltfMaterial, textures, disableFlipV);
        if (postprocess) {
            postprocess(gltfMaterial, material);
        }
        return material;
    });
};

var createAnimations = function (gltf, nodes, nodeComponents, buffers, options) {
    if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
        return [];
    }

    var preprocess = options && options.animation && options.animation.preprocess;
    var postprocess = options && options.animation && options.animation.postprocess;

    return gltf.animations.map(function (gltfAnimation, index) {
        if (preprocess) {
            preprocess(gltfAnimation);
        }
        var animation = createAnimation(gltfAnimation, index, gltf.accessors, gltf.bufferViews, gltf.nodes, nodes, buffers);
        if (postprocess) {
            postprocess(gltfAnimation, animation.track);
        }

        // Animation components should be added to all root nodes targeted by an
        // animation track since the locator path in animation curves is relative
        // to its targets root node
        animation.targetRootNodes.forEach(function (rootNode) {
            if (!nodeComponents[rootNode]) {
                nodeComponents[rootNode] = {};
            }
            if (!nodeComponents[rootNode].animations) {
                nodeComponents[rootNode].animations = [];
            }
            nodeComponents[rootNode].animations.push(index);
        });

        return animation.track;
    });
};

var createNodes = function (gltf, options) {
    if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
        return [];
    }

    var preprocess = options && options.node && options.node.preprocess;
    var process = options && options.node && options.node.process || createNode;
    var postprocess = options && options.node && options.node.postprocess;

    var nodes = gltf.nodes.map(function (gltfNode, index) {
        if (preprocess) {
            preprocess(gltfNode);
        }
        var node = process(gltfNode, index);
        if (postprocess) {
            postprocess(gltfNode, node);
        }
        return node;
    });

    // build node hierarchy
    for (var i = 0; i < gltf.nodes.length; ++i) {
        var gltfNode = gltf.nodes[i];
        if (gltfNode.hasOwnProperty('children')) {
            for (var j = 0; j < gltfNode.children.length; ++j) {
                var parent = nodes[i];
                var child = nodes[gltfNode.children[j]];
                if (!child.parent) {
                    parent.addChild(child);
                }
            }
        }
    }

    return nodes;
};

var createEmptyNodeComponents = function (nodes) {
    return nodes.map(function () {
        return {
            animations: []
        };
    });
};

var createScenes = function (gltf, nodes, options) {
    if (!gltf.hasOwnProperty('scenes') || gltf.scenes.length === 0) {
        return [];
    }

    var preprocess = options && options.scene && options.scene.preprocess;
    var process = options && options.scene && options.scene.process || createScene;
    var postprocess = options && options.scene && options.scene.postprocess;

    return gltf.scenes.map(function (gltfScene, index) {
        if (preprocess) {
            preprocess(gltfScene);
        }
        var scene = process(gltfScene, index, nodes);
        if (postprocess) {
            postprocess(gltfScene, scene);
        }
        return scene;
    });
};

var getDefaultScene = function (gltf, scenes) {
    if (!gltf.hasOwnProperty('scene')) {
        if (scenes.length === 0) {
            return null;
        }
        return scenes[0];
    }

    return scenes[gltf.scene] || null;
};

var createModels = function (meshGroups, materials, defaultMaterial) {
    return meshGroups.map(function (meshGroup, meshGroupIndex) {
        return createModel('model_' + meshGroupIndex, meshGroup, materials, defaultMaterial);
    });
};

var createNodeModels = function (gltf, models, skins, skinInstances) {
    if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
        return [];
    }

    return gltf.nodes.map(function (gltfNode) {
        if (!gltfNode.hasOwnProperty('mesh')) {
            return null;
        }

        var model = models[gltfNode.mesh].clone();
        var skin = gltfNode.hasOwnProperty('skin') ? skins[gltfNode.skin] : null;
        var skinInstance = gltfNode.hasOwnProperty('skin') ? skinInstances[gltfNode.skin] : null;

        if (skin !== null && skinInstance !== null) {
            model.skinInstances = model.meshInstances.map(function (meshInstance) {
                meshInstance.mesh.skin = skin;
                meshInstance.skinInstance = skinInstance;
                return skinInstance;
            });
        }

        return model;
    });
};

var createCameras = function (gltf, nodes, options) {
    if (!gltf.hasOwnProperty('nodes') || !gltf.hasOwnProperty('cameras') || gltf.cameras.length === 0) {
        return [];
    }

    var preprocess = options && options.cameras && options.cameras.preprocess;
    var process = options && options.cameras && options.cameras.process || createCamera;
    var postprocess = options && options.cameras && options.cameras.postprocess;

    var cameras = [];

    gltf.nodes.forEach(function (gltfNode, nodeIndex) {
        if (!gltfNode.hasOwnProperty('camera')) {
            return;
        }
        var gltfCamera = gltf.cameras[gltfNode.camera];
        if (!gltfCamera) {
            return;
        }
        if (preprocess) {
            preprocess(gltfCamera);
        }
        var camera = process(gltfCamera, nodes[nodeIndex]);
        if (postprocess) {
            postprocess(gltfCamera, camera);
        }
        cameras.push(camera);
    });

    return cameras;
};

var createLights = function (gltf, nodes) {
    if (!gltf.hasOwnProperty('nodes') ||
        !gltf.hasOwnProperty('extensions') ||
        !gltf.extensions.hasOwnProperty('KHR_lights_punctual') ||
        !gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {
        return [];
    }

    var gltfLights = gltf.extensions.KHR_lights_punctual.lights;
    if (gltfLights.length === 0) {
        return [];
    }

    var lights = [];

    gltf.nodes.forEach(function (gltfNode, nodeIndex) {
        if (!gltfNode.hasOwnProperty('extensions') ||
            !gltfNode.extensions.hasOwnProperty('KHR_lights_punctual') ||
            !gltfNode.extensions.KHR_lights_punctual.hasOwnProperty('light')) {
            return;
        }

        var lightIndex = gltfNode.extensions.KHR_lights_punctual.light;
        var gltfLight = gltfLights[lightIndex];
        if (!gltfLight) {
            return;
        }

        lights.push(createLight(gltfLight, nodes[nodeIndex]));
    });

    return lights;
};

// create engine resources from the downloaded GLB data
var createResources = function (device, gltf, buffers, textures, defaultMaterial, options, callback) {

    var preprocess = options && options.global && options.global.preprocess;
    var postprocess = options && options.global && options.global.postprocess;

    if (preprocess) {
        preprocess(gltf);
    }

    // The original version of FACT generated incorrectly flipped V texture
    // coordinates. We must compensate by -not- flipping V in this case. Once
    // all models have been re-exported we can remove this flag.
    var disableFlipV = gltf.asset && gltf.asset.generator === 'PlayCanvas';

    var nodes = createNodes(gltf, options);
    var nodeComponents = createEmptyNodeComponents(nodes);
    var scenes = createScenes(gltf, nodes, options);
    var scene = getDefaultScene(gltf, scenes);
    var cameras = createCameras(gltf, nodes, options);
    var lights = createLights(gltf, nodes);
    var animations = createAnimations(gltf, nodes, nodeComponents, buffers, options);
    var materials = createMaterials(gltf, gltf.textures ? gltf.textures.map(function (t) {
        return textures[t.source].resource;
    }) : [], options, disableFlipV);
    var meshGroups = createMeshGroups(device, gltf, buffers, callback, disableFlipV);
    var skins = createSkins(device, gltf, nodes, buffers);
    var skinInstances = createSkinInstances(skins);
    var models = createModels(meshGroups, materials, defaultMaterial);
    var nodeModels = createNodeModels(gltf, models, skins, skinInstances);

    var result = {
        'nodes': nodes,
        'nodeComponents': nodeComponents,
        'models': models,
        'nodeModels': nodeModels,
        'animations': animations,
        'scenes': scenes,
        'scene': scene,
        'textures': textures,
        'materials': materials,
        'cameras': cameras,
        'lights': lights
    };

    if (postprocess) {
        postprocess(gltf, result);
    }

    callback(null, result);
};

var applySampler = function (texture, gltfSampler) {
    var defaultSampler = {
        magFilter: 9729,
        minFilter: 9987,
        wrapS: 10497,
        wrapT: 10497
    };

    var getFilter = function (filter) {
        switch (filter) {
            case 9728: return FILTER_NEAREST;
            case 9729: return FILTER_LINEAR;
            case 9984: return FILTER_NEAREST_MIPMAP_NEAREST;
            case 9985: return FILTER_LINEAR_MIPMAP_NEAREST;
            case 9986: return FILTER_NEAREST_MIPMAP_LINEAR;
            case 9987: return FILTER_LINEAR_MIPMAP_LINEAR;
            default:   return FILTER_LINEAR;
        }
    };

    var getWrap = function (wrap) {
        switch (wrap) {
            case 33071: return ADDRESS_CLAMP_TO_EDGE;
            case 33648: return ADDRESS_MIRRORED_REPEAT;
            case 10497: return ADDRESS_REPEAT;
            default:    return ADDRESS_REPEAT;
        }
    };

    if (texture) {
        gltfSampler = gltfSampler || defaultSampler;
        texture.minFilter = getFilter(gltfSampler.minFilter);
        texture.magFilter = getFilter(gltfSampler.magFilter);
        texture.addressU = getWrap(gltfSampler.wrapS);
        texture.addressV = getWrap(gltfSampler.wrapT);
    }
};

// load textures using the asset system
var loadTexturesAsync = function (gltf, buffers, urlBase, registry, options, callback) {
    var result = [];

    if (!gltf.hasOwnProperty('images') || gltf.images.length === 0 ||
        !gltf.hasOwnProperty('textures') || gltf.textures.length === 0) {
        callback(null, result);
        return;
    }

    var preprocess = options && options.texture && options.texture.preprocess;
    var processAsync = options && options.texture && options.texture.processAsync;
    var postprocess = options && options.texture && options.texture.postprocess;

    var remaining = gltf.images.length;
    var onLoad = function (index, textureAsset) {
        result[index] = textureAsset;
        if (postprocess) {
            postprocess(gltf.images[index], textureAsset);
        }
        if (--remaining === 0) {
            // apply samplers
            for (var t = 0; t < gltf.textures.length; ++t) {
                var texture = gltf.textures[t];
                applySampler(result[texture.source].resource, (gltf.samplers || [])[texture.sampler]);
            }

            callback(null, result);
        }
    };

    var loadTexture = function (index, url, mimeType, crossOrigin, isBlobUrl) {
        var mimeTypeFileExtensions = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/basis': 'basis',
            'image/ktx': 'ktx',
            'image/vnd-ms.dds': 'dds'
        };

        // construct the asset file
        var file = { url: url };
        if (mimeType) {
            var extension = mimeTypeFileExtensions[mimeType];
            if (extension) {
                file.filename = 'glb-texture-' + index + '.' + extension;
            }
        }

        // create and load the asset
        var asset = new Asset('texture_' + index, 'texture',  file, null, { crossOrigin: crossOrigin });
        asset.on('load', function () {
            if (isBlobUrl) {
                URL.revokeObjectURL(url);
            }
            onLoad(index, asset);
        });
        asset.on('error', function (err, asset) {
            callback(err);
        });
        registry.add(asset);
        registry.load(asset);
    };

    for (var i = 0; i < gltf.images.length; ++i) {
        var gltfImage = gltf.images[i];

        if (preprocess) {
            preprocess(gltfImage);
        }

        if (gltfImage.hasOwnProperty('uri')) {
            // uri specified
            if (isDataURI(gltfImage.uri)) {
                loadTexture(i, gltfImage.uri, getDataURIMimeType(gltfImage.uri));
            } else {
                if (processAsync) {
                    processAsync(gltfImage, function (index, err, textureAsset) {
                        if (err) {
                            callback(err);
                        } else {
                            onLoad(index, textureAsset);
                        }
                    }.bind(null, i));
                } else {
                    loadTexture(i, path.join(urlBase, gltfImage.uri).replace(registry.prefix, ""), null, "anonymous");
                }
            }
        } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
            // bufferview
            var bufferView = gltf.bufferViews[gltfImage.bufferView];
            var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
            var byteLength = bufferView.byteLength;

            var buffer = buffers[bufferView.buffer];
            var imageBuffer = new Uint8Array(buffer.buffer, buffer.byteOffset + byteOffset, byteLength);
            var blob = new Blob([imageBuffer], { type: gltfImage.mimeType });
            loadTexture(i, URL.createObjectURL(blob), gltfImage.mimeType, null, true);
        } else {
            // fail
            callback("Invalid image found in gltf (neither uri or bufferView found). index=" + i);
            return;
        }
    }
};

// load gltf buffers asynchronously, returning them in the callback
var loadBuffersAsync = function (gltf, binaryChunk, urlBase, options, callback) {
    var result = [];

    if (gltf.buffers === null || gltf.buffers.length === 0) {
        callback(null, result);
        return;
    }

    var preprocess = options && options.buffer && options.buffer.preprocess;
    var processAsync = options && options.buffer && options.buffer.processAsync;
    var postprocess = options && options.buffer && options.buffer.postprocess;

    var remaining = gltf.buffers.length;
    var onLoad = function (index, buffer) {
        result[index] = buffer;
        if (postprocess) {
            postprocess(gltf.buffers[index], buffer);
        }
        if (--remaining === 0) {
            callback(null, result);
        }
    };

    for (var i = 0; i < gltf.buffers.length; ++i) {
        var gltfBuffer = gltf.buffers[i];

        if (preprocess) {
            preprocess(gltfBuffer);
        }

        if (gltfBuffer.hasOwnProperty('uri')) {
            if (isDataURI(gltfBuffer.uri)) {
                // convert base64 to raw binary data held in a string
                // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                var byteString = atob(gltfBuffer.uri.split(',')[1]);

                // write the bytes of the string to an ArrayBuffer
                var arrayBuffer = new ArrayBuffer(byteString.length);

                // create a view into the buffer
                var binaryArray = new Uint8Array(arrayBuffer);

                // set the bytes of the buffer to the correct values
                for (var j = 0; j < byteString.length; j++) {
                    binaryArray[j] = byteString.charCodeAt(j);
                }

                onLoad(i, binaryArray);
            } else {
                if (processAsync) {
                    processAsync(gltfBuffer, function (index, err, arrayBuffer) {           // eslint-disable-line no-loop-func
                        if (err) {
                            callback(err);
                        } else {
                            onLoad(index, new Uint8Array(arrayBuffer));
                        }
                    }.bind(null, i));
                } else {
                    http.get(
                        path.join(urlBase, gltfBuffer.uri),
                        { cache: true, responseType: 'arraybuffer', retry: false },
                        function (index, err, result) {                         // eslint-disable-line no-loop-func
                            if (err) {
                                callback(err);
                            } else {
                                onLoad(index, new Uint8Array(result));
                            }
                        }.bind(null, i)
                    );
                }
            }
        } else {
            // glb buffer reference
            onLoad(i, binaryChunk);
        }
    }
};

// parse the gltf chunk, returns the gltf json
var parseGltf = function (gltfChunk, callback) {
    var decodeBinaryUtf8 = function (array) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(array);
        }

        var str = "";
        for (var i = 0; i < array.length; i++) {
            str += String.fromCharCode(array[i]);
        }

        return decodeURIComponent(escape(str));
    };

    var gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));

    // check gltf version
    if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
        callback("Invalid gltf version. Expected version 2.0 or above but found version '" + gltf.asset.version + "'.");
        return;
    }

    callback(null, gltf);
};

// parse glb data, returns the gltf and binary chunk
var parseGlb = function (glbData, callback) {
    var data = new DataView(glbData);

    // read header
    var magic = data.getUint32(0, true);
    var version = data.getUint32(4, true);
    var length = data.getUint32(8, true);

    if (magic !== 0x46546C67) {
        callback("Invalid magic number found in glb header. Expected 0x46546C67, found 0x" + magic.toString(16));
        return;
    }

    if (version !== 2) {
        callback("Invalid version number found in glb header. Expected 2, found " + version);
        return;
    }

    if (length <= 0 || length > glbData.byteLength) {
        callback("Invalid length found in glb header. Found " + length);
        return;
    }

    // read chunks
    var chunks = [];
    var offset = 12;
    while (offset < length) {
        var chunkLength = data.getUint32(offset, true);
        if (offset + chunkLength + 8 > glbData.byteLength) {
            throw new Error("Invalid chunk length found in glb. Found " + chunkLength);
        }
        var chunkType = data.getUint32(offset + 4, true);
        var chunkData = new Uint8Array(glbData, offset + 8, chunkLength);
        chunks.push( { length: chunkLength, type: chunkType, data: chunkData } );
        offset += chunkLength + 8;
    }

    if (chunks.length !== 1 && chunks.length !== 2) {
        callback("Invalid number of chunks found in glb file.");
        return;
    }

    if (chunks[0].type !== 0x4E4F534A) {
        callback("Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x" + chunks[0].type.toString(16));
        return;
    }

    if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
        callback("Invalid chunk type found in glb file. Expected 0x004E4942, found 0x" + chunks[1].type.toString(16));
        return;
    }

    callback(null, {
        gltfChunk: chunks[0].data,
        binaryChunk: chunks.length === 2 ? chunks[1].data : null
    });
};

// parse the chunk of data, which can be glb or gltf
var parseChunk = function (filename, data, callback) {
    if (filename && filename.toLowerCase().endsWith('.glb')) {
        parseGlb(data, callback);
    } else {
        callback(null, {
            gltfChunk: data,
            binaryChunk: null
        });
    }
};

// -- GlbParser

function GlbParser() {}

// parse the gltf or glb data asynchronously, loading external resources
GlbParser.parseAsync = function (filename, urlBase, data, device, defaultMaterial, registry, options, callback) {
    // parse the data
    parseChunk(filename, data, function (err, chunks) {
        if (err) {
            callback(err);
            return;
        }

        // parse gltf
        parseGltf(chunks.gltfChunk, function (err, gltf) {
            if (err) {
                callback(err);
                return;
            }

            // async load external buffers
            loadBuffersAsync(gltf, chunks.binaryChunk, urlBase, options, function (err, buffers) {
                if (err) {
                    callback(err);
                    return;
                }

                // async load images
                loadTexturesAsync(gltf, buffers, urlBase, registry, options, function (err, textures) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    createResources(device, gltf, buffers, textures, defaultMaterial, options, callback);
                });
            });
        });
    });
};

// parse the gltf or glb data synchronously. external resources (buffers and images) are ignored.
GlbParser.parse = function (filename, data, device, defaultMaterial, options) {
    var result = null;

    // parse the data
    parseChunk(filename, data, function (err, chunks) {
        if (err) {
            console.error(err);
        } else {
            // parse gltf
            parseGltf(chunks.gltfChunk, function (err, gltf) {
                if (err) {
                    console.error(err);
                } else {
                    var buffers = [chunks.binaryChunk];
                    var textures = [];

                    // create resources
                    createResources(device, gltf, buffers, textures, defaultMaterial, options || { }, function (err, result_) {
                        if (err) {
                            console.error(err);
                        } else {
                            result = result_;
                        }
                    });
                }
            });
        }
    });

    return result;
};

export { GlbParser };
