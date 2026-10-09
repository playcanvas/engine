import { Debug } from '../../../core/debug.js';
import { Color } from '../../../core/math/color.js';
import { math } from '../../../core/math/math.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { CameraFrameEffect } from '../camera-frame-effect.js';
import { FRAMERESOURCE_DEPTH, FRAMERESOURCE_SCENETARGET } from '../constants.js';
import { FramePassVolumetricFog } from '../frame-pass-volumetric-fog.js';

/**
 * @import { CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources } from '../camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { LightComponent } from '../../../framework/components/light/component.js'
 */

/**
 * The volumetric fog effect, a raymarched height fog lit by a directional light. The fog samples
 * the light's cascaded shadow map along each view ray, forming visible shafts of light. The
 * raymarch runs at a reduced resolution and is blended into the scene before TAA, so when TAA is
 * enabled, its noise is temporally resolved to a smooth result. Optionally the clustered omni and
 * spot lights scatter light in the fog as well, see {@link VolumetricFogEffect#localOmniLights}
 * and {@link VolumetricFogEffect#localSpotLights}.
 *
 * The fog is rendered by passes the effect owns, from the scene depth, into the scene. It is only
 * supported on perspective cameras.
 *
 * Every {@link CameraFrame} constructs and registers one, available as
 * {@link CameraFrame#volumetricFog}.
 *
 * @category Graphics
 */
class VolumetricFogEffect extends CameraFrameEffect {
    /**
     * Whether the volumetric fog is enabled. Defaults to false.
     *
     * @type {boolean}
     */
    enabled = false;

    /**
     * The directional light providing the scattered light, or null when the fog is lit by the local
     * lights and the ambient term only. When a light of a type other than directional is assigned,
     * the effect is disabled. Defaults to null.
     *
     * @type {LightComponent|null}
     */
    light = null;

    /**
     * Whether the clustered omni lights scatter light in the fog. Each light adds a raymarch over
     * the part of the view rays inside its volume, sampling the shadow and the cookie atlas of the
     * clustered lighting, and so the cost scales with the screen space size of the light volumes.
     * As an omni light fills its whole bounding sphere, its volume is typically much larger on the
     * screen than the volume of a spot light. Requires clustered lighting, which is enabled by
     * default. Individual lights can scatter more or less light using
     * {@link LightComponent#volumetricScattering}. Defaults to false.
     *
     * @type {boolean}
     */
    localOmniLights = false;

    /**
     * Whether the clustered spot lights scatter light in the fog, forming visible beams. See
     * {@link VolumetricFogEffect#localOmniLights} for details, both types are rendered the same way
     * and share the {@link VolumetricFogEffect#localIntensity} and
     * {@link VolumetricFogEffect#localSteps} settings. Defaults to false.
     *
     * @type {boolean}
     */
    localSpotLights = false;

    /**
     * The intensity of the light scattering of the local lights. Defaults to 1.
     *
     * @type {number}
     */
    localIntensity = 1;

    /**
     * The number of raymarching steps taken inside the volume of each local light, 2-64 range.
     * Defaults to 12.
     *
     * @type {number}
     */
    localSteps = 12;

    /**
     * The albedo of the fog. Defaults to white.
     *
     * @type {Color}
     */
    tint = new Color(1, 1, 1);

    /**
     * The fog density at the base height. Defaults to 0.01.
     *
     * @type {number}
     */
    density = 0.01;

    /**
     * The world space height at which the fog density starts to fall off. Below it the density is
     * constant. Defaults to 0.
     *
     * @type {number}
     */
    heightBase = 0;

    /**
     * The exponential falloff of the fog density with height above the base height. Value of 0
     * makes the fog uniform. Defaults to 0.05.
     *
     * @type {number}
     */
    heightFalloff = 0.05;

    /**
     * A scale of how quickly the fog absorbs the light passing through it, without affecting how
     * much light it scatters. A value of 1 is physically consistent, where the fog absorbs as much
     * as it scatters, and distant fog and light shafts fade out exponentially with the density.
     * Lower values keep them visible over a longer distance while the fog itself stays as bright,
     * which is not physically correct but is often preferable. Defaults to 1.
     *
     * @type {number}
     */
    extinction = 1;

    /**
     * The anisotropy of the scattering, 0-0.95 range. Larger values scatter more light forward,
     * making the fog brighter when looking towards the light. Defaults to 0.6.
     *
     * @type {number}
     */
    anisotropy = 0.6;

    /**
     * The intensity of the light scattering. Defaults to 1.
     *
     * @type {number}
     */
    intensity = 1;

    /**
     * The color of the ambient in-scattered light, which keeps the fog in shadowed areas visible.
     * Defaults to white.
     *
     * @type {Color}
     */
    ambientColor = new Color(1, 1, 1);

    /**
     * The intensity of the ambient in-scattered light. Defaults to 0.02.
     *
     * @type {number}
     */
    ambientIntensity = 0.02;

    /**
     * The maximum world space distance the fog is raymarched to. Defaults to 300.
     *
     * @type {number}
     */
    maxDistance = 300;

    /**
     * The number of raymarching steps, 4-128 range. Higher values improve the quality at a higher
     * performance cost. Defaults to 24.
     *
     * @type {number}
     */
    steps = 24;

    /**
     * The resolution scale of the fog texture relative to the scene render target, 0.25-1 range.
     * Defaults to 0.5.
     *
     * @type {number}
     */
    scale = 0.5;

    /**
     * The passes rendering the fog, while the effect's passes exist.
     *
     * @type {FramePassVolumetricFog|null}
     * @private
     */
    _pass = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'volumetricFog', {
            requires: [FRAMERESOURCE_DEPTH, FRAMERESOURCE_SCENETARGET]
        });
    }

    /**
     * Gets whether the effect contributes to the frame: it is enabled, it has a light source -
     * the directional light or the local lights - and the camera is a perspective camera.
     *
     * @type {boolean}
     */
    get active() {
        const cameraComponent = this.cameraFrame?.cameraComponent;
        if (!this.enabled || !cameraComponent) {
            return false;
        }
        const { light } = this;
        if (light && light.type !== 'directional') {
            Debug.warnOnce('CameraFrame.volumetricFog.light needs to be a directional light, the effect is disabled.');
            return false;
        }
        let localLights = this.localOmniLights || this.localSpotLights;
        if (localLights && !cameraComponent.system.app.scene.clusteredLightingEnabled) {
            Debug.warnOnce('CameraFrame.volumetricFog local lights require clustered lighting to be enabled, the local lights are ignored.');
            localLights = false;
        }
        if (!light && !localLights) {
            return false;
        }
        if (cameraComponent.projection !== PROJECTION_PERSPECTIVE) {
            Debug.warnOnce('CameraFrame.volumetricFog is only supported on perspective cameras, the effect is disabled.');
            return false;
        }
        return true;
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {

        // the fog is blended into the scene, at a resolution relative to it
        const { sceneTarget } = resources;
        this._pass = new FramePassVolumetricFog(this.device, this.cameraFrame.cameraComponent,
            sceneTarget.colorBuffer, sceneTarget);
        passes.postScene.push(this._pass);
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
        pass.light = this.light?.light ?? null;
        pass.localOmniLights = this.localOmniLights;
        pass.localSpotLights = this.localSpotLights;
        pass.localIntensity = this.localIntensity;
        pass.localSteps = math.clamp(this.localSteps, 2, 64);
        pass.tint.copy(this.tint);
        pass.density = this.density;
        pass.heightBase = this.heightBase;
        pass.heightFalloff = this.heightFalloff;
        pass.extinction = Math.max(this.extinction, 0);
        pass.anisotropy = math.clamp(this.anisotropy, 0, 0.95);
        pass.intensity = this.intensity;
        pass.ambientColor.copy(this.ambientColor);
        pass.ambientIntensity = this.ambientIntensity;
        pass.maxDistance = this.maxDistance;
        pass.steps = math.clamp(this.steps, 4, 128);
        pass.scale = math.clamp(this.scale, 0.25, 1);

        // with TAA the noise pattern changes every frame, and TAA resolves it
        pass.temporalDither = this.cameraFrame.taa.enabled;
    }

    /**
     * @param {CameraFrameEffectContext} frame - The values of this frame.
     */
    frameUpdate(frame) {
        // the local lights are lit by the light clusters the scene pass renders with
        this._pass.localPass.scenePass = this.cameraFrame.renderPassCamera.scenePass;
    }
}

export { VolumetricFogEffect };
