import { math } from '../../../core/math/math.js';
import glslComposeSmaaPS from './glsl/compose-ps.js';
import wgslComposeSmaaPS from './wgsl/compose-ps.js';
import { CameraFrameEffect } from '../../render-passes/camera-frame-effect.js';
import { FramePassSmaa } from './passes/frame-pass-smaa.js';
import { createSmaaLookupTextures } from './smaa-lookup.js';

/**
 * @import { CameraFrameEffectPasses, CameraFrameEffectResources, CameraFrameEffectScene } from '../../render-passes/camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 */

/**
 * The SMAA effect - Subpixel Morphological Anti-Aliasing (SMAA 1x), a technique smoothing the
 * jagged edges of the rendered geometry. It finds the edges in the image, recognizes the shape of
 * each aliased edge, and blends the pixels along it with their neighbours by the area the edge
 * before aliasing would cover. Unlike temporal anti-aliasing it works within a single frame: it
 * does not jitter the camera, needs no history and does not ghost, at the cost of not resolving
 * detail finer than a pixel.
 *
 * The effect resolves the scene before the other effects read it, so that the depth of field, the
 * bloom and the composition all work with the anti-aliased scene. It is not registered by default
 * - add it to a {@link CameraFrame}:
 *
 * ```javascript
 * const smaa = new SmaaEffect(app.graphicsDevice);
 * cameraFrame.addEffect(smaa);
 * cameraFrame.update();
 * ```
 *
 * The parameters default to the HIGH quality preset of the reference implementation. The
 * presets, as threshold / maxSearchSteps / maxSearchStepsDiag / cornerRounding, are LOW: 0.15 /
 * 4 / 0 / 100, MEDIUM: 0.1 / 8 / 0 / 100, HIGH: 0.1 / 16 / 8 / 25 and ULTRA: 0.05 / 32 / 16 / 25.
 *
 * It can be combined with multisampling, see `rendering.samples` of the camera frame, which smooths
 * the edges further at a higher cost. Combined with {@link TaaEffect}, it resolves the scene in the
 * order the effects are registered - after the built-in temporal anti-aliasing unless inserted
 * before it with {@link CameraFrame#insertEffectBefore}.
 *
 * Based on the reference implementation of SMAA by Jorge Jimenez, Jose I. Echevarria, Belen
 * Masia, Fernando Navarro and Diego Gutierrez, distributed under the MIT license.
 *
 * @category Graphics
 */
class SmaaEffect extends CameraFrameEffect {
    /**
     * The brightness difference between neighbouring pixels above which they are separated by an
     * edge, 0-0.5 range. Lower values smooth more edges, at a higher cost, and can smooth texture
     * detail along with the geometry. Defaults to 0.1.
     *
     * @type {number}
     */
    threshold = 0.1;

    /**
     * The maximum number of steps searching for the end of a horizontal or vertical edge, each
     * step covering two pixels, 1-112 range. The ends of longer edges are not found, which smooths
     * them less accurately. Defaults to 16.
     *
     * @type {number}
     */
    maxSearchSteps = 16;

    /**
     * The maximum number of steps searching for the end of a diagonal edge, 0-20 range. Zero
     * disables the detection of diagonal edges, which are then smoothed as horizontal and
     * vertical ones. Defaults to 8.
     *
     * @type {number}
     */
    maxSearchStepsDiag = 8;

    /**
     * How much the sharp corners of the geometry are rounded, 0-100 range. Zero keeps them the
     * sharpest, 100 smooths them like the rest of the edges. Defaults to 25.
     *
     * @type {number}
     */
    cornerRounding = 25;

    /**
     * The passes of the effect, while they exist.
     *
     * @type {FramePassSmaa|null}
     * @private
     */
    _pass = null;

    /**
     * The area lookup texture.
     *
     * @type {Texture|null}
     * @private
     */
    _areaTexture = null;

    /**
     * The search lookup texture.
     *
     * @type {Texture|null}
     * @private
     */
    _searchTexture = null;

    /**
     * Resolved once the lookup textures are filled.
     *
     * @type {Promise<void>}
     * @ignore
     */
    _lookupReady;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'smaa', {
            glsl: glslComposeSmaaPS,
            wgsl: wgslComposeSmaaPS,
            debugViews: ['smaaedges', 'smaaweights']
        });

        const lookup = createSmaaLookupTextures(device);
        this._areaTexture = lookup.area;
        this._searchTexture = lookup.search;
        this._lookupReady = lookup.ready;
    }

    destroy() {
        super.destroy();
        this._areaTexture?.destroy();
        this._areaTexture = null;
        this._searchTexture?.destroy();
        this._searchTexture = null;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {
        this._pass = new FramePassSmaa(this.device, this.cameraFrame.hdrFormat, this._areaTexture, this._searchTexture);
        passes.resolve.push(this._pass);
    }

    /**
     * @ignore
     */
    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
    }

    update() {
        const pass = this._pass;
        pass.threshold = math.clamp(this.threshold, 0, 0.5);
        pass.maxSearchSteps = math.clamp(Math.round(this.maxSearchSteps), 1, 112);
        pass.maxSearchStepsDiag = math.clamp(Math.round(this.maxSearchStepsDiag), 0, 20);
        pass.cornerRounding = math.clamp(this.cornerRounding, 0, 100);

        // the edges are detected, and the pixels blended, at the exposure the composition
        // displays the scene with
        pass.toneMapping = this.cameraFrame.rendering.toneMapping;

        // the textures the debug views display
        this.setUniform('smaaEdgesTexture', pass.edgesTexture);
        this.setUniform('smaaWeightsTexture', pass.weightsTexture);
    }

    /**
     * @param {CameraFrameEffectScene} scene - The scene being resolved.
     * @ignore
     */
    resolveScene(scene) {
        const pass = this._pass;
        pass.setSourceTexture(scene.texture);
        scene.texture = pass.outputTexture;
    }
}

export { SmaaEffect };
