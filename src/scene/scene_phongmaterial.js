pc.extend(pc, function () {

    var _tempTiling = new pc.Vec3();
    var _tempOffset = new pc.Vec3();

    /**
     * @name pc.PhongMaterial
     * @class A Phong material is the main, general purpose material that is most often used for rendering.
     * It can approximate a wide variety of surface types and can simlulate dynamic reflected light.
     * @property {pc.Color} ambient The ambient color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.Color} diffuse The diffuse color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.Texture} diffuseMap The diffuse map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for diffuse
     * color in preference to the 'diffuse' property.
     * @property {pc.Vec2} diffuseMapTiling Controls the 2D tiling of the diffuse map.
     * @property {pc.Vec2} diffuseMapOffset Controls the 2D offset of the diffuse map. Each component is between 0 and 1.
     * @property {pc.Color} specular The specular color of the material. This color value is 3-component (RGB),
     * @property {pc.Texture} specularMap The per-pixel specular map of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * specular color in preference to the 'specular' property.
     * @property {pc.Vec2} specularMapTiling Controls the 2D tiling of the specular map.
     * @property {pc.Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is between 0 and 1.
     * @property {Number} metalness Defines how much the surface is metallic. From 0 (dielectric) to 1 (metal).
     * This can be used as alternative to specular color to save space.
     * Metallic surfaces have their reflection tinted with diffuse color.
     * @property {pc.Texture} metalnessMap Monochrome metalness map.
     * @property {Boolean} useMetalness Use metalness properties instead of specular.
     * @property {Number} shininess Defines glossiness of the material from 0 (rough) to 100 (mirror).
     * A higher shininess value results in a more focussed specular highlight.
     * @property {pc.Texture} glossMap The per-pixel gloss of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * shininess in preference to the 'shininess' property.
     * @property {pc.Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
     * @property {pc.Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is between 0 and 1.
     * @property {Number} refraction Defines the visibility of refraction. Material can refract the same cube map as used for reflections.
     * @property {Number} refractionIndex Defines the index of refraction, i.e. the amount of distortion.
     * The value is calculated as (outerIor / surfaceIor), where inputs are measured indices of refraction, the one around the object and the one of it's own surface.
     * In most situations outer medium is air, so outerIor will be approximately 1. Then you only need to do (1.0 / surfaceIor).
     * @property {pc.Vec3} emissive The emissive color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.Texture} emissiveMap The emissive map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for emissive
     * color in preference to the 'emissive' property.
     * @property {Number} emissiveIntensity Emissive color multiplier.
     * @property {pc.Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
     * @property {pc.Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is between 0 and 1.
     * @property {Number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
     * transparent and 1 is fully opaque. If you want the material to be transparent you also need to
     * set the {@link pc.PhongMaterial#blendType} to pc.BLEND_NORMAL or pc.BLEND_ADDITIVE.
     * @property {pc.Texture} opacityMap The opacity map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for opacity
     * in preference to the 'opacity' property. If you want the material to be transparent you also need to
     * set the {@link pc.PhongMaterial#blendType} to pc.BLEND_NORMAL or pc.BLEND_ADDITIVE.
     * @property {pc.Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
     * @property {pc.Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is between 0 and 1.
     * @property {Number} blendType The type of blending for this material. Can be one of the following valus: pc.BLEND_NONE, pc.BLEND_NORMAL, pc.BLEND_ADDITIVE.
     * @property {pc.Texture} normalMap The normal map of the material. This must be a 2D texture rather
     * than a cube map. The texture must contains normalized, tangent space normals.
     * @property {pc.Vec2} normalMapTiling Controls the 2D tiling of the normal map.
     * @property {pc.Vec2} normalMapOffset Controls the 2D offset of the normal map. Each component is between 0 and 1.
     * @property {pc.Texture} heightMap The height map of the material. This must be a 2D texture rather
     * than a cube map. The texture contain values defining the height of the surface at that point where darker
     * pixels are lower and lighter pixels are higher.
     * @property {pc.Vec2} heightMapTiling Controls the 2D tiling of the height map.
     * @property {pc.Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is between 0 and 1.
     * @property {Number} bumpiness The bumpiness of the material. This value scales the assigned normal map
     * and can be between 0 and 1, where 0 shows no contribution from the normal map and 1 results in a full contribution.
     * @property {Number} heightMapFactor Height map multiplier. Height maps are used to create a parallax mapping effect
     * and modifying this value will alter the strength of the parallax effect.
     * @property {pc.Texture} sphereMap The spherical environment map of the material.
     * @property {pc.Texture} cubeMap The cubic environment map of the material.
     * @property {Number} reflectivity The reflectivity of the material. This value scales the reflection map and
     * can be between 0 and 1, where 0 shows no reflection and 1 is fully reflective.
     * @property {pc.Texture} lightMap The light map of the material. This must be a 2D texture rather
     * than a cube map.
     * @property {Boolean} ambientTint Enables scene ambient multiplication by material ambient color.
     * @property {Boolean} diffuseMapTint Enables diffuseMap multiplication by diffuse color.
     * @property {Boolean} specularMapTint Enables specularMap multiplication by specular color.
     * @property {Boolean} emissiveMapTint Enables emissiveMap multiplication by emissive color.
     * @property {pc.Texture} aoMap Baked ambient occlusion map. Modulates ambient color.
     * @property {Boolean} occludeSpecular Uses aoMap to occlude specular/reflection. It's a hack, because real specular occlusion is view-dependent. However, it's much better than nothing.
     * @property {Number} occludeSpecularIntensity Controls visibility of specular occlusion.
     * @property {Boolean} specularAntialias Enables Toksvig AA for mipmapped normal maps with specular.
     * @property {Boolean} conserveEnergy Defines how diffuse and specular components are combined when Fresnel is on.
        It is recommended that you leave this option enabled, although you may want to disable it in case when all reflection comes only from a few light sources, and you don't use an environment map, therefore having mostly black reflection.
     * @property {Number} shadingModel Defines the shading model.
     * <ul>
     * <li><strong>{@link pc.SPECULAR_PHONG}</strong>: Phong without energy conservation. You should only use it as a backwards compatibility with older projects.</li>
     * <li><strong>{@link pc.SPECULAR_BLINN}</strong>: Energy-conserving Blinn-Phong.</li>
     * </ul>
     * @property {Number} fresnelModel Defines the formula used for Fresnel effect.
     As a side-effect, enabling any Fresnel model changes the way diffuse and reflection components are combined.
     When Fresnel is off, legacy non energy-conserving combining is used. When it is on, combining behaviour is defined by conserveEnergy parameter.
     * <ul>
     * <li><strong>{@link pc.FRESNEL_NONE}</strong>: No Fresnel.</li>
     * <li><strong>{@link pc.FRESNEL_SCHLICK}</strong>: Schlick's approximation of Fresnel (recommended). Parameterized by specular color.</li>
     * </ul>
     * @author Will Eastcott and Arthur Rahteenko
     */
    var PhongMaterial = function () {
        this.reset();
        this.update();
    };

    var _createTexture = function (param) {
        if (param.data) {
            if (param.data instanceof pc.Texture) {
                return param.data;
            } else {
                return null;
                // throw Error("PhongMaterial.init() expects textures to already be created");
            }
        } else {
            return null;
        }
    };

    var _createCubemap = function (param) {
        if (param.data) {
            if (param.data instanceof pc.Texture) {
                return param.data;
            }
        }

        // PhongMaterial expects cubemap texture to be supplied
        return null;
    };

    var _createVec2 = function (param) {
        return new pc.Vec2(param.data[0], param.data[1]);
    };

    var _createVec3 = function (param) {
        return new pc.Vec3(param.data[0], param.data[1], param.data[2]);
    };

    var _createRgb = function (param) {
        return new pc.Color(param.data[0], param.data[1], param.data[2]);
    };

    var _propsSerial = [];
    var _propsSerialDefaultVal = [];
    var _propsInternalNull = [];
    var _propsInternalVec3 = [];
    var _prop2Uniform = {};

    var _defineTex2D = function (obj, name, uv, channels) {
        var privMap = "_" + name + "Map";
        var privMapTiling = privMap + "Tiling";
        var privMapOffset = privMap + "Offset";
        var mapTransform = privMap.substring(1) + "Transform";
        var privMapUv = privMap + "Uv";
        var privMapChannel = privMap + "Channel";
        var privMapVertexColor = privMap + "VertexColor";

        obj[privMap] = null;
        obj[privMapTiling] = new pc.Vec2(1, 1);
        obj[privMapOffset] = new pc.Vec2(0, 0);
        obj[mapTransform] = null;
        obj[privMapUv] = uv;
        if (channels > 0) obj[privMapChannel] = channels > 1? "rgb" : "g";
        obj[privMapVertexColor] = false;

        if (!pc._matTex2D) pc._matTex2D = [];
        pc._matTex2D[name] = channels;

        Object.defineProperty(PhongMaterial.prototype, privMap.substring(1), {
            get: function() { return this[privMap]; },
            set: function (value) {
                var oldVal = this[privMap];
                if ((!oldVal && value) || (oldVal && !value)) this.dirtyShader = true;
                if (oldVal && value) {
                    if (oldVal.rgbm!==value.rgbm || oldVal.fixCubemapSeams!==value.fixCubemapSeams || oldVal.format!==value.format) {
                        this.dirtyShader = true;
                    }
                }
                this[privMap] = value;
            }
        });

        var mapTiling = privMapTiling.substring(1);
        var mapOffset = privMapOffset.substring(1);


        Object.defineProperty(PhongMaterial.prototype, mapTiling, {
            get: function() {
                this.dirtyShader = true;
                return this[privMapTiling];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapTiling] = value;
            }
        });
        _prop2Uniform[mapTiling] = function (mat, val, changeMat) {
            var tform = mat._updateMapTransform(
                changeMat? mat[mapTransform] : null,
                val,
                mat[privMapOffset]
            );
            return {name:("texture_" + mapTransform), value:tform.data};
        }


        Object.defineProperty(PhongMaterial.prototype, mapOffset, {
            get: function() {
                this.dirtyShader = true;
                return this[privMapOffset];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapOffset] = value;
            }
        });
        _prop2Uniform[mapOffset] = function (mat, val, changeMat) {
            var tform = mat._updateMapTransform(
                changeMat? mat[mapTransform] : null,
                mat[privMapTiling],
                val
            );
            return {name:("texture_" + mapTransform), value:tform.data};
        }


        Object.defineProperty(PhongMaterial.prototype, privMapUv.substring(1), {
            get: function() { return this[privMapUv]; },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapUv] = value;
            }
        });
        Object.defineProperty(PhongMaterial.prototype, privMapChannel.substring(1), {
            get: function() { return this[privMapChannel]; },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapChannel] = value;
            }
        });
        Object.defineProperty(PhongMaterial.prototype, privMapVertexColor.substring(1), {
            get: function() { return this[privMapVertexColor]; },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapVertexColor] = value;
            }
        });

        _propsSerial.push(privMap.substring(1));
        _propsSerial.push(privMapTiling.substring(1));
        _propsSerial.push(privMapOffset.substring(1));
        _propsSerial.push(privMapUv.substring(1));
        _propsSerial.push(privMapChannel.substring(1));
        _propsSerial.push(privMapVertexColor.substring(1));
        _propsInternalNull.push(mapTransform)
    };

    var _propsColor = [];
    var _defineColor = function (obj, name, defaultValue, hasMultiplier) {
        var priv = "_" + name;
        var uform = name + "Uniform";
        var mult = name + "Intensity";
        var pmult = "_" + mult;
        obj[priv] = defaultValue;
        obj[uform] = new Float32Array(3);
        Object.defineProperty(PhongMaterial.prototype, name, {
            get: function() {
                this.dirtyColor = true;
                this.dirtyShader = true;
                return this[priv];
            },
            set: function (value) {
                var oldVal = this[priv];
                var wasBw = (oldVal.r===0 && oldVal.g===0 && oldVal.b===0) || (oldVal.r===1 && oldVal.g===1 && oldVal.b===1);
                var isBw = (value.r===0 && value.g===0 && value.b===0) || (value.r===1 && value.g===1 && value.b===1);
                if (wasBw || isBw) this.dirtyShader = true;
                this.dirtyColor = true;
                this[priv] = value;
            }
        });
        _propsSerial.push(name);
        _propsInternalVec3.push(uform);
        _propsColor.push(name);
        _prop2Uniform[name] = function (mat, val, changeMat) {
            var arr = changeMat? mat[uform] : new Float32Array(3);
            var scene = mat._scene || pc.Application.getApplication().scene;
            for(var c=0; c<3; c++) {
                if (scene.gammaCorrection) {
                    arr[c] = Math.pow(val.data[c], 2.2);
                } else {
                    arr[c] = val.data[c];
                }
                if (hasMultiplier) arr[c] *= mat[pmult];
            }
            return {name:("material_" + name), value:arr}
        }

        if (hasMultiplier) {
            obj[pmult] = 1;
            Object.defineProperty(PhongMaterial.prototype, mult, {
                get: function() {
                    return this[pmult];
                },
                set: function (value) {
                    var oldVal = this[pmult];
                    var wasBw = oldVal===0 || oldVal===1;
                    var isBw = value===0 || value===1;
                    if (wasBw || isBw) this.dirtyShader = true;
                    this.dirtyColor = true;
                    this[pmult] = value;
                }
            });
            _propsSerial.push(mult);
            _prop2Uniform[mult] = function (mat, val, changeMat) {
                var arr = changeMat? mat[uform] : new Float32Array(3);
                var scene = mat._scene || pc.Application.getApplication().scene;
                for(var c=0; c<3; c++) {
                    if (scene.gammaCorrection) {
                        arr[c] = Math.pow(mat[priv].data[c], 2.2);
                    } else {
                        arr[c] = mat[priv].data[c];
                    }
                    arr[c] *= mat[pmult];
                }
                return {name:("material_" + name), value:arr}
            }
        }
    };

    var _defineFloat = function (obj, name, defaultValue, func) {
        var priv = "_" + name;
        obj[priv] = defaultValue;
        Object.defineProperty(PhongMaterial.prototype, name, {
            get: function() { return this[priv]; },
            set: function (value) {
                var oldVal = this[priv];
                var wasBw = oldVal===0 || oldVal===1;
                var isBw = value===0 || value===1;
                if (wasBw || isBw) this.dirtyShader = true;
                this[priv] = value;
            }
        });
        _propsSerial.push(name);
        _prop2Uniform[name] = func!==undefined? func : (function (mat, val, changeMat) {
            return {name:("material_" + name), value:val}
        });
    };

    var _defineObject = function (obj, name, func) {
        var priv = "_" + name;
        obj[priv] = null;
        Object.defineProperty(PhongMaterial.prototype, name, {
            get: function() { return this[priv]; },
            set: function (value) {
                var oldVal = this[priv];
                if ((!oldVal && value) || (oldVal && !value)) this.dirtyShader = true;
                this[priv] = value;
            }
        });
        _propsSerial.push(name);
        _prop2Uniform[name] = func;
    };

    var _defineChunks = function (obj) {
        this._chunks = null;
        Object.defineProperty(PhongMaterial.prototype, "chunks", {
            get: function() {
                this.dirtyShader = true;
                return this._chunks;
            },
            set: function (value) {
                this.dirtyShader = true;
                this._chunks = value;
            }
        });
        _propsSerial.push("chunks");
    };

    var _defineFlag = function (obj, name, defaultValue) {
        var priv = "_" + name;
        obj[priv] = defaultValue;
        Object.defineProperty(PhongMaterial.prototype, name, {
            get: function() { return this[priv]; },
            set: function (value) {
                this.dirtyShader = true;
                this[priv] = value;
            }
        });
        _propsSerial.push(name);
    };

    PhongMaterial = pc.inherits(PhongMaterial, pc.Material);

    pc.extend(PhongMaterial.prototype, {

        reset: function () {
            this.blendType = pc.BLEND_NONE;

            var i;
            for(i=0; i<_propsSerial.length; i++) {
                var defVal = _propsSerialDefaultVal[i];
                this[ _propsSerial[i] ] = defVal? (defVal.clone? defVal.clone() : defVal) : defVal;
            }
            for(i=0; i<_propsInternalNull.length; i++) {
                this[ _propsInternalNull[i] ] = null;
            }
            for(i=0; i<_propsInternalVec3.length; i++) {
                this[ _propsInternalVec3[i] ] = new Float32Array(3);
            }

            this._chunks = {};
            this._chunks.copy = function(from) {
                for(var p in from) {
                    if (from.hasOwnProperty(p) && p!=="copy") {
                        this[p] = from[p];
                    }
                }
            };

            this.cubeMapMinUniform = new Float32Array(3);
            this.cubeMapMaxUniform = new Float32Array(3);
        },


        /**
         * @function
         * @name pc.PhongMaterial#clone
         * @description Duplicates a Phong material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.PhongMaterial} A cloned Phong material.
         */
        clone: function () {
            var clone = new pc.PhongMaterial();

            pc.Material.prototype._cloneInternal.call(this, clone);

            var pname;
            for(var i=0; i<_propsSerial.length; i++) {
                pname = _propsSerial[i];
                if (this[pname]!==undefined) {
                    if (this[pname] && this[pname].copy) {
                        if (clone[pname]) {
                            clone[pname].copy(this[pname]);
                        } else {
                            clone[pname] = this[pname].clone();
                        }
                    } else {
                        clone[pname] = this[pname];
                    }
                }
            }

            clone.update();
            return clone;
        },

        /**
        * @private
        * @name pc.PhoneMaterial#init
        * @description Update material data from a data block, as found on a material Asset.
        * Note, init() expects texture parameters to contain a {@link pc.Texture} not a resource id.
        */
        init: function (data) {
            this.reset();

            // Initialise material from data
            this.name = data.name;

            for (var i = 0; i < data.parameters.length; i++) {
                var param = data.parameters[i];
                if (param.type === "vec3") {
                    this[param.name] = _createRgb(param);
                } else if (param.type === "vec2") {
                    this[param.name] = _createVec2(param);
                } else if (param.type === "texture") {
                    this[param.name] = _createTexture(param);
                } else if (param.type === "cubemap") {
                    this[param.name] = _createCubemap(param);
                } else if (param.name === "bumpMapFactor") { // Unfortunately, names don't match for bumpiness
                    this.bumpiness = param.data;
                } else {
                    this[param.name] = param.data;
                }
            }

            this.update();
        },

        _updateMapTransform: function (transform, tiling, offset) {
            transform = transform || new pc.Vec4();
            transform.set(tiling.x, tiling.y, offset.x, offset.y);

            if ((transform.x==1) && (transform.y==1) && (transform.z==0) && (transform.w==0)) return null;
            return transform;
        },

        _collectLights: function(lType, lights, lightsSorted, mask) {
            for (var i = 0; i < lights.length; i++) {
                if (lights[i].getEnabled()) {
                    if (lights[i].mask & mask) {
                        if (lights[i].getType()==lType) {
                            lightsSorted.push(lights[i]);
                        }
                    }
                }
            }
        },

        _updateMap: function (p) {
            var mname = p + "Map";
            if (this[mname]) {
                this.setParameter("texture_" + mname, this[mname]);

                var tname = mname + "Transform";
                this[tname] = this._updateMapTransform(
                    this[tname],
                    this[mname + "Tiling"],
                    this[mname + "Offset"]
                );

                if (this[tname]) {
                    this.setParameter('texture_' + tname, this[tname].data);
                }
            }
        },

        getUniform: function(varName, value, changeMat) {
            var func = _prop2Uniform[varName];
            if (func) {
                return func(this, value, changeMat);
            }
            return null;
        },

        update: function () {
            this.clearParameters();

            this.setParameter('material_ambient', this.ambientUniform);

            if (!this.diffuseMap || this.diffuseMapTint) {
                this.setParameter('material_diffuse', this.diffuseUniform);
            }

            if (!this.useMetalness) {
                if (!this.specularMap || this.specularMapTint) {
                    this.setParameter('material_specular', this.specularUniform);
                }
            } else {
                if (!this.metalnessMap || this.metalness<1) {
                    this.setParameter('material_metalness', this.metalness);
                }
            }

            this.setParameter(this.getUniform("shininess", this.shininess, true));

            if (!this.emissiveMap || this.emissiveMapTint) {
                this.setParameter('material_emissive', this.emissiveUniform);
            }

            if (this.refraction>0) {
                this.setParameter('material_refraction', this.refraction);
                this.setParameter('material_refractionIndex', this.refractionIndex);
            }

            this.setParameter('material_opacity', this.opacity);

            if (this.occludeSpecular) {
                this.setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
            }

            if (this.cubeMapProjection===pc.CUBEPROJ_BOX) {
                this.setParameter(this.getUniform("cubeMapProjectionBox", this.cubeMapProjectionBox, true));
            }

            for(var p in pc._matTex2D) {
                this._updateMap(p);
            }

            if (this.ambientSH) {
                this.setParameter('ambientSH[0]', this.ambientSH);
            }

            if (this.normalMap) {
                this.setParameter('material_bumpiness', this.bumpiness);
            }

            if (this.heightMap) {
                this.setParameter(this.getUniform('heightMapFactor', this.heightMapFactor, true));
            }

            if (this.cubeMap) {
                this.setParameter('texture_cubeMap', this.cubeMap);
            }
            if (this.prefilteredCubeMap128) {
                this.setParameter('texture_prefilteredCubeMap128', this.prefilteredCubeMap128);
            }
            if (this.prefilteredCubeMap64) {
                this.setParameter('texture_prefilteredCubeMap64', this.prefilteredCubeMap64);
            }
            if (this.prefilteredCubeMap32) {
                this.setParameter('texture_prefilteredCubeMap32', this.prefilteredCubeMap32);
            }
            if (this.prefilteredCubeMap16) {
                this.setParameter('texture_prefilteredCubeMap16', this.prefilteredCubeMap16);
            }
            if (this.prefilteredCubeMap8) {
                this.setParameter('texture_prefilteredCubeMap8', this.prefilteredCubeMap8);
            }
            if (this.prefilteredCubeMap4) {
                this.setParameter('texture_prefilteredCubeMap4', this.prefilteredCubeMap4);
            }
            if (this.sphereMap) {
                this.setParameter('texture_sphereMap', this.sphereMap);
            }
            if (this.dpAtlas) {
                this.setParameter('texture_sphereMap', this.dpAtlas);
            }
            //if (this.sphereMap || this.cubeMap || this.prefilteredCubeMap128) {
                this.setParameter('material_reflectivity', this.reflectivity);
            //}

            if (this.dirtyShader || !this._scene) {
                this.shader = null;
                this.clearVariants();
            }

            this._processColor();
        },

        _processColor: function () {
            if (!this._scene) return;
            if (this.dirtyColor) {
                // Gamma correct colors
                for(i=0; i<_propsColor.length; i++) {
                    var clr = this[ "_" + _propsColor[i] ];
                    var arr = this[ _propsColor[i] + "Uniform" ];
                    for(c=0; c<3; c++) {
                        if (this._scene.gammaCorrection) {
                            arr[c] = Math.pow(clr.data[c], 2.2);
                        } else {
                            arr[c] = clr.data[c];
                        }
                    }
                }
                for(c=0; c<3; c++) {
                    this.emissiveUniform[c] *= this.emissiveIntensity;
                }
                this.dirtyColor = false;
            }
        },

        _getMapTransformID: function(xform, uv) {
            if (!xform) return 0;
            if (!this._mapXForms[uv]) this._mapXForms[uv] = [];

            var i, j, same;
            for(i=0; i<this._mapXForms[uv].length; i++) {
                same = true;
                for(j=0; j<xform.data.length; j++) {
                    if (this._mapXForms[uv][i][j] != xform.data[j]) {
                        same = false;
                        break;
                    }
                }
                if (same) {
                    return i + 1;
                }
            }
            var newID = this._mapXForms[uv].length;
            this._mapXForms[uv][newID] = [];
            for(j=0; j<xform.data.length; j++) {
                this._mapXForms[uv][newID][j] = xform.data[j];
            }
            return newID + 1;
        },

        updateShader: function (device, scene, objDefs, forceRegenShader) {
            var i, c;
            if (!this._scene) {
                this._scene = scene;
                this._processColor();
            }

            var lights = scene._lights;
            this._mapXForms = [];

            var useTexCubeLod = device.useTexCubeLod;
            var useDp = !device.extTextureLod; // no basic extension? likely slow device, force dp

            var prefilteredCubeMap128 = this.prefilteredCubeMap128 || scene.skyboxPrefiltered128;
            var prefilteredCubeMap64 = this.prefilteredCubeMap64 || scene.skyboxPrefiltered64;
            var prefilteredCubeMap32 = this.prefilteredCubeMap32 || scene.skyboxPrefiltered32;
            var prefilteredCubeMap16 = this.prefilteredCubeMap16 || scene.skyboxPrefiltered16;
            var prefilteredCubeMap8 = this.prefilteredCubeMap8 || scene.skyboxPrefiltered8;
            var prefilteredCubeMap4 = this.prefilteredCubeMap4 || scene.skyboxPrefiltered4;

            if (prefilteredCubeMap128) {
                var allMips = prefilteredCubeMap128 &&
                              prefilteredCubeMap64 &&
                              prefilteredCubeMap32 &&
                              prefilteredCubeMap16 &&
                              prefilteredCubeMap8 &&
                              prefilteredCubeMap4;

                if (useDp && allMips) {
                    if (!prefilteredCubeMap128.dpAtlas) {
                        prefilteredCubeMap128.dpAtlas = pc.generateDpAtlas(device,
                            [prefilteredCubeMap128, prefilteredCubeMap64, prefilteredCubeMap32, prefilteredCubeMap16,
                            prefilteredCubeMap8, prefilteredCubeMap4]);
                        prefilteredCubeMap128.sh = pc.shFromCubemap(prefilteredCubeMap16);
                    }
                    this.dpAtlas = prefilteredCubeMap128.dpAtlas;
                    this.ambientSH = prefilteredCubeMap128.sh;
                    this.setParameter('ambientSH[0]', this.ambientSH);
                    this.setParameter('texture_sphereMap', this.dpAtlas);
                } else if (useTexCubeLod) {
                    if (prefilteredCubeMap128._levels.length<6) {
                        if (allMips) {
                            // Multiple -> single (provided cubemap per mip, but can use texCubeLod)
                            this.setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                        } else {
                            console.log("Can't use prefiltered cubemap: " + allMips + ", " + useTexCubeLod + ", " + prefilteredCubeMap128._levels);
                        }
                    } else {
                        // Single (able to use single cubemap with texCubeLod)
                        this.setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                    }
                } else if (allMips) {
                    // Multiple (no texCubeLod, but able to use cubemap per mip)
                    this.setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                    this.setParameter('texture_prefilteredCubeMap64', prefilteredCubeMap64);
                    this.setParameter('texture_prefilteredCubeMap32', prefilteredCubeMap32);
                    this.setParameter('texture_prefilteredCubeMap16', prefilteredCubeMap16);
                    this.setParameter('texture_prefilteredCubeMap8', prefilteredCubeMap8);
                    this.setParameter('texture_prefilteredCubeMap4', prefilteredCubeMap4);
                } else {
                    console.log("Can't use prefiltered cubemap: " + allMips + ", " + useTexCubeLod + ", " + prefilteredCubeMap128._levels);
                }
            }

            var specularTint = false;
            var useSpecular = (this.useMetalness? true : !!this.specularMap) || (!!this.sphereMap) || (!!this.cubeMap) || (!!this.dpAtlas);
            useSpecular = useSpecular || (this.useMetalness? true : !(this.specular.r===0 && this.specular.g===0 && this.specular.b===0));

            if (useSpecular) {
                if (this.specularMapTint && !this.useMetalness) {
                    specularTint = this.specular.r!==1 || this.specular.g!==1 || this.specular.b!==1;
                }
            }

            var rgbmReflection = (prefilteredCubeMap128? prefilteredCubeMap128.rgbm : false) ||
                                 (this.cubeMap? this.cubeMap.rgbm : false) ||
                                 (this.sphereMap? this.sphereMap.rgbm : false) ||
                                 (this.dpAtlas? this.dpAtlas.rgbm : false);

            var hdrReflection = (prefilteredCubeMap128? prefilteredCubeMap128.rgbm || prefilteredCubeMap128.format===pc.PIXELFORMAT_RGBA32F : false) ||
                                 (this.cubeMap? this.cubeMap.rgbm || this.cubeMap.format===pc.PIXELFORMAT_RGBA32F : false) ||
                                 (this.sphereMap? this.sphereMap.rgbm || this.sphereMap.format===pc.PIXELFORMAT_RGBA32F : false) ||
                                 (this.dpAtlas? this.dpAtlas.rgbm || this.dpAtlas.format===pc.PIXELFORMAT_RGBA32F : false);

            var options = {
                fog:                        scene.fog,
                gamma:                      scene.gammaCorrection,
                toneMap:                    scene.toneMapping,
                blendMapsWithColors:        true,
                modulateAmbient:            this.ambientTint,
                diffuseTint:                (this.diffuse.r!=1 || this.diffuse.g!=1 || this.diffuse.b!=1) && this.diffuseMapTint,
                specularTint:               specularTint,
                metalnessTint:              this.useMetalness && this.metalness<1,
                glossTint:                  true,
                emissiveTint:               (this.emissive.r!=1 || this.emissive.g!=1 || this.emissive.b!=1 || this.emissiveIntensity!=1) && this.emissiveMapTint,
                opacityTint:                this.opacity!=1 && this.blendType!==pc.BLEND_NONE,
                alphaTest:                  this.alphaTest > 0,
                needsNormalFloat:           this.normalizeNormalMap,

                sphereMap:                  !!this.sphereMap,
                cubeMap:                    !!this.cubeMap,
                dpAtlas:                    !!this.dpAtlas,
                ambientSH:                  !!this.ambientSH,
                useSpecular:                useSpecular,
                rgbmReflection:             rgbmReflection,
                hdrReflection:              hdrReflection,
                fixSeams:                   prefilteredCubeMap128? prefilteredCubeMap128.fixCubemapSeams : (this.cubeMap? this.cubeMap.fixCubemapSeams : false),
                prefilteredCubemap:         !!prefilteredCubeMap128,
                emissiveFormat:             this.emissiveMap? (this.emissiveMap.rgbm? 1 : (this.emissiveMap.format===pc.PIXELFORMAT_RGBA32F? 2 : 0)) : null,
                lightMapFormat:             this.lightMap? (this.lightMap.rgbm? 1 : (this.lightMap.format===pc.PIXELFORMAT_RGBA32F? 2 : 0)) : null,
                useRgbm:                    rgbmReflection || (this.emissiveMap? this.emissiveMap.rgbm : 0) || (this.lightMap? this.lightMap.rgbm : 0),
                specularAA:                 this.specularAntialias,
                conserveEnergy:             this.conserveEnergy,
                occludeSpecular:            this.occludeSpecular,
                occludeSpecularFloat:      (this.occludeSpecularIntensity !== 1.0),
                occludeDirect:              this.occludeDirect,
                shadingModel:               this.shadingModel,
                fresnelModel:               this.fresnelModel,
                packedNormal:               this.normalMap? this.normalMap._compressed : false,
                shadowSampleType:           this.shadowSampleType,
                forceFragmentPrecision:     this.forceFragmentPrecision,
                fastTbn:                    this.fastTbn,
                cubeMapProjection:          this.cubeMapProjection,
                chunks:                     this.chunks,
                customFragmentShader:       this.customFragmentShader,
                refraction:                 !!this.refraction,
                useMetalness:               this.useMetalness,
                blendType:                  this.blendType,
                skyboxIntensity:            (prefilteredCubeMap128===scene.skyboxPrefiltered128 && prefilteredCubeMap128) && (scene.skyboxIntensity!==1),
                useTexCubeLod:              useTexCubeLod
            };

            var hasUv1 = false;
            var hasVcolor = false;
            if (objDefs) {
                options.noShadow = (objDefs & pc.SHADERDEF_NOSHADOW) !== 0;
                options.skin = (objDefs & pc.SHADERDEF_SKIN) !== 0;
                options.useInstancing = (objDefs & pc.SHADERDEF_INSTANCING) !== 0;
                hasUv1 = (objDefs & pc.SHADERDEF_UV1) !== 0;
                hasVcolor = (objDefs & pc.SHADERDEF_VCOLOR) !== 0;
            }

            for(var p in pc._matTex2D) {
                if (p==="opacity" && this.blendType===pc.BLEND_NONE && this.alphaTest===0.0) continue;
                var mname = p + "Map";
                var vname = mname + "VertexColor";
                if (p!=="height" && this[vname]) {
                    if (hasVcolor) {
                        var cname = mname + "Channel";
                        options[vname] = this[vname];
                        options[cname] = this[cname];
                        options.vertexColors = true;
                    }
                } else if (this[mname]) {
                    var uname = mname + "Uv";
                    var allow = true;
                    if (this[uname]===1 && !hasUv1) allow = false;
                    if (allow) {
                        options[mname] = !!this[mname];
                        var tname = mname + "Transform";
                        var cname = mname + "Channel";
                        options[tname] = this._getMapTransformID(this[tname], this[uname]);
                        options[cname] = this[cname];
                        options[uname] = this[uname];
                    }
                }
            }

            options.aoMapUv = options.aoMapUv || this.aoUvSet; // backwards comp

            this._mapXForms = null;

            var lightsSorted = [];
            var mask = objDefs? (objDefs >> 8) : 1;
            this._collectLights(pc.LIGHTTYPE_DIRECTIONAL, lights, lightsSorted, mask);
            this._collectLights(pc.LIGHTTYPE_POINT,       lights, lightsSorted, mask);
            this._collectLights(pc.LIGHTTYPE_SPOT,        lights, lightsSorted, mask);
            options.lights = lightsSorted;


            var library = device.getProgramLibrary();
            this.shader = library.getProgram('phong', options);

            if (!objDefs) {
                this.clearVariants();
                this.variants[0] = this.shader;
            }

            this.dirtyShader = false;
        }
    });

    var _defineMaterialProps = function (obj) {

        obj.dirtyShader = true;
        obj.dirtyColor = true;
        obj._scene = null;

        _defineColor(obj, "ambient", new pc.Color(0.7, 0.7, 0.7));
        _defineColor(obj, "diffuse", new pc.Color(1, 1, 1));
        _defineColor(obj, "specular", new pc.Color(0, 0, 0));
        _defineColor(obj, "emissive", new pc.Color(0, 0, 0), true);

        _defineFloat(obj, "shininess", 25, function(mat, shininess) {
            // Shininess is 0-100 value
            // which is actually a 0-1 glosiness value.
            // Can be converted to specular power using exp2(shininess * 0.01 * 11)
            var value;
            if (mat.shadingModel===pc.SPECULAR_PHONG) {
                value = Math.pow(2, shininess * 0.01 * 11); // legacy: expand back to specular power
            } else {
                value = shininess * 0.01; // correct
            }
            return {name:"material_shininess", value:value};
        });
        _defineFloat(obj, "heightMapFactor", 1, function(mat, height) {
            return {name:'material_heightMapFactor', value:height * 0.025};
        });
        _defineFloat(obj, "opacity", 1);
        _defineFloat(obj, "alphaTest", 0);
        _defineFloat(obj, "bumpiness", 1);
        _defineFloat(obj, "reflectivity", 1);
        _defineFloat(obj, "occludeSpecularIntensity", 1);
        _defineFloat(obj, "refraction", 0);
        _defineFloat(obj, "refractionIndex", 1.0 / 1.5); // approx. (air ior / glass ior)
        _defineFloat(obj, "metalness", 1);
        _defineFloat(obj, "aoUvSet", 0, null); // legacy

        _defineObject(obj, "ambientSH", function (mat, val, changeMat) {
            return {name:"ambientSH[0]", value:val};
        });

        _defineObject(obj, "cubeMapProjectionBox", function (mat, val, changeMat) {
                var bmin = changeMat? mat.cubeMapMinUniform : new Float32Array(3);
                var bmax = changeMat? mat.cubeMapMaxUniform : new Float32Array(3);

                bmin[0] = val.center.x - val.halfExtents.x;
                bmin[1] = val.center.y - val.halfExtents.y;
                bmin[2] = val.center.z - val.halfExtents.z;

                bmax[0] = val.center.x + val.halfExtents.x;
                bmax[1] = val.center.y + val.halfExtents.y;
                bmax[2] = val.center.z + val.halfExtents.z;

                return [{name:"envBoxMin", value:bmin}, {name:"envBoxMax", value:bmax}];
        });

        _defineChunks(obj);

        _defineFlag(obj, "ambientTint", false);
        _defineFlag(obj, "diffuseMapTint", false);
        _defineFlag(obj, "specularMapTint", false);
        _defineFlag(obj, "emissiveMapTint", false);
        _defineFlag(obj, "fastTbn", false);
        _defineFlag(obj, "specularAntialias", false);
        _defineFlag(obj, "useMetalness", false);
        _defineFlag(obj, "occludeDirect", false);
        _defineFlag(obj, "normalizeNormalMap", true);
        _defineFlag(obj, "conserveEnergy", true);
        _defineFlag(obj, "occludeSpecular", true);
        _defineFlag(obj, "shadingModel", pc.SPECULAR_PHONG);
        _defineFlag(obj, "fresnelModel", pc.FRESNEL_NONE);
        _defineFlag(obj, "cubeMapProjection", pc.CUBEPROJ_NONE);
        _defineFlag(obj, "shadowSampleType", pc.SHADOWSAMPLE_PCF3X3);
        _defineFlag(obj, "customFragmentShader", null);
        _defineFlag(obj, "forceFragmentPrecision", null);

        _defineTex2D(obj, "diffuse", 0, 3);
        _defineTex2D(obj, "specular", 0, 3);
        _defineTex2D(obj, "emissive", 0, 3);
        _defineTex2D(obj, "normal", 0, -1);
        _defineTex2D(obj, "metalness", 0, 1);
        _defineTex2D(obj, "gloss", 0, 1);
        _defineTex2D(obj, "opacity", 0, 1);
        _defineTex2D(obj, "height", 0, 1);
        _defineTex2D(obj, "ao", 0, 1);
        _defineTex2D(obj, "light", 1, 3);

        _defineObject(obj, "cubeMap");
        _defineObject(obj, "sphereMap");
        _defineObject(obj, "dpAtlas");
        _defineObject(obj, "prefilteredCubeMap128");
        _defineObject(obj, "prefilteredCubeMap64");
        _defineObject(obj, "prefilteredCubeMap32");
        _defineObject(obj, "prefilteredCubeMap16");
        _defineObject(obj, "prefilteredCubeMap8");
        _defineObject(obj, "prefilteredCubeMap4");

        for(var i=0; i<_propsSerial.length; i++) {
            _propsSerialDefaultVal[i] = obj[ _propsSerial[i] ];
        }
    }

    _defineMaterialProps(PhongMaterial.prototype);

    return {
        PhongMaterial: PhongMaterial
    };
}());
