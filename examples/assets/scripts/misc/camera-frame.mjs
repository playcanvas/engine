import {
    Script,
    Color,
    math,
    RenderingParams,
    CameraFrameOptions,
    RenderPassCameraFrame,
    FOG_NONE,
    SSAOTYPE_NONE
} from 'playcanvas';

/** @enum {string} */
const FogType = {
    NONE: 'none',      // FOG_NONE
    LINEAR: 'linear',  // FOG_LINEAR
    EXP: 'exp',        // FOG_EXP
    EXP2: 'exp2'       // FOG_EXP2
};

/** @enum {number} */
const ToneMapping = {
    LINEAR: 0,  // TONEMAP_LINEAR
    FILMIC: 1,  // TONEMAP_FILMIC
    HEJL: 2,    // TONEMAP_HEJL
    ACES: 3,    // TONEMAP_ACES
    ACES2: 4,   // TONEMAP_ACES2
    NEUTRAL: 5  // TONEMAP_NEUTRAL
};

/** @enum {string} */
const SsaoType = {
    NONE: 'none',           // SSAOTYPE_NONE
    LIGHTING: 'lighting',   // SSAOTYPE_LIGHTING
    COMBINE: 'combine'      // SSAOTYPE_COMBINE
};

/** @enum {number} */
const RenderFormat = {
    RGBA8: 7,       // PIXELFORMAT_RGBA8
    RG11B10: 18,    // PIXELFORMAT_111110F
    RGBA16: 12,     // PIXELFORMAT_RGBA16F
    RGBA32: 14      // PIXELFORMAT_RGBA32F
};

/** @interface */
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
     * @type {FogType}
     */
    fog = FogType.NONE;

    /**
     * @attribute
     */
    fogColor = new Color(1, 1, 1, 1);

    /**
     * @attribute
     */
    fogStart = 0;

    /**
     * @attribute
     */
    fogEnd = 100;

    /**
     * @attribute
     */
    fogDensity = 0.01;
}

/** @interface */
class Ssao {
    /**
     * @attribute
     * @type {SsaoType}
     */
    type = SsaoType.NONE;

    blurEnabled = true;

    /**
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    intensity = 0.5;

    /**
     * @range [0, 100]
     * @precision 3
     * @step 0.001
     */
    radius = 30;

    /**
     * @range [1, 64]
     * @precision 0
     * @step 1
     */
    samples = 12;

    /**
     * @range [0.1, 10]
     * @precision 3
     * @step 0.001
     */
    power = 6;

    /**
     * @range [1, 90]
     * @precision 1
     * @step 1
     */
    minAngle = 10;

    /**
     * @range [0.5, 1]
     * @precision 3
     * @step 0.001
     */
    scale = 1;
}

/** @interface */
class Bloom {
    enabled = false;

    /**
     * @range [0, 0.1]
     * @precision 3
     * @step 0.001
     */
    intensity = 0.01;

    /**
     * @attribute
     * @range [0, 12]
     * @precision 0
     * @step 0
     */
    lastMipLevel = 1;
}

/** @interface */
class Grading {
    enabled = false;

    /**
     * @range [0, 3]
     * @precision 3
     * @step 0.001
     */
    brightness = 1;

    /**
     * @range [0.5, 1.5]
     * @precision 3
     * @step 0.001
     */
    contrast = 1;

    /**
     * @range [0, 2]
     * @precision 3
     * @step 0.001
     */
    saturation = 1;

    /**
     * @attribute
     */
    tint = new Color(1, 1, 1, 1);
}

/** @interface */
class Vignette {
    enabled = false;

    /**
     * @range [0, 1]
     * @precision 3
     * @step 0.001
     */
    intensity = 0.5;

    /**
     * @range [0, 3]
     * @precision 3
     * @step 0.001
     */
    inner = 0.5;

    /**
     * @range [0, 3]
     * @precision 3
     * @step 0.001
     */
    outer = 1;

    /**
     * @range [0.01, 10]
     * @precision 3
     * @step 0.001
     */
    curvature = 0.5;
}

/** @interface */
class Fringing {
    enabled = false;

    /**
     * @range [0, 100]
     * @precision 1
     * @step 0.1
     */
    intensity = 50;
}

/** @interface */
class Taa {
    enabled = false;

    /**
     * @range [0, 1]
     * @precision 2
     * @step 0.1
     */
    jitter = 1;
}

class CameraFrame extends Script {
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

    options = new CameraFrameOptions();

    renderingParams = new RenderingParams();

    initialize() {

        this.updateOptions();
        this.createRenderPass();

        this.on('enable', () => {
            this.createRenderPass();
        });

        this.on('disable', () => {
            this.destroyRenderPass();
        });

        this.on('destroy', () => {
            this.destroyRenderPass();
        });
    }

    createRenderPass() {
        const cameraComponent = this.entity.camera;
        cameraComponent.rendering = this.renderingParams;

        this.renderPassCamera = new RenderPassCameraFrame(this.app, cameraComponent, this.options);
        cameraComponent.renderPasses = [this.renderPassCamera];
    }

    destroyRenderPass() {
        const cameraComponent = this.entity.camera;
        cameraComponent.renderPasses?.forEach((renderPass) => {
            renderPass.destroy();
        });
        cameraComponent.renderPasses = [];
        cameraComponent.rendering = null;

        cameraComponent.jitter = 0;
    }

    updateOptions() {

        const { options, rendering, bloom, taa, ssao } = this;
        options.stencil = rendering.stencil;
        options.samples = rendering.samples;
        options.sceneColorMap = rendering.sceneColorMap;
        options.prepassEnabled = rendering.sceneDepthMap;
        options.bloomEnabled = bloom.enabled;
        options.taaEnabled = taa.enabled;
        options.ssaoType = ssao.type;
        options.ssaoBlurEnabled = ssao.blurEnabled;
        options.formats = [rendering.renderFormat, rendering.renderFormatFallback0, rendering.renderFormatFallback1];
    }

    postUpdate(dt) {

        const cameraComponent = this.entity.camera;
        const { options, renderPassCamera, renderingParams, rendering, bloom, grading, vignette, fringing, taa, ssao } = this;

        // options that can cause the passes to be re-created
        this.updateOptions();
        renderPassCamera.update(options);

        // renderingParams
        renderingParams.fog = rendering.fog;
        if (renderingParams.fog !== FOG_NONE) {
            renderingParams.fogColor.copy(rendering.fogColor);
            renderingParams.fogStart = rendering.fogStart;
            renderingParams.fogEnd = rendering.fogEnd;
            renderingParams.fogDensity = rendering.fogDensity;
        }

        // update parameters of individual render passes
        const { composePass, bloomPass, ssaoPass } = renderPassCamera;

        renderPassCamera.renderTargetScale = math.clamp(rendering.renderTargetScale, 0.1, 1);
        composePass.toneMapping = rendering.toneMapping;
        composePass.sharpness = rendering.sharpness;

        if (options.bloomEnabled && bloomPass) {
            composePass.bloomIntensity = bloom.intensity;
            bloomPass.lastMipLevel = bloom.lastMipLevel;
        }

        if (options.ssaoType !== SSAOTYPE_NONE) {
            ssaoPass.intensity = ssao.intensity;
            ssaoPass.power = ssao.power;
            ssaoPass.radius = ssao.radius;
            ssaoPass.sampleCount = ssao.samples;
            ssaoPass.minAngle = ssao.minAngle;
            ssaoPass.scale = ssao.scale;
        }

        composePass.gradingEnabled = grading.enabled;
        if (grading.enabled) {
            composePass.gradingSaturation = grading.saturation;
            composePass.gradingBrightness = grading.brightness;
            composePass.gradingContrast = grading.contrast;
            composePass.gradingTint = grading.tint;
        }

        composePass.vignetteEnabled = vignette.enabled;
        if (vignette.enabled) {
            composePass.vignetteInner = vignette.inner;
            composePass.vignetteOuter = vignette.outer;
            composePass.vignetteCurvature = vignette.curvature;
            composePass.vignetteIntensity = vignette.intensity;
        }

        composePass.fringingEnabled = fringing.enabled;
        if (fringing.enabled) {
            composePass.fringingIntensity = fringing.intensity;
        }

        // enable camera jitter if taa is enabled
        cameraComponent.jitter = taa.enabled ? taa.jitter : 0;
    }
}

export { CameraFrame };
