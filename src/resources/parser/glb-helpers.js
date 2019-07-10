Object.assign(pc, function () {
    'use strict';

    var GLBHelpers = {};

    // ----------------------------------------------------------------------
    // GLTF decoding
    GLBHelpers.GLTFDecoder = function (glb, onFailed) {
        this._onFailed = onFailed;
        this._glb = glb;
        this._data = new DataView(glb);
        this._length = 0;
        this._chunkLength = 0;
        this._chunkType = 0;
    };

    function decodeBinaryUtf8(array) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(array);
        }

        var str = "";
        for (var i = 0, len = array.length; i < len; i++) {
            str += String.fromCharCode(array[i]);
        }

        return decodeURIComponent(escape(str));
    }

    GLBHelpers.GLTFDecoder.prototype.parseGLTF = function () {
        // Read header
        var magic = this._data.getUint32(0, true);
        if (magic !== 0x46546C67) {
            this._onFailed("Invalid magic number found in glb header. Expected 0x46546C67, found 0x" + magic.toString(16));
            return null;
        }
        var version = this._data.getUint32(4, true);
        if (version !== 2) {
            this._onFailed("Invalid version number found in glb header. Expected 2, found " + version);
            return null;
        }
        this._length = this._data.getUint32(8, true);

        // Read JSON chunk
        this._chunkLength = this._data.getUint32(12, true);
        this._chunkType = this._data.getUint32(16, true);
        if (this._chunkType !== 0x4E4F534A) {
            this._onFailed("Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x" + this._chunkType.toString(16));
            return null;
        }
        var jsonData = new Uint8Array(this._glb, 20, this._chunkLength);
        var gltf = JSON.parse(decodeBinaryUtf8(jsonData));
        return gltf;
    };

    GLBHelpers.GLTFDecoder.prototype.extractBuffers = function () {
        var buffers = [];
        var byteOffset = 20 + this._chunkLength;
        while (byteOffset < this._length) {
            this._chunkLength = this._data.getUint32(byteOffset, true);
            this._chunkType = this._data.getUint32(byteOffset + 4, true);
            if (this._chunkType !== 0x004E4942) {
                this._onFailed("Invalid chunk type found in glb file. Expected 0x004E4942, found 0x" + this._chunkType.toString(16));
                return null;
            }

            var buffer = this._glb.slice(byteOffset + 8, byteOffset + 8 + this._chunkLength);
            buffers.push(buffer);

            byteOffset += this._chunkLength + 8;
        }
        return buffers;
    };

    // ----------------------------------------------------------------------
    // Buffers loading
    GLBHelpers.BuffersLoader = function (context, continuation) {
        this._context = context;
        this._continuation = continuation;
        this._numLoaded = 0;
    };

    GLBHelpers.BuffersLoader.prototype.progressLoading = function () {
        if (++this._numLoaded === this._context.gltf.buffers.length) {
            this._continuation();
        }
    };

    GLBHelpers.BuffersLoader._onProcessURIload = function (loader, result) {
        loader._context.buffers[idx] = result;
        loader.progressLoading();
    };

    GLBHelpers.BuffersLoader._onXHRload = function (loader, e) {
        // response is unsigned 8 bit integer
        loader._context.buffers[idx] = this.response;
        loader.progressLoading();
    };

    function isDataURI(uri) {
        return /^data:.*,.*$/i.test(uri);
    }

    GLBHelpers.BuffersLoader.prototype.load = function () {
        // buffers already loaded so early out
        if (this._context.buffers) {
            this._continuation();
            return;
        }
        this._context.buffers = [];

        var gltf = this._context.gltf;
        if (!gltf.hasOwnProperty('buffers')) {
            this._context._onLoaded(null);
            return;
        }

        for (var buffer, idx = 0; idx < gltf.buffers.length; idx++) {
            buffer = gltf.buffers[idx];
            if (buffer.hasOwnProperty('uri')) {
                if (isDataURI(buffer.uri)) {
                    // convert base64 to raw binary data held in a string
                    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
                    var byteString = atob(buffer.uri.split(',')[1]);

                    // write the bytes of the string to an ArrayBuffer
                    this.buffers[idx] = new ArrayBuffer(byteString.length);

                    // create a view into the buffer
                    var uint8Array = new Uint8Array(this.buffers[idx]);

                    // set the bytes of the buffer to the correct values
                    for (var i = 0; i < byteString.length; i++) {
                        uint8Array[i] = byteString.charCodeAt(i);
                    }
                    this.progressLoading();
                } else if (this._context.processUri) {
                    this._context.processUri(buffer.uri, GLBHelpers.BuffersLoader._onProcessURIload.bind(this));
                } else {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', this._context.basePath + buffer.uri, true);
                    xhr.responseType = 'arraybuffer';
                    xhr.onload = GLBHelpers.BuffersLoader._onXHRload.bind(this);
                    xhr.send();
                }
            }
        }
    };

    // ----------------------------------------------------------------------
    // Image parsing
    GLBHelpers.ImageLoader = function (context, continuation) {
        this._context = context;
        this._continuation = continuation;
        this._imagesLoaded = 0;

        if (!this._context.gltf.hasOwnProperty("images") || this._context.gltf.images.length === 0) {
            this._continuation();
        }
    };

    function nearestPow2(n) {
        return Math.pow(2, Math.round(Math.log(n) / Math.log(2)));
    }

    function isPowerOf2(n) {
        return n && (n & (n - 1)) === 0;
    }

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

    GLBHelpers.ImageLoader.prototype.onLoad = function (event) {
        var image = event.srcElement;
        image.removeEventListener('load', this.onLoad, false);

        var gltf = this._context.gltf;

        var imageIndex = this._context.images.indexOf(image);
        for (var idx = 0; idx < gltf.textures.length; idx++) {
            var texture = gltf.textures[idx];
            if (texture.hasOwnProperty('source')) {
                if (texture.source === imageIndex) {
                    var t = this._context.textures[idx];
                    if ((!isPowerOf2(image.width) || !isPowerOf2(image.width)) &&
                        ((t.addressU === pc.ADDRESS_REPEAT) || (t.addressU === pc.ADDRESS_MIRRORED_REPEAT) ||
                         (t.addressV === pc.ADDRESS_REPEAT) || (t.addressV === pc.ADDRESS_MIRRORED_REPEAT) ||
                         (t.minFilter === pc.FILTER_LINEAR_MIPMAP_LINEAR) || (t.minFilter === pc.FILTER_NEAREST_MIPMAP_LINEAR) ||
                         (t.minFilter === pc.FILTER_LINEAR_MIPMAP_NEAREST) || (t.minFilter === pc.FILTER_NEAREST_MIPMAP_NEAREST))) {

                        var potImage = new Image();
                        potImage.addEventListener('load', t.setSource.bind(t, potImage));
                        potImage.src = resampleImage(image);
                    } else {
                        t.setSource(image);
                    }
                }
            }
        }

        if (++this._imagesLoaded === gltf.images.length) {
            this._continuation();
        }
    };

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#image
    GLBHelpers.ImageLoader.prototype.translate = function (context, data) {
        var image = new Image();
        image.addEventListener('load', this.onLoad.bind(this), false);

        if (data.hasOwnProperty('uri')) {
            if (isDataURI(data.uri)) {
                image.src = data.uri;
            } else if (this._context.processUri) {
                this._context.processUri(data.uri, function (uri) {
                    image.crossOrigin = "anonymous";
                    image.src = uri;
                });
            } else {
                image.crossOrigin = "anonymous";
                image.src = this._context.basePath + data.uri;
            }
        }

        if (data.hasOwnProperty('bufferView')) {
            var gltf = this._context.gltf;
            var buffers = this._context.buffers;
            var bufferView = gltf.bufferViews[data.bufferView];
            var arrayBuffer = buffers[bufferView.buffer];
            var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
            var imageBuffer = arrayBuffer.slice(byteOffset, byteOffset + bufferView.byteLength);
            var blob = new Blob([imageBuffer], { type: data.mimeType });
            image.src = URL.createObjectURL(blob);
        }

        return image;
    };

    // ----------------------------------------------------------------------
    // Textures parsing
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

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#texture
    GLBHelpers.translateTexture = function (context, data) {
        var texture = new pc.Texture(context._device, {
            flipY: false
        });

        if (data.hasOwnProperty('name')) {
            texture.name = data.name;
        }

        if (data.hasOwnProperty('sampler')) {
            var gltf = context.gltf;
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
    };

    // ----------------------------------------------------------------------
    // Material parsing
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

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#material
    GLBHelpers.translateMaterial = function (context, data) {
        var material = new pc.StandardMaterial();

        // glTF dooesn't define how to occlude specular
        material.occludeSpecular = true;

        material.diffuseTint = true;
        material.diffuseVertexColor = true;

        material.specularTint = true;
        material.specularVertexColor = true;

        if (data.hasOwnProperty('name')) {
            material.name = data.name;
        }

        if (data.hasOwnProperty('extensions') && data.extensions.hasOwnProperty('KHR_materials_unlit')) {
            material.useLighting = false;
        }

        var color, texture;
        if (data.hasOwnProperty('extensions') && data.extensions.hasOwnProperty('KHR_materials_pbrSpecularGlossiness')) {
            var specData = data.extensions.KHR_materials_pbrSpecularGlossiness;

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
                texture = context.textures[diffuseTexture.index];

                material.diffuseMap = texture;
                material.diffuseMapChannel = 'rgb';
                material.opacityMap = texture;
                material.opacityMapChannel = 'a';
                if (diffuseTexture.hasOwnProperty('texCoord')) {
                    material.diffuseMapUv = diffuseTexture.texCoord;
                    material.opacityMapUv = diffuseTexture.texCoord;
                }
                if (diffuseTexture.hasOwnProperty('extensions') && diffuseTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
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
                material.specularMap = context.textures[specularGlossinessTexture.index];
                material.specularMapChannel = 'rgb';
                material.glossMap = context.textures[specularGlossinessTexture.index];
                material.glossMapChannel = 'a';
                if (specularGlossinessTexture.hasOwnProperty('texCoord')) {
                    material.glossMapUv = specularGlossinessTexture.texCoord;
                    material.metalnessMapUv = specularGlossinessTexture.texCoord;
                }
                if (specularGlossinessTexture.hasOwnProperty('extensions') && specularGlossinessTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
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

        } else if (data.hasOwnProperty('pbrMetallicRoughness')) {
            var pbrData = data.pbrMetallicRoughness;

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
                texture = context.textures[baseColorTexture.index];

                material.diffuseMap = texture;
                material.diffuseMapChannel = 'rgb';
                material.opacityMap = texture;
                material.opacityMapChannel = 'a';
                if (baseColorTexture.hasOwnProperty('texCoord')) {
                    material.diffuseMapUv = baseColorTexture.texCoord;
                    material.opacityMapUv = baseColorTexture.texCoord;
                }
                if (baseColorTexture.hasOwnProperty('extensions') && baseColorTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
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
                material.metalnessMap = context.textures[metallicRoughnessTexture.index];
                material.metalnessMapChannel = 'b';
                material.glossMap = context.textures[metallicRoughnessTexture.index];
                material.glossMapChannel = 'g';
                if (metallicRoughnessTexture.hasOwnProperty('texCoord')) {
                    material.glossMapUv = metallicRoughnessTexture.texCoord;
                    material.metalnessMapUv = metallicRoughnessTexture.texCoord;
                }
                if (metallicRoughnessTexture.hasOwnProperty('extensions') && metallicRoughnessTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
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

        if (data.hasOwnProperty('normalTexture')) {
            var normalTexture = data.normalTexture;
            material.normalMap = context.textures[normalTexture.index];
            if (normalTexture.hasOwnProperty('texCoord')) {
                material.normalMapUv = normalTexture.texCoord;
            }
            if (normalTexture.hasOwnProperty('extensions') && normalTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
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
        if (data.hasOwnProperty('occlusionTexture')) {
            var occlusionTexture = data.occlusionTexture;
            material.aoMap = context.textures[occlusionTexture.index];
            material.aoMapChannel = 'r';
            if (occlusionTexture.hasOwnProperty('texCoord')) {
                material.aoMapUv = occlusionTexture.texCoord;
            }
            if (occlusionTexture.hasOwnProperty('extensions') && occlusionTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
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
        if (data.hasOwnProperty('emissiveFactor')) {
            color = data.emissiveFactor;
            // Convert from linear space to sRGB space
            material.emissive.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
            material.emissiveTint = true;
        } else {
            material.emissive.set(0, 0, 0);
            material.emissiveTint = false;
        }
        if (data.hasOwnProperty('emissiveTexture')) {
            var emissiveTexture = data.emissiveTexture;
            material.emissiveMap = context.textures[emissiveTexture.index];
            if (emissiveTexture.hasOwnProperty('texCoord')) {
                material.emissiveMapUv = emissiveTexture.texCoord;
            }
            if (emissiveTexture.hasOwnProperty('extensions') && emissiveTexture.extensions.hasOwnProperty('KHR_texture_transform')) {
                var emissiveTransformData = emissiveTexture.extensions.KHR_texture_transform;
                if (emissiveTransformData.hasOwnProperty('scale')) {
                    material.emissiveMapTiling = new pc.Vec2(emissiveTransformData.scale[0], emissiveTransformData.scale[1]);
                }
                if (emissiveTransformData.hasOwnProperty('offset')) {
                    material.emissiveMapOffset = new pc.Vec2(emissiveTransformData.offset[0], emissiveTransformData.offset[1]);
                }
            }
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

        if (data.hasOwnProperty('extras') && context.processMaterialExtras) {
            context.processMaterialExtras(material, data.extras);
        }

        material.update();

        return material;
    };

    // ----------------------------------------------------------------------
    // Mesh parsing
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

    var getAttribute = function (elements, semantic) {
        for (i = 0; i < elements.length; i++) {
            if (elements[i].name === semantic) {
                return elements[i];
            }
        }
        return null;
    };

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

    var calculateIndices = function () {
        var dummyIndices = new Uint16Array(numVertices);
        for (i = 0; i < numVertices; i++) {
            dummyIndices[i] = i;
        }
        return dummyIndices;
    };

    var extractAttribute = function (decoder, uniqueId) {
        var attribute = decoder.GetAttributeByUniqueId(outputGeometry, uniqueId);
        var attributeData = new decoderModule.DracoFloat32Array();
        decoder.GetAttributeFloatForAllPoints(outputGeometry, attribute, attributeData);
        var numValues = numPoints * attribute.num_components();
        var values = new Float32Array(numValues);

        for (var i = 0; i < numValues; i++) {
            values[i] = attributeData.GetValue(i);
        }

        decoderModule.destroy(attributeData);
        return values;
    };

    var copyAttr2 = function (dstOffset, dstStride, src, dst, num) {
        for (var i = 0; i < num; i++) {
            dstIndex = dstOffset + i * dstStride;
            srcIndex = i * 2;
            dst[dstIndex]     = src[srcIndex];
            dst[dstIndex + 1] = src[srcIndex + 1];
        }
    };

    var copyAttr3 = function (dstOffset, dstStride, src, dst, num) {
        for (var i = 0; i < num; i++) {
            dstIndex = dstOffset + i * dstStride;
            srcIndex = i * 3;
            dst[dstIndex]     = src[srcIndex];
            dst[dstIndex + 1] = src[srcIndex + 1];
            dst[dstIndex + 2] = src[srcIndex + 2];
        }
    };

    var copyAttr4 = function (dstOffset, dstStride, src, dst, num) {
        for (var i = 0; i < num; i++) {
            dstIndex = dstOffset + i * dstStride;
            srcIndex = i * 4;
            dst[dstIndex]     = src[srcIndex];
            dst[dstIndex + 1] = src[srcIndex + 1];
            dst[dstIndex + 2] = src[srcIndex + 2];
            dst[dstIndex + 3] = src[srcIndex + 3];
        }
    };

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#mesh
    GLBHelpers.translateMesh = function (context, data) {
        var gltf = context.gltf;
        var meshes = [];

        for (var primitive, idx = 0; idx < data.primitives.length; idx++) {
            primitive = data.primitives[idx];

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
                    var arrayBuffer = context.buffers[bufferView.buffer];
                    var byteOffset = bufferView.hasOwnProperty('byteOffset') ? bufferView.byteOffset : 0;
                    var uint8Buffer = new Int8Array(arrayBuffer, byteOffset, bufferView.byteLength);

                    var decoderModule = context.decoderModule;
                    if (!decoderModule) {
                        throw new Error('KHR_draco_mesh_compression extension requires decoder module');
                    }
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
                        var dracoAttribs = extDraco.attributes;
                        if (dracoAttribs.hasOwnProperty('POSITION'))
                            positions = extractAttribute(decoder, dracoAttribs.POSITION);
                        if (dracoAttribs.hasOwnProperty('NORMAL'))
                            normals   = extractAttribute(decoder, dracoAttribs.NORMAL);
                        if (dracoAttribs.hasOwnProperty('TANGENT'))
                            tangents  = extractAttribute(decoder, dracoAttribs.TANGENT);
                        if (dracoAttribs.hasOwnProperty('TEXCOORD_0'))
                            texCoord0 = extractAttribute(decoder, dracoAttribs.TEXCOORD_0);
                        if (dracoAttribs.hasOwnProperty('TEXCOORD_1'))
                            texCoord1 = extractAttribute(decoder, dracoAttribs.TEXCOORD_1);
                        if (dracoAttribs.hasOwnProperty('COLOR_0'))
                            colors    = extractAttribute(decoder, dracoAttribs.COLOR_0);
                        if (dracoAttribs.hasOwnProperty('JOINTS_0'))
                            joints    = extractAttribute(decoder, dracoAttribs.JOINTS_0);
                        if (dracoAttribs.hasOwnProperty('WEIGHTS_0'))
                            weights   = extractAttribute(decoder, dracoAttribs.WEIGHTS_0);
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

            // Grab typed arrays for all vertex data
            var accessor;

            if (attributes.hasOwnProperty('POSITION') && positions === null) {
                accessor = gltf.accessors[primitive.attributes.POSITION];
                positions = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('NORMAL') && normals === null) {
                accessor = gltf.accessors[primitive.attributes.NORMAL];
                normals = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('TANGENT') && tangents === null) {
                accessor = gltf.accessors[primitive.attributes.TANGENT];
                tangents = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('TEXCOORD_0') && texCoord0 === null) {
                accessor = gltf.accessors[primitive.attributes.TEXCOORD_0];
                texCoord0 = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('TEXCOORD_1') && texCoord1 === null) {
                accessor = gltf.accessors[primitive.attributes.TEXCOORD_1];
                texCoord1 = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('COLOR_0') && colors === null) {
                accessor = gltf.accessors[primitive.attributes.COLOR_0];
                colors = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('JOINTS_0') && joints === null) {
                accessor = gltf.accessors[primitive.attributes.JOINTS_0];
                joints = getAccessorData(gltf, accessor, context.buffers);
            }
            if (attributes.hasOwnProperty('WEIGHTS_0') && weights === null) {
                accessor = gltf.accessors[primitive.attributes.WEIGHTS_0];
                weights = getAccessorData(gltf, accessor, context.buffers);
            }
            if (primitive.hasOwnProperty('indices') && indices === null) {
                accessor = gltf.accessors[primitive.indices];
                indices = getAccessorData(gltf, accessor, context.buffers);
            }

            var numVertices = positions.length / 3;

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

            var vertexFormat = new pc.VertexFormat(context._device, vertexDesc);
            var vertexBuffer = new pc.VertexBuffer(context._device, vertexFormat, numVertices, pc.BUFFER_STATIC);
            var vertexData = vertexBuffer.lock();

            var vertexDataF32 = new Float32Array(vertexData);
            var vertexDataU8  = new Uint8Array(vertexData);

            var dstIndex, srcIndex;
            var attr, dstOffset, dstStride;
            if (positions !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_POSITION);
                copyAttr3(attr.offset / 4, attr.stride / 4, positions, vertexDataF32, numVertices);
            }

            if (normals !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_NORMAL);
                copyAttr3(attr.offset / 4, attr.stride / 4, normals, vertexDataF32, numVertices);
            }

            if (tangents !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_TANGENT);
                copyAttr4(attr.offset / 4, attr.stride / 4, tangents, vertexDataF32, numVertices);
            }

            if (texCoord0 !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_TEXCOORD0);
                copyAttr2(attr.offset / 4, attr.stride / 4, texCoord0, vertexDataF32, numVertices);
            }

            if (texCoord1 !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_TEXCOORD1);
                copyAttr2(attr.offset / 4, attr.stride / 4, texCoord1, vertexDataF32, numVertices);
            }

            if (colors !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_COLOR);
                dstOffset = attr.offset;
                dstStride = attr.stride;

                accessor = gltf.accessors[primitive.attributes.COLOR_0];

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
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_BLENDINDICES);
                copyAttr4(attr.offset, attr.stride, joints, vertexDataU8, numVertices);
            }

            if (weights !== null) {
                attr = getAttribute(vertexFormat.elements, pc.SEMANTIC_BLENDWEIGHT);
                copyAttr4(attr.offset / 4, attr.stride / 4, weights, vertexDataF32, numVertices);
            }

            vertexBuffer.unlock();

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
                var indexBuffer = new pc.IndexBuffer(context._device, indexFormat, numIndices, pc.BUFFER_STATIC, indices);
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

                for (var target, tidx = 0; tidx < primitive.targets.length; tidx++) {
                    target = primitive.targets[tidx];
                    var options = {};
                    if (target.hasOwnProperty('POSITION')) {
                        accessor = gltf.accessors[target.POSITION];
                        options.deltaPositions = getAccessorData(gltf, accessor, context.buffers);
                    }
                    if (target.hasOwnProperty('NORMAL')) {
                        accessor = gltf.accessors[target.NORMAL];
                        options.deltaNormals = getAccessorData(gltf, accessor, context.buffers);
                    }
                    if (target.hasOwnProperty('TANGENT')) {
                        accessor = gltf.accessors[target.TANGENT];
                        options.deltaTangents = getAccessorData(gltf, accessor, context.buffers);
                    }

                    targets.push(new pc.MorphTarget(options));
                }

                mesh.morph = new pc.Morph(targets);
            }

            meshes.push(mesh);
        }

        return meshes;
    };

    // ----------------------------------------------------------------------
    // Node parsing
    GLBHelpers.NodeLoader = function () {
        this._tempMat = new pc.Mat4();
        this._tempVec = new pc.Vec3();
        this._nodeCounter = 0;
    };

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#node
    GLBHelpers.NodeLoader.prototype.translate = function (context, data) {
        var entity = new pc.GraphNode();

        if (data.hasOwnProperty('name')) {
            entity.name = data.name;
        } else {
            entity.name = "Node " + this._nodeCounter;
        }

        // Parse transformation properties
        if (data.hasOwnProperty('matrix')) {
            this._tempMat.data.set(data.matrix);
            this._tempMat.getTranslation(this._tempVec);
            entity.setLocalPosition(this._tempVec);
            this._tempMat.getEulerAngles(this._tempVec);
            entity.setLocalEulerAngles(this._tempVec);
            this._tempMat.getScale(this._tempVec);
            entity.setLocalScale(this._tempVec);
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

        this._nodeCounter++;

        return entity;
    };

    // ----------------------------------------------------------------------
    // Skins parsing

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skin
    GLBHelpers.translateSkin = function (context, data) {
        var gltf = context.gltf;

        var i, j, bindMatrix;
        var joints = data.joints;
        var numJoints = joints.length;
        var ibp = new Array(numJoints);
        if (data.hasOwnProperty('inverseBindMatrices')) {
            var inverseBindMatrices = data.inverseBindMatrices;
            var ibmData = getAccessorData(gltf, gltf.accessors[inverseBindMatrices], context.buffers);
            var ibmValues = new Array(16);

            for (i = 0; i < numJoints; i++) {
                for (j = 0; j < 16; j++) {
                    ibmValues[j] = ibmData[i * 16 + j];
                }
                bindMatrix = new pc.Mat4();
                bindMatrix.set(ibmValues);
                ibp[i] = bindMatrix;
            }
        } else {
            for (i = 0; i < numJoints; i++) {
                bindMatrix = new pc.Mat4();
                ibp[i] = bindMatrix;
            }
        }

        var boneNames = new Array(numJoints);
        for (i = 0; i < numJoints; i++) {
            boneNames[i] = context.nodes[joints[i]].name;
        }

        var skeleton = data.skeleton;

        var skin = new pc.Skin(context._device, ibp, boneNames);
        skin.skeleton = context.nodes[skeleton];

        skin.bones = new Array(numJoints);
        for (i = 0; i < numJoints; i++) {
            skin.bones[i] = context.nodes[joints[i]];
        }

        return skin;
    };

    // ----------------------------------------------------------------------
    // Animations parsing
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

    // Specification:
    //   https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animation
    GLBHelpers.AnimationLoader = function () {
        this._id = 0;
    };

    GLBHelpers.AnimationLoader.prototype.translate = function (context, data) {
        var anim = new pc.Animation();
        anim.loop = true;
        anim.setName(data.hasOwnProperty('name') ? data.name : ("animation_" + this._id));

        var gltf = context.gltf;
        var nodesMap = {};
        var node = null;

        for (var channel, idx = 0; idx < data.channels.length; idx++) {
            channel = data.channels[idx];

            var sampler = data.samplers[channel.sampler];
            var times = getAccessorData(gltf, gltf.accessors[sampler.input], context.buffers);
            var values = getAccessorData(gltf, gltf.accessors[sampler.output], context.buffers);

            var target = channel.target;
            var path = target.path;

            node = nodesMap[target.node];
            if (!node) {
                node = new pc.Node();
                var entity = context.nodes[target.node];
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
        }

        if (data.hasOwnProperty('extras') && context.processAnimationExtras) {
            context.processAnimationExtras(anim, data.extras);
        }
        this._id++;
        return anim;
    };

    return {
        GLBHelpers: GLBHelpers
    };
}());
