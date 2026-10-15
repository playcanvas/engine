import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';

/**
 * @import { DynamicSkyEffect } from '../dynamic-sky-effect.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 */

/**
 * Renders the volumetric clouds of the dynamic sky effect to a texture of their own, at a reduced
 * resolution by default, which the sky reads.
 *
 * @ignore
 */
class RenderPassDynamicSkyClouds extends RenderPassShaderQuad {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {DynamicSkyEffect} effect - The effect the clouds are rendered for.
     */
    constructor(device, effect) {
        super(device);
        this.effect = effect;
    }

    execute() {

        // the values of the sky, bound right before the draw, as the uniforms are global and other
        // cameras render their own skies
        this.effect._bindSkyUniforms();
        super.execute();
    }
}

export { RenderPassDynamicSkyClouds };
