(function () {
    // Scene API enums
    var enums = {
        /**
         * @constant
         * @name pc.BLEND_SUBTRACTIVE
         * @type {number}
         * @description Subtract the color of the source fragment from the destination fragment
         * and write the result to the frame buffer.
         */
        BLEND_SUBTRACTIVE: 0,
        /**
         * @constant
         * @name pc.BLEND_ADDITIVE
         * @type {number}
         * @description Add the color of the source fragment to the destination fragment
         * and write the result to the frame buffer.
         */
        BLEND_ADDITIVE: 1,
        /**
         * @constant
         * @name pc.BLEND_NORMAL
         * @type {number}
         * @description Enable simple translucency for materials such as glass. This is
         * equivalent to enabling a source blend mode of pc.BLENDMODE_SRC_ALPHA and a destination
         * blend mode of pc.BLENDMODE_ONE_MINUS_SRC_ALPHA.
         */
        BLEND_NORMAL: 2,
        /**
         * @constant
         * @name pc.BLEND_NONE
         * @type {number}
         * @description Disable blending.
         */
        BLEND_NONE: 3,
        /**
         * @constant
         * @name pc.BLEND_PREMULTIPLIED
         * @type {number}
         * @description Similar to pc.BLEND_NORMAL expect the source fragment is assumed to have
         * already been multiplied by the source alpha value.
         */
        BLEND_PREMULTIPLIED: 4,
        /**
         * @constant
         * @name pc.BLEND_MULTIPLICATIVE
         * @type {number}
         * @description Multiply the color of the source fragment by the color of the destination
         * fragment and write the result to the frame buffer.
         */
        BLEND_MULTIPLICATIVE: 5,
        /**
         * @constant
         * @name pc.BLEND_ADDITIVEALPHA
         * @type {number}
         * @description Same as pc.BLEND_ADDITIVE except the source RGB is multiplied by the source alpha.
         */
        BLEND_ADDITIVEALPHA: 6,

        /**
         * @constant
         * @name pc.BLEND_MULTIPLICATIVE2X
         * @type {number}
         * @description Multiplies colors and doubles the result.
         */
        BLEND_MULTIPLICATIVE2X: 7,

        /**
         * @constant
         * @name pc.BLEND_SCREEN
         * @type {number}
         * @description Softer version of additive.
         */
        BLEND_SCREEN: 8,

        /**
         * @constant
         * @name pc.BLEND_MIN
         * @type {number}
         * @description Minimum color. Check app.graphicsDevice.extBlendMinmax for support.
         */
        BLEND_MIN: 9,

        /**
         * @constant
         * @name pc.BLEND_MAX
         * @type {number}
         * @description Maximum color. Check app.graphicsDevice.extBlendMinmax for support.
         */
        BLEND_MAX: 10,

        /**
         * @constant
         * @name pc.FOG_NONE
         * @type {string}
         * @description No fog is applied to the scene.
         */
        FOG_NONE: 'none',
        /**
         * @constant
         * @name pc.FOG_LINEAR
         * @type {string}
         * @description Fog rises linearly from zero to 1 between a start and end depth.
         */
        FOG_LINEAR: 'linear',
        /**
         * @constant
         * @name pc.FOG_EXP
         * @type {string}
         * @description Fog rises according to an exponential curve controlled by a density value.
         */
        FOG_EXP: 'exp',
        /**
         * @constant
         * @name pc.FOG_EXP2
         * @type {string}
         * @description Fog rises according to an exponential curve controlled by a density value.
         */
        FOG_EXP2: 'exp2',

        /**
         * @constant
         * @name pc.FRESNEL_NONE
         * @type {number}
         * @description No Fresnel.
         */
        FRESNEL_NONE: 0,
        /**
         * @constant
         * @name pc.FRESNEL_SCHLICK
         * @type {number}
         * @description Schlick's approximation of Fresnel.
         */
        FRESNEL_SCHLICK: 2,

        // Legacy
        LAYER_HUD: 0,
        LAYER_GIZMO: 1,
        LAYER_FX: 2,
        // 3 - 14 are custom user layers
        LAYER_WORLD: 15,

        // New layers
        /**
         * @constant
         * @name pc.LAYERID_WORLD
         * @type {number}
         * @description The world layer.
         */
        LAYERID_WORLD: 0,
        /**
         * @constant
         * @name pc.LAYERID_DEPTH
         * @type {number}
         * @description The depth layer.
         */
        LAYERID_DEPTH: 1,
        /**
         * @constant
         * @name pc.LAYERID_SKYBOX
         * @type {number}
         * @description The skybox layer.
         */
        LAYERID_SKYBOX: 2,
        /**
         * @constant
         * @name pc.LAYERID_IMMEDIATE
         * @type {number}
         * @description The immediate layer.
         */
        LAYERID_IMMEDIATE: 3,
        /**
         * @constant
         * @name pc.LAYERID_UI
         * @type {number}
         * @description The UI layer.
         */
        LAYERID_UI: 4,

        /**
         * @constant
         * @name pc.LIGHTTYPE_DIRECTIONAL
         * @type {number}
         * @description Directional (global) light source.
         */
        LIGHTTYPE_DIRECTIONAL: 0,
        /**
         * @constant
         * @name pc.LIGHTTYPE_POINT
         * @type {number}
         * @description Point (local) light source.
         */
        LIGHTTYPE_POINT: 1,
        /**
         * @constant
         * @name pc.LIGHTTYPE_SPOT
         * @type {number}
         * @description Spot (local) light source.
         */
        LIGHTTYPE_SPOT: 2,

        /**
         * @constant
         * @name pc.LIGHTFALLOFF_LINEAR
         * @type {number}
         * @description Linear distance falloff model for light attenuation.
         */
        LIGHTFALLOFF_LINEAR: 0,
        /**
         * @constant
         * @name pc.LIGHTFALLOFF_INVERSESQUARED
         * @type {number}
         * @description Inverse squared distance falloff model for light attenuation.
         */
        LIGHTFALLOFF_INVERSESQUARED: 1,

        /**
         * @constant
         * @name pc.SHADOW_PCF3
         * @type {number}
         * @description Render depth (color-packed on WebGL 1.0), can be used for PCF 3x3 sampling.
         */
        SHADOW_PCF3: 0,
        SHADOW_DEPTH: 0, // alias for SHADOW_PCF3 for backwards compatibility
        /**
         * @constant
         * @name pc.SHADOW_VSM8
         * @type {number}
         * @description Render packed variance shadow map. All shadow receivers must also cast shadows for this mode to work correctly.
         */
        SHADOW_VSM8: 1,
        /**
         * @constant
         * @name pc.SHADOW_VSM16
         * @type {number}
         * @description Render 16-bit exponential variance shadow map. Requires OES_texture_half_float extension. Falls back to pc.SHADOW_VSM8, if not supported.
         */
        SHADOW_VSM16: 2,
        /**
         * @constant
         * @name pc.SHADOW_VSM32
         * @type {number}
         * @description Render 32-bit exponential variance shadow map. Requires OES_texture_float extension. Falls back to pc.SHADOW_VSM16, if not supported.
         */
        SHADOW_VSM32: 3,
        /**
         * @constant
         * @name pc.SHADOW_PCF5
         * @type {number}
         * @description Render depth buffer only, can be used for hardware-accelerated PCF 5x5 sampling. Requires WebGL2. Falls back to pc.SHADOW_PCF3 on WebGL 1.0.
         */
        SHADOW_PCF5: 4,

        /**
         * @constant
         * @name pc.BLUR_BOX
         * @type {number}
         * @description Box filter.
         */
        BLUR_BOX: 0,
        /**
         * @constant
         * @name pc.BLUR_GAUSSIAN
         * @type {number}
         * @description Gaussian filter. May look smoother than box, but requires more samples.
         */
        BLUR_GAUSSIAN: 1,

        /**
         * @constant
         * @name pc.PARTICLESORT_NONE
         * @type {number}
         * @description No sorting, particles are drawn in arbitary order. Can be simulated on GPU.
         */
        PARTICLESORT_NONE: 0,
        /**
         * @constant
         * @name pc.PARTICLESORT_DISTANCE
         * @type {number}
         * @description Sorting based on distance to the camera. CPU only.
         */
        PARTICLESORT_DISTANCE: 1,
        /**
         * @constant
         * @name pc.PARTICLESORT_NEWER_FIRST
         * @type {number}
         * @description Newer particles are drawn first. CPU only.
         */
        PARTICLESORT_NEWER_FIRST: 2,
        /**
         * @constant
         * @name pc.PARTICLESORT_OLDER_FIRST
         * @type {number}
         * @description Older particles are drawn first. CPU only.
         */
        PARTICLESORT_OLDER_FIRST: 3,

        PARTICLEMODE_GPU: 0,
        PARTICLEMODE_CPU: 1,

        /**
         * @constant
         * @name pc.EMITTERSHAPE_BOX
         * @type {number}
         * @description Box shape parameterized by emitterExtents. Initial velocity is directed towards local Z axis.
         */
        EMITTERSHAPE_BOX: 0,
        /**
         * @constant
         * @name pc.EMITTERSHAPE_SPHERE
         * @type {number}
         * @description Sphere shape parameterized by emitterRadius. Initial velocity is directed outwards from the center.
         */
        EMITTERSHAPE_SPHERE: 1,

        /**
         * @constant
         * @name pc.PARTICLEORIENTATION_SCREEN
         * @type {number}
         * @description Particles are facing camera.
         */
        PARTICLEORIENTATION_SCREEN: 0,
        /**
         * @constant
         * @name pc.PARTICLEORIENTATION_WORLD
         * @type {number}
         * @description User defines world space normal (particleNormal) to set planes orientation.
         */
        PARTICLEORIENTATION_WORLD: 1,
        /**
         * @constant
         * @name pc.PARTICLEORIENTATION_EMITTER
         * @type {number}
         * @description Similar to previous, but the normal is affected by emitter(entity) transformation.
         */
        PARTICLEORIENTATION_EMITTER: 2,

        /**
         * @constant
         * @name pc.PROJECTION_PERSPECTIVE
         * @type {number}
         * @description A perspective camera projection where the frustum shape is essentially pyramidal.
         */
        PROJECTION_PERSPECTIVE: 0,
        /**
         * @constant
         * @name pc.PROJECTION_ORTHOGRAPHIC
         * @type {number}
         * @description An orthographic camera projection where the frustum shape is essentially a cuboid.
         */
        PROJECTION_ORTHOGRAPHIC: 1,

        /**
         * @constant
         * @name pc.RENDERSTYLE_SOLID
         * @type {number}
         * @description Render mesh instance as solid geometry.
         */
        RENDERSTYLE_SOLID: 0,
        /**
         * @constant
         * @name pc.RENDERSTYLE_WIREFRAME
         * @type {number}
         * @description Render mesh instance as wireframe.
         */
        RENDERSTYLE_WIREFRAME: 1,
        /**
         * @constant
         * @name pc.RENDERSTYLE_POINTS
         * @type {number}
         * @description Render mesh instance as points.
         */
        RENDERSTYLE_POINTS: 2,

        /**
         * @constant
         * @name pc.CUBEPROJ_NONE
         * @type {number}
         * @description The cube map is treated as if it is infinitely far away.
         */
        CUBEPROJ_NONE: 0,
        /**
         * @constant
         * @name pc.CUBEPROJ_BOX
         * @type {number}
         * @description The cube map is box-projected based on a world space axis-aligned bounding box.
         */
        CUBEPROJ_BOX: 1,

        /**
         * @constant
         * @name pc.SPECULAR_PHONG
         * @type {number}
         * @description Phong without energy conservation. You should only use it as a backwards compatibility with older projects.
         */
        SPECULAR_PHONG: 0,
        /**
         * @constant
         * @name pc.SPECULAR_BLINN
         * @type {number}
         * @description Energy-conserving Blinn-Phong.
         */
        SPECULAR_BLINN: 1,

        /**
         * @constant
         * @name pc.DETAILMODE_MUL
         * @type {string}
         * @description Multiply together the primary and secondary colors.
         */
        DETAILMODE_MUL: 'mul',
        /**
         * @constant
         * @name pc.DETAILMODE_ADD
         * @type {string}
         * @description Add together the primary and secondary colors.
         */
        DETAILMODE_ADD: 'add',
        /**
         * @constant
         * @name pc.DETAILMODE_SCREEN
         * @type {string}
         * @description Softer version of {@link pc.DETAILMODE_ADD}.
         */
        DETAILMODE_SCREEN: 'screen',
        /**
         * @constant
         * @name pc.DETAILMODE_OVERLAY
         * @type {string}
         * @description Multiplies or screens the colors, depending on the primary color.
         */
        DETAILMODE_OVERLAY: 'overlay',
        /**
         * @constant
         * @name pc.DETAILMODE_MIN
         * @type {string}
         * @description Select whichever of the primary and secondary colors is darker, component-wise.
         */
        DETAILMODE_MIN: 'min',
        /**
         * @constant
         * @name pc.DETAILMODE_MAX
         * @type {string}
         * @description Select whichever of the primary and secondary colors is lighter, component-wise.
         */
        DETAILMODE_MAX: 'max',

        /**
         * @constant
         * @name pc.GAMMA_NONE
         * @type {number}
         * @description No gamma correction.
         */
        GAMMA_NONE: 0,
        /**
         * @constant
         * @name pc.GAMMA_SRGB
         * @type {number}
         * @description Apply sRGB gamma correction.
         */
        GAMMA_SRGB: 1,
        /**
         * @deprecated
         * @constant
         * @name pc.GAMMA_SRGBFAST
         * @type {number}
         * @description Apply sRGB (fast) gamma correction.
         */
        GAMMA_SRGBFAST: 2, // deprecated
        /**
         * @constant
         * @name pc.GAMMA_SRGBHDR
         * @type {number}
         * @description Apply sRGB (HDR) gamma correction.
         */
        GAMMA_SRGBHDR: 3,

        /**
         * @constant
         * @name pc.TONEMAP_LINEAR
         * @type {number}
         * @description Linear tonemapping.
         */
        TONEMAP_LINEAR: 0,
        /**
         * @constant
         * @name pc.TONEMAP_FILMIC
         * @type {number}
         * @description Filmic tonemapping curve.
         */
        TONEMAP_FILMIC: 1,
        /**
         * @constant
         * @name pc.TONEMAP_HEJL
         * @type {number}
         * @description Hejl filmic tonemapping curve.
         */
        TONEMAP_HEJL: 2,
        /**
         * @constant
         * @name pc.TONEMAP_ACES
         * @type {number}
         * @description ACES filmic tonemapping curve.
         */
        TONEMAP_ACES: 3,
        /**
         * @constant
         * @name pc.TONEMAP_ACES2
         * @type {number}
         * @description ACES v2 filmic tonemapping curve.
         */
        TONEMAP_ACES2: 4,

        /**
         * @constant
         * @name pc.SPECOCC_NONE
         * @type {number}
         * @description No specular occlusion.
         */
        SPECOCC_NONE: 0,
        /**
         * @constant
         * @name pc.SPECOCC_AO
         * @type {number}
         * @description Use AO directly to occlude specular.
         */
        SPECOCC_AO: 1,
        /**
         * @constant
         * @name pc.SPECOCC_GLOSSDEPENDENT
         * @type {number}
         * @description Modify AO based on material glossiness/view angle to occlude specular.
         */
        SPECOCC_GLOSSDEPENDENT: 2,

        SHADERDEF_NOSHADOW: 1,
        SHADERDEF_SKIN: 2,
        SHADERDEF_UV0: 4,
        SHADERDEF_UV1: 8,
        SHADERDEF_VCOLOR: 16,
        SHADERDEF_INSTANCING: 32,
        SHADERDEF_LM: 64,
        SHADERDEF_DIRLM: 128,
        SHADERDEF_SCREENSPACE: 256,
        SHADERDEF_TANGENTS: 512,

        LINEBATCH_WORLD: 0,
        LINEBATCH_OVERLAY: 1,
        LINEBATCH_GIZMO: 2,

        /**
         * @constant
         * @name pc.SHADOWUPDATE_NONE
         * @type {number}
         * @description The shadow map is not to be updated.
         */
        SHADOWUPDATE_NONE: 0,
        /**
         * @constant
         * @name pc.SHADOWUPDATE_THISFRAME
         * @type {number}
         * @description The shadow map is regenerated this frame and not on subsequent frames.
         */
        SHADOWUPDATE_THISFRAME: 1,
        /**
         * @constant
         * @name pc.SHADOWUPDATE_REALTIME
         * @type {number}
         * @description The shadow map is regenerated every frame.
         */
        SHADOWUPDATE_REALTIME: 2,

        SORTKEY_FORWARD: 0,
        SORTKEY_DEPTH: 1,

        MASK_DYNAMIC: 1,
        MASK_BAKED: 2,
        MASK_LIGHTMAP: 4,

        /**
         * @constant
         * @name pc.SHADER_FORWARD
         * @type {number}
         * @description Render shaded materials with gamma correction and tonemapping.
         */
        SHADER_FORWARD: 0,

        /**
         * @constant
         * @name pc.SHADER_FORWARDHDR
         * @type {number}
         * @description Render shaded materials without gamma correction and tonemapping.
         */
        SHADER_FORWARDHDR: 1,

        /**
         * @constant
         * @name pc.SHADER_DEPTH
         * @type {number}
         * @description Render RGBA-encoded depth value.
         */
        SHADER_DEPTH: 2,

        // next are undocumented
        SHADER_SHADOW: 3, // PCF3
        // 4: VSM8,
        // 5: VSM16,
        // 6: VSM32,
        // 7: PCF5,
        // 8: PCF3 POINT
        // 9: VSM8 POINT,
        // 10: VSM16 POINT,
        // 11: VSM32 POINT,
        // 12: PCF5 POINT
        // 13: PCF3 SPOT
        // 14: VSM8 SPOT,
        // 15: VSM16 SPOT,
        // 16: VSM32 SPOT,
        // 17: PCF5 SPOT
        SHADER_PICK: 18,

        /**
         * @constant
         * @name pc.BAKE_COLOR
         * @type {number}
         * @description Single color lightmap.
         */
        BAKE_COLOR: 0,
        /**
         * @constant
         * @name pc.BAKE_COLORDIR
         * @type {number}
         * @description Single color lightmap + dominant light direction (used for bump/specular).
         */
        BAKE_COLORDIR: 1,

        /**
         * @constant
         * @name pc.VIEW_CENTER
         * @type {number}
         * @description Center of view.
         */
        VIEW_CENTER: 0,
        /**
         * @constant
         * @name pc.VIEW_LEFT
         * @type {number}
         * @description Left of view. Only used in stereo rendering.
         */
        VIEW_LEFT: 1,
        /**
         * @constant
         * @name pc.VIEW_RIGHT
         * @type {number}
         * @description Right of view. Only used in stereo rendering.
         */
        VIEW_RIGHT: 2,

        /**
         * @constant
         * @name pc.SORTMODE_NONE
         * @type {number}
         * @description No sorting is applied. Mesh instances are rendered in the same order they were added to a layer.
         */
        SORTMODE_NONE: 0,

        /**
         * @constant
         * @name pc.SORTMODE_MANUAL
         * @type {number}
         * @description Mesh instances are sorted based on {@link pc.MeshInstance#drawOrder}.
         */
        SORTMODE_MANUAL: 1,

        /**
         * @constant
         * @name pc.SORTMODE_MATERIALMESH
         * @type {number}
         * @description Mesh instances are sorted to minimize switching between materials and meshes to improve rendering performance.
         */
        SORTMODE_MATERIALMESH: 2,

        /**
         * @constant
         * @name pc.SORTMODE_BACK2FRONT
         * @type {number}
         * @description Mesh instances are sorted back to front. This is the way to properly render many semi-transparent objects on different depth, one is blended on top of another.
         */
        SORTMODE_BACK2FRONT: 3,

        /**
         * @constant
         * @name pc.SORTMODE_FRONT2BACK
         * @type {number}
         * @description Mesh instances are sorted front to back. Depending on GPU and the scene, this option may give better performance than pc.SORTMODE_MATERIALMESH due to reduced overdraw.
         */
        SORTMODE_FRONT2BACK: 4,

        /**
         * @private
         * @constant
         * @name  pc.SORTMODE_CUSTOM
         * @type {number}
         * @description Provide custom functions for sorting drawcalls and calculating distance.
         */
        SORTMODE_CUSTOM: 5,

        COMPUPDATED_INSTANCES: 1,
        COMPUPDATED_LIGHTS: 2,
        COMPUPDATED_CAMERAS: 4,
        COMPUPDATED_BLEND: 8,

        /**
         * @constant
         * @name pc.ASPECT_AUTO
         * @type {number}
         * @description Automatically set aspect ratio to current render target's width divided by height.
         */
        ASPECT_AUTO: 0,
        /**
         * @constant
         * @name pc.ASPECT_MANUAL
         * @type {number}
         * @description Use the manual aspect ratio value.
         */
        ASPECT_MANUAL: 1,

        /**
         * @constant
         * @name pc.ORIENTATION_HORIZONTAL
         * @type {number}
         * @description Horizontal orientation.
         */
        ORIENTATION_HORIZONTAL: 0,
        /**
         * @constant
         * @name pc.ORIENTATION_VERTICAL
         * @type {number}
         * @description Vertical orientation.
         */
        ORIENTATION_VERTICAL: 1
    };

    Object.assign(pc, enums);

    // For backwards compatibility
    pc.scene = {};
    Object.assign(pc.scene, enums);
}());

Object.assign(pc, function () {
    /**
     * @class
     * @name pc.Scene
     * @augments pc.EventHandler
     * @classdesc A scene is graphical representation of an environment. It manages the
     * scene hierarchy, all graphical objects, lights, and scene-wide properties.
     * @description Creates a new Scene.
     * @property {pc.Color} ambientLight The color of the scene's ambient light. Defaults
     * to black (0, 0, 0).
     * @property {string} fog The type of fog used by the scene. Can be:
     *
     * * {@link pc.FOG_NONE}
     * * {@link pc.FOG_LINEAR}
     * * {@link pc.FOG_EXP}
     * * {@link pc.FOG_EXP2}
     *
     * Defaults to pc.FOG_NONE.
     * @property {pc.Color} fogColor The color of the fog (if enabled). Defaults to black
     * (0, 0, 0).
     * @property {number} fogDensity The density of the fog (if enabled). This property
     * is only valid if the fog property is set to pc.FOG_EXP or pc.FOG_EXP2. Defaults to 0.
     * @property {number} fogEnd The distance from the viewpoint where linear fog reaches
     * its maximum. This property is only valid if the fog property is set to pc.FOG_LINEAR.
     * Defaults to 1000.
     * @property {number} fogStart The distance from the viewpoint where linear fog begins.
     * This property is only valid if the fog property is set to pc.FOG_LINEAR. Defaults to 1.
     * @property {number} gammaCorrection The gamma correction to apply when rendering the
     * scene. Can be:
     *
     * * {@link pc.GAMMA_NONE}
     * * {@link pc.GAMMA_SRGB}
     *
     * Defaults to pc.GAMMA_NONE.
     * @property {number} toneMapping The tonemapping transform to apply when writing
     * fragments to the frame buffer. Can be:
     *
     * * {@link pc.TONEMAP_LINEAR}
     * * {@link pc.TONEMAP_FILMIC}
     * * {@link pc.TONEMAP_HEJL}
     * * {@link pc.TONEMAP_ACES}
     *
     * Defaults to pc.TONEMAP_LINEAR.
     * @property {number} exposure The exposure value tweaks the overall brightness of
     * the scene. Defaults to 1.
     * @property {pc.Texture} skybox The base cubemap texture used as the scene's skybox, if mip level is 0. Defaults to null.
     * @property {pc.Texture} skyboxPrefiltered128 The prefiltered cubemap texture (size 128x128) used as the scene's skybox, if mip level 1. Defaults to null.
     * @property {pc.Texture} skyboxPrefiltered64 The prefiltered cubemap texture (size 64x64) used as the scene's skybox, if mip level 2. Defaults to null.
     * @property {pc.Texture} skyboxPrefiltered32 The prefiltered cubemap texture (size 32x32) used as the scene's skybox, if mip level 3. Defaults to null.
     * @property {pc.Texture} skyboxPrefiltered16 The prefiltered cubemap texture (size 16x16) used as the scene's skybox, if mip level 4. Defaults to null.
     * @property {pc.Texture} skyboxPrefiltered8 The prefiltered cubemap texture (size 8x8) used as the scene's skybox, if mip level 5. Defaults to null.
     * @property {pc.Texture} skyboxPrefiltered4 The prefiltered cubemap texture (size 4x4) used as the scene's skybox, if mip level 6. Defaults to null.
     * @property {number} skyboxIntensity Multiplier for skybox intensity. Defaults to 1.
     * @property {number} skyboxMip The mip level of the skybox to be displayed. Only valid
     * for prefiltered cubemap skyboxes. Defaults to 0 (base level).
     * @property {number} lightmapSizeMultiplier The lightmap resolution multiplier.
     * Defaults to 1.
     * @property {number} lightmapMaxResolution The maximum lightmap resolution. Defaults to
     * 2048.
     * @property {number} lightmapMode The lightmap baking mode. Can be:
     *
     * * {@link pc.BAKE_COLOR}: single color lightmap
     * * {@link pc.BAKE_COLORDIR}: single color lightmap + dominant light direction (used for
     * bump/specular). Only lights with bakeDir=true will be used for generating the dominant
     * light direction.
     *
     * Defaults to pc.BAKE_COLORDIR.
     * @property {pc.LayerComposition} layers A {@link pc.LayerComposition} that defines
     * rendering order of this scene.
     * @property {pc.StandardMaterial} defaultMaterial The default material used in case no
     * other material is available.
     * @property {pc.Entity} root The root entity of the scene, which is usually the only
     * child to the Application root entity.
     */
    var Scene = function Scene() {
        pc.EventHandler.call(this);

        this.root = null;

        this._gravity = new pc.Vec3(0, -9.8, 0);

        this._layers = null;

        this._fog = pc.FOG_NONE;
        this.fogColor = new pc.Color(0, 0, 0);
        this.fogStart = 1;
        this.fogEnd = 1000;
        this.fogDensity = 0;

        this.ambientLight = new pc.Color(0, 0, 0);

        this._gammaCorrection = pc.GAMMA_NONE;
        this._toneMapping = 0;
        this.exposure = 1.0;

        this._skyboxPrefiltered = [null, null, null, null, null, null];

        this._firstUpdateSkybox = true;
        this._skyboxCubeMap = null;
        this.skyboxModel = null;

        this._skyboxIntensity = 1;
        this._skyboxMip = 0;

        this.lightmapSizeMultiplier = 1;
        this.lightmapMaxResolution = 2048;
        this.lightmapMode = pc.BAKE_COLORDIR;

        this._stats = {
            meshInstances: 0,
            lights: 0,
            dynamicLights: 0,
            bakedLights: 0,
            lastStaticPrepareFullTime: 0,
            lastStaticPrepareSearchTime: 0,
            lastStaticPrepareWriteTime: 0,
            lastStaticPrepareTriAabbTime: 0,
            lastStaticPrepareCombineTime: 0,
            updateShadersTime: 0
        };

        this.updateShaders = true;
        this.updateSkybox = true;

        this._shaderVersion = 0;
        this._statsUpdated = false;

        // backwards compatibilty only
        this._models = [];

        // default material used in case no other material is available
        this.defaultMaterial = new pc.StandardMaterial();
        this.defaultMaterial.name = "Default Material";
        this.defaultMaterial.shadingModel = pc.SPECULAR_BLINN;
    };
    Scene.prototype = Object.create(pc.EventHandler.prototype);
    Scene.prototype.constructor = Scene;

    Scene.prototype.destroy = function () {
        this.root = null;
        this.defaultMaterial.destroy();
        this.defaultMaterial = null;
        this.off();
    };

    Object.defineProperty(Scene.prototype, 'fog', {
        get: function () {
            return this._fog;
        },
        set: function (type) {
            if (type !== this._fog) {
                this._fog = type;
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'gammaCorrection', {
        get: function () {
            return this._gammaCorrection;
        },
        set: function (value) {
            if (value !== this._gammaCorrection) {
                this._gammaCorrection = value;
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'toneMapping', {
        get: function () {
            return this._toneMapping;
        },
        set: function (value) {
            if (value !== this._toneMapping) {
                this._toneMapping = value;
                this.updateShaders = true;
            }
        }
    });

    Object.defineProperty(Scene.prototype, 'skybox', {
        get: function () {
            return this._skyboxCubeMap;
        },
        set: function (value) {
            this._skyboxCubeMap = value;
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxIntensity', {
        get: function () {
            return this._skyboxIntensity;
        },
        set: function (value) {
            this._skyboxIntensity = value;
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxMip', {
        get: function () {
            return this._skyboxMip;
        },
        set: function (value) {
            this._skyboxMip = value;
            this._resetSkyboxModel();
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered128', {
        get: function () {
            return this._skyboxPrefiltered[0];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[0] === value)
                return;

            this._skyboxPrefiltered[0] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered64', {
        get: function () {
            return this._skyboxPrefiltered[1];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[1] === value)
                return;

            this._skyboxPrefiltered[1] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered32', {
        get: function () {
            return this._skyboxPrefiltered[2];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[2] === value)
                return;

            this._skyboxPrefiltered[2] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered16', {
        get: function () {
            return this._skyboxPrefiltered[3];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[3] === value)
                return;

            this._skyboxPrefiltered[3] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered8', {
        get: function () {
            return this._skyboxPrefiltered[4];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[4] === value)
                return;

            this._skyboxPrefiltered[4] = value;
            this.updateShaders = true;
        }
    });

    Object.defineProperty(Scene.prototype, 'skyboxPrefiltered4', {
        get: function () {
            return this._skyboxPrefiltered[5];
        },
        set: function (value) {
            if (this._skyboxPrefiltered[5] === value)
                return;

            this._skyboxPrefiltered[5] = value;
            this.updateShaders = true;
        }
    });

    // some backwards compatibility
    // drawCalls will now return list of all active composition mesh instances
    Object.defineProperty(Scene.prototype, 'drawCalls', {
        get: function () {
            var drawCalls = this.layers._meshInstances;
            if (!drawCalls.length) {
                this.layers._update();
                drawCalls = this.layers._meshInstances;
            }
            return drawCalls;
        },
        set: function (value) {

        }
    });

    Object.defineProperty(Scene.prototype, 'layers', {
        get: function () {
            return this._layers;
        },
        set: function (layers) {
            var prev = this._layers;
            this._layers = layers;
            this.fire("set:layers", prev, layers);
        }
    });

    Scene.prototype.applySettings = function (settings) {
        // settings
        this._gravity.set(settings.physics.gravity[0], settings.physics.gravity[1], settings.physics.gravity[2]);
        this.ambientLight.set(settings.render.global_ambient[0], settings.render.global_ambient[1], settings.render.global_ambient[2]);
        this._fog = settings.render.fog;
        this.fogColor.set(settings.render.fog_color[0], settings.render.fog_color[1], settings.render.fog_color[2]);
        this.fogStart = settings.render.fog_start;
        this.fogEnd = settings.render.fog_end;
        this.fogDensity = settings.render.fog_density;
        this._gammaCorrection = settings.render.gamma_correction;
        this._toneMapping = settings.render.tonemapping;
        this.lightmapSizeMultiplier = settings.render.lightmapSizeMultiplier;
        this.lightmapMaxResolution = settings.render.lightmapMaxResolution;
        this.lightmapMode = settings.render.lightmapMode;
        this.exposure = settings.render.exposure;
        this._skyboxIntensity = settings.render.skyboxIntensity === undefined ? 1 : settings.render.skyboxIntensity;
        this._skyboxMip = settings.render.skyboxMip === undefined ? 0 : settings.render.skyboxMip;

        this._resetSkyboxModel();
        this.updateShaders = true;
    };

    Scene.prototype._updateSkybox = function (device) {
        // Create skybox
        if (this._skyboxCubeMap && !this.skyboxModel) {
            var material = new pc.Material();
            var scene = this;
            material.updateShader = function (dev, sc, defs, staticLightList, pass) {
                var library = device.getProgramLibrary();
                var shader = library.getProgram('skybox', {
                    rgbm: scene._skyboxCubeMap.rgbm,
                    hdr: (scene._skyboxCubeMap.rgbm || scene._skyboxCubeMap.format === pc.PIXELFORMAT_RGBA32F),
                    useIntensity: scene.skyboxIntensity !== 1,
                    mip: scene._skyboxCubeMap.fixCubemapSeams ? scene.skyboxMip : 0,
                    fixSeams: scene._skyboxCubeMap.fixCubemapSeams,
                    gamma: (pass === pc.SHADER_FORWARDHDR ? (scene.gammaCorrection ? pc.GAMMA_SRGBHDR : pc.GAMMA_NONE) : scene.gammaCorrection),
                    toneMapping: (pass === pc.SHADER_FORWARDHDR ? pc.TONEMAP_LINEAR : scene.toneMapping)
                });
                this.shader = shader;
            };

            material.updateShader();
            var usedTex;
            if (!this._skyboxCubeMap.fixCubemapSeams || !scene._skyboxMip) {
                usedTex = this._skyboxCubeMap;
            } else {
                var mip2tex = [null, "64", "16", "8", "4"];
                var mipTex = this["skyboxPrefiltered" + mip2tex[scene._skyboxMip]];
                if (mipTex)
                    usedTex = mipTex;
            }
            material.setParameter("texture_cubeMap", usedTex);
            material.cull = pc.CULLFACE_FRONT;
            material.depthWrite = false;

            var skyLayer = this.layers.getLayerById(pc.LAYERID_SKYBOX);
            if (skyLayer) {
                var node = new pc.GraphNode();
                var mesh = pc.createBox(device);
                var meshInstance = new pc.MeshInstance(node, mesh, material);
                meshInstance.cull = false;
                meshInstance._noDepthDrawGl1 = true;

                var model = new pc.Model();
                model.graph = node;
                model.meshInstances = [meshInstance];
                this.skyboxModel = model;

                skyLayer.addMeshInstances(model.meshInstances);
                this.skyLayer = skyLayer;

                // enable the layer on first skybox update (the skybox layer is created disabled)
                if (this._firstUpdateSkybox) {
                    skyLayer.enabled = true;
                    this._firstUpdateSkybox = false;
                }

                this.fire("set:skybox", usedTex);
            }
        }
    };

    Scene.prototype._resetSkyboxModel = function () {
        if (this.skyboxModel) {
            this.skyLayer.removeMeshInstances(this.skyboxModel.meshInstances);
            this.skyboxModel.destroy();
        }
        this.skyboxModel = null;
        this.updateSkybox = true;
    };

    /**
     * @function
     * @name pc.Scene#setSkybox
     * @description Sets the cubemap for the scene skybox.
     * @param {pc.Texture[]} [cubemaps] - An array of cubemaps corresponding to the skybox at different mip levels. If undefined, scene will remove skybox.
     * Cubemap array should be of size 7, with the first element (index 0) corresponding to the base cubemap (mip level 0) with original resolution.
     * Each remaining element (index 1-6) corresponds to a fixed prefiltered resolution (128x128, 64x64, 32x32, 16x16, 8x8, 4x4).
     */
    Scene.prototype.setSkybox = function (cubemaps) {
        var i;
        if (!cubemaps)
            cubemaps = [null, null, null, null, null, null, null];

        // check if any values actually changed
        // to prevent unnecessary recompilations

        var different = false;

        if (this._skyboxCubeMap !== cubemaps[0])
            different = true;

        if (!different) {
            for (i = 0; i < 6 && !different; i++) {
                if (this._skyboxPrefiltered[i] !== cubemaps[i + 1])
                    different = true;
            }
        }

        if (!different)
            return;

        // set skybox

        for (i = 0; i < 6; i++)
            this._skyboxPrefiltered[i] = cubemaps[i + 1];

        this.skybox = cubemaps[0];
    };

    Scene.prototype.destroy = function () {
        this.skybox = null;
    };

    // Backwards compatibility
    Scene.prototype.addModel = function (model) {
        if (this.containsModel(model)) return;
        var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
        if (!layer) return;
        layer.addMeshInstances(model.meshInstances);
        this._models.push(model);
    };
    Scene.prototype.addShadowCaster = function (model) {
        var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
        if (!layer) return;
        layer.addShadowCasters(model.meshInstances);
    };
    Scene.prototype.removeModel = function (model) {
        var index = this._models.indexOf(model);
        if (index !== -1) {
            var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
            if (!layer) return;
            layer.removeMeshInstances(model.meshInstances);
            this._models.splice(index, 1);
        }
    };
    Scene.prototype.removeShadowCasters = function (model) {
        var layer = this.layers.getLayerById(pc.LAYERID_WORLD);
        if (!layer) return;
        layer.removeShadowCasters(model.meshInstances);
    };
    Scene.prototype.containsModel = function (model) {
        return this._models.indexOf(model) >= 0;
    };
    Scene.prototype.getModels = function (model) {
        return this._models;
    };

    return {
        Scene: Scene
    };
}());

/**
 * @event
 * @name pc.Scene#set:skybox
 * @description Fired when the skybox is set.
 * @param {pc.Texture} usedTex - Previously used cubemap texture. New is in the {@link pc.Scene#skybox}.
 */

/**
 * @event
 * @name pc.Scene#set:layers
 * @description Fired when the layer composition is set. Use this event to add callbacks or advanced properties to your layers.
 * @param {pc.LayerComposition} oldComp - Previously used {@link pc.LayerComposition}.
 * @param {pc.LayerComposition} newComp - Newly set {@link pc.LayerComposition}.
 * @example
 * this.app.scene.on('set:layers', function (oldComp, newComp) {
 *     var list = newComp.layerList;
 *     var layer;
 *     for (var i = 0; i < list.length; i++) {
 *         layer = list[i];
 *         switch (layer.name) {
 *             case 'MyLayer':
 *                 layer.onEnable = myOnEnableFunction;
 *                 layer.onDisable = myOnDisableFunction;
 *                 break;
 *             case 'MyOtherLayer':
 *                 layer.shaderPass = myShaderPass;
 *                 break;
 *         }
 *     }
 * });
 */
