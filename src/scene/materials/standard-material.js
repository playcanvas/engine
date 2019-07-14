Object.assign(pc, function () {
    /**
     * @constructor
     * @name pc.StandardMaterial
     * @classdesc A Standard material is the main, general purpose material that is most often used for rendering.
     * It can approximate a wide variety of surface types and can simulate dynamic reflected light.
     * Most maps can use 3 types of input values in any combination: constant (color or number), mesh vertex colors and a texture. All enabled inputs are multiplied together.
     *
     * @property {pc.Color} ambient The ambient color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     *
     * @property {pc.Color} diffuse The diffuse color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * Defines basic surface color (aka albedo).
     * @property {Boolean} diffuseTint Multiply diffuse map and/or diffuse vertex color by the constant diffuse value.
     * @property {pc.Texture} diffuseMap The diffuse map of the material.
     * @property {Number} diffuseMapUv Diffuse map UV channel
     * @property {pc.Vec2} diffuseMapTiling Controls the 2D tiling of the diffuse map.
     * @property {pc.Vec2} diffuseMapOffset Controls the 2D offset of the diffuse map. Each component is between 0 and 1.
     * @property {String} diffuseMapChannel Color channels of the diffuse map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     * @property {Boolean} diffuseVertexColor Use mesh vertex colors for diffuse. If diffuseMap or are diffuseTint are set, they'll be multiplied by vertex colors.
     * @property {String} diffuseVertexColorChannel Vertex color channels to use for diffuse. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     *
     * @property {pc.Color} specular The specular color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * Defines surface reflection/specular color. Affects specular intensity and tint.
     * @property {Boolean} specularTint Multiply specular map and/or specular vertex color by the constant specular value.
     * @property {pc.Texture} specularMap The specular map of the material.
     * @property {Number} specularMapUv Specular map UV channel
     * @property {pc.Vec2} specularMapTiling Controls the 2D tiling of the specular map.
     * @property {pc.Vec2} specularMapOffset Controls the 2D offset of the specular map. Each component is between 0 and 1.
     * @property {String} specularMapChannel Color channels of the specular map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     * @property {Boolean} specularVertexColor Use mesh vertex colors for specular. If specularMap or are specularTint are set, they'll be multiplied by vertex colors.
     * @property {String} specularVertexColorChannel Vertex color channels to use for specular. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     *
     * @property {Boolean} useMetalness Use metalness properties instead of specular.
     * When enabled, diffuse colors also affect specular instead of the dedicated specular map.
     * This can be used as alternative to specular color to save space.
     * With metaless == 0, the pixel is assumed to be dielectric, and diffuse color is used as normal.
     * With metaless == 1, the pixel is fully metallic, and diffuse color is used as specular color instead.
     * @property {Number} metalness Defines how much the surface is metallic. From 0 (dielectric) to 1 (metal).
     * @property {pc.Texture} metalnessMap Monochrome metalness map.
     * @property {Number} metalnessMapUv Metalness map UV channel
     * @property {pc.Vec2} metalnessMapTiling Controls the 2D tiling of the metalness map.
     * @property {pc.Vec2} metalnessMapOffset Controls the 2D offset of the metalness map. Each component is between 0 and 1.
     * @property {String} metalnessMapChannel Color channel of the metalness map to use. Can be "r", "g", "b" or "a".
     * @property {Boolean} metalnessVertexColor Use mesh vertex colors for metalness. If metalnessMap is set, it'll be multiplied by vertex colors.
     * @property {String} metalnessVertexColorChannel Vertex color channel to use for metalness. Can be "r", "g", "b" or "a".
     *
     * @property {Number} shininess Defines glossiness of the material from 0 (rough) to 100 (shiny mirror).
     * A higher shininess value results in a more focused specular highlight.
     * Glossiness map/vertex colors are always multiplied by this value (normalized to 0 - 1 range), or it is used directly as constant output.
     * @property {pc.Texture} glossMap Glossiness map. If set, will be multiplied by normalized 'shininess' value and/or vertex colors.
     * @property {Number} glossMapUv Gloss map UV channel
     * @property {String} glossMapChannel Color channel of the gloss map to use. Can be "r", "g", "b" or "a".
     * @property {pc.Vec2} glossMapTiling Controls the 2D tiling of the gloss map.
     * @property {pc.Vec2} glossMapOffset Controls the 2D offset of the gloss map. Each component is between 0 and 1.
     * @property {Boolean} glossVertexColor Use mesh vertex colors for glossiness. If glossMap is set, it'll be multiplied by vertex colors.
     * @property {String} glossVertexColorChannel Vertex color channel to use for glossiness. Can be "r", "g", "b" or "a".
     *
     * @property {Number} refraction Defines the visibility of refraction. Material can refract the same cube map as used for reflections.
     * @property {Number} refractionIndex Defines the index of refraction, i.e. the amount of distortion.
     * The value is calculated as (outerIor / surfaceIor), where inputs are measured indices of refraction, the one around the object and the one of it's own surface.
     * In most situations outer medium is air, so outerIor will be approximately 1. Then you only need to do (1.0 / surfaceIor).
     *
     * @property {pc.Color} emissive The emissive color of the material. This color value is 3-component (RGB),
     * where each component is between 0 and 1.
     * @property {Boolean} emissiveTint Multiply emissive map and/or emissive vertex color by the constant emissive value.
     * @property {pc.Texture} emissiveMap The emissive map of the material. Can be HDR.
     * @property {Number} emissiveIntensity Emissive color multiplier.
     * @property {Number} emissiveMapUv Emissive map UV channel.
     * @property {pc.Vec2} emissiveMapTiling Controls the 2D tiling of the emissive map.
     * @property {pc.Vec2} emissiveMapOffset Controls the 2D offset of the emissive map. Each component is between 0 and 1.
     * @property {String} emissiveMapChannel Color channels of the emissive map to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     * @property {Boolean} emissiveVertexColor Use mesh vertex colors for emission. If emissiveMap or emissiveTint are set, they'll be multiplied by vertex colors.
     * @property {String} emissiveVertexColorChannel Vertex color channels to use for emission. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     *
     * @property {Number} opacity The opacity of the material. This value can be between 0 and 1, where 0 is fully
     * transparent and 1 is fully opaque. If you want the material to be semi-transparent you also need to
     * set the {@link pc.Material#blendType} to pc.BLEND_NORMAL, pc.BLEND_ADDITIVE or any other mode.
     * Also note that for most semi-transparent objects you want {@link pc.Material#depthWrite} to be false, otherwise they can fully occlude objects behind them.
     * @property {pc.Texture} opacityMap The opacity map of the material.
     * @property {Number} opacityMapUv Opacity map UV channel
     * @property {String} opacityMapChannel Color channel of the opacity map to use. Can be "r", "g", "b" or "a".
     * @property {pc.Vec2} opacityMapTiling Controls the 2D tiling of the opacity map.
     * @property {pc.Vec2} opacityMapOffset Controls the 2D offset of the opacity map. Each component is between 0 and 1.
     * @property {Boolean} opacityVertexColor Use mesh vertex colors for opacity. If opacityMap is set, it'll be multiplied by vertex colors.
     * @property {String} opacityVertexColorChannel Vertex color channels to use for opacity. Can be "r", "g", "b" or "a".
     *
     * @property {pc.Texture} normalMap The normal map of the material.
     * The texture must contains normalized, tangent space normals.
     * @property {Number} normalMapUv Normal map UV channel
     * @property {pc.Vec2} normalMapTiling Controls the 2D tiling of the normal map.
     * @property {pc.Vec2} normalMapOffset Controls the 2D offset of the normal map. Each component is between 0 and 1.
     * @property {Number} bumpiness The bumpiness of the material. This value scales the assigned normal map.
     * It should be normally between 0 (no bump mapping) and 1 (full bump mapping), but can be set to e.g. 2 to give even more pronounced bump effect.
     *
     * @property {pc.Texture} heightMap The height map of the material. Used for a view-dependent parallax effect.
     * The texture must represent the height of the surface where darker pixels are lower and lighter pixels are higher.
     * It is recommended to use it together with a normal map.
     * @property {Number} heightMapUv Height map UV channel
     * @property {String} heightMapChannel Color channel of the height map to use. Can be "r", "g", "b" or "a".
     * @property {pc.Vec2} heightMapTiling Controls the 2D tiling of the height map.
     * @property {pc.Vec2} heightMapOffset Controls the 2D offset of the height map. Each component is between 0 and 1.
     * @property {Number} heightMapFactor Height map multiplier. Affects the strength of the parallax effect.
     *
     * @property {pc.Texture} sphereMap The spherical environment map of the material. Affects reflections.
     * @property {pc.Texture} cubeMap The cubic environment map of the material. Overrides sphereMap. Affects reflections. If cubemap is prefiltered, will also affect ambient color.
     * @property {Number} cubeMapProjection The type of projection applied to the cubeMap property:
     * <ul>
     *     <li>{@link pc.CUBEPROJ_NONE}: The cube map is treated as if it is infinitely far away.</li>
     *     <li>{@link pc.CUBEPROJ_BOX}: Box-projection based on a world space axis-aligned bounding box.</li>
     * </ul>
     * Defaults to pc.CUBEPROJ_NONE.
     * @property {pc.BoundingBox} cubeMapProjectionBox The world space axis-aligned bounding box defining the
     * box-projection used for the cubeMap property. Only used when cubeMapProjection is set to pc.CUBEPROJ_BOX.
     * @property {Number} reflectivity Environment map intensity.
     *
     * @property {pc.Texture} lightMap A custom lightmap of the material. Lightmaps are textures that contain pre-rendered lighting. Can be HDR.
     * @property {Number} lightMapUv Lightmap UV channel
     * @property {String} lightMapChannel Color channels of the lightmap to use. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     * @property {pc.Vec2} lightMapTiling Controls the 2D tiling of the lightmap.
     * @property {pc.Vec2} lightMapOffset Controls the 2D offset of the lightmap. Each component is between 0 and 1.
     * @property {Boolean} lightVertexColor Use baked vertex lighting. If lightMap is set, it'll be multiplied by vertex colors.
     * @property {String} lightVertexColorChannel Vertex color channels to use for baked lighting. Can be "r", "g", "b", "a", "rgb" or any swizzled combination.
     *
     * @property {Boolean} ambientTint Enables scene ambient multiplication by material ambient color.
     * @property {pc.Texture} aoMap Baked ambient occlusion (AO) map. Modulates ambient color.
     * @property {Number} aoMapUv AO map UV channel
     * @property {String} aoMapChannel Color channel of the AO map to use. Can be "r", "g", "b" or "a".
     * @property {pc.Vec2} aoMapTiling Controls the 2D tiling of the AO map.
     * @property {pc.Vec2} aoMapOffset Controls the 2D offset of the AO map. Each component is between 0 and 1.
     * @property {Boolean} aoVertexColor Use mesh vertex colors for AO. If aoMap is set, it'll be multiplied by vertex colors.
     * @property {String} aoVertexColorChannel Vertex color channels to use for AO. Can be "r", "g", "b" or "a".
     * @property {Number} occludeSpecular Uses ambient occlusion to darken specular/reflection. It's a hack, because real specular occlusion is view-dependent. However, it can be better than nothing.
     * <ul>
     *     <li>{@link pc.SPECOCC_NONE}: No specular occlusion</li>
     *     <li>{@link pc.SPECOCC_AO}: Use AO directly to occlude specular.</li>
     *     <li>{@link pc.SPECOCC_GLOSSDEPENDENT}: Modify AO based on material glossiness/view angle to occlude specular.</li>
     * </ul>
     * @property {Number} occludeSpecularIntensity Controls visibility of specular occlusion.
     * @property {Number} occludeDirect Tells if AO should darken directional lighting.
     *
     * @property {Boolean} specularAntialias Enables Toksvig AA for mipmapped normal maps with specular.
     * @property {Boolean} conserveEnergy Defines how diffuse and specular components are combined when Fresnel is on.
     * It is recommended that you leave this option enabled, although you may want to disable it in case when all reflection comes only from a few light sources, and you don't use an environment map, therefore having mostly black reflection.
     * @property {Number} shadingModel Defines the shading model.
     * <ul>
     *     <li>{@link pc.SPECULAR_PHONG}: Phong without energy conservation. You should only use it as a backwards compatibility with older projects.</li>
     *     <li>{@link pc.SPECULAR_BLINN}: Energy-conserving Blinn-Phong.</li>
     * </ul>
     * @property {Number} fresnelModel Defines the formula used for Fresnel effect.
     * As a side-effect, enabling any Fresnel model changes the way diffuse and reflection components are combined.
     * When Fresnel is off, legacy non energy-conserving combining is used. When it is on, combining behaviour is defined by conserveEnergy parameter.
     * <ul>
     *     <li>{@link pc.FRESNEL_NONE}: No Fresnel.</li>
     *     <li>{@link pc.FRESNEL_SCHLICK}: Schlick's approximation of Fresnel (recommended). Parameterized by specular color.</li>
     * </ul>
     * @property {Boolean} useFog Apply fogging (as configured in scene settings)
     * @property {Boolean} useLighting Apply lighting
     * @property {Boolean} useSkybox Apply scene skybox as prefiltered environment map
     * @property {Boolean} useGammaTonemap Apply gamma correction and tonemapping (as configured in scene settings)
     * @property {Boolean} pixelSnap Align vertices to pixel co-ordinates when rendering. Useful for pixel perfect 2D graphics
     * @property {Boolean} twoSidedLighting Calculate proper normals (and therefore lighting) on backfaces
     *
     * @property {Function} onUpdateShader A custom function that will be called after all shader generator properties are collected and before shader code is generated.
     * This function will receive an object with shader generator settings (based on current material and scene properties), that you can change and then return.
     * Returned value will be used instead. This is mostly useful when rendering the same set of objects, but with different shader variations based on the same material.
     * For example, you may wish to render a depth or normal pass using textures assigned to the material, a reflection pass with simpler shaders and so on.
     * Properties of the object passed into this function are:
     * <ul>
     *     <li>pass: value of {@link pc.Layer#shaderPass} of the Layer being rendered.</li>
     *     <li>chunks: Object containing custom shader chunks that will replace default ones.</li>
     *     <li>customFragmentShader: Completely replace fragment shader with this code.</li>
     *     <li>forceUv1: if UV1 (second set of texture coordinates) is required in the shader. Will be declared as "vUv1" and passed to the fragment shader.</li>
     *     <li>fog: the type of fog being applied in the shader. See {@link pc.Scene#fog} for the list of possible values.</li>
     *     <li>gamma: the type of gamma correction being applied in the shader. See {@link pc.Scene#gammaCorrection} for the list of possible values.</li>
     *     <li>toneMap: the type of tone mapping being applied in the shader. See {@link pc.Scene#toneMapping} for the list of possible values.</li>
     *     <li>ambientTint: the value of {@link pc.StandardMaterial#ambientTint}.</li>
     *     <li>specularAntialias: the value of {@link pc.StandardMaterial#specularAntialias}.</li>
     *     <li>conserveEnergy: the value of {@link pc.StandardMaterial#conserveEnergy}.</li>
     *     <li>occludeSpecular: the value of {@link pc.StandardMaterial#occludeSpecular}.</li>
     *     <li>occludeDirect: the value of {@link pc.StandardMaterial#occludeDirect}.</li>
     *     <li>shadingModel: the value of {@link pc.StandardMaterial#shadingModel}.</li>
     *     <li>fresnelModel: the value of {@link pc.StandardMaterial#fresnelModel}.</li>
     *     <li>cubeMapProjection: the value of {@link pc.StandardMaterial#cubeMapProjection}.</li>
     *     <li>useMetalness: the value of {@link pc.StandardMaterial#useMetalness}.</li>
     *     <li>blendType: the value of {@link pc.Material#blendType}.</li>
     *     <li>twoSidedLighting: the value of {@link pc.Material#twoSidedLighting}.</li>
     *     <li>diffuseTint: defines if {@link pc.StandardMaterial#diffuse} constant should affect diffuse color.</li>
     *     <li>specularTint: defines if {@link pc.StandardMaterial#specular} constant should affect specular color.</li>
     *     <li>metalnessTint: defines if {@link pc.StandardMaterial#metalness} constant should affect metalness value.</li>
     *     <li>glossTint: defines if {@link pc.StandardMaterial#shininess} constant should affect glossiness value.</li>
     *     <li>emissiveTint: defines if {@link pc.StandardMaterial#emissive} constant should affect emission value.</li>
     *     <li>opacityTint: defines if {@link pc.StandardMaterial#opacity} constant should affect opacity value.</li>
     *     <li>occludeSpecularFloat: defines if {@link pc.StandardMaterial#occludeSpecularIntensity} constant should affect specular occlusion.</li>
     *     <li>alphaTest: enable alpha testing. See {@link pc.Material#alphaTest}.</li>
     *     <li>alphaToCoverage: enable alpha to coverage. See {@link pc.Material#alphaToCoverage}.</li>
     *     <li>sphereMap: if {@link pc.StandardMaterial#sphereMap} is used.</li>
     *     <li>cubeMap: if {@link pc.StandardMaterial#cubeMap} is used.</li>
     *     <li>dpAtlas: if dual-paraboloid reflection is used. Dual paraboloid reflections replace prefiltered cubemaps on certain platform (mostly Android) for performance reasons.</li>
     *     <li>ambientSH: if ambient spherical harmonics are used. Ambient SH replace prefiltered cubemap ambient on certain platform (mostly Android) for performance reasons.</li>
     *     <li>useSpecular: if any specular or reflections are needed at all.</li>
     *     <li>rgbmAmbient: if ambient cubemap or spherical harmonics are RGBM-encoded.</li>
     *     <li>hdrAmbient: if ambient cubemap or spherical harmonics are plain float HDR data.</li>
     *     <li>rgbmReflection: if reflection cubemap or dual paraboloid are RGBM-encoded.</li>
     *     <li>hdrReflection: if reflection cubemap or dual paraboloid are plain float HDR data.</li>
     *     <li>fixSeams: if cubemaps require seam fixing (see {@link pc.Texture#options.fixCubemapSeams}).</li>
     *     <li>prefilteredCubemap: if prefiltered cubemaps are used.</li>
     *     <li>emissiveFormat: how emissiveMap must be sampled. This value is based on {@link pc.Texture#options.rgbm} and {@link pc.Texture#options.format}. Possible values are:</li>
     *     <ul>
     *          <li>0: sRGB texture</li>
     *          <li>1: RGBM-encoded HDR texture</li>
     *          <li>2: Simple read (no conversion from sRGB)</li>
     *     </ul>
     *     <li>lightMapFormat: how lightMap must be sampled. This value is based on {@link pc.Texture#options.rgbm} and {@link pc.Texture#options.format}. Possible values are:</li>
     *     <ul>
     *          <li>0: sRGB texture</li>
     *          <li>1: RGBM-encoded HDR texture</li>
     *          <li>2: Simple read (no conversion from sRGB)</li>
     *     </ul>
     *     <li>useRgbm: if decodeRGBM() function is needed in the shader at all.</li>
     *     <li>packedNormal: if normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.</li>
     *     <li>forceFragmentPrecision: Override fragment shader numeric precision. Can be "lowp", "mediump", "highp" or null to use default.</li>
     *     <li>fastTbn: Use slightly cheaper normal mapping code (skip tangent space normalization). Can look buggy sometimes.</li>
     *     <li>refraction: if refraction is used.</li>
     *     <li>skyboxIntensity: if reflected skybox intensity should be modulated.</li>
     *     <li>useTexCubeLod: if textureCubeLodEXT function should be used to read prefiltered cubemaps. Usually true of iOS, false on other devices due to quality/performance balance.</li>
     * </ul>
     *
     * @example
     * // Create a new Standard material
     * var material = new pc.StandardMaterial();
     *
     * // Update the material's diffuse and specular properties
     * material.diffuse.set(1, 0, 0);
     * material.specular.set(1, 1, 1);
     *
     * // Notify the material that it has been modified
     * material.update();
     *
     * @extends pc.Material
     */

    var StandardMaterial = function () {
        pc.Material.call(this);

        // storage for texture and cubemap asset references
        this._assetReferences = {};
        this._validator = null;

        this.shaderOptBuilder = new pc.StandardMaterialOptionsBuilder();

        this.reset();
    };
    StandardMaterial.prototype = Object.create(pc.Material.prototype);
    StandardMaterial.prototype.constructor = StandardMaterial;

    var _propsSerial = [];
    var _propsSerialDefaultVal = [];
    var _propsInternalNull = [];
    var _propsInternalVec3 = [];
    var _prop2Uniform = {};

    var _defineTex2D = function (obj, name, uv, channels, defChannel) {
        var privMap = "_" + name + "Map";
        var privMapTiling = privMap + "Tiling";
        var privMapOffset = privMap + "Offset";
        var mapTransform = privMap.substring(1) + "Transform";
        var mapTransformUniform = mapTransform + "Uniform";
        var privMapUv = privMap + "Uv";
        var privMapChannel = privMap + "Channel";
        var privMapVertexColor = "_" + name + "VertexColor";
        var privMapVertexColorChannel = "_" + name + "VertexColorChannel";

        obj[privMap] = null;
        obj[privMapTiling] = new pc.Vec2(1, 1);
        obj[privMapOffset] = new pc.Vec2(0, 0);
        obj[mapTransform] = null;
        obj[mapTransformUniform] = null;
        obj[privMapUv] = uv;
        if (channels > 0) {
            var channel = defChannel ? defChannel : (channels > 1 ? "rgb" : "g");
            obj[privMapChannel] = channel;
            obj[privMapVertexColorChannel] = channel;
        }
        obj[privMapVertexColor] = false;

        if (!pc._matTex2D) pc._matTex2D = [];
        pc._matTex2D[name] = channels;

        Object.defineProperty(StandardMaterial.prototype, privMap.substring(1), {
            get: function () {
                return this[privMap];
            },
            set: function (value) {
                var oldVal = this[privMap];
                if (!!oldVal ^ !!value) this.dirtyShader = true;
                if (oldVal && value) {
                    if (oldVal.rgbm !== value.rgbm || oldVal.fixCubemapSeams !== value.fixCubemapSeams || oldVal.format !== value.format) {
                        this.dirtyShader = true;
                    }
                }

                this[privMap] = value;
            }
        });

        var mapTiling = privMapTiling.substring(1);
        var mapOffset = privMapOffset.substring(1);

        Object.defineProperty(StandardMaterial.prototype, mapTiling, {
            get: function () {
                return this[privMapTiling];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapTiling] = value;
            }
        });
        _prop2Uniform[mapTiling] = function (mat, val, changeMat) {
            var tform = mat._updateMapTransform(
                changeMat ? mat[mapTransform] : null,
                val,
                mat[privMapOffset]
            );
            return { name: ("texture_" + mapTransform), value: tform.data };
        };


        Object.defineProperty(StandardMaterial.prototype, mapOffset, {
            get: function () {
                return this[privMapOffset];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapOffset] = value;
            }
        });
        _prop2Uniform[mapOffset] = function (mat, val, changeMat) {
            var tform = mat._updateMapTransform(
                changeMat ? mat[mapTransform] : null,
                mat[privMapTiling],
                val
            );
            return { name: ("texture_" + mapTransform), value: tform.data };
        };


        Object.defineProperty(StandardMaterial.prototype, privMapUv.substring(1), {
            get: function () {
                return this[privMapUv];
            },
            set: function (value) {
                if (this[privMapUv] !== value) this.dirtyShader = true;
                this[privMapUv] = value;
            }
        });
        Object.defineProperty(StandardMaterial.prototype, privMapChannel.substring(1), {
            get: function () {
                return this[privMapChannel];
            },
            set: function (value) {
                if (this[privMapChannel] !== value) this.dirtyShader = true;
                this[privMapChannel] = value;
            }
        });
        Object.defineProperty(StandardMaterial.prototype, privMapVertexColor.substring(1), {
            get: function () {
                return this[privMapVertexColor];
            },
            set: function (value) {
                this.dirtyShader = true;
                this[privMapVertexColor] = value;
            }
        });
        Object.defineProperty(StandardMaterial.prototype, privMapVertexColorChannel.substring(1), {
            get: function () {
                return this[privMapVertexColorChannel];
            },
            set: function (value) {
                if (this[privMapVertexColorChannel] !== value) this.dirtyShader = true;
                this[privMapVertexColorChannel] = value;
            }
        });

        _propsSerial.push(privMap.substring(1));
        _propsSerial.push(privMapTiling.substring(1));
        _propsSerial.push(privMapOffset.substring(1));
        _propsSerial.push(privMapUv.substring(1));
        _propsSerial.push(privMapChannel.substring(1));
        _propsSerial.push(privMapVertexColor.substring(1));
        _propsSerial.push(privMapVertexColorChannel.substring(1));
        _propsInternalNull.push(mapTransform);
    };

    var _propsColor = [];
    var _defineColor = function (obj, name, defaultValue, hasMultiplier) {
        var priv = "_" + name;
        var uform = name + "Uniform";
        var mult = name + "Intensity";
        var pmult = "_" + mult;
        obj[priv] = defaultValue;
        obj[uform] = new Float32Array(3);
        Object.defineProperty(StandardMaterial.prototype, name, {
            get: function () {
                this.dirtyColor = true;
                this.dirtyShader = true;
                return this[priv];
            },
            set: function (newValue) {
                var oldValue = this[priv];
                var wasRound = (oldValue.r === 0 && oldValue.g === 0 && oldValue.b === 0) || (oldValue.r === 1 && oldValue.g === 1 && oldValue.b === 1);
                var isRound = (newValue.r === 0 && newValue.g === 0 && newValue.b === 0) || (newValue.r === 1 && newValue.g === 1 && newValue.b === 1);
                if (wasRound ^ isRound) this.dirtyShader = true;
                this.dirtyColor = true;
                this[priv] = newValue;
            }
        });
        _propsSerial.push(name);
        _propsInternalVec3.push(uform);
        _propsColor.push(name);
        _prop2Uniform[name] = function (mat, val, changeMat) {
            var arr = changeMat ? mat[uform] : new Float32Array(3);
            var gammaCorrection = false;
            if (mat.useGammaTonemap) {
                var scene = mat._scene || pc.Application.getApplication().scene;
                gammaCorrection = scene.gammaCorrection;
            }
            for (var c = 0; c < 3; c++) {
                if (gammaCorrection) {
                    arr[c] = Math.pow(val.data[c], 2.2);
                } else {
                    arr[c] = val.data[c];
                }
                if (hasMultiplier) arr[c] *= mat[pmult];
            }
            return { name: ("material_" + name), value: arr };
        };

        if (hasMultiplier) {
            obj[pmult] = 1;
            Object.defineProperty(StandardMaterial.prototype, mult, {
                get: function () {
                    return this[pmult];
                },
                set: function (newValue) {
                    var oldValue = this[pmult];
                    var wasRound = oldValue === 0 || oldValue === 1;
                    var isRound = newValue === 0 || newValue === 1;
                    if (wasRound ^ isRound) this.dirtyShader = true;
                    this.dirtyColor = true;
                    this[pmult] = newValue;
                }
            });
            _propsSerial.push(mult);
            _prop2Uniform[mult] = function (mat, val, changeMat) {
                var arr = changeMat ? mat[uform] : new Float32Array(3);
                var gammaCorrection = false;
                if (mat.useGammaTonemap) {
                    var scene = mat._scene || pc.Application.getApplication().scene;
                    gammaCorrection = scene.gammaCorrection;
                }
                for (var c = 0; c < 3; c++) {
                    if (gammaCorrection) {
                        arr[c] = Math.pow(mat[priv].data[c], 2.2);
                    } else {
                        arr[c] = mat[priv].data[c];
                    }
                    arr[c] *= mat[pmult];
                }
                return { name: ("material_" + name), value: arr };
            };
        }
    };

    var _defineFloat = function (obj, name, defaultValue, func) {
        var priv = "_" + name;
        obj[priv] = defaultValue;
        Object.defineProperty(StandardMaterial.prototype, name, {
            get: function () {
                return this[priv];
            },
            set: function (newValue) {
                var oldValue = this[priv];
                if (oldValue === newValue) return;
                this[priv] = newValue;

                // This is not always optimal and will sometimes trigger redundant shader
                // recompilation. However, no number property on a standard material
                // triggers a shader recompile if the previous and current values both
                // have a fractional part.
                var wasRound = oldValue === 0 || oldValue === 1;
                var isRound = newValue === 0 || newValue === 1;
                if (wasRound || isRound) this.dirtyShader = true;
            }
        });
        _propsSerial.push(name);
        _prop2Uniform[name] = func !== undefined ? func : function (mat, val, changeMat) {
            return {
                name: "material_" + name,
                value: val
            };
        };
    };

    var _defineObject = function (obj, name, func) {
        var priv = "_" + name;
        obj[priv] = null;
        Object.defineProperty(StandardMaterial.prototype, name, {
            get: function () {
                return this[priv];
            },
            set: function (value) {
                var oldVal = this[priv];
                if (!!oldVal ^ !!value) this.dirtyShader = true;
                this[priv] = value;
            }
        });
        _propsSerial.push(name);
        _prop2Uniform[name] = func;
    };

    var _defineAlias = function (obj, newName, oldName) {
        Object.defineProperty(StandardMaterial.prototype, oldName, {
            get: function () {
                return this[newName];
            },
            set: function (value) {
                this[newName] = value;
            }
        });
    };

    var _defineChunks = function (obj) {
        Object.defineProperty(StandardMaterial.prototype, "chunks", {
            get: function () {
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
        Object.defineProperty(StandardMaterial.prototype, name, {
            get: function () {
                return this[priv];
            },
            set: function (value) {
                if (this[priv] !== value) this.dirtyShader = true;
                this[priv] = value;
            }
        });
        _propsSerial.push(name);
    };

    var Chunks = function () { };
    Chunks.prototype.copy = function (from) {
        for (var p in from) {
            if (from.hasOwnProperty(p) && p !== 'copy')
                this[p] = from[p];
        }
    };

    Object.assign(StandardMaterial.prototype, {

        reset: function () {
            var i;
            for (i = 0; i < _propsSerial.length; i++) {
                var defVal = _propsSerialDefaultVal[i];
                this[_propsSerial[i]] = defVal ? (defVal.clone ? defVal.clone() : defVal) : defVal;
            }
            for (i = 0; i < _propsInternalNull.length; i++) {
                this[_propsInternalNull[i]] = null;
            }
            for (i = 0; i < _propsInternalVec3.length; i++) {
                this[_propsInternalVec3[i]] = new Float32Array(3);
            }

            this._chunks = new Chunks();

            this.cubeMapMinUniform = new Float32Array(3);
            this.cubeMapMaxUniform = new Float32Array(3);
        },


        /**
         * @function
         * @name pc.StandardMaterial#clone
         * @description Duplicates a Standard material. All properties are duplicated except textures
         * where only the references are copied.
         * @returns {pc.StandardMaterial} A cloned Standard material.
         */
        clone: function () {
            var clone = new pc.StandardMaterial();
            pc.Material.prototype._cloneInternal.call(this, clone);

            var pname;
            for (var i = 0; i < _propsSerial.length; i++) {
                pname = _propsSerial[i];
                if (this[pname] !== undefined) {
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

            return clone;
        },

        _updateMapTransform: function (transform, tiling, offset) {
            transform = transform || new pc.Vec4();
            transform.set(tiling.x, tiling.y, offset.x, offset.y);

            if ((transform.x === 1) && (transform.y === 1) && (transform.z === 0) && (transform.w === 0)) return null;
            return transform;
        },

        _setParameter: function (name, value) {
            if (!this.parameters[name])
                this._propsSet.push(name);
            this.setParameter(name, value);
        },

        _clearParameters: function () {
            var props = this._propsSet;
            for (var i = 0; i < props.length; i++) {
                delete this.parameters[props[i]];
            }
            this._propsSet = [];
        },

        _updateMap: function (p) {
            var mname = p + "Map";
            if (this[mname]) {
                this._setParameter("texture_" + mname, this[mname]);
                var tname = mname + "Transform";
                var uname = mname + "TransformUniform";
                if (!this[tname]) {
                    this[uname] = new Float32Array(4);
                }
                this[tname] = this._updateMapTransform(
                    this[tname],
                    this[mname + "Tiling"],
                    this[mname + "Offset"]
                );

                if (this[tname]) {
                    this[uname][0] = this[tname].x;
                    this[uname][1] = this[tname].y;
                    this[uname][2] = this[tname].z;
                    this[uname][3] = this[tname].w;
                    this._setParameter('texture_' + tname, this[uname]);
                }
            }
        },

        getUniform: function (varName, value, changeMat) {
            var func = _prop2Uniform[varName];
            if (func) {
                return func(this, value, changeMat);
            }
            return null;
        },

        updateUniforms: function () {
            var uniform;
            this._clearParameters();

            this._setParameter('material_ambient', this.ambientUniform);

            if (!this.diffuseMap || this.diffuseTint) {
                this._setParameter('material_diffuse', this.diffuseUniform);
            }

            if (!this.useMetalness) {
                if (!this.specularMap || this.specularTint) {
                    this._setParameter('material_specular', this.specularUniform);
                }
            } else {
                if (!this.metalnessMap || this.metalness < 1) {
                    this._setParameter('material_metalness', this.metalness);
                }
            }

            uniform = this.getUniform("shininess", this.shininess, true);
            this._setParameter(uniform.name, uniform.value);

            if (!this.emissiveMap || this.emissiveTint) {
                this._setParameter('material_emissive', this.emissiveUniform);
            }
            if (this.emissiveMap) {
                this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
            }

            if (this.refraction > 0) {
                this._setParameter('material_refraction', this.refraction);
                this._setParameter('material_refractionIndex', this.refractionIndex);
            }

            this._setParameter('material_opacity', this.opacity);

            if (this.occludeSpecular) {
                this._setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
            }

            if (this.cubeMapProjection === pc.CUBEPROJ_BOX) {
                this._setParameter(this.getUniform("cubeMapProjectionBox", this.cubeMapProjectionBox, true));
            }

            for (var p in pc._matTex2D) {
                this._updateMap(p);
            }

            if (this.ambientSH) {
                this._setParameter('ambientSH[0]', this.ambientSH);
            }

            if (this.normalMap) {
                this._setParameter('material_bumpiness', this.bumpiness);
            }

            if (this.heightMap) {
                uniform = this.getUniform('heightMapFactor', this.heightMapFactor, true);
                this._setParameter(uniform.name, uniform.value);
            }

            if (this.cubeMap) {
                this._setParameter('texture_cubeMap', this.cubeMap);
            }

            if (this.prefilteredCubeMap128) {
                this._setParameter('texture_prefilteredCubeMap128', this.prefilteredCubeMap128);
            } else if (this._scene && this._scene._skyboxPrefiltered[0]) {
                this._setParameter('texture_prefilteredCubeMap128', this._scene._skyboxPrefiltered[0]);
            }

            if (this.prefilteredCubeMap64) {
                this._setParameter('texture_prefilteredCubeMap64', this.prefilteredCubeMap64);
            } else if (this._scene && this._scene._skyboxPrefiltered[1]) {
                this._setParameter('texture_prefilteredCubeMap64', this._scene._skyboxPrefiltered[1]);
            }

            if (this.prefilteredCubeMap32) {
                this._setParameter('texture_prefilteredCubeMap32', this.prefilteredCubeMap32);
            } else if (this._scene && this._scene._skyboxPrefiltered[2]) {
                this._setParameter('texture_prefilteredCubeMap32', this._scene._skyboxPrefiltered[2]);
            }

            if (this.prefilteredCubeMap16) {
                this._setParameter('texture_prefilteredCubeMap16', this.prefilteredCubeMap16);
            } else if (this._scene && this._scene._skyboxPrefiltered[3]) {
                this._setParameter('texture_prefilteredCubeMap16', this._scene._skyboxPrefiltered[3]);
            }

            if (this.prefilteredCubeMap8) {
                this._setParameter('texture_prefilteredCubeMap8', this.prefilteredCubeMap8);
            } else if (this._scene && this._scene._skyboxPrefiltered[4]) {
                this._setParameter('texture_prefilteredCubeMap8', this._scene._skyboxPrefiltered[4]);
            }

            if (this.prefilteredCubeMap4) {
                this._setParameter('texture_prefilteredCubeMap4', this.prefilteredCubeMap4);
            } else if (this._scene && this._scene._skyboxPrefiltered[5]) {
                this._setParameter('texture_prefilteredCubeMap4', this._scene._skyboxPrefiltered[5]);
            }

            if (this.sphereMap) {
                this._setParameter('texture_sphereMap', this.sphereMap);
            }
            if (this.dpAtlas) {
                this._setParameter('texture_sphereMap', this.dpAtlas);
            }
            // if (this.sphereMap || this.cubeMap || this.prefilteredCubeMap128) {
            this._setParameter('material_reflectivity', this.reflectivity);
            // }

            if (this.dirtyShader || !this._scene) {
                this.shader = null;
                this.clearVariants();
            }

            this._processColor();
        },

        _processColor: function () {
            var c, i;
            if (!this.dirtyColor) return;
            if (!this._scene && this.useGammaTonemap) return;
            var gammaCorrection = false;
            if (this.useGammaTonemap) gammaCorrection = this._scene.gammaCorrection;

            // Gamma correct colors
            for (i = 0; i < _propsColor.length; i++) {
                var clr = this["_" + _propsColor[i]];
                var arr = this[_propsColor[i] + "Uniform"];
                if (gammaCorrection) {
                    arr[0] = Math.pow(clr.r, 2.2);
                    arr[1] = Math.pow(clr.g, 2.2);
                    arr[2] = Math.pow(clr.b, 2.2);
                } else {
                    arr[0] = clr.r;
                    arr[1] = clr.g;
                    arr[2] = clr.b;
                }
            }
            for (c = 0; c < 3; c++) {
                this.emissiveUniform[c] *= this.emissiveIntensity;
            }
            this.dirtyColor = false;
        },

        updateShader: function (device, scene, objDefs, staticLightList, pass, sortedLights) {

            if (!this._colorProcessed && this._scene) {
                this._colorProcessed = true;
                this._processColor();
            }

            var useTexCubeLod = device.useTexCubeLod;
            var useDp = !device.extTextureLod; // no basic extension? likely slow device, force dp

            var globalSky128, globalSky64, globalSky32, globalSky16, globalSky8, globalSky4;
            if (this.useSkybox) {
                globalSky128 = scene._skyboxPrefiltered[0];
                globalSky64 = scene._skyboxPrefiltered[1];
                globalSky32 = scene._skyboxPrefiltered[2];
                globalSky16 = scene._skyboxPrefiltered[3];
                globalSky8 = scene._skyboxPrefiltered[4];
                globalSky4 = scene._skyboxPrefiltered[5];
            }

            var prefilteredCubeMap128 = this.prefilteredCubeMap128 || globalSky128;
            var prefilteredCubeMap64 = this.prefilteredCubeMap64 || globalSky64;
            var prefilteredCubeMap32 = this.prefilteredCubeMap32 || globalSky32;
            var prefilteredCubeMap16 = this.prefilteredCubeMap16 || globalSky16;
            var prefilteredCubeMap8 = this.prefilteredCubeMap8 || globalSky8;
            var prefilteredCubeMap4 = this.prefilteredCubeMap4 || globalSky4;

            if (prefilteredCubeMap128) {
                var allMips = prefilteredCubeMap128 &&
                              prefilteredCubeMap64 &&
                              prefilteredCubeMap32 &&
                              prefilteredCubeMap16 &&
                              prefilteredCubeMap8 &&
                              prefilteredCubeMap4;

                if (useDp && allMips) {
                    if (!prefilteredCubeMap128.dpAtlas) {
                        var atlas = [prefilteredCubeMap128, prefilteredCubeMap64, prefilteredCubeMap32,
                            prefilteredCubeMap16, prefilteredCubeMap8, prefilteredCubeMap4];
                        prefilteredCubeMap128.dpAtlas = pc.generateDpAtlas(device, atlas);
                        prefilteredCubeMap128.sh = pc.shFromCubemap(prefilteredCubeMap16);
                    }
                    this.dpAtlas = prefilteredCubeMap128.dpAtlas;
                    this.ambientSH = prefilteredCubeMap128.sh;
                    this._setParameter('ambientSH[0]', this.ambientSH);
                    this._setParameter('texture_sphereMap', this.dpAtlas);
                } else if (useTexCubeLod) {
                    if (prefilteredCubeMap128._levels.length < 6) {
                        if (allMips) {
                            // Multiple -> single (provided cubemap per mip, but can use texCubeLod)
                            this._setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                        } else {
                            console.log("Can't use prefiltered cubemap: " + allMips + ", " + useTexCubeLod + ", " + prefilteredCubeMap128._levels);
                        }
                    } else {
                        // Single (able to use single cubemap with texCubeLod)
                        this._setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                    }
                } else if (allMips) {
                    // Multiple (no texCubeLod, but able to use cubemap per mip)
                    this._setParameter('texture_prefilteredCubeMap128', prefilteredCubeMap128);
                    this._setParameter('texture_prefilteredCubeMap64', prefilteredCubeMap64);
                    this._setParameter('texture_prefilteredCubeMap32', prefilteredCubeMap32);
                    this._setParameter('texture_prefilteredCubeMap16', prefilteredCubeMap16);
                    this._setParameter('texture_prefilteredCubeMap8', prefilteredCubeMap8);
                    this._setParameter('texture_prefilteredCubeMap4', prefilteredCubeMap4);
                } else {
                    console.log("Can't use prefiltered cubemap: " + allMips + ", " + useTexCubeLod + ", " + prefilteredCubeMap128._levels);
                }
            }

            var generator = pc.programlib.standard;
            // Minimal options for Depth and Shadow passes
            var minimalOptions = pass > pc.SHADER_FORWARDHDR && pass <= pc.SHADER_PICK;
            var options = minimalOptions ? generator.optionsContextMin : generator.optionsContext;

            if (minimalOptions)
                this.shaderOptBuilder.updateMinRef(options, device, scene, this, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128);
            else
                this.shaderOptBuilder.updateRef(options, device, scene, this, objDefs, staticLightList, pass, sortedLights, prefilteredCubeMap128);

            if (this.onUpdateShader) {
                options = this.onUpdateShader(options);
            }

            var library = device.getProgramLibrary();
            this.shader = library.getProgram('standard', options);

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
        obj._colorProcessed = false;

        _defineColor(obj, "ambient", new pc.Color(0.7, 0.7, 0.7));
        _defineColor(obj, "diffuse", new pc.Color(1, 1, 1));
        _defineColor(obj, "specular", new pc.Color(0, 0, 0));
        _defineColor(obj, "emissive", new pc.Color(0, 0, 0), true);

        _defineFloat(obj, "shininess", 25, function (mat, shininess) {
            // Shininess is 0-100 value
            // which is actually a 0-1 glosiness value.
            // Can be converted to specular power using exp2(shininess * 0.01 * 11)
            var value;
            if (mat.shadingModel === pc.SPECULAR_PHONG) {
                value = Math.pow(2, shininess * 0.01 * 11); // legacy: expand back to specular power
            } else {
                value = shininess * 0.01; // correct
            }
            return { name: "material_shininess", value: value };
        });
        _defineFloat(obj, "heightMapFactor", 1, function (mat, height) {
            return { name: 'material_heightMapFactor', value: height * 0.025 };
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
            return { name: "ambientSH[0]", value: val };
        });

        _defineObject(obj, "cubeMapProjectionBox", function (mat, val, changeMat) {
            var bmin = changeMat ? mat.cubeMapMinUniform : new Float32Array(3);
            var bmax = changeMat ? mat.cubeMapMaxUniform : new Float32Array(3);

            bmin[0] = val.center.x - val.halfExtents.x;
            bmin[1] = val.center.y - val.halfExtents.y;
            bmin[2] = val.center.z - val.halfExtents.z;

            bmax[0] = val.center.x + val.halfExtents.x;
            bmax[1] = val.center.y + val.halfExtents.y;
            bmax[2] = val.center.z + val.halfExtents.z;

            return [{ name: "envBoxMin", value: bmin }, { name: "envBoxMax", value: bmax }];
        });

        _defineChunks(obj);

        _defineFlag(obj, "ambientTint", false);

        _defineFlag(obj, "diffuseTint", false);
        _defineFlag(obj, "specularTint", false);
        _defineFlag(obj, "emissiveTint", false);
        _defineFlag(obj, "fastTbn", false);
        _defineFlag(obj, "specularAntialias", false);
        _defineFlag(obj, "useMetalness", false);
        _defineFlag(obj, "occludeDirect", false);
        _defineFlag(obj, "normalizeNormalMap", true);
        _defineFlag(obj, "conserveEnergy", true);
        _defineFlag(obj, "occludeSpecular", pc.SPECOCC_AO);
        _defineFlag(obj, "shadingModel", pc.SPECULAR_BLINN);
        _defineFlag(obj, "fresnelModel", pc.FRESNEL_NONE);
        _defineFlag(obj, "cubeMapProjection", pc.CUBEPROJ_NONE);
        _defineFlag(obj, "customFragmentShader", null);
        _defineFlag(obj, "forceFragmentPrecision", null);
        _defineFlag(obj, "useFog", true);
        _defineFlag(obj, "useLighting", true);
        _defineFlag(obj, "useGammaTonemap", true);
        _defineFlag(obj, "useSkybox", true);
        _defineFlag(obj, "forceUv1", false);
        _defineFlag(obj, "pixelSnap", false);
        _defineFlag(obj, "twoSidedLighting", false);
        _defineFlag(obj, "nineSlicedMode", pc.SPRITE_RENDERMODE_SLICED);

        _defineTex2D(obj, "diffuse", 0, 3);
        _defineTex2D(obj, "specular", 0, 3);
        _defineTex2D(obj, "emissive", 0, 3);
        _defineTex2D(obj, "normal", 0, -1);
        _defineTex2D(obj, "metalness", 0, 1);
        _defineTex2D(obj, "gloss", 0, 1);
        _defineTex2D(obj, "opacity", 0, 1, 'a');
        _defineTex2D(obj, "height", 0, 1);
        _defineTex2D(obj, "ao", 0, 1);
        _defineTex2D(obj, "light", 1, 3);
        _defineTex2D(obj, "msdf", 0, 3);

        _defineObject(obj, "cubeMap");
        _defineObject(obj, "sphereMap");
        _defineObject(obj, "dpAtlas");
        _defineObject(obj, "prefilteredCubeMap128");
        _defineObject(obj, "prefilteredCubeMap64");
        _defineObject(obj, "prefilteredCubeMap32");
        _defineObject(obj, "prefilteredCubeMap16");
        _defineObject(obj, "prefilteredCubeMap8");
        _defineObject(obj, "prefilteredCubeMap4");

        _defineAlias(obj, "diffuseTint", "diffuseMapTint");
        _defineAlias(obj, "specularTint", "specularMapTint");
        _defineAlias(obj, "emissiveTint", "emissiveMapTint");
        _defineAlias(obj, "aoVertexColor", "aoMapVertexColor");
        _defineAlias(obj, "diffuseVertexColor", "diffuseMapVertexColor");
        _defineAlias(obj, "specularVertexColor", "specularMapVertexColor");
        _defineAlias(obj, "emissiveVertexColor", "emissiveMapVertexColor");
        _defineAlias(obj, "metalnessVertexColor", "metalnessMapVertexColor");
        _defineAlias(obj, "glossVertexColor", "glossMapVertexColor");
        _defineAlias(obj, "opacityVertexColor", "opacityMapVertexColor");
        _defineAlias(obj, "lightVertexColor", "lightMapVertexColor");

        for (var i = 0; i < _propsSerial.length; i++) {
            _propsSerialDefaultVal[i] = obj[_propsSerial[i]];
        }

        obj._propsSet = [];
    };

    _defineMaterialProps(StandardMaterial.prototype);

    return {
        StandardMaterial: StandardMaterial
    };
}());
