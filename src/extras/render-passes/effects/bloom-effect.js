import { PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import glslComposeBloomPS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-bloom.js';
import wgslComposeBloomPS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-bloom.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { COMPOSESLOT_HDR, FRAMERESOURCE_SCENECOLORHALF } from '../constants.js';
import { FramePassBloom } from '../frame-pass-bloom.js';

/**
 * @import { CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources } from '../camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

// the frame resources the bloom needs: the half resolution scene, unless it is generated from the
// full resolution scene, which the composition reads anyway
const halfResolutionRequires = [FRAMERESOURCE_SCENECOLORHALF];
const fullResolutionRequires = [];

/**
 * The HDR bloom effect, a postprocessing technique that simulates the natural glow of bright light
 * sources by spreading their intensity beyond their boundaries, creating a soft and realistic
 * blooming effect.
 *
 * The bloom is generated from the scene by passes the effect owns, from a half resolution copy of
 * it or, with {@link BloomEffect#highQuality}, from the full resolution scene, and added to the
 * scene in linear HDR space, before tone mapping. It requires an HDR scene format, and is
 * disabled when the camera frame renders to {@link PIXELFORMAT_RGBA8}.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#bloom}.
 *
 * @category Graphics
 */
class BloomEffect extends CameraFrameEffect {
    /**
     * The intensity of the bloom effect, 0-0.1 range. Defaults to 0, making it disabled.
     *
     * @type {number}
     */
    intensity = 0;

    /**
     * The number of iterations for blurring the bloom effect, with each level doubling the blur
     * size. Once the blur size matches the dimensions of the render target, further blur passes are
     * skipped. Defaults to 16.
     *
     * @type {number}
     */
    blurLevel = 16;

    /**
     * The brightness below which the scene does not contribute to bloom. Zero, the default, blooms
     * the whole scene, which is the physically based behaviour; raising it restricts the glow to the
     * brightest parts, with a soft transition below the threshold. The value is in the
     * scene-referred units the scene is rendered in, before the exposure and tone mapping applied
     * when the bloom is composited, so a scene lit for an exposure far from 1 needs the threshold
     * scaled to match.
     *
     * @type {number}
     */
    threshold = 0;

    /**
     * Whether the bloom is generated from the full resolution scene instead of a half resolution
     * copy of it. This gives a sharper and more stable glow around small bright features, with a
     * slightly stronger core, at a higher performance cost. Defaults to false.
     *
     * @type {boolean}
     */
    highQuality = false;

    /**
     * The pass generating the bloom, while the effect's passes exist.
     *
     * @type {FramePassBloom|null}
     * @private
     */
    _pass = null;

    /**
     * Whether the existing pass generates the bloom from the full resolution scene.
     *
     * @type {boolean}
     * @private
     */
    _fullResolution = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'bloom', {
            slot: COMPOSESLOT_HDR,
            glsl: glslComposeBloomPS,
            wgsl: wgslComposeBloomPS,
            debugViews: ['bloom']
        });
    }

    /**
     * Gets whether the effect contributes to the frame. A zero intensity disables it, the
     * intensity being the effect's on/off control, and so does a scene format without HDR range.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && this.intensity > 0 && this.cameraFrame?.hdrFormat !== PIXELFORMAT_RGBA8;
    }

    /**
     * Gets the frame resources the effect needs: the half resolution scene, unless
     * {@link BloomEffect#highQuality} is set.
     *
     * @type {string[]}
     */
    get requires() {
        return this.highQuality ? fullResolutionRequires : halfResolutionRequires;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {

        // the full resolution scene changes from frame to frame, so it is handed to the pass in
        // frameUpdate. Unlike the half resolution copy, it is not cleared of invalid pixels.
        this._fullResolution = this.highQuality;
        this._pass = new FramePassBloom(this.device, resources.sceneColorHalf ?? null, this.cameraFrame.hdrFormat, {
            removeInvalid: this._fullResolution
        });
        passes.postTemporal.push(this._pass);
    }

    /**
     * @ignore
     */
    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
        this._fullResolution = false;
    }

    update() {
        // the blur level and threshold shape the bloom passes, which rebuild themselves to match.
        // From the full resolution scene the first level is a finer one, and one more level keeps
        // the blur the same size on screen.
        const pass = this._pass;
        pass.blurLevel = this._fullResolution ? this.blurLevel + 1 : this.blurLevel;
        pass.threshold = this.threshold;

        this.setUniform('bloomTexture', pass.bloomTexture);
        this.setUniform('bloomIntensity', this.intensity);
    }

    /**
     * @param {CameraFrameEffectContext} frame - The values of this frame.
     */
    frameUpdate(frame) {
        // the scene texture alternates between two textures with temporal anti-aliasing
        if (this._fullResolution) {
            this._pass.setSourceTexture(frame.sceneTexture);
        }
    }
}

export { BloomEffect };
