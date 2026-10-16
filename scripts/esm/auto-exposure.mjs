import { AutoExposureEffect } from 'playcanvas';
import { CameraFrameEffectScript } from './camera-frame-effect.mjs';

/**
 * Adds the {@link AutoExposureEffect} to the camera frame of the camera entity it is attached to,
 * next to the `cameraFrame` script. The auto exposure adapts the exposure of the camera to the
 * brightness of what it sees, like the eye adapting to the dark or to the daylight. It has no
 * effect while the tone mapping of the `cameraFrame` script is set to none.
 *
 * @category Post-Processing
 */
class AutoExposureEffectScript extends CameraFrameEffectScript {
    static scriptName = 'autoExposureEffect';

    /**
     * The exposure compensation in EV: how much brighter than middle grey the average of the
     * screen is displayed.
     *
     * @attribute
     * @range [-5, 5]
     * @precision 1
     * @step 0.1
     */
    compensation = 0;

    /**
     * The lowest exposure the effect adapts to, in EV relative to the exposure of the camera.
     *
     * @attribute
     * @range [-16, 0]
     * @precision 1
     * @step 0.5
     */
    minEv = -6;

    /**
     * The highest exposure the effect adapts to, in EV relative to the exposure of the camera.
     *
     * @attribute
     * @range [0, 16]
     * @precision 1
     * @step 0.5
     */
    maxEv = 6;

    /**
     * How fast the exposure adapts when the scene gets brighter. Higher values adapt faster.
     *
     * @attribute
     * @range [0, 20]
     * @precision 1
     * @step 0.1
     */
    speedDarkToLight = 3;

    /**
     * How fast the exposure adapts when the scene gets darker. Higher values adapt faster.
     *
     * @attribute
     * @range [0, 20]
     * @precision 1
     * @step 0.1
     */
    speedLightToDark = 1;

    /**
     * The fraction of the screen left out of the average as the darkest part of it.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    lowPercent = 0.1;

    /**
     * The fraction of the screen below which the average is taken, the brightest part above it
     * left out.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    highPercent = 0.9;

    /**
     * How much the brightness of the center of the screen counts over its edges. 0 meters the
     * whole screen equally, 1 mostly its center.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    centerWeight = 0.5;

    /**
     * Displays the scene at the exposure the camera renders with, with the histogram of its
     * brightness drawn along the bottom. This and the debug setting of the `cameraFrame` script
     * override each other, the last one changed is displayed.
     *
     * @attribute
     */
    debug = false;

    createEffect(device) {
        return new AutoExposureEffect(device);
    }

    updateEffect(effect) {
        effect.compensation = this.compensation;
        effect.minEv = this.minEv;
        effect.maxEv = this.maxEv;
        effect.speedDarkToLight = this.speedDarkToLight;
        effect.speedLightToDark = this.speedLightToDark;
        effect.lowPercent = this.lowPercent;
        effect.highPercent = this.highPercent;
        effect.centerWeight = this.centerWeight;
    }

    get debugView() {
        return this.debug ? 'autoexposure' : null;
    }
}

export { AutoExposureEffectScript };
