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
     * @property {Number} shininess Defines glossiness of the material from 0 (rough) to 100 (mirror).
     * A higher shininess value results in a more focussed specular highlight.
     * @property {pc.Texture} glossMap The per-pixel gloss of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * shininess in preference to the 'shininess' property.
     * @property {pc.Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
     * @property {pc.Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is between 0 and 1.
     * @property {pc.Vec3} emissive The emissive color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.Texture} emissiveMap The emissive map of the material. This must be a 2D texture rather
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for emissive
     * color in preference to the 'emissive' property.
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
     * @property {Number} bumpiness The bumpiness of the material. This value scales the assinged bump map.
     * @property {Number} heightMapFactor Height map multiplier.
     * @property {Number} emissiveIntensity Emissive color multiplier.
     * (be that a normal map or a height map) and can be between 0 and 1, where 0 shows no contribution from
     * the bump map and 1 results in a full contribution.
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
     * @property {Number} aoMapUvSet Defines UV set used for AO map. Can be 0 or 1.
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
     * <li><strong>{@link pc.FRESNEL_SIMPLE}</strong>: Fake effect resembling Fresnel with formula pow(dotVN, fresnelFactor). Use fresnelFactor to tweak effect power</li>
     * <li><strong>{@link pc.FRESNEL_SCHLICK}</strong>: Schlick's approximation of Fresnel (recommended). Parameterized by specular color. fresnelFactor is not used.</li>
     * <li><strong>{@link pc.FRESNEL_COMPLEX}</strong>: More complex Fresnel formula. Use fresnelFactor to specify IOR values.</li>
     * </ul>
     * @property {Number} fresnelFactor A parameter for Fresnel. May mean different things depending on fresnelModel.
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


    PhongMaterial = pc.inherits(PhongMaterial, pc.Material);

    pc.extend(PhongMaterial.prototype, {
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

            clone.ambient.copy(this.ambient);

            clone.diffuse.copy(this.diffuse);
            clone.diffuseMap = this.diffuseMap;
            clone.diffuseMapTiling = this.diffuseMapTiling ? this.diffuseMapTiling.clone() : new pc.Vec2(1, 1);
            clone.diffuseMapOffset = this.diffuseMapOffset ? this.diffuseMapOffset.clone() : new pc.Vec2(0, 0);
            clone.diffuseMapTransform = this.diffuseMapTransform ? this.diffuseMapTransform.clone() : null;

            clone.specular.copy(this.specular);
            clone.specularMap = this.specularMap;
            clone.specularMapTiling = this.specularMapTiling ? this.specularMapTiling.clone() : new pc.Vec2(1, 1);
            clone.specularMapOffset = this.specularMapOffset ? this.specularMapOffset.clone() : new pc.Vec2(0, 0);
            clone.specularMapTransform = this.specularMapTransform ? this.specularMapTransform.clone() : null;

            clone.shininess = this.shininess;
            clone.glossMap = this.glossMap;
            clone.glossMapTiling = this.glossMapTiling ? this.glossMapTiling.clone() : new pc.Vec2(1, 1);
            clone.glossMapOffset = this.glossMapOffset ? this.glossMapOffset.clone() : new pc.Vec2(0, 0);
            clone.glossMapTransform = this.glossMapTransform ? this.glossMapTransform.clone() : null;

            clone.emissive.copy(this.emissive);
            clone.emissiveMap = this.emissiveMap;
            clone.emissiveMapTiling = this.emissiveMapTiling ? this.emissiveMapTiling.clone() : new pc.Vec2(1, 1);
            clone.emissiveMapOffset = this.emissiveMapOffset ? this.emissiveMapOffset.clone() : new pc.Vec2(0, 0);
            clone.emissiveMapTransform = this.emissiveMapTransform ? this.emissiveMapTransform.clone() : null;

            clone.opacity = this.opacity;
            clone.opacityMap = this.opacityMap;
            clone.opacityMapTiling = this.opacityMapTiling ? this.opacityMapTiling.clone() : new pc.Vec2(1, 1);
            clone.opacityMapOffset = this.opacityMapOffset ? this.opacityMapOffset.clone() : new pc.Vec2(0, 0);
            clone.opacityMapTransform = this.opacityMapTransform ? this.opacityMapTransform.clone() : null;
            clone.blendType = this.blendType;

            clone.normalMap = this.normalMap;
            clone.normalMapTransform = this.normalMapTransform ? this.normalMapTransform.clone() : null;
            clone.normalMapTiling = this.normalMapTiling ? this.normalMapTiling.clone() : new pc.Vec2(1, 1);
            clone.normalMapOffset = this.normalMapOffset ? this.normalMapOffset.clone() : new pc.Vec2(0, 0);
            clone.heightMap = this.heightMap;
            clone.heightMapTransform = this.heightMapTransform ? this.heightMapTransform.clone() : null;
            clone.heightMapTiling = this.heightMapTiling ? this.heightMapTiling.clone() : new pc.Vec2(1, 1);
            clone.heightMapOffset = this.heightMapOffset ? this.heightMapOffset.clone() : new pc.Vec2(0, 0);
            clone.bumpiness = this.bumpiness;
            clone.heightMapFactor = this.heightMapFactor;

            clone.cubeMap = this.cubeMap;
            clone.prefilteredCubeMap128 = this.prefilteredCubeMap128;
            clone.prefilteredCubeMap64 = this.prefilteredCubeMap64;
            clone.prefilteredCubeMap32 = this.prefilteredCubeMap32;
            clone.prefilteredCubeMap16 = this.prefilteredCubeMap16;
            clone.prefilteredCubeMap8 = this.prefilteredCubeMap8;
            clone.prefilteredCubeMap4 = this.prefilteredCubeMap4;
            clone.sphereMap = this.sphereMap;
            clone.reflectivity = this.reflectivity;

            clone.lightMap = this.lightMap;
            clone.aoMap = this.aoMap;
            clone.aoUvSet = this.aoUvSet;

            clone.fresnelFactor = this.fresnelFactor;
            clone.blendMapsWithColors = this.blendMapsWithColors;
            clone.specularAntialias = this.specularAntialias;
            clone.conserveEnergy = this.conserveEnergy;
            clone.occludeSpecular = this.occludeSpecular;
            clone.shadingModel = this.shadingModel;
            clone.fresnelModel = this.fresnelModel;

            clone.ambientTint = this.ambientTint;
            clone.diffuseMapTint = this.diffuseMapTint;
            clone.specularMapTint = this.specularMapTint;
            clone.emissiveMapTint = this.emissiveMapTint;
            clone.emissiveIntensity = this.emissiveIntensity;

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
                    case 'normalMap':
                        this.normalMap = _createTexture(param);
                        break;
                    case 'normalMapTiling':
                        this.normalMapTiling = _createVec2(param);
                        break;
                    case 'normalMapOffset':
                        this.normalMapOffset = _createVec2(param);
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
                    case 'bumpMapFactor':
                        this.bumpiness = param.data;
                        break;
                    case 'heightMapFactor':
                        this.heightMapFactor = param.data;
                        break;
                    case 'cubeMap':
                        this.cubeMap = _createTexture(param);
                        break;
                    case 'prefilteredCubeMap128':
                        this.prefilteredCubeMap128 = _createTexture(param);
                        break;
                    case 'prefilteredCubeMap64':
                        this.prefilteredCubeMap64 = _createTexture(param);
                        break;
                    case 'prefilteredCubeMap32':
                        this.prefilteredCubeMap32 = _createTexture(param);
                        break;
                    case 'prefilteredCubeMap16':
                        this.prefilteredCubeMap16 = _createTexture(param);
                        break;
                    case 'prefilteredCubeMap8':
                        this.prefilteredCubeMap8 = _createTexture(param);
                        break;
                    case 'prefilteredCubeMap4':
                        this.prefilteredCubeMap4 = _createTexture(param);
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
                    case 'aoMap':
                        this.aoMap = _createTexture(param);
                        break;
                    case 'aoUvSet':
                        this.aoUvSet = param.data;
                        break;
                    case 'ambientTint':
                        this.ambientTint = param.data;
                        break;
                    case 'diffuseMapTint':
                        this.diffuseMapTint = param.data;
                        break;
                    case 'specularMapTint':
                        this.specularMapTint = param.data;
                        break;
                    case 'emissiveMapTint':
                        this.emissiveMapTint = param.data;
                        break;
                    case 'emissiveIntensity':
                        this.emissiveIntensity = param.data;
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
                    case 'blendMapsWithColors':
                        this.blendMapsWithColors = param.data;
                        break;
                    case 'specularAntialias':
                        this.specularAntialias = param.data;
                        break;
                    case 'conserveEnergy':
                        this.conserveEnergy = param.data;
                        break;
                    case 'occludeSpecular':
                        this.occludeSpecular = param.data;
                        break;
                    case 'shadingModel':
                        this.shadingModel = param.data;
                        break;
                    case 'fresnelModel':
                        this.fresnelModel = param.data;
                        break;
                    case 'fresnelFactor':
                        this.fresnelFactor = param.data;
                }
            }

            this.update();
        },

        reset: function () {
            this.ambient = new pc.Color(0.7, 0.7, 0.7);

            this.diffuse = new pc.Color(1, 1, 1);
            this.diffuseMap = null;
            this.diffuseMapTiling = new pc.Vec2(1, 1);
            this.diffuseMapOffset = new pc.Vec2(0, 0);
            this.diffuseMapTransform = null;

            this.specular = new pc.Color(0, 0, 0);
            this.specularMap = null;
            this.specularMapTiling = new pc.Vec2(1, 1);
            this.specularMapOffset = new pc.Vec2(0, 0);
            this.specularMapTransform = null;

            this.shininess = 25;
            this.glossMap = null;
            this.glossMapTiling = new pc.Vec2(1, 1);
            this.glossMapOffset = new pc.Vec2(0, 0);
            this.glossMapTransform = null;

            this.emissive = new pc.Color(0, 0, 0);
            this.emissiveMap = null;
            this.emissiveMapTiling = new pc.Vec2(1, 1);
            this.emissiveMapOffset = new pc.Vec2(0, 0);
            this.emissiveMapTransform = null;

            this.opacity = 1;
            this.opacityMap = null;
            this.opacityMapTiling = new pc.Vec2(1, 1);
            this.opacityMapOffset = new pc.Vec2(0, 0);
            this.opacityMapTransform = null;
            this.blendType = pc.BLEND_NONE;

            this.normalMap = null;
            this.normalMapTransform = null;
            this.normalMapTiling = new pc.Vec2(1, 1);
            this.normalMapOffset = new pc.Vec2(0, 0);
            this.heightMap = null;
            this.heightMapTiling = new pc.Vec2(1, 1);
            this.heightMapOffset = new pc.Vec2(0, 0);
            this.heightMapTransform = null;
            this.bumpiness = 1;
            this.heightMapFactor = 1;

            this.cubeMap = null;
            this.prefilteredCubeMap128 = null;
            this.prefilteredCubeMap64 = null;
            this.prefilteredCubeMap32 = null;
            this.prefilteredCubeMap16 = null;
            this.prefilteredCubeMap8 = null;
            this.prefilteredCubeMap4 = null;
            this.sphereMap = null;
            this.reflectivity = 1;

            this.lightMap = null;
            this.aoMap = null;
            this.aoUvSet = 0;
            this.blendMapsWithColors = true;

            this.specularAntialias = false;
            this.conserveEnergy = true;
            this.occludeSpecular = true;
            this.shadingModel = pc.SPECULAR_PHONG;
            this.fresnelModel = pc.FRESNEL_NONE;

            this.fresnelFactor = 0;

            this.ambientTint = false;
            this.diffuseMapTint = false;
            this.specularMapTint = false;
            this.emissiveMapTint = false;
            this.emissiveIntensity = 1;

            // Array to pass uniforms to renderer
            this.ambientUniform = new Float32Array(3);
            this.diffuseUniform = new Float32Array(3);
            this.specularUniform = new Float32Array(3);
            this.emissiveUniform = new Float32Array(3);
        },

        _updateMapTransform: function (transform, tiling, offset) {
            transform = transform || new pc.Vec4();
            transform.set(tiling.x, tiling.y, offset.x, offset.y);

            if ((transform.x==1) && (transform.y==1) && (transform.z==0) && (transform.w==0)) return null;
            return transform;
        },

        _collectLights: function(lType, lights, lightsSorted) {
            for (var i = 0; i < lights.length; i++) {
                if (lights[i].getEnabled()) {
                    if (lights[i].getType()==lType) {
                        lightsSorted.push(lights[i]);
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
                    this.diffuseMapOffset
                );

                if (this.diffuseMapTransform) {
                    this.setParameter('texture_diffuseMapTransform', this.diffuseMapTransform.data);
                }
            }

            if (!this.diffuseMap || (this.blendMapsWithColors && this.diffuseMapTint)) {
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
                    this.specularMapOffset
                );

                if (this.specularMapTransform) {
                    this.setParameter('texture_specularMapTransform', this.specularMapTransform.data);
                }
            }

            if (!this.specularMap || (this.blendMapsWithColors && this.specularMapTint)) {
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
                    this.glossMapOffset
                );

                if (this.glossMapTransform) {
                    this.setParameter('texture_glossMapTransform', this.glossMapTransform.data);
                }
            }

            if (!this.glossMap || this.blendMapsWithColors) {
                // Shininess is 0-100 value
                // which is actually a 0-1 glosiness value.
                // Can be converted to specular power using exp2(shininess * 0.01 * 11)
                if (this.shadingModel===pc.SPECULAR_PHONG) {
                    this.setParameter('material_shininess', Math.pow(2, this.shininess * 0.01 * 11)); // legacy: expand back to specular power
                } else {
                    this.setParameter('material_shininess', this.shininess * 0.01); // correct
                }
            }

            if (this.emissiveMap) {
                this.setParameter("texture_emissiveMap", this.emissiveMap);

                this.emissiveMapTransform = this._updateMapTransform(
                    this.emissiveMapTransform,
                    this.emissiveMapTiling,
                    this.emissiveMapOffset
                );

                if (this.emissiveMapTransform) {
                    this.setParameter('texture_emissiveMapTransform', this.emissiveMapTransform.data);
                }
            }

            if (!this.emissiveMap || (this.blendMapsWithColors && this.emissiveMapTint)) {
                this.emissiveUniform[0] = this.emissive.r * this.emissiveIntensity;
                this.emissiveUniform[1] = this.emissive.g * this.emissiveIntensity;
                this.emissiveUniform[2] = this.emissive.b * this.emissiveIntensity;
                this.setParameter('material_emissive', this.emissiveUniform);
            }

            if (this.opacityMap) {
                this.setParameter("texture_opacityMap", this.opacityMap);

                this.opacityMapTransform = this._updateMapTransform(
                    this.opacityMapTransform,
                    this.opacityMapTiling,
                    this.opacityMapOffset
                );

                if (this.opacityMapTransform) {
                    this.setParameter('texture_opacityMapTransform', this.opacityMapTransform.data);
                }
            }

            if (!this.opacityMap || this.blendMapsWithColors) {
                this.setParameter('material_opacity', this.opacity);
            }

            if (this.normalMap) {
                this.setParameter("texture_normalMap", this.normalMap);

                this.normalMapTransform = this._updateMapTransform(
                    this.normalMapTransform,
                    this.normalMapTiling,
                    this.normalMapOffset
                );

                if (this.normalMapTransform) {
                    this.setParameter('texture_normalMapTransform', this.normalMapTransform.data);
                }
            } else {
            }

            if (this.heightMap) {
                this.setParameter("texture_heightMap", this.heightMap);

                this.heightMapTransform = this._updateMapTransform(
                    this.heightMapTransform,
                    this.heightMapTiling,
                    this.heightMapOffset
                );

                if (this.heightMapTransform) {
                    this.setParameter('texture_heightMapTransform', this.heightMapTransform.data);
                }
            } else {
            }

            if (this.normalMap) {
                this.setParameter('material_bumpMapFactor', this.bumpiness);
            }

            if (this.heightMap) {
                this.setParameter('material_heightMapFactor', this.heightMapFactor * 0.025);
            }

            if (this.cubeMap) {
                this.setParameter('texture_cubeMap', this.cubeMap);
                this.setParameter('material_cubemapSize', this.cubeMap.width);
            }
            if (this.prefilteredCubeMap128) {
                this.setParameter('texture_prefilteredCubeMap128', this.prefilteredCubeMap128);
                this.setParameter('material_cubemapSize', this.prefilteredCubeMap128.width);
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
            //if (this.sphereMap || this.cubeMap || this.prefilteredCubeMap128) {
                this.setParameter('material_reflectionFactor', this.reflectivity);
            //}

            if (this.fresnelFactor > 0) {
                this.setParameter('material_fresnelFactor', this.fresnelFactor);
            }

            if (this.lightMap) {
                this.setParameter('texture_lightMap', this.lightMap);
            }

            if (this.aoMap) {
                this.setParameter('texture_aoMap', this.aoMap);
            }

            this.shader = null;
        },

        _getMapTransformID: function(xform) {
            if (!xform) return 0;
            var i, j, same;
            for(i=0; i<this._mapXForms.length; i++) {
                same = true;
                for(j=0; j<xform.data.length; j++) {
                    if (this._mapXForms[i][j] != xform.data[j]) {
                        same = false;
                        break;
                    }
                }
                if (same) {
                    return i + 1;
                }
            }
            var newID = this._mapXForms.length;
            this._mapXForms[newID] = [];
            for(j=0; j<xform.data.length; j++) {
                this._mapXForms[newID][j] = xform.data[j];
            }
            return newID + 1;
        },

        updateShader: function (device, scene) {
            var i;
            var lights = scene._lights;

            this._mapXForms = [];
            var prefilteredCubeMap128 = this.prefilteredCubeMap128? this.prefilteredCubeMap128 : scene._prefilteredCubeMap128;
            var prefilteredCubeMap64 = this.prefilteredCubeMap64? this.prefilteredCubeMap64 : scene._prefilteredCubeMap64;
            var prefilteredCubeMap32 = this.prefilteredCubeMap32? this.prefilteredCubeMap32 : scene._prefilteredCubeMap32;
            var prefilteredCubeMap16 = this.prefilteredCubeMap16? this.prefilteredCubeMap16 : scene._prefilteredCubeMap16;
            var prefilteredCubeMap8 = this.prefilteredCubeMap8? this.prefilteredCubeMap8 : scene._prefilteredCubeMap8;
            var prefilteredCubeMap4 = this.prefilteredCubeMap4? this.prefilteredCubeMap4 : scene._prefilteredCubeMap4;

            var prefilteredCubeMap = prefilteredCubeMap128 && prefilteredCubeMap64 && prefilteredCubeMap32
                                   && prefilteredCubeMap16 && prefilteredCubeMap8 && prefilteredCubeMap4;

            if (prefilteredCubeMap && device.extTextureLod && device.samplerCount < 16) {
                // Set up hires texture to contain the whole mip chain
                if (!prefilteredCubeMap128._prefilteredMips) {
                    prefilteredCubeMap128.autoMipmap = false;
                    var mip, face;
                    var mips = [prefilteredCubeMap128, prefilteredCubeMap64, prefilteredCubeMap32, prefilteredCubeMap16, prefilteredCubeMap8, prefilteredCubeMap4];
                    for(mip=1; mip<6; mip++) {
                        prefilteredCubeMap128._levels[mip] = mips[mip]._levels[0];
                    }
                    prefilteredCubeMap128.upload();
                    prefilteredCubeMap128._prefilteredMips = true;
                }
            }

            if (prefilteredCubeMap128 === scene._prefilteredCubeMap128) {
                this.setParameter('texture_prefilteredCubeMap128', scene._prefilteredCubeMap128);
                this.setParameter('texture_prefilteredCubeMap64', scene._prefilteredCubeMap64);
                this.setParameter('texture_prefilteredCubeMap32', scene._prefilteredCubeMap32);
                this.setParameter('texture_prefilteredCubeMap16', scene._prefilteredCubeMap16);
                this.setParameter('texture_prefilteredCubeMap8', scene._prefilteredCubeMap8);
                this.setParameter('texture_prefilteredCubeMap4', scene._prefilteredCubeMap4);
            }

            var options = {
                fog:                        scene.fog,
                gamma:                      scene.gammaCorrection,
                toneMap:                    scene.toneMapping,
                blendMapsWithColors:        this.blendMapsWithColors,
                skin:                       !!this.meshInstances[0].skinInstance,
                modulateAmbient:            this.ambientTint,
                diffuseMap:                 !!this.diffuseMap,
                diffuseMapTransform:        this._getMapTransformID(this.diffuseMapTransform),
                needsDiffuseColor:          (this.diffuse.r!=1 || this.diffuse.g!=1 || this.diffuse.b!=1) && this.diffuseMapTint,
                specularMap:                !!this.specularMap,
                specularMapTransform:       this._getMapTransformID(this.specularMapTransform),
                needsSpecularColor:         (this.specular.r!=1 || this.specular.g!=1 || this.specular.b!=1) && this.specularMapTint,
                glossMap:                   !!this.glossMap,
                glossMapTransform:          this._getMapTransformID(this.glossMapTransform),
                needsGlossFloat:            true,//this.shininess!=100,
                emissiveMap:                !!this.emissiveMap,
                emissiveMapTransform:       this._getMapTransformID(this.emissiveMapTransform),
                needsEmissiveColor:         (this.emissive.r!=1 || this.emissive.g!=1 || this.emissive.b!=1 || this.emissiveIntensity!=1) && this.emissiveMapTint,
                opacityMap:                 !!this.opacityMap,
                opacityMapTransform:        this._getMapTransformID(this.opacityMapTransform),
                needsOpacityFloat:          this.opacity!=1,
                normalMap:                  !!this.normalMap,
                normalMapTransform:         this._getMapTransformID(this.normalMapTransform),
                needsNormalFloat:           this.bumpiness!=1,
                heightMap:                  !!this.heightMap,
                heightMapTransform:         this._getMapTransformID(this.heightMapTransform),
                sphereMap:                  !!this.sphereMap,
                cubeMap:                    (!!this.cubeMap) || prefilteredCubeMap,
                lightMap:                   !!this.lightMap,
                aoMap:                      !!this.aoMap,
                aoUvSet:                    this.aoUvSet,
                useSpecular:                (!!this.specularMap) || !(this.specular.r===0 && this.specular.g===0 && this.specular.b===0)
                                            || (!!this.sphereMap) || (!!this.cubeMap) || prefilteredCubeMap,
                rgbmReflection:             prefilteredCubeMap? prefilteredCubeMap128.rgbm : (this.cubeMap? this.cubeMap.rgbm : (this.sphereMap? this.sphereMap.rgbm : false)),

                hdrReflection:              prefilteredCubeMap? prefilteredCubeMap128.rgbm || prefilteredCubeMap128.format===pc.PIXELFORMAT_RGBA32F
                                          : (this.cubeMap? this.cubeMap.rgbm || this.cubeMap.format===pc.PIXELFORMAT_RGBA32F
                                          : (this.sphereMap? this.sphereMap.rgbm || this.sphereMap.format===pc.pc.PIXELFORMAT_RGBA32F : false)),

                fixSeams:                   prefilteredCubeMap? prefilteredCubeMap128.fixCubemapSeams : (this.cubeMap? this.cubeMap.fixCubemapSeams : false),
                prefilteredCubemap:         prefilteredCubeMap,
                specularAA:                 this.specularAntialias,
                conserveEnergy:             this.conserveEnergy,
                occludeSpecular:            this.occludeSpecular,
                shadingModel:               this.shadingModel,
                fresnelModel:               this.fresnelModel,
                packedNormal:               this.normalMap? this.normalMap._compressed : false
            };

            this._mapXForms = null;

            var lightsSorted = [];
            this._collectLights(pc.LIGHTTYPE_DIRECTIONAL, lights, lightsSorted);
            this._collectLights(pc.LIGHTTYPE_POINT,       lights, lightsSorted);
            this._collectLights(pc.LIGHTTYPE_SPOT,        lights, lightsSorted);

            options.lights = lightsSorted;

            // Gamma correct colors
            if (scene.gammaCorrection) {
                for(i=0; i<3; i++) {
                    this.ambientUniform[i] = Math.pow(this.ambient.data[i], 2.2);
                    this.diffuseUniform[i] = Math.pow(this.diffuse.data[i], 2.2);
                    this.specularUniform[i] = Math.pow(this.specular.data[i], 2.2);
                    this.emissiveUniform[i] = Math.pow(this.emissive.data[i], 2.2) * this.emissiveIntensity;
                }
            }

            var library = device.getProgramLibrary();
            this.shader = library.getProgram('phong', options);
        }
    });

    return {
        PhongMaterial: PhongMaterial
    };
}());
