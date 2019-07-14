Object.assign(pc, function () {
    var StandardMaterialOptionsBuilder = function () {
        this._mapXForms = null;
    };

    // Minimal options for Depth and Shadow passes
    StandardMaterialOptionsBuilder.prototype.updateMinRef = function (options, device, scene, stdMat, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128) {
        this._updateSharedOptions(options, stdMat, objDefs, pass);
        this._updateMinOptions(options, stdMat);
        this._updateUVOptions(options, stdMat, objDefs, true);
    };

    StandardMaterialOptionsBuilder.prototype.updateRef = function (options, device, scene, stdMat, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128) {
        this._updateSharedOptions(options, stdMat, objDefs, pass);
        options.useTexCubeLod = device.useTexCubeLod;
        this._updateEnvOptions(options, stdMat, scene, prefilteredCubeMap128);
        this._updateMaterialOptions(options, stdMat);
        if (pass === pc.SHADER_FORWARDHDR) {
            if (options.gamma) options.gamma = pc.GAMMA_SRGBHDR;
            options.toneMap = pc.TONEMAP_LINEAR;
        }
        options.hasTangents = objDefs && stdMat.normalMap && ((objDefs & pc.SHADERDEF_TANGENTS) !== 0);
        this._updateLightOptions(options, stdMat, objDefs, sortedLights, staticLightList);
        this._updateUVOptions(options, stdMat, objDefs, false);
    };

    StandardMaterialOptionsBuilder.prototype._updateSharedOptions = function (options, stdMat, objDefs, pass) {
        options.pass = pass;
        options.alphaTest = stdMat.alphaTest > 0;
        options.forceFragmentPrecision = stdMat.forceFragmentPrecision || "";
        options.chunks = stdMat.chunks || "";
        options.blendType = stdMat.blendType;
        options.forceUv1 = stdMat.forceUv1;

        options.screenSpace = objDefs && (objDefs & pc.SHADERDEF_SCREENSPACE) !== 0;
        options.skin = objDefs && (objDefs & pc.SHADERDEF_SKIN) !== 0;
        options.useInstancing = objDefs && (objDefs & pc.SHADERDEF_INSTANCING) !== 0;

        options.nineSlicedMode = stdMat.nineSlicedMode || 0;
    };

    StandardMaterialOptionsBuilder.prototype._updateUVOptions = function (options, stdMat, objDefs, minimalOptions) {
        var hasUv0 = false;
        var hasUv1 = false;
        var hasVcolor = false;
        if (objDefs) {
            hasUv0 = (objDefs & pc.SHADERDEF_UV0) !== 0;
            hasUv1 = (objDefs & pc.SHADERDEF_UV1) !== 0;
            hasVcolor = (objDefs & pc.SHADERDEF_VCOLOR) !== 0;
        }

        options.vertexColors = false;
        this._mapXForms = [];
        for (var p in pc._matTex2D) {
            this._updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions);
        }
        this._mapXForms = null;
    };

    StandardMaterialOptionsBuilder.prototype._updateMinOptions = function (options, stdMat) {
        options.opacityTint = stdMat.opacity !== 1 && stdMat.blendType !== pc.BLEND_NONE;
        options.lights = [];
    };

    StandardMaterialOptionsBuilder.prototype._updateMaterialOptions = function (options, stdMat) {
        var diffuseTint = ((stdMat.diffuse.r !== 1 || stdMat.diffuse.g !== 1 || stdMat.diffuse.b !== 1) &&
            (stdMat.diffuseTint || (!stdMat.diffuseMap && !stdMat.diffuseVertexColor))) ? 3 : 0;

        var specularTint = false;
        var useSpecular = (stdMat.useMetalness ? true : !!stdMat.specularMap) || (!!stdMat.sphereMap) || (!!stdMat.cubeMap) || (!!stdMat.dpAtlas);
        useSpecular = useSpecular || (stdMat.useMetalness ? true : !(stdMat.specular.r === 0 && stdMat.specular.g === 0 && stdMat.specular.b === 0));

        if (useSpecular) {
            if ((stdMat.specularTint || (!stdMat.specularMap && !stdMat.specularVertexColor)) && !stdMat.useMetalness) {
                specularTint = stdMat.specular.r !== 1 || stdMat.specular.g !== 1 || stdMat.specular.b !== 1;
            }
        }

        var emissiveTint = stdMat.emissiveMap ? 0 : 3;
        if (!emissiveTint) {
            emissiveTint = (stdMat.emissive.r !== 1 || stdMat.emissive.g !== 1 || stdMat.emissive.b !== 1 || stdMat.emissiveIntensity !== 1) && stdMat.emissiveTint;
            emissiveTint = emissiveTint ? 3 : (stdMat.emissiveIntensity !== 1 ? 1 : 0);
        }

        options.opacityTint = (stdMat.opacity !== 1 && stdMat.blendType !== pc.BLEND_NONE) ? 1 : 0;
        options.blendMapsWithColors = true;
        options.ambientTint = stdMat.ambientTint;
        options.diffuseTint = diffuseTint;
        options.specularTint = specularTint ? 3 : 0;
        options.metalnessTint = (stdMat.useMetalness && stdMat.metalness < 1) ? 1 : 0;
        options.glossTint = 1;
        options.emissiveTint = emissiveTint;
        options.alphaToCoverage = stdMat.alphaToCoverage;
        options.needsNormalFloat = stdMat.normalizeNormalMap;
        options.sphereMap = !!stdMat.sphereMap;
        options.cubeMap = !!stdMat.cubeMap;
        options.dpAtlas = !!stdMat.dpAtlas;
        options.ambientSH = !!stdMat.ambientSH;
        options.useSpecular = useSpecular;
        options.emissiveFormat = stdMat.emissiveMap ? (stdMat.emissiveMap.rgbm ? 1 : (stdMat.emissiveMap.format === pc.PIXELFORMAT_RGBA32F ? 2 : 0)) : null;
        options.lightMapFormat = stdMat.lightMap ? (stdMat.lightMap.rgbm ? 1 : (stdMat.lightMap.format === pc.PIXELFORMAT_RGBA32F ? 2 : 0)) : null;
        options.specularAntialias = stdMat.specularAntialias;
        options.conserveEnergy = stdMat.conserveEnergy;
        options.occludeSpecular = stdMat.occludeSpecular;
        options.occludeSpecularFloat = (stdMat.occludeSpecularIntensity !== 1.0);
        options.occludeDirect = stdMat.occludeDirect;
        options.shadingModel = stdMat.shadingModel;
        options.fresnelModel = stdMat.fresnelModel;
        options.packedNormal = stdMat.normalMap ? (stdMat.normalMap.format === pc.PIXELFORMAT_DXT5) : false;
        options.fastTbn = stdMat.fastTbn;
        options.cubeMapProjection = stdMat.cubeMapProjection;
        options.customFragmentShader = stdMat.customFragmentShader;
        options.refraction = !!stdMat.refraction;
        options.useMetalness = stdMat.useMetalness;
        options.msdf = !!stdMat.msdfMap;
        options.twoSidedLighting = stdMat.twoSidedLighting;
        options.pixelSnap = stdMat.pixelSnap;
        options.aoMapUv = stdMat.aoUvSet; // backwards componen
    };

    StandardMaterialOptionsBuilder.prototype._updateEnvOptions = function (options, stdMat, scene, prefilteredCubeMap128) {
        var rgbmAmbient = (prefilteredCubeMap128 ? prefilteredCubeMap128.rgbm : false) ||
            (stdMat.cubeMap ? stdMat.cubeMap.rgbm : false) ||
            (stdMat.dpAtlas ? stdMat.dpAtlas.rgbm : false);

        var hdrAmbient = (prefilteredCubeMap128 ? prefilteredCubeMap128.rgbm || prefilteredCubeMap128.format === pc.PIXELFORMAT_RGBA32F : false) ||
            (stdMat.cubeMap ? stdMat.cubeMap.rgbm || stdMat.cubeMap.format === pc.PIXELFORMAT_RGBA32F : false) ||
            (stdMat.dpAtlas ? stdMat.dpAtlas.rgbm || stdMat.dpAtlas.format === pc.PIXELFORMAT_RGBA32F : false);

        var rgbmReflection = ((prefilteredCubeMap128 && !stdMat.cubeMap && !stdMat.sphereMap && !stdMat.dpAtlas) ? prefilteredCubeMap128.rgbm : false) ||
            (stdMat.cubeMap ? stdMat.cubeMap.rgbm : false) ||
            (stdMat.sphereMap ? stdMat.sphereMap.rgbm : false) ||
            (stdMat.dpAtlas ? stdMat.dpAtlas.rgbm : false);

        var hdrReflection = ((prefilteredCubeMap128 && !stdMat.cubeMap && !stdMat.sphereMap && !stdMat.dpAtlas) ? prefilteredCubeMap128.rgbm || prefilteredCubeMap128.format === pc.PIXELFORMAT_RGBA32F : false) ||
            (stdMat.cubeMap ? stdMat.cubeMap.rgbm || stdMat.cubeMap.format === pc.PIXELFORMAT_RGBA32F : false) ||
            (stdMat.sphereMap ? stdMat.sphereMap.rgbm || stdMat.sphereMap.format === pc.PIXELFORMAT_RGBA32F : false) ||
            (stdMat.dpAtlas ? stdMat.dpAtlas.rgbm || stdMat.dpAtlas.format === pc.PIXELFORMAT_RGBA32F : false);

        var globalSky128;
        if (stdMat.useSkybox && scene._skyboxPrefiltered)
            globalSky128 = scene._skyboxPrefiltered[0];

        options.fog = stdMat.useFog ? scene.fog : "none";
        options.gamma = stdMat.useGammaTonemap ? scene.gammaCorrection : pc.GAMMA_NONE;
        options.toneMap = stdMat.useGammaTonemap ? scene.toneMapping : -1;
        options.rgbmAmbient = rgbmAmbient;
        options.hdrAmbient = hdrAmbient;
        options.rgbmReflection = rgbmReflection;
        options.hdrReflection = hdrReflection;
        options.useRgbm = rgbmReflection || rgbmAmbient || (stdMat.emissiveMap ? stdMat.emissiveMap.rgbm : false) || (stdMat.lightMap ? stdMat.lightMap.rgbm : false);
        options.fixSeams = prefilteredCubeMap128 ? prefilteredCubeMap128.fixCubemapSeams : (stdMat.cubeMap ? stdMat.cubeMap.fixCubemapSeams : false);
        options.prefilteredCubemap = !!prefilteredCubeMap128;
        options.skyboxIntensity = (prefilteredCubeMap128 && globalSky128 && prefilteredCubeMap128 === globalSky128) && (scene.skyboxIntensity !== 1);
    };

    StandardMaterialOptionsBuilder.prototype._updateLightOptions = function (options, stdMat, objDefs, sortedLights, staticLightList) {
        options.lightMap = false;
        options.lightMapChannel = "";
        options.lightMapUv = 0;
        options.lightMapTransform = 0;
        options.lightMapWithoutAmbient = false;
        options.dirLightMap = false;

        if (objDefs) {
            options.noShadow = (objDefs & pc.SHADERDEF_NOSHADOW) !== 0;

            if ((objDefs & pc.SHADERDEF_LM) !== 0) {
                options.lightMapFormat = 1; // rgbm
                options.lightMap = true;
                options.lightMapChannel = "rgb";
                options.lightMapUv = 1;
                options.lightMapTransform = 0;
                options.lightMapWithoutAmbient = !stdMat.lightMap;
                options.useRgbm = true;
                if ((objDefs & pc.SHADERDEF_DIRLM) !== 0) {
                    options.dirLightMap = true;
                }
            }
        }

        if (stdMat.useLighting) {
            var lightsFiltered = [];
            var mask = objDefs ? (objDefs >> 16) : 1;
            if (sortedLights) {
                this._collectLights(pc.LIGHTTYPE_DIRECTIONAL, sortedLights[pc.LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
                this._collectLights(pc.LIGHTTYPE_POINT, sortedLights[pc.LIGHTTYPE_POINT], lightsFiltered, mask, staticLightList);
                this._collectLights(pc.LIGHTTYPE_SPOT, sortedLights[pc.LIGHTTYPE_SPOT], lightsFiltered, mask, staticLightList);
            }
            options.lights = lightsFiltered;
        } else {
            options.lights = [];
        }

        if (options.lights.length === 0) {
            options.noShadow = true;
        }
    };

    StandardMaterialOptionsBuilder.prototype._updateTexOptions = function (options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions) {
        var mname = p + "Map";
        var vname = p + "VertexColor";
        var vcname = p + "VertexColorChannel";
        var cname = mname + "Channel";
        var tname = mname + "Transform";
        var uname = mname + "Uv";

        // Avoid overriding previous lightMap properties
        if (p !== "light") {
            options[mname] = false;
            options[cname] = "";
            options[tname] = 0;
            options[uname] = 0;
        }
        options[vname] = false;
        options[vcname] = "";

        var isOpacity = p === "opacity";
        if (isOpacity && stdMat.blendType === pc.BLEND_NONE && stdMat.alphaTest === 0.0 && !stdMat.alphaToCoverage)
            return options;

        if (!minimalOptions || isOpacity) {
            if (p !== "height" && stdMat[vname]) {
                if (hasVcolor) {
                    options[vname] = stdMat[vname];
                    options[vcname] = stdMat[vcname];
                    options.vertexColors = true;
                }
            }
            if (stdMat[mname]) {
                var allow = true;
                if (stdMat[uname] === 0 && !hasUv0) allow = false;
                if (stdMat[uname] === 1 && !hasUv1) allow = false;
                if (allow) {
                    options[mname] = !!stdMat[mname];
                    options[tname] = this._getMapTransformID(stdMat[tname], stdMat[uname]);
                    options[cname] = stdMat[cname];
                    options[uname] = stdMat[uname];
                }
            }
        }
    };

    StandardMaterialOptionsBuilder.prototype._collectLights = function (lType, lights, lightsFiltered, mask, staticLightList) {
        var light;
        var i;
        for (i = 0; i < lights.length; i++) {
            light = lights[i];
            if (light._enabled) {
                if (light._mask & mask) {
                    if (lType !== pc.LIGHTTYPE_DIRECTIONAL) {
                        if (light.isStatic) {
                            continue;
                        }
                    }
                    lightsFiltered.push(light);
                }
            }
        }

        if (staticLightList) {
            for (i = 0; i < staticLightList.length; i++) {
                light = staticLightList[i];
                if (light._type === lType) {
                    lightsFiltered.push(light);
                }
            }
        }
    };

    StandardMaterialOptionsBuilder.prototype._getMapTransformID = function (xform, uv) {
        if (!xform) return 0;
        if (!this._mapXForms[uv]) this._mapXForms[uv] = [];

        var i, same;
        for (i = 0; i < this._mapXForms[uv].length; i++) {
            same = true;
            if (this._mapXForms[uv][i][0] != xform.x) {
                same = false;
                break;
            }
            if (this._mapXForms[uv][i][1] != xform.y) {
                same = false;
                break;
            }
            if (this._mapXForms[uv][i][2] != xform.z) {
                same = false;
                break;
            }
            if (this._mapXForms[uv][i][3] != xform.w) {
                same = false;
                break;
            }
            if (same) {
                return i + 1;
            }
        }
        var newID = this._mapXForms[uv].length;
        this._mapXForms[uv][newID] = [];

        this._mapXForms[uv][newID][0] = xform.x;
        this._mapXForms[uv][newID][1] = xform.y;
        this._mapXForms[uv][newID][2] = xform.z;
        this._mapXForms[uv][newID][3] = xform.w;

        return newID + 1;
    };

    return {
        StandardMaterialOptionsBuilder: StandardMaterialOptionsBuilder
    };
}());
