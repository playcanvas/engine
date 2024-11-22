import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { SSAOTYPE_NONE } from './constants.js';
import { CameraFrameOptions, RenderPassCameraFrame } from './render-pass-camera-frame.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 */
/**
 * @typedef {Object} Rendering
 * @property {number[]} renderFormats - The preferred render formats of the frame buffer, in order of
 * preference. First format from this list that is supported by the hardware is used. When none of
 * the formats are supported, {@link PIXELFORMAT_RGBA8} is used, but this automatically disables
 * bloom effect, which requires HDR format. The list can contain the following formats:
 * {@link PIXELFORMAT_111110F}, {@link PIXELFORMAT_RGBA16F}, {@link PIXELFORMAT_RGBA32F} and {@link
 * PIXELFORMAT_RGBA8}. Typically the default option should be used, which prefers the faster formats,
 * but if higher dynamic range is needed, the list can be adjusted to prefer higher precision formats.
 * Defaults to [{@link PIXELFORMAT_111110F}, {@link PIXELFORMAT_RGBA16F}, {@link PIXELFORMAT_RGBA32F}].
 * @property {boolean} stencil - Whether the render buffer has a stencil buffer. Defaults to false.
 * @property {number} renderTargetScale - The scale of the render target, 0.1-1 range. This allows the
 * scene to be rendered to a lower resolution render target as an optimization. The post-processing
 * is also applied at this lower resolution. The image is then up-scaled to the full resolution and
 * any UI rendering that follows is applied at the full resolution. Defaults to 1 which represents
 * full resolution rendering.
 * @property {number} samples - The number of samples of the {@link RenderTarget} used for the scene
 * rendering, in 1-4 range. Value of 1 disables multisample anti-aliasing, other values enable
 * anti-aliasing, Typically set to 1 when TAA is used, even though both anti-aliasing options can be
 * used together at a higher cost. Defaults to 1.
 * @property {boolean} sceneColorMap - Whether rendering generates a scene color map. Defaults to false.
 * @property {boolean} sceneDepthMap - Whether rendering generates a scene depth map. Defaults to false.
 * @property {number} toneMapping - The tone mapping. Defaults to {@link ToneMapping.LINEAR}. Can be:
 *
 * - {@link TONEMAP_LINEAR}
 * - {@link TONEMAP_FILMIC}
 * - {@link TONEMAP_HEJL}
 * - {@link TONEMAP_ACES}
 * - {@link TONEMAP_ACES2}
 * - {@link TONEMAP_NEUTRAL}
 *
 * @property {number} sharpness - The sharpening intensity, 0-1 range. This can be used to increase
 * the sharpness of the rendered image. Often used to counteract the blurriness of the TAA effect,
 * but also blurriness caused by rendering to a lower resolution render target by using
 * rendering.renderTargetScale property. Defaults to 0.
 */

/**
 * @typedef {Object} Ssao
 * @property {string} type - The type of the SSAO determines how it is applied in the rendering
 * process. Defaults to {@link SSAOTYPE_NONE}. Can be:
 *
 * - {@link SSAOTYPE_NONE}
 * - {@link SSAOTYPE_LIGHTING}
 * - {@link SSAOTYPE_COMBINE}
 *
 * @property {boolean} blurEnabled - Whether the SSAO effect is blurred. Defaults to true.
 * @property {number} intensity - The intensity of the SSAO effect, 0-1 range. Defaults to 0.5.
 * @property {number} radius - The radius of the SSAO effect, 0-100 range. Defaults to 30.
 * @property {number} samples - The number of samples of the SSAO effect, 1-64 range. Defaults to 12.
 * @property {number} power - The power of the SSAO effect, 0.1-10 range. Defaults to 6.
 * @property {number} minAngle - The minimum angle of the SSAO effect, 1-90 range. Defaults to 10.
 * @property {number} scale - The scale of the SSAO effect, 0.5-1 range. Defaults to 1.
 */

/**
 * @typedef {Object} Bloom
 * @property {number} intensity - The intensity of the bloom effect, 0-0.1 range. Defaults to 0,
 * making it disabled.
 * @property {number} lastMipLevel - The last mip level of the bloom effect, 0-12 range. Defaults to 1.
 */

/**
 * @typedef {Object} Grading
 * @property {boolean} enabled - Whether grading is enabled. Defaults to false.
 * @property {number} brightness - The brightness of the grading effect, 0-3 range. Defaults to 1.
 * @property {number} contrast - The contrast of the grading effect, 0.5-1.5 range. Defaults to 1.
 * @property {number} saturation - The saturation of the grading effect, 0-2 range. Defaults to 1.
 * @property {Color} tint - The tint color of the grading effect. Defaults to white.
 */

/**
 * @typedef {Object} Vignette
 * @property {number} intensity - The intensity of the vignette effect, 0-1 range. Defaults to 0,
 * making it disabled.
 * @property {number} inner - The inner distance of the vignette effect measured from the center of
 * the screen, 0-3 range. This is where the vignette effect starts. Value larger than 1 represents
 * the value off screen, which allows more control. Defaults to 0.5, representing half the distance
 * from center.
 * @property {number} outer - The outer distance of the vignette effect measured from the center of
 * the screen, 0-3 range. This is where the vignette reaches full intensity. Value larger than 1
 * represents the value off screen, which allows more control. Defaults to 1, representing the full
 * screen.
 * @property {number} curvature - The curvature of the vignette effect, 0.01-10 range. The vignette
 * is rendered using a rectangle with rounded corners, and this parameter controls the curvature of
 * the corners. Value of 1 represents a circle. Smaller values make the corners more square, while
 * larger values make them more rounded. Defaults to 0.5.
 */

/**
 * @typedef {Object} Fringing
 * @property {number} intensity - The intensity of the fringing effect, 0-100 range. Defaults to 0,
 * making it disabled.
 */

/**
 * @typedef {Object} Taa
 * @property {boolean} enabled - Whether Taa is enabled. Defaults to false.
 * @property {number} jitter - The intensity of the camera jitter, 0-1 range. The larger the value,
 * the more jitter is applied to the camera, making the anti-aliasing effect more pronounced. This
 * also makes the image more blurry, and rendering.sharpness parameter can be used to counteract.
 * Defaults to 1.
 */

/**
 * Implementation of a simple to use camera rendering pass, which supports SSAO, Bloom and
 * other rendering effects.
 *
 * @category Render Pass
 */
class CameraFrame {
    /**
     * Rendering settings.
     *
     * @type {Rendering}
     */
    rendering = {
        renderFormats: [PIXELFORMAT_111110F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F],
        stencil: false,
        renderTargetScale: 1.0,
        samples: 1,
        sceneColorMap: false,
        sceneDepthMap: false,
        toneMapping: 0,
        sharpness: 0.0
    };

    /**
     * SSAO settings.
     *
     * @type {Ssao}
     */
    ssao = {
        type: SSAOTYPE_NONE,
        blurEnabled: true,
        intensity: 0.5,
        radius: 30,
        samples: 12,
        power: 6,
        minAngle: 10,
        scale: 1
    };

    /**
     * Bloom settings.
     *
     * @type {Bloom}
     */
    bloom = {
        intensity: 0,
        lastMipLevel: 1
    };

    /**
     * Grading settings.
     *
     * @type {Grading}
     */
    grading = {
        enabled: false,
        brightness: 1,
        contrast: 1,
        saturation: 1,
        tint: new Color(1, 1, 1, 1)
    };

    /**
     * Vignette settings.
     *
     * @type {Vignette}
     */
    vignette = {
        intensity: 0,
        inner: 0.5,
        outer: 1,
        curvature: 0.5
    };

    /**
     * Taa settings.
     *
     * @type {Taa}
     */
    taa = {
        enabled: false,
        jitter: 1
    };

    /**
     * Fringing settings.
     *
     * @type {Fringing}
     */
    fringing = {
        intensity: 0
    };

    options = new CameraFrameOptions();

    /**
     * @type {RenderPassCameraFrame|null}
     * @private
     */
    renderPassCamera = null;

    /**
     * Creates a new CameraFrame instance.
     *
     * @param {AppBase} app - The application.
     * @param {CameraComponent} cameraComponent - The camera component.
     */
    constructor(app, cameraComponent) {
        this.app = app;
        this.cameraComponent = cameraComponent;
        Debug.assert(cameraComponent, 'CameraFrame: cameraComponent must be defined');

        this.updateOptions();
        this.enabled = true;
    }

    /**
     * Destroys the camera frame, removing all render passes.
     */
    destroy() {
        this.disable();
    }

    enable() {
        if (!this.renderPassCamera) {
            const cameraComponent = this.cameraComponent;
            this.renderPassCamera = new RenderPassCameraFrame(this.app, cameraComponent, this.options);
            cameraComponent.renderPasses = [this.renderPassCamera];
        }
    }

    disable() {
        if (this.renderPassCamera) {
            const cameraComponent = this.cameraComponent;
            cameraComponent.renderPasses?.forEach((renderPass) => {
                renderPass.destroy();
            });
            cameraComponent.renderPasses = [];
            cameraComponent.rendering = null;

            cameraComponent.jitter = 0;
        }
    }

    /**
     * Sets the enabled state of the camera frame. This disabled the render passes, and releases
     * any resources.
     *
     * @type {boolean}
     */
    set enabled(value) {
        if (value) {
            this.enable();
        } else {
            this.disable();
        }
    }

    /**
     * Gets the enabled state of the camera frame.
     *
     * @type {boolean}
     */
    get enabled() {
        return this.renderPassCamera !== null;
    }

    updateOptions() {

        const { options, rendering, bloom, taa, ssao } = this;
        options.stencil = rendering.stencil;
        options.samples = rendering.samples;
        options.sceneColorMap = rendering.sceneColorMap;
        options.prepassEnabled = rendering.sceneDepthMap;
        options.bloomEnabled = bloom.intensity > 0;
        options.taaEnabled = taa.enabled;
        options.ssaoType = ssao.type;
        options.ssaoBlurEnabled = ssao.blurEnabled;
        options.formats = rendering.renderFormats.slice();
    }

    /**
     * Applies any changes made to the properties of this instance.
     */
    update() {

        if (!this.enabled) return;

        const cameraComponent = this.cameraComponent;
        const { options, renderPassCamera, rendering, bloom, grading, vignette, fringing, taa, ssao } = this;

        // options that can cause the passes to be re-created
        this.updateOptions();
        renderPassCamera.update(options);

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

        composePass.vignetteEnabled = vignette.intensity > 0;
        if (composePass.vignetteEnabled) {
            composePass.vignetteInner = vignette.inner;
            composePass.vignetteOuter = vignette.outer;
            composePass.vignetteCurvature = vignette.curvature;
            composePass.vignetteIntensity = vignette.intensity;
        }

        composePass.fringingEnabled = fringing.intensity > 0;
        if (composePass.fringingEnabled) {
            composePass.fringingIntensity = fringing.intensity;
        }

        // enable camera jitter if taa is enabled
        cameraComponent.jitter = taa.enabled ? taa.jitter : 0;
    }
}

export { CameraFrame };
