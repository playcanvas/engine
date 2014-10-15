pc.extend(pc.scene, function () {

    var _tempTiling = new pc.Vec3();
    var _tempRotation = new pc.Quat();
    var _tempOffset = new pc.Vec3();

    /**
     * @name pc.scene.PhongMaterial
     * @class A Phong material is the main, general purpose material that is most often used for rendering.
     * It can approximate a wide variety of surface types and can simlulate dynamic reflected light.
     * @property {pc.Color} ambient The ambient color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.Color} diffuse The diffuse color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} diffuseMap The diffuse map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for diffuse
     * color in preference to the 'diffuse' property.
     * @property {pc.Vec2} diffuseMapTiling Controls the 2D tiling of the diffuse map.
     * @property {pc.Vec2} diffuseMapOffset Controls the 2D offset of the diffuse map. Each component is between 0 and 1.
     * @property {pc.Vec3} diffuseMapRotation Controls the rotation of the diffuse map. The value represents U,V,W angles in degrees.
     * @property {pc.Color} specular The specular color of the material. This color value is 3-component (RGB),
     * @property {pc.gfx.Texture} specularMap The per-pixel specular map of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * specular color in preference to the 'specular' property.
     * @property {pc.Vec2} specularMapTiling Controls the 2D tiling of the specular map.
     * @property {pc.Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is between 0 and 1.
     * @property {pc.Vec3} specularMapRotation Controls the rotation of the specular map. The value represents U,V,W angles in degrees.
     * @property {Number} shininess The specular shine of the material. This value can be between 0 and 128.
     * A higher shininess value results in a more focussed specular highlight.
     * @property {pc.gfx.Texture} glossMap The per-pixel gloss of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * shininess in preference to the 'shininess' property.
     * @property {pc.Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
     * @property {pc.Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is between 0 and 1.
     * @property {pc.Vec3} glossMapRotation Controls the rotation of the gloss map. The value represents U,V,W angles in degrees.
     * @property {pc.Vec3} emissive The emissive color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} emissiveMap The emissive map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for emissive
     * color in preference to the 'emissive' property.
     * @property {pc.Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
     * @property {pc.Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is between 0 and 1.
     * @property {pc.Vec3} emissiveMapRotation Controls the rotation of the emissive map. The value represents U,V,W angles in degrees.
     * @property {Number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
     * transparent and 1 is fully opaque. If you want the material to be transparent you also need to
     * set the {@link pc.scene.PhongMaterial#blendType} to pc.scene.BLEND_NORMAL or pc.scene.BLEND_ADDITIVE.
     * @property {pc.gfx.Texture} opacityMap The opacity map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for opacity
     * in preference to the 'opacity' property. If you want the material to be transparent you also need to
     * set the {@link pc.scene.PhongMaterial#blendType} to pc.scene.BLEND_NORMAL or pc.scene.BLEND_ADDITIVE.
     * @property {pc.Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
     * @property {pc.Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is between 0 and 1.
     * @property {pc.Vec3} opacityMapRotation Controls the rotation of the opacity map. The value represents U,V,W angles in degrees.
     * @property {Number} blendType The type of blending for this material. Can be one of the following valus: pc.scene.BLEND_NONE, pc.scene.BLEND_NORMAL, pc.scene.BLEND_ADDITIVE.
     * @property {pc.gfx.Texture} normalMap The normal map of the material. This must be a 2D texture rather
     * than a cube map. The texture must contains normalized, tangent space normals.
     * @property {pc.Vec2} normalMapTiling Controls the 2D tiling of the normal map.
     * @property {pc.Vec2} normalMapOffset Controls the 2D offset of the normal map. Each component is between 0 and 1.
     * @property {pc.Vec3} normalMapRotation Controls the rotation of the normal map. The value represents U,V,W angles in degrees.
     * @property {pc.gfx.Texture} heightMap The height map of the material. This must be a 2D texture rather
     * than a cube map. The texture contain values defining the height of the surface at that point where darker
     * pixels are lower and lighter pixels are higher.
     * @property {pc.Vec2} heightMapTiling Controls the 2D tiling of the height map.
     * @property {pc.Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is between 0 and 1.
     * @property {pc.Vec3} heightMapRotation Controls the rotation of the height map. The value represents U,V,W angles in degrees.
     * @property {Number} bumpiness The bumpiness of the material. This value scales the assinged bump map
     * (be that a normal map or a height map) and can be between 0 and 1, where 0 shows no contribution from
     * the bump map and 1 results in a full contribution.
     * @property {pc.gfx.Texture} sphereMap The spherical environment map of the material.
     * @property {pc.gfx.Texture} cubeMap The cubic environment map of the material.
     * @property {Number} reflectivity The reflectivity of the material. This value scales the reflection map and
     * can be between 0 and 1, where 0 shows no reflection and 1 is fully reflective.
     * @property {pc.gfx.Texture} lightMap The light map of the material. This must be a 2D texture rather
     * than a cube map.
     * @author Will Eastcott
     */
    var PhongMaterial = function () {
        this.ambient = new pc.Color(0.7, 0.7, 0.7);

        this.diffuse = new pc.Color(0.7, 0.7, 0.7);
        this.diffuseMap = null;
        this.diffuseMapTiling = new pc.Vec2(1, 1);
        this.diffuseMapOffset = new pc.Vec2(0, 0);
        this.diffuseMapRotation = new pc.Vec3(0, 0, 0);
        this.diffuseMapTransform = null;

        this.specular = new pc.Color(0, 0, 0);
        this.specularMap = null;
        this.specularMapTiling = new pc.Vec2(1, 1);
        this.specularMapOffset = new pc.Vec2(0, 0);
        this.specularMapRotation = new pc.Vec3(0, 0, 0);
        this.specularMapTransform = null;

        this.shininess = 25;
        this.glossMap = null;
        this.glossMapTiling = new pc.Vec2(1, 1);
        this.glossMapOffset = new pc.Vec2(0, 0);
        this.glossMapRotation = new pc.Vec3(0, 0, 0);
        this.glossMapTransform = null;

        this.emissive = new pc.Color(0, 0, 0);
        this.emissiveMap = null;
        this.emissiveMapTiling = new pc.Vec2(1, 1);
        this.emissiveMapOffset = new pc.Vec2(0, 0);
        this.emissiveMapRotation = new pc.Vec3(0, 0, 0);
        this.emissiveMapTransform = null;

        this.opacity = 1;
        this.opacityMap = null;
        this.opacityMapTiling = new pc.Vec2(1, 1);
        this.opacityMapOffset = new pc.Vec2(0, 0);
        this.opacityMapRotation = new pc.Vec3(0, 0, 0);
        this.opacityMapTransform = null;
        this.blendType = pc.scene.BLEND_NONE;

        this.normalMap = null;
        this.normalMapTransform = null;
        this.normalMapTiling = new pc.Vec2(1, 1);
        this.normalMapOffset = new pc.Vec2(0, 0);
        this.normalMapRotation = new pc.Vec3(0, 0, 0);
        this.heightMap = null;
        this.heightMapTiling = new pc.Vec2(1, 1);
        this.heightMapOffset = new pc.Vec2(0, 0);
        this.heightMapRotation = new pc.Vec3(0, 0, 0);
        this.heightMapTransform = null;
        this.bumpiness = 1;

        this.cubeMap = null;
        this.sphereMap = null;
        this.reflectivity = 1;

        this.lightMap = null;

        // Array to pass uniforms to renderer
        this.ambientUniform = new Float32Array(3);
        this.diffuseUniform = new Float32Array(3);
        this.specularUniform = new Float32Array(3);
        this.emissiveUniform = new Float32Array(3);

        this.update();
    };

    var _createTexture = function (param) {
        if (param.data) {
            if (param.data instanceof pc.gfx.Texture) {
                return param.data;
            } else {
                throw Error("PhongMaterial.init() expects textures to already be created");
            }
        } else {
            return null;
        }
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


    PhongMaterial = pc.inherits(PhongMaterial, pc.scene.Material);

    pc.extend(PhongMaterial.prototype, {
        /**
         * @function
         * @name pc.scene.PhongMaterial#clone
         * @description Duplicates a Phong material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.scene.PhongMaterial} A cloned Phong material.
         */
        clone: function () {
            var clone = new pc.scene.PhongMaterial();

            pc.scene.Material.prototype._cloneInternal.call(this, clone);

            clone.ambient.copy(this.ambient);

            clone.diffuse.copy(this.diffuse);
            clone.diffuseMap = this.diffuseMap;
            clone.diffuseMapTiling = this.diffuseMapTiling ? this.diffuseMapTiling.clone() : new pc.Vec2(1, 1);
            clone.diffuseMapOffset = this.diffuseMapOffset ? this.diffuseMapOffset.clone() : new pc.Vec2(0, 0);
            clone.diffuseMapRotation = this.diffuseMapRotation ? this.diffuseMapRotation.clone() : new pc.Vec3();
            clone.diffuseMapTransform = this.diffuseMapTransform ? this.diffuseMapTransform.clone() : null;

            clone.specular.copy(this.specular);
            clone.specularMap = this.specularMap;
            clone.specularMapTiling = this.specularMapTiling ? this.specularMapTiling.clone() : new pc.Vec2(1, 1);
            clone.specularMapOffset = this.specularMapOffset ? this.specularMapOffset.clone() : new pc.Vec2(0, 0);
            clone.specularMapRotation = this.specularMapRotation ? this.specularMapRotation.clone() : new pc.Vec3();
            clone.specularMapTransform = this.specularMapTransform ? this.specularMapTransform.clone() : null;

            clone.shininess = this.shininess;
            clone.glossMap = this.glossMap;
            clone.glossMapTiling = this.glossMapTiling ? this.glossMapTiling.clone() : new pc.Vec2(1, 1);
            clone.glossMapOffset = this.glossMapOffset ? this.glossMapOffset.clone() : new pc.Vec2(0, 0);
            clone.glossMapRotation = this.glossMapRotation ? this.glossMapRotation.clone() : new pc.Vec3();
            clone.glossMapTransform = this.glossMapTransform ? this.glossMapTransform.clone() : null;

            clone.emissive.copy(this.emissive);
            clone.emissiveMap = this.emissiveMap;
            clone.emissiveMapTiling = this.emissiveMapTiling ? this.emissiveMapTiling.clone() : new pc.Vec2(1, 1);
            clone.emissiveMapOffset = this.emissiveMapOffset ? this.emissiveMapOffset.clone() : new pc.Vec2(0, 0);
            clone.emissiveMapRotation = this.emissiveMapRotation ? this.emissiveMapRotation.clone() : new pc.Vec3();
            clone.emissiveMapTransform = this.emissiveMapTransform ? this.emissiveMapTransform.clone() : null;

            clone.opacity = this.opacity;
            clone.opacityMap = this.opacityMap;
            clone.opacityMapTiling = this.opacityMapTiling ? this.opacityMapTiling.clone() : new pc.Vec2(1, 1);
            clone.opacityMapOffset = this.opacityMapOffset ? this.opacityMapOffset.clone() : new pc.Vec2(0, 0);
            clone.opacityMapRotation = this.opacityMapRotation ? this.opacityMapRotation.clone() : new pc.Vec3();
            clone.opacityMapTransform = this.opacityMapTransform ? this.opacityMapTransform.clone() : null;
            clone.blendType = this.blendType;

            clone.normalMap = this.normalMap;
            clone.normalMapTransform = this.normalMapTransform ? this.normalMapTransform.clone() : null;
            clone.normalMapTiling = this.normalMapTiling ? this.normalMapTiling.clone() : new pc.Vec2(1, 1);
            clone.normalMapOffset = this.normalMapOffset ? this.normalMapOffset.clone() : new pc.Vec2(0, 0);
            clone.normalMapRotation = this.normalMapRotation ? this.normalMapRotation.clone() : new pc.Vec3();
            clone.heightMap = this.heightMap;
            clone.heightMapTransform = this.heightMapTransform ? this.heightMapTransform.clone() : null;
            clone.heightMapTiling = this.heightMapTiling ? this.heightMapTiling.clone() : new pc.Vec2(1, 1);
            clone.heightMapOffset = this.heightMapOffset ? this.heightMapOffset.clone() : new pc.Vec2(0, 0);
            clone.heightMapRotation = this.heightMapRotation ? this.heightMapRotation.clone() : new pc.Vec3();
            clone.bumpiness = this.bumpiness;

            clone.cubeMap = this.cubeMap;
            clone.sphereMap = this.sphereMap;
            clone.reflectivity = this.reflectivity;

            clone.lightMap = this.lightMap;

            clone.update();
            return clone;
        },

        /**
        * @private
        * @name pc.scene.PhoneMaterial#init
        * @description Update material data from a data block, as found on a material Asset.
        * Note, init() expects texture parameters to contain a {@link pc.gfx.Texture} not a resource id.
        */
        init: function (data) {
            // Initialise material from data
            this.name = data.name;

            // Read each shader parameter
            for (var i = 0; i < data.parameters.length; i++) {
                var param = data.parameters[i];
                switch (param.name) {
                    case 'ambient':
                        this.ambient = _createRgb(param);
                        break;
                    case 'diffuse':
                        this.diffuse = _createRgb(param);
                        break;
                    case 'diffuseMap':
                        this.diffuseMap = _createTexture(param);
                        break;
                    case 'diffuseMapTiling':
                        this.diffuseMapTiling = _createVec2(param);
                        break;
                    case 'diffuseMapOffset':
                        this.diffuseMapOffset = _createVec2(param);
                        break;
                    case 'diffuseMapRotation':
                        this.diffuseMapRotation = _createVec3(param);
                        break;
                    case 'specular':
                        this.specular = _createRgb(param);
                        break;
                    case 'specularMap':
                        this.specularMap = _createTexture(param);
                        break;
                    case 'specularMapTiling':
                        this.specularMapTiling = _createVec2(param);
                        break;
                    case 'specularMapOffset':
                        this.specularMapOffset = _createVec2(param);
                        break;
                    case 'specularMapRotation':
                        this.specularMapRotation = _createVec3(param);
                        break;
                    case 'shininess':
                        this.shininess = param.data;
                        break;
                    case 'glossMap':
                        this.glossMap = _createTexture(param);
                        break;
                    case 'glossMapTiling':
                        this.glossMapTiling = _createVec2(param);
                        break;
                    case 'glossMapOffset':
                        this.glossMapOffset = _createVec2(param);
                        break;
                    case 'glossMapRotation':
                        this.glossMapRotation = _createVec3(param);
                        break;
                    case 'emissive':
                        this.emissive = _createRgb(param);
                        break;
                    case 'emissiveMap':
                        this.emissiveMap = _createTexture(param);
                        break;
                    case 'emissiveMapTiling':
                        this.emissiveMapTiling = _createVec2(param);
                        break;
                    case 'emissiveMapOffset':
                        this.emissiveMapOffset = _createVec2(param);
                        break;
                    case 'emissiveMapRotation':
                        this.emissiveMapRotation = _createVec3(param);
                        break;
                    case 'opacity':
                        this.opacity = param.data;
                        break;
                    case 'opacityMap':
                        this.opacityMap = _createTexture(param);
                        break;
                    case 'opacityMapTiling':
                        this.opacityMapTiling = _createVec2(param);
                        break;
                    case 'opacityMapOffset':
                        this.opacityMapOffset = _createVec2(param);
                        break;
                    case 'opacityMapRotation':
                        this.opacityMapRotation = _createVec3(param);
                        break;
                    case 'normalMap':
                        this.normalMap = _createTexture(param);
                        break;
                    case 'normalMapTiling':
                        this.normalMapTiling = _createVec2(param);
                        break;
                    case 'normalMapOffset':
                        this.normalMapOffset = _createVec2(param);
                        break;
                    case 'normalMapRotation':
                        this.normalMapRotation = _createVec3(param);
                        break;
                    case 'heightMap':
                        this.heightMap = _createTexture(param);
                        break;
                    case 'heightMapTiling':
                        this.heightMapTiling = _createVec2(param);
                        break;
                    case 'heightMapOffset':
                        this.heightMapOffset = _createVec2(param);
                        break;
                    case 'heightMapRotation':
                        this.heightMapRotation = _createVec3(param);
                        break;
                    case 'bumpMapFactor':
                        this.bumpiness = param.data;
                        break;
                    case 'cubeMap':
                        this.cubeMap = _createTexture(param);
                        break;
                    case 'sphereMap':
                        this.sphereMap = _createTexture(param);
                        break;
                    case 'reflectivity':
                        this.reflectivity = param.data;
                        break;
                    case 'lightMap':
                        this.lightMap = _createTexture(param);
                        break;
                    case 'depthTest':
                        this.depthTest = param.data;
                        break;
                    case 'depthWrite':
                        this.depthWrite = param.data;
                        break;
                    case 'cull':
                        this.cull = param.data;
                        break;
                    case 'blendType':
                        this.blendType = param.data;
                        break;
                }
            }

            this.update();
        },

        _updateMapTransform: function (transform, tiling, offset, rotation) {
            /*if (tiling) {
                _tempTiling.set(tiling.x, tiling.y, 1);
            } else {
                _tempTiling.set(1, 1, 1);
            }

            if (offset) {
                _tempOffset.set(offset.x, offset.y, 0);
            } else {
                _tempOffset.set(0, 0, 0);
            }

            if (rotation) {
                _tempRotation.setFromEulerAngles(rotation.x, rotation.y, rotation.z);
            } else {
                _tempRotation.copy(pc.Quat.IDENTITY);
            }

            transform = transform || new pc.Mat4();
            transform.setTRS(_tempOffset, _tempRotation, _tempTiling);

            // if the transform is the identity matrix
            // then just return null so that it is not included
            // in the shader due to limited number of shader
            // parameters
            return transform.isIdentity() ? null : transform;*/

            transform = transform || new pc.Vec4();
            transform.set(tiling.x, tiling.y, offset.x, offset.y);

            if ((transform.x==1) && (transform.y==1) && (transform.z==0) && (transform.w==0)) return null;
            return transform;
        },

        _collectLights: function(lType, lights, typeArray, shadowArray) {
            for (var i = 0; i < lights.length; i++) {
                if (lights[i].getEnabled()) {
                    var lightType = lights[i].getType();
                    if (lightType==lType) {
                        typeArray.push(lightType);
                        shadowArray.push(lights[i].getCastShadows());
                    }
                }
            }
        },

        update: function () {
            this.clearParameters();

            this.ambientUniform[0] = this.ambient.r;
            this.ambientUniform[1] = this.ambient.g;
            this.ambientUniform[2] = this.ambient.b;
            this.setParameter('material_ambient', this.ambientUniform);

            var i = 0;

            if (this.diffuseMap) {
                this.setParameter("texture_diffuseMap", this.diffuseMap);

                this.diffuseMapTransform = this._updateMapTransform(
                    this.diffuseMapTransform,
                    this.diffuseMapTiling,
                    this.diffuseMapOffset,
                    this.diffuseMapRotation
                );

                if (this.diffuseMapTransform) {
                    this.setParameter('texture_diffuseMapTransform', this.diffuseMapTransform.data);
                }
            } else {
                this.diffuseMapTransform = null;
                this.diffuseUniform[0] = this.diffuse.r;
                this.diffuseUniform[1] = this.diffuse.g;
                this.diffuseUniform[2] = this.diffuse.b;
                this.setParameter('material_diffuse', this.diffuseUniform);
            }

            if (this.specularMap) {
                this.setParameter("texture_specularMap", this.specularMap);

                this.specularMapTransform = this._updateMapTransform(
                    this.specularMapTransform,
                    this.specularMapTiling,
                    this.specularMapOffset,
                    this.specularMapRotation
                );

                if (this.specularMapTransform) {
                    this.setParameter('texture_specularMapTransform', this.specularMapTransform.data);
                }
            } else {
                this.specularMapTransform = null;
                this.specularUniform[0] = this.specular.r;
                this.specularUniform[1] = this.specular.g;
                this.specularUniform[2] = this.specular.b;
                this.setParameter('material_specular', this.specularUniform);
            }

            if (this.glossMap) {
                this.setParameter("texture_glossMap", this.glossMap);

                this.glossMapTransform = this._updateMapTransform(
                    this.glossMapTransform,
                    this.glossMapTiling,
                    this.glossMapOffset,
                    this.glossMapRotation
                );

                if (this.glossMapTransform) {
                    this.setParameter('texture_glossMapTransform', this.glossMapTransform.data);
                }
            } else {
                this.glossMapTransform = null;
                this.setParameter('material_shininess', this.shininess);
            }

            if (this.emissiveMap) {
                this.setParameter("texture_emissiveMap", this.emissiveMap);

                this.emissiveMapTransform = this._updateMapTransform(
                    this.emissiveMapTransform,
                    this.emissiveMapTiling,
                    this.emissiveMapOffset,
                    this.emissiveMapRotation
                );

                if (this.emissiveMapTransform) {
                    this.setParameter('texture_emissiveMapTransform', this.emissiveMapTransform.data);
                }
            } else {
                this.emissiveMapTransform = null;
                this.emissiveUniform[0] = this.emissive.r;
                this.emissiveUniform[1] = this.emissive.g;
                this.emissiveUniform[2] = this.emissive.b;
                this.setParameter('material_emissive', this.emissiveUniform);
            }

            if (this.opacityMap) {
                this.setParameter("texture_opacityMap", this.opacityMap);

                this.opacityMapTransform = this._updateMapTransform(
                    this.opacityMapTransform,
                    this.opacityMapTiling,
                    this.opacityMapOffset,
                    this.opacityMapRotation
                );

                if (this.opacityMapTransform) {
                    this.setParameter('texture_opacityMapTransform', this.opacityMapTransform.data);
                }
            } else {
                this.opacityMapTransform = null;
                this.setParameter('material_opacity', this.opacity);
            }

            if (this.normalMap) {
                this.setParameter("texture_normalMap", this.normalMap);

                this.normalMapTransform = this._updateMapTransform(
                    this.normalMapTransform,
                    this.normalMapTiling,
                    this.normalMapOffset,
                    this.normalMapRotation
                );

                if (this.normalMapTransform) {
                    this.setParameter('texture_normalMapTransform', this.normalMapTransform.data);
                }
            } else {
                this.normalMapTransform = null;
            }

            if (this.heightMap) {
                this.setParameter("texture_heightMap", this.heightMap);

                this.heightMapTransform = this._updateMapTransform(
                    this.heightMapTransform,
                    this.heightMapTiling,
                    this.heightMapOffset,
                    this.heightMapRotation
                );

                if (this.heightMapTransform) {
                    this.setParameter('texture_heightMapTransform', this.heightMapTransform.data);
                }
            } else {
                this.heightMapTransform = null;
            }

            if (this.normalMap || this.heightMap) {
                this.setParameter('material_bumpMapFactor', this.bumpiness);
            }

            if (this.cubeMap) {
                this.setParameter('texture_cubeMap', this.cubeMap);
            }
            if (this.sphereMap) {
                this.setParameter('texture_sphereMap', this.sphereMap);
            }
            if (this.sphereMap || this.cubeMap) {
                this.setParameter('material_reflectionFactor', this.reflectivity);
            }

            if (this.lightMap) {
                this.setParameter('texture_lightMap', this.lightMap);
            }

            this.shader = null;
        },

        updateShader: function (device, scene) {
            var lights = scene._lights;

            var options = {
                fog: scene.fog,
                skin: !!this.meshInstances[0].skinInstance,
                diffuseMap: !!this.diffuseMap,
                diffuseMapTransform: !!this.diffuseMapTransform,
                specularMap: !!this.specularMap,
                specularMapTransform: !!this.specularMapTransform,
                glossMap: !!this.glossMap,
                glossMapTransform: !!this.glossMapTransform,
                emissiveMap: !!this.emissiveMap,
                emissiveMapTransform: !!this.emissiveMapTransform,
                opacityMap: !!this.opacityMap,
                opacityMapTransform: !!this.opacityMapTransform,
                normalMap: !!this.normalMap,
                normalMapTransform: !!this.normalMapTransform,
                heightMap: !!this.heightMap,
                heightMapTransform: !!this.heightMapTransform,
                sphereMap: !!this.sphereMap,
                cubeMap: !!this.cubeMap,
                lightMap: !!this.lightMap
            };


            var lightType = [];
            var lightShadow = [];
            this._collectLights(pc.scene.LIGHTTYPE_DIRECTIONAL, lights, lightType, lightShadow);
            this._collectLights(pc.scene.LIGHTTYPE_POINT,       lights, lightType, lightShadow);
            this._collectLights(pc.scene.LIGHTTYPE_SPOT,        lights, lightType, lightShadow);


            options.numLights = lightType.length;
            options.lightType = lightType;
            options.lightShadow = lightShadow;

            var library = device.getProgramLibrary();
            this.shader = library.getProgram('phong', options);
        }
    });

    return {
        PhongMaterial: PhongMaterial
    };
}());
