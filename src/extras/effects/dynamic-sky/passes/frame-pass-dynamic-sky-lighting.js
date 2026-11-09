import { FramePass } from '../../../../platform/graphics/frame-pass.js';

/**
 * @import { DynamicSkyEffect } from '../dynamic-sky-effect.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 */

/**
 * Generates the lighting of the dynamic sky effect, on the frames it is due, and blends it while it
 * is interpolated - before the scene renders, so the scene is lit by the sky of the same frame.
 *
 * @ignore
 */
class FramePassDynamicSkyLighting extends FramePass {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {DynamicSkyEffect} effect - The effect the lighting is generated for.
     */
    constructor(device, effect) {
        super(device);
        this.effect = effect;
        this.executeEnabled = false;
    }

    execute() {
        this.effect._updateLighting();
    }
}

export { FramePassDynamicSkyLighting };
