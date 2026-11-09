import { Color } from '../../../../core/math/color.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../../../platform/graphics/constants.js';
import { FramePass } from '../../../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../../../platform/graphics/render-target.js';
import { Texture } from '../../../../platform/graphics/texture.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';
import glslVolumetricFogPS from '../glsl/fog-ps.js';
import wgslVolumetricFogPS from '../wgsl/fog-ps.js';
import glslVolumetricFogCombinePS from '../glsl/combine-ps.js';
import wgslVolumetricFogCombinePS from '../wgsl/combine-ps.js';
import glslVolumetricFogLocalPS from '../glsl/local-ps.js';
import wgslVolumetricFogLocalPS from '../wgsl/local-ps.js';
import glslVolumetricFogLocalVS from '../glsl/local-vs.js';
import wgslVolumetricFogLocalVS from '../wgsl/local-vs.js';
import { RenderPassVolumetricFog } from './render-pass-volumetric-fog.js';
import { RenderPassVolumetricFogCombine } from './render-pass-volumetric-fog-combine.js';
import { RenderPassVolumetricFogLocal } from './render-pass-volumetric-fog-local.js';

/**
 * @import { CameraComponent } from '../../../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 * @import { Light } from '../../../../scene/light.js'
 * @import { RenderPassForward } from '../../../../scene/renderer/render-pass-forward.js'
 */

/**
 * Frame pass implementation of volumetric fog lit by a directional light. A reduced resolution
 * raymarch pass accumulates in-scattered light and transmittance along each view ray, sampling
 * the light's cascaded shadow map to form visible light shafts, and a combine pass blends the
 * result over the scene render target using a depth-aware upsample.
 *
 * Algorithm details:
 *
 * The raymarch pass renders a full-screen quad into an RGBA16F texture sized as a fraction
 * (scale) of the scene render target, storing the in-scattered light in rgb and the
 * transmittance in alpha. For each pixel, a world space view ray is reconstructed from the
 * camera's inverse view matrix and projection scale, and marched from the camera to the scene
 * surface - the distance is derived from the linear depth prepass texture and clamped to
 * maxDistance. The march uses a fixed number of steps, with the sample positions offset along
 * the ray by per-pixel interleaved gradient noise to hide banding. When TAA is enabled, the
 * noise pattern additionally cycles each frame using a golden-ratio sequence, and TAA
 * accumulates the dithered results into a smooth solution over time.
 *
 * The fog media is modeled as exponential height fog: the density is constant below heightBase
 * and decays exponentially above it, controlled by heightFalloff. At each step, the light
 * visibility is evaluated with a single tap of the directional light's cascaded shadow map -
 * the cascade is selected from the sample's view depth, and the tap uses hardware depth
 * comparison for depth-format shadow maps (PCF), a manual comparison for color-format maps
 * storing depth (PCSS), or the same Chebyshev test the lit shader applies to the moments of the
 * exponentially warped depth (VSM). The in-scattered radiance combines the light color scaled by
 * the Henyey-Greenstein phase function (evaluated once per ray, as the light direction is
 * constant) with an ambient term that keeps fog in shadowed areas visible. The scattering is accumulated
 * front-to-back weighted by the current transmittance, and the transmittance is attenuated per
 * step using Beer-Lambert extinction, with an early out once it becomes negligible.
 *
 * Optionally the clustered omni and spot lights scatter light in the fog as well, which is added
 * into the fog texture by a second raymarch pass. As the radiance of a local light varies rapidly
 * along the ray, a march shared by all the lights would need an impractical number of steps, and
 * so each light is instead rendered as a separate quad covering the screen space bounds of its
 * volume, with the ray marched only over the part of it which is inside the volume - the segment
 * is evaluated analytically by intersecting the ray with the bounding sphere of the light, further
 * clipped to the cone slab of a spot light. The light properties come from the light directly, and
 * the visibility and the cookie of the light are sampled from the clustered lighting atlases with
 * a single tap per step. The transmittance between the camera and each sample is evaluated
 * analytically from the closed form of the height fog optical depth, as the samples of this pass
 * are not contiguous, and only the in-scattered light is blended in, leaving the transmittance
 * stored in the alpha channel to the directional pass.
 *
 * The combine pass runs at full resolution and blends the fog texture over the scene render
 * target as scene * transmittance + inscatter, using alpha blending so no extra copy of the
 * scene is needed. To upsample the low resolution fog without leaking across geometry edges,
 * it takes the 4 nearest fog texels and weights them by their bilinear factors multiplied by
 * the depth similarity between the full resolution pixel and each low resolution sample. The
 * pass executes before TAA and bloom in the frame, so the fog participates in temporal
 * anti-aliasing and bright shafts contribute to the bloom.
 *
 * @category Graphics
 * @ignore
 */
class FramePassVolumetricFog extends FramePass {
    /**
     * The directional light providing the scattered light, or null for unlit (ambient only) fog.
     *
     * @type {Light|null}
     */
    light = null;

    /**
     * The fog albedo.
     *
     * @type {Color}
     */
    tint = new Color(1, 1, 1);

    /**
     * The fog density at the base height.
     */
    density = 0.01;

    /**
     * The world space height at which the density starts to falloff. Below it the density is
     * constant.
     */
    heightBase = 0;

    /**
     * The exponential falloff of the density with height.
     */
    heightFalloff = 0.05;

    /**
     * A scale of how quickly the fog absorbs the light passing through it, without affecting how
     * much light it scatters.
     */
    extinction = 1;

    /**
     * The anisotropy of the Henyey-Greenstein phase function, 0..1 range, larger values scatter
     * more light forward, making the fog brighter when looking towards the light.
     */
    anisotropy = 0.6;

    /**
     * The intensity of the light scattering.
     */
    intensity = 1;

    /**
     * The color of the ambient in-scattered light, allowing the fog in shadowed areas to remain
     * visible.
     *
     * @type {Color}
     */
    ambientColor = new Color(1, 1, 1);

    /**
     * The intensity of the ambient in-scattered light.
     */
    ambientIntensity = 0.02;

    /**
     * The maximum world space distance the fog is raymarched to.
     */
    maxDistance = 300;

    /**
     * The number of raymarching steps.
     */
    steps = 24;

    /**
     * True when the noise pattern changes each frame, to be resolved by TAA.
     */
    temporalDither = false;

    /**
     * True when the clustered omni lights scatter light in the fog as well.
     */
    localOmniLights = false;

    /**
     * True when the clustered spot lights scatter light in the fog as well.
     */
    localSpotLights = false;

    /**
     * The intensity of the light scattering of the local lights.
     */
    localIntensity = 1;

    /**
     * The number of raymarching steps used inside the volume of each local light.
     */
    localSteps = 12;

    /** @type {number} */
    _scale = 0.5;

    /** @type {number} */
    _frameIndex = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera component.
     * @param {Texture} sceneTexture - The scene color texture, used to size the fog texture.
     * @param {RenderTarget} sceneRenderTarget - The scene render target the fog is blended into.
     * @param {RenderPassForward|null} scenePass - The forward pass rendering the scene, providing
     * the light clusters used by the local lights pass.
     */
    constructor(device, cameraComponent, sceneTexture, sceneRenderTarget, scenePass = null) {
        super(device);
        this.cameraComponent = cameraComponent;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogPS', glslVolumetricFogPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogPS', wgslVolumetricFogPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogCombinePS', glslVolumetricFogCombinePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogCombinePS', wgslVolumetricFogCombinePS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogLocalPS', glslVolumetricFogLocalPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogLocalPS', wgslVolumetricFogLocalPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogLocalVS', glslVolumetricFogLocalVS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogLocalVS', wgslVolumetricFogLocalVS);

        // reduced resolution texture storing in-scattered light (rgb) and transmittance (a)
        const format = device.getRenderableHdrFormat([PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F], true, 1) ?? PIXELFORMAT_RGBA8;
        this.fogTexture = new Texture(device, {
            name: 'VolumetricFogTexture',
            width: 4,
            height: 4,
            format: format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this.fogRenderTarget = new RenderTarget({
            name: 'VolumetricFogRT',
            colorBuffer: this.fogTexture,
            depth: false
        });

        // raymarch pass
        this.fogPass = new RenderPassVolumetricFog(device, cameraComponent);
        this.fogPass.init(this.fogRenderTarget, {
            resizeSource: sceneTexture,
            scaleX: this._scale,
            scaleY: this._scale
        });
        this.fogPass.setClearColor(new Color(0, 0, 0, 1));
        this.beforePasses.push(this.fogPass);

        // local lights pass, adding the scattering of the clustered lights into the fog texture.
        // It renders to the same render target as the raymarch pass, which owns its resizing.
        this.localPass = new RenderPassVolumetricFogLocal(device, cameraComponent);
        this.localPass.scenePass = scenePass;
        this.localPass.init(this.fogRenderTarget);
        this.beforePasses.push(this.localPass);

        // combine pass, blending the fog over the scene render target
        this.combinePass = new RenderPassVolumetricFogCombine(device, cameraComponent, this.fogTexture);
        this.combinePass.init(sceneRenderTarget);
        this.beforePasses.push(this.combinePass);
    }

    destroy() {
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;
        this.fogPass = null;
        this.localPass = null;
        this.combinePass = null;

        if (this.fogRenderTarget) {
            this.fogRenderTarget.destroyTextureBuffers();
            this.fogRenderTarget.destroy();
            this.fogRenderTarget = null;
            this.fogTexture = null;
        }

        super.destroy();
    }

    /**
     * Sets the resolution scale of the fog texture, relative to the scene render target.
     *
     * @type {number}
     */
    set scale(value) {
        this._scale = value;
        this.fogPass.scaleX = value;
        this.fogPass.scaleY = value;
    }

    /**
     * Gets the resolution scale of the fog texture.
     *
     * @type {number}
     */
    get scale() {
        return this._scale;
    }

    frameUpdate() {
        super.frameUpdate();

        const { light, fogPass, localPass } = this;
        const camera = this.cameraComponent.camera;
        const scene = this.cameraComponent.system.app.scene;

        // shadow sampling variant - only used when the shadow map already exists, as for a newly
        // enabled light the shadow map is created by the shadow rendering later in the frame
        let shadows = false;
        let lightRenderData = null;
        if (light && light.castShadows && light.shadowIntensity > 0) {
            // a light with shadow bounds renders one shadow for all cameras
            lightRenderData = light.getRenderData(light.shadowBounds ? null : camera, 0);
            shadows = !!lightRenderData.shadowBuffer;
        }
        fogPass.updateShaderVariant(shadows, light?._shadowType);
        fogPass.shadowsEnabled = shadows;
        fogPass.lightRenderData = shadows ? lightRenderData : null;

        // mirror the parameters to the raymarch pass
        fogPass.light = light;
        fogPass.tint.copy(this.tint);
        fogPass.density = this.density;
        fogPass.heightBase = this.heightBase;
        fogPass.heightFalloff = this.heightFalloff;
        fogPass.extinction = this.extinction;
        fogPass.anisotropy = this.anisotropy;
        fogPass.intensity = this.intensity;
        fogPass.ambientColor.copy(this.ambientColor);
        fogPass.ambientIntensity = this.ambientIntensity;
        fogPass.maxDistance = this.maxDistance;
        fogPass.steps = Math.max(1, Math.floor(this.steps));

        // match the lit scene exposure each frame
        fogPass.exposure = scene.exposure;

        // cycle the noise pattern over frames when TAA resolves it to a smooth result
        this._frameIndex = (this._frameIndex + 1) % 16;
        fogPass.noiseOffset = this.temporalDither ? this._frameIndex * 0.618034 : 0;

        // local lights are only supported by the clustered lighting, which owns the shadow and the
        // cookie atlas the pass samples
        const { localOmniLights, localSpotLights } = this;
        localPass.enabled = (localOmniLights || localSpotLights) && scene.clusteredLightingEnabled;
        if (localPass.enabled) {

            const { shadowsEnabled, cookiesEnabled } = scene.lighting;
            localPass.updateShaderVariant(shadowsEnabled, cookiesEnabled);

            localPass.omniLights = localOmniLights;
            localPass.spotLights = localSpotLights;

            // the fog media is shared with the directional pass
            localPass.tint.copy(this.tint);
            localPass.density = this.density;
            localPass.heightBase = this.heightBase;
            localPass.heightFalloff = this.heightFalloff;
            localPass.extinction = this.extinction;
            localPass.anisotropy = this.anisotropy;
            localPass.maxDistance = this.maxDistance;

            localPass.intensity = this.localIntensity;
            localPass.steps = Math.max(1, Math.floor(this.localSteps));
            localPass.exposure = scene.exposure;
            localPass.noiseOffset = fogPass.noiseOffset;
        }
    }
}

export { FramePassVolumetricFog };
