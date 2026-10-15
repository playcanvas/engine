import { Debug } from '../../../core/debug.js';
import { Color } from '../../../core/math/color.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import {
    ADDRESS_CLAMP_TO_EDGE, CULLFACE_FRONT, FILTER_LINEAR, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
    RENDERTARGET_ORIGIN_BOTTOM, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, TEXTUREPROJECTION_EQUIRECT,
    TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBP
} from '../../../platform/graphics/constants.js';
import { BlendState } from '../../../platform/graphics/blend-state.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { LAYERID_SKYBOX, PROJECTION_PERSPECTIVE, SKYTYPE_INFINITE } from '../../../scene/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { EnvLighting } from '../../../scene/graphics/env-lighting.js';
import { getBlueNoiseTexture } from '../../../scene/graphics/noise-textures.js';
import { drawQuadWithShader } from '../../../scene/graphics/quad-render-utils.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { ChunkUtils } from '../../../scene/shader-lib/chunk-utils.js';
import { ShaderChunks } from '../../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../../scene/shader-lib/shader-utils.js';
import { SkyGeometry } from '../../../scene/skybox/sky-geometry.js';
import { CameraFrameEffect } from '../../render-passes/camera-frame-effect.js';
import { CLOUDTYPE_FLAT, CLOUDTYPE_NONE, CLOUDTYPE_VOLUMETRIC } from '../../render-passes/constants.js';
import { getDynamicSkyNoise } from './dynamic-sky-noise.js';
import { FramePassDynamicSkyLighting } from './passes/frame-pass-dynamic-sky-lighting.js';
import { RenderPassDynamicSkyClouds } from './passes/render-pass-dynamic-sky-clouds.js';
import glslAtmospherePS from './glsl/atmosphere-ps.js';
import glslBakePS from './glsl/bake-ps.js';
import glslCloudBufferPS from './glsl/cloud-buffer-ps.js';
import glslCloudsPS from './glsl/clouds-ps.js';
import glslLightingBlendPS from './glsl/lighting-blend-ps.js';
import glslSkyPS from './glsl/sky-ps.js';
import wgslAtmospherePS from './wgsl/atmosphere-ps.js';
import wgslBakePS from './wgsl/bake-ps.js';
import wgslCloudBufferPS from './wgsl/cloud-buffer-ps.js';
import wgslCloudsPS from './wgsl/clouds-ps.js';
import wgslLightingBlendPS from './wgsl/lighting-blend-ps.js';
import wgslSkyPS from './wgsl/sky-ps.js';

/**
 * @import { CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources } from '../../render-passes/camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { LightComponent } from '../../../framework/components/light/component.js'
 * @import { Camera } from '../../../scene/camera.js'
 * @import { Shader } from '../../../platform/graphics/shader.js'
 * @import { ScopeId } from '../../../platform/graphics/scope-id.js'
 */

// Atmosphere constants of the three.js `Sky` shader, used on the CPU to compute the scattering
// terms which are the same for the whole sky
const SKY_TOTAL_RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const SKY_MIE_CONST = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const SKY_EE = 1000.0;
const SKY_CUTOFF = 1.6110731556870734;
const SKY_STEEPNESS = 1.5;

// The scale balancing the radiance of the sky against the light of the sun. The ambient light of
// the sky model, its radiance averaged over the upper hemisphere weighted by the cosine, is about
// 2 * sin(elevation) at a scale of 1: it grows with the elevation of the sun, while the light of
// the sun does not. Divided by the sine, the sky lights the scene with about a tenth of the light
// of the sun at any elevation, the share of a clear sky in daylight
const SKY_BALANCE = 0.05;

// repeats of the detail of the volumetric clouds per repeat of their shapes, see the shader
const CLOUD_DETAIL_SCALE = 10;

// the most steps of the volumetric clouds through their layer, and toward the light - the loop
// limits of the shader
const CLOUD_MAX_STEPS = 128;
const CLOUD_MAX_LIGHT_STEPS = 6;

// the samples of the volumetric clouds at the cloud quality 0, 0.5 and 1 - the steps through the
// layer, the steps toward the light, and the fine steps through a cloud per coarse step
const CLOUD_QUALITY_STEPS = [24, 48, 64];
const CLOUD_QUALITY_LIGHT_STEPS = [1, 2, 4];
const CLOUD_QUALITY_FINE_STEP = [0.45, 0.4, 0.25];

// the number of samples prefiltering the reflections and the ambient lighting of the bake
const LIGHTING_REFLECTION_SAMPLES = 256;
const LIGHTING_AMBIENT_SAMPLES = 512;

// the fraction a setting of the sky changes by before the lighting is generated again
const LIGHTING_SETTINGS_TOLERANCE = 0.01;

// with the lighting interpolated, a change of the sky since the lighting was generated is a jump,
// which applies at once, when the sun moved by more than this many thresholds, or a setting changed
// by more than this fraction
const LIGHTING_JUMP_THRESHOLDS = 4;
const LIGHTING_JUMP_TOLERANCE = 0.1;

// the longest time the lighting blends from its previous update to its latest one, in seconds
const LIGHTING_BLEND_MAX_TIME = 1;

/**
 * Interpolates the values of the cloud quality 0, 0.5 and 1 at a quality.
 *
 * @param {number[]} values - The values at the quality 0, 0.5 and 1.
 * @param {number} quality - The quality, 0..1.
 * @returns {number} The interpolated value.
 */
const cloudQualityValue = (values, quality) => {
    const t = math.clamp(quality, 0, 1) * 2;
    const i = Math.min(Math.floor(t), 1);
    return values[i] + (values[i + 1] - values[i]) * (t - i);
};

// wraps a value into the 0..period range
const wrap = (value, period) => value - Math.floor(value / period) * period;

const tmpX = new Vec3();
const tmpZ = new Vec3();
const tmpSrc = new Vec3();
const tmpMoon = new Vec3();
const tmpMat = new Mat4();
const tmpQuat = new Quat();
const tmpView = new Mat4();

// the rotation of the sky without the rotation of the sky of the scene
const IDENTITY_MAT3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// the texture coordinates of the reprojection's vertex shader, unmodified
const UV_MOD = [1, 1, 0, 0];

/**
 * The dynamic sky effect: renders the sky of the camera - a day sky of an analytic atmosphere, lit by
 * the sun, a night sky of stars and the moon, and optionally clouds drifting with the wind - in
 * place of the sky of the scene. The time of day is set by the position of the sun, see
 * {@link DynamicSkyEffect#azimuth} and {@link DynamicSkyEffect#elevation}, and the effect can
 * keep a directional light in sync with it, see {@link DynamicSkyEffect#light}.
 *
 * The sky has no clouds by default, see {@link DynamicSkyEffect#cloudType}. They are a single flat
 * layer of noise ({@link CLOUDTYPE_FLAT}), or volumetric clouds ray marched through a layer of 3D
 * noise ({@link CLOUDTYPE_VOLUMETRIC}). The volumetric clouds are the expensive part of the sky,
 * and render to a texture of their own, at a reduced resolution by default, see
 * {@link DynamicSkyEffect#cloudResolution}. Their noise is generated on the CPU when the clouds are
 * first used.
 *
 * The effect also generates the lighting of the scene from its sky: the environment atlas lighting
 * the materials, assigned to {@link Scene#envAtlas}, see {@link DynamicSkyEffect#lighting}. The
 * cameras without the effect, such as the cameras rendering planar reflections, render the sky of
 * the scene from that environment atlas - a still image of this sky. The effect is not supported in
 * XR.
 *
 * The sky does not work together with the volumetric fog of the camera frame,
 * {@link CameraFrame#volumetricFog}: the clouds cast no shadows into the fog, and the fog is not lit
 * by the light of the sky.
 *
 * The effect is not part of a camera frame by default - construct it and add it to the camera
 * frame of a camera:
 *
 * ```javascript
 * const sky = new DynamicSkyEffect(app.graphicsDevice);
 * sky.light = sunEntity.light;
 * sky.cloudType = CLOUDTYPE_VOLUMETRIC;
 * cameraFrame.addEffect(sky);
 * cameraFrame.update();
 * ```
 *
 * Like all effects, its settings apply on the next {@link CameraFrame#update}, which a day and
 * night cycle moving the sun calls every frame. The clouds drift with the time of the application.
 *
 * @category Graphics
 */
class DynamicSkyEffect extends CameraFrameEffect {
    /**
     * The azimuth of the sun, in degrees - its compass direction. Defaults to 0.
     *
     * @type {number}
     */
    azimuth = 0;

    /**
     * The elevation of the sun above the horizon, in degrees. Negative values place the sun below
     * the horizon, which gives the night sky. Defaults to 25.
     *
     * @type {number}
     */
    elevation = 25;

    /**
     * The rotation of the whole sky around the vertical axis, in degrees. It is added to the
     * azimuth of the sun, so the sky, the sun and the moon turn together, along with the light and
     * the shadows it casts. Defaults to 0.
     *
     * @type {number}
     */
    rotation = 0;

    /**
     * The haziness of the atmosphere, 1-20 range. Higher values give a milkier sky and a larger
     * glow around the sun. Defaults to 2.
     *
     * @type {number}
     */
    turbidity = 2;

    /**
     * The amount of the Rayleigh scattering, 0-4 range, setting the blueness of the sky. Defaults
     * to 1.5.
     *
     * @type {number}
     */
    rayleigh = 1.5;

    /**
     * The amount of the Mie (aerosol) scattering, 0-0.1 range, setting the brightness of the glow
     * around the sun. Defaults to 0.005.
     *
     * @type {number}
     */
    mieCoefficient = 0.005;

    /**
     * The directional anisotropy of the Mie scattering, 0-1 range, setting how tightly the glow
     * hugs the sun. Defaults to 0.8.
     *
     * @type {number}
     */
    mieDirectionalG = 0.8;

    /**
     * The brightness of the sky, relative to the light of the sun. At 1, the sky lights the scene
     * with about a tenth of the light of the sun, as a clear sky does, at any elevation of the
     * sun: the blue sky and the ground lit by the sun are then of a similar brightness, so a single
     * exposure suits both. Lower values give a deeper sky, higher values a brighter one, and a
     * brighter ambient light of the scene. Defaults to 1.
     *
     * @type {number}
     */
    luminance = 1;

    /**
     * The directional light kept in sync with the sun - its direction, color and intensity. By day
     * it shines from the sun, at {@link DynamicSkyEffect#sunIntensity}, dimmed by the clouds, and
     * at night it fades to the moonlight, see {@link DynamicSkyEffect#moonIntensity}. Defaults to
     * null.
     *
     * @type {LightComponent|null}
     */
    light = null;

    /**
     * The intensity of the light of the sun: of the {@link DynamicSkyEffect#light} with the sun
     * above the horizon, and of the sunlit clouds. The sky scales with it too, see
     * {@link DynamicSkyEffect#luminance}, so it sets the brightness of the whole day, to match the
     * exposure of the camera. Defaults to 2, a sunny day at an exposure of 1.
     *
     * @type {number}
     */
    sunIntensity = 2;

    /**
     * The intensity of the {@link DynamicSkyEffect#light} at night - the moonlight, a dim cool light
     * from the direction of the moon. Defaults to 1.
     *
     * @type {number}
     */
    moonIntensity = 1;

    /**
     * The color of the moonlight, and of the moon disc. Defaults to a pale blue.
     *
     * @type {Color}
     */
    moonColor = new Color(0.792, 0.918, 1.0);

    /**
     * The direction toward the moon, in the world space, turned by the
     * {@link DynamicSkyEffect#rotation} of the sky. It does not need to be normalized. Defaults to
     * a direction high in the sky.
     *
     * @type {Vec3}
     */
    moonDirection = new Vec3(-1.53, 0.85, 0.35);

    /**
     * The angular radius of the moon disc, in degrees. Defaults to 0.6.
     *
     * @type {number}
     */
    moonSize = 0.6;

    /**
     * The brightness of the moon disc in the night sky. Defaults to 3.
     *
     * @type {number}
     */
    moonGlow = 3;

    /**
     * The color of the night sky. Defaults to a deep blue.
     *
     * @type {Color}
     */
    nightColor = new Color(0.114, 0.247, 0.408);

    /**
     * The brightness of the night sky. Defaults to 0.052.
     *
     * @type {number}
     */
    nightBrightness = 0.052;

    /**
     * The brightness of the stars. A value of 0 disables them. Defaults to 0.05.
     *
     * @type {number}
     */
    starBrightness = 0.05;

    /**
     * The density of the stars, 0-1 range - the fraction of the cells of the sky holding a star.
     * Defaults to 0.8.
     *
     * @type {number}
     */
    starDensity = 0.8;

    /**
     * The scale of the size of the stars. Defaults to 0.5.
     *
     * @type {number}
     */
    starSize = 0.5;

    /**
     * The strength of the warm glow at the horizon while the sun is just below it. Defaults to
     * 0.52.
     *
     * @type {number}
     */
    twilightGlow = 0.52;

    /**
     * The type of the clouds of the sky, {@link CLOUDTYPE_NONE}, {@link CLOUDTYPE_FLAT} or
     * {@link CLOUDTYPE_VOLUMETRIC}. Defaults to {@link CLOUDTYPE_NONE}.
     *
     * @type {string}
     */
    cloudType = CLOUDTYPE_NONE;

    /**
     * The quality of the volumetric clouds, 0-1 range - the number of their steps through the
     * cloud layer, from 24 to 64, and toward the light, from 1 to 4, and the fineness of the steps
     * through a cloud. The cost grows about linearly, doubling from 0.5 to 1. Lower values give
     * less defined edges of the clouds and a flatter shading. Defaults to 0.5.
     *
     * @type {number}
     */
    cloudQuality = 0.5;

    /**
     * The resolution the volumetric clouds render at, relative to the resolution of the scene,
     * 0.25-1 range. The clouds are soft, so a reduced resolution saves most of their cost with
     * little loss of detail. The sky blurs them over 3x3 of their texels as it reads them, smoothing
     * the grain of their steps, so lower values also soften the clouds. Defaults to 0.5.
     *
     * @type {number}
     */
    cloudResolution = 0.5;

    /**
     * The fraction of the sky covered by clouds, 0-1 range, from a clear sky to overcast. Defaults
     * to 0.45.
     *
     * @type {number}
     */
    cloudCoverage = 0.45;

    /**
     * The softness of the clouds, 0.01-1 range. Lower values give dense clouds with crisp edges
     * and deep shadows, higher values thin them into translucent, wispy clouds with softer shading.
     * Defaults to 0.7.
     *
     * @type {number}
     */
    cloudSoftness = 0.7;

    /**
     * The opacity of the clouds, 0-1 range. Defaults to 1.
     *
     * @type {number}
     */
    cloudOpacity = 1;

    /**
     * The brightness of the sunlight falling on the clouds. Defaults to 0.6.
     *
     * @type {number}
     */
    cloudBrightness = 0.6;

    /**
     * The brightness of the moonlight on the clouds at night. The moonlight of the
     * {@link DynamicSkyEffect#light} is usually much brighter than the moon, to keep the night scene
     * readable - lit by it, the clouds would glow against the dark night sky. Defaults to 0.05.
     *
     * @type {number}
     */
    cloudNightBrightness = 0.05;

    /**
     * The distance in meters over which the cloud pattern repeats. Larger values give larger
     * clouds. Defaults to 8000.
     *
     * @type {number}
     */
    cloudSize = 8000;

    /**
     * The altitude of the cloud layer, in meters. Defaults to 2000.
     *
     * @type {number}
     */
    cloudHeight = 2000;

    /**
     * The thickness of the layer of the volumetric clouds, in meters, above their
     * {@link DynamicSkyEffect#cloudHeight}. Defaults to 2500.
     *
     * @type {number}
     */
    cloudThickness = 2500;

    /**
     * The fraction of the sunlight the clouds block at the full coverage, dimming the
     * {@link DynamicSkyEffect#light}. Defaults to 0.6.
     *
     * @type {number}
     */
    cloudSunDimming = 0.6;

    /**
     * The speed the clouds drift with, in meters per second. Defaults to 10.
     *
     * @type {number}
     */
    windSpeed = 10;

    /**
     * The direction the clouds drift toward, in degrees around the vertical axis. Defaults to 45.
     *
     * @type {number}
     */
    windDirection = 45;

    /**
     * Whether the effect generates the lighting of the scene from its sky - the environment atlas
     * lighting the materials, assigned to {@link Scene#envAtlas}. Only one effect should do so, the
     * one of the main camera. The lighting is generated when the effect is first used, and again
     * when the sun moves by {@link DynamicSkyEffect#lightingThreshold}, when a setting of the sky
     * changes by more than a percent, when the clouds drift by {@link DynamicSkyEffect#lightingCloudThreshold}, and when
     * {@link DynamicSkyEffect#bakeLighting} is called. The clouds are a still image in the
     * lighting, and the sun disc is left out of it, as the {@link DynamicSkyEffect#light} carries
     * the light of the sun. Defaults to true.
     *
     * @type {boolean}
     */
    lighting = true;

    /**
     * The resolution of the sky the lighting is generated from, the size of the faces of a
     * cubemap, in texels. The sky is filtered down from it to the environment atlas, so it should
     * be well above the resolution of the atlas: at lower values, the detail of the clouds
     * aliases, and their reflections flicker on each update of the lighting as the clouds drift.
     * Defaults to 256.
     *
     * @type {number}
     */
    lightingResolution = 256;

    /**
     * The size of the environment atlas the lighting is generated to. Higher values give sharper
     * reflections on glossy surfaces, and a sharper sky of the scene for the cameras without the
     * effect, such as the cameras rendering planar reflections. Defaults to 512.
     *
     * @type {number}
     */
    atlasSize = 512;

    /**
     * The angle the sun moves by, in degrees, before the lighting is generated again - keeping the
     * cost of a day and night cycle down. Defaults to 0.5.
     *
     * @type {number}
     */
    lightingThreshold = 0.5;

    /**
     * The distance the clouds drift by, as a fraction of the {@link DynamicSkyEffect#cloudSize},
     * before the lighting is generated again, so the clouds in it follow the clouds of the sky. A
     * value of 0 disables it, and the drift of the clouds does not generate the lighting again.
     * Defaults to 0.
     *
     * @type {number}
     */
    lightingCloudThreshold = 0;

    /**
     * Whether the lighting blends from its previous update to its latest one, instead of changing
     * at once. While the sky changes gradually, such as with an animated time of day, each update
     * blends in over the time since the previous one, up to a second, so the lighting follows the
     * sky smoothly, about one update behind it. Without it, the lighting steps at each update,
     * which shows as flicker in the reflections of a quickly changing sky on glossy surfaces, such
     * as water. Sudden changes, such as a jump of the time of day, and
     * {@link DynamicSkyEffect#bakeLighting}, still apply at once. It costs two more environment
     * atlases of memory, and a small pass each frame while the lighting blends, so enable it only
     * when the sky changes continuously. Defaults to false.
     *
     * @type {boolean}
     */
    lightingInterpolation = false;

    /**
     * The values of the uniforms the shaders of the sky read, shared by its material and its
     * passes.
     *
     * @type {Map<string, number|Float32Array|Texture>}
     * @private
     */
    _skyUniforms = new Map();

    /**
     * The scope ids of the uniforms, resolved once, for the passes.
     *
     * @type {Map<string, ScopeId>}
     * @private
     */
    _scopeIds = new Map();

    /** @private */
    _sunDir = new Vec3();

    /** @private */
    _skyDir = new Vec3();

    /** @private */
    _sunColor = new Color();

    /** @private */
    _warmColor = new Color(1.0, 0.6, 0.35);

    /** @private */
    _zenithColor = new Color(1.0, 1.0, 0.98);

    /** @private */
    _sunDirValue = new Float32Array(3);

    /** @private */
    _betaR = new Float32Array(3);

    /** @private */
    _betaM = new Float32Array(3);

    /** @private */
    _nightColor = new Float32Array(3);

    /** @private */
    _nightParams = new Float32Array(4);

    /** @private */
    _moonDir = new Float32Array(3);

    /** @private */
    _moonParams = new Float32Array(4);

    /** @private */
    _cloudParams = new Float32Array(4);

    /**
     * The drift of the cloud shapes (xy) and of their detail (zw), in pattern repeats.
     *
     * @private
     */
    _cloudOffset = new Float32Array(4);

    /** @private */
    _cloudShading = new Float32Array(4);

    /** @private */
    _cloudVolume = new Float32Array(4);

    /** @private */
    _cloudLight = new Float32Array(3);

    /** @private */
    _cloudLightDir = new Float32Array(3);

    /** @private */
    _invView = new Float32Array(16);

    /** @private */
    _projScale = new Float32Array(2);

    /** @private */
    _bufferMatrix = new Float32Array(9);

    /** @private */
    _bufferProj = new Float32Array(2);

    /** @private */
    _rotation = new Float32Array(9);

    /** @private */
    _frameIndex = 0;

    /**
     * The scene of the camera frame, once the passes were created.
     *
     * @type {import('../../../scene/scene.js').Scene|null}
     * @private
     */
    _scene = null;

    /**
     * The material, the mesh instance and the node of the sky, created when the passes of the
     * effect are first created.
     *
     * @type {ShaderMaterial|null}
     * @private
     */
    _material = null;

    /**
     * @type {MeshInstance|null}
     * @private
     */
    _meshInstance = null;

    /**
     * @type {GraphNode|null}
     * @private
     */
    _node = null;

    /**
     * The layer the mesh instance of the sky is added to, while the passes exist.
     *
     * @type {Layer|null}
     * @private
     */
    _layer = null;

    /**
     * The camera rendering the sky, while the passes exist.
     *
     * @type {Camera|null}
     * @private
     */
    _camera = null;

    /**
     * The camera frame the passes were created for. The passes keep rendering for a frame after the
     * effect is removed from it, until it next updates, so they refer to it rather than to
     * {@link CameraFrameEffect#cameraFrame}.
     *
     * @type {import('../../render-passes/camera-frame.js').CameraFrame|null}
     * @private
     */
    _passesCameraFrame = null;

    /**
     * @type {FramePassDynamicSkyLighting|null}
     * @private
     */
    _lightingPass = null;

    /**
     * @type {RenderPassDynamicSkyClouds|null}
     * @private
     */
    _cloudPass = null;

    /**
     * @type {RenderTarget|null}
     * @private
     */
    _cloudTarget = null;

    /** @private */
    _cloudEncoded = false;

    /**
     * The cubemap the sky is rendered to for the lighting, its render targets, and the
     * environment atlas generated from it.
     *
     * @type {Texture|null}
     * @private
     */
    _lightingSource = null;

    /**
     * @type {RenderTarget[]}
     * @private
     */
    _faceTargets = [];

    /**
     * @type {Texture|null}
     * @private
     */
    _envAtlas = null;

    /**
     * With the lighting interpolated, the environment atlas the lighting is generated to, the one
     * it blends from, and the render target of the environment atlas of the scene, which shows the
     * blend.
     *
     * @type {Texture|null}
     * @private
     */
    _atlasLatest = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _atlasPrevious = null;

    /**
     * @type {RenderTarget|null}
     * @private
     */
    _envAtlasTarget = null;

    /**
     * The progress of the blend of the lighting, 0-1, where 1 has it done, and its duration in
     * seconds.
     *
     * @private
     */
    _blendWeight = 1;

    /** @private */
    _blendDuration = 0;

    /**
     * The time since the lighting was generated, and the time of this frame, in seconds.
     *
     * @private
     */
    _timeSinceBake = 0;

    /** @private */
    _frameDt = 0;

    /**
     * The shaders rendering the sky for the lighting, by their variant.
     *
     * @type {Map<string, Shader>}
     * @private
     */
    _bakeShaders = new Map();

    /**
     * The shader blending the lighting.
     *
     * @type {Shader|null}
     * @private
     */
    _blendShader = null;

    /**
     * Whether the lighting is due to be generated, for a reason other than the thresholds.
     *
     * @private
     */
    _bakeRequested = true;

    /**
     * Whether the sun moved, or the settings of the sky changed, since the lighting was generated.
     *
     * @private
     */
    _bakeDue = false;

    /**
     * Whether the sky changed by a jump since the lighting was generated, see
     * LIGHTING_JUMP_THRESHOLDS.
     *
     * @private
     */
    _bakeJump = false;

    /**
     * Whether the lighting is generated this frame.
     *
     * @private
     */
    _bakePending = false;

    /**
     * The sky direction of the sun the lighting was last generated for.
     *
     * @private
     */
    _bakedSkyDir = new Vec3(0, -1, 0);

    /**
     * The direction of the moon, which lights the clouds at night, and the one the lighting was
     * last generated for.
     *
     * @private
     */
    _moonWorldDir = new Vec3();

    /** @private */
    _bakedMoonDir = new Vec3(0, -1, 0);

    /**
     * The settings of the sky the lighting was last generated for.
     *
     * @private
     */
    _bakedSettings = new Float32Array(32);

    /** @private */
    _settings = new Float32Array(32);

    /**
     * The distance the clouds drifted by since the lighting was generated, in pattern repeats.
     *
     * @private
     */
    _driftSinceBake = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'dynamicSky');

        // the chunks of the shaders, which can be overridden like the engine's own
        const glsl = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
        const wgsl = ShaderChunks.get(device, SHADERLANGUAGE_WGSL);
        glsl.set('dynamicSkyAtmospherePS', glslAtmospherePS);
        glsl.set('dynamicSkyCloudsPS', glslCloudsPS);
        glsl.set('dynamicSkyPS', glslSkyPS);
        glsl.set('dynamicSkyCloudBufferPS', glslCloudBufferPS);
        glsl.set('dynamicSkyBakePS', glslBakePS);
        glsl.set('dynamicSkyLightingBlendPS', glslLightingBlendPS);
        wgsl.set('dynamicSkyAtmospherePS', wgslAtmospherePS);
        wgsl.set('dynamicSkyCloudsPS', wgslCloudsPS);
        wgsl.set('dynamicSkyPS', wgslSkyPS);
        wgsl.set('dynamicSkyCloudBufferPS', wgslCloudBufferPS);
        wgsl.set('dynamicSkyBakePS', wgslBakePS);
        wgsl.set('dynamicSkyLightingBlendPS', wgslLightingBlendPS);

        const values = this._skyUniforms;
        values.set('dynSkySunDir', this._sunDirValue);
        values.set('dynSkyBetaR', this._betaR);
        values.set('dynSkyBetaM', this._betaM);
        values.set('dynSkyNightColor', this._nightColor);
        values.set('dynSkyNightParams', this._nightParams);
        values.set('dynSkyMoonDir', this._moonDir);
        values.set('dynSkyMoonParams', this._moonParams);
        values.set('dynSkyCloudParams', this._cloudParams);
        values.set('dynSkyCloudOffset', this._cloudOffset);
        values.set('dynSkyCloudShading', this._cloudShading);
        values.set('dynSkyCloudVolume', this._cloudVolume);
        values.set('dynSkyCloudLight', this._cloudLight);
        values.set('dynSkyCloudLightDir', this._cloudLightDir);
        values.set('dynSkyInvView', this._invView);
        values.set('dynSkyProjScale', this._projScale);
        values.set('dynSkyRotation', this._rotation);
        values.set('dynSkyBufferMatrix', this._bufferMatrix);
        values.set('dynSkyBufferProj', this._bufferProj);

        // the render targets lose their content with the device
        device.on('devicerestored', this._onDeviceRestored, this);
    }

    destroy() {
        this.device?.off('devicerestored', this._onDeviceRestored, this);

        // releases the passes
        super.destroy();

        this._meshInstance?.destroy();
        this._meshInstance = null;
        this._material?.destroy();
        this._material = null;
        this._node = null;

        this._destroyLightingSource();
        this._destroyInterpolationTargets();
        if (this._envAtlas) {
            const scene = this._scene;
            if (scene?.envAtlas === this._envAtlas) {
                scene.envAtlas = null;
            }
            this._envAtlas.destroy();
            this._envAtlas = null;
        }
        this._scene = null;
    }

    /**
     * The effect renders the sky of its camera, in place of the sky of the scene.
     *
     * @type {boolean}
     * @ignore
     */
    get rendersSky() {
        return true;
    }

    /**
     * Whether the sky has clouds.
     *
     * @type {boolean}
     * @private
     */
    get _hasClouds() {
        return this.cloudType !== CLOUDTYPE_NONE;
    }

    /**
     * Whether the volumetric clouds render to a texture of their own, which they do for the cameras
     * with a perspective projection.
     *
     * @type {boolean}
     * @private
     */
    get _cloudsBuffered() {
        return this.cloudType === CLOUDTYPE_VOLUMETRIC &&
            this.cameraFrame?.cameraComponent.projection === PROJECTION_PERSPECTIVE;
    }

    /**
     * Requests the lighting of the scene to be generated from the sky again, before the next frame
     * renders. Use it when the lighting should follow a change it does not regenerate for on its
     * own, such as the drift of the clouds with {@link DynamicSkyEffect#lightingCloudThreshold}
     * disabled.
     */
    bakeLighting() {
        this._bakeRequested = true;
    }

    /** @private */
    _onDeviceRestored() {
        this._bakeRequested = true;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {
        const { device, cameraFrame } = this;
        const scene = cameraFrame.app.scene;
        this._scene = scene;
        this._camera = cameraFrame.cameraComponent.camera;
        this._passesCameraFrame = cameraFrame;

        // the sky, drawn by the camera where the sky of the scene is drawn
        this._createSky();
        const layer = scene.layers.getLayerById(LAYERID_SKYBOX);
        Debug.assert(layer, 'DynamicSkyEffect: the scene has no Skybox layer, so the sky is not rendered.');
        if (layer) {
            layer.addMeshInstances([this._meshInstance]);
            this._layer = layer;
        }

        // the lighting, generated before the scene renders on the frames it is due
        this._lightingPass = new FramePassDynamicSkyLighting(device, this);
        passes.preScene.push(this._lightingPass);

        // the volumetric clouds, rendered to a texture of their own
        if (this._cloudsBuffered) {
            const format = device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F], true, 1) ?? PIXELFORMAT_RGBA8;
            this._cloudEncoded = format === PIXELFORMAT_RGBA8;
            const texture = new Texture(device, {
                name: 'DynamicSkyClouds',
                width: 4,
                height: 4,
                format,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            this._cloudTarget = new RenderTarget({ name: 'DynamicSkyClouds', colorBuffer: texture, depth: false });

            const defines = new Map();
            defines.set('DYNSKY_CLOUDS_VOLUMETRIC', '');
            if (this._cloudEncoded) defines.set('DYNSKY_CLOUDS_ENCODED', '');

            const pass = new RenderPassDynamicSkyClouds(device, this);
            pass.shader = ShaderUtils.createShader(device, {
                uniqueName: `DynamicSkyCloudBuffer-${this._cloudEncoded}`,
                attributes: { aPosition: SEMANTIC_POSITION },
                vertexChunk: 'quadVS',
                fragmentChunk: 'dynamicSkyCloudBufferPS',
                fragmentDefines: defines
            });
            pass.init(this._cloudTarget);
            this._cloudPass = pass;
            passes.preScene.push(pass);
        }
    }

    /**
     * @ignore
     */
    destroyPasses() {
        if (this._layer && this._meshInstance) {
            this._layer.removeMeshInstances([this._meshInstance]);
        }
        this._layer = null;
        this._camera = null;
        this._passesCameraFrame = null;

        this._lightingPass?.destroy();
        this._lightingPass = null;

        this._cloudPass?.destroy();
        this._cloudPass = null;
        if (this._cloudTarget) {
            this._cloudTarget.destroyTextureBuffers();
            this._cloudTarget.destroy();
            this._cloudTarget = null;
        }
    }

    /**
     * @returns {string} The key.
     * @ignore
     */
    buildKey() {
        return `${this._cloudsBuffered}`;
    }

    /**
     * Creates the material, the mesh instance and the node of the sky, on the first use.
     *
     * @private
     */
    _createSky() {
        if (this._material) {
            return;
        }

        const { device } = this;
        const glsl = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
        const wgsl = ShaderChunks.get(device, SHADERLANGUAGE_WGSL);

        // the vertex shader of the engine's sky places it at the far plane, and supports the
        // depth prepass
        const material = new ShaderMaterial({
            uniqueName: 'DynamicSkyMaterial',
            vertexGLSL: glsl.get('skyboxVS'),
            fragmentGLSL: glsl.get('dynamicSkyPS'),
            vertexWGSL: wgsl.get('skyboxVS'),
            fragmentWGSL: wgsl.get('dynamicSkyPS'),
            attributes: {
                aPosition: SEMANTIC_POSITION
            }
        });
        material.cull = CULLFACE_FRONT;
        material.depthWrite = false;
        this._material = material;

        this._node = new GraphNode('DynamicSkyNode');
        const meshInstance = new MeshInstance(SkyGeometry.create(device, SKYTYPE_INFINITE), material, this._node);

        // rendered by the camera of the effect only, culled for all the others, and only while its
        // camera frame renders the passes of the effect - from the next update after the effect
        // is removed, or as the camera frame is disabled, the camera renders the sky of the scene
        meshInstance.cull = true;
        meshInstance.isVisibleFunc = camera => camera === this._camera &&
            !!this._passesCameraFrame?.renderPassCamera?.hasEffectPasses(this);
        meshInstance.pick = false;
        this._meshInstance = meshInstance;
    }

    /**
     * Sets the value of a uniform the shaders of the sky read.
     *
     * @param {string} name - The name of the uniform.
     * @param {number|Float32Array|Texture} value - The value.
     * @private
     */
    _setSkyUniform(name, value) {
        this._skyUniforms.set(name, value);
    }

    /**
     * Binds the values of the uniforms of the sky to the device scope, for the passes.
     *
     * @ignore
     */
    _bindSkyUniforms() {
        const scope = this.device.scope;
        for (const [name, value] of this._skyUniforms) {
            let scopeId = this._scopeIds.get(name);
            if (!scopeId) {
                scopeId = scope.resolve(name);
                this._scopeIds.set(name, scopeId);
            }
            scopeId.setValue(value);
        }
    }

    /**
     * Applies the values of the uniforms of the sky to its material.
     *
     * @private
     */
    _applyToMaterial() {
        const material = this._material;
        if (material) {
            for (const [name, value] of this._skyUniforms) {
                material.setParameter(name, value);
            }
            material.update();
        }
    }

    /**
     * Computes the world space direction toward the sun.
     *
     * @param {Vec3} out - The vector to receive the result.
     * @returns {Vec3} The direction.
     * @private
     */
    _computeSunDir(out) {
        const el = this.elevation * math.DEG_TO_RAD;
        const az = (this.azimuth + this.rotation) * math.DEG_TO_RAD;
        const cosEl = Math.cos(el);
        return out.set(cosEl * Math.sin(az), Math.sin(el), cosEl * Math.cos(az)).normalize();
    }

    /**
     * Computes the world space direction toward the moon, turned by the rotation of the sky.
     *
     * @param {Vec3} out - The vector to receive the result.
     * @returns {Vec3} The direction.
     * @private
     */
    _computeMoonDir(out) {
        const a = this.rotation * math.DEG_TO_RAD;
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        const { x, y, z } = this.moonDirection;

        // rotate around Y in the direction an increasing azimuth turns
        return out.set(x * cos + z * sin, y, z * cos - x * sin).normalize();
    }

    /**
     * Computes the scattering terms of the atmosphere which are the same for the whole sky.
     *
     * @private
     */
    _updateAtmosphere() {
        const sunY = this._skyDir.y;

        // the Rayleigh scattering weakens as the sun sets below the horizon. It is kept above zero:
        // a negative scattering would turn the extinction of the light into a gain, and the sky
        // without any scattering would divide zero by zero
        const sunfade = 1.0 - math.clamp(1.0 - Math.exp(sunY), 0, 1);
        const rayleighCoeff = Math.max(this.rayleigh - (1.0 - sunfade), 1e-4);
        for (let i = 0; i < 3; i++) {
            this._betaR[i] = SKY_TOTAL_RAYLEIGH[i] * rayleighCoeff;
        }

        const mieC = 0.434 * (0.2 * Math.max(this.turbidity, 0) * 1e-18) * Math.max(this.mieCoefficient, 0);
        for (let i = 0; i < 3; i++) {
            this._betaM[i] = SKY_MIE_CONST[i] * mieC;
        }

        const zenithCos = math.clamp(sunY, -1, 1);
        this._setSkyUniform('dynSkySunE', SKY_EE * Math.max(0, 1.0 - Math.exp(-((SKY_CUTOFF - Math.acos(zenithCos)) / SKY_STEEPNESS))));
        // a fully forward scattering would divide by zero toward the sun
        this._setSkyUniform('dynSkyMieG', math.clamp(this.mieDirectionalG, 0, 0.999));

        // the sky balanced against the light of the sun, see SKY_BALANCE. The balance is held below
        // about 6 degrees, where the light of the sun fades out, and the sky darkens with it into
        // the twilight
        this._setSkyUniform('dynSkyLuminance', this.luminance * this.sunIntensity * SKY_BALANCE / Math.max(sunY, 0.1));
    }

    /**
     * Computes the light of the sun and the moon - the light falling on the clouds, and the light
     * of the scene when there is one.
     *
     * @private
     */
    _updateLight() {

        // the light crossfades from the sun to the moon once the sun dips below the horizon, so
        // while the sun is visible the light matches it
        const nightFactor = math.clamp(-this.elevation / 6, 0, 1);
        this._computeMoonDir(tmpMoon);
        const src = tmpSrc.lerp(this._sunDir, tmpMoon, nightFactor).normalize();

        // warm to white sun by day, cold moon by night
        const y = this._sunDir.y;
        const sunColor = this._sunColor;
        sunColor.lerp(this._warmColor, this._zenithColor, math.clamp(y / 0.4, 0, 1));
        sunColor.lerp(sunColor, this.moonColor, nightFactor);

        // the light of a low sun crosses a long path through the air, which dims it, so on the clouds
        // it fades in as the sun rises, reaching its full intensity at about 17 degrees - around the
        // sunrise and the sunset the clouds are lit mostly by the sky around them. At night they
        // are lit by their own moonlight
        const cloudIntensity = (this.sunIntensity * math.smoothstep(0, 0.3, y) +
            this.cloudNightBrightness * nightFactor) * this.cloudBrightness;
        this._cloudLight[0] = Math.pow(sunColor.r, 2.2) * cloudIntensity;
        this._cloudLight[1] = Math.pow(sunColor.g, 2.2) * cloudIntensity;
        this._cloudLight[2] = Math.pow(sunColor.b, 2.2) * cloudIntensity;
        this._cloudLightDir[0] = -src.x;
        this._cloudLightDir[1] = src.y;
        this._cloudLightDir[2] = src.z;

        // the brightness of the light on the clouds, which the clouds stored at 8 bits per channel
        // are divided by, so the dark clouds of the night keep their precision - the light of the
        // sun, of the sky around them, about a tenth of the light of the sun (see SKY_BALANCE),
        // or of the night sky
        const cloudLight = this._cloudLight;
        const nightAmbient = this._nightColor;
        const skyLight = this.luminance * this.sunIntensity * SKY_BALANCE * 2 * Math.max(y, 0) / Math.max(y, 0.1);
        this._setSkyUniform('dynSkyCloudScale', Math.max(
            0.2126 * cloudLight[0] + 0.7152 * cloudLight[1] + 0.0722 * cloudLight[2],
            skyLight,
            (0.2126 * nightAmbient[0] + 0.7152 * nightAmbient[1] + 0.0722 * nightAmbient[2]) * 0.6,
            1e-5
        ));

        const light = this.light;
        if (!light) {
            return;
        }
        if (light.type !== 'directional') {
            Debug.warnOnce('DynamicSkyEffect: the light needs to be a directional light, it is not kept in sync with the sun.');
            return;
        }

        // a directional light shines down the negative Y axis of its entity, so its +Y axis points
        // toward the source
        const ref = Math.abs(src.y) > 0.99 ? Vec3.RIGHT : Vec3.UP;
        tmpX.cross(src, ref).normalize();
        tmpZ.cross(tmpX, src).normalize();
        tmpMat.set([
            tmpX.x, tmpX.y, tmpX.z, 0,
            src.x, src.y, src.z, 0,
            tmpZ.x, tmpZ.y, tmpZ.z, 0,
            0, 0, 0, 1
        ]);
        tmpQuat.setFromMat4(tmpMat);
        light.entity.setRotation(tmpQuat);
        light.color = sunColor;

        // the sun fades out below the horizon while the moon fades in, and the clouds dim the light
        // below them
        const sunPart = this.sunIntensity * math.clamp(y / 0.1, 0, 1);
        const moonPart = this.moonIntensity * nightFactor;
        const dimming = this._hasClouds ? this.cloudCoverage * this.cloudSunDimming : 0;
        light.intensity = (sunPart + moonPart) * (1 - dimming);
    }

    /**
     * Computes the values of the night sky and the moon.
     *
     * @private
     */
    _updateNight() {
        this._setSkyUniform('dynSkyNightBlend', math.clamp((2 - this.elevation) / 10, 0, 1));

        const brightness = this.nightBrightness;
        this._nightColor[0] = this.nightColor.r * brightness;
        this._nightColor[1] = this.nightColor.g * brightness;
        this._nightColor[2] = this.nightColor.b * brightness;

        const night = this._nightParams;
        night[0] = this.starBrightness;
        night[1] = this.starDensity;
        night[2] = this.starSize;
        night[3] = this.twilightGlow;

        this._computeMoonDir(tmpMoon);
        this._moonDir[0] = -tmpMoon.x;
        this._moonDir[1] = tmpMoon.y;
        this._moonDir[2] = tmpMoon.z;

        const moon = this._moonParams;
        moon[0] = this.moonColor.r * this.moonGlow;
        moon[1] = this.moonColor.g * this.moonGlow;
        moon[2] = this.moonColor.b * this.moonGlow;
        moon[3] = Math.cos(this.moonSize * math.DEG_TO_RAD);
    }

    /**
     * Computes the values of the clouds, and creates their noise on their first use.
     *
     * @private
     */
    _updateClouds() {
        const clouds = this._hasClouds;
        const volumetric = this.cloudType === CLOUDTYPE_VOLUMETRIC;
        const quality = this.cloudQuality;

        const params = this._cloudParams;
        params[0] = clouds ? math.clamp(this.cloudCoverage, 0, 1) : 0;
        params[1] = Math.max(this.cloudSoftness, 0.01);
        params[2] = 1000 / Math.max(this.cloudSize, 1);
        params[3] = this.cloudHeight / 1000;

        const shading = this._cloudShading;
        shading[0] = math.clamp(this.cloudOpacity, 0, 1);
        shading[2] = cloudQualityValue(CLOUD_QUALITY_FINE_STEP, quality);

        const volume = this._cloudVolume;
        volume[0] = this.cloudHeight / 1000;
        volume[1] = (this.cloudHeight + Math.max(this.cloudThickness, 10)) / 1000;
        volume[2] = Math.min(Math.round(cloudQualityValue(CLOUD_QUALITY_STEPS, quality)), CLOUD_MAX_STEPS);
        volume[3] = Math.min(Math.round(cloudQualityValue(CLOUD_QUALITY_LIGHT_STEPS, quality)), CLOUD_MAX_LIGHT_STEPS);

        // the noise is generated on the first use of the clouds, and the 3D noise of the volumetric
        // clouds on their first use
        if (clouds) {
            const noise = getDynamicSkyNoise(this.device);
            this._setSkyUniform('dynSkyCloudMap', noise.cloudMap);
            if (volumetric) {
                this._setSkyUniform('dynSkyCloudShapeMap', noise.shapeMap);
                this._setSkyUniform('dynSkyCloudDetailMap', noise.detailMap);
                this._setSkyUniform('dynSkyBlueNoise', getBlueNoiseTexture(this.device));
            }
        }
    }

    /**
     * Sets the defines of the material, selecting the clouds it renders.
     *
     * @private
     */
    _updateDefines() {
        const material = this._material;
        if (material) {
            const volumetric = this.cloudType === CLOUDTYPE_VOLUMETRIC;
            const buffered = !!this._cloudPass;
            material.setDefine('DYNSKY_CLOUDS_FLAT', this.cloudType === CLOUDTYPE_FLAT);
            material.setDefine('DYNSKY_CLOUDS_VOLUMETRIC', volumetric);
            material.setDefine('DYNSKY_CLOUDS_BUFFER', volumetric && buffered);
            material.setDefine('DYNSKY_CLOUDS_ENCODED', volumetric && buffered && this._cloudEncoded);
        }
    }

    /**
     * Fills the settings the lighting depends on, to tell when they change.
     *
     * @param {Float32Array} out - The array to fill.
     * @private
     */
    _fillSettings(out) {
        out[0] = this.rayleigh;
        out[1] = this.turbidity;
        out[2] = this.mieCoefficient;
        out[3] = this.mieDirectionalG;
        out[4] = this.luminance;
        out[5] = this.lightingResolution;
        out[6] = this.atlasSize;
        out[7] = this.nightColor.r;
        out[8] = this.nightColor.g;
        out[9] = this.nightColor.b;
        out[10] = this.nightBrightness;
        out[11] = this.twilightGlow;
        out[12] = this.cloudType === CLOUDTYPE_FLAT ? 1 : 0;
        out[13] = this.cloudType === CLOUDTYPE_VOLUMETRIC ? 1 : 0;
        out[14] = this.cloudCoverage;
        out[15] = this.cloudSoftness;
        out[16] = this.cloudOpacity;
        out[17] = this.cloudBrightness;
        out[18] = this.cloudNightBrightness;
        out[19] = this.cloudSize;
        out[20] = this.cloudHeight;
        out[21] = this.cloudThickness;
        out[22] = this.cloudQuality;
        out[23] = this.sunIntensity;
        out[24] = this.moonColor.r;
        out[25] = this.moonColor.g;
        out[26] = this.moonColor.b;
    }

    /**
     * Whether a setting the lighting depends on changed by more than a fraction since the lighting
     * was generated.
     *
     * @param {number} tolerance - The fraction.
     * @returns {boolean} True when a setting changed by more.
     * @private
     */
    _settingsChanged(tolerance) {
        const settings = this._settings;
        const baked = this._bakedSettings;
        for (let i = 0; i < settings.length; i++) {
            const value = settings[i];
            const bakedValue = baked[i];
            if (Math.abs(value - bakedValue) > tolerance * Math.max(Math.abs(value), Math.abs(bakedValue))) {
                return true;
            }
        }
        return false;
    }

    update() {

        // the sun in the world space, and in the sky space, which flips X
        this._computeSunDir(this._sunDir);
        this._skyDir.set(-this._sunDir.x, this._sunDir.y, this._sunDir.z);
        this._sunDirValue[0] = this._skyDir.x;
        this._sunDirValue[1] = this._skyDir.y;
        this._sunDirValue[2] = this._skyDir.z;

        this._updateAtmosphere();
        this._updateNight();
        this._updateLight();
        this._updateClouds();
        this._updateDefines();

        // the lighting is due when the sun or the moon moved enough, or a setting of the sky
        // changed by more than a small fraction since the lighting was generated - settings
        // animated every frame, such as the luminance over a day, then generate it as their change
        // adds up
        this._fillSettings(this._settings);
        this._computeMoonDir(this._moonWorldDir);
        const cos = Math.min(this._skyDir.dot(this._bakedSkyDir), this._moonWorldDir.dot(this._bakedMoonDir));
        const moved = cos < Math.cos(this.lightingThreshold * math.DEG_TO_RAD);
        this._bakeDue = moved || this._settingsChanged(LIGHTING_SETTINGS_TOLERANCE);

        // a change too large to have come from the gradual change of the sky applies at once
        this._bakeJump = cos < Math.cos(this.lightingThreshold * LIGHTING_JUMP_THRESHOLDS * math.DEG_TO_RAD) ||
            this._settingsChanged(LIGHTING_JUMP_TOLERANCE);

        // the environment atlas is assigned before the frame renders, so the materials are set up
        // for it, and its content is generated before the scene renders
        if (this.lighting) {
            this._createLightingTargets();
            const scene = this._scene ?? this.cameraFrame?.app.scene;
            if (scene && scene.envAtlas !== this._envAtlas) {
                scene.envAtlas = this._envAtlas;
                this._scene = scene;
            }
        }

        this._applyToMaterial();
    }

    /**
     * @param {CameraFrameEffectContext} frame - The values of this frame.
     */
    frameUpdate(frame) {
        const camera = this._camera;

        // the clouds drift with the wind, in pattern repeats of the sky space (X flipped). The
        // shapes wrap after four repeats, the repeat of the weather pattern of the volumetric
        // clouds. Their detail drifts a little faster and in a slightly different direction, so the
        // clouds evolve as they move
        if (this._hasClouds && frame.dt > 0) {
            const angle = this.windDirection * math.DEG_TO_RAD;
            const step = (this.windSpeed * frame.dt) / Math.max(this.cloudSize, 1);
            const offset = this._cloudOffset;
            offset[0] = wrap(offset[0] + Math.cos(angle) * step, 4);
            offset[1] = wrap(offset[1] - Math.sin(angle) * step, 4);
            offset[2] = wrap(offset[2] + Math.cos(angle + 0.2) * step * CLOUD_DETAIL_SCALE * 1.3, 1);
            offset[3] = wrap(offset[3] - Math.sin(angle + 0.2) * step * CLOUD_DETAIL_SCALE * 1.3, 1);
            this._driftSinceBake += Math.abs(step);
        }

        // with the frames accumulated by the temporal anti-aliasing, the steps of the clouds are
        // offset differently every frame, so their grain is resolved
        this._frameIndex++;
        this._cloudShading[3] = camera.jitter > 0 ? (this._frameIndex * 0.618034) % 1 : 0;

        // the rotation of the sky of the scene, which its vertex shader applies
        this._rotation.set(this._scene?._skyboxRotationMat3.data ?? IDENTITY_MAT3);

        // the texture of the volumetric clouds at their resolution, and the camera they are rendered for
        if (this._cloudTarget) {
            const scale = math.clamp(this.cloudResolution, 0.25, 1);
            const width = Math.max(1, Math.round(frame.renderWidth * scale));
            const height = Math.max(1, Math.round(frame.renderHeight * scale));
            this._cloudTarget.resize(width, height);
            this._setSkyUniform('dynSkyCloudBuffer', this._cloudTarget.colorBuffer);

            // the direction of each texel of the clouds, from the transform of the camera
            const proj = camera.projectionMatrix.data;
            this._projScale[0] = 1 / proj[0];
            this._projScale[1] = 1 / proj[5];
            this._bufferProj[0] = proj[0];
            this._bufferProj[1] = proj[5];
            const world = camera.node.getWorldTransform();
            this._invView.set(world.data);

            // the sky reads them projecting its direction, which the rotation of the sky turned, to
            // the view space of the camera
            const view = tmpView.copy(world).invert().data;
            const rot = this._rotation;
            const m = this._bufferMatrix;
            for (let c = 0; c < 3; c++) {
                for (let r = 0; r < 3; r++) {
                    m[c * 3 + r] = view[r] * rot[c * 3] + view[4 + r] * rot[c * 3 + 1] + view[8 + r] * rot[c * 3 + 2];
                }
            }
        }

        // the lighting is generated before the scene renders, on the frames it is due, and blends
        // on the frames after it while it is interpolated
        this._timeSinceBake += frame.dt;
        this._frameDt = frame.dt;
        const pass = this._lightingPass;
        if (pass) {
            const drift = this._hasClouds && this.lightingCloudThreshold > 0 && this._driftSinceBake >= this.lightingCloudThreshold;
            this._bakePending = this.lighting && (this._bakeRequested || this._bakeDue || drift);
            pass.executeEnabled = this._bakePending || (this.lighting && this._blendWeight < 1);
        }

        this._applyToMaterial();
    }

    /**
     * Creates the cubemap the sky is rendered to for the lighting, and the environment atlas,
     * when they do not exist or their size changed.
     *
     * @private
     */
    _createLightingTargets() {
        const { device } = this;

        const size = Math.max(8, Math.round(this.lightingResolution));
        if (this._lightingSource?.width !== size) {
            this._destroyLightingSource();

            // the format the engine generates the lighting source in
            const format = device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F :
                device.textureFloatRenderable ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA8;
            const source = new Texture(device, {
                name: 'DynamicSkyLightingSource',
                cubemap: true,
                width: size,
                height: size,
                format,
                type: format === PIXELFORMAT_RGBA8 ? TEXTURETYPE_RGBP : TEXTURETYPE_DEFAULT,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE,
                mipmaps: true
            });
            this._lightingSource = source;
            for (let face = 0; face < 6; face++) {
                this._faceTargets.push(new RenderTarget({
                    name: `DynamicSkyLightingFace${face}`,
                    colorBuffer: source,
                    face,
                    depth: false,
                    origin: RENDERTARGET_ORIGIN_BOTTOM
                }));
            }
            this._bakeRequested = true;
        }

        const atlasSize = Math.max(64, Math.round(this.atlasSize));
        if (this._envAtlas?.width !== atlasSize) {
            this._envAtlas?.destroy();
            this._envAtlas = this._createAtlas('DynamicSkyEnvAtlas', atlasSize);
            this._bakeRequested = true;
        }

        // interpolated, the lighting is generated to an atlas of its own, and blended from the
        // previous one to the atlas of the scene, which is assigned to the scene once - a change of
        // the atlas of the scene would set the sky of the scene up again
        if (this.lightingInterpolation) {
            if (this._atlasLatest?.width !== atlasSize) {
                this._destroyInterpolationTargets();
                this._atlasLatest = this._createAtlas('DynamicSkyEnvAtlasLatest', atlasSize);
                this._atlasPrevious = this._createAtlas('DynamicSkyEnvAtlasPrevious', atlasSize);
                this._bakeRequested = true;
            }
            if (this._envAtlasTarget?.colorBuffer !== this._envAtlas) {
                this._envAtlasTarget?.destroy();
                this._envAtlasTarget = new RenderTarget({
                    name: 'DynamicSkyEnvAtlas',
                    colorBuffer: this._envAtlas,
                    depth: false
                });
            }
        } else if (this._atlasLatest) {

            // the atlas of the scene may show a blend in progress, so it is generated again
            this._destroyInterpolationTargets();
            this._bakeRequested = true;
        }
    }

    /**
     * Creates an environment atlas, in the format and the layout the engine generates it in.
     *
     * @param {string} name - The name of the texture.
     * @param {number} size - The size of the atlas.
     * @returns {Texture} The atlas.
     * @private
     */
    _createAtlas(name, size) {
        return new Texture(this.device, {
            name,
            width: size,
            height: size,
            format: PIXELFORMAT_RGBA8,
            type: TEXTURETYPE_RGBP,
            projection: TEXTUREPROJECTION_EQUIRECT,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false
        });
    }

    /** @private */
    _destroyInterpolationTargets() {
        this._envAtlasTarget?.destroy();
        this._envAtlasTarget = null;
        this._atlasLatest?.destroy();
        this._atlasLatest = null;
        this._atlasPrevious?.destroy();
        this._atlasPrevious = null;
        this._blendWeight = 1;
    }

    /** @private */
    _destroyLightingSource() {
        this._faceTargets.forEach(target => target.destroy());
        this._faceTargets.length = 0;
        this._lightingSource?.destroy();
        this._lightingSource = null;
    }

    /**
     * Returns the shader rendering the sky for the lighting, for the clouds and the encoding of
     * the lighting source.
     *
     * @returns {Shader} The shader.
     * @private
     */
    _getBakeShader() {
        const type = this.cloudType;
        const encodeFunc = ChunkUtils.encodeFunc(this._lightingSource.encoding);
        const key = `${type}-${encodeFunc}`;
        let shader = this._bakeShaders.get(key);
        if (!shader) {
            const defines = new Map();
            if (type === CLOUDTYPE_FLAT) defines.set('DYNSKY_CLOUDS_FLAT', '');
            if (type === CLOUDTYPE_VOLUMETRIC) defines.set('DYNSKY_CLOUDS_VOLUMETRIC', '');
            defines.set('{DYNSKY_ENCODE_FUNC}', encodeFunc);
            shader = ShaderUtils.createShader(this.device, {
                uniqueName: `DynamicSkyBake-${key}`,
                attributes: { vertex_position: SEMANTIC_POSITION },
                vertexChunk: 'reprojectVS',
                fragmentChunk: 'dynamicSkyBakePS',
                fragmentDefines: defines
            });
            this._bakeShaders.set(key, shader);
        }
        return shader;
    }

    /**
     * Returns the shader blending the lighting, created on its first use.
     *
     * @returns {Shader} The shader.
     * @private
     */
    _getBlendShader() {
        this._blendShader ??= ShaderUtils.createShader(this.device, {
            uniqueName: 'DynamicSkyLightingBlend',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'dynamicSkyLightingBlendPS'
        });
        return this._blendShader;
    }

    /**
     * Generates the lighting on the frames it is due, and blends it while it is interpolated.
     * Called by the pass generating the lighting.
     *
     * @ignore
     */
    _updateLighting() {
        if (this._bakePending) {
            this._bakeLighting();
        }

        // the blend advances with the time of the frame - with the time paused, there is no
        // gradual change of the sky to follow, so it is done at once
        if (this._blendWeight < 1) {
            const step = this._frameDt > 0 ? this._frameDt / this._blendDuration : 1;
            this._blendWeight = Math.min(1, this._blendWeight + step);
            this._blendLighting();
        }
    }

    /**
     * Writes the blend of the lighting from its previous update to its latest one to the
     * environment atlas of the scene.
     *
     * @private
     */
    _blendLighting() {
        const { device } = this;
        device.setBlendState(BlendState.NOBLEND);
        device.scope.resolve('dynSkyBlendPrevious').setValue(this._atlasPrevious);
        device.scope.resolve('dynSkyBlendLatest').setValue(this._atlasLatest);
        device.scope.resolve('dynSkyBlendWeight').setValue(this._blendWeight);
        drawQuadWithShader(device, this._envAtlasTarget, this._getBlendShader());
    }

    /**
     * Generates the lighting of the scene from the sky: renders the sky to the faces of a cubemap,
     * and prefilters it to the environment atlas. Called by the pass generating the lighting.
     *
     * @ignore
     */
    _bakeLighting() {
        const { device } = this;
        this._createLightingTargets();

        // interpolated, a gradual change of the sky blends in over the time since the previous
        // update - the time the next one is due in, if the sky keeps changing at its rate. The blend
        // continues from the lighting shown, so a blend still in progress carries on smoothly
        const interpolated = this.lightingInterpolation;
        const blend = interpolated && !this._bakeRequested && !this._bakeJump && this._timeSinceBake > 0;
        if (blend) {
            this._atlasPrevious.copy(this._envAtlas, { sourceRenderTarget: this._envAtlasTarget });
        }
        const atlas = interpolated ? this._atlasLatest : this._envAtlas;

        // the sky, to the faces of the cubemap, as the engine's reprojection renders them
        this._bindSkyUniforms();
        device.setBlendState(BlendState.NOBLEND);
        device.scope.resolve('uvMod').setValue(UV_MOD);
        const faceId = device.scope.resolve('dynSkyFace');
        const shader = this._getBakeShader();
        for (let face = 0; face < 6; face++) {
            faceId.setValue(face);
            drawQuadWithShader(device, this._faceTargets[face], shader);
        }

        EnvLighting.generateAtlas(this._lightingSource, {
            target: atlas,
            size: atlas.width,
            numReflectionSamples: LIGHTING_REFLECTION_SAMPLES,
            numAmbientSamples: LIGHTING_AMBIENT_SAMPLES
        });

        // the blend starts, or the latest lighting applies at once
        if (blend) {
            this._blendWeight = 0;
            this._blendDuration = Math.min(this._timeSinceBake, LIGHTING_BLEND_MAX_TIME);
        } else if (interpolated) {
            this._envAtlas.copy(this._atlasLatest);
            this._blendWeight = 1;
        }

        // what the lighting was generated for, and when
        this._timeSinceBake = 0;
        this._bakeRequested = false;
        this._bakeDue = false;
        this._driftSinceBake = 0;
        this._bakedSkyDir.copy(this._skyDir);
        this._bakedMoonDir.copy(this._moonWorldDir);
        this._bakedSettings.set(this._settings);
    }
}

export { DynamicSkyEffect };
