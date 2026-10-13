import { Script } from 'playcanvas';
import { CameraFrame as CameraFrameScript } from './camera-frame.mjs';

/**
 * @import { CameraFrame, CameraFrameEffect, GraphicsDevice } from 'playcanvas';
 */

/**
 * The base class of a script adding a custom {@link CameraFrameEffect} to the camera frame of the
 * entity it is attached to. Add the script to the camera entity, next to the `cameraFrame` script
 * ({@link CameraFrame}), which owns the camera frame.
 *
 * A subclass declares the parameters of its effect as attributes and implements two methods:
 * {@link CameraFrameEffectScript#createEffect}, returning the effect, and
 * {@link CameraFrameEffectScript#updateEffect}, copying the attributes into it. The effect is
 * registered with the camera frame as soon as both scripts exist, follows the enabled state of the
 * script, and is destroyed with it.
 *
 * @example
 * class TintEffectScript extends CameraFrameEffectScript {
 *     static scriptName = 'tintEffect';
 *
 *     // @attribute @range [0, 1]
 *     intensity = 1;
 *
 *     createEffect(device) {
 *         return new TintEffect(device);
 *     }
 *
 *     updateEffect(effect) {
 *         effect.intensity = this.intensity;
 *     }
 * }
 * @category Post-Processing
 */
class CameraFrameEffectScript extends Script {
    /**
     * The effect this script drives, created in `initialize`.
     *
     * @type {CameraFrameEffect|null}
     */
    effect = null;

    initialize() {
        this.effect = this.createEffect(this.app.graphicsDevice);
        if (!this.effect) return;
        this.effect.enabled = this.enabled;

        this.on('enable', () => {
            if (this.effect) this.effect.enabled = true;
        });

        this.on('disable', () => {
            if (this.effect) this.effect.enabled = false;
        });

        // destroying the effect also removes it from the camera frame
        this.on('destroy', () => {
            this.effect?.destroy();
            this.effect = null;
        });
    }

    postUpdate() {
        const effect = this.effect;
        if (!effect) return;

        // register with the camera frame once it exists - the cameraFrame script creates it in its
        // own initialize, which can run after this script's
        if (!effect.cameraFrame) {
            const cameraFrame = this.entity.script?.get(CameraFrameScript)?.engineCameraFrame;
            if (cameraFrame) {
                this.attachEffect(cameraFrame, effect);
            }
        }

        this.updateEffect(effect);
    }

    /**
     * Registers the effect with the camera frame. Override to place the effect before another one
     * sharing its compose slot, with {@link CameraFrame#insertEffectBefore}.
     *
     * @param {CameraFrame} cameraFrame - The camera frame.
     * @param {CameraFrameEffect} effect - The effect.
     */
    attachEffect(cameraFrame, effect) {
        cameraFrame.addEffect(effect);
    }

    /**
     * Creates the effect. Implemented by the subclass.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @returns {CameraFrameEffect|null} The effect.
     */
    createEffect(device) {
        console.error('CameraFrameEffectScript: createEffect must be implemented by the subclass.');
        return null;
    }

    /**
     * Copies the attributes of the script into the effect. Called every frame, after the effect
     * is registered. Implemented by the subclass.
     *
     * @param {CameraFrameEffect} effect - The effect.
     */
    updateEffect(effect) {
    }
}

export { CameraFrameEffectScript };
