import { SmaaEffect } from 'playcanvas';
import { CameraFrameEffectScript } from './camera-frame-effect.mjs';

/** @enum {string} */
const SmaaDebug = {
    NONE: 'none',
    EDGES: 'edges',
    WEIGHTS: 'weights'
};

/**
 * Adds the {@link SmaaEffect}, Subpixel Morphological Anti-Aliasing, to the camera frame of the
 * camera entity it is attached to, next to the `cameraFrame` script. SMAA smooths the jagged edges
 * of the geometry within a single frame, without the camera jitter and the history of TAA.
 *
 * The parameters default to the HIGH quality preset of the reference implementation. The
 * presets, as threshold / maxSearchSteps / maxSearchStepsDiag / cornerRounding, are LOW: 0.15 /
 * 4 / 0 / 100, MEDIUM: 0.1 / 8 / 0 / 100, HIGH: 0.1 / 16 / 8 / 25 and ULTRA: 0.05 / 32 / 16 / 25.
 *
 * @category Post-Processing
 */
class SmaaEffectScript extends CameraFrameEffectScript {
    static scriptName = 'smaaEffect';

    /**
     * The brightness difference between neighbouring pixels above which they are separated by an
     * edge. Lower values smooth more edges, at a higher cost.
     *
     * @attribute
     * @range [0, 0.5]
     * @precision 3
     * @step 0.005
     */
    threshold = 0.1;

    /**
     * The maximum number of steps searching for the end of a horizontal or vertical edge, each
     * step covering two pixels.
     *
     * @attribute
     * @range [1, 112]
     * @precision 0
     * @step 1
     */
    maxSearchSteps = 16;

    /**
     * The maximum number of steps searching for the end of a diagonal edge. Zero disables the
     * detection of diagonal edges.
     *
     * @attribute
     * @range [0, 20]
     * @precision 0
     * @step 1
     */
    maxSearchStepsDiag = 8;

    /**
     * How much the sharp corners of the geometry are rounded. Zero keeps them the sharpest, 100
     * smooths them like the rest of the edges.
     *
     * @attribute
     * @range [0, 100]
     * @precision 0
     * @step 1
     */
    cornerRounding = 25;

    /**
     * Displays what SMAA computes in place of the output of the camera: the edges it found, or how
     * much it blends the pixels. This and the debug setting of the `cameraFrame` script override
     * each other, the last one changed is displayed.
     *
     * @attribute
     * @type {SmaaDebug}
     */
    debug = SmaaDebug.NONE;

    createEffect(device) {
        return new SmaaEffect(device);
    }

    updateEffect(effect) {
        effect.threshold = this.threshold;
        effect.maxSearchSteps = this.maxSearchSteps;
        effect.maxSearchStepsDiag = this.maxSearchStepsDiag;
        effect.cornerRounding = this.cornerRounding;
    }

    get debugView() {
        return this.debug === SmaaDebug.EDGES || this.debug === SmaaDebug.WEIGHTS ? `smaa${this.debug}` : null;
    }
}

export { SmaaEffectScript, SmaaDebug };
