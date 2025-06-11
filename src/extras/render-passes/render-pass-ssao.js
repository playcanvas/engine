import { BlueNoise } from '../../core/math/blue-noise.js';
import { Color } from '../../core/math/color.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R8, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL,
    SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { RenderPassDepthAwareBlur } from './render-pass-depth-aware-blur.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslSsaoPS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/ssao.js';
import wgslSsaoPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/ssao.js';

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
     *
     * @type {number}
     */
    radius = 5;

    /**
     * The intensity.
     *
     * @type {number}
     */
    intensity = 1;

    /**
     * The power controlling the falloff curve.
     *
     * @type {number}
     */
    power = 1;

    /**
     * The number of samples to take.
     *
     * @type {number}
     */
    sampleCount = 10;

    /**
     * The minimum angle in degrees that creates an occlusion. Helps to reduce fake occlusions due
     * to low geometry tessellation.
     *
     * @type {number}
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
        ShaderUtils.addScreenDepthChunkDefines(device, cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'SsaoShader',
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

        this.ssaoTextureId = device.scope.resolve('ssaoTexture');
        this.ssaoTextureSizeInvId = device.scope.resolve('ssaoTextureSizeInv');
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
            colorBuffer: new Texture(this.device, {
                name: name,
                width: 1,
                height: 1,
                format: PIXELFORMAT_R8,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            })
        });
    }

    execute() {

        const { device, sourceTexture, sampleCount, minAngle, scale } = this;
        const { width, height } = this.renderTarget.colorBuffer;
        const scope = device.scope;

        scope.resolve('uAspect').setValue(width / height);
        scope.resolve('uInvResolution').setValue([1.0 / width, 1.0 / height]);

        scope.resolve('uSampleCount').setValue([sampleCount, 1.0 / sampleCount]);

        const minAngleSin = Math.sin(minAngle * Math.PI / 180.0);
        scope.resolve('uMinHorizonAngleSineSquared').setValue(minAngleSin * minAngleSin);

        const spiralTurns = 10.0;
        const step = (1.0 / (sampleCount - 0.5)) * spiralTurns * 2.0 * 3.141;
        const radius = this.radius / scale;

        const bias = 0.001;
        const peak = 0.1 * radius;
        const intensity = 2 * (peak * 2.0 * 3.141) * this.intensity / sampleCount;
        const projectionScale = 0.5 * sourceTexture.height;
        scope.resolve('uSpiralTurns').setValue(spiralTurns);
        scope.resolve('uAngleIncCosSin').setValue([Math.cos(step), Math.sin(step)]);
        scope.resolve('uMaxLevel').setValue(0.0);
        scope.resolve('uInvRadiusSquared').setValue(1.0 / (radius * radius));
        scope.resolve('uBias').setValue(bias);
        scope.resolve('uPeak2').setValue(peak * peak);
        scope.resolve('uIntensity').setValue(intensity);
        scope.resolve('uPower').setValue(this.power);
        scope.resolve('uProjectionScaleRadius').setValue(projectionScale * radius);
        scope.resolve('uRandomize').setValue(this.randomize ? this._blueNoise.value() : 0);

        super.execute();
    }

    after() {
        this.ssaoTextureId.setValue(this.ssaoTexture);

        const srcTexture = this.sourceTexture;
        this.ssaoTextureSizeInvId.setValue([1.0 / srcTexture.width, 1.0 / srcTexture.height]);
    }
}

export { RenderPassSsao };
