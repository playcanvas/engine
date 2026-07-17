import { Color } from '../../core/math/color.js';
import { Vec3 } from '../../core/math/vec3.js';
import {
    ADDRESS_CLAMP_TO_EDGE, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC_ALPHA, BLENDMODE_ZERO,
    FILTER_LINEAR, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { shadowTypeInfo } from '../../scene/constants.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslVolumetricFogPS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/volumetricFog.js';
import wgslVolumetricFogPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/volumetricFog.js';
import glslVolumetricFogCombinePS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/volumetricFogCombine.js';
import wgslVolumetricFogCombinePS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/volumetricFogCombine.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Light, LightRenderData } from '../../scene/light.js'
 */

const _tempDir = new Vec3();

/**
 * Render pass implementing the volumetric fog raymarch. Renders in-scattered light (rgb) and
 * transmittance (a) into a reduced resolution texture, sampling the directional light's cascaded
 * shadow map along the ray.
 *
 * @ignore
 */
class RenderPassVolumetricFog extends RenderPassShaderQuad {
    /** @type {Light|null} */
    light = null;

    shadowsEnabled = false;

    /**
     * The shadow data of the light for the fog camera, when the shadow map is available.
     *
     * @type {LightRenderData|null}
     */
    lightRenderData = null;

    tint = new Color(1, 1, 1);

    density = 0.01;

    heightBase = 0;

    heightFalloff = 0.05;

    anisotropy = 0.6;

    intensity = 1;

    ambientColor = new Color(1, 1, 1);

    ambientIntensity = 0.02;

    maxDistance = 300;

    steps = 24;

    noiseOffset = 0;

    exposure = 1;

    /** @type {string|null} */
    _variantKey = null;

    constructor(device, cameraComponent) {
        super(device);
        this.cameraComponent = cameraComponent;

        const scope = device.scope;
        this.cameraPosId = scope.resolve('uFogCameraPos');
        this.cameraFwdId = scope.resolve('uFogCameraFwd');
        this.invViewId = scope.resolve('uFogInvView');
        this.projScaleId = scope.resolve('uFogProjScale');
        this.tintId = scope.resolve('uFogTint');
        this.lightColorId = scope.resolve('uFogLightColor');
        this.lightDirId = scope.resolve('uFogLightDir');
        this.ambientId = scope.resolve('uFogAmbient');
        this.fogParamsId = scope.resolve('uFogParams');
        this.scatterParamsId = scope.resolve('uFogScatterParams');
        this.shadowMapId = scope.resolve('uFogShadowMap');
        this.shadowMatrixPaletteId = scope.resolve('uFogShadowMatrixPalette[0]');
        this.shadowCascadeDistancesId = scope.resolve('uFogShadowCascadeDistances');
        this.shadowParamsId = scope.resolve('uFogShadowParams');

        this._cameraPos = new Float32Array(3);
        this._cameraFwd = new Float32Array(3);
        this._projScale = new Float32Array(2);
        this._tint = new Float32Array(3);
        this._lightColor = new Float32Array(3);
        this._lightDir = new Float32Array(3);
        this._ambient = new Float32Array(3);
        this._fogParams = new Float32Array(4);
        this._scatterParams = new Float32Array(4);
        this._shadowParams = new Float32Array(4);
    }

    /**
     * Creates the shader matching the shadow sampling requirements, when those change.
     *
     * @param {boolean} shadows - True if the shadow map should be sampled.
     * @param {boolean} pcf - True if the shadow map is a depth format texture using hardware
     * comparison, false when it stores depth in a color texture (PCSS / VSM).
     */
    updateShaderVariant(shadows, pcf) {

        const depthMapLinear = this.cameraComponent.shaderParams.sceneDepthMapLinear;
        const key = `${shadows}-${pcf}-${depthMapLinear}`;
        if (this._variantKey !== key) {
            this._variantKey = key;

            const defines = new Map();
            ShaderUtils.addScreenDepthChunkDefines(this.cameraComponent.shaderParams, defines);
            if (shadows) defines.set('FOG_SHADOWS', '');
            if (pcf) defines.set('FOG_SHADOW_PCF', '');

            this.shader = ShaderUtils.createShader(this.device, {
                uniqueName: `VolumetricFogShader-${key}`,
                attributes: { aPosition: SEMANTIC_POSITION },
                vertexChunk: 'quadVS',
                fragmentChunk: 'volumetricFogPS',
                fragmentDefines: defines
            });
        }
    }

    execute() {

        const { light } = this;
        const camera = this.cameraComponent.camera;
        const node = camera._node;

        // camera ray reconstruction
        this.invViewId.setValue(node.getWorldTransform().data);

        const pos = node.getPosition();
        this._cameraPos[0] = pos.x;
        this._cameraPos[1] = pos.y;
        this._cameraPos[2] = pos.z;
        this.cameraPosId.setValue(this._cameraPos);

        const fwd = node.forward;
        this._cameraFwd[0] = fwd.x;
        this._cameraFwd[1] = fwd.y;
        this._cameraFwd[2] = fwd.z;
        this.cameraFwdId.setValue(this._cameraFwd);

        const projData = camera.projectionMatrix.data;
        this._projScale[0] = 1 / projData[0];
        this._projScale[1] = 1 / projData[5];
        this.projScaleId.setValue(this._projScale);

        // light, scaled by the scene exposure to match the lit scene
        const lightScale = this.intensity * this.exposure;
        if (light) {
            // direction towards the light - directional lights shine down their negative Y axis
            light._node.getWorldTransform().getY(_tempDir).normalize();
            this._lightDir[0] = _tempDir.x;
            this._lightDir[1] = _tempDir.y;
            this._lightDir[2] = _tempDir.z;

            const color = light._colorLinear;
            this._lightColor[0] = color[0] * lightScale;
            this._lightColor[1] = color[1] * lightScale;
            this._lightColor[2] = color[2] * lightScale;
        } else {
            this._lightDir[0] = 0;
            this._lightDir[1] = 1;
            this._lightDir[2] = 0;
            this._lightColor[0] = 0;
            this._lightColor[1] = 0;
            this._lightColor[2] = 0;
        }
        this.lightDirId.setValue(this._lightDir);
        this.lightColorId.setValue(this._lightColor);

        if (this.shadowsEnabled && light && this.lightRenderData) {
            const lightRenderData = this.lightRenderData;
            const biases = light._getUniformBiasValues(lightRenderData);

            this.shadowMapId.setValue(lightRenderData.shadowBuffer);
            this.shadowMatrixPaletteId.setValue(light._shadowMatrixPalette);
            this.shadowCascadeDistancesId.setValue(light._shadowCascadeDistances);

            this._shadowParams[0] = light.numCascades;
            this._shadowParams[1] = biases.bias;
            this._shadowParams[2] = 0;
            this._shadowParams[3] = light.shadowDistance;
            this.shadowParamsId.setValue(this._shadowParams);
        }

        // fog parameters
        const { tint, ambientColor, ambientIntensity } = this;
        this._tint[0] = tint.r;
        this._tint[1] = tint.g;
        this._tint[2] = tint.b;
        this.tintId.setValue(this._tint);

        const ambientScale = ambientIntensity * this.exposure;
        this._ambient[0] = ambientColor.r * ambientScale;
        this._ambient[1] = ambientColor.g * ambientScale;
        this._ambient[2] = ambientColor.b * ambientScale;
        this.ambientId.setValue(this._ambient);

        this._fogParams[0] = this.density;
        this._fogParams[1] = this.heightBase;
        this._fogParams[2] = this.heightFalloff;
        this._fogParams[3] = this.maxDistance;
        this.fogParamsId.setValue(this._fogParams);

        this._scatterParams[0] = this.anisotropy;
        this._scatterParams[1] = this.steps;
        this._scatterParams[2] = this.noiseOffset;
        this._scatterParams[3] = light ? light.shadowIntensity : 1;
        this.scatterParamsId.setValue(this._scatterParams);

        super.execute();
    }
}

/**
 * Render pass which composites the volumetric fog texture over the scene render target, using a
 * depth-aware upsample, blending as scene * transmittance + inscatter.
 *
 * @ignore
 */
class RenderPassVolumetricFogCombine extends RenderPassShaderQuad {
    constructor(device, cameraComponent, fogTexture) {
        super(device);
        this.fogTexture = fogTexture;

        const defines = new Map();
        ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `VolumetricFogCombineShader-${cameraComponent.shaderParams.sceneDepthMapLinear}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'volumetricFogCombinePS',
            fragmentDefines: defines
        });

        // scene.rgb * fog.a + fog.rgb, scene alpha is preserved
        this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ZERO, BLENDMODE_ONE);

        this.fogTextureId = device.scope.resolve('uFogTexture');
        this.fogTextureSizeId = device.scope.resolve('uFogTextureSize');
        this._fogTextureSize = new Float32Array(4);
    }

    execute() {

        const { fogTexture } = this;
        this.fogTextureId.setValue(fogTexture);

        this._fogTextureSize[0] = fogTexture.width;
        this._fogTextureSize[1] = fogTexture.height;
        this._fogTextureSize[2] = 1 / fogTexture.width;
        this._fogTextureSize[3] = 1 / fogTexture.height;
        this.fogTextureSizeId.setValue(this._fogTextureSize);

        super.execute();
    }
}

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
 * comparison for depth-format shadow maps (PCF) or a manual comparison for color-format maps
 * storing depth (PCSS / VSM). The in-scattered radiance combines the light color scaled by the
 * Henyey-Greenstein phase function (evaluated once per ray, as the light direction is constant)
 * with an ambient term that keeps fog in shadowed areas visible. The scattering is accumulated
 * front-to-back weighted by the current transmittance, and the transmittance is attenuated per
 * step using Beer-Lambert extinction, with an early out once it becomes negligible.
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

    /** @type {number} */
    _scale = 0.5;

    /** @type {number} */
    _frameIndex = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera component.
     * @param {Texture} sceneTexture - The scene color texture, used to size the fog texture.
     * @param {RenderTarget} sceneRenderTarget - The scene render target the fog is blended into.
     */
    constructor(device, cameraComponent, sceneTexture, sceneRenderTarget) {
        super(device);
        this.cameraComponent = cameraComponent;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogPS', glslVolumetricFogPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogPS', wgslVolumetricFogPS);
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('volumetricFogCombinePS', glslVolumetricFogCombinePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('volumetricFogCombinePS', wgslVolumetricFogCombinePS);

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

        // combine pass, blending the fog over the scene render target
        this.combinePass = new RenderPassVolumetricFogCombine(device, cameraComponent, this.fogTexture);
        this.combinePass.init(sceneRenderTarget);
        this.beforePasses.push(this.combinePass);
    }

    destroy() {
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;
        this.fogPass = null;
        this.combinePass = null;

        if (this.fogRenderTarget) {
            this.fogRenderTarget.destroyTextureBuffers();
            this.fogRenderTarget.destroy();
            this.fogRenderTarget = null;
            this.fogTexture = null;
        }
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

        const { light, fogPass } = this;
        const camera = this.cameraComponent.camera;

        // shadow sampling variant - only used when the shadow map already exists, as for a newly
        // enabled light the shadow map is created by the shadow rendering later in the frame
        let shadows = false;
        let pcf = false;
        let lightRenderData = null;
        if (light && light.castShadows && light.shadowIntensity > 0) {
            lightRenderData = light.getRenderData(camera, 0);
            if (lightRenderData.shadowBuffer) {
                shadows = true;
                pcf = !!shadowTypeInfo.get(light._shadowType)?.pcf;
            }
        }
        fogPass.updateShaderVariant(shadows, pcf);
        fogPass.shadowsEnabled = shadows;
        fogPass.lightRenderData = shadows ? lightRenderData : null;

        // mirror the parameters to the raymarch pass
        fogPass.light = light;
        fogPass.tint.copy(this.tint);
        fogPass.density = this.density;
        fogPass.heightBase = this.heightBase;
        fogPass.heightFalloff = this.heightFalloff;
        fogPass.anisotropy = this.anisotropy;
        fogPass.intensity = this.intensity;
        fogPass.ambientColor.copy(this.ambientColor);
        fogPass.ambientIntensity = this.ambientIntensity;
        fogPass.maxDistance = this.maxDistance;
        fogPass.steps = Math.max(1, Math.floor(this.steps));

        // match the lit scene exposure each frame
        fogPass.exposure = this.cameraComponent.system.app.scene.exposure;

        // cycle the noise pattern over frames when TAA resolves it to a smooth result
        this._frameIndex = (this._frameIndex + 1) % 16;
        fogPass.noiseOffset = this.temporalDither ? this._frameIndex * 0.618034 : 0;
    }
}

export { FramePassVolumetricFog };
