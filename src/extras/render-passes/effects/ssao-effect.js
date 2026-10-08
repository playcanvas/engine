import glslComposeSsaoPS from '../../../scene/shader-lib/glsl/chunks/render-pass/frag/compose/compose-ssao.js';
import wgslComposeSsaoPS from '../../../scene/shader-lib/wgsl/chunks/render-pass/frag/compose/compose-ssao.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import {
    COMPOSESLOT_HDR, FRAMERESOURCE_DEPTH, FRAMERESOURCE_PREPASSDEPTH, SSAOTYPE_LIGHTING, SSAOTYPE_NONE
} from '../constants.js';
import { RenderPassSsao } from '../render-pass-ssao.js';

/**
 * @import { CameraFrameEffectPasses, CameraFrameEffectResources } from '../camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

// the frame resources the occlusion needs: the scene depth, which in the lighting mode has to exist
// before the scene renders, and so is rendered by a prepass
const combineRequires = [FRAMERESOURCE_DEPTH];
const lightingRequires = [FRAMERESOURCE_PREPASSDEPTH];

/**
 * The Screen Space Ambient Occlusion (SSAO) effect, a postprocessing technique that approximates
 * ambient occlusion by calculating how exposed each point in the screen space is to ambient light,
 * enhancing depth perception and adding subtle shadowing in crevices and between objects.
 *
 * The occlusion is generated from the scene depth by a pass the effect owns. With
 * {@link SSAOTYPE_LIGHTING} it is applied by the lit materials as the scene renders, and with
 * {@link SSAOTYPE_COMBINE} it is applied to the rendered scene in linear HDR space, before tone
 * mapping.
 *
 * Every {@link CameraFrame} constructs and registers one, available as {@link CameraFrame#ssao}.
 *
 * @category Graphics
 */
class SsaoEffect extends CameraFrameEffect {
    /**
     * The type of the SSAO, which determines how it is applied in the rendering process. Defaults
     * to {@link SSAOTYPE_NONE}, making it disabled. Can be:
     *
     * - {@link SSAOTYPE_NONE}
     * - {@link SSAOTYPE_LIGHTING}
     * - {@link SSAOTYPE_COMBINE}
     *
     * @type {string}
     */
    type = SSAOTYPE_NONE;

    /**
     * Whether the SSAO effect is blurred. Defaults to true.
     *
     * @type {boolean}
     */
    blurEnabled = true;

    /**
     * Whether the SSAO sampling is randomized. Useful when used instead of blur effect together
     * with TAA. Defaults to false.
     *
     * @type {boolean}
     */
    randomize = false;

    /**
     * The intensity of the SSAO effect, 0-1 range. Defaults to 0.5.
     *
     * @type {number}
     */
    intensity = 0.5;

    /**
     * The radius of the SSAO effect, 0-100 range. Defaults to 30.
     *
     * @type {number}
     */
    radius = 30;

    /**
     * The number of samples of the SSAO effect, 1-64 range. Defaults to 12.
     *
     * @type {number}
     */
    samples = 12;

    /**
     * The power of the SSAO effect, 0.1-10 range. Defaults to 6.
     *
     * @type {number}
     */
    power = 6;

    /**
     * The minimum angle of the SSAO effect, 1-90 range. Defaults to 10.
     *
     * @type {number}
     */
    minAngle = 10;

    /**
     * The scale of the SSAO effect, 0.5-1 range. Defaults to 1.
     *
     * @type {number}
     */
    scale = 1;

    /**
     * The pass generating the occlusion, while the effect's passes exist.
     *
     * @type {RenderPassSsao|null}
     * @private
     */
    _pass = null;

    /**
     * Whether the existing pass generates the occlusion for the lit materials to apply.
     *
     * @type {boolean}
     * @private
     */
    _lighting = false;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'ssao', {
            slot: COMPOSESLOT_HDR,
            glsl: glslComposeSsaoPS,
            wgsl: wgslComposeSsaoPS,
            debugViews: ['ssao']
        });
    }

    /**
     * Gets whether the effect contributes to the frame. {@link SSAOTYPE_NONE} disables it, the
     * type being the effect's on/off control.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && this.type !== SSAOTYPE_NONE;
    }

    /**
     * Gets the frame resources the effect needs: the scene depth, rendered by a prepass when the
     * type is {@link SSAOTYPE_LIGHTING}, as the occlusion is then generated before the scene
     * renders.
     *
     * @type {string[]}
     */
    get requires() {
        return this.type === SSAOTYPE_LIGHTING ? lightingRequires : combineRequires;
    }

    /**
     * @returns {string} The key.
     * @ignore
     */
    buildKey() {
        // the blur is a pair of passes following the occlusion
        return this.blurEnabled ? 'blur' : '';
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {

        // applied by the lit materials, the occlusion is generated before the scene renders, from
        // the depth of the prepass - otherwise after it, from the depth the scene rendered
        const lighting = this.type === SSAOTYPE_LIGHTING;
        this._lighting = lighting;

        const { cameraComponent } = this.cameraFrame;
        const depth = lighting ? resources.prepassDepth : resources.depth;
        this._pass = new RenderPassSsao(this.device, depth.texture, cameraComponent, this.blurEnabled);

        if (lighting) {
            // the lit shaders sample the occlusion texture as the scene renders
            cameraComponent.shaderParams.ssaoEnabled = true;
            passes.preScene.push(this._pass);
        } else {
            passes.postScene.push(this._pass);
        }
    }

    /**
     * @ignore
     */
    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
        this._lighting = false;
    }

    update() {
        const pass = this._pass;
        pass.intensity = this.intensity;
        pass.power = this.power;
        pass.radius = this.radius;
        pass.sampleCount = this.samples;
        pass.minAngle = this.minAngle;
        pass.scale = this.scale;
        pass.randomize = this.randomize;

        // the composition applies the occlusion in the combine mode only, and displays it in the
        // debug view in both
        this.setUniform('ssaoTexture', pass.ssaoTexture);
        this.setDefine('SSAO_LIGHTING', this._lighting);
    }
}

export { SsaoEffect };
