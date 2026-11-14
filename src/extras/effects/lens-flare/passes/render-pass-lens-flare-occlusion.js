import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import glslLensFlareOcclusionPS from '../glsl/occlusion-ps.js';
import { ShaderChunks } from '../../../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';
import wgslLensFlareOcclusionPS from '../wgsl/occlusion-ps.js';

/**
 * @import { CameraComponent } from '../../../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../../../platform/graphics/texture.js'
 */

/**
 * A render pass measuring the visibility of the lens flare sources against the scene depth, one
 * pixel per flare, blended with the previous frame's measurement. See FramePassLensFlare.
 *
 * @ignore
 */
class RenderPassLensFlareOcclusion extends RenderPassShaderQuad {
    /**
     * The visibility measured by the previous frame.
     *
     * @type {Texture|null}
     */
    previousTexture = null;

    /**
     * The per-flare occlusion data, see FramePassLensFlare.
     *
     * @type {Float32Array|null}
     */
    occlusionData = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera component.
     * @param {Texture} depthTexture - The scene depth texture, sampled through the screen depth
     * chunk.
     */
    constructor(device, cameraComponent, depthTexture) {
        super(device);
        this.cameraComponent = cameraComponent;
        this.depthTexture = depthTexture;

        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('lensFlareOcclusionPS', glslLensFlareOcclusionPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('lensFlareOcclusionPS', wgslLensFlareOcclusionPS);

        // the defines describing how the depth is stored, see the screenDepthPS chunk
        const defines = new Map();
        const depthKey = ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `LensFlareOcclusion${depthKey}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'lensFlareOcclusionPS',
            fragmentDefines: defines
        });

        const scope = device.scope;
        this.previousId = scope.resolve('lensFlarePrevVisibility');
        this.occlusionId = scope.resolve('lensFlareOcclusion[0]');
        this.paramsId = scope.resolve('lensFlareParams');
        this.paramsValue = new Float32Array(4);
        this.cameraParamsId = scope.resolve('camera_params');
        this.cameraParams = new Float32Array(4);
    }

    execute() {

        const { depthTexture, paramsValue } = this;
        paramsValue[0] = depthTexture.height / depthTexture.width;
        this.paramsId.setValue(paramsValue);
        this.previousId.setValue(this.previousTexture);
        this.occlusionId.setValue(this.occlusionData);

        const camera = this.cameraComponent.camera;
        this.cameraParamsId.setValue(camera.fillShaderParams(this.cameraParams));

        super.execute();
    }
}

export { RenderPassLensFlareOcclusion };
