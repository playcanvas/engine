import { math } from '../../../core/math/math.js';
import { TONEMAP_NONE } from '../../../scene/constants.js';
import { CameraFrameEffect } from '../../render-passes/camera-frame-effect.js';
import { FRAMERESOURCE_SCENECOLORHALF } from '../../render-passes/constants.js';
import { meterHistogram } from './auto-exposure-metering.js';
import glslComposeAutoExposurePS from './glsl/compose-ps.js';
import { AUTO_EXPOSURE_BINS, FramePassLuminanceHistogram } from './passes/frame-pass-luminance-histogram.js';
import wgslComposeAutoExposurePS from './wgsl/compose-ps.js';

/**
 * @import { CameraFrame } from '../../render-passes/camera-frame.js'
 * @import { CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources } from '../../render-passes/camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

// the log2 of the brightness the average of the screen is displayed at, middle grey, before the
// exposure compensation
const LOG2_MIDDLE_GREY = Math.log2(0.18);

// how far the range of brightness the histogram covers extends beyond the brightness the limits of
// the exposure display as middle grey, in EV, so that the parts of the screen the average leaves
// out are still counted apart from the parts it includes
const RANGE_MARGIN = 4;

/**
 * The auto exposure effect, which adapts the exposure of the camera to the brightness of what it
 * sees, like the eye adapting to the dark or to the daylight. Every frame, it measures a histogram
 * of the brightness of the screen and averages the part of it between two fractions of the
 * screen, leaving out the darkest and the brightest parts, such as deep shadows and the sun. It
 * then changes the exposure gradually towards the one which displays that average as middle
 * grey.
 *
 * The exposure it adapts is the one the camera renders with: the exposure of the scene, or the
 * exposure of the physical camera with physical units, which it scales by up to
 * {@link AutoExposureEffect#minEv} and {@link AutoExposureEffect#maxEv} stops. Every part of the
 * frame which uses the exposure follows it, the tone mapping of the composition and the
 * anti-aliasing among them. It has no effect without tone mapping, as the composition then applies
 * no exposure.
 *
 * The histogram is read back to the CPU, so the exposure follows the screen a frame or two late,
 * which the gradual adaptation hides. It is not registered by default - add it to a
 * {@link CameraFrame}:
 *
 * ```javascript
 * const autoExposure = new AutoExposureEffect(app.graphicsDevice);
 * cameraFrame.addEffect(autoExposure);
 * cameraFrame.update();
 * ```
 *
 * @category Graphics
 */
class AutoExposureEffect extends CameraFrameEffect {
    /**
     * The exposure compensation in EV: how much brighter than middle grey the average of the
     * screen is displayed. Positive values brighten the image, negative values darken it, each
     * step doubling or halving it. Defaults to 0.
     *
     * @type {number}
     */
    compensation = 0;

    /**
     * The lowest exposure the effect adapts to, in EV relative to the exposure of the camera: -2
     * lets it darken the image to a quarter of its brightness, for bright scenes. Defaults to -6.
     *
     * @type {number}
     */
    minEv = -6;

    /**
     * The highest exposure the effect adapts to, in EV relative to the exposure of the camera: 2
     * lets it brighten the image four times, for dark scenes. Defaults to 6.
     *
     * @type {number}
     */
    maxEv = 6;

    /**
     * How fast the exposure adapts when the scene gets brighter, as from a dark interior into the
     * daylight. Higher values adapt faster - the exposure covers about two thirds of the change in
     * 1 / speedDarkToLight seconds. Defaults to 3.
     *
     * @type {number}
     */
    speedDarkToLight = 3;

    /**
     * How fast the exposure adapts when the scene gets darker, as from the daylight into a dark
     * interior. Higher values adapt faster - the exposure covers about two thirds of the change in
     * 1 / speedLightToDark seconds. The eye adapts to the dark more slowly than to the light.
     * Defaults to 1.
     *
     * @type {number}
     */
    speedLightToDark = 1;

    /**
     * The fraction of the screen, 0-1, which is left out of the average as the darkest part of it,
     * such as deep shadows. Higher values meter the brighter parts of the screen, darkening the
     * image. Defaults to 0.1.
     *
     * @type {number}
     */
    lowPercent = 0.1;

    /**
     * The fraction of the screen, 0-1, below which the average is taken, the brightest part above
     * it left out, such as the sun and bright highlights. Defaults to 0.9.
     *
     * @type {number}
     */
    highPercent = 0.9;

    /**
     * How much the brightness of the center of the screen counts over its edges, 0-1 range. 0
     * meters the whole screen equally, 1 mostly its center. Defaults to 0.5.
     *
     * @type {number}
     */
    centerWeight = 0.5;

    /**
     * The passes of the effect, while they exist.
     *
     * @type {FramePassLuminanceHistogram|null}
     * @private
     */
    _pass = null;

    /**
     * The camera frame the passes were created for. They render for it until it next updates, even
     * once the effect is removed from it.
     *
     * @type {CameraFrame|null}
     * @private
     */
    _passesCameraFrame = null;

    /**
     * The latest histogram read back.
     *
     * @private
     */
    _histogram = new Uint32Array(AUTO_EXPOSURE_BINS);

    /**
     * The log2 luminance of the average of the latest histogram, or null before the first one
     * arrives.
     *
     * @type {number|null}
     * @private
     */
    _averageLog2 = null;

    /**
     * The adaptation, in EV relative to the exposure of the camera.
     *
     * @private
     */
    _ev = 0;

    /**
     * Whether the next measurement is adapted to at once.
     *
     * @private
     */
    _snap = true;

    /**
     * Incremented by {@link AutoExposureEffect#reset}, and tagging each histogram measured, so that
     * the histograms measured before a reset - the view before a cut - are not adapted to.
     *
     * @private
     */
    _measurement = 0;

    /** @private */
    _exposure = 1;

    /** @private */
    _exposureScale = 1;

    // the parameters the frames rendered until the next update use
    /** @private */
    _compensation = 0;

    /** @private */
    _minEv = -6;

    /** @private */
    _maxEv = 6;

    /** @private */
    _speedDarkToLight = 3;

    /** @private */
    _speedLightToDark = 1;

    /** @private */
    _lowPercent = 0.1;

    /** @private */
    _highPercent = 0.9;

    /** @private */
    _centerWeight = 0.5;

    // the debug view: the bins relative to the largest one, the range of the histogram they were
    // measured over, and the markers
    /** @private */
    _bars = new Float32Array(AUTO_EXPOSURE_BINS);

    /** @private */
    _barsRange = new Float32Array(2);

    /** @private */
    _markers = new Float32Array(4);

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'autoExposure', {
            glsl: glslComposeAutoExposurePS,
            wgsl: wgslComposeAutoExposurePS,
            debugViews: ['autoexposure'],
            requires: [FRAMERESOURCE_SCENECOLORHALF]
        });
    }

    /**
     * Gets whether the effect contributes to the frame: while enabled, and while the composition
     * applies tone mapping, as without it no exposure is applied.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && this.cameraFrame?.rendering.toneMapping !== TONEMAP_NONE;
    }

    /**
     * Gets the exposure the camera renders with this frame: the exposure of the scene, or of the
     * physical camera with physical units, scaled by the adaptation.
     *
     * @type {number}
     */
    get exposure() {
        return this._exposure;
    }

    /**
     * Gets the latest histogram of the brightness of the screen read back, the weight of each of
     * its 64 bins, from the darkest to the brightest. The bins span the brightness the limits of
     * the exposure display as middle grey, and 4 EV beyond on either side; brightness outside of
     * that counts in the bin at the end. The array is updated in place as histograms arrive.
     *
     * @type {Uint32Array}
     */
    get histogram() {
        return this._histogram;
    }

    /**
     * Adapts the exposure to the next measurement at once, rather than gradually - for a cut to a
     * different view, after which a gradual adaptation would look out of place.
     */
    reset() {
        this._measurement++;
        this._averageLog2 = null;
        this._snap = true;
    }

    /**
     * Gets the scale the adaptation applies to the exposure of the camera this frame, 2 raised to
     * the adaptation in EV.
     *
     * @type {number}
     */
    get cameraExposureScale() {
        return this._exposureScale;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {
        this._pass = new FramePassLuminanceHistogram(this.device, resources.sceneColorHalf);
        this._pass.onHistogram = (histogram, rangeMin, rangeMax, tag) => this._measure(histogram, rangeMin, rangeMax, tag);
        this._passesCameraFrame = this.cameraFrame;
        passes.postResolve.push(this._pass);
    }

    /**
     * @ignore
     */
    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
        this._passesCameraFrame = null;
    }

    update() {
        this._compensation = this.compensation;
        this._minEv = Math.min(this.minEv, this.maxEv);
        this._maxEv = Math.max(this.minEv, this.maxEv);
        this._speedDarkToLight = Math.max(this.speedDarkToLight, 0);
        this._speedLightToDark = Math.max(this.speedLightToDark, 0);
        this._lowPercent = math.clamp(this.lowPercent, 0, 0.99);
        this._highPercent = math.clamp(this.highPercent, this._lowPercent + 0.01, 1);
        this._centerWeight = math.clamp(this.centerWeight, 0, 1);

        // the debug view, updated in place
        this.setUniform('aeHistogram[0]', this._bars);
        this.setUniform('aeMarkers', this._markers);
    }

    /**
     * @param {CameraFrameEffectContext} frame - The values of this frame.
     */
    frameUpdate(frame) {
        const { app, cameraComponent } = this._passesCameraFrame;
        const { scene } = app;
        const camera = cameraComponent.camera;

        // the exposure of the camera, which the adaptation scales
        const baseExposure = scene.physicalUnits ? camera.getExposure() : scene.exposure;
        const log2Base = Math.log2(Math.max(baseExposure, 1e-30));

        // the log2 of the brightness the average of the screen is displayed at
        const key = LOG2_MIDDLE_GREY + this._compensation;

        // the adaptation advances by the time of the application, so it stops while it is paused
        const { dt } = frame;

        // adapts towards the exposure displaying the measured average at the key brightness, within
        // the limits - faster as the scene gets brighter than as it gets darker
        const minEv = this._minEv;
        const maxEv = this._maxEv;
        if (this._averageLog2 !== null) {
            const target = math.clamp(key - this._averageLog2 - log2Base, minEv, maxEv);
            if (this._snap) {
                this._ev = target;
                this._snap = false;
            } else {
                const delta = target - this._ev;
                const speed = delta < 0 ? this._speedDarkToLight : this._speedLightToDark;
                this._ev += delta * (1 - Math.exp(-dt * speed));
            }
        }
        this._ev = math.clamp(this._ev, minEv, maxEv);
        this._exposureScale = 2 ** this._ev;
        this._exposure = baseExposure * this._exposureScale;

        // the range of brightness the histogram measured this frame covers: from the brightness the
        // highest exposure displays as middle grey to the brightness the lowest one does, and a
        // margin beyond either
        const pass = this._pass;
        pass.rangeMin = key - log2Base - maxEv - RANGE_MARGIN;
        pass.rangeMax = key - log2Base - minEv + RANGE_MARGIN;
        pass.centerWeight = this._centerWeight;
        pass.tag = this._measurement;

        // the debug view marks the brightness the camera exposes as middle grey, along the range
        // the displayed histogram was measured over
        const [barsMin, barsMax] = this._barsRange;
        this._markers[3] = barsMax > barsMin ? (key - Math.log2(this._exposure) - barsMin) / (barsMax - barsMin) : 0;
    }

    /**
     * Takes a histogram read back.
     *
     * @param {Uint32Array} histogram - The weight of each bin.
     * @param {number} rangeMin - The log2 luminance the first bin counts.
     * @param {number} rangeMax - The log2 luminance the last bin counts.
     * @param {number} tag - The measurement the histogram belongs to, see the reset.
     * @private
     */
    _measure(histogram, rangeMin, rangeMax, tag) {

        // measured before a reset, of the view before the cut
        if (tag !== this._measurement) {
            return;
        }

        this._histogram.set(histogram);

        const lastBin = AUTO_EXPOSURE_BINS - 1;
        const position = meterHistogram(histogram, this._lowPercent, this._highPercent);
        if (position >= 0) {
            this._averageLog2 = rangeMin + position / lastBin * (rangeMax - rangeMin);
        }

        // the debug view: the bins relative to the largest one, the fractions of the screen the
        // average is taken between, and the average, as positions along the histogram
        let largest = 1;
        for (let i = 0; i < histogram.length; i++) {
            largest = Math.max(largest, histogram[i]);
        }
        let total = 0;
        for (let i = 0; i < histogram.length; i++) {
            this._bars[i] = histogram[i] / largest;
            total += histogram[i];
        }

        let lowBin = -1;
        let highBin = lastBin;
        let start = 0;
        for (let i = 0; i < histogram.length; i++) {
            const end = start + histogram[i];
            if (lowBin < 0 && end > total * this._lowPercent) {
                lowBin = i;
            }
            if (end >= total * this._highPercent) {
                highBin = i;
                break;
            }
            start = end;
        }

        const markers = this._markers;
        markers[0] = Math.max(lowBin, 0) / lastBin;
        markers[1] = highBin / lastBin;
        markers[2] = position >= 0 ? position / lastBin : 0;
        this._barsRange[0] = rangeMin;
        this._barsRange[1] = rangeMax;
    }
}

export { AutoExposureEffect };
