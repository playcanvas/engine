/* eslint-disable-next-line import/no-unresolved */
import { CameraFrame as EngineCameraFrame, Script, Color } from 'playcanvas';

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

/** @enum {string} */
const DebugType = {
    NONE: '',
    SCENE: 'scene',
    SSAO: 'ssao',
    BLOOM: 'bloom',
    VIGNETTE: 'vignette'
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
     * @type {DebugType}
     */
    debug = DebugType.NONE;
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
     * @range [0, 16]
     * @precision 0
     * @step 0
     */
    blurLevel = 16;
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

    engineCameraFrame = new EngineCameraFrame(this.app, this.entity.camera);

    initialize() {

        this.on('enable', () => {
            this.engineCameraFrame.enabled = true;
        });

        this.on('disable', () => {
            this.engineCameraFrame.enabled = false;
        });

        this.on('destroy', () => {
            this.engineCameraFrame.destroy();
        });
    }

    postUpdate(dt) {

        const cf = this.engineCameraFrame;
        const { rendering, bloom, grading, vignette, fringing, taa, ssao } = this;

        const dstRendering = cf.rendering;
        dstRendering.renderFormats.length = 0;
        dstRendering.renderFormats.push(rendering.renderFormat);
        dstRendering.renderFormats.push(rendering.renderFormatFallback0);
        dstRendering.renderFormats.push(rendering.renderFormatFallback1);
        dstRendering.stencil = rendering.stencil;
        dstRendering.renderTargetScale = rendering.renderTargetScale;
        dstRendering.samples = rendering.samples;
        dstRendering.sceneColorMap = rendering.sceneColorMap;
        dstRendering.sceneDepthMap = rendering.sceneDepthMap;
        dstRendering.toneMapping = rendering.toneMapping;
        dstRendering.sharpness = rendering.sharpness;

        // ssao
        const dstSsao = cf.ssao;
        dstSsao.type = ssao.type;
        if (ssao.type !== SsaoType.NONE) {
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

        // vignette
        const dstVignette = cf.vignette;
        dstVignette.intensity = vignette.enabled ? vignette.intensity : 0;
        if (vignette.enabled) {
            dstVignette.inner = vignette.inner;
            dstVignette.outer = vignette.outer;
            dstVignette.curvature = vignette.curvature;
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

        // debugging
        cf.debug = rendering.debug;

        cf.update();
    }
}

export { CameraFrame };
