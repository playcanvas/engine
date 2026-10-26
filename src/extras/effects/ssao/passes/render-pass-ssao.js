import { BlueNoise } from '../../../../core/math/blue-noise.js';
import { Color } from '../../../../core/math/color.js';
import { math } from '../../../../core/math/math.js';
import {
    PIXELFORMAT_R8, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL
} from '../../../../platform/graphics/constants.js';
import { RenderTarget } from '../../../../platform/graphics/render-target.js';
import { Texture } from '../../../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { RenderPassDepthAwareBlur } from './render-pass-depth-aware-blur.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';
import glslSsaoPS from '../glsl/ssao-ps.js';
import wgslSsaoPS from '../wgsl/ssao-ps.js';

/**
 * Render pass implementation of Screen-Space Ambient Occlusion (SSAO) based on the non-linear depth
 * buffer.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassSsao extends RenderPassShaderQuad {
    /**
     * The filter radius.
     */
    radius = 5;

    /**
     * The intensity.
     */
    intensity = 1;

    /**
     * The power controlling the falloff curve.
     */
    power = 1;

    /**
     * The number of samples to take.
     */
    sampleCount = 10;

    /**
     * The minimum angle in degrees that creates an occlusion. Helps to reduce fake occlusions due
     * to low geometry tessellation.
     */
    minAngle = 5;

    /**
     * Enable randomization of the sample pattern. Useful when TAA is used to remove the noise,
     * instead of blurring.
     */
    randomize = false;

    /**
     * The texture containing the occlusion information in the red channel.
     *
     * @type {Texture}
     * @readonly
     */
    ssaoTexture;

    /** @type {number} */
    _scale = 1;

    _blueNoise = new BlueNoise(19);

    // the values of the vector uniforms, reused every frame
    _invResolution = new Float32Array(2);

    _sampleCount = new Float32Array(2);

    _angleIncCosSin = new Float32Array(2);

    _ssaoTextureSizeInv = new Float32Array(2);

    constructor(device, sourceTexture, cameraComponent, blurEnabled) {
        super(device);
        this.sourceTexture = sourceTexture;
        this.cameraComponent = cameraComponent;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('ssaoPS', glslSsaoPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('ssaoPS', wgslSsaoPS);

        // main SSAO render pass

        const defines = new Map();

        // add defines needed for correct use of screenDepthPS chunk
        const depthKey = ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `SsaoShader${depthKey}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'ssaoPS',
            fragmentDefines: defines
        });

        const rt = this.createRenderTarget('SsaoFinalTexture');
        this.ssaoTexture = rt.colorBuffer;

        this.init(rt, {
            resizeSource: this.sourceTexture
        });

        // clear the color to avoid load op
        const clearColor = new Color(0, 0, 0, 0);
        this.setClearColor(clearColor);

        // optional blur passes
        if (blurEnabled) {

            const blurRT = this.createRenderTarget('SsaoTempTexture');

            const blurPassHorizontal = new RenderPassDepthAwareBlur(device, rt.colorBuffer, cameraComponent, true);
            blurPassHorizontal.init(blurRT, {
                resizeSource: rt.colorBuffer
            });
            blurPassHorizontal.setClearColor(clearColor);

            const blurPassVertical = new RenderPassDepthAwareBlur(device, blurRT.colorBuffer, cameraComponent, false);
            blurPassVertical.init(rt, {
                resizeSource: rt.colorBuffer
            });
            blurPassVertical.setClearColor(clearColor);

            this.afterPasses.push(blurPassHorizontal);
            this.afterPasses.push(blurPassVertical);
        }

        // the uniforms, resolved once
        const scope = device.scope;
        this.ssaoTextureId = scope.resolve('ssaoTexture');
        this.ssaoTextureSizeInvId = scope.resolve('ssaoTextureSizeInv');
        this.aspectId = scope.resolve('uAspect');
        this.invResolutionId = scope.resolve('uInvResolution');
        this.sampleCountId = scope.resolve('uSampleCount');
        this.minHorizonAngleSineSquaredId = scope.resolve('uMinHorizonAngleSineSquared');
        this.spiralTurnsId = scope.resolve('uSpiralTurns');
        this.angleIncCosSinId = scope.resolve('uAngleIncCosSin');
        this.maxLevelId = scope.resolve('uMaxLevel');
        this.invRadiusSquaredId = scope.resolve('uInvRadiusSquared');
        this.biasId = scope.resolve('uBias');
        this.peak2Id = scope.resolve('uPeak2');
        this.intensityId = scope.resolve('uIntensity');
        this.powerId = scope.resolve('uPower');
        this.projectionScaleRadiusId = scope.resolve('uProjectionScaleRadius');
        this.randomizeId = scope.resolve('uRandomize');
    }

    destroy() {

        this.renderTarget?.destroyTextureBuffers();
        this.renderTarget?.destroy();
        this.renderTarget = null;

        if (this.afterPasses.length > 0) {
            const blurRt = this.afterPasses[0].renderTarget;
            blurRt?.destroyTextureBuffers();
            blurRt?.destroy();
        }

        this.afterPasses.forEach(pass => pass.destroy());
        this.afterPasses.length = 0;

        super.destroy();
    }

    /**
     * The scale multiplier for the render target size.
     *
     * @type {number}
     */
    set scale(value) {
        this._scale = value;
        this.scaleX = value;
        this.scaleY = value;
    }

    get scale() {
        return this._scale;
    }

    createRenderTarget(name) {
        return new RenderTarget({
            depth: false,
            colorBuffer: Texture.createDataTexture2D(this.device, name, 1, 1, PIXELFORMAT_R8)
        });
    }

    execute() {

        const { sampleCount, minAngle } = this;
        const { width, height } = this.renderTarget.colorBuffer;

        this.aspectId.setValue(width / height);

        const invResolution = this._invResolution;
        invResolution[0] = 1.0 / width;
        invResolution[1] = 1.0 / height;
        this.invResolutionId.setValue(invResolution);

        const sampleCountValue = this._sampleCount;
        sampleCountValue[0] = sampleCount;
        sampleCountValue[1] = 1.0 / sampleCount;
        this.sampleCountId.setValue(sampleCountValue);

        const minAngleSin = Math.sin(minAngle * math.DEG_TO_RAD);
        this.minHorizonAngleSineSquaredId.setValue(minAngleSin * minAngleSin);

        const spiralTurns = 10.0;
        const step = (1.0 / (sampleCount - 0.5)) * spiralTurns * 2.0 * 3.141;

        // world-space radius is independent of the render target scale, keeping the AO look
        // consistent when rendering at lower resolution
        const radius = this.radius;

        const bias = 0.001;
        const peak = 0.1 * radius;
        const intensity = 2 * (peak * 2.0 * 3.141) * this.intensity / sampleCount;

        // scale the projection based on the actual (possibly scaled) render target height, so the
        // sampling disk covers the same screen area regardless of the scale
        const projectionScale = 0.5 * height;
        this.spiralTurnsId.setValue(spiralTurns);

        const angleIncCosSin = this._angleIncCosSin;
        angleIncCosSin[0] = Math.cos(step);
        angleIncCosSin[1] = Math.sin(step);
        this.angleIncCosSinId.setValue(angleIncCosSin);

        this.maxLevelId.setValue(0.0);
        this.invRadiusSquaredId.setValue(1.0 / (radius * radius));
        this.biasId.setValue(bias);
        this.peak2Id.setValue(peak * peak);
        this.intensityId.setValue(intensity);
        this.powerId.setValue(this.power);
        this.projectionScaleRadiusId.setValue(projectionScale * radius);
        this.randomizeId.setValue(this.randomize ? this._blueNoise.value() : 0);

        super.execute();
    }

    after() {
        this.ssaoTextureId.setValue(this.ssaoTexture);

        const srcTexture = this.sourceTexture;
        const sizeInv = this._ssaoTextureSizeInv;
        sizeInv[0] = 1.0 / srcTexture.width;
        sizeInv[1] = 1.0 / srcTexture.height;
        this.ssaoTextureSizeInvId.setValue(sizeInv);
    }
}

export { RenderPassSsao };
