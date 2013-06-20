pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.PhongMaterial
     * @class A Phong material is the main, general purpose material that is most often used for rendering. 
     * It can approximate a wide variety of surface types and can simlulate dynamic reflected light.
     * @property {pc.math.vec3} ambient The ambient color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.math.vec3} diffuse The diffuse color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} diffuseMap The diffuse map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for diffuse
     * color in preference to the 'diffuse' property.
     * @property {pc.math.mat4} diffuseMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's diffuse map.
     * @property {pc.math.vec3} specular The specular color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} specularMap The per-pixel specular map of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * specular color in preference to the 'specular' property.
     * @property {pc.math.mat4} specularMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's specular map.
     * @property {Number} shininess The specular shine of the material. This value can be between 0 and 128. 
     * A higher shininess value results in a more focussed specular highlight.
     * @property {pc.math.vec3} emissive The emissive color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {pc.gfx.Texture} emissiveMap The emissive map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for emissive
     * color in preference to the 'emissive' property.
     * @property {pc.math.mat4} emissiveMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's emissive map.
     * @property {Number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
     * transparent and 1 is fully opaque.
     * @property {pc.gfx.Texture} opacityMap The opacity map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for opacity
     * in preference to the 'opacity' property.
     * @property {pc.math.mat4} opacityMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's opacity map.
     * @property {pc.gfx.Texture} normalMap The normal map of the material. This must be a 2D texture rather 
     * than a cube map. The texture must contains normalized, tangent space normals.
     * @property {pc.math.mat4} normalMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's normal map.
     * @property {pc.gfx.Texture} heightMap The height map of the material. This must be a 2D texture rather 
     * than a cube map. The texture contain values defining the height of the surface at that point where darker
     * pixels are lower and lighter pixels are higher.
     * @property {pc.math.mat4} heightMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's height map.
     * @property {Number} bumpMapFactor The bumpiness of the material. This value scales the assinged bump map
     * (be that a normal map or a height map) and can be between 0 and 1, where 0 shows no contribution from
     * the bump map and 1 results in a full contribution.
     * @property {pc.gfx.Texture} reflectionMap The reflection map of the material. This can be a 2D texture, in
     * which case the texture must be a sphere map.  Otherwise, the material will be cubemapped.
     * @property {Number} reflectivity The reflectivity of the material. This value scales the reflection map and 
     * can be between 0 and 1, where 0 shows no reflection and 1 is fully reflective.
     * @property {pc.gfx.Texture} lightMap The light map of the material. This must be a 2D texture rather 
     * than a cube map.
     * @author Will Eastcott
     */
    var PhongMaterial = function () {
        this.ambient = pc.math.vec3.create(0.7, 0.7, 0.7);
        this.diffuse = pc.math.vec3.create(0.7, 0.7, 0.7);
        this.diffuseMap = null;
        this.diffuseMapTransform = null;
        this.specular = pc.math.vec3.create(0, 0, 0);
        this.specularMap = null;
        this.specularMapTransform = null;
        this.shininess = 25;
        this.glossMap = null;
        this.glossMapTransform = null;
        this.emissive = pc.math.vec3.create(0, 0, 0);
        this.emissiveMap = null;
        this.emissiveMapTransform = null;
        this.opacity = 1;
        this.opacityMap = null;
        this.opacityMapTransform = null;
        this.normalMap = null;
        this.normalMapTransform = null;
        this.heightMap = null;
        this.heightMapTransform = null;
        this.bumpMapFactor = 1;
        this.reflectionMap = null;
        this.reflectivity = 1;
        this.lightMap = null;

        this.update();
    };

    PhongMaterial = pc.inherits(PhongMaterial, pc.scene.Material);

    /**
    * @private
    * @name pc.scene.PhoneMaterial#init
    * @description Update material data from a data block, as found on a material Asset.
    * Note, init() expects texture parameters to contain a {@link pc.gfx.Texture} not a resource id.
    */
    PhongMaterial.prototype.init = function (data) {
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

                // special case
                if (param.name === 'opacityMap') {
                    if (param.data) {
                        this.blendType = pc.scene.BLEND_NORMAL;    
                    } else {
                        this.blendType = pc.scene.BLEND_NONE;
                    }
                    
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
                // special case
                if (param.name === 'opacity') {
                    if (this.opacity && this.opacity < 1) {
                        this.blendType = pc.scene.BLEND_NORMAL;
                    } else {
                        this.blendType = pc.scene.BLEND_NONE;
                    }
                }
            }
        }

        this.update();
    };

    PhongMaterial.prototype.update = function () {
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
            this.setParameter('material_bumpMapFactor', this.bumpMapFactor);
        }

        if (this.reflectionMap) {
            if (this.reflectionMap._cubemap) {
                this.setParameter('texture_cubeMap', this.reflectionMap);
            } else {
                this.setParameter('texture_sphereMap', this.reflectionMap);
            }
            this.setParameter('material_reflectionFactor', this.reflectivity);
        }

        if (this.lightMap) {
            this.setParameter('texture_lightMap', this.lightMap);
        }
    };

    PhongMaterial.prototype.getProgram = function (device, mesh) {
        var scene = pc.scene.Scene.current;
        var i;
        var numDirs = 0, numPnts = 0, numSpts = 0; // Non-shadow casters
        var numSDirs = 0, numSPnts = 0, numSSpts = 0; // Shadow casters
        if (scene) {
            for (i = 0; i < scene._globalLights.length; i++) {
                if (scene._globalLights[i].getCastShadows()) {
                    numSDirs++;
                } else {
                    numDirs++;
                }
            }
            for (i = 0; i < scene._localLights[0].length; i++) {
                if (scene._localLights[0][i].getCastShadows()) {
                    numSPnts++;
                } else {
                    numPnts++;
                }
            }
            for (i = 0; i < scene._localLights[1].length; i++) {
                if (scene._localLights[1][i].getCastShadows()) {
                    numSSpts++;
                } else {
                    numSpts++;
                }
            }
        }
        var skinned = (mesh.skin !== null);
        var currState = device.getCurrentState();
        var key = '';
        if (skinned) key += 'skin_';
        if (currState.fog) key += 'fog_';
        if (currState.alphaTest) key += 'atst_';
        key += numDirs + 'dir_' + numPnts + 'pnt_' + numSpts + 'spt' + numSDirs + 'sdir_' + numSPnts + 'spnt_' + numSSpts + 'sspt';

        var program = this._programs[key];
        if (program) {
            return program;
        }

        var parameters = this.getParameters();
        var options = {
            alphaTest: currState.alphaTest,
            fog:       currState.fog,
            skin:      skinned,
            numDirs:   numDirs,
            numSDirs:  numSDirs,
            numPnts:   numPnts,
            numSPnts:  numSPnts,
            numSpts:   numSpts,
            numSSpts:  numSSpts,
            diffuseMap:                 (parameters.texture_diffuseMap !== undefined),
            diffuseMapTransform:        (parameters.texture_diffuseMapTransform !== undefined),
            specularMap:                (parameters.texture_specularMap !== undefined),
            specularMapTransform:       (parameters.texture_specularMapTransform !== undefined),
            specularFactorMap:          (parameters.texture_specularFactorMap !== undefined),
            specularFactorMapTransform: (parameters.texture_specularFactorMapTransform !== undefined),
            glossMap:                   (parameters.texture_glossMap !== undefined),
            glossMapTransform:          (parameters.texture_glossMapTransform !== undefined),
            emissiveMap:                (parameters.texture_emissiveMap !== undefined),
            emissiveMapTransform:       (parameters.texture_emissiveMapTransform !== undefined),
            opacityMap:                 (parameters.texture_opacityMap !== undefined),
            opacityMapTransform:        (parameters.texture_opacityMapTransform !== undefined),
            normalMap:                  (parameters.texture_normalMap !== undefined),
            normalMapTransform:         (parameters.texture_normalMapTransform !== undefined),
            heightMap:                  (parameters.texture_heightMap !== undefined),
            heightMapTransform:         (parameters.texture_heightMapTransform !== undefined),
            sphereMap:                  (parameters.texture_sphereMap !== undefined),
            cubeMap:                    (parameters.texture_cubeMap !== undefined),
            lightMap:                   (parameters.texture_lightMap !== undefined)
        };
        var library = device.getProgramLibrary();
        program = library.getProgram('phong', options);
        this._programs[key] = program;
        return program;
    };

    return {
        PhongMaterial: PhongMaterial
    }; 
}());