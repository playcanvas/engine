import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA32U, PIXELFORMAT_RGBA8, SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL
} from '../../../../platform/graphics/constants.js';
import { FramePass } from '../../../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../../../platform/graphics/render-target.js';
import { Texture } from '../../../../platform/graphics/texture.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';
import glslHistogramPS from '../glsl/histogram-ps.js';
import glslMeterPS from '../glsl/meter-ps.js';
import glslSumPS from '../glsl/sum-ps.js';
import wgslHistogramPS from '../wgsl/histogram-ps.js';
import wgslMeterPS from '../wgsl/meter-ps.js';
import wgslSumPS from '../wgsl/sum-ps.js';
import { RenderPassHistogramStep } from './render-pass-histogram-step.js';

/**
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 */

// the size of the meter the scene is averaged into
const METER_WIDTH = 128;
const METER_HEIGHT = 64;

/**
 * The number of bins of the histogram, counted four per texel of its render targets.
 *
 * @ignore
 */
const AUTO_EXPOSURE_BINS = 64;

/**
 * Measures the brightness of the scene for the auto exposure, as a histogram read back to the CPU.
 * The scene is averaged into the meter, a small grid of the brightness of the blocks of the
 * screen; the texels of each row of the meter are counted into the bins of a histogram per row;
 * those are summed into the histogram of the whole screen, and the histogram is read back. The
 * counts are gathered rather than scattered with blending, in integer render targets, so they are
 * exact on every device.
 *
 * @ignore
 */
class FramePassLuminanceHistogram extends FramePass {
    /**
     * The log2 luminance of the brightness the first bin of the histogram counts.
     *
     * @type {number}
     */
    rangeMin = -8;

    /**
     * The log2 luminance of the brightness the last bin of the histogram counts. Brightness beyond
     * the range counts in the bin at its end.
     *
     * @type {number}
     */
    rangeMax = 8;

    /**
     * How much the metering favors the center of the screen, 0-1.
     *
     * @type {number}
     */
    centerWeight = 0;

    /**
     * A value handed back with each histogram read back, as it was when the histogram was
     * measured - to tell the histograms measured before a change from those measured after it.
     *
     * @type {number}
     */
    tag = 0;

    /**
     * Called with each histogram read back - the weight of each bin, in 16.16 fixed point, valid
     * during the call only - the range of brightness it was measured over, and the tag it was
     * measured with.
     *
     * @type {((histogram: Uint32Array, rangeMin: number, rangeMax: number, tag: number) => void)|null}
     */
    onHistogram = null;

    /** @type {Texture} */
    sourceTexture;

    /** @type {RenderTarget} */
    meterTarget;

    /** @type {RenderTarget} */
    rowsTarget;

    /** @type {RenderTarget} */
    histogramTarget;

    /**
     * Whether a read of the histogram is in flight. A histogram is read back once the previous one
     * has arrived, rather than every frame.
     *
     * @private
     */
    _reading = false;

    /** @private */
    _destroyed = false;

    /** @private */
    _readData = new Uint32Array(AUTO_EXPOSURE_BINS);

    /** @private */
    _sourceSize = new Float32Array(2);

    /** @private */
    _range = new Float32Array(2);

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture} sourceTexture - The texture of the scene to measure, the half resolution
     * copy of the resolved scene.
     */
    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;

        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('autoExposureMeterPS', glslMeterPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('autoExposureMeterPS', wgslMeterPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('autoExposureHistogramPS', glslHistogramPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('autoExposureHistogramPS', wgslHistogramPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('autoExposureSumPS', glslSumPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('autoExposureSumPS', wgslSumPS);

        const binTexels = AUTO_EXPOSURE_BINS / 4;
        this.meterTarget = this.createTarget('AutoExposureMeter', PIXELFORMAT_RGBA8, METER_WIDTH, METER_HEIGHT);
        this.rowsTarget = this.createTarget('AutoExposureRows', PIXELFORMAT_RGBA32U, binTexels, METER_HEIGHT);
        this.histogramTarget = this.createTarget('AutoExposureHistogram', PIXELFORMAT_RGBA32U, binTexels, 1);

        const { scope } = device;
        this._sourceSizeId = scope.resolve('aeSourceSize');
        this._rangeId = scope.resolve('aeRange');
        this._centerWeightId = scope.resolve('aeCenterWeight');

        // the sizes the shaders loop over
        const defines = new Map([
            ['{AE_METER_WIDTH}', `${METER_WIDTH}`],
            ['{AE_METER_HEIGHT}', `${METER_HEIGHT}`],
            ['{AE_BINS}', `${AUTO_EXPOSURE_BINS}`]
        ]);

        // the passes render every texel of their fixed size targets, which need no clearing
        const meterPass = new RenderPassHistogramStep(device, this, 'Meter', 'autoExposureMeterPS', 'vec4', defines);
        meterPass.init(this.meterTarget);
        meterPass.setTexture('aeSourceTexture', sourceTexture);

        const rowsPass = new RenderPassHistogramStep(device, this, 'Rows', 'autoExposureHistogramPS', 'uvec4', defines);
        rowsPass.init(this.rowsTarget);
        rowsPass.setTexture('aeMeterTexture', this.meterTarget.colorBuffer);

        const sumPass = new RenderPassHistogramStep(device, this, 'Sum', 'autoExposureSumPS', 'uvec4', defines);
        sumPass.init(this.histogramTarget);
        sumPass.setTexture('aeRowsTexture', this.rowsTarget.colorBuffer);

        // the histogram is read back once the pass rendering it has ended
        sumPass.onAfter = () => this.readHistogram();

        this.beforePasses = [meterPass, rowsPass, sumPass];
    }

    /**
     * @param {string} name - The name of the target.
     * @param {number} format - The format of its texture.
     * @param {number} width - The width of the target.
     * @param {number} height - The height of the target.
     * @returns {RenderTarget} The render target, without depth.
     * @private
     */
    createTarget(name, format, width, height) {
        return new RenderTarget({
            name,
            colorBuffer: new Texture(this.device, {
                name,
                width,
                height,
                format,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            }),
            depth: false
        });
    }

    /**
     * Binds the size of the scene and the parameters, for the passes rendering.
     *
     * @ignore
     */
    bindParameters() {
        const { width, height } = this.sourceTexture;
        const sourceSize = this._sourceSize;
        sourceSize[0] = width;
        sourceSize[1] = height;
        this._sourceSizeId.setValue(sourceSize);

        const range = this._range;
        range[0] = this.rangeMin;
        range[1] = 1 / Math.max(this.rangeMax - this.rangeMin, 1e-6);
        this._rangeId.setValue(range);

        this._centerWeightId.setValue(this.centerWeight);
    }

    /**
     * Reads the histogram rendered this frame back, unless the previous read is still in flight.
     *
     * @private
     */
    readHistogram() {
        if (this._reading || !this.onHistogram) {
            return;
        }

        // the range the histogram was measured over, and its tag, for when it arrives
        const { rangeMin, rangeMax, tag } = this;
        const target = this.histogramTarget;
        const promise = target.colorBuffer.read(0, 0, AUTO_EXPOSURE_BINS / 4, 1, {
            renderTarget: target,
            data: this._readData,
            frequent: true
        });

        // a device which cannot read textures back measures nothing
        if (!promise) {
            return;
        }

        this._reading = true;
        promise.then((data) => {
            this._reading = false;
            if (!this._destroyed) {
                this.onHistogram?.(/** @type {Uint32Array} */ (data), rangeMin, rangeMax, tag);
            }
        }, () => {
            this._reading = false;
        });
    }

    destroy() {
        this._destroyed = true;
        this.onHistogram = null;
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;
        [this.meterTarget, this.rowsTarget, this.histogramTarget].forEach((target) => {
            target.destroyTextureBuffers();
            target.destroy();
        });
        this.sourceTexture = null;

        super.destroy();
    }
}

export { FramePassLuminanceHistogram, AUTO_EXPOSURE_BINS };
