pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.PhongMaterial
     * @class A Phong material is the main, general purpose material that is most often used for rendering. 
     * It can approximate a wide variety of surface types and can simlulate dynamic reflected light.
     * @property {pc.math.vec3} ambient The ambient color of the material (RGB, where each component is 0 to 1).
     * @property {pc.math.vec3} diffuse The diffuse color of the material (RGB, where each component is 0 to 1).
     * @property {pc.gfx.Texture} diffuseMap The diffuse map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for diffuse
     * color in preference to the 'diffuse' property.
     * @property {pc.math.mat4} diffuseMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's diffuse map.
     * @property {pc.math.vec3} specular The specular color of the material (RGB, where each component is 0 to 1).
     * @property {pc.gfx.Texture} specularMap The per-pixel specular map of the material. This must be a 2D texture
     * rather than a cube map. If this property is set to a valid texture, the texture is used as the source for
     * specular color in preference to the 'specular' property.
     * @property {pc.math.mat4} specularMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's specular map.
     * @property {Number} shininess The specular shine of the material. This value can be between 0 and 128. 
     * A higher shininess value results in a more focussed specular highlight.
     * @property {pc.math.vec3} emissive The emissive color of the material (RGB, where each component is 0 to 1).
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
     * @property {pc.gfx.Texture} parallaxMap The parallax map of the material. This must be a 2D texture rather 
     * than a cube map. The texture must contains normalized, tangent space normals with the heightmap in the alpha 
     * channel.
     * @property {pc.gfx.Texture} reflectionMap The reflection map of the material. This can be a 2D texture, in
     * which case the texture must be a sphere map.  Otherwise, the material will be cubemapped.
     * @property {Number} reflectivity The reflectivity of the material. This value scales the reflection map and 
     * can be between 0 and 1, where 0 shows no reflection and 1 is fully reflective.
     * @property {pc.gfx.Texture} lightMap The light map of the material. This must be a 2D texture rather 
     * than a cube map.
     * @author Will Eastcott
     */
    var PhongMaterial = function () {
        this.setProgramName('phong');

        this._ambient = pc.math.vec3.create(0.7, 0.7, 0.7);
        this._diffuse = pc.math.vec3.create(0.7, 0.7, 0.7);
        this._diffuseMap = null;
        this._diffuseMapTransform = null;
        this._specular = pc.math.vec3.create(0, 0, 0);
        this._specularMap = null;
        this._specularMapTransform = null;
        this._shininess = 25;
        this._glossMap = null;
        this._glossMapTransform = null;
        this._emissive = pc.math.vec3.create(0, 0, 0);
        this._emissiveMap = null;
        this._emissiveMapTransform = null;
        this._opacity = 1;
        this._opacityMap = null;
        this._opacityMapTransform = null;
        this._normalMap = null;
        this._parallaxMap = null;
        this._reflectionMap = null;
        this._reflectivity = 1;
        this._lightMap = null;

        this.setParameter('material_ambient', this._ambient);
        this.setParameter('material_diffuse', this._diffuse);
        this.setParameter('material_specular', this._specular);
        this.setParameter('material_emissive', this._emissive);
        this.setParameter('material_shininess', this._shininess);
        this.setParameter('material_opacity', this._opacity);
    };

    PhongMaterial = pc.inherits(PhongMaterial, pc.scene.Material);

    Object.defineProperty(PhongMaterial.prototype, 'ambient', {
        get: function () { 
            return this._ambient; 
        },
        set: function (ambient) {
            this._ambient = ambient;
            this.setParameter('material_ambient', this._ambient);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'diffuse', {
        get: function () { 
            return this._diffuse;
        },
        set: function (diffuse) {
            this._diffuse = diffuse;
            if (!this.getParameter('texture_diffuseMap')) {
                this.setParameter('material_diffuse', diffuse);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'diffuseMap', {
        get: function () {
            return this._diffuseMap; 
        },
        set: function (diffuseMap) {
            this._diffuseMap = diffuseMap; 
            if (diffuseMap === null) {
                if (this.getParameter('texture_diffuseMap')) {
                    this.deleteParameter('texture_diffuseMap');
                }
                this.setParameter('material_diffuse', this._diffuse);
            } else {
                if (this.getParameter('material_diffuse')) {
                    this.deleteParameter('material_diffuse');
                }
                this.setParameter('texture_diffuseMap', diffuseMap);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'diffuseMapTransform', {
        get: function () { 
            return this._diffuseMapTransform; 
        },
        set: function (diffuseMapTransform) {
            this._diffuseMapTransform = diffuseMapTransform;
            if (diffuseMapTransform) {
                this.setParameter('texture_diffuseMapTransform', diffuseMapTransform);
            } else {
                this.deleteParameter('texture_diffuseMapTransform');
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'specular', {
        get: function () { 
            return this._specular;
        },
        set: function (specular) {
            this._specular = specular;
            if (!this.getParameter('texture_specularMap')) {
                this.setParameter('material_specular', specular);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'specularMap', {
        get: function () {
            return this._specularMap; 
        },
        set: function (specularMap) {
            this._specularMap = specularMap; 
            if (specularMap === null) {
                if (this.getParameter('texture_specularMap')) {
                    this.deleteParameter('texture_specularMap');
                }
                this.setParameter('material_specular', this._specular);
            } else {
                if (this.getParameter('material_specular')) {
                    this.deleteParameter('material_specular');
                }
                this.setParameter('texture_specularMap', specularMap);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'specularMapTransform', {
        get: function () { 
            return this._specularMapTransform; 
        },
        set: function (specularMapTransform) {
            this._specularMapTransform = specularMapTransform;
            if (specularMapTransform) {
                this.setParameter('texture_specularMapTransform', specularMapTransform);
            } else {
                this.deleteParameter('texture_specularMapTransform');
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'shininess', {
        get: function () { 
            return this._shininess;
        },
        set: function (shininess) {
            this._shininess = shininess;
            this.setParameter('material_shininess', shininess);
        }
    });

    // Emissive properties
    Object.defineProperty(PhongMaterial.prototype, 'emissive', {
        get: function () { 
            return this._emissive;
        },
        set: function (emissive) {
            this._emissive = emissive;
            if (!this.getParameter('texture_emissiveMap')) {
                this.setParameter('material_emissive', emissive);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'emissiveMap', {
        get: function () {
            return this._emissiveMap; 
        },
        set: function (emissiveMap) {
            this._emissiveMap = emissiveMap; 
            if (emissiveMap === null) {
                if (this.getParameter('texture_emissiveMap')) {
                    this.deleteParameter('texture_emissiveMap');
                }
                this.setParameter('material_emissive', this._emissive);
            } else {
                if (this.getParameter('material_emissive')) {
                    this.deleteParameter('material_emissive');
                }
                this.setParameter('texture_emissiveMap', emissiveMap);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'emissiveMapTransform', {
        get: function () { 
            return this._emissiveMapTransform; 
        },
        set: function (emissiveMapTransform) {
            this._emissiveMapTransform = emissiveMapTransform;
            if (emissiveMapTransform) {
                this.setParameter('texture_emissiveMapTransform', emissiveMapTransform);
            } else {
                this.deleteParameter('texture_emissiveMapTransform');
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'opacity', {
        get: function () { 
            return this._opacity;
        },
        set: function (opacity) {
            this._opacity = opacity;
            if (!this.getParameter('texture_opacityMap')) {
                this.setParameter('material_opacity', opacity);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'opacityMap', {
        get: function () {
            return this._opacityMap; 
        },
        set: function (opacityMap) {
            this._opacityMap = opacityMap; 
            if (opacityMap === null) {
                if (this.getParameter('texture_opacityMap')) {
                    this.deleteParameter('texture_opacityMap');
                }
                this.setParameter('material_opacity', this._opacity);
            } else {
                if (this.getParameter('material_opacity')) {
                    this.deleteParameter('material_opacity');
                }
                this.setParameter('texture_opacityMap', opacityMap);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'opacityMapTransform', {
        get: function () { 
            return this._opacityMapTransform; 
        },
        set: function (opacityMapTransform) {
            this._opacityMapTransform = opacityMapTransform;
            if (opacityMapTransform) {
                this.setParameter('texture_opacityMapTransform', opacityMapTransform);
            } else {
                this.deleteParameter('texture_opacityMapTransform');
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'normalMap', {
        get: function () {
            return this._normalMap; 
        },
        set: function (normalMap) {
            this._opacityMap = normalMap; 
            if (normalMap === null) {
                if (this.getParameter('texture_normalMap')) {
                    this.deleteParameter('texture_normalMap');
                }
            } else {
                if (this.getParameter('texture_parallaxMap')) {
                    this.deleteParameter('texture_parallaxMap');
                }
                this.setParameter('texture_normalMap', normalMap);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'parallaxMap', {
        get: function () { 
            return this.getParameter('texture_parallaxMap'); 
        },
        set: function (parallaxMap) {
            this.setParameter('texture_parallaxMap', parallaxMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'reflectionMap', {
        get: function () {
            return this._reflectionMap;
        },
        set: function (reflectionMap) {
            if (reflectionMap === null) {
                if (this.getParameter('texture_sphereMap')) {
                    this.deleteParameter('texture_sphereMap');
                }
                if (this.getParameter('texture_cubeMap')) {
                    this.deleteParameter('texture_cubeMap');
                }
                this.deleteParameter('material_reflectionFactor');
            } else {
                if (reflectionMap._cubemap) {
                    if (this.getParameter('texture_sphereMap')) {
                        this.deleteParameter('texture_sphereMap');
                    }
                    this.setParameter('texture_cubeMap', reflectionMap);
                } else {
                    if (this.getParameter('texture_cubeMap')) {
                        this.deleteParameter('texture_cubeMap');
                    }
                    this.setParameter('texture_sphereMap', reflectionMap);
                }
                this.setParameter('material_reflectionFactor', this._reflectivity);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'reflectivity', {
        get: function () {
            return this._reflectivity; 
        },
        set: function (reflectivity) {
            this._reflectivity = reflectivity;
            if (this._sphereMap || this._cubeMap) {
                this.setParameter('material_reflectionFactor', reflectivity);
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'lightMap', {
        get: function () { 
            return this._lightMap;
        },
        set: function (lightMap) {
            this._lightMap = lightMap;
            if (lightMap === null) {
                if (this.getParameter('texture_lightMap')) {
                    this.deleteParameter('texture_lightMap');
                }
            } else {
                this.setParameter('texture_lightMap', lightMap);
            }
        }
    });

    PhongMaterial.prototype.getProgram = function (mesh) {
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
            for (i = 0; i < mesh._localLights[0].length; i++) {
                if (mesh._localLights[0][i].getCastShadows()) {
                    numSPnts++;
                } else {
                    numPnts++;
                }
            }
            for (i = 0; i < mesh._localLights[1].length; i++) {
                if (mesh._localLights[1][i].getCastShadows()) {
                    numSSpts++;
                } else {
                    numSpts++;
                }
            }
        }
        var skinned = mesh.getGeometry().isSkinned();
        var device = pc.gfx.Device.getCurrent();
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
            diffuseMap:                 (parameters["texture_diffuseMap"] !== undefined),
            diffuseMapTransform:        (parameters["texture_diffuseMapTransform"] !== undefined),
            specularMap:                (parameters["texture_specularMap"] !== undefined),
            specularMapTransform:       (parameters["texture_specularMapTransform"] !== undefined),
            specularFactorMap:          (parameters["texture_specularFactorMap"] !== undefined),
            specularFactorMapTransform: (parameters["texture_specularFactorMapTransform"] !== undefined),
            emissiveColor:              (parameters["material_emissive"] !== undefined),
            emissiveMap:                (parameters["texture_emissiveMap"] !== undefined),
            emissiveMapTransform:       (parameters["texture_emissiveMapTransform"] !== undefined),
            opacityMap:                 (parameters["texture_opacityMap"] !== undefined),
            opacityMapTransform:        (parameters["texture_opacityMapTransform"] !== undefined),
            normalMap:                  (parameters["texture_normalMap"] !== undefined),
            normalMapTransform:         (parameters["texture_normalMapTransform"] !== undefined),
            parallaxMap:                (parameters["texture_parallaxMap"] !== undefined),
            parallaxMapTransfrom:       (parameters["texture_parallaxMapTransform"] !== undefined),
            sphereMap:                  (parameters["texture_sphereMap"] !== undefined),
            cubeMap:                    (parameters["texture_cubeMap"] !== undefined),
            lightMap:                   (parameters["texture_lightMap"] !== undefined)
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