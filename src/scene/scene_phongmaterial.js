pc.extend(pc.scene, function () {

    /**
     * @name pc.scene.PhongMaterial
     * @class A Phong material is the main, general purpose material that is most often used for rendering. 
     * It can approximate a wide variety of surface types and can simlulate dynamic reflected light.
     * @property {Float32Array} ambient The ambient color of the material (RGB, where each component is 0 to 1).
     * @property {Float32Array} diffuse The diffuse color of the material (RGB, where each component is 0 to 1).
     * @property {pc.gfx.Texture} diffuseMap The diffuse map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for diffuse
     * color in preference to the 'diffuse' property.
     * @property {Float32Array} specular The specular color of the material (RGB, where each component is 0 to 1).
     * @property {pc.gfx.Texture} specularMap The specular map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for specular
     * color in preference to the 'specular' property.
     * @property {Number} shininess The specular shine of the material. This value can be between 0 and 128. 
     * A higher shininess value results in a more focussed specular highlight.
     * @property {Float32Array} emissive The emissive color of the material (RGB, where each component is 0 to 1).
     * @property {pc.gfx.Texture} specularMap The emissive map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for emissive
     * color in preference to the 'emissive' property.
     * @property {Number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
     * transparent and 1 is fully opaque.
     * @property {pc.gfx.Texture} opacityMap The opacity map of the material. This must be a 2D texture rather 
     * than a cube map. If this property is set to a valid texture, the texture is used as the source for opacity
     * in preference to the 'opacity' property.
     * @property {pc.gfx.Texture} normalMap The normal map of the material. This must be a 2D texture rather 
     * than a cube map. The texture must contains normalized, tangent space normals.
     * @property {pc.gfx.Texture} parallaxMap The parallax map of the material. This must be a 2D texture rather 
     * than a cube map. The texture must contains normalized, tangent space normals with the heightmap in the alpha 
     * channel.
     * @property {pc.gfx.Texture} sphereMap The sphere refelction map of the material. This must be a 2D texture rather 
     * than a cube map. If this map is set, any cubemap that was previously set on the material will be removed.
     * @property {pc.gfx.Texture} cubeMap The cube reflection map of the material. This must be a cube map rather 
     * than a 2D texture. If this map is set, any spheremap that was previously set on the material will be removed.
     * @property {Number} reflectivity The reflectivity of the material. This value can be between 0 and 1, where 0 
     * shows no reflection and 1 is fully reflective.
     * @property {pc.gfx.Texture} lightMap The light map of the material. This must be a 2D texture rather 
     * than a cube map.
     * @author Will Eastcott
     */
    var PhongMaterial = function () {
        this.setProgramName('phong');
        this.setParameter('material_ambient', new Float32Array([0.7, 0.7, 0.7]));
        this.setParameter('material_diffuse', new Float32Array([0.7, 0.7, 0.7]));
        this.setParameter('material_specular', new Float32Array([0, 0, 0]));
        this.setParameter('material_emissive', new Float32Array([0, 0, 0]));
        this.setParameter('material_shininess', 25);
        this.setParameter('material_opacity', 1);
    };

    PhongMaterial = pc.inherits(PhongMaterial, pc.scene.Material);

    PhongMaterial.prototype._updateTransparency = function () {
        this.transparent = false;

        var diffuseMap = this.diffuseMap;
        if (diffuseMap) {
            if (diffuseMap.format === pc.gfx.PIXELFORMAT_R8_G8_B8_A8) {
                this.transparent = true;
                return;
            }
        }
        this.transparent = ((diffuse.format === pc.gfx.PIXELFORMAT_R8_G8_B8_A8) || (this.opacity < 1) || (this.opacityMap !== null));
    };

    Object.defineProperty(PhongMaterial.prototype, 'ambient', {
        get: function() { 
            return this.getParameter('material_ambient'); 
        },
        set: function(ambient) {
            this.setParameter('material_ambient', ambient);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'diffuse', {
        get: function() { 
            return this.getParameter('material_diffuse'); 
        },
        set: function(diffuse) {
            if (this.getParameter('texture_diffuseMap')) {
                this.deleteParameter('texture_diffuseMap');
            }
            this.setParameter('material_diffuse', diffuse);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'diffuseMap', {
        get: function() { 
            return this.getParameter('texture_diffuseMap'); 
        },
        set: function(diffuseMap) {
            if (this.getParameter('material_diffuse')) {
                this.deleteParameter('material_diffuse');
            }
            this.setParameter('texture_diffuseMap', diffuseMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'diffuseMapTransform', {
        get: function() { 
            return this.getParameter('texture_diffuseMapTransform'); 
        },
        set: function(diffuseMapTransform) {
            if (diffuseMapTransform) {
                this.setParameter('texture_diffuseMapTransform', diffuseMapTransform);
            } else {
                this.deleteParameter('texture_diffuseMapTransform');
            }
        }
    });

    // Specular properties
    Object.defineProperty(PhongMaterial.prototype, 'specular', {
        get: function() { 
            return this.getParameter('material_specular'); 
        },
        set: function(specular) {
            if (this.getParameter('texture_specularMap')) {
                this.deleteParameter('texture_specularMap');
            }
            this.setParameter('material_specular', specular);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'specularMap', {
        get: function() { 
            return this.getParameter('texture_specularMap'); 
        },
        set: function(specularMap) {
            if (this.getParameter('material_specular')) {
                this.deleteParameter('material_specular');
            }
            this.setParameter('texture_specularMap', specularMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'shininess', {
        get: function() { 
            return this.getParameter('material_shininess'); 
        },
        set: function(shininess) {
            this.setParameter('material_shininess', shininess);
        }
    });

    // Emissive properties
    Object.defineProperty(PhongMaterial.prototype, 'emissive', {
        get: function() { 
            return this.getParameter('material_emissive'); 
        },
        set: function(emissive) {
            if (this.getParameter('texture_emissiveMap')) {
                this.deleteParameter('texture_emissiveMap');
            }
            this.setParameter('material_emissive', emissive);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'emissiveMap', {
        get: function() { 
            return this.getParameter('texture_emissiveMap'); 
        },
        set: function(emissiveMap) {
            if (this.getParameter('material_emissive')) {
                this.deleteParameter('material_emissive');
            }
            this.setParameter('texture_emissiveMap', emissiveMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'opacity', {
        get: function() { 
            return this.getParameter('material_opacity'); 
        },
        set: function(opacity) {
            if (this.getParameter('texture_opacityMap')) {
                this.deleteParameter('texture_opacityMap');
            }
            this.setParameter('material_opacity', 1);
            this.transparent = (opacity < 1);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'opacityMap', {
        get: function() {
            return this.getParameter('texture_opacityMap'); 
        },
        set: function(opacityMap) {
            if (this.getParameter('material_opacity')) {
                this.deleteParameter('material_opacity');
            }
            this.setParameter('texture_opacityMap', opacityMap);
            this.transparent = true;
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'normalMap', {
        get: function() {
            return this.getParameter('texture_normalMap'); 
        },
        set: function(normalMap) {
            if (normalMap) {
                this.setParameter('texture_normalMap', normalMap);
            } else {
                this.deleteParameter('texture_normalMap');
            }
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'parallaxMap', {
        get: function() { 
            return this.getParameter('texture_parallaxMap'); 
        },
        set: function(parallaxMap) {
            this.setParameter('texture_parallaxMap', parallaxMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'sphereMap', {
        get: function() { 
            return this.getParameter('texture_sphereMap'); 
        },
        set: function(sphereMap) {
            if (this.getParameter('texture_cubeMap')) {
                this.deleteParameter('texture_cubeMap');
            }
            this.setParameter('texture_sphereMap', sphereMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'cubeMap', {
        get: function() { 
            return this.getParameter('texture_cubeMap'); 
        },
        set: function(cubeMap) {
            if (this.getParameter('texture_sphereMap')) {
                this.deleteParameter('texture_sphereMap');
            }
            this.setParameter('texture_cubeMap', cubeMap);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'reflectivity', {
        get: function() {
            return this.getParameter('material_reflectionFactor'); 
        },
        set: function(reflectivity) {
            this.setParameter('material_reflectionFactor', reflectivity);
        }
    });

    Object.defineProperty(PhongMaterial.prototype, 'lightMap', {
        get: function() { 
            return this.getParameter('texture_lightMap'); 
        },
        set: function(lightMap) {
            this.setParameter('texture_lightMap', lightMap);
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