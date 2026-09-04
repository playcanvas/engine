// Camera Frame v 1.3

import {
    CameraFrame as EngineCameraFrame, Script, Color,
    TONEMAP_LINEAR, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_NEUTRAL,
    PIXELFORMAT_RGBA8, PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F
} from 'playcanvas';

/**
 * @import { Asset, Entity } from 'playcanvas';
 */

/** @enum {string} */
const ToneMapping = {
    LINEAR: 'linear',
    FILMIC: 'filmic',
    HEJL: 'hejl',
    ACES: 'aces',
    ACES2: 'aces2',
    NEUTRAL: 'neutral'
};

/** @enum {string} */
const SsaoType = {
    NONE: 'none',           // SSAOTYPE_NONE
    LIGHTING: 'lighting',   // SSAOTYPE_LIGHTING
    COMBINE: 'combine'      // SSAOTYPE_COMBINE
};

/** @enum {string} */
const RenderFormat = {
    RGBA8: 'rgba8',
    RG11B10: 'rg11b10',
    RGBA16: 'rgba16',
    RGBA32: 'rgba32'
};

const toneMappingMap = new Map([
    [ToneMapping.LINEAR, TONEMAP_LINEAR],
    [ToneMapping.FILMIC, TONEMAP_FILMIC],
    [ToneMapping.HEJL, TONEMAP_HEJL],
    [ToneMapping.ACES, TONEMAP_ACES],
    [ToneMapping.ACES2, TONEMAP_ACES2],
    [ToneMapping.NEUTRAL, TONEMAP_NEUTRAL]
]);

const renderFormatMap = new Map([
    [RenderFormat.RGBA8, PIXELFORMAT_RGBA8],
    [RenderFormat.RG11B10, PIXELFORMAT_111110F],
    [RenderFormat.RGBA16, PIXELFORMAT_RGBA16F],
    [RenderFormat.RGBA32, PIXELFORMAT_RGBA32F]
]);

/**
 * Resolves a {@link ToneMapping} string to the engine's tone mapping constant. Numeric values
 * are passed through unchanged for backward compatibility with attribute data that stored the
 * engine constants directly.
 *
 * @param {ToneMapping|number} value - The tone mapping.
 * @returns {number} The engine tone mapping constant.
 */
const resolveToneMapping = (value) => {
    return typeof value === 'number' ? value : (toneMappingMap.get(value) ?? TONEMAP_LINEAR);
};

/**
 * Resolves a {@link RenderFormat} string to the engine's pixel format constant. Numeric values
 * are passed through unchanged for backward compatibility with attribute data that stored the
 * engine constants directly.
 *
 * @param {RenderFormat|number} value - The render format.
 * @returns {number} The engine pixel format constant.
 */
const resolveRenderFormat = (value) => {
    return typeof value === 'number' ? value : (renderFormatMap.get(value) ?? PIXELFORMAT_111110F);
};

/** @enum {string} */
const DebugType = {
    NONE: 'none',
    SCENE: 'scene',
    SSAO: 'ssao',
    BLOOM: 'bloom',
    VIGNETTE: 'vignette',
    DOFCOC: 'dofcoc',
    DOFBLUR: 'dofblur',
    DEPTH: 'depth'
};

/**
 * @interface
 * @category Post-Processing
 */
class Rendering {
    /**
     * @attribute
     * @type {RenderFormat}
     */
    renderFormat = RenderFormat.RG11B10;

    /**
     * @attribute
     * @type {RenderFormat}
     */
    renderFormatFallback0 = RenderFormat.RGBA16;

    /**
     * @attribute
     * @type {RenderFormat}
     */
    renderFormatFallback1 = RenderFormat.RGBA32;

    stencil = false;

    /**
     * @attribute
     * @range [0.1, 1]
     * @precision 2
     * @step 0.01
     */
    renderTargetScale = 1.0;

    /**
     * @attribute
     * @range [1, 4]
     * @precision 0
     * @step 1
     */
    samples = 1;

    sceneColorMap = false;

    sceneDepthMap = false;

    /**
     * @attribute
     * @type {ToneMapping}
     */
    toneMapping = ToneMapping.LINEAR;

    /**
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    sharpness = 0.0;

    /**
     * @attribute
     * @type {DebugType}
     */
    debug = DebugType.NONE;
}

/**
 * @interface
 * @category Post-Processing
 */
class Ssao {
    /**
     * @attribute
     * @type {SsaoType}
     */
    type = SsaoType.NONE;

    /**
     * @visibleif {type !== 'none'}
     */
    blurEnabled = true;

    /**
     * Whether the sampling is randomized. Useful instead of the blur when TAA is enabled, which
     * resolves the noise over time and keeps more of the detail.
     *
     * @visibleif {type !== 'none'}
     */
    randomize = false;

    /**
     * @range [0, 1]
     * @visibleif {type !== 'none'}
     * @precision 3
     * @step 0.001
     */
    intensity = 0.5;

    /**
     * @range [0, 100]
     * @visibleif {type !== 'none'}
     * @precision 3
     * @step 0.001
     */
    radius = 30;

    /**
     * @range [1, 64]
     * @visibleif {type !== 'none'}
     * @precision 0
     * @step 1
     */
    samples = 12;

    /**
     * @range [0.1, 10]
     * @visibleif {type !== 'none'}
     * @precision 3
     * @step 0.001
     */
    power = 6;

    /**
     * @range [1, 90]
     * @visibleif {type !== 'none'}
     * @precision 1
     * @step 1
     */
    minAngle = 10;

    /**
     * @range [0.5, 1]
     * @visibleif {type !== 'none'}
     * @precision 3
     * @step 0.001
     */
    scale = 1;
}

/**
 * @interface
 * @category Post-Processing
 */
class Bloom {
    enabled = false;

    /**
     * @visibleif {enabled}
     * @range [0, 0.1]
     * @precision 3
     * @step 0.001
     */
    intensity = 0.01;

    /**
     * @attribute
     * @visibleif {enabled}
     * @range [1, 16]
     * @precision 0
     * @step 0
     */
    blurLevel = 16;
}

/**
 * @interface
 * @category Post-Processing
 */
class Grading {
    enabled = false;

    /**
     * @visibleif {enabled}
     * @range [0, 3]
     * @precision 3
     * @step 0.001
     */
    brightness = 1;

    /**
     * @visibleif {enabled}
     * @range [0.5, 1.5]
     * @precision 3
     * @step 0.001
     */
    contrast = 1;

    /**
     * @visibleif {enabled}
     * @range [0, 2]
     * @precision 3
     * @step 0.001
     */
    saturation = 1;

    /**
     * @attribute
     * @visibleif {enabled}
     */
    tint = new Color(1, 1, 1, 1);
}

/**
 * @interface
 * @category Post-Processing
 */
class ColorLUT {
    /**
     * @attribute
     * @type {Asset}
     * @resource texture
     */
    texture = null;

    /**
     * @visibleif {texture}
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    intensity = 1;

    /**
     * Optional secondary LUT texture. When set, both LUTs are sampled and the two graded
     * results are crossfaded according to the blend factor.
     *
     * @attribute
     * @type {Asset}
     * @resource texture
     */
    texture2 = null;

    /**
     * @visibleif {texture2}
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    intensity2 = 1;

    /**
     * Crossfade between the two graded results. 0 shows only the primary LUT, 1 shows only the
     * secondary LUT, intermediate values produce a linear-space mix.
     *
     * @visibleif {texture2}
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    blend = 0;
}

/**
 * @interface
 * @category Post-Processing
 */
class Vignette {
    enabled = false;

    /**
     * @visibleif {enabled}
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    intensity = 0.5;

    /**
     * @visibleif {enabled}
     * @range [0, 3]
     * @precision 3
     * @step 0.001
     */
    inner = 0.5;

    /**
     * @visibleif {enabled}
     * @range [0, 3]
     * @precision 3
     * @step 0.001
     */
    outer = 1;

    /**
     * @visibleif {enabled}
     * @range [0.01, 10]
     * @precision 3
     * @step 0.001
     */
    curvature = 0.5;

    /**
     * @attribute
     * @visibleif {enabled}
     */
    color = new Color(0, 0, 0, 1);
}

/**
 * @interface
 * @category Post-Processing
 */
class Fringing {
    enabled = false;

    /**
     * @visibleif {enabled}
     * @range [0, 100]
     * @precision 1
     * @step 0.1
     */
    intensity = 50;
}

/**
 * @interface
 * @category Post-Processing
 */
class ColorEnhance {
    enabled = false;

    /**
     * @visibleif {enabled}
     * @range [-3, 3]
     * @precision 2
     * @step 0.1
     */
    shadows = 0;

    /**
     * @visibleif {enabled}
     * @range [-3, 3]
     * @precision 2
     * @step 0.1
     */
    highlights = 0;

    /**
     * @visibleif {enabled}
     * @range [-1, 1]
     * @precision 3
     * @step 0.01
     */
    midtones = 0;

    /**
     * @visibleif {enabled}
     * @range [-1, 1]
     * @precision 3
     * @step 0.01
     */
    vibrance = 0;

    /**
     * @visibleif {enabled}
     * @range [-1, 1]
     * @precision 3
     * @step 0.01
     */
    dehaze = 0;
}

/**
 * @interface
 * @category Post-Processing
 */
class Taa {
    enabled = false;

    /**
     * @visibleif {enabled}
     * @range [0, 1]
     * @precision 2
     * @step 0.1
     */
    jitter = 1;
}

/**
 * @interface
 * @category Post-Processing
 */
class Dof {
    enabled = false;

    /**
     * @visibleif {enabled}
     */
    highQuality = true;

    /**
     * @visibleif {enabled}
     */
    nearBlur = false;

    /**
     * @visibleif {enabled}
     * @precision 2
     * @step 1
     */
    focusDistance = 100;

    /**
     * @visibleif {enabled}
     * @precision 2
     * @step 1
     */
    focusRange = 10;

    /**
     * @visibleif {enabled}
     * @precision 2
     * @step 0.1
     */
    blurRadius = 3;

    /**
     * @visibleif {enabled}
     * @range [1, 10]
     * @precision 0
     * @step 1
     */
    blurRings = 4;

    /**
     * @visibleif {enabled}
     * @range [1, 10]
     * @precision 0
     * @step 1
     */
    blurRingPoints = 5;
}

/**
 * @interface
 * @category Post-Processing
 */
class VolumetricFog {
    enabled = false;

    /**
     * The entity with the directional light providing the scattered light. Leave it unset to light
     * the fog by the local lights and the ambient term alone.
     *
     * @attribute
     * @visibleif {enabled}
     * @type {Entity}
     */
    light = null;

    /**
     * Whether the omni lights scatter light in the fog. Requires clustered lighting, which is
     * enabled by default. An omni light fills its whole range, so it typically covers much more of
     * the screen than a spot light and costs more.
     *
     * @visibleif {enabled}
     */
    localOmniLights = false;

    /**
     * Whether the spot lights scatter light in the fog, forming visible beams. Requires clustered
     * lighting, which is enabled by default.
     *
     * @visibleif {enabled}
     */
    localSpotLights = false;

    /**
     * The intensity of the light scattering of the omni and the spot lights. A narrow beam crosses
     * only a short part of each view ray, and so typically needs a much larger value than the
     * directional light's intensity below.
     *
     * @visibleif {enabled && (localOmniLights || localSpotLights)}
     * @range [0, 100]
     * @precision 2
     * @step 0.1
     */
    localIntensity = 1;

    /**
     * The number of raymarching steps taken inside the volume of each omni and spot light.
     *
     * @visibleif {enabled && (localOmniLights || localSpotLights)}
     * @range [2, 64]
     * @precision 0
     * @step 1
     */
    localSteps = 12;

    /**
     * @attribute
     * @visibleif {enabled}
     */
    tint = new Color(1, 1, 1, 1);

    /**
     * @visibleif {enabled}
     * @range [0, 0.2]
     * @precision 4
     * @step 0.001
     */
    density = 0.01;

    /**
     * @visibleif {enabled}
     * @precision 2
     * @step 1
     */
    heightBase = 0;

    /**
     * @visibleif {enabled}
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    heightFalloff = 0.05;

    /**
     * How quickly the fog absorbs the light passing through it, without affecting how much light it
     * scatters. A value of 1 is physically consistent, where distant fog and light shafts fade out
     * exponentially with the density. Lower it to keep them visible further away while the fog
     * itself stays as bright.
     *
     * @visibleif {enabled}
     * @range [0, 2]
     * @precision 2
     * @step 0.05
     */
    extinction = 1;

    /**
     * @visibleif {enabled}
     * @range [0, 0.95]
     * @precision 3
     * @step 0.001
     */
    anisotropy = 0.6;

    /**
     * @visibleif {enabled}
     * @range [0, 10]
     * @precision 3
     * @step 0.01
     */
    intensity = 1;

    /**
     * @attribute
     * @visibleif {enabled}
     */
    ambientColor = new Color(1, 1, 1, 1);

    /**
     * @visibleif {enabled}
     * @range [0, 1]
     * @precision 4
     * @step 0.001
     */
    ambientIntensity = 0.02;

    /**
     * @visibleif {enabled}
     * @precision 2
     * @step 1
     */
    maxDistance = 300;

    /**
     * @visibleif {enabled}
     * @range [4, 128]
     * @precision 0
     * @step 1
     */
    steps = 24;

    /**
     * @visibleif {enabled}
     * @range [0.25, 1]
     * @precision 2
     * @step 0.05
     */
    scale = 0.5;
}

/**
 * Enables the engine's {@link EngineCameraFrame | CameraFrame} render pipeline on a camera
 * entity, exposing its settings as grouped script attributes: rendering (render format, tone
 * mapping, sharpness, TAA), SSAO, bloom, color grading, color LUT, vignette, fringing, depth
 * of field and volumetric fog.
 *
 * Attach the script to an entity with a camera component and adjust the attribute groups to
 * configure the post-processing stack. Most groups are gated by their own `enabled` flag, which
 * defaults to false. Three are not: `rendering` is always applied, `ssao` is gated by its `type`
 * (`SsaoType.NONE` by default) and `colorLUT` by its `texture` (null by default) — setting
 * `enabled` on those two does nothing.
 *
 * Set the fields on the groups after creating the script. Do not pass a group through the
 * `properties` argument of {@link ScriptComponent#create}: that assignment is shallow, so it
 * replaces the whole group object and drops its `enabled` flag, leaving the effect switched off.
 *
 * @example
 * cameraEntity.addComponent('script');
 * const cameraFrame = cameraEntity.script.create(CameraFrame);
 * cameraFrame.rendering.toneMapping = 'aces';
 * cameraFrame.bloom.enabled = true;
 * cameraFrame.bloom.intensity = 0.02;
 * @category Post-Processing
 */
class CameraFrame extends Script {
    static scriptName = 'cameraFrame';

    /**
     * @attribute
     * @type {Rendering}
     */
    rendering = new Rendering();

    /**
     * @attribute
     * @type {Ssao}
     */
    ssao = new Ssao();

    /**
     * @attribute
     * @type {Bloom}
     */
    bloom = new Bloom();

    /**
     * @attribute
     * @type {Grading}
     */
    grading = new Grading();

    /**
     * @attribute
     * @type {ColorLUT}
     */
    colorLUT = new ColorLUT();

    /**
     * @attribute
     * @type {Vignette}
     */
    vignette = new Vignette();

    /**
     * @attribute
     * @type {Taa}
     */
    taa = new Taa();

    /**
     * @attribute
     * @type {Fringing}
     */
    fringing = new Fringing();

    /**
     * @attribute
     * @type {ColorEnhance}
     */
    colorEnhance = new ColorEnhance();

    /**
     * @attribute
     * @type {Dof}
     */
    dof = new Dof();

    /**
     * @attribute
     * @type {VolumetricFog}
     */
    volumetricFog = new VolumetricFog();

    engineCameraFrame;

    initialize() {

        this.engineCameraFrame = new EngineCameraFrame(this.app, this.entity.camera);

        this.on('enable', () => {
            this.engineCameraFrame.enabled = true;
        });

        this.on('disable', () => {
            this.engineCameraFrame.enabled = false;
        });

        this.on('destroy', () => {
            this.engineCameraFrame.destroy();
        });

        this.on('state', (enabled) => {
            this.engineCameraFrame.enabled = enabled;
        });
    }

    postUpdate(dt) {

        const cf = this.engineCameraFrame;
        const { rendering, bloom, grading, colorEnhance, vignette, fringing, taa, ssao, dof, colorLUT, volumetricFog } = this;

        const dstRendering = cf.rendering;
        dstRendering.renderFormats.length = 0;
        dstRendering.renderFormats.push(resolveRenderFormat(rendering.renderFormat));
        dstRendering.renderFormats.push(resolveRenderFormat(rendering.renderFormatFallback0));
        dstRendering.renderFormats.push(resolveRenderFormat(rendering.renderFormatFallback1));
        dstRendering.stencil = rendering.stencil;
        dstRendering.renderTargetScale = rendering.renderTargetScale;
        dstRendering.samples = rendering.samples;
        dstRendering.sceneColorMap = rendering.sceneColorMap;
        dstRendering.sceneDepthMap = rendering.sceneDepthMap;
        dstRendering.toneMapping = resolveToneMapping(rendering.toneMapping);
        dstRendering.sharpness = rendering.sharpness;

        // ssao
        const dstSsao = cf.ssao;
        dstSsao.type = ssao.type;
        if (ssao.type !== SsaoType.NONE) {
            dstSsao.blurEnabled = ssao.blurEnabled;
            dstSsao.randomize = ssao.randomize;
            dstSsao.intensity = ssao.intensity;
            dstSsao.radius = ssao.radius;
            dstSsao.samples = ssao.samples;
            dstSsao.power = ssao.power;
            dstSsao.minAngle = ssao.minAngle;
            dstSsao.scale = ssao.scale;
        }

        // bloom
        const dstBloom = cf.bloom;
        dstBloom.intensity = bloom.enabled ? bloom.intensity : 0;
        if (bloom.enabled) {
            dstBloom.blurLevel = bloom.blurLevel;
        }

        // grading
        const dstGrading = cf.grading;
        dstGrading.enabled = grading.enabled;
        if (grading.enabled) {
            dstGrading.brightness = grading.brightness;
            dstGrading.contrast = grading.contrast;
            dstGrading.saturation = grading.saturation;
            dstGrading.tint.copy(grading.tint);
        }

        // colorLUT
        const dstColorLUT = cf.colorLUT;
        if (colorLUT.texture?.resource) {
            dstColorLUT.texture = colorLUT.texture.resource;
            dstColorLUT.intensity = colorLUT.intensity;
        } else {
            dstColorLUT.texture = null;
        }
        if (colorLUT.texture2?.resource) {
            dstColorLUT.texture2 = colorLUT.texture2.resource;
            dstColorLUT.intensity2 = colorLUT.intensity2;
            dstColorLUT.blend = colorLUT.blend;
        } else {
            dstColorLUT.texture2 = null;
        }

        // vignette
        const dstVignette = cf.vignette;
        dstVignette.intensity = vignette.enabled ? vignette.intensity : 0;
        if (vignette.enabled) {
            dstVignette.inner = vignette.inner;
            dstVignette.outer = vignette.outer;
            dstVignette.curvature = vignette.curvature;
            dstVignette.color.copy(vignette.color);
        }

        // taa
        const dstTaa = cf.taa;
        dstTaa.enabled = taa.enabled;
        if (taa.enabled) {
            dstTaa.jitter = taa.jitter;
        }

        // fringing
        const dstFringing = cf.fringing;
        dstFringing.intensity = fringing.enabled ? fringing.intensity : 0;

        // colorEnhance
        const dstColorEnhance = cf.colorEnhance;
        dstColorEnhance.enabled = colorEnhance.enabled;
        if (colorEnhance.enabled) {
            dstColorEnhance.shadows = colorEnhance.shadows;
            dstColorEnhance.highlights = colorEnhance.highlights;
            dstColorEnhance.midtones = colorEnhance.midtones;
            dstColorEnhance.vibrance = colorEnhance.vibrance;
            dstColorEnhance.dehaze = colorEnhance.dehaze;
        }

        // dof
        const dstDof = cf.dof;
        dstDof.enabled = dof.enabled;
        if (dof.enabled) {
            dstDof.highQuality = dof.highQuality;
            dstDof.nearBlur = dof.nearBlur;
            dstDof.focusDistance = dof.focusDistance;
            dstDof.focusRange = dof.focusRange;
            dstDof.blurRadius = dof.blurRadius;
            dstDof.blurRings = dof.blurRings;
            dstDof.blurRingPoints = dof.blurRingPoints;
        }

        // volumetricFog
        const dstVolumetricFog = cf.volumetricFog;
        dstVolumetricFog.enabled = volumetricFog.enabled;
        if (volumetricFog.enabled) {
            dstVolumetricFog.light = volumetricFog.light?.light ?? null;
            dstVolumetricFog.localOmniLights = volumetricFog.localOmniLights;
            dstVolumetricFog.localSpotLights = volumetricFog.localSpotLights;
            dstVolumetricFog.localIntensity = volumetricFog.localIntensity;
            dstVolumetricFog.localSteps = volumetricFog.localSteps;
            dstVolumetricFog.tint.copy(volumetricFog.tint);
            dstVolumetricFog.density = volumetricFog.density;
            dstVolumetricFog.heightBase = volumetricFog.heightBase;
            dstVolumetricFog.heightFalloff = volumetricFog.heightFalloff;
            dstVolumetricFog.extinction = volumetricFog.extinction;
            dstVolumetricFog.anisotropy = volumetricFog.anisotropy;
            dstVolumetricFog.intensity = volumetricFog.intensity;
            dstVolumetricFog.ambientColor.copy(volumetricFog.ambientColor);
            dstVolumetricFog.ambientIntensity = volumetricFog.ambientIntensity;
            dstVolumetricFog.maxDistance = volumetricFog.maxDistance;
            dstVolumetricFog.steps = volumetricFog.steps;
            dstVolumetricFog.scale = volumetricFog.scale;
        }

        // debugging
        cf.debug = rendering.debug;

        cf.update();
    }
}

export { CameraFrame, Rendering, Ssao, Bloom, Grading, ColorLUT, Vignette, Fringing, ColorEnhance, Taa, Dof, VolumetricFog };
