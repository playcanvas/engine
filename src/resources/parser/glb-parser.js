Object.assign(pc, function () {
    'use strict';

    var isDataURI = function (uri) {
        return /^data:.*,.*$/i.test(uri);
    };

    var getDataURIMimeType = function (uri) {
        return uri.substring(uri.indexOf(":")+1, uri.indexOf(";"));
    };

    var isPower2 = function (n) {
        return n && ((n & (n - 1)) === 0);
    };

    var isPower2d = function (w, h) {
        return isPower2(w) && isPower2(h);
    };

    var nearestPow2 = function (n) {
        return Math.pow(2, Math.round(Math.log(n) / Math.log(2)));
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
            case 5120: return pc.TYPE_INT8;
            case 5121: return pc.TYPE_UINT8;
            case 5122: return pc.TYPE_INT16;
            case 5123: return pc.TYPE_UINT16;
            case 5124: return pc.TYPE_INT32;
            case 5125: return pc.TYPE_UINT32;
            case 5126: return pc.TYPE_FLOAT32;
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

    var getAccessorDataType = function (accessor) {
        switch (accessor.componentType) {
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

        var dataType = getAccessorDataType(accessor);
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
            return pc.PRIMITIVE_TRIANGLES;
        }

        switch (primitive.mode) {
            case 0: return pc.PRIMITIVE_POINTS;
            case 1: return pc.PRIMITIVE_LINES;
            case 2: return pc.PRIMITIVE_LINELOOP;
            case 3: return pc.PRIMITIVE_LINESTRIP;
            case 4: return pc.PRIMITIVE_TRIANGLES;
            case 5: return pc.PRIMITIVE_TRISTRIP;
            case 6: return pc.PRIMITIVE_TRIFAN;
            default: return pc.PRIMITIVE_TRIANGLES;
        }
    };

    var generateIndices = function (numVertices) {
        var dummyIndices = new Uint16Array(numVertices);
        for (var i = 0; i < numVertices; i++) {
            dummyIndices[i] = i;
        }
        return dummyIndices;
    };

    var generateNormals = function (sourceDesc, vertexDesc, positions, numVertices, indices) {

        if (!indices) {
            indices = generateIndices(numVertices);
        }

        // generate normals
        var normalsTemp = pc.calculateNormals(positions, indices);
        var normals = new Float32Array(normalsTemp.length);
        normals.set(normalsTemp);

        vertexDesc.push({
            semantic: pc.SEMANTIC_NORMAL,
            components: 3,
            type: pc.TYPE_FLOAT32
        });

        sourceDesc[pc.SEMANTIC_NORMAL] = {
            buffer: normals.buffer,
            size: 12,
            offset: 0,
            stride: 12,
            count: numVertices
        };
    };

    var createVertexBufferInternal = function (device, numVertices, vertexDesc, positionDesc, sourceDesc) {

        // order vertexDesc to match the rest of the engine
        var elementOrder = [
            pc.SEMANTIC_POSITION,
            pc.SEMANTIC_NORMAL,
            pc.SEMANTIC_TANGENT,
            pc.SEMANTIC_BINORMAL,
            pc.SEMANTIC_COLOR,
            pc.SEMANTIC_BLENDINDICES,
            pc.SEMANTIC_BLENDWEIGHT,
            pc.SEMANTIC_TEXCOORD0,
            pc.SEMANTIC_TEXCOORD1
        ];

        // sort vertex elements by engine-ideal order
        vertexDesc.sort(function (lhs, rhs) {
            var lhsOrder = elementOrder.indexOf(lhs.semantic);
            var rhsOrder = elementOrder.indexOf(rhs.semantic);
            return (lhsOrder < rhsOrder) ? -1 : (rhsOrder < lhsOrder ? 1 : 0);
        });

        // create vertex buffer
        var vertexBuffer = new pc.VertexBuffer(device,
                                               new pc.VertexFormat(device, vertexDesc),
                                               numVertices,
                                               pc.BUFFER_STATIC);

        var i, j, k;
        var source, target, sourceOffset;

        // check whether source data is correctly interleaved
        var isCorrectlyInterleaved = true;
        for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
            target = vertexBuffer.format.elements[i];
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
        vertexBuffer.unlock();

        return vertexBuffer;
    };

    var createVertexBuffer = function (device, attributes, indices, accessors, bufferViews, buffers, semanticMap) {

        // build vertex buffer format desc and source
        var vertexDesc = [];
        var sourceDesc = {};
        for (var attrib in attributes) {
            if (attributes.hasOwnProperty(attrib)) {
                var accessor = accessors[attributes[attrib]];
                var bufferView = bufferViews[accessor.bufferView];

                if (semanticMap.hasOwnProperty(attrib)) {
                    var semantic = semanticMap[attrib].semantic;
                    vertexDesc.push({
                        semantic: semantic,
                        components: getNumComponents(accessor.type),
                        type: getComponentType(accessor.componentType),
                        normalize: accessor.normalized
                    });
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
                        count: accessor.count
                    };
                }
            }
        }

        // get position attribute
        var positionDesc = sourceDesc[pc.SEMANTIC_POSITION];
        var numVertices = positionDesc.count;

        // generate normals if they're missing (this should probably be a user option)
        if (!sourceDesc.hasOwnProperty(pc.SEMANTIC_NORMAL)) {
            var positions = getAccessorData(accessors[attributes.POSITION], bufferViews, buffers);
            generateNormals(sourceDesc, vertexDesc, positions, numVertices, indices);
        }

        return createVertexBufferInternal(device, numVertices, vertexDesc, positionDesc, sourceDesc);
    };

    var createVertexBufferDraco = function (device, outputGeometry, extDraco, decoder, decoderModule, semanticMap, indices) {

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
                    storageType = pc.TYPE_UINT8;
                    componentSizeInBytes = 1;
                    ptr = decoderModule._malloc(numValues * componentSizeInBytes);
                    decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_UINT8, numValues * componentSizeInBytes, ptr);
                    values = new Uint8Array(decoderModule.HEAPU8.buffer, ptr, numValues).slice();
                    break;

                case decoderModule.DT_UINT16:
                    storageType = pc.TYPE_UINT16;
                    componentSizeInBytes = 2;
                    ptr = decoderModule._malloc(numValues * componentSizeInBytes);
                    decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_UINT16, numValues * componentSizeInBytes, ptr);
                    values = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numValues).slice();
                    break;

                case decoderModule.DT_FLOAT32:
                default:
                    storageType = pc.TYPE_FLOAT32;
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
        var vertexDesc = [];
        var sourceDesc = {};
        var attributes = extDraco.attributes;
        for (var attrib in attributes) {
            if (attributes.hasOwnProperty(attrib) && semanticMap.hasOwnProperty(attrib)) {
                var semanticInfo = semanticMap[attrib];
                var semantic = semanticInfo.semantic;
                var attributeInfo = extractDracoAttributeInfo(attributes[attrib]);

                vertexDesc.push({
                    semantic: semantic,
                    components: attributeInfo.numComponents,
                    type: attributeInfo.storageType,
                    normalize: attributeInfo.normalized
                });

                // store the info we'll need to copy this data into the vertex buffer
                var size = attributeInfo.numComponents * attributeInfo.componentSizeInBytes;
                sourceDesc[semantic] = {
                    values: attributeInfo.values,
                    buffer: attributeInfo.values.buffer,
                    size: size,
                    offset: 0,
                    stride: size,
                    count: numPoints
                };
            }
        }

        // get position attribute
        var positionDesc = sourceDesc[pc.SEMANTIC_POSITION];
        var numVertices = positionDesc.count;

        // generate normals if they're missing (this should probably be a user option)
        if (!sourceDesc.hasOwnProperty(pc.SEMANTIC_NORMAL)) {
            generateNormals(sourceDesc, vertexDesc, positionDesc.values, numVertices, indices);
        }

        return createVertexBufferInternal(device, numVertices, vertexDesc, positionDesc, sourceDesc);
    };

    var createSkin = function (device, skinData, accessors, bufferViews, nodes, buffers) {
        var i, j, bindMatrix;
        var joints = skinData.joints;
        var numJoints = joints.length;
        var ibp = [];
        if (skinData.hasOwnProperty('inverseBindMatrices')) {
            var inverseBindMatrices = skinData.inverseBindMatrices;
            var ibmData = getAccessorData(accessors[inverseBindMatrices], bufferViews, buffers);
            var ibmValues = [];

            for (i = 0; i < numJoints; i++) {
                for (j = 0; j < 16; j++) {
                    ibmValues[j] = ibmData[i * 16 + j];
                }
                bindMatrix = new pc.Mat4();
                bindMatrix.set(ibmValues);
                ibp.push(bindMatrix);
            }
        } else {
            for (i = 0; i < numJoints; i++) {
                bindMatrix = new pc.Mat4();
                ibp.push(bindMatrix);
            }
        }

        var boneNames = [];
        for (i = 0; i < numJoints; i++) {
            boneNames[i] = nodes[joints[i]].name;
        }

        var skeleton = skinData.skeleton;

        var skin = new pc.Skin(device, ibp, boneNames);
        skin.skeleton = nodes[skeleton];

        skin.bones = [];
        for (i = 0; i < joints.length; i++) {
            skin.bones[i] = nodes[joints[i]];
        }

        return skin;
    };

    var tempMat = new pc.Mat4();
    var tempVec = new pc.Vec3();

    var createMesh = function (device, meshData, accessors, bufferViews, buffers, callback) {
        var meshes = [];

        var semanticMap = {
            'POSITION': { semantic: pc.SEMANTIC_POSITION },
            'NORMAL': { semantic: pc.SEMANTIC_NORMAL },
            'TANGENT': { semantic: pc.SEMANTIC_TANGENT },
            'BINORMAL': { semantic: pc.SEMANTIC_BINORMAL },
            'COLOR_0': { semantic: pc.SEMANTIC_COLOR },
            'JOINTS_0': { semantic: pc.SEMANTIC_BLENDINDICES },
            'WEIGHTS_0': { semantic: pc.SEMANTIC_BLENDWEIGHT },
            'TEXCOORD_0': { semantic: pc.SEMANTIC_TEXCOORD0 },
            'TEXCOORD_1': { semantic: pc.SEMANTIC_TEXCOORD1 }
        };

        meshData.primitives.forEach(function (primitive) {

            var primitiveType, vertexBuffer, numIndices;
            var indices = null;
            var mesh = new pc.Mesh(device);
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
                                    primitiveType = pc.PRIMITIVE_POINTS;
                                    outputGeometry = new decoderModule.PointCloud();
                                    status = decoder.DecodeBufferToPointCloud(buffer, outputGeometry);
                                    break;
                                case decoderModule.TRIANGULAR_MESH:
                                    primitiveType = pc.PRIMITIVE_TRIANGLES;
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
                            vertexBuffer = createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, semanticMap, indices);

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
                vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, buffers, semanticMap);
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
                    indexFormat = pc.INDEXFORMAT_UINT8;
                } else if (indices instanceof Uint16Array) {
                    indexFormat = pc.INDEXFORMAT_UINT16;
                } else {
                    // TODO: these indices may need conversion since some old WebGL 1.0 devices
                    // don't support 32bit index data
                    indexFormat = pc.INDEXFORMAT_UINT32;
                }
                var indexBuffer = new pc.IndexBuffer(device, indexFormat, indices.length, pc.BUFFER_STATIC, indices);
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].count = indices.length;
            } else {
                mesh.primitive[0].count = vertexBuffer.numVertices;
            }

            mesh.materialIndex = primitive.material;

            var accessor = accessors[primitive.attributes.POSITION];
            var min = accessor.min;
            var max = accessor.max;
            var aabb = new pc.BoundingBox(
                new pc.Vec3((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2),
                new pc.Vec3((max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2)
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
                        dataType = getAccessorDataType(accessor);

                        options.deltaPositions = getAccessorData(accessor, bufferViews, buffers);
                        options.deltaPositionsType = pc.typedArrayToType[dataType.name];

                        if (accessor.sparse) {
                            options.deltaPositions = sparseToFull(options.deltaPositions, getSparseAccessorIndices(accessor, bufferViews, buffers),
                                                                  dataType, mesh.vertexBuffer.numVertices);

                        }

                        if (accessor.hasOwnProperty('min') && accessor.hasOwnProperty('max')) {
                            options.aabb = new pc.BoundingBox();
                            options.aabb.setMinMax(new pc.Vec3(accessor.min), new pc.Vec3(accessor.max));
                        }
                    }

                    if (target.hasOwnProperty('NORMAL')) {

                        accessor = accessors[target.NORMAL];
                        dataType = getAccessorDataType(accessor);

                        options.deltaNormals = getAccessorData(accessor, bufferViews, buffers);
                        options.deltaNormalsType = pc.typedArrayToType[dataType.name];

                        if (accessor.sparse) {
                            options.deltaNormals = sparseToFull(options.deltaNormals, getSparseAccessorIndices(accessor, bufferViews, buffers),
                                                                dataType, mesh.vertexBuffer.numVertices);
                        }
                    }

                    if (meshData.hasOwnProperty('extras') &&
                        meshData.extras.hasOwnProperty('targetNames')) {
                        options.name = meshData.extras.targetNames[index];
                    } else {
                        options.name = targets.length.toString(10);
                    }

                    targets.push(new pc.MorphTarget(device, options));
                });

                mesh.morph = new pc.Morph(targets);

                // set default morph target weights if they're specified
                if (meshData.hasOwnProperty('weights')) {
                    for (var i = 0; i < meshData.weights.length; ++i) {
                        targets[i].defaultWeight = meshData.weights[i];
                    }
                }
            }

            meshes.push(mesh);
        });

        return meshes;
    };

    var createMaterial = function (materialData, textures) {
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

        var extractTextureTransform = function (source, material, maps) {
            var map;

            var texCoord = source.texCoord;
            if (texCoord) {
                for (map = 0; map < maps.length; ++map) {
                    material[maps[map] + 'MapUv'] = texCoord;
                }
            }

            var extensions = source.extensions;
            if (extensions) {
                var textureTransformData = extensions.KHR_texture_transform;
                if (textureTransformData) {
                    var scale = textureTransformData.scale;
                    if (scale) {
                        for (map = 0; map < maps.length; ++map) {
                            material[maps[map] + 'MapTiling'] = new pc.Vec2(scale[0], scale[1]);
                        }
                    }

                    var offset = textureTransformData.offset;
                    if (offset) {
                        for (map = 0; map < maps.length; ++map) {
                            material[maps[map] + 'MapOffset'] = new pc.Vec2(offset[0], offset[1]);
                        }
                    }
                }
            }
        };

        var material = new pc.StandardMaterial();

        // glTF dooesn't define how to occlude specular
        material.occludeSpecular = true;

        material.diffuseTint = true;
        material.diffuseVertexColor = true;

        material.specularTint = true;
        material.specularVertexColor = true;

        if (materialData.hasOwnProperty('name')) {
            material.name = materialData.name;
        }

        var color, texture;
        if (materialData.hasOwnProperty('extensions') &&
            materialData.extensions.hasOwnProperty('KHR_materials_pbrSpecularGlossiness')) {
            var specData = materialData.extensions.KHR_materials_pbrSpecularGlossiness;

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
                texture = textures[diffuseTexture.index].resource;

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
                material.specularMap = textures[specularGlossinessTexture.index].resource;
                material.specularMapChannel = 'rgb';
                material.glossMap = textures[specularGlossinessTexture.index].resource;

                extractTextureTransform(specularGlossinessTexture, material, ['gloss', 'metalness']);
            }

            material.chunks.specularPS = specularChunk;

        } else if (materialData.hasOwnProperty('pbrMetallicRoughness')) {
            var pbrData = materialData.pbrMetallicRoughness;

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
                texture = textures[baseColorTexture.index].resource;

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
                material.metalnessMap = textures[metallicRoughnessTexture.index].resource;
                material.metalnessMapChannel = 'b';
                material.glossMap = textures[metallicRoughnessTexture.index].resource;
                material.glossMapChannel = 'g';

                extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
            }

            material.chunks.glossPS = glossChunk;
        }

        if (materialData.hasOwnProperty('normalTexture')) {
            var normalTexture = materialData.normalTexture;
            material.normalMap = textures[normalTexture.index].resource;

            extractTextureTransform(normalTexture, material, ['normal']);

            if (normalTexture.hasOwnProperty('scale')) {
                material.bumpiness = normalTexture.scale;
            }
        }
        if (materialData.hasOwnProperty('occlusionTexture')) {
            var occlusionTexture = materialData.occlusionTexture;
            material.aoMap = textures[occlusionTexture.index].resource;
            material.aoMapChannel = 'r';

            extractTextureTransform(occlusionTexture, material, ['ao']);
            // TODO: support 'strength'
        }
        if (materialData.hasOwnProperty('emissiveFactor')) {
            color = materialData.emissiveFactor;
            // Convert from linear space to sRGB space
            material.emissive.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
            material.emissiveTint = true;
        } else {
            material.emissive.set(0, 0, 0);
            material.emissiveTint = false;
        }
        if (materialData.hasOwnProperty('emissiveTexture')) {
            var emissiveTexture = materialData.emissiveTexture;
            material.emissiveMap = textures[emissiveTexture.index].resource;

            extractTextureTransform(emissiveTexture, material, ['emissive']);
        }
        if (materialData.hasOwnProperty('alphaMode')) {
            switch (materialData.alphaMode) {
                case 'MASK':
                    material.blendType = pc.BLEND_NONE;
                    if (materialData.hasOwnProperty('alphaCutoff')) {
                        material.alphaTest = materialData.alphaCutoff;
                    } else {
                        material.alphaTest = 0.5;
                    }
                    break;
                case 'BLEND':
                    material.blendType = pc.BLEND_NORMAL;
                    break;
                default:
                case 'OPAQUE':
                    material.blendType = pc.BLEND_NONE;
                    break;
            }
        } else {
            material.blendType = pc.BLEND_NONE;
        }
        if (materialData.hasOwnProperty('doubleSided')) {
            material.twoSidedLighting = materialData.doubleSided;
            material.cull = materialData.doubleSided ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
        } else {
            material.twoSidedLighting = false;
            material.cull = pc.CULLFACE_BACK;
        }

        // handle unlit material by disabling lighting and copying diffuse colours
        // into emissive.
        if (materialData.hasOwnProperty('extensions') &&
            materialData.extensions.hasOwnProperty('KHR_materials_unlit')) {
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

    var defaultSampler = {
        magFilter: 9729,
        minFilter: 9987,
        wrapS: 10497,
        wrapT: 10497
    };

    var createTexture = function (device, textureData, samplers, images) {
        var getFilter = function (filter) {
            switch (filter) {
                case 9728: return pc.FILTER_NEAREST;
                case 9729: return pc.FILTER_LINEAR;
                case 9984: return pc.FILTER_NEAREST_MIPMAP_NEAREST;
                case 9985: return pc.FILTER_LINEAR_MIPMAP_NEAREST;
                case 9986: return pc.FILTER_NEAREST_MIPMAP_LINEAR;
                case 9987: return pc.FILTER_LINEAR_MIPMAP_LINEAR;
                default:   return pc.FILTER_LINEAR;
            }
        };

        var getWrap = function (wrap) {
            switch (wrap) {
                case 33071: return pc.ADDRESS_CLAMP_TO_EDGE;
                case 33648: return pc.ADDRESS_MIRRORED_REPEAT;
                case 10497: return pc.ADDRESS_REPEAT;
                default:    return pc.ADDRESS_REPEAT;
            }
        };

        var samplerData = samplers ? samplers[textureData.sampler] : defaultSampler;
        var options = {
            name: textureData.name,
            minFilter: getFilter(samplerData.minFilter),
            magFilter: getFilter(samplerData.magFilter),
            addressU: getWrap(samplerData.wrapS),
            addressV: getWrap(samplerData.wrapT),
            flipY: false
        };

        var result = new pc.Texture(device, options);
        result.setSource(images[textureData.source]);
        return result;
    };

    // create the anim structure
    var createAnimation = function (animationData, animationIndex, accessors, bufferViews, nodes, buffers) {

        // create animation data block for the accessor
        var createAnimData = function (accessor) {
            var data = getAccessorData(accessor, bufferViews, buffers);
            // TODO: this assumes data is tightly packed, handle the case data is interleaved
            return new pc.AnimData(getNumComponents(accessor.type), new data.constructor(data));
        };

        var interpMap = {
            "STEP": pc.INTERPOLATION_STEP,
            "LINEAR": pc.INTERPOLATION_LINEAR,
            "CUBICSPLINE": pc.INTERPOLATION_CUBIC
        };

        var inputMap = { };
        var inputs = [];

        var outputMap = { };
        var outputs = [];

        var curves = [];

        var i;

        // convert samplers
        for (i = 0; i < animationData.samplers.length; ++i) {
            var sampler = animationData.samplers[i];

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
                    interpMap[sampler.interpolation] : pc.INTERPOLATION_LINEAR;

            // create curve
            curves.push(new pc.AnimCurve(
                [],
                inputMap[sampler.input],
                outputMap[sampler.output],
                interpolation));
        }

        var quatArrays = [];

        // convert anim channels
        for (i = 0; i < animationData.channels.length; ++i) {
            var channel = animationData.channels[i];
            var target = channel.target;
            var curve = curves[channel.sampler];
            curve._paths.push(pc.AnimBinder.joinPath([nodes[target.node].name, target.path]));

            // if this target is a set of quaternion keys, make note of its index so we can perform
            // quaternion-specific processing on it.
            if (target.path.startsWith('rotation') && curve.interpolation !== pc.INTERPOLATION_CUBIC) {
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
        for (i = 0; i < quatArrays.length; ++i) {
            var index = quatArrays[i];
            // skip over duplicate array indices
            if (i === 0 || index !== prevIndex) {
                var data = outputs[index];
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
        var duration = inputs.reduce(function (value, input) {
            var data  = input._data;
            return Math.max(value, data.length === 0 ? 0 : data[data.length - 1]);
        }, 0);

        return new pc.AnimTrack(
            animationData.hasOwnProperty('name') ? animationData.name : ("animation_" + animationIndex),
            duration,
            inputs,
            outputs,
            curves);
    };

    var createNode = function (nodeData, nodeIndex) {
        var entity = new pc.GraphNode();

        if (nodeData.hasOwnProperty('name')) {
            entity.name = nodeData.name;
        } else {
            entity.name = "node_" + nodeIndex;
        }

        // Parse transformation properties
        if (nodeData.hasOwnProperty('matrix')) {
            tempMat.data.set(nodeData.matrix);
            tempMat.getTranslation(tempVec);
            entity.setLocalPosition(tempVec);
            tempMat.getEulerAngles(tempVec);
            entity.setLocalEulerAngles(tempVec);
            tempMat.getScale(tempVec);
            entity.setLocalScale(tempVec);
        }

        if (nodeData.hasOwnProperty('rotation')) {
            var r = nodeData.rotation;
            entity.setLocalRotation(r[0], r[1], r[2], r[3]);
        }

        if (nodeData.hasOwnProperty('translation')) {
            var t = nodeData.translation;
            entity.setLocalPosition(t[0], t[1], t[2]);
        }

        if (nodeData.hasOwnProperty('scale')) {
            var s = nodeData.scale;
            entity.setLocalScale(s[0], s[1], s[2]);
        }

        return entity;
    };

    var createSkins = function (device, gltf, nodes, buffers) {
        if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
            return [];
        }
        return gltf.skins.map(function (skinData) {
            return createSkin(device, skinData, gltf.accessors, gltf.bufferViews, nodes, buffers);
        });

    };

    var createMeshes = function (device, gltf, buffers, callback) {
        if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 ||
            !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 ||
            !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
            return [];
        }
        return gltf.meshes.map(function (meshData) {
            return createMesh(device, meshData, gltf.accessors, gltf.bufferViews, buffers, callback);
        });

    };

    var createMaterials = function (gltf, textures) {
        if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
            return [];
        }
        return gltf.materials.map(function (materialData) {
            return createMaterial(materialData, textures);
        });

    };

    var createTextures = function (device, gltf, images) {
        if (!gltf.hasOwnProperty('textures') || gltf.textures.length === 0) {
            return [];
        }
        return gltf.textures.map(function (textureData) {
            return createTexture(device, textureData, gltf.samplers, images);
        });
    };

    var createAnimations = function (gltf, nodes, buffers) {
        if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
            return [];
        }
        return gltf.animations.map(function (animationData, animationIndex) {
            return createAnimation(animationData, animationIndex, gltf.accessors, gltf.bufferViews, nodes, buffers);
        });

    };

    var createNodes = function (gltf) {
        if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
            return [];
        }
        var nodes = gltf.nodes.map(createNode);

        // build node hierarchy
        for (var i = 0; i < gltf.nodes.length; ++i) {
            var nodeData = gltf.nodes[i];
            if (nodeData.hasOwnProperty('children')) {
                for (var j = 0; j < nodeData.children.length; ++j) {
                    var parent = nodes[i];
                    var child = nodes[nodeData.children[j]];
                    if (!child.parent) {
                        parent.addChild(child);
                    }
                }
            }
        }

        return nodes;
    };

    // create engine resources from the downloaded GLB data
    var createResources = function (device, gltf, buffers, textures, callback) {
        var nodes = createNodes(gltf);
        var animations = createAnimations(gltf, nodes, buffers);
        var materials = createMaterials(gltf, textures);
        var meshes = createMeshes(device, gltf, buffers, callback);
        var skins = createSkins(device, gltf, nodes, buffers);

        callback(null, {
            'gltf': gltf,
            'nodes': nodes,
            'animations': animations,
            'textures': textures,
            'materials': materials,
            'meshes': meshes,
            'skins': skins
        });
    };

    // load textures using the asset system
    var loadTexturesAsync = function (device, gltf, buffers, urlBase, registry, callback) {
        var result = [];

        if (!gltf.hasOwnProperty('images') || gltf.images.length === 0 ||
            !gltf.hasOwnProperty('textures') || gltf.textures.length === 0) {
            callback(null, result);
            return;
        }

        var remaining = gltf.images.length;
        var onLoad = function (idx, img) {
            result[idx] = img;
            if (--remaining === 0) {
                callback(null, result);
            }
        };

        for (var i = 0; i < gltf.images.length; ++i) {
            var imgData = gltf.images[i];

            var url;
            var mimeType;
            if (imgData.hasOwnProperty('uri')) {
                // uri specified
                if (isDataURI(imgData.uri)) {
                    url = imgData.uri;
                    mimeType = getDataURIMimeType(imgData.uri);
                } else {
                    url = pc.path.join(urlBase, imgData.uri);
                }
            } else if (imgData.hasOwnProperty('bufferView') && imgData.hasOwnProperty('mimeType')) {
                // bufferview
                var bufferView = gltf.bufferViews[imgData.bufferView];
                var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
                var byteLength = bufferView.byteLength;

                var buffer = buffers[bufferView.buffer];
                var imageBuffer = new Uint8Array(buffer.buffer, buffer.byteOffset + byteOffset, byteLength);
                var blob = new Blob([imageBuffer], { type: imgData.mimeType });
                url = URL.createObjectURL(blob);
                mimeType = imgData.mimeType;
            } else {
                // fail
                callback("Invalid image found in gltf (neither uri or bufferView found). index=" + i);
                return;
            }

            var mimeTypeFileExtensions = {
                'image/png': 'png',
                'image/jpg': 'jpg',
                'image/basis': 'basis',
                'image/ktx': 'ktx'
            };

            // construct the asset file
            var file = { url: url };
            if (mimeType) {
                var extension = mimeTypeFileExtensions[mimeType];
                if (extension) {
                    file.filename = 'glb-texture-' + i + '.' + extension;
                }
            }

            // create and load the asset
            var asset = new pc.Asset('texture_' + i, 'texture',  file, { flipY: false });
            asset.on('load', onLoad.bind(null, i));
            registry.add(asset);
            registry.load(asset);
        }
    };

    // load gltf buffers asynchronously, returning them in the callback
    var loadBuffersAsync = function (gltf, binaryChunk, urlBase, callback) {
        var result = [];

        if (gltf.buffers === null || gltf.buffers.length === 0) {
            callback(null, result);
            return;
        }

        var remaining = gltf.buffers.length;
        var onLoad = function (buffer, idx) {
            result[idx] = buffer;
            if (--remaining === 0) {
                callback(null, result);
            }
        };

        var createCallback = function (index) {
            return function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    onLoad(new Uint8Array(result), index);
                }
            };
        };

        for (var i = 0; i < gltf.buffers.length; ++i) {
            var buffer = gltf.buffers[i];
            if (buffer.hasOwnProperty('uri')) {
                if (isDataURI(buffer.uri)) {
                    // convert base64 to raw binary data held in a string
                    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                    var byteString = atob(buffer.uri.split(',')[1]);

                    // write the bytes of the string to an ArrayBuffer
                    var arrayBuffer = new ArrayBuffer(byteString.length);

                    // create a view into the buffer
                    var binaryArray = new Uint8Array(arrayBuffer);

                    // set the bytes of the buffer to the correct values
                    for (var j = 0; j < byteString.length; j++) {
                        binaryArray[j] = byteString.charCodeAt(j);
                    }

                    onLoad(binaryArray, i);
                } else {
                    pc.http.get(
                        pc.path.join(urlBase, buffer.uri),
                        { cache: true, responseType: 'arraybuffer', retry: false },
                        createCallback(i));
                }
            } else {
                // glb buffer reference
                onLoad(binaryChunk, i);
            }
        }
    };

    // parse the gltf chunk, returns the gltf json
    var parseGltf = function (gltfChunk, callback) {
        var decodeBinaryUtf8 = function (array) {
            if (typeof TextDecoder !== 'undefined') {
                return new TextDecoder().decode(array);
            }
            var str = array.reduce( function (accum, value) {
                accum += String.fromCharCode(value);
                return accum;
            }, "");
            return decodeURIComponent(escape(str));

        };

        var gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));

        // check gltf version
        if (gltf.asset && gltf.asset.version && Number.parseFloat(gltf.asset.version) < 2) {
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
    var GlbParser = function () { };

    // parse the gltf or glb data asynchronously, loading external resources
    GlbParser.parseAsync = function (filename, urlBase, data, device, registry, callback) {
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
                loadBuffersAsync(gltf, chunks.binaryChunk, urlBase, function (err, buffers) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    // async load images
                    loadTexturesAsync(device, gltf, buffers, urlBase, registry, function (err, textures) {
                        if (err) {
                            callback(err);
                            return;
                        }

                        createResources(device, gltf, buffers, textures, callback);
                    });
                });
            });
        });
    };

    // parse the gltf or glb data synchronously. external resources (buffers and images) are ignored.
    GlbParser.parse = function (filename, data, device) {
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
                        createResources(device, gltf, buffers, textures, function (err, result_) {
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

    // create a pc.Model from the parsed GLB data structures
    GlbParser.createModel = function (glb, defaultMaterial) {
        var createMeshInstance = function (model, mesh, skins, materials, node, nodeData) {
            var material = (mesh.materialIndex === undefined) ? defaultMaterial : materials[mesh.materialIndex];

            var meshInstance = new pc.MeshInstance(node, mesh, material);

            if (mesh.morph) {
                var morphInstance = new pc.MorphInstance(mesh.morph);
                if (mesh.weights) {
                    for (var wi = 0; wi < mesh.weights.length; wi++) {
                        morphInstance.setWeight(wi, mesh.weights[wi]);
                    }
                }

                meshInstance.morphInstance = morphInstance;
                model.morphInstances.push(morphInstance);
            }

            if (nodeData.hasOwnProperty('skin')) {
                var skin = skins[nodeData.skin];
                mesh.skin = skin;

                var skinInstance = new pc.SkinInstance(skin);
                skinInstance.bones = skin.bones;

                meshInstance.skinInstance = skinInstance;
                model.skinInstances.push(skinInstance);
            }

            model.meshInstances.push(meshInstance);
        };

        var model = new pc.Model();
        var i;

        var rootNodes = [];
        for (i = 0; i < glb.nodes.length; i++) {
            var node = glb.nodes[i];
            if (node.parent === null) {
                rootNodes.push(node);
            }

            var nodeData = glb.gltf.nodes[i];
            if (nodeData.hasOwnProperty('mesh')) {
                var meshGroup = glb.meshes[nodeData.mesh];
                for (var mi = 0; mi < meshGroup.length; mi++) {
                    createMeshInstance(model, meshGroup[mi], glb.skins, glb.materials, node, nodeData);
                }
            }
        }

        // set model root (create a group if there is more than one)
        if (rootNodes.length === 1) {
            model.graph = rootNodes[0];
        } else {
            model.graph = new pc.GraphNode('SceneGroup');
            for (i = 0; i < rootNodes.length; ++i) {
                model.graph.addChild(rootNodes[i]);
            }
        }

        return model;
    };

    return {
        GlbParser: GlbParser
    };
}());
