(function () {

    var Anim;
    function initAnim() {
        if (Anim) return;
        Anim = pc.createScript('anim');

        Anim.prototype.initialize = function () {
            if(!this.animGroup || this.animGroup.animationCount() === 0 ||
                !this.animGroup.getCurrentAnimation())
                return;
 
            if(!this.animGroup.getCurrentAnimation().loop)
                this.animGroup.getCurrentAnimation().loop = true;
            this.animGroup.getCurrentAnimation().play();
        };

        Anim.prototype.update = function (dt) {
            if(!this.animGroup || this.animGroup.animationCount() === 0 ||
                !this.animGroup.getCurrentAnimation())
                return; 
        };
    }

    // Math utility functions
    function nearestPow2(n) {
        return Math.pow(2, Math.round(Math.log(n) / Math.log(2)));
    }

    function isPowerOf2(n) {
        return n && (n & (n - 1)) === 0;
    }

    function getPrimitiveType(primitive) {
        var primType = pc.PRIMITIVE_TRIANGLES;

        if (primitive.hasOwnProperty('mode')) {
            switch (primitive.mode) {
                case 0: primType = pc.PRIMITIVE_POINTS; break;
                case 1: primType = pc.PRIMITIVE_LINES; break;
                case 2: primType = pc.PRIMITIVE_LINELOOP; break;
                case 3: primType = pc.PRIMITIVE_LINESTRIP; break;
                case 4: primType = pc.PRIMITIVE_TRIANGLES; break;
                case 5: primType = pc.PRIMITIVE_TRISTRIP; break;
                case 6: primType = pc.PRIMITIVE_TRIFAN; break;
            }
        }

        return primType;
    }

    function getAccessorTypeSize(type) {
        var size = 3;

        switch (type) {
            case 'SCALAR': size = 1; break;
            case 'VEC2': size = 2; break;
            case 'VEC3': size = 3; break;
            case 'VEC4': size = 4; break;
            case 'MAT2': size = 4; break;
            case 'MAT3': size = 9; break;
            case 'MAT4': size = 16; break;
        }

        return size;
    }

    function getFilter(filter) {
        var pcFilter = pc.FILTER_LINEAR;

        switch (filter) {
            case 9728: pcFilter = pc.FILTER_NEAREST; break;
            case 9729: pcFilter = pc.FILTER_LINEAR; break;
            case 9984: pcFilter = pc.FILTER_NEAREST_MIPMAP_NEAREST; break;
            case 9985: pcFilter = pc.FILTER_LINEAR_MIPMAP_NEAREST; break;
            case 9986: pcFilter = pc.FILTER_NEAREST_MIPMAP_LINEAR; break;
            case 9987: pcFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR; break;
        }

        return pcFilter;
    }

    function getWrap(wrap) {
        var pcWrap = pc.ADDRESS_REPEAT;

        switch (wrap) {
            case 33071: pcWrap = pc.ADDRESS_CLAMP_TO_EDGE; break;
            case 33648: pcWrap = pc.ADDRESS_MIRRORED_REPEAT; break;
            case 10497: pcWrap = pc.ADDRESS_REPEAT; break;
        }

        return pcWrap;
    }

    function isDataURI(uri) {
        return /^data:.*,.*$/i.test(uri);
    }

    function getAccessorData(gltf, accessor, buffers) {
        var bufferView = gltf.bufferViews[accessor.bufferView];
        var arrayBuffer = buffers[bufferView.buffer];
        var accessorByteOffset = accessor.hasOwnProperty('byteOffset') ? accessor.byteOffset : 0;
        var bufferViewByteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
        var byteOffset = accessorByteOffset + bufferViewByteOffset;
        var length = accessor.count * getAccessorTypeSize(accessor.type);

        var data = null;

        switch (accessor.componentType) {
            case 5120: data = new Int8Array(arrayBuffer, byteOffset, length); break;
            case 5121: data = new Uint8Array(arrayBuffer, byteOffset, length); break;
            case 5122: data = new Int16Array(arrayBuffer, byteOffset, length); break;
            case 5123: data = new Uint16Array(arrayBuffer, byteOffset, length); break;
            case 5125: data = new Uint32Array(arrayBuffer, byteOffset, length); break;
            case 5126: data = new Float32Array(arrayBuffer, byteOffset, length); break;
        }

        return data;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animation
    function translateAnimation(data, resources) {
        var animation = new pc.Animation();
        if(data.hasOwnProperty('name'))
            animation.name = data.name;

        var gltf = resources.gltf;
        var animGroup = null;

        data.channels.forEach(function (channel) {
            var sampler = data.samplers[channel.sampler];
            var times = getAccessorData(gltf, gltf.accessors[sampler.input], resources.buffers);
            var values = getAccessorData(gltf, gltf.accessors[sampler.output], resources.buffers);
            var time, value;

            var target = channel.target;
            var path = target.path;
            var curve, keyType;
            var i, j;

            // Animation for the same root, organized in one AnimationComponent
            var entity = resources.nodes[target.node];
            var itsRoot = resources.nodes[0]; // entity.root;
            if (!itsRoot.script)
                itsRoot.addComponent('script');

            if (!itsRoot.script.anim) {
                itsRoot.script.create('anim');
                itsRoot.script.anim.animGroup = new pc.AnimationGroup();
                //may not be needed AnimationClip.app = itsRoot.script.anim.app;
                itsRoot.script.anim.animGroup.curAnimation = animation.name;
            }
            animGroup = itsRoot.script.anim.animGroup;

            if (path === 'weights') {
                var numCurves = values.length / times.length;
                for (i = 0; i < numCurves; i++) {
                    curve = new pc.AnimationCurve();
                    keyType = AnimationKeyableType.NUM;
                    curve.keyableType = keyType;
                    curve.addTarget(entity, path, i);
                    if (sampler.interpolation === "CUBIC")
                        curve.type = AnimationCurveType.CUBIC;
                    else if (sampler.interpolation === "STEP")
                        curve.type = AnimationCurveType.STEP;

                    for (j = 0; j < times.length; j++) {
                        time = times[j];
                        value = values[numCurves * j + i];
                        curve.insertKey(keyType, time, value);
                    }
                    animation.addCurve(curve);
                }
            } else {
                // translation, rotation or scale
                keyType = pc.AnimationKeyableType.NUM;
                var targetPath = path;
                switch(path) {
                    case "translation":
                        keyType = pc.AnimationKeyableType.VEC;
                        targetPath = "localPosition";
                        break;
                    case "scale":
                        keyType = pc.AnimationKeyableType.VEC;
                        targetPath = "localScale";
                        break;
                    case "rotation":
                        keyType = pc.AnimationKeyableType.QUAT;
                        targetPath = "localRotation";
                        break;
                }
                curve = new pc.AnimationCurve();
                curve.keyableType = keyType;
                curve.setTarget(entity, targetPath);
                if(sampler.interpolation === "CUBIC")
                    curve.type = pc.AnimationCurveType.CUBIC;
                else if(sampler.interpolation === "STEP")
                    curve.type = pc.AnimationCurveType.STEP;

                for (i = 0; i < times.length; i++) {
                    time = times[i];
                    if ((path === 'translation') || (path === 'scale'))
                        value = new pc.Vec3(values[3 * i + 0], values[3 * i + 1], values[3 * i + 2]);
                    else if (path === 'rotation')
                        value = new pc.Quat(values[4 * i + 0], values[4 * i + 1], values[4 * i + 2], values[4 * i + 3]);
                    curve.insertKey(keyType, time, value);
                }
                animation.addCurve(curve);
            }
        });

        if(animGroup)
            animGroup.addAnimation(animation);
        return animation;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#image
    function resampleImage(image) {
        var srcW = image.width;
        var srcH = image.height;

        var dstW = nearestPow2(srcW);
        var dstH = nearestPow2(srcH);

        var canvas = document.createElement('canvas');
        canvas.width = dstW;
        canvas.height = dstH;

        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

        return canvas.toDataURL();
    }

    function translateImage(data, resources, success) {
        var image = new Image();

        image.addEventListener('load', function () {
            var gltf = resources.gltf;

            var imageIndex = resources.images.indexOf(image);
            gltf.textures.forEach(function (texture, idx) {
                if (texture.hasOwnProperty('source')) {
                    if (texture.source === imageIndex) {
                        var t = resources.textures[idx];
                        if ((!isPowerOf2(image.width) || !isPowerOf2(image.width)) &&
                            ((t.addressU === pc.ADDRESS_REPEAT) || (t.addressU === pc.ADDRESS_MIRRORED_REPEAT) ||
                             (t.addressV === pc.ADDRESS_REPEAT) || (t.addressV === pc.ADDRESS_MIRRORED_REPEAT) ||
                             (t.minFilter === pc.FILTER_LINEAR_MIPMAP_LINEAR) || (t.minFilter === pc.FILTER_NEAREST_MIPMAP_LINEAR) ||
                             (t.minFilter === pc.FILTER_LINEAR_MIPMAP_NEAREST) || (t.minFilter === pc.FILTER_NEAREST_MIPMAP_NEAREST))) {
                            var potImage = new Image();
                            potImage.addEventListener('load', function () {
                                t.setSource(potImage);
                            });
                            potImage.src = resampleImage(image);
                        } else {
                            t.setSource(image);
                        }
                    }
                }
            });

            resources.imagesLoaded++;
            if (resources.imagesLoaded === gltf.images.length) {
                success();
            }
        }, false);

        if (data.hasOwnProperty('uri')) {
            if (isDataURI(data.uri)) {
                image.src = data.uri;
            } else if (resources.processUri) {
                resources.processUri(data.uri, function(uri) {
                    image.crossOrigin = "anonymous";
                    image.src = uri;
                });
            } else {
                image.crossOrigin = "anonymous";
                image.src = resources.basePath + data.uri;
            }
        }

        if (data.hasOwnProperty('bufferView')) {
            var gltf = resources.gltf;
            var buffers = resources.buffers;
            var bufferView = gltf.bufferViews[data.bufferView];
            var arrayBuffer = buffers[bufferView.buffer];
            var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
            var imageBuffer = arrayBuffer.slice(byteOffset, byteOffset + bufferView.byteLength);
            var blob = new Blob([imageBuffer], { type: data.mimeType });
            image.src = URL.createObjectURL(blob);
        }

        return image;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#material
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

    function translateMaterial(data, resources) {
        var material = new pc.StandardMaterial();

        // glTF dooesn't define how to occlude specular
        material.occludeSpecular = true;
        material.diffuseTint = true;
        material.diffuseVertexColor = true;
        material.chunks.glossPS = glossChunk;

        if (data.hasOwnProperty('name')) {
            material.name = data.name;
        }

        var color;
        if (data.hasOwnProperty('pbrMetallicRoughness')) {
            var pbrData = data.pbrMetallicRoughness;

            if (pbrData.hasOwnProperty('baseColorFactor')) {
                color = pbrData.baseColorFactor;
                material.diffuse.set(color[0], color[1], color[2]);
                material.opacity = color[3];
            } else {
                material.diffuse.set(1, 1, 1);
                material.opacity = 1;
            }
            if (pbrData.hasOwnProperty('baseColorTexture')) {
                var baseColorTexture = pbrData.baseColorTexture;
                var texture = resources.textures[baseColorTexture.index];

                material.diffuseMap = texture;
                material.diffuseMapChannel = 'rgb';
                material.opacityMap = texture;
                material.opacityMapChannel = 'a';
                if (baseColorTexture.hasOwnProperty('texCoord')) {
                    material.diffuseMapUv = baseColorTexture.texCoord;
                    material.opacityMapUv = baseColorTexture.texCoord;
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
                material.metalnessMap = resources.textures[metallicRoughnessTexture.index];
                material.metalnessMapChannel = 'b';
                material.glossMap = resources.textures[metallicRoughnessTexture.index];
                material.glossMapChannel = 'g';
                if (metallicRoughnessTexture.hasOwnProperty('texCoord')) {
                    material.glossMapUv = metallicRoughnessTexture.texCoord;
                    material.metalnessMapUv = metallicRoughnessTexture.texCoord;
                }
            }
        }
        if (data.hasOwnProperty('normalTexture')) {
            var normalTexture = data.normalTexture;
            material.normalMap = resources.textures[normalTexture.index];
            if (normalTexture.hasOwnProperty('texCoord')) {
                material.normalMapUv = normalTexture.texCoord;
            }
            if (normalTexture.hasOwnProperty('scale')) {
                material.bumpiness = normalTexture.scale;
            }
        }
        if (data.hasOwnProperty('occlusionTexture')) {
            var occlusionTexture = data.occlusionTexture;
            material.aoMap = resources.textures[occlusionTexture.index];
            material.aoMapChannel = 'r';
            if (occlusionTexture.hasOwnProperty('texCoord')) {
                material.aoMapUv = occlusionTexture.texCoord;
            }
            // TODO: support 'strength'
        }
        if (data.hasOwnProperty('emissiveFactor')) {
            color = data.emissiveFactor;
            material.emissive.set(color[0], color[1], color[2]);
            material.emissiveTint = true;
        } else {
            material.emissive.set(0, 0, 0);
            material.emissiveTint = false;
        }
        if (data.hasOwnProperty('emissiveTexture')) {
            material.emissiveMap = resources.textures[data.emissiveTexture.index];
        }
        if (data.hasOwnProperty('alphaMode')) {
            switch (data.alphaMode) {
                case 'MASK':
                    material.blendType = pc.BLEND_NONE;
                    if (data.hasOwnProperty('alphaCutoff')) {
                        material.alphaTest = data.alphaCutoff;
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
        if (data.hasOwnProperty('doubleSided')) {
            material.twoSidedLighting = data.doubleSided;
            material.cull = data.doubleSided ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
        } else {
            material.twoSidedLighting = false;
            material.cull = pc.CULLFACE_BACK;
        }

        material.update();

        return material;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#mesh
    function translateMesh(data, resources) {
        var gltf = resources.gltf;
        var meshes = [];

        data.primitives.forEach(function (primitive) {
            var attributes = primitive.attributes;

            var positions = null;
            var normals = null;
            var tangents = null;
            var texCoord0 = null;
            var texCoord1 = null;
            var colors = null;
            var joints = null;
            var weights = null;
            var indices = null;

            var i;

            // Start by looking for compressed vertex data for this primitive
            if (primitive.hasOwnProperty('extensions')) {
                var extensions = primitive.extensions;
                if (extensions.hasOwnProperty('KHR_draco_mesh_compression')) {
                    var extDraco = extensions.KHR_draco_mesh_compression;

                    var bufferView = gltf.bufferViews[extDraco.bufferView];
                    var arrayBuffer = resources.buffers[bufferView.buffer];
                    var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
                    var uint8Buffer = new Int8Array(arrayBuffer, byteOffset, bufferView.byteLength);

                    var decoderModule = resources.decoderModule;
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
                        indices = new Uint16Array(numFaces * 3);
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

            // Grab typed arrays for all vertex data
            var accessor;

            if (attributes.hasOwnProperty('POSITION') && positions === null) {
                accessor = gltf.accessors[primitive.attributes.POSITION];
                positions = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('NORMAL') && normals === null) {
                accessor = gltf.accessors[primitive.attributes.NORMAL];
                normals = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('TANGENT') && tangents === null) {
                accessor = gltf.accessors[primitive.attributes.TANGENT];
                tangents = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('TEXCOORD_0') && texCoord0 === null) {
                accessor = gltf.accessors[primitive.attributes.TEXCOORD_0];
                texCoord0 = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('TEXCOORD_1') && texCoord1 === null) {
                accessor = gltf.accessors[primitive.attributes.TEXCOORD_1];
                texCoord1 = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('COLOR_0') && colors === null) {
                accessor = gltf.accessors[primitive.attributes.COLOR_0];
                colors = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('JOINTS_0') && joints === null) {
                accessor = gltf.accessors[primitive.attributes.JOINTS_0];
                joints = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (attributes.hasOwnProperty('WEIGHTS_0') && weights === null) {
                accessor = gltf.accessors[primitive.attributes.WEIGHTS_0];
                weights = getAccessorData(gltf, accessor, resources.buffers);
            }
            if (primitive.hasOwnProperty('indices') && indices === null) {
                accessor = gltf.accessors[primitive.indices];
                indices = getAccessorData(gltf, accessor, resources.buffers);
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
            if (positions !== null && normals !== null && texCoord0 !== null && tangents === null) {
                // pc.calculateTangents needs indices so generate some if none are present
                tangents = pc.calculateTangents(positions, normals, texCoord0, (indices === null) ? calculateIndices() : indices);
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
                vertexDesc.push({ semantic: pc.SEMANTIC_COLOR, components: 4, type: pc.TYPE_FLOAT32 });
            }
            if (joints) {
                vertexDesc.push({ semantic: pc.SEMANTIC_BLENDINDICES, components: 4, type: pc.TYPE_UINT8 });
            }
            if (weights) {
                vertexDesc.push({ semantic: pc.SEMANTIC_BLENDWEIGHT, components: 4, type: pc.TYPE_FLOAT32 });
            }

            var vertexFormat = new pc.VertexFormat(resources.device, vertexDesc);
            var vertexBuffer = new pc.VertexBuffer(resources.device, vertexFormat, numVertices, pc.BUFFER_STATIC);
            var vertexData = vertexBuffer.lock();

            var vertexDataF32 = new Float32Array(vertexData);
            var vertexDataU8  = new Uint8Array(vertexData);

            var getAttribute = function (semantic) {
                return vertexFormat.elements.find(function (element) {
                    return element.name === semantic;
                });
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
                dstOffset = attr.offset / 4;
                dstStride = attr.stride / 4;

                accessor = gltf.accessors[primitive.attributes.COLOR_0];

                for (i = 0; i < numVertices; i++) {
                    dstIndex = dstOffset + i * dstStride;
                    srcIndex = accessor.type === 'VEC4' ? i * 4 : i * 3;
                    vertexDataF32[dstIndex]     = colors[srcIndex];
                    vertexDataF32[dstIndex + 1] = colors[srcIndex + 1];
                    vertexDataF32[dstIndex + 2] = colors[srcIndex + 2];
                    vertexDataF32[dstIndex + 3] = accessor.type === 'VEC4' ? colors[srcIndex + 3] : 1;
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

            var mesh = new pc.Mesh();
            mesh.vertexBuffer = vertexBuffer;
            mesh.primitive[0].type = getPrimitiveType(primitive);
            mesh.primitive[0].base = 0;
            mesh.primitive[0].indexed = (indices !== null);
            if (indices !== null) {
                accessor = gltf.accessors[primitive.indices];
                var indexFormat;
                switch (accessor.componentType) {
                    case 5121:
                        indexFormat = pc.INDEXFORMAT_UINT8;
                        break;
                    default:
                    case 5123:
                        indexFormat = pc.INDEXFORMAT_UINT16;
                        break;
                    case 5125:
                        indexFormat = pc.INDEXFORMAT_UINT32;
                        break;
                }
                var numIndices = indices.length;
                var indexBuffer = new pc.IndexBuffer(resources.device, indexFormat, numIndices, pc.BUFFER_STATIC, indices);
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].count = indices.length;
            } else {
                mesh.primitive[0].count = numVertices;
            }

            mesh.materialIndex = primitive.material;

            accessor = gltf.accessors[primitive.attributes.POSITION];
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
                        accessor = gltf.accessors[target.POSITION];
                        options.deltaPositions = getAccessorData(gltf, accessor, resources.buffers);
                    }
                    if (target.hasOwnProperty('NORMAL')) {
                        accessor = gltf.accessors[target.NORMAL];
                        options.deltaNormals = getAccessorData(gltf, accessor, resources.buffers);
                    }
                    if (target.hasOwnProperty('TANGENT')) {
                        accessor = gltf.accessors[target.TANGENT];
                        options.deltaTangents = getAccessorData(gltf, accessor, resources.buffers);
                    }

                    targets.push(new pc.MorphTarget(options));
                });

                mesh.morph = new pc.Morph(targets);
            }

            meshes.push(mesh);
        });

        return meshes;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#node
    var tempMat = new pc.Mat4();
    var tempVec = new pc.Vec3();

    function translateNode(data, resources) {
        var entity = new pc.Entity();

        entity.name = data.hasOwnProperty('name') ? data.name : "";

        // Parse transformation properties
        if (data.hasOwnProperty('matrix')) {
            tempMat.data.set(data.matrix);
            tempMat.getTranslation(tempVec);
            entity.setLocalPosition(tempVec);
            tempMat.getEulerAngles(tempVec);
            entity.setLocalEulerAngles(tempVec);
            tempMat.getScale(tempVec);
            entity.setLocalScale(tempVec);
        }

        if (data.hasOwnProperty('rotation')) {
            var r = data.rotation;
            entity.setLocalRotation(r[0], r[1], r[2], r[3]);
        }

        if (data.hasOwnProperty('translation')) {
            var t = data.translation;
            entity.setLocalPosition(t[0], t[1], t[2]);
        }

        if (data.hasOwnProperty('scale')) {
            var s = data.scale;
            entity.setLocalScale(s[0], s[1], s[2]);
        }

        if (data.hasOwnProperty('camera')) {
            var gltf = resources.gltf;
            var camera = gltf.cameras[data.camera];

            var options = {};

            if (camera.type === 'perspective') {
                options.type = pc.PROJECTION_PERSPECTIVE;

                if (camera.hasOwnProperty('perspective')) {
                    var perspective = camera.perspective;
                    if (perspective.hasOwnProperty('aspectRatio')) {
                        options.aspectRatio = perspective.aspectRatio;
                    }
                    options.fov = perspective.yfov;
                    if (perspective.hasOwnProperty('zfar')) {
                        options.farClip = perspective.zfar;
                    }
                    options.nearClip = perspective.znear;
                }
            } else if (camera.type === 'orthographic') {
                options.type = pc.PROJECTION_ORTHOGRAPHIC;

                if (camera.hasOwnProperty('orthographic')) {
                    var orthographic = camera.orthographic;

                    options.aspectRatio = orthographic.xmag / orthographic.ymag;
                    options.orthoHeight = orthographic.ymag * 0.5;
                    options.farClip = orthographic.zfar;
                    options.nearClip = orthographic.znear;
                }
            }

            entity.addComponent('camera', options);

            // Diable loaded cameras by default and leave it to the application to enable them
            entity.camera.enabled = false;
        }

        return entity;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skin
    function translateSkin(data, resources) {
        var gltf = resources.gltf;

        var i, bindMatrix;
        var joints = data.joints;
        var numJoints = joints.length;
        var ibp = [];
        if (data.hasOwnProperty('inverseBindMatrices')) {
            var inverseBindMatrices = data.inverseBindMatrices;
            var ibmData = getAccessorData(gltf, gltf.accessors[inverseBindMatrices], resources.buffers);

            for (i = 0; i < numJoints; i++) {
                bindMatrix = new pc.Mat4(ibmData.slice(i * 16, i * 16 + 16));
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
            boneNames[i] = resources.nodes[joints[i]].name;
        }

        var skeleton = data.skeleton;

        var skin = new pc.Skin(resources.device, ibp, boneNames);
        skin.skeleton = resources.nodes[skeleton];

        skin.bones = [];
        for (i = 0; i < joints.length; i++) {
            skin.bones[i] = resources.nodes[joints[i]];
        }

        return skin;
    }

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#texture
    function translateTexture(data, resources) {
        var texture = new pc.Texture(resources.device, {
            flipY: false
        });

        if (data.hasOwnProperty('name')) {
            texture.name = data.name;
        }

        if (data.hasOwnProperty('sampler')) {
            var gltf = resources.gltf;
            var sampler = gltf.samplers[data.sampler];

            if (sampler.hasOwnProperty('minFilter')) {
                texture.minFilter = getFilter(sampler.minFilter);
            }
            if (sampler.hasOwnProperty('magFilter')) {
                texture.magFilter = getFilter(sampler.magFilter);
            }
            if (sampler.hasOwnProperty('wrapS')) {
                texture.addressU = getWrap(sampler.wrapS);
            }
            if (sampler.hasOwnProperty('wrapT')) {
                texture.addressV = getWrap(sampler.wrapT);
            }
        }

        return texture;
    }

    function loadBuffers(resources, success) {
        // buffers already loaded so early out
        if (resources.buffers) {
            success();
            return;
        }

        var gltf = resources.gltf;
        resources.buffers = [];

        if (gltf.hasOwnProperty('buffers')) {
            var numLoaded = 0;
            gltf.buffers.forEach(function (buffer, idx) {
                if (buffer.hasOwnProperty('uri')) {
                    if (isDataURI(buffer.uri)) {
                        // convert base64 to raw binary data held in a string
                        // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                        var byteString = atob(buffer.uri.split(',')[1]);

                        // write the bytes of the string to an ArrayBuffer
                        resources.buffers[idx] = new ArrayBuffer(byteString.length);

                        // create a view into the buffer
                        var uint8Array = new Uint8Array(resources.buffers[idx]);

                        // set the bytes of the buffer to the correct values
                        for (var i = 0; i < byteString.length; i++) {
                            uint8Array[i] = byteString.charCodeAt(i);
                        }

                        if (gltf.buffers.length === ++numLoaded) {
                            success();
                        }
                    } else if (resources.processUri) {
                        resources.processUri(buffer.uri, function(result) {
                            resources.buffers[idx] = result;
                            if (gltf.buffers.length === ++numLoaded) {
                                success();
                            }
                        });
                    } else {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', resources.basePath + buffer.uri, true);
                        xhr.responseType = 'arraybuffer';

                        xhr.onload = function(e) {
                            // response is unsigned 8 bit integer
                            resources.buffers[idx] = this.response;

                            if (gltf.buffers.length === ++numLoaded) {
                                success();
                            }
                        };

                        xhr.send();
                    }
                }
            });
        }
    }

    function parse(property, translator, resources, success) {
        if (success) {
            if (!resources.gltf.hasOwnProperty(property)) {
                success();
                return;
            }

            if (resources.gltf[property].length === 0) {
                success();
                return;
            }
        }

        if (resources.gltf.hasOwnProperty(property)) {
            resources[property] = resources.gltf[property].map(function (item) {
                return translator(item, resources, success);
            });
        }
    }

    function buildHierarchy(resources) {
        var gltf = resources.gltf;
        gltf.nodes.forEach(function (node, idx) {
            if (node.hasOwnProperty('children')) {
                node.children.forEach(function (childIdx) {
                    var child = resources.nodes[childIdx];
                    // If this triggers, a node in the glTF has more than one parent which is wrong
                    if (child.parent) {
                        child.parent.removeChild(child);
                    }
                    var parent = resources.nodes[idx];
                    parent.addChild(child);
                });
            }
        });
    }

    function createModels(resources) {
        resources.gltf.nodes.forEach(function (node, idx) {
            if (node.hasOwnProperty('mesh')) {
                var meshGroup = resources.meshes[node.mesh];
                if (meshGroup.length > 0) {
                    var entity = new pc.Entity();
                    var meshInstances = [];
                    var skinInstances = [];
                    var morphInstances = [];

                    for (var i = 0; i < meshGroup.length; i++) {
                        var material;
                        if (meshGroup[i].materialIndex === undefined) {
                            material = resources.defaultMaterial;
                        } else {
                            material = resources.materials[meshGroup[i].materialIndex];
                        }

                        var meshInstance = new pc.MeshInstance(entity, meshGroup[i], material);
                        meshInstances.push(meshInstance);

                        if (meshGroup[i].morph) {
                            var morphInstance = new pc.MorphInstance(meshGroup[i].morph);
                            meshInstance.morphInstance = morphInstance;
                            // HACK: need to force calculation of the morph's AABB due to a bug
                            // in the engine. This is a private function and will be removed!
                            morphInstance.updateBounds(meshInstance.mesh);

                            morphInstances.push(morphInstance);
                        }

                        if (node.hasOwnProperty('skin')) {
                            var skin = resources.skins[node.skin];
                            meshGroup[i].skin = skin;

                            var skinInstance = new pc.SkinInstance(skin);
                            skinInstance.bones = skin.bones;
                            meshInstance.skinInstance = skinInstance;

                            skinInstances.push(skinInstance);
                        }
                    }

                    var model = new pc.Model();
                    model.graph = entity;
                    model.meshInstances = meshInstances;
                    model.morphInstances = morphInstances;
                    model.skinInstances = skinInstances;

                    entity = resources.nodes[idx];
                    entity.addComponent('model');
                    entity.model.model = model;
                }
            }
        });
    }

    function getRoots(resources) {
        var gltf = resources.gltf;
        var rootNodes = [];
        if (gltf.hasOwnProperty('scenes')) {
            var sceneIndex = 0;
            if (gltf.hasOwnProperty('scene')) {
                sceneIndex = gltf.scene;
            }
            var nodes = gltf.scenes[sceneIndex].nodes;
            for (var i = 0; i < nodes.length; i++) {
                rootNodes.push(resources.nodes[nodes[i]]);
            }
        } else {
            rootNodes.push(resources.nodes[0]);
        }

        return rootNodes;
    }

    function loadGltf(gltf, device, success, options) {
        initAnim();

        var buffers = options ? options.buffers : undefined;
        var basePath = options ? options.basePath : undefined;
        var processUri = options ? options.processUri : undefined;

        var resources = {
            buffers: buffers,
            imagesLoaded: 0,
            basePath: basePath,
            processUri: processUri,
            gltf: gltf,
            device: device,
            defaultMaterial: translateMaterial({})
        };

        if (gltf.hasOwnProperty('extensionsUsed')) {
            var extensionsUsed = gltf.extensionsUsed;
            if (extensionsUsed.indexOf('KHR_draco_mesh_compression') !== -1) {
                resources.decoderModule = DracoDecoderModule();
            }
        }

        loadBuffers(resources, function () {
            parse('textures', translateTexture, resources);
            parse('images', translateImage, resources, function () {
                parse('materials', translateMaterial, resources);
                parse('meshes', translateMesh, resources);
                parse('nodes', translateNode, resources);
                parse('skins', translateSkin, resources);
                parse('animations', translateAnimation, resources);

                buildHierarchy(resources);
                createModels(resources);

                success(getRoots(resources));
            });
        });
    }

    function loadGlb(glb, device, success) {
        var dataView = new DataView(glb);

        // Read header
        var magic = dataView.getUint32(0, true);
        if (magic !== 0x46546C67) {
            console.error("Invalid magic number found in glb header. Expected 0x46546C67, found 0x" + magic.toString(16));
            return null;
        }
        var version = dataView.getUint32(4, true);
        var length = dataView.getUint32(8, true);

        // Read JSON chunk
        var chunkLength = dataView.getUint32(12, true);
        var chunkType = dataView.getUint32(16, true);
        if (chunkType !== 0x4E4F534A) {
            console.error("Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x" + chunkType.toString(16));
            return null;
        }
        var jsonData = new Uint8Array(glb, 20, chunkLength);

        var buffers = [];
        var byteOffset = 20 + chunkLength;
        while (byteOffset < length) {
            chunkLength = dataView.getUint32(byteOffset, true);
            chunkType = dataView.getUint32(byteOffset + 4, true);
            if (chunkType !== 0x004E4942) {
                console.error("Invalid chunk type found in glb file. Expected 0x004E4942, found 0x" + chunkType.toString(16));
                return null;
            }

            var buffer = glb.slice(byteOffset + 8, byteOffset + 8 + chunkLength);
            buffers.push(buffer);

            byteOffset += chunkLength + 8;
        }

        var decoder = new TextDecoder('utf-8');
        var json = decoder.decode(jsonData);
        json = JSON.parse(json);

        loadGltf(json, device, function (rootNodes) {
            success(rootNodes);
        }, {
            buffers: buffers
        });
    }

    window.loadGltf = loadGltf;
    window.loadGlb = loadGlb;
}());
