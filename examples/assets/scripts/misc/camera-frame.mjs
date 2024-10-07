import {
    Script,
    Color,
    math,
    RenderingParams,
    CameraFrameOptions,
    RenderPassCameraFrame,
    FOG_NONE, FOG_LINEAR, FOG_EXP, FOG_EXP2,
    SSAOTYPE_NONE, SSAOTYPE_LIGHTING, SSAOTYPE_COMBINE,
    PIXELFORMAT_RGBA8, PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F
} from 'playcanvas';

/** @enum {number} */
const FogType = {
    OFF: 0,
    LINEAR: 1,
    EXP: 2,
    EXP2: 3
};

/** @enum {number} */
const ToneMapping = {
    TONEMAP_LINEAR: 0,
    TONEMAP_FILMIC: 1,
    TONEMAP_HEJL: 2,
    TONEMAP_ACES: 3,
    TONEMAP_ACES2: 4,
    TONEMAP_NEUTRAL: 5
};

/** @enum {number} */
const SsaoType = {
    NONE: 0,
    LIGHTING: 1,
    COMBINE: 2
};

/** @enum {number} */
const RenderFormat = {
    // RGBA8: PIXELFORMAT_RGBA8,
    // RG11B10: PIXELFORMAT_111110F,
    // RGBA16: PIXELFORMAT_RGBA16F,
    // RGBA32: PIXELFORMAT_RGBA32F
    RGBA8: 0,
    RG11B10: 1,
    RGBA16: 2,
    RGBA32: 3
};

/** @interface */
class Rendering {
    /**
     * @attribute
     * @type {RenderFormat}
     */
    renderFormat = 1;

    /**
     * @attribute
     * @type {RenderFormat}
     */
    renderFormatFallback0 = 2;

    /**
     * @attribute
     * @type {RenderFormat}
     */
    renderFormatFallback1 = 3;

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
    toneMapping = 0; // ToneMapping.LINEAR;

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
    fog = 0; // FogType.OFF;

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
    type = 0; // SsaoType.NONE;

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

    // remove this when the enum can be of a string type
    getFogType(value) {
        switch (value) {
            case 1: return FOG_LINEAR;
            case 2: return FOG_EXP;
            case 3: return FOG_EXP2;
        }
        return FOG_NONE;
    }

    // remove this when the enum can be of a string type
    getSsaoType(value) {
        switch (value) {
            case 1: return SSAOTYPE_LIGHTING;
            case 2: return SSAOTYPE_COMBINE;
        }
        return SSAOTYPE_NONE;
    }

    // remove this when the enum can have numerical values assigned to it
    getFormat(value) {
        switch (value) {
            case 1: return PIXELFORMAT_111110F;
            case 2: return PIXELFORMAT_RGBA16F;
            case 3: return PIXELFORMAT_RGBA32F;
        }
        return PIXELFORMAT_RGBA8;
    }

    updateOptions() {

        const { options, rendering, bloom, taa, ssao } = this;
        options.samples = rendering.samples;
        options.sceneColorMap = rendering.sceneColorMap;
        options.prepassEnabled = rendering.sceneDepthMap;
        options.bloomEnabled = bloom.enabled;
        options.taaEnabled = taa.enabled;
        options.ssaoType = this.getSsaoType(ssao.type);
        options.ssaoBlurEnabled = ssao.blurEnabled;
        options.formats = [
            this.getFormat(rendering.renderFormat),
            this.getFormat(rendering.renderFormatFallback0),
            this.getFormat(rendering.renderFormatFallback1)
        ];
    }

    postUpdate(dt) {

        const cameraComponent = this.entity.camera;
        const { options, renderPassCamera, renderingParams, rendering, bloom, grading, vignette, fringing, taa, ssao } = this;

        // options that can cause the passes to be re-created
        this.updateOptions();
        renderPassCamera.update(options);

        // renderingParams
        renderingParams.fog = this.getFogType(rendering.fog);
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
