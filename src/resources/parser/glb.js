Object.assign(pc, function () {
    'use strict';

    var globals = {
        device: null,
        nodeId: 0,
        animId: 0
    }

    var isDataURI = function (uri) {
        return /^data:.*,.*$/i.test(uri);
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
    }

    var getComponentType = function (componentType) {
        switch (componentType) {
            case 5120: return pc.TYPE_INT8;
            case 5121: return pc.TYPE_UINT8;
            case 5122: return pc.TYPE_INT16;
            case 5123: return pc.TYPE_UINT16;
            case 5125: return pc.TYPE_UINT32;
            case 5126: return pc.TYPE_FLOAT32;
            default: return 0;
        }
    }

    var getComponentSizeInBytes = function (componentType) {
        switch (componentType) {
            case 5120: return 1;    // int8
            case 5121: return 1;    // uint8
            case 5122: return 2;    // int16
            case 5123: return 2;    // uint16
            case 5125: return 4;    // uint32
            case 5126: return 4;    // float32
            default: return 0;
        }
    }

    var getAccessorData = function (accessor, bufferViews, buffers) {
        var bufferView = bufferViews[accessor.bufferView];
        var typedArray = buffers[bufferView.buffer];
        var accessorByteOffset = accessor.hasOwnProperty('byteOffset') ? accessor.byteOffset : 0;
        var bufferViewByteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
        var byteOffset = typedArray.byteOffset + accessorByteOffset + bufferViewByteOffset;
        var length = accessor.count * getNumComponents(accessor.type);

        switch (accessor.componentType) {
            case 5120: return new Int8Array(typedArray.buffer, byteOffset, length);
            case 5121: return new Uint8Array(typedArray.buffer, byteOffset, length);
            case 5122: return new Int16Array(typedArray.buffer, byteOffset, length);
            case 5123: return new Uint16Array(typedArray.buffer, byteOffset, length);
            case 5125: return new Uint32Array(typedArray.buffer, byteOffset, length);
            case 5126: return new Float32Array(typedArray.buffer, byteOffset, length);
            default: return null;
        }
    }

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
    }

    var createVertexBuffer = function (attributes, indices, accessors, bufferViews, buffers) {
        var useFastPacking = true;
        if (useFastPacking) {
            var semanticMap = {
                'POSITION'  : pc.SEMANTIC_POSITION,
                'NORMAL'    : pc.SEMANTIC_NORMAL,
                'TANGENT'   : pc.SEMANTIC_TANGENT,
                'BINORMAL'  : pc.SEMANTIC_BINORMAL,
                'COLOR_0'   : pc.SEMANTIC_COLOR,
                'JOINTS_0'  : pc.SEMANTIC_BLENDINDICES,
                'WEIGHTS_0' : pc.SEMANTIC_BLENDWEIGHT,
                'TEXCOORD_0': pc.SEMANTIC_TEXCOORD0,
                'TEXCOORD_1': pc.SEMANTIC_TEXCOORD1
            };

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

            // build vertex buffer format desc
            var vertexDesc = [];
            var sourceDesc = {};
            for (var attrib in attributes) {
                if (attributes.hasOwnProperty(attrib)) {
                    var accessor = accessors[attributes[attrib]];
                    var bufferView = bufferViews[accessor.bufferView];

                    if (semanticMap.hasOwnProperty(attrib)) {
                        var semantic = semanticMap[attrib];
                        var size = getNumComponents(accessor.type) * getComponentSizeInBytes(accessor.componentType);
                        vertexDesc.push({
                            semantic: semantic,
                            components: getNumComponents(accessor.type),
                            type: getComponentType(accessor.componentType)
                        });
                        // store the info we'll need to copy this data into the vertex buffer
                        var buffer = buffers[bufferView.buffer];
                        sourceDesc[semantic] = {
                            array: new Uint32Array(buffer.buffer),
                            buffer: bufferView.buffer,
                            size: size,
                            offset: accessor.byteOffset + bufferView.byteOffset + buffer.byteOffset,
                            stride: bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size,
                            count: accessor.count
                        };
                    }
                }
            }

            // sort by engine-ideal order
            vertexDesc.sort(function (lhs, rhs) {
                var lhsOrder = elementOrder.indexOf(lhs.semantic);
                var rhsOrder = elementOrder.indexOf(rhs.semantic);
                return (lhsOrder < rhsOrder) ? -1 : (rhsOrder < lhsOrder ? 1 : 0);
            });

            // get position attribute
            var positionDesc = sourceDesc[pc.SEMANTIC_POSITION];
            var numVertices = positionDesc.count;

            // create vertex buffer
            var vertexBuffer = new pc.VertexBuffer(globals.device,
                new pc.VertexFormat(globals.device, vertexDesc),
                numVertices,
                pc.BUFFER_STATIC);

            // check whether source data is correctly interleaved
            var isCorrectlyInterleaved = true;
            for (var i=0; i<vertexBuffer.format.elements.length; ++i) {
                var target = vertexBuffer.format.elements[i];
                var source = sourceDesc[target.name];
                var sourceOffset = source.offset - positionDesc.offset;
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

            if (isCorrectlyInterleaved) {
                // copy data
                var sourceArray = new Uint32Array(positionDesc.array.buffer,
                                                  positionDesc.offset,
                                                  numVertices * vertexBuffer.format.size / 4);
                targetArray.set(sourceArray);
            } else {
                // interleave data
                for (var i=0; i<vertexBuffer.format.elements.length; ++i) {
                    var target = vertexBuffer.format.elements[i];
                    var targetStride = target.stride / 4;

                    var source = sourceDesc[target.name];
                    var sourceArray = source.array;
                    var sourceStride = source.stride / 4;

                    var src = source.offset / 4;
                    var dst = target.offset / 4;

                    for (var j=0; j<numVertices; ++j) {

                        for (var k=0; k<source.size / 4; ++k) {
                            targetArray[dst + k] = sourceArray[src + k];
                        }

                        src += sourceStride;
                        dst += targetStride;
                    }
                }
            }

            vertexBuffer.unlock();
            return vertexBuffer;
        } else {
            var positions = null;
            var normals = null;
            var tangents = null;
            var texCoord0 = null;
            var texCoord1 = null;
            var colors = null;
            var joints = null;
            var weights = null;

            var i;

            // Grab typed arrays for all vertex data
            var accessor;

            if (attributes.hasOwnProperty('POSITION') && positions === null) {
                accessor = accessors[attributes.POSITION];
                positions = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('NORMAL') && normals === null) {
                accessor = accessors[attributes.NORMAL];
                normals = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('TANGENT') && tangents === null) {
                accessor = accessors[attributes.TANGENT];
                tangents = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('TEXCOORD_0') && texCoord0 === null) {
                accessor = accessors[attributes.TEXCOORD_0];
                texCoord0 = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('TEXCOORD_1') && texCoord1 === null) {
                accessor = accessors[attributes.TEXCOORD_1];
                texCoord1 = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('COLOR_0') && colors === null) {
                accessor = accessors[attributes.COLOR_0];
                colors = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('JOINTS_0') && joints === null) {
                accessor = accessors[attributes.JOINTS_0];
                joints = getAccessorData(accessor, bufferViews, buffers);
            }
            if (attributes.hasOwnProperty('WEIGHTS_0') && weights === null) {
                accessor = accessors[attributes.WEIGHTS_0];
                weights = getAccessorData(accessor, bufferViews, buffers);
            }

            var numVertices = positions.length / 3;

            var calculateIndices = function () {
                var dummyIndices = new Uint16Array(numVertices);
                for (i = 0; i < numVertices; i++) {
                    dummyIndices[i] = i;
                }
                return dummyIndices;
            };

            if (positions !== null && normals === null) {
                // pc.calculateNormals needs indices so generate some if none are present
                normals = pc.calculateNormals(positions, (indices === null) ? calculateIndices() : indices);
            }

            var vertexDesc = [];
            if (positions) {
                vertexDesc.push({ semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 });
            }
            if (normals) {
                vertexDesc.push({ semantic: pc.SEMANTIC_NORMAL, components: 3, type: pc.TYPE_FLOAT32 });
            }
            if (tangents) {
                vertexDesc.push({ semantic: pc.SEMANTIC_TANGENT, components: 4, type: pc.TYPE_FLOAT32 });
            }
            if (texCoord0) {
                vertexDesc.push({ semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.TYPE_FLOAT32 });
            }
            if (texCoord1) {
                vertexDesc.push({ semantic: pc.SEMANTIC_TEXCOORD1, components: 2, type: pc.TYPE_FLOAT32 });
            }
            if (colors) {
                vertexDesc.push({ semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_UINT8, normalize: true });
            }
            if (joints) {
                vertexDesc.push({ semantic: pc.SEMANTIC_BLENDINDICES, components: 4, type: pc.TYPE_UINT8 });
            }
            if (weights) {
                vertexDesc.push({ semantic: pc.SEMANTIC_BLENDWEIGHT, components: 4, type: pc.TYPE_FLOAT32 });
            }

            var vertexFormat = new pc.VertexFormat(globals.device, vertexDesc);
            var vertexBuffer = new pc.VertexBuffer(globals.device, vertexFormat, numVertices, pc.BUFFER_STATIC);
            var vertexData = vertexBuffer.lock();

            var vertexDataF32 = new Float32Array(vertexData);
            var vertexDataU8  = new Uint8Array(vertexData);

            var getAttribute = function (semantic) {
                var elements = vertexFormat.elements;
                for (i = 0; i < elements.length; i++) {
                    if (elements[i].name === semantic) {
                        return elements[i];
                    }
                }
                return null;
            };

            var dstIndex, srcIndex;
            var attr, dstOffset, dstStride;
            if (positions !== null) {
                attr = getAttribute(pc.SEMANTIC_POSITION);
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 3;
                    vertexDataF32[dstIndex]     = positions[srcIndex];
                    vertexDataF32[dstIndex + 1] = positions[srcIndex + 1];
                    vertexDataF32[dstIndex + 2] = positions[srcIndex + 2];
                }
            }

            if (normals !== null) {
                attr = getAttribute(pc.SEMANTIC_NORMAL);
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 3;
                    vertexDataF32[dstIndex]     = normals[srcIndex];
                    vertexDataF32[dstIndex + 1] = normals[srcIndex + 1];
                    vertexDataF32[dstIndex + 2] = normals[srcIndex + 2];
                }
            }

            if (tangents !== null) {
                attr = getAttribute(pc.SEMANTIC_TANGENT);
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 4;
                    vertexDataF32[dstIndex]     = tangents[srcIndex];
                    vertexDataF32[dstIndex + 1] = tangents[srcIndex + 1];
                    vertexDataF32[dstIndex + 2] = tangents[srcIndex + 2];
                    vertexDataF32[dstIndex + 3] = tangents[srcIndex + 3];
                }
            }

            if (texCoord0 !== null) {
                attr = getAttribute(pc.SEMANTIC_TEXCOORD0);
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 2;
                    vertexDataF32[dstIndex]     = texCoord0[srcIndex];
                    vertexDataF32[dstIndex + 1] = texCoord0[srcIndex + 1];
                }
            }

            if (texCoord1 !== null) {
                attr = getAttribute(pc.SEMANTIC_TEXCOORD1);
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 2;
                    vertexDataF32[dstIndex]     = texCoord1[srcIndex];
                    vertexDataF32[dstIndex + 1] = texCoord1[srcIndex + 1];
                }
            }

            if (colors !== null) {
                attr = getAttribute(pc.SEMANTIC_COLOR);
                dstOffset = attr.offset;
                dstStride = attr.stride;

                accessor = accessors[attributes.COLOR_0];

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = accessor.type === 'VEC4' ? i * 4 : i * 3;
                    var r = colors[srcIndex];
                    var g = colors[srcIndex + 1];
                    var b = colors[srcIndex + 2];
                    var a = colors[srcIndex + 3];
                    vertexDataU8[dstIndex]     = Math.round(pc.math.clamp(r, 0, 1) * 255);
                    vertexDataU8[dstIndex + 1] = Math.round(pc.math.clamp(g, 0, 1) * 255);
                    vertexDataU8[dstIndex + 2] = Math.round(pc.math.clamp(b, 0, 1) * 255);
                    vertexDataU8[dstIndex + 3] = accessor.type === 'VEC4' ? Math.round(pc.math.clamp(a, 0, 1) * 255) : 255;
                }
            }

            if (joints !== null) {
                attr = getAttribute(pc.SEMANTIC_BLENDINDICES);
                dstOffset = attr.offset;
                dstStride = attr.stride;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 4;
                    vertexDataU8[dstIndex]     = joints[srcIndex];
                    vertexDataU8[dstIndex + 1] = joints[srcIndex + 1];
                    vertexDataU8[dstIndex + 2] = joints[srcIndex + 2];
                    vertexDataU8[dstIndex + 3] = joints[srcIndex + 3];
                }
            }

            if (weights !== null) {
                attr = getAttribute(pc.SEMANTIC_BLENDWEIGHT);
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = i * 4;
                    vertexDataF32[dstIndex]     = weights[srcIndex];
                    vertexDataF32[dstIndex + 1] = weights[srcIndex + 1];
                    vertexDataF32[dstIndex + 2] = weights[srcIndex + 2];
                    vertexDataF32[dstIndex + 3] = weights[srcIndex + 3];
                }
            }

            vertexBuffer.unlock();
            return vertexBuffer;
        }
    }

    var createSkin = function (skinData, accessors, bufferViews, nodes, buffers) {
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

        var skin = new pc.Skin(globals.device, ibp, boneNames);
        skin.skeleton = nodes[skeleton];

        skin.bones = [];
        for (i = 0; i < joints.length; i++) {
            skin.bones[i] = nodes[joints[i]];
        }

        return skin;
    }

    var tempMat = new pc.Mat4();
    var tempVec = new pc.Vec3();
    var createMesh = function (meshData, accessors, bufferViews, buffers) {
        var meshes = [];

        meshData.primitives.forEach(function (primitive) {
            var attributes = primitive.attributes;

            var i;

            /*
            // Start by looking for compressed vertex data for this primitive
            if (primitive.hasOwnProperty('extensions')) {
                var extensions = primitive.extensions;
                if (extensions.hasOwnProperty('KHR_draco_mesh_compression')) {
                    var extDraco = extensions.KHR_draco_mesh_compression;

                    var bufferView = bufferViews[extDraco.bufferView];
                    var arrayBuffer = buffers[bufferView.buffer];
                    var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
                    var uint8Buffer = new Int8Array(arrayBuffer, byteOffset, bufferView.byteLength);

                    var decoderModule = decoderModule;
                    var buffer = new decoderModule.DecoderBuffer();
                    buffer.Init(uint8Buffer, uint8Buffer.length);

                    var decoder = new decoderModule.Decoder();
                    var geometryType = decoder.GetEncodedGeometryType(buffer);

                    var outputGeometry, status;
                    switch (geometryType) {
                        case decoderModule.INVALID_GEOMETRY_TYPE:
                            console.error('Invalid geometry type');
                            break;
                        case decoderModule.POINT_CLOUD:
                            outputGeometry = new decoderModule.PointCloud();
                            status = decoder.DecodeBufferToPointCloud(buffer, outputGeometry);
                            break;
                        case decoderModule.TRIANGULAR_MESH:
                            outputGeometry = new decoderModule.Mesh();
                            status = decoder.DecodeBufferToMesh(buffer, outputGeometry);
                            break;
                    }

                    if (!status.ok() || outputGeometry.ptr == 0) {
                        var errorMsg = status.error_msg();
                        console.error(errorMsg);
                    }

                    var numPoints = outputGeometry.num_points();
                    var numFaces = outputGeometry.num_faces();

                    if (extDraco.hasOwnProperty('attributes')) {
                        var extractAttribute = function (uniqueId) {
                            var attribute = decoder.GetAttributeByUniqueId(outputGeometry, uniqueId);
                            var attributeData = new decoderModule.DracoFloat32Array();
                            decoder.GetAttributeFloatForAllPoints(outputGeometry, attribute, attributeData);
                            var numValues = numPoints * attribute.num_components();
                            var values = new Float32Array(numValues);

                            for (i = 0; i < numValues; i++) {
                                values[i] = attributeData.GetValue(i);
                            }

                            decoderModule.destroy(attributeData);
                            return values;
                        };

                        var dracoAttribs = extDraco.attributes;
                        if (dracoAttribs.hasOwnProperty('POSITION'))
                            positions = extractAttribute(dracoAttribs.POSITION);
                        if (dracoAttribs.hasOwnProperty('NORMAL'))
                            normals   = extractAttribute(dracoAttribs.NORMAL);
                        if (dracoAttribs.hasOwnProperty('TANGENT'))
                            tangents  = extractAttribute(dracoAttribs.TANGENT);
                        if (dracoAttribs.hasOwnProperty('TEXCOORD_0'))
                            texCoord0 = extractAttribute(dracoAttribs.TEXCOORD_0);
                        if (dracoAttribs.hasOwnProperty('TEXCOORD_1'))
                            texCoord1 = extractAttribute(dracoAttribs.TEXCOORD_1);
                        if (dracoAttribs.hasOwnProperty('COLOR_0'))
                            colors    = extractAttribute(dracoAttribs.COLOR_0);
                        if (dracoAttribs.hasOwnProperty('JOINTS_0'))
                            joints    = extractAttribute(dracoAttribs.JOINTS_0);
                        if (dracoAttribs.hasOwnProperty('WEIGHTS_0'))
                            weights   = extractAttribute(dracoAttribs.WEIGHTS_0);
                    }

                    if (geometryType == decoderModule.TRIANGULAR_MESH) {
                        var face = new decoderModule.DracoInt32Array();
                        indices = (numPoints > 65535) ? new Uint32Array(numFaces * 3) : new Uint16Array(numFaces * 3);
                        for (i = 0; i < numFaces; ++i) {
                            decoder.GetFaceFromMesh(outputGeometry, i, face);
                            indices[i * 3]     = face.GetValue(0);
                            indices[i * 3 + 1] = face.GetValue(1);
                            indices[i * 3 + 2] = face.GetValue(2);
                        }
                        decoderModule.destroy(face);
                    }

                    decoderModule.destroy(outputGeometry);
                    decoderModule.destroy(decoder);
                    decoderModule.destroy(buffer);
                }
            }
            //*/

            // get indices
            var indices =
                primitive.hasOwnProperty('indices') ?
                    getAccessorData(accessors[primitive.indices], bufferViews, buffers) : null;

            var vertexBuffer = createVertexBuffer(attributes, indices, accessors, bufferViews, buffers);

            var mesh = new pc.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.primitive[0].type = getPrimitiveType(primitive);
            mesh.primitive[0].base = 0;
            mesh.primitive[0].indexed = (indices !== null);
            if (indices !== null) {
                var indexFormat;
                if (indices instanceof Uint8Array) {
                    indexFormat = pc.INDEXFORMAT_UINT8;
                } else if (indices instanceof Uint16Array) {
                    indexFormat = pc.INDEXFORMAT_UINT16;
                } else {
                    indexFormat = pc.INDEXFORMAT_UINT32;
                }
                var numIndices = indices.length;
                var indexBuffer = new pc.IndexBuffer(globals.device, indexFormat, numIndices, pc.BUFFER_STATIC, indices);
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

            if (primitive.hasOwnProperty('targets')) {
                var targets = [];

                primitive.targets.forEach(function (target) {
                    var options = {};
                    if (target.hasOwnProperty('POSITION')) {
                        accessor = accessors[target.POSITION];
                        options.deltaPositions = getAccessorData(accessor, bufferViews, buffers);
                    }
                    if (target.hasOwnProperty('NORMAL')) {
                        accessor = accessors[target.NORMAL];
                        options.deltaNormals = getAccessorData(accessor, bufferViews, buffers);
                    }
                    if (target.hasOwnProperty('TANGENT')) {
                        accessor = accessors[target.TANGENT];
                        options.deltaTangents = getAccessorData(accessor, bufferViews, buffers);
                    }

                    targets.push(new pc.MorphTarget(options));
                });

                mesh.morph = new pc.Morph(targets);
            }

            meshes.push(mesh);
        });

        return meshes;
    }

    var createMaterial = function (materialData, textures) {
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

        if (materialData.hasOwnProperty('extensions') &&
            materialData.extensions.hasOwnProperty('KHR_materials_unlit')) {
            material.useLighting = false;
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
                texture = textures[diffuseTexture.index];

                material.diffuseMap = texture;
                material.diffuseMapChannel = 'rgb';
                material.opacityMap = texture;
                material.opacityMapChannel = 'a';
                if (diffuseTexture.hasOwnProperty('texCoord')) {
                    material.diffuseMapUv = diffuseTexture.texCoord;
                    material.opacityMapUv = diffuseTexture.texCoord;
                }
                if (diffuseTexture.hasOwnProperty('extensions') &&
                    diffuseTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                    var diffuseTransformData = diffuseTexture.extensions.KHR_texture_transform;
                    if (diffuseTransformData.hasOwnProperty('scale')) {
                        material.diffuseMapTiling = new pc.Vec2(diffuseTransformData.scale[0], diffuseTransformData.scale[1]);
                        material.opacityMapTiling = new pc.Vec2(diffuseTransformData.scale[0], diffuseTransformData.scale[1]);
                    }
                    if (diffuseTransformData.hasOwnProperty('offset')) {
                        material.diffuseMapOffset = new pc.Vec2(diffuseTransformData.offset[0], diffuseTransformData.offset[1]);
                        material.opacityMapOffset = new pc.Vec2(diffuseTransformData.offset[0], diffuseTransformData.offset[1]);
                    }
                }
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
                material.specularMap = textures[specularGlossinessTexture.index];
                material.specularMapChannel = 'rgb';
                material.glossMap = textures[specularGlossinessTexture.index];
                material.glossMapChannel = 'a';
                if (specularGlossinessTexture.hasOwnProperty('texCoord')) {
                    material.glossMapUv = specularGlossinessTexture.texCoord;
                    material.metalnessMapUv = specularGlossinessTexture.texCoord;
                }
                if (specularGlossinessTexture.hasOwnProperty('extensions') &&
                    specularGlossinessTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                    var specGlossTransformData = specularGlossinessTexture.extensions.KHR_texture_transform;
                    if (specGlossTransformData.hasOwnProperty('scale')) {
                        material.glossMapTiling = new pc.Vec2(specGlossTransformData.scale[0], specGlossTransformData.scale[1]);
                        material.metalnessMapTiling = new pc.Vec2(specGlossTransformData.scale[0], specGlossTransformData.scale[1]);
                    }
                    if (specGlossTransformData.hasOwnProperty('offset')) {
                        material.glossMapOffset = new pc.Vec2(specGlossTransformData.offset[0], specGlossTransformData.offset[1]);
                        material.metalnessMapOffset = new pc.Vec2(specGlossTransformData.offset[0], specGlossTransformData.offset[1]);
                    }
                }
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
                texture = textures[baseColorTexture.index];

                material.diffuseMap = texture;
                material.diffuseMapChannel = 'rgb';
                material.opacityMap = texture;
                material.opacityMapChannel = 'a';
                if (baseColorTexture.hasOwnProperty('texCoord')) {
                    material.diffuseMapUv = baseColorTexture.texCoord;
                    material.opacityMapUv = baseColorTexture.texCoord;
                }
                if (baseColorTexture.hasOwnProperty('extensions') &&
                    baseColorTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                    var baseColorTransformData = baseColorTexture.extensions.KHR_texture_transform;
                    if (baseColorTransformData.hasOwnProperty('scale')) {
                        material.diffuseMapTiling = new pc.Vec2(baseColorTransformData.scale[0], baseColorTransformData.scale[1]);
                        material.opacityMapTiling = new pc.Vec2(baseColorTransformData.scale[0], baseColorTransformData.scale[1]);
                    }
                    if (baseColorTransformData.hasOwnProperty('offset')) {
                        material.diffuseMapOffset = new pc.Vec2(baseColorTransformData.offset[0], baseColorTransformData.offset[1]);
                        material.opacityMapOffset = new pc.Vec2(baseColorTransformData.offset[0], baseColorTransformData.offset[1]);
                    }
                }
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
                material.metalnessMap = textures[metallicRoughnessTexture.index];
                material.metalnessMapChannel = 'b';
                material.glossMap = textures[metallicRoughnessTexture.index];
                material.glossMapChannel = 'g';
                if (metallicRoughnessTexture.hasOwnProperty('texCoord')) {
                    material.glossMapUv = metallicRoughnessTexture.texCoord;
                    material.metalnessMapUv = metallicRoughnessTexture.texCoord;
                }
                if (metallicRoughnessTexture.hasOwnProperty('extensions') &&
                    metallicRoughnessTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                    var metallicTransformData = metallicRoughnessTexture.extensions.KHR_texture_transform;
                    if (metallicTransformData.hasOwnProperty('scale')) {
                        material.glossMapTiling = new pc.Vec2(metallicTransformData.scale[0], metallicTransformData.scale[1]);
                        material.metalnessMapTiling = new pc.Vec2(metallicTransformData.scale[0], metallicTransformData.scale[1]);
                    }
                    if (metallicTransformData.hasOwnProperty('offset')) {
                        material.glossMapOffset = new pc.Vec2(metallicTransformData.offset[0], metallicTransformData.offset[1]);
                        material.metalnessMapOffset = new pc.Vec2(metallicTransformData.offset[0], metallicTransformData.offset[1]);
                    }
                }
            }

            material.chunks.glossPS = glossChunk;
        }

        if (materialData.hasOwnProperty('normalTexture')) {
            var normalTexture = materialData.normalTexture;
            material.normalMap = textures[normalTexture.index];
            if (normalTexture.hasOwnProperty('texCoord')) {
                material.normalMapUv = normalTexture.texCoord;
            }
            if (normalTexture.hasOwnProperty('extensions') &&
                normalTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                var normalTransformData = normalTexture.extensions.KHR_texture_transform;
                if (normalTransformData.hasOwnProperty('scale')) {
                    material.normalMapTiling = new pc.Vec2(normalTransformData.scale[0], normalTransformData.scale[1]);
                }
                if (normalTransformData.hasOwnProperty('offset')) {
                    material.normalMapOffset = new pc.Vec2(normalTransformData.offset[0], normalTransformData.offset[1]);
                }
            }
            if (normalTexture.hasOwnProperty('scale')) {
                material.bumpiness = normalTexture.scale;
            }
        }
        if (materialData.hasOwnProperty('occlusionTexture')) {
            var occlusionTexture = materialData.occlusionTexture;
            material.aoMap = textures[occlusionTexture.index];
            material.aoMapChannel = 'r';
            if (occlusionTexture.hasOwnProperty('texCoord')) {
                material.aoMapUv = occlusionTexture.texCoord;
            }
            if (occlusionTexture.hasOwnProperty('extensions') &&
                occlusionTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                var occlusionTransformData = occlusionTexture.extensions.KHR_texture_transform;
                if (occlusionTransformData.hasOwnProperty('scale')) {
                    material.aoMapTiling = new pc.Vec2(occlusionTransformData.scale[0], occlusionTransformData.scale[1]);
                }
                if (occlusionTransformData.hasOwnProperty('offset')) {
                    material.aoMapOffset = new pc.Vec2(occlusionTransformData.offset[0], occlusionTransformData.offset[1]);
                }
            }
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
            material.emissiveMap = textures[emissiveTexture.index];
            if (emissiveTexture.hasOwnProperty('texCoord')) {
                material.emissiveMapUv = emissiveTexture.texCoord;
            }
            if (emissiveTexture.hasOwnProperty('extensions') &&
                emissiveTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                var emissiveTransformData = emissiveTexture.extensions.KHR_texture_transform;
                if (emissiveTransformData.hasOwnProperty('scale')) {
                    material.emissiveMapTiling = new pc.Vec2(emissiveTransformData.scale[0], emissiveTransformData.scale[1]);
                }
                if (emissiveTransformData.hasOwnProperty('offset')) {
                    material.emissiveMapOffset = new pc.Vec2(emissiveTransformData.offset[0], emissiveTransformData.offset[1]);
                }
            }
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

        material.update();

        return material;
    }

    var createTexture = function (textureData, samplers, images) {
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
        }

        var getWrap = function(wrap) {
            switch (wrap) {
                case 33071: return pc.ADDRESS_CLAMP_TO_EDGE;
                case 33648: return pc.ADDRESS_MIRRORED_REPEAT;
                case 10497: return pc.ADDRESS_REPEAT;
                default:    return pc.ADDRESS_REPEAT;
            }
        }

        var samplerData = samplers[textureData.sampler];
        var options = {
            name: textureData.name,
            minFilter: getFilter(samplerData.minFilter),
            magFilter: getFilter(samplerData.magFilter),
            addressU: getWrap(samplerData.wrapS),
            addressV: getWrap(samplerData.wrapT),
            flipY: false
        };

        var result = new pc.Texture(globals.device, options);
        result.setSource(images[textureData.source]);
        return result;
    }

    var createAnimation = function (animationData, accessors, bufferViews, nodes, buffers) {
        var _insertKey = function (key, idx, keys, skip) {
            if (idx === 0) {
                keys.push(key);
            } else if (keys[keys.length - 1].value.equals(key.value)) {
                skip = key;
            } else {
                if (skip) {
                    keys.push(skip);
                }
                skip = null;
                keys.push(key);
            }
            return skip;
        };
    
        var _insertKeysVec3 = function (keys, interpolation, times, values) {
            var time, value, i;
            var skip = null;
            if (interpolation === "CUBICSPLINE") {
                for (i = 0; i < times.length; i++) {
                    time = times[i];
                    value = new pc.Vec3(values[9 * i + 3], values[9 * i + 4], values[9 * i + 5]);
                    skip = _insertKey(new pc.Keyframe(time, value), i, keys, skip);
                }
            } else {
                for (i = 0; i < times.length; i++) {
                    time = times[i];
                    value = new pc.Vec3(values[3 * i + 0], values[3 * i + 1], values[3 * i + 2]);
                    skip = _insertKey(new pc.Keyframe(time, value), i, keys, skip);
                }
            }
        };
    
        var _insertKeysQuat = function (keys, interpolation, times, values) {
            var time, value, i;
            var skip = null;
            if (interpolation === "CUBICSPLINE") {
                for (i = 0; i < times.length; i++) {
                    time = times[i];
                    value = new pc.Quat(values[12 * i + 4], values[12 * i + 5], values[12 * i + 6], values[12 * i + 7]);
                    skip = _insertKey(new pc.Keyframe(time, value), i, keys, skip);
                }
            } else {
                for (i = 0; i < times.length; i++) {
                    time = times[i];
                    value = new pc.Quat(values[4 * i + 0], values[4 * i + 1], values[4 * i + 2], values[4 * i + 3]);
                    skip = _insertKey(new pc.Keyframe(time, value), i, keys, skip);
                }
            }
        };

        var anim = new pc.Animation();
        anim.loop = true;
        anim.setName(animationData.hasOwnProperty('name') ? animationData.name : ("animation_" + globals.animId++));

        var nodesMap = {};
        var node = null;
        var timeMin = Number.POSITIVE_INFINITY;
        var timeMax = Number.NEGATIVE_INFINITY;

        for (var channel, idx = 0; idx < animationData.channels.length; idx++) {
            channel = animationData.channels[idx];

            var sampler = animationData.samplers[channel.sampler];
            var times = getAccessorData(accessors[sampler.input], bufferViews, buffers);
            var values = getAccessorData(accessors[sampler.output], bufferViews, buffers);

            var target = channel.target;
            var path = target.path;

            node = nodesMap[target.node];
            if (!node) {
                node = new pc.Node();
                var entity = nodes[target.node];
                node._name = entity.name;
                anim.addNode(node);
                nodesMap[target.node] = node;
            }

            switch (path) {
                case "translation":
                    _insertKeysVec3(node._keys[pc.KEYTYPE_POS], sampler.interpolation, times, values);
                    break;
                case "scale":
                    _insertKeysVec3(node._keys[pc.KEYTYPE_SCL], sampler.interpolation, times, values);
                    break;
                case "rotation":
                    _insertKeysQuat(node._keys[pc.KEYTYPE_ROT], sampler.interpolation, times, values);
                    break;
                case 'weights':
                    // console.log("GLB animations for weights not supported");
                    break;
            }

            // update animation time
            for (var i = 0; i < times.length; ++i) {
                timeMin = Math.min(timeMin, times[i]);
                timeMax = Math.max(timeMax, times[i]);
            }
        }

        anim.duration = timeMax - timeMin;

        return anim;
    };

    // create the anim structure
    var createAnim = function (animationData, accessors, bufferViews, nodes, buffers) {

        // create animation data block for the accessor
        var createAnimData = function (accessor) {
            var data = getAccessorData(accessor, bufferViews, buffers);
            // TODO: this assumes data is tightly packed, handle the case data is interleaved
            return new pc.AnimData(getNumComponents(accessor.type), new data.constructor(data));
        };

        var interpMap = {
            "STEP": pc.AnimInterpolation.STEP,
            "LINEAR": pc.AnimInterpolation.LINEAR,
            "CUBICSPLINE": pc.AnimInterpolation.CUBIC
        }

        var pathMap = {
            "translation": "_translation",
            "rotation": "_rotation",
            "scale": "_scale"
        }

        var inputMap = { };
        var inputs = [];

        var outputMap = { };
        var outputs = [];

        var curves = [];

        // convert samplers
        for (var i=0; i<animationData.samplers.length; ++i) {
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

            // create curve
            curves.push(new pc.AnimCurve(
                inputMap[sampler.input],
                outputMap[sampler.output],
                interpMap[sampler.interpolation]));
        }

        // convert nodes -> anim targets
        var targets = nodes.map(function (node) {
            return new pc.AnimTarget(node.name, -1, -1, -1);
        });

        // convert anim target channels
        for (var i=0; i<animationData.channels.length; ++i) {
            var channel = animationData.channels[i];
            var target = channel.target;
            targets[target.node][pathMap[target.path]] = channel.sampler;
        }

        // calculate duration of the animation as maximum time value
        var duration = inputs.reduce(function (value, input) {
            return Math.max(value, input[input.length - 1]);
        });

        return new pc.AnimTrack(
            animationData.hasOwnProperty('name') ? animationData.name : ("animation_" + globals.animId++),
            duration,
            inputs,
            outputs,
            curves,
            targets);
    };

    var createNode = function (nodeData) {
        var entity = new pc.GraphNode();

        if (nodeData.hasOwnProperty('name')) {
            entity.name = nodeData.name;
        } else {
            entity.name = "node_" + globals.nodeId++;
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
    }

    var createSkins = function (gltf, nodes, buffers) {
        if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
            return [];
        } else {
            return gltf.skins.map(function (skinData) {
                return createSkin(skinData, gltf.accessors, gltf.bufferViews, nodes, buffers);
            });
        }
    }

    var createMeshes = function (gltf, buffers) {
        if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 ||
            !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 ||
            !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
            return [];
        } else {
            return gltf.meshes.map(function (meshData) {
                return createMesh(meshData, gltf.accessors, gltf.bufferViews, buffers);
            });
        }
    }

    var createMaterials = function (gltf, textures) {
        if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
            return [];
        } else {
            return gltf.materials.map(function(materialData) {
                return createMaterial(materialData, textures);
            });
        }
    }

    var createTextures = function (gltf, images) {
        if (!gltf.hasOwnProperty('textures') || gltf.textures.length === 0 ||
            !gltf.hasOwnProperty('samplers') || gltf.samplers.length === 0) {
            return [];
        } else {
            return gltf.textures.map(function (textureData) {
                return createTexture(textureData, gltf.samplers, images);
            });
        }
    }

    var createAnimations = function (gltf, nodes, buffers) {
        if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
            return [];
        } else {
            return gltf.animations.map(function (animationData) {
                //return createAnimation(animationData, gltf.accessors, gltf.bufferViews, nodes, buffers);
                return createAnim(animationData, gltf.accessors, gltf.bufferViews, nodes, buffers);
            });
        }
    }

    var createNodes = function (gltf) {
        if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
            return [];
        } else {
            var nodes = gltf.nodes.map(createNode);

            // build node hierarchy
            for (var i=0; i<gltf.nodes.length; ++i) {
                var nodeData = gltf.nodes[i];
                if (nodeData.hasOwnProperty('children')) {
                    for (var j=0; j<nodeData.children.length; ++j) {
                        var parent = nodes[i];
                        var child = nodes[nodeData.children[j]]
                        if (!child.parent) {
                            parent.addChild(child);
                        }
                    }
                }
            }

            return nodes;
        }
    }

    // test if the image at imageIndex must be resized to power of two
    var imageRequiresResize = function (img, idx, textures, samplers) {
        if (isPower2d(img.width, img.height) ||         // already pot
            globals.device.webgl2) {             // webgl2 doesn't have POT restrictions
            return false;
        }

        for (var i=0; i<textures.length; ++i) {
            var texture = textures[i];
            if (texture.hasOwnProperty('source') &&
                texture.hasOwnProperty('sampler') &&
                texture.source === idx) {
                var wraps = [
                    10497,  // REPEAT
                    33648   // MIRRORED_REPEAT
                ];
                var minFilters = [
                    9984,   // NEAREST_MIPMAP_NEAREST,
                    9985,   // LINEAR_MIPMAP_NEAREST,
                    9986,   // NEAREST_MIPMAP_LINEAR,
                    9987    // LINEAR_MIPMAP_LINEAR
                ];
                var sampler = samplers[texture.sampler];
                if (wraps.indexOf(sampler.wrapS) !== -1 ||
                    wraps.indexOf(sampler.wrapT) !== -1 ||
                    minFilters.indexOf(sampler.minFilter) !== -1) {
                    return true;
                }
            }
        }
        return false;
    }

    // resample image to nearest power of two
    var resampleImage = function (img) {
        var canvas = document.createElement('canvas');
        canvas.width = nearestPow2(img.width);
        canvas.height = nearestPow2(img.height);

        var context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);

        // set the new image src, this function will be invoked again
        return canvas.toDataURL();
    }

    // load gltf images
    var loadImagesAsync = function (gltf, buffers, callback) {
        var result = [];

        if (!gltf.hasOwnProperty('images') || gltf.images.length === 0 ||
            !gltf.hasOwnProperty('samplers') || gltf.sampers.length === 0 ||
            !gltf.hasOwnProperty('textures') || gltf.textures.length === 0) {
            callback(null, result);
            return;
        }

        var remaining = gltf.images.length;
        var onLoad = function (img, idx) {
            if (imageRequiresResize(img, idx, gltf.textures, gltf.samplers)) {
                img.src = resampleImage(img);   // onLoad will get called again
            } else {
                img.removeEventListener('load', img.loadEvent, false);
                result[idx] = img;
                if (--remaining === 0) {
                    callback(null, result);
                }
            }
        };

        for (var i=0; i<gltf.images.length; ++i) {
            var img = new Image();
            img.loadEvent = onLoad.bind(this, img, i);
            img.addEventListener('load', img.loadEvent, false);

            var imgData = gltf.images[i];
            if (imgData.hasOwnProperty('uri')) {
                // uri specified
                if (isDataURI(imgData.uri)) {
                    img.src = imgData.uri;
                } else {
                    img.crossOrigin = "anonymous";
                    img.src = imgData.uri;
                }
            } else if (imgData.hasOwnProperty('bufferView') && imgData.hasOwnProperty('mimeType')) {
                // bufferview
                var bufferView = gltf.bufferViews[imgData.bufferView];
                var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
                var byteLength = bufferView.byteLength;

                var buffer = buffers[bufferView.buffer];
                var imageBuffer = new Uint8Array(buffer.buffer, buffer.byteOffset + byteOffset, byteLength);
                var blob = new Blob([imageBuffer], { type: imgData.mimeType });
                img.src = URL.createObjectURL(blob);
            } else {
                // fail
                callback("Invalid image found in gltf (neither uri or bufferView found). index=" + i);
                return;
            }
        }
    };

    // load gltf buffers
    var loadBuffersAsync = function (gltf, binaryChunk, callback) {
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

        for (var i=0; i<gltf.buffers.length; ++i) {
            var buffer = gltf.buffers[i];
            if (buffer.hasOwnProperty('uri')) {
                if (isDataURI(buffer.uri)) {
                    // convert base64 to raw binary data held in a string
                    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                    var byteString = atob(buffer.uri.split(',')[1]);

                    // write the bytes of the string to an ArrayBuffer
                    var arrayBuffer = new ArrayBuffer(byteString.length);

                    // create a view into the buffer
                    var uint8Array = new Uint8Array(arrayBuffer);

                    // set the bytes of the buffer to the correct values
                    for (var i = 0; i < byteString.length; i++) {
                        uint8Array[i] = byteString.charCodeAt(i);
                    }

                    onLoad(uint8Array, i);
                } else {
                    var xhr = new XMLHttpRequest();
                    xhr.responseType = 'arraybuffer';
                    xhr.open('GET', buffer.uri, true);
                    xhr.onload = function () {
                        onLoad(new Uint8Array(this.response), i);
                    };
                    xhr.send();
                }
            } else {
                // glb buffer reference
                onLoad(binaryChunk, i);
            }
        }
    };

    // load a GLB
    var loadGLBAsync = function (glbData, callback) {
        var data = new DataView(glbData);

        // read header
        var magic = data.getUint32(0, true);
        var version = data.getUint32(4, true);
        var length = data.getUint32(8, true);

        if (magic !== 0x46546C67) {
            callback("Invalid magic number found in glb header. Expected 0x46546C67, found 0x" + magic.toString(16));
            return null;
        }

        if (version !== 2) {
            callback("Invalid version number found in glb header. Expected 2, found " + version);
            return null;
        }

        if (length <= 0 || length > glbData.byteLength) {
            callback("Invalid length found in glb header. Found " + length);
            return null;
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
            return null;
        }

        if (chunks[0].type !== 0x4E4F534A) {
            callback("Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x" + chunks[0].type.toString(16));
            return null;
        }

        if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
            callback("Invalid chunk type found in glb file. Expected 0x004E4942, found 0x" + chunks[1].type.toString(16));
            return null;
        }

        var decodeBinaryUtf8 = function (array) {
            if (typeof TextDecoder !== 'undefined') {
                return new TextDecoder().decode(array);
            } else {
                var str = array.reduce( function (accum, value) {
                    accum += String.fromCharCode(value);
                }, "");
                return decodeURIComponent(escape(str));
            }
        };

        var gltf = JSON.parse(decodeBinaryUtf8(chunks[0].data));
        var binaryChunk = chunks.length === 2 ? chunks[1].data : null;

        // load buffers
        loadBuffersAsync(gltf, binaryChunk, function (err, buffers) {
            if (err) {
                callback(err);
                return;
            }

            // load images
            loadImagesAsync(gltf, buffers, function (err, images) {
                if (err) {
                    callback(err);
                    return;
                }

                // create engine resources
                var nodes = createNodes(gltf);
                var animations = createAnimations(gltf, nodes, buffers);
                var textures = createTextures(gltf, images);
                var materials = createMaterials(gltf, textures);
                var meshes = createMeshes(gltf, buffers);
                var skins = createSkins(gltf, nodes, buffers);

                callback(null, {
                    'gltf': gltf,
                    'nodes': nodes,
                    'animations': animations,
                    'textures': textures,
                    'materials': materials,
                    'meshes': meshes,
                    'skins': skins
                });
            });
        });
    };

    //-- GlbParser
    var GlbParser = function () { };

    GlbParser.parse = function (glbData, device, callback) {
        // reset global state
        globals.device = device;
        globals.nodeId = 0;
        globals.animId = 0;
        loadGLBAsync(glbData, callback);
    };

    return {
        GlbParser: GlbParser
    };
}());