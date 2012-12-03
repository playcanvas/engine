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
     * @property {pc.gfx.Texture} parallaxMap The parallax map of the material. This must be a 2D texture rather 
     * than a cube map. The texture must contains normalized, tangent space normals with the heightmap in the alpha 
     * channel.
     * @property {pc.math.mat4} parallaxMapTransform 4x4 matrix that is used to transform the texture coordinates
     * of the material's parallax map.
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
        this.parallaxMap = null;
        this.reflectionMap = null;
        this.reflectivity = 1;
        this.lightMap = null;

        this.update();
    };

    PhongMaterial = pc.inherits(PhongMaterial, pc.scene.Material);

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

        this.setParameter('material_shininess', this.shininess);

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
        } else if (this.parallaxMap) {
            this.setParameter('texture_parallaxMap', this.parallaxMap);
            if (this.parallaxMapTransform) {
                this.setParameter('texture_parallaxMapTransform', this.parallaxMapTransform);
            }
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

        this.transparent = false;
        if (this.opacityMap) {
            this.transparent = true;
        } else if (this.opacity < 1) {
            this.transparent = true;
        }
        if (this.diffuseMap) {
            if (this.diffuseMap.format === pc.gfx.PIXELFORMAT_R8_G8_B8_A8) {
                this.transparent = true;
            }
        }
    };

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
        var skinned = (mesh.skin !== undefined);
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