import { CameraFrameEffect } from '../../render-passes/camera-frame-effect.js';
import { FRAMERESOURCE_DEPTH } from '../../render-passes/constants.js';
import { RenderPassTAA } from './passes/render-pass-taa.js';

/**
 * @import { CameraFrameEffectPasses, CameraFrameEffectResources, CameraFrameEffectScene } from '../../render-passes/camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The temporal anti-aliasing (TAA) effect, a technique used to reduce aliasing in the rendered
 * image by blending multiple frames together over time. The camera is offset by a different
 * fraction of a pixel every frame, and each frame is accumulated into a history, reprojected using
 * the scene depth to follow the motion of the camera.
 *
 * The effect resolves the scene before the other effects read it, so that the depth of field, the
 * bloom and the composition all work with the anti-aliased scene. It can also upscale a scene
 * rendered at a lower resolution, see {@link TaaEffect#upscale}.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#taa}.
 *
 * @category Graphics
 */
class TaaEffect extends CameraFrameEffect {
    /**
     * Whether TAA is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    enabled = false;

    /**
     * The intensity of the camera jitter, 0-1 range. The larger the value, the more jitter is
     * applied to the camera, making the anti-aliasing effect more pronounced. This also makes the
     * image more blurry, and rendering.sharpness parameter of the {@link CameraFrame} can be used
     * to counteract. Defaults to 1.
     *
     * @type {number}
     */
    jitter = 1;

    /**
     * Whether TAA accumulates the frames rendered at a lower resolution, see
     * rendering.renderTargetScale of the {@link CameraFrame}, at the full resolution - the jitter
     * placing their samples at different positions within the full resolution pixels, which
     * recovers detail lost to the lower resolution. Moving objects can blur or ghost more than with
     * TAA alone, as the history is relied on for longer while upscaling. Defaults to false.
     *
     * @type {boolean}
     */
    upscale = false;

    /**
     * The pass resolving the scene, while the effect's passes exist.
     *
     * @type {RenderPassTAA|null}
     * @private
     */
    _pass = null;

    /**
     * Whether the existing pass upscales.
     *
     * @type {boolean}
     * @private
     */
    _upscale = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'taa', {
            requires: [FRAMERESOURCE_DEPTH]
        });
    }

    /**
     * @type {number}
     * @ignore
     */
    get cameraJitter() {
        return this.jitter;
    }

    /**
     * @returns {string} The key.
     * @ignore
     */
    buildKey() {
        // upscaling changes the resolution of the history and the resolve shader
        return `${this.upscale}`;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {
        const { cameraFrame } = this;
        this._upscale = this.upscale;
        this._pass = new RenderPassTAA(this.device, cameraFrame.cameraComponent, {
            upscale: this.upscale,
            format: cameraFrame.hdrFormat,
            depth: resources.depth
        });
        passes.resolve.push(this._pass);
    }

    /**
     * @ignore
     */
    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
        this._upscale = false;
    }

    update() {
        // the history is blended at the exposure the composition displays the scene with
        this._pass.toneMapping = this.cameraFrame.rendering.toneMapping;
    }

    /**
     * @param {CameraFrameEffectScene} scene - The scene being resolved.
     * @ignore
     */
    resolveScene(scene) {

        // the history is double buffered, the pass rendering to the other texture each frame
        const pass = this._pass;
        pass.setSourceTexture(scene.texture);
        scene.texture = pass.update();

        // when upscaling, the history has the resolution of the render target the camera renders
        // to - the back buffer when it has none. The camera is the pass's own, as the effect can
        // be detached while the frame still renders its passes, until the camera frame updates.
        if (this._upscale) {
            const target = pass.cameraComponent.renderTarget ?? pass.device.backBuffer;
            scene.width = target.width;
            scene.height = target.height;
        }
    }
}

export { TaaEffect };
