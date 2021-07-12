import { path } from '../../core/path.js';

import { http } from '../../net/http.js';

import { math } from '../../math/math.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';
import { Color } from '../../math/color.js';

import { BoundingBox } from '../../shape/bounding-box.js';

import {
    typedArrayTypes, typedArrayTypesByteSize,
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT,
    BUFFER_STATIC,
    CULLFACE_NONE, CULLFACE_BACK,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR,
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINES, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP,
    SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1,
    TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32
} from '../../graphics/constants.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { Texture } from '../../graphics/texture.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';

import {
    BLEND_NONE, BLEND_NORMAL, LIGHTFALLOFF_INVERSESQUARED
} from '../../scene/constants.js';
import { calculateNormals } from '../../scene/procedural.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { Render } from '../../scene/render.js';

import { Entity } from '../../framework/entity.js';

import { AnimCurve } from '../../anim/evaluator/anim-curve.js';
import { AnimData } from '../../anim/evaluator/anim-data.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { AnimBinder } from '../../anim/binder/anim-binder.js';

import { INTERPOLATION_CUBIC, INTERPOLATION_LINEAR, INTERPOLATION_STEP } from '../../anim/constants.js';

import { Asset } from '../../asset/asset.js';

const isDataURI = function (uri) {
    return /^data:.*,.*$/i.test(uri);
};

const getDataURIMimeType = function (uri) {
    return uri.substring(uri.indexOf(":") + 1, uri.indexOf(";"));
};

const getNumComponents = function (accessorType) {
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

const getComponentType = function (componentType) {
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

const getComponentSizeInBytes = function (componentType) {
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

const getComponentDataType = function (componentType) {
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

const gltfToEngineSemanticMap = {
    'POSITION': SEMANTIC_POSITION,
    'NORMAL': SEMANTIC_NORMAL,
    'TANGENT': SEMANTIC_TANGENT,
    'COLOR_0': SEMANTIC_COLOR,
    'JOINTS_0': SEMANTIC_BLENDINDICES,
    'WEIGHTS_0': SEMANTIC_BLENDWEIGHT,
    'TEXCOORD_0': SEMANTIC_TEXCOORD0,
    'TEXCOORD_1': SEMANTIC_TEXCOORD1
};

// get accessor data, making a copy and patching in the case of a sparse accessor
const getAccessorData = function (gltfAccessor, bufferViews) {
    const numComponents = getNumComponents(gltfAccessor.type);
    const dataType = getComponentDataType(gltfAccessor.componentType);
    if (!dataType) {
        return null;
    }
    let result;

    if (gltfAccessor.sparse) {
        // handle sparse data
        const sparse = gltfAccessor.sparse;

        // get indices data
        const indicesAccessor = {
            count: sparse.count,
            type: "SCALAR"
        };
        const indices = getAccessorData(Object.assign(indicesAccessor, sparse.indices), bufferViews);

        // data values data
        const valuesAccessor = {
            count: sparse.count,
            type: gltfAccessor.scalar,
            componentType: gltfAccessor.componentType
        };
        const values = getAccessorData(Object.assign(valuesAccessor, sparse.values), bufferViews);

        // get base data
        if (gltfAccessor.hasOwnProperty('bufferView')) {
            const baseAccessor = {
                bufferView: gltfAccessor.bufferView,
                byteOffset: gltfAccessor.byteOffset,
                componentType: gltfAccessor.componentType,
                count: gltfAccessor.count,
                type: gltfAccessor.type
            };
            // make a copy of the base data since we'll patch the values
            result = getAccessorData(baseAccessor, bufferViews).slice();
        } else {
            // there is no base data, create empty 0'd out data
            result = new dataType(gltfAccessor.count * numComponents);
        }

        for (let i = 0; i < sparse.count; ++i) {
            const targetIndex = indices[i];
            for (let j = 0; j < numComponents; ++j) {
                result[targetIndex * numComponents + j] = values[i * numComponents + j];
            }
        }
    } else {
        const bufferView = bufferViews[gltfAccessor.bufferView];
        result = new dataType(bufferView.buffer,
                              bufferView.byteOffset + (gltfAccessor.byteOffset || 0),
                              gltfAccessor.count * numComponents);
    }

    return result;
};

const getPrimitiveType = function (primitive) {
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

const generateIndices = function (numVertices) {
    const dummyIndices = new Uint16Array(numVertices);
    for (let i = 0; i < numVertices; i++) {
        dummyIndices[i] = i;
    }
    return dummyIndices;
};

const generateNormals = function (sourceDesc, indices) {
    // get positions
    const p = sourceDesc[SEMANTIC_POSITION];
    if (!p || p.components !== 3) {
        return;
    }

    let positions;
    if (p.size !== p.stride) {
        // extract positions which aren't tightly packed
        const srcStride = p.stride / typedArrayTypesByteSize[p.type];
        const src = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * srcStride);
        positions = new typedArrayTypes[p.type](p.count * 3);
        for (let i = 0; i < p.count; ++i) {
            positions[i * 3 + 0] = src[i * srcStride + 0];
            positions[i * 3 + 1] = src[i * srcStride + 1];
            positions[i * 3 + 2] = src[i * srcStride + 2];
        }
    } else {
        // position data is tightly packed so we can use it directly
        positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
    }

    const numVertices = p.count;

    // generate indices if necessary
    if (!indices) {
        indices = generateIndices(numVertices);
    }

    // generate normals
    const normalsTemp = calculateNormals(positions, indices);
    const normals = new Float32Array(normalsTemp.length);
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

const flipTexCoordVs = function (vertexBuffer) {
    let i, j;

    const floatOffsets = [];
    const shortOffsets = [];
    const byteOffsets = [];
    for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
        const element = vertexBuffer.format.elements[i];
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

    const flip = function (offsets, type, one) {
        const typedArray = new type(vertexBuffer.storage);
        for (i = 0; i < offsets.length; ++i) {
            let index = offsets[i].offset;
            const stride = offsets[i].stride;
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

// given a texture, clone it
// NOTE: CPU-side texture data will be shared but GPU memory will be duplicated
const cloneTexture = function (texture) {
    const shallowCopyLevels = function (texture) {
        const result = [];
        for (let mip = 0; mip < texture._levels.length; ++mip) {
            let level = [];
            if (texture.cubemap) {
                for (let face = 0; face < 6; ++face) {
                    level.push(texture._levels[mip][face]);
                }
            } else {
                level = texture._levels[mip];
            }
            result.push(level);
        }
        return result;
    };

    const result = new Texture(texture.device, texture);   // duplicate texture
    result._levels = shallowCopyLevels(texture);            // shallow copy the levels structure
    return result;
};

// given a texture asset, clone it
const cloneTextureAsset = function (src) {
    const result = new Asset(src.name + '_clone',
                             src.type,
                             src.file,
                             src.data,
                             src.options);
    result.loaded = true;
    result.resource = cloneTexture(src.resource);
    src.registry.add(result);
    return result;
};

const createVertexBufferInternal = function (device, sourceDesc, disableFlipV) {
    const positionDesc = sourceDesc[SEMANTIC_POSITION];
    if (!positionDesc) {
        // ignore meshes without positions
        return null;
    }
    const numVertices = positionDesc.count;

    // generate vertexDesc elements
    const vertexDesc = [];
    for (const semantic in sourceDesc) {
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
    const elementOrder = [
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
        const lhsOrder = elementOrder.indexOf(lhs.semantic);
        const rhsOrder = elementOrder.indexOf(rhs.semantic);
        return (lhsOrder < rhsOrder) ? -1 : (rhsOrder < lhsOrder ? 1 : 0);
    });

    let i, j, k;
    let source, target, sourceOffset;

    const vertexFormat = new VertexFormat(device, vertexDesc);

    // check whether source data is correctly interleaved
    let isCorrectlyInterleaved = true;
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
    const vertexBuffer = new VertexBuffer(device,
                                          vertexFormat,
                                          numVertices,
                                          BUFFER_STATIC);

    const vertexData = vertexBuffer.lock();
    const targetArray = new Uint32Array(vertexData);
    let sourceArray;

    if (isCorrectlyInterleaved) {
        // copy data
        sourceArray = new Uint32Array(positionDesc.buffer,
                                      positionDesc.offset,
                                      numVertices * vertexBuffer.format.size / 4);
        targetArray.set(sourceArray);
    } else {
        let targetStride, sourceStride;
        // copy data and interleave
        for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
            target = vertexBuffer.format.elements[i];
            targetStride = target.stride / 4;

            source = sourceDesc[target.name];
            sourceStride = source.stride / 4;
            // ensure we don't go beyond the end of the arraybuffer when dealing with
            // interlaced vertex formats
            sourceArray = new Uint32Array(source.buffer, source.offset, (source.count - 1) * sourceStride + source.size / 4);

            let src = 0;
            let dst = target.offset / 4;
            const kend = Math.floor((source.size + 3) / 4);
            for (j = 0; j < numVertices; ++j) {
                for (k = 0; k < kend; ++k) {
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

const createVertexBuffer = function (device, attributes, indices, accessors, bufferViews, disableFlipV, vertexBufferDict) {

    // extract list of attributes to use
    const useAttributes = {};
    const attribIds = [];

    for (const attrib in attributes) {
        if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
            useAttributes[attrib] = attributes[attrib];

            // build unique id for each attribute in format: Semantic:accessorIndex
            attribIds.push(attrib + ":" + attributes[attrib]);
        }
    }

    // sort unique ids and create unique vertex buffer ID
    attribIds.sort();
    const vbKey = attribIds.join();

    // return already created vertex buffer if identical
    let vb = vertexBufferDict[vbKey];
    if (!vb) {
        // build vertex buffer format desc and source
        const sourceDesc = {};
        for (const attrib in useAttributes) {
            const accessor = accessors[attributes[attrib]];
            const accessorData = getAccessorData(accessor, bufferViews);
            const bufferView = bufferViews[accessor.bufferView];
            const semantic = gltfToEngineSemanticMap[attrib];
            const size = getNumComponents(accessor.type) * getComponentSizeInBytes(accessor.componentType);
            const stride = bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size;
            sourceDesc[semantic] = {
                buffer: accessorData.buffer,
                size: size,
                offset: accessorData.byteOffset,
                stride: stride,
                count: accessor.count,
                components: getNumComponents(accessor.type),
                type: getComponentType(accessor.componentType),
                normalize: accessor.normalized
            };
        }

        // generate normals if they're missing (this should probably be a user option)
        if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
            generateNormals(sourceDesc, indices);
        }

        // create and store it in the dictionary
        vb = createVertexBufferInternal(device, sourceDesc, disableFlipV);
        vertexBufferDict[vbKey] = vb;
    }

    return vb;
};

const createVertexBufferDraco = function (device, outputGeometry, extDraco, decoder, decoderModule, indices, disableFlipV) {

    const numPoints = outputGeometry.num_points();

    // helper function to decode data stream with id to TypedArray of appropriate type
    const extractDracoAttributeInfo = function (uniqueId) {
        const attribute = decoder.GetAttributeByUniqueId(outputGeometry, uniqueId);
        const numValues = numPoints * attribute.num_components();
        const dracoFormat = attribute.data_type();
        let ptr, values, componentSizeInBytes, storageType;

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
    const sourceDesc = {};
    const attributes = extDraco.attributes;
    for (const attrib in attributes) {
        if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
            const semantic = gltfToEngineSemanticMap[attrib];
            const attributeInfo = extractDracoAttributeInfo(attributes[attrib]);

            // store the info we'll need to copy this data into the vertex buffer
            const size = attributeInfo.numComponents * attributeInfo.componentSizeInBytes;
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

const createSkin = function (device, gltfSkin, accessors, bufferViews, nodes, glbSkins) {
    let i, j, bindMatrix;
    const joints = gltfSkin.joints;
    const numJoints = joints.length;
    const ibp = [];
    if (gltfSkin.hasOwnProperty('inverseBindMatrices')) {
        const inverseBindMatrices = gltfSkin.inverseBindMatrices;
        const ibmData = getAccessorData(accessors[inverseBindMatrices], bufferViews);
        const ibmValues = [];

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

    const boneNames = [];
    for (i = 0; i < numJoints; i++) {
        boneNames[i] = nodes[joints[i]].name;
    }

    // create a cache key from bone names and see if we have matching skin
    const key = boneNames.join("#");
    let skin = glbSkins.get(key);
    if (!skin) {

        // create the skin and add it to the cache
        skin = new Skin(device, ibp, boneNames);
        glbSkins.set(key, skin);
    }

    return skin;
};

const tempMat = new Mat4();
const tempVec = new Vec3();

const createMesh = function (device, gltfMesh, accessors, bufferViews, callback, disableFlipV, vertexBufferDict) {
    const meshes = [];

    gltfMesh.primitives.forEach(function (primitive) {

        let primitiveType, vertexBuffer, numIndices;
        let indices = null;
        let canUseMorph = true;

        // try and get draco compressed data first
        if (primitive.hasOwnProperty('extensions')) {
            const extensions = primitive.extensions;
            if (extensions.hasOwnProperty('KHR_draco_mesh_compression')) {

                // access DracoDecoderModule
                const decoderModule = window.DracoDecoderModule;
                if (decoderModule) {
                    const extDraco = extensions.KHR_draco_mesh_compression;
                    if (extDraco.hasOwnProperty('attributes')) {
                        const uint8Buffer = bufferViews[extDraco.bufferView];
                        const buffer = new decoderModule.DecoderBuffer();
                        buffer.Init(uint8Buffer, uint8Buffer.length);

                        const decoder = new decoderModule.Decoder();
                        const geometryType = decoder.GetEncodedGeometryType(buffer);

                        let outputGeometry, status;
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
                            (status ? status.error_msg() : ('Mesh asset - invalid draco compressed geometry type: ' + geometryType)));
                            return;
                        }

                        // indices
                        const numFaces = outputGeometry.num_faces();
                        if (geometryType === decoderModule.TRIANGULAR_MESH) {
                            const bit32 = outputGeometry.num_points() > 65535;

                            numIndices = numFaces * 3;
                            const dataSize = numIndices * (bit32 ? 4 : 2);
                            const ptr = decoderModule._malloc(dataSize);

                            if (bit32) {
                                decoder.GetTrianglesUInt32Array(outputGeometry, dataSize, ptr);
                                indices = new Uint32Array(decoderModule.HEAPU32.buffer, ptr, numIndices).slice();
                            } else {
                                decoder.GetTrianglesUInt16Array(outputGeometry, dataSize, ptr);
                                indices = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numIndices).slice();
                            }

                            decoderModule._free(ptr);
                        }

                        // vertices
                        vertexBuffer = createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, indices, disableFlipV);

                        // clean up
                        decoderModule.destroy(outputGeometry);
                        decoderModule.destroy(decoder);
                        decoderModule.destroy(buffer);

                        // morph streams are not compatible with draco compression, disable morphing
                        canUseMorph = false;
                    }
                } else {
                    // #if _DEBUG
                    console.warn("File contains draco compressed data, but DracoDecoderModule is not configured.");
                    // #endif
                }
            }
        }

        // if mesh was not constructed from draco data, use uncompressed
        if (!vertexBuffer) {
            indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews) : null;
            vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, disableFlipV, vertexBufferDict);
            primitiveType = getPrimitiveType(primitive);
        }

        let mesh = null;
        if (vertexBuffer) {
            // build the mesh
            mesh = new Mesh(device);
            mesh.vertexBuffer = vertexBuffer;
            mesh.primitive[0].type = primitiveType;
            mesh.primitive[0].base = 0;
            mesh.primitive[0].indexed = (indices !== null);

            // index buffer
            if (indices !== null) {
                let indexFormat;
                if (indices instanceof Uint8Array) {
                    indexFormat = INDEXFORMAT_UINT8;
                } else if (indices instanceof Uint16Array) {
                    indexFormat = INDEXFORMAT_UINT16;
                } else {
                    indexFormat = INDEXFORMAT_UINT32;
                }

                // 32bit index buffer is used but not supported
                if (indexFormat === INDEXFORMAT_UINT32 && !device.extUintElement) {

                    // #if _DEBUG
                    if (vertexBuffer.numVertices > 0xFFFF) {
                        console.warn("Glb file contains 32bit index buffer but these are not supported by this device - it may be rendered incorrectly.");
                    }
                    // #endif

                    // convert to 16bit
                    indexFormat = INDEXFORMAT_UINT16;
                    indices = new Uint16Array(indices);
                }

                const indexBuffer = new IndexBuffer(device, indexFormat, indices.length, BUFFER_STATIC, indices);
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].count = indices.length;
            } else {
                mesh.primitive[0].count = vertexBuffer.numVertices;
            }

            // TODO: Refactor, we should not store temporary data on the mesh.
            // The container should store some mapping table instead.
            mesh.materialIndex = primitive.material;

            let accessor = accessors[primitive.attributes.POSITION];
            const min = accessor.min;
            const max = accessor.max;
            const aabb = new BoundingBox(
                new Vec3((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2),
                new Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2)
            );
            mesh.aabb = aabb;

            // morph targets
            if (canUseMorph && primitive.hasOwnProperty('targets')) {
                const targets = [];

                primitive.targets.forEach(function (target, index) {
                    const options = {};

                    if (target.hasOwnProperty('POSITION')) {
                        accessor = accessors[target.POSITION];
                        options.deltaPositions = getAccessorData(accessor, bufferViews);
                        options.deltaPositionsType = getComponentType(accessor.componentType);
                        if (accessor.hasOwnProperty('min') && accessor.hasOwnProperty('max')) {
                            options.aabb = new BoundingBox();
                            options.aabb.setMinMax(new Vec3(accessor.min), new Vec3(accessor.max));
                        }
                    }

                    if (target.hasOwnProperty('NORMAL')) {
                        accessor = accessors[target.NORMAL];
                        options.deltaNormals = getAccessorData(accessor, bufferViews);
                        options.deltaNormalsType = getComponentType(accessor.componentType);
                    }

                    // name if specified
                    if (gltfMesh.hasOwnProperty('extras') &&
                        gltfMesh.extras.hasOwnProperty('targetNames')) {
                        options.name = gltfMesh.extras.targetNames[index];
                    } else {
                        options.name = index.toString(10);
                    }

                    // default weight if specified
                    if (gltfMesh.hasOwnProperty('weights')) {
                        options.defaultWeight = gltfMesh.weights[index];
                    }

                    targets.push(new MorphTarget(options));
                });

                mesh.morph = new Morph(targets, device);
            }
        }

        meshes.push(mesh);
    });

    return meshes;
};

const createMaterial = function (gltfMaterial, textures, disableFlipV) {
    // TODO: integrate these shader chunks into the native engine
    const glossChunk = [
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

    const specularChunk = [
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

    const clearCoatGlossChunk = [
        "#ifdef MAPFLOAT",
        "uniform float material_clearCoatGlossiness;",
        "#endif",
        "",
        "#ifdef MAPTEXTURE",
        "uniform sampler2D texture_clearCoatGlossMap;",
        "#endif",
        "",
        "void getClearCoatGlossiness() {",
        "    ccGlossiness = 1.0;",
        "",
        "#ifdef MAPFLOAT",
        "    ccGlossiness *= material_clearCoatGlossiness;",
        "#endif",
        "",
        "#ifdef MAPTEXTURE",
        "    ccGlossiness *= texture2D(texture_clearCoatGlossMap, $UV).$CH;",
        "#endif",
        "",
        "#ifdef MAPVERTEX",
        "    ccGlossiness *= saturate(vVertexColor.$VC);",
        "#endif",
        "",
        "    ccGlossiness = 1.0 - ccGlossiness;",
        "",
        "    ccGlossiness += 0.0000001;",
        "}"
    ].join('\n');

    const uvONE = [1, 1];
    const uvZERO = [0, 0];

    const extractTextureTransform = function (source, material, maps) {
        let map;

        const texCoord = source.texCoord;
        if (texCoord) {
            for (map = 0; map < maps.length; ++map) {
                material[maps[map] + 'MapUv'] = texCoord;
            }
        }

        let scale = uvONE;
        let offset = uvZERO;

        const extensions = source.extensions;
        if (extensions) {
            const textureTransformData = extensions.KHR_texture_transform;
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

    const material = new StandardMaterial();

    // glTF dooesn't define how to occlude specular
    material.occludeSpecular = true;

    material.diffuseTint = true;
    material.diffuseVertexColor = true;

    material.specularTint = true;
    material.specularVertexColor = true;

    if (gltfMaterial.hasOwnProperty('name')) {
        material.name = gltfMaterial.name;
    }

    let color, texture;
    if (gltfMaterial.hasOwnProperty('extensions') &&
        gltfMaterial.extensions.hasOwnProperty('KHR_materials_pbrSpecularGlossiness')) {
        const specData = gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness;

        if (specData.hasOwnProperty('diffuseFactor')) {
            color = specData.diffuseFactor;
            // Convert from linear space to sRGB space
            material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
            material.opacity = color[3];
        } else {
            material.diffuse.set(1, 1, 1);
            material.opacity = 1;
        }
        if (specData.hasOwnProperty('diffuseTexture')) {
            const diffuseTexture = specData.diffuseTexture;
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
            const specularGlossinessTexture = specData.specularGlossinessTexture;
            material.specularMap = material.glossMap = textures[specularGlossinessTexture.index];
            material.specularMapChannel = 'rgb';
            material.glossMapChannel = 'a';

            extractTextureTransform(specularGlossinessTexture, material, ['gloss', 'metalness']);
        }

        material.chunks.specularPS = specularChunk;

    } else if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
        const pbrData = gltfMaterial.pbrMetallicRoughness;

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
            const baseColorTexture = pbrData.baseColorTexture;
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
            const metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
            material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
            material.metalnessMapChannel = 'b';
            material.glossMapChannel = 'g';

            extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
        }

        material.chunks.glossPS = glossChunk;
    }

    if (gltfMaterial.hasOwnProperty('normalTexture')) {
        const normalTexture = gltfMaterial.normalTexture;
        material.normalMap = textures[normalTexture.index];

        extractTextureTransform(normalTexture, material, ['normal']);

        if (normalTexture.hasOwnProperty('scale')) {
            material.bumpiness = normalTexture.scale;
        }
    }
    if (gltfMaterial.hasOwnProperty('occlusionTexture')) {
        const occlusionTexture = gltfMaterial.occlusionTexture;
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
        const emissiveTexture = gltfMaterial.emissiveTexture;
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

    if (gltfMaterial.hasOwnProperty('extensions') &&
        gltfMaterial.extensions.hasOwnProperty('KHR_materials_clearcoat')) {
        const ccData = gltfMaterial.extensions.KHR_materials_clearcoat;

        if (ccData.hasOwnProperty('clearcoatFactor')) {
            material.clearCoat = ccData.clearcoatFactor * 0.25; // TODO: remove temporary workaround for replicating glTF clear-coat visuals
        } else {
            material.clearCoat = 0;
        }
        if (ccData.hasOwnProperty('clearcoatTexture')) {
            const clearcoatTexture = ccData.clearcoatTexture;
            material.clearCoatMap = textures[clearcoatTexture.index];
            material.clearCoatMapChannel = 'r';

            extractTextureTransform(clearcoatTexture, material, ['clearCoat']);
        }
        if (ccData.hasOwnProperty('clearcoatRoughnessFactor')) {
            material.clearCoatGlossiness = ccData.clearcoatRoughnessFactor;
        } else {
            material.clearCoatGlossiness = 0;
        }
        if (ccData.hasOwnProperty('clearcoatRoughnessTexture')) {
            const clearcoatRoughnessTexture = ccData.clearcoatRoughnessTexture;
            material.clearCoatGlossMap = textures[clearcoatRoughnessTexture.index];
            material.clearCoatGlossMapChannel = 'g';

            extractTextureTransform(clearcoatRoughnessTexture, material, ['clearCoatGloss']);
        }
        if (ccData.hasOwnProperty('clearcoatNormalTexture')) {
            const clearcoatNormalTexture = ccData.clearcoatNormalTexture;
            material.clearCoatNormalMap = textures[clearcoatNormalTexture.index];

            extractTextureTransform(clearcoatNormalTexture, material, ['clearCoatNormal']);

            if (clearcoatNormalTexture.hasOwnProperty('scale')) {
                material.clearCoatBumpiness = clearcoatNormalTexture.scale;
            }
        }

        material.chunks.clearCoatGlossPS = clearCoatGlossChunk;
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
const createAnimation = function (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes) {

    // create animation data block for the accessor
    const createAnimData = function (gltfAccessor) {
        const data = getAccessorData(gltfAccessor, bufferViews);
        // TODO: this assumes data is tightly packed, handle the case data is interleaved
        return new AnimData(getNumComponents(gltfAccessor.type), new data.constructor(data));
    };

    const interpMap = {
        "STEP": INTERPOLATION_STEP,
        "LINEAR": INTERPOLATION_LINEAR,
        "CUBICSPLINE": INTERPOLATION_CUBIC
    };

    const inputMap = { };
    const inputs = [];

    const outputMap = { };
    const outputs = [];

    const curves = [];

    let i;

    // convert samplers
    for (i = 0; i < gltfAnimation.samplers.length; ++i) {
        const sampler = gltfAnimation.samplers[i];

        // get input data
        if (!inputMap.hasOwnProperty(sampler.input)) {
            inputMap[sampler.input] = inputs.length;
            inputs.push(createAnimData(gltfAccessors[sampler.input]));
        }

        // get output data
        if (!outputMap.hasOwnProperty(sampler.output)) {
            outputMap[sampler.output] = outputs.length;
            outputs.push(createAnimData(gltfAccessors[sampler.output]));
        }

        const interpolation =
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

    const quatArrays = [];

    const transformSchema = {
        'translation': 'localPosition',
        'rotation': 'localRotation',
        'scale': 'localScale',
        'weights': 'weights'
    };

    // convert anim channels
    for (i = 0; i < gltfAnimation.channels.length; ++i) {
        const channel = gltfAnimation.channels[i];
        const target = channel.target;
        const curve = curves[channel.sampler];

        const node = nodes[target.node];
        const entityPath = [nodes[0].name, ...AnimBinder.splitPath(node.path, '/')];
        curve._paths.push({
            entityPath: entityPath,
            component: 'graph',
            propertyPath: [transformSchema[target.path]]
        });

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
    let prevIndex = null;
    let data;
    for (i = 0; i < quatArrays.length; ++i) {
        const index = quatArrays[i];
        // skip over duplicate array indices
        if (i === 0 || index !== prevIndex) {
            data = outputs[index];
            if (data.components === 4) {
                const d = data.data;
                const len = d.length - 4;
                for (let j = 0; j < len; j += 4) {
                    const dp = d[j + 0] * d[j + 4] +
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
    let duration = 0;
    for (i = 0; i < inputs.length; i++) {
        data  = inputs[i]._data;
        duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
    }

    return new AnimTrack(
        gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : ("animation_" + animationIndex),
        duration,
        inputs,
        outputs,
        curves);
};

const createNode = function (gltfNode, nodeIndex) {
    const entity = new GraphNode();

    if (gltfNode.hasOwnProperty('name') && gltfNode.name.length > 0) {
        entity.name = gltfNode.name;
    } else {
        entity.name = "node_" + nodeIndex;
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
        const r = gltfNode.rotation;
        entity.setLocalRotation(r[0], r[1], r[2], r[3]);
    }

    if (gltfNode.hasOwnProperty('translation')) {
        const t = gltfNode.translation;
        entity.setLocalPosition(t[0], t[1], t[2]);
    }

    if (gltfNode.hasOwnProperty('scale')) {
        const s = gltfNode.scale;
        entity.setLocalScale(s[0], s[1], s[2]);
    }

    return entity;
};

// creates light component, adds it to the node and returns the created light component
const createLight = function (gltfLight, node) {

    const lightProps = {
        type: gltfLight.type === "point" ? "omni" : gltfLight.type,
        color: gltfLight.hasOwnProperty('color') ? new Color(gltfLight.color) : Color.WHITE,
        range: gltfLight.hasOwnProperty('range') ? gltfLight.range : Number.MAX_VALUE,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,

        // TODO: (engine issue #3252) Set intensity to match glTF specification, which uses physically based values:
        // - Omni and spot lights use luminous intensity in candela (lm/sr)
        // - Directional lights use illuminance in lux (lm/m2).
        // Current implementation: clapms specified intensity to 0..2 range
        intensity: gltfLight.hasOwnProperty('intensity') ? math.clamp(gltfLight.intensity, 0, 2) : 1
    };

    if (gltfLight.hasOwnProperty('spot')) {
        lightProps.innerConeAngle = gltfLight.spot.hasOwnProperty('innerConeAngle') ? gltfLight.spot.innerConeAngle * math.RAD_TO_DEG : 0;
        lightProps.outerConeAngle = gltfLight.spot.hasOwnProperty('outerConeAngle') ? gltfLight.spot.outerConeAngle * math.RAD_TO_DEG : Math.PI / 4;
    }

    // Rotate to match light orientation in glTF specification
    // Note that this adds a new entity node into the hierarchy that does not exist in the gltf hierarchy
    var lightNode = new Entity(node.name);
    lightNode.rotateLocal(90, 0, 0);

    // add component
    lightNode.addComponent("light", lightProps);

    return lightNode;
};

const createSkins = function (device, gltf, nodes, bufferViews) {
    if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
        return [];
    }

    // cache for skins to filter out duplicates
    const glbSkins = new Map();

    return gltf.skins.map(function (gltfSkin) {
        return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
    });
};

const createMeshes = function (device, gltf, bufferViews, callback, disableFlipV) {
    if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 ||
        !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 ||
        !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
        return [];
    }

    // dictionary of vertex buffers to avoid duplicates
    const vertexBufferDict = {};

    return gltf.meshes.map(function (gltfMesh) {
        return createMesh(device, gltfMesh, gltf.accessors, bufferViews, callback, disableFlipV, vertexBufferDict);
    });
};

const createMaterials = function (gltf, textures, options, disableFlipV) {
    if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
        return [];
    }

    const preprocess = options && options.material && options.material.preprocess;
    const process = options && options.material && options.material.process || createMaterial;
    const postprocess = options && options.material && options.material.postprocess;

    return gltf.materials.map(function (gltfMaterial) {
        if (preprocess) {
            preprocess(gltfMaterial);
        }
        const material = process(gltfMaterial, textures, disableFlipV);
        if (postprocess) {
            postprocess(gltfMaterial, material);
        }
        return material;
    });
};

const createAnimations = function (gltf, nodes, bufferViews, options) {
    if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
        return [];
    }

    const preprocess = options && options.animation && options.animation.preprocess;
    const postprocess = options && options.animation && options.animation.postprocess;

    return gltf.animations.map(function (gltfAnimation, index) {
        if (preprocess) {
            preprocess(gltfAnimation);
        }
        const animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes);
        if (postprocess) {
            postprocess(gltfAnimation, animation);
        }
        return animation;
    });
};

const createNodes = function (gltf, options) {
    if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
        return [];
    }

    const preprocess = options && options.node && options.node.preprocess;
    const process = options && options.node && options.node.process || createNode;
    const postprocess = options && options.node && options.node.postprocess;

    const nodes = gltf.nodes.map(function (gltfNode, index) {
        if (preprocess) {
            preprocess(gltfNode);
        }
        const node = process(gltfNode, index);
        if (postprocess) {
            postprocess(gltfNode, node);
        }
        return node;
    });

    // build node hierarchy
    for (let i = 0; i < gltf.nodes.length; ++i) {
        const gltfNode = gltf.nodes[i];
        if (gltfNode.hasOwnProperty('children')) {
            for (let j = 0; j < gltfNode.children.length; ++j) {
                const parent = nodes[i];
                const child = nodes[gltfNode.children[j]];
                if (!child.parent) {
                    parent.addChild(child);
                }
            }
        }
    }

    return nodes;
};

const createScenes = function (gltf, nodes) {
    const scenes = [];
    const count = gltf.scenes.length;

    // if there's a single scene with a single node in it, don't create wrapper nodes
    if (count === 1 && gltf.scenes[0].nodes.length === 1) {
        const nodeIndex = gltf.scenes[0].nodes[0];
        scenes.push(nodes[nodeIndex]);
    } else {

        // create root node per scene
        for (let i = 0; i < count; i++) {
            const scene = gltf.scenes[i];
            const sceneRoot = new GraphNode(scene.name);

            for (let n = 0; n < scene.nodes.length; n++) {
                const childNode = nodes[scene.nodes[n]];
                sceneRoot.addChild(childNode);
            }

            scenes.push(sceneRoot);
        }
    }

    return scenes;
};

const createLights = function (gltf, nodes, options) {

    let lights = null;

    if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('extensions') &&
        gltf.extensions.hasOwnProperty('KHR_lights_punctual') && gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {

        const gltfLights = gltf.extensions.KHR_lights_punctual.lights;
        if (gltfLights.length) {

            const preprocess = options && options.light && options.light.preprocess;
            const process = options && options.light && options.light.process || createLight;
            const postprocess = options && options.light && options.light.postprocess;

            // handle nodes with lights
            gltf.nodes.forEach(function (gltfNode, nodeIndex) {
                if (gltfNode.hasOwnProperty('extensions') &&
                    gltfNode.extensions.hasOwnProperty('KHR_lights_punctual') &&
                    gltfNode.extensions.KHR_lights_punctual.hasOwnProperty('light')) {

                    const lightIndex = gltfNode.extensions.KHR_lights_punctual.light;
                    const gltfLight = gltfLights[lightIndex];
                    if (gltfLight) {
                        if (preprocess) {
                            preprocess(gltfLight);
                        }
                        const light = process(gltfLight, nodes[nodeIndex]);
                        if (postprocess) {
                            postprocess(gltfLight, light);
                        }

                        // add the light to node->light map
                        if (light) {
                            if (!lights) lights = new Map();
                            lights.set(gltfNode, light);
                        }
                    }
                }
            });
        }
    }

    return lights;
};

// create engine resources from the downloaded GLB data
const createResources = function (device, gltf, bufferViews, textureAssets, options, callback) {
    const preprocess = options && options.global && options.global.preprocess;
    const postprocess = options && options.global && options.global.postprocess;

    if (preprocess) {
        preprocess(gltf);
    }

    // The original version of FACT generated incorrectly flipped V texture
    // coordinates. We must compensate by flipping V in this case. Once
    // all models have been re-exported we can remove this flag.
    const disableFlipV = !(gltf.asset && gltf.asset.generator === 'PlayCanvas');

    const nodes = createNodes(gltf, options);
    const scenes = createScenes(gltf, nodes);
    const lights = createLights(gltf, nodes, options);
    const animations = createAnimations(gltf, nodes, bufferViews, options);
    const materials = createMaterials(gltf, textureAssets.map(function (textureAsset) {
        return textureAsset.resource;
    }), options, disableFlipV);
    const meshes = createMeshes(device, gltf, bufferViews, callback, disableFlipV);
    const skins = createSkins(device, gltf, nodes, bufferViews);

    // create renders to wrap meshes
    const renders = [];
    for (let i = 0; i < meshes.length; i++) {
        renders[i] = new Render();
        renders[i].meshes = meshes[i];
    }

    const result = {
        'gltf': gltf,
        'nodes': nodes,
        'scenes': scenes,
        'animations': animations,
        'textures': textureAssets,
        'materials': materials,
        'renders': renders,
        'skins': skins,
        'lights': lights
    };

    if (postprocess) {
        postprocess(gltf, result);
    }

    callback(null, result);
};

const applySampler = function (texture, gltfSampler) {
    const getFilter = function (filter, defaultValue) {
        switch (filter) {
            case 9728: return FILTER_NEAREST;
            case 9729: return FILTER_LINEAR;
            case 9984: return FILTER_NEAREST_MIPMAP_NEAREST;
            case 9985: return FILTER_LINEAR_MIPMAP_NEAREST;
            case 9986: return FILTER_NEAREST_MIPMAP_LINEAR;
            case 9987: return FILTER_LINEAR_MIPMAP_LINEAR;
            default:   return defaultValue;
        }
    };

    const getWrap = function (wrap, defaultValue) {
        switch (wrap) {
            case 33071: return ADDRESS_CLAMP_TO_EDGE;
            case 33648: return ADDRESS_MIRRORED_REPEAT;
            case 10497: return ADDRESS_REPEAT;
            default:    return defaultValue;
        }
    };

    if (texture) {
        gltfSampler = gltfSampler || { };
        texture.minFilter = getFilter(gltfSampler.minFilter, FILTER_LINEAR_MIPMAP_LINEAR);
        texture.magFilter = getFilter(gltfSampler.magFilter, FILTER_LINEAR);
        texture.addressU = getWrap(gltfSampler.wrapS, ADDRESS_REPEAT);
        texture.addressV = getWrap(gltfSampler.wrapT, ADDRESS_REPEAT);
    }
};

// load an image
const loadImageAsync = function (gltfImage, index, bufferViews, urlBase, registry, options, callback) {
    const preprocess = options && options.image && options.image.preprocess;
    const processAsync = (options && options.image && options.image.processAsync) || function (gltfImage, callback) {
        callback(null, null);
    };
    const postprocess = options && options.image && options.image.postprocess;

    const onLoad = function (textureAsset) {
        if (postprocess) {
            postprocess(gltfImage, textureAsset);
        }
        callback(null, textureAsset);
    };

    const loadTexture = function (url, mimeType, crossOrigin, isBlobUrl) {
        const mimeTypeFileExtensions = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/basis': 'basis',
            'image/ktx': 'ktx',
            'image/vnd-ms.dds': 'dds'
        };

        // construct the asset file
        const file = { url: url };
        if (mimeType) {
            const extension = mimeTypeFileExtensions[mimeType];
            if (extension) {
                file.filename = 'glb-texture-' + index + '.' + extension;
            }
        }

        // create and load the asset
        const asset = new Asset('texture_' + index, 'texture',  file, null, { crossOrigin: crossOrigin });
        asset.on('load', function () {
            if (isBlobUrl) {
                URL.revokeObjectURL(url);
            }
            onLoad(asset);
        });
        asset.on('error', function (err, asset) {
            callback(err);
        });
        registry.add(asset);
        registry.load(asset);
    };

    if (preprocess) {
        preprocess(gltfImage);
    }

    processAsync(gltfImage, function (err, textureAsset) {
        if (err) {
            callback(err);
        } else if (textureAsset) {
            onLoad(textureAsset);
        } else {
            if (gltfImage.hasOwnProperty('uri')) {
                // uri specified
                if (isDataURI(gltfImage.uri)) {
                    loadTexture(gltfImage.uri, getDataURIMimeType(gltfImage.uri));
                } else {
                    loadTexture(path.join(urlBase, gltfImage.uri), null, "anonymous");
                }
            } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
                // bufferview
                const blob = new Blob([bufferViews[gltfImage.bufferView]], { type: gltfImage.mimeType });
                loadTexture(URL.createObjectURL(blob), gltfImage.mimeType, null, true);
            } else {
                // fail
                callback("Invalid image found in gltf (neither uri or bufferView found). index=" + index);
            }
        }
    });
};

// load textures using the asset system
const loadTexturesAsync = function (gltf, bufferViews, urlBase, registry, options, callback) {
    if (!gltf.hasOwnProperty('images') || gltf.images.length === 0 ||
        !gltf.hasOwnProperty('textures') || gltf.textures.length === 0) {
        callback(null, []);
        return;
    }

    const preprocess = options && options.texture && options.texture.preprocess;
    const processAsync = (options && options.texture && options.texture.processAsync) || function (gltfTexture, gltfImages, callback) {
        callback(null, null);
    };
    const postprocess = options && options.texture && options.texture.postprocess;

    const assets = [];        // one per image
    const textures = [];      // list per image

    let remaining = gltf.textures.length;
    const onLoad = function (textureIndex, imageIndex) {
        if (!textures[imageIndex]) {
            textures[imageIndex] = [];
        }
        textures[imageIndex].push(textureIndex);

        if (--remaining === 0) {
            const result = [];
            textures.forEach(function (textureList, imageIndex) {
                textureList.forEach(function (textureIndex, index) {
                    const textureAsset = (index === 0) ? assets[imageIndex] : cloneTextureAsset(assets[imageIndex]);
                    applySampler(textureAsset.resource, (gltf.samplers || [])[gltf.textures[textureIndex].sampler]);
                    result[textureIndex] = textureAsset;
                    if (postprocess) {
                        postprocess(gltf.textures[textureIndex], textureAsset);
                    }
                });
            });
            callback(null, result);
        }
    };

    for (let i = 0; i < gltf.textures.length; ++i) {
        const gltfTexture = gltf.textures[i];

        if (preprocess) {
            preprocess(gltfTexture);
        }

        processAsync(gltfTexture, gltf.images, function (i, gltfTexture, err, gltfImageIndex) {
            if (err) {
                callback(err);
            } else {
                if (gltfImageIndex === undefined || gltfImageIndex === null) {
                    gltfImageIndex = gltfTexture.source;
                }

                if (assets[gltfImageIndex]) {
                    // image has already been loaded
                    onLoad(i, gltfImageIndex);
                } else {
                    // first occcurrence, load it
                    const gltfImage = gltf.images[gltfImageIndex];
                    loadImageAsync(gltfImage, i, bufferViews, urlBase, registry, options, function (err, textureAsset) {
                        if (err) {
                            callback(err);
                        } else {
                            assets[gltfImageIndex] = textureAsset;
                            onLoad(i, gltfImageIndex);
                        }
                    });
                }
            }
        }.bind(null, i, gltfTexture));
    }
};

// load gltf buffers asynchronously, returning them in the callback
const loadBuffersAsync = function (gltf, binaryChunk, urlBase, options, callback) {
    const result = [];

    if (!gltf.buffers || gltf.buffers.length === 0) {
        callback(null, result);
        return;
    }

    const preprocess = options && options.buffer && options.buffer.preprocess;
    const processAsync = (options && options.buffer && options.buffer.processAsync) || function (gltfBuffer, callback) {
        callback(null, null);
    };
    const postprocess = options && options.buffer && options.buffer.postprocess;

    let remaining = gltf.buffers.length;
    const onLoad = function (index, buffer) {
        result[index] = buffer;
        if (postprocess) {
            postprocess(gltf.buffers[index], buffer);
        }
        if (--remaining === 0) {
            callback(null, result);
        }
    };

    for (let i = 0; i < gltf.buffers.length; ++i) {
        const gltfBuffer = gltf.buffers[i];

        if (preprocess) {
            preprocess(gltfBuffer);
        }

        processAsync(gltfBuffer, function (i, gltfBuffer, err, arrayBuffer) {           // eslint-disable-line no-loop-func
            if (err) {
                callback(err);
            } else if (arrayBuffer) {
                onLoad(i, new Uint8Array(arrayBuffer));
            } else {
                if (gltfBuffer.hasOwnProperty('uri')) {
                    if (isDataURI(gltfBuffer.uri)) {
                        // convert base64 to raw binary data held in a string
                        // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                        const byteString = atob(gltfBuffer.uri.split(',')[1]);

                        // create a view into the buffer
                        const binaryArray = new Uint8Array(byteString.length);

                        // set the bytes of the buffer to the correct values
                        for (let j = 0; j < byteString.length; j++) {
                            binaryArray[j] = byteString.charCodeAt(j);
                        }

                        onLoad(i, binaryArray);
                    } else {
                        http.get(
                            path.join(urlBase, gltfBuffer.uri),
                            { cache: true, responseType: 'arraybuffer', retry: false },
                            function (i, err, result) {                         // eslint-disable-line no-loop-func
                                if (err) {
                                    callback(err);
                                } else {
                                    onLoad(i, new Uint8Array(result));
                                }
                            }.bind(null, i)
                        );
                    }
                } else {
                    // glb buffer reference
                    onLoad(i, binaryChunk);
                }
            }
        }.bind(null, i, gltfBuffer));
    }
};

// parse the gltf chunk, returns the gltf json
const parseGltf = function (gltfChunk, callback) {
    const decodeBinaryUtf8 = function (array) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(array);
        }

        let str = "";
        for (let i = 0; i < array.length; i++) {
            str += String.fromCharCode(array[i]);
        }

        return decodeURIComponent(escape(str));
    };

    const gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));

    // check gltf version
    if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
        callback("Invalid gltf version. Expected version 2.0 or above but found version '" + gltf.asset.version + "'.");
        return;
    }

    callback(null, gltf);
};

// parse glb data, returns the gltf and binary chunk
const parseGlb = function (glbData, callback) {
    const data = new DataView(glbData);

    // read header
    const magic = data.getUint32(0, true);
    const version = data.getUint32(4, true);
    const length = data.getUint32(8, true);

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
    const chunks = [];
    let offset = 12;
    while (offset < length) {
        const chunkLength = data.getUint32(offset, true);
        if (offset + chunkLength + 8 > glbData.byteLength) {
            throw new Error("Invalid chunk length found in glb. Found " + chunkLength);
        }
        const chunkType = data.getUint32(offset + 4, true);
        const chunkData = new Uint8Array(glbData, offset + 8, chunkLength);
        chunks.push({ length: chunkLength, type: chunkType, data: chunkData });
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
const parseChunk = function (filename, data, callback) {
    if (filename && filename.toLowerCase().endsWith('.glb')) {
        parseGlb(data, callback);
    } else {
        callback(null, {
            gltfChunk: data,
            binaryChunk: null
        });
    }
};

// create buffer views
const parseBufferViewsAsync = function (gltf, buffers, options, callback) {

    const result = [];

    const preprocess = options && options.bufferView && options.bufferView.preprocess;
    const processAsync = (options && options.bufferView && options.bufferView.processAsync) || function (gltfBufferView, buffers, callback) {
        callback(null, null);
    };
    const postprocess = options && options.bufferView && options.bufferView.postprocess;

    let remaining = gltf.bufferViews ? gltf.bufferViews.length : 0;

    // handle case of no buffers
    if (!remaining) {
        callback(null, null);
        return;
    }

    const onLoad = function (index, bufferView) {
        const gltfBufferView = gltf.bufferViews[index];
        if (gltfBufferView.hasOwnProperty('byteStride')) {
            bufferView.byteStride = gltfBufferView.byteStride;
        }

        result[index] = bufferView;
        if (postprocess) {
            postprocess(gltfBufferView, bufferView);
        }
        if (--remaining === 0) {
            callback(null, result);
        }
    };

    for (let i = 0; i < gltf.bufferViews.length; ++i) {
        const gltfBufferView = gltf.bufferViews[i];

        if (preprocess) {
            preprocess(gltfBufferView);
        }

        processAsync(gltfBufferView, buffers, function (i, gltfBufferView, err, result) {       // eslint-disable-line no-loop-func
            if (err) {
                callback(err);
            } else if (result) {
                onLoad(i, result);
            } else {
                const buffer = buffers[gltfBufferView.buffer];
                const typedArray = new Uint8Array(buffer.buffer,
                                                  buffer.byteOffset + (gltfBufferView.byteOffset || 0),
                                                  gltfBufferView.byteLength);
                onLoad(i, typedArray);
            }
        }.bind(null, i, gltfBufferView));
    }
};

// -- GlbParser
class GlbParser {
    // parse the gltf or glb data asynchronously, loading external resources
    static parseAsync(filename, urlBase, data, device, registry, options, callback) {
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

                    // async load buffer views
                    parseBufferViewsAsync(gltf, buffers, options, function (err, bufferViews) {
                        if (err) {
                            callback(err);
                            return;
                        }

                        // async load images
                        loadTexturesAsync(gltf, bufferViews, urlBase, registry, options, function (err, textureAssets) {
                            if (err) {
                                callback(err);
                                return;
                            }

                            createResources(device, gltf, bufferViews, textureAssets, options, callback);
                        });
                    });
                });
            });
        });
    }

    // parse the gltf or glb data synchronously. external resources (buffers and images) are ignored.
    static parse(filename, data, device, options) {
        let result = null;

        options = options || { };

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
                        // parse buffer views
                        parseBufferViewsAsync(gltf, [chunks.binaryChunk], options, function (err, bufferViews) {
                            if (err) {
                                console.error(err);
                            } else {
                                // create resources
                                createResources(device, gltf, bufferViews, [], options, function (err, result_) {
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
            }
        });

        return result;
    }
}

export { GlbParser };
