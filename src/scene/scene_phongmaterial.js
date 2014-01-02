pc.extend(pc.scene, function () {

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
     * @property {pc.Mat4} diffuseMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's diffuse map.
     * @property {pc.Color} specular The specular color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} specularMap The per-pixel specular map of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * specular color in preference to the 'specular' property.
     * @property {pc.Mat4} specularMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's specular map.
     * @property {Number} shininess The specular shine of the material. This value can be between 0 and 128. 
     * A higher shininess value results in a more focussed specular highlight.
     * @property {pc.gfx.Texture} glossMap The per-pixel gloss of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * shininess in preference to the 'shininess' property.
     * @property {pc.Mat4} glossMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's gloss map.
     * @property {pc.Vec3} emissive The emissive color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} emissiveMap The emissive map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for emissive
     * color in preference to the 'emissive' property.
     * @property {pc.Mat4} emissiveMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's emissive map.
     * @property {Number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
     * transparent and 1 is fully opaque.
     * @property {pc.gfx.Texture} opacityMap The opacity map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for opacity
     * in preference to the 'opacity' property.
     * @property {pc.Mat4} opacityMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's opacity map.
     * @property {pc.gfx.Texture} normalMap The normal map of the material. This must be a 2D texture rather 
     * than a cube map. The texture must contains normalized, tangent space normals.
     * @property {pc.Mat4} normalMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's normal map.
     * @property {pc.gfx.Texture} heightMap The height map of the material. This must be a 2D texture rather 
     * than a cube map. The texture contain values defining the height of the surface at that point where darker
     * pixels are lower and lighter pixels are higher.
     * @property {pc.Mat4} heightMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's height map.
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
        this.diffuseMapTransform = null;

        this.specular = new pc.Color(0, 0, 0);
        this.specularMap = null;
        this.specularMapTransform = null;

        this.shininess = 25;
        this.glossMap = null;
        this.glossMapTransform = null;

        this.emissive = new pc.Color(0, 0, 0);
        this.emissiveMap = null;
        this.emissiveMapTransform = null;

        this.opacity = 1;
        this.opacityMap = null;
        this.opacityMapTransform = null;

        this.normalMap = null;
        this.normalMapTransform = null;
        this.heightMap = null;
        this.heightMapTransform = null;
        this.bumpiness = 1;

        this.cubeMap = null;
        this.sphereMap = null;
        this.reflectivity = 1;

        this.lightMap = null;

        this.update();
    };

    PhongMaterial = pc.inherits(PhongMaterial, pc.scene.Material);

    pc.extend(PhongMaterial.prototype, {
        /**
         * @function
         * @name pc.scene.PhongMaterial#clone
         * @description Duplicates a Phong material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.scene.PhongMaterial} A cloned Phong material.
         * @author Will Eastcott
         */
        clone: function () {
            var clone = new pc.scene.PhongMaterial();

            Material.prototype._cloneInternal.call(this, clone);

            clone.ambient.copy(this.ambient);

            clone.diffuse.copy(this.diffuse);
            clone.diffuseMap = this.diffuseMap;
            clone.diffuseMapTransform = this.diffuseMapTransform ? this.diffuseMapTransform.clone() : null;

            clone.specular.copy(this.specular);
            clone.specularMap = this.specularMap;
            clone.specularMapTransform = this.specularMapTransform ? this.specularMapTransform.clone() : null;

            clone.shininess = this.shininess;
            clone.glossMap = this.glossMap;
            clone.glossMapTransform = this.glossMapTransform ? this.glossMapTransform.clone() : null;

            clone.emissive.copy(this.emissive);
            clone.emissiveMap = this.emissiveMap;
            clone.emissiveMapTransform = this.emissiveMapTransform ? this.emissiveMapTransform.clone() : null;

            clone.opacity = this.opacity;
            clone.opacityMap = this.opacityMap;
            clone.opacityMapTransform = this.opacityMapTransform ? this.opacityMapTransform.clone() : null;

            clone.normalMap = this.normalMap;
            clone.normalMapTransform = this.normalMapTransform ? this.normalMapTransform.clone() : null;
            clone.heightMap = this.heightMap;
            clone.heightMapTransform = this.heightMapTransform ? this.heightMapTransform.clone() : null;
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

                function isMathType(type) {
                    if (type === 'vec2' ||
                        type === 'vec3' ||
                        type === 'vec4' ||
                        type === 'mat3' ||
                        type === 'mat4') {
                        return true;
                    }

                    return false;
                }
                // Update material based on type
                if (isMathType(param.type)) {
                    if (param.data) {
                        this[param.name] = pc.math[param.type].clone(param.data);
                    } else {
                        this[param.name] = null;
                    }
                } else if (param.type === "texture") {
                    if (param.data) {
                        if (param.data instanceof pc.gfx.Texture) {
                            this[param.name] = param.data;
                        } else {
                            throw Error("PhongMaterial.init() expects textures to already be created");
                        }
                    } else {
                        this[param.name] = null;
                    }
                } else if (param.type === "float") {
                    this[param.name] = param.data;
                }
            }

            // Set an appropriate blend mode based on opacity of material
            if (this.opacityMap || this.opacity < 1) {
                this.blendType = pc.scene.BLEND_NORMAL;
            } else {
                this.blendType = pc.scene.BLEND_NONE;
            }

            this.update();
        },

        update: function () {
            this.clearParameters();

            this.setParameter('material_ambient', this.ambient);

            if (this.diffuseMap) {
                this.setParameter('texture_diffuseMap', this.diffuseMap);
                if (this.diffuseMapTransform) {
                    this.setParameter('texture_diffuseMapTransform', this.diffuseMapTransform);
                }
            } else {
                this.setParameter('material_diffuse', this.diffuse);
            }

            if (this.specularMap) {
                this.setParameter('texture_specularMap', this.specularMap);
                if (this.specularMapTransform) {
                    this.setParameter('texture_specularMapTransform', this.specularMapTransform);
                }
            } else {
                this.setParameter('material_specular', this.specular);
            }

            if (this.glossMap) {
                this.setParameter('texture_glossMap', this.glossMap);
                if (this.glossMapTransform) {
                    this.setParameter('texture_glossMapTransform', this.glossMapTransform);
                }
            } else {
                this.setParameter('material_shininess', this.shininess);
            }

            if (this.emissiveMap) {
                this.setParameter('texture_emissiveMap', this.emissiveMap);
                if (this.emissiveMapTransform) {
                    this.setParameter('texture_emissiveMapTransform', this.emissiveMapTransform);
                }
            } else {
                this.setParameter('material_emissive', this.emissive);
            }

            if (this.opacityMap) {
                this.setParameter('texture_opacityMap', this.opacityMap);
                if (this.opacityMapTransform) {
                    this.setParameter('texture_opacityMapTransform', this.opacityMapTransform);
                }
            } else {
                this.setParameter('material_opacity', this.opacity);
            }

            if (this.normalMap) {
                this.setParameter('texture_normalMap', this.normalMap);
                if (this.normalMapTransform) {
                    this.setParameter('texture_normalMapTransform', this.normalMapTransform);
                }
            } 
            if (this.heightMap) {
                this.setParameter('texture_heightMap', this.heightMap);
                if (this.heightMapTransform) {
                    this.setParameter('texture_heightMapTransform', this.heightMapTransform);
                }
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

            var numDirs = 0, numPnts = 0, numSpts = 0; // Non-shadow casters
            var numSDirs = 0, numSPnts = 0, numSSpts = 0; // Shadow casters
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                if (light.getEnabled()) {
                    switch (light.getType()) {
                        case pc.scene.LIGHTTYPE_DIRECTIONAL:
                            if (light.getCastShadows()) {
                                numSDirs++;
                            } else {
                                numDirs++;
                            }
                            break;
                        case pc.scene.LIGHTTYPE_POINT:
                            numPnts++;
                            break;
                        case pc.scene.LIGHTTYPE_SPOT:
                            if (light.getCastShadows()) {
                                numSSpts++;
                            } else {
                                numSpts++;
                            }
                            break;
                    }
                }
            }

            var options = {
                fog: scene.fog,
                skin: !!this.meshInstances[0].skinInstance,
                numDirs: numDirs,
                numSDirs: numSDirs,
                numPnts: numPnts,
                numSPnts: numSPnts,
                numSpts: numSpts,
                numSSpts: numSSpts,
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
            var library = device.getProgramLibrary();
            this.shader = library.getProgram('phong', options);
        }
    });

    return {
        PhongMaterial: PhongMaterial
    }; 
}());