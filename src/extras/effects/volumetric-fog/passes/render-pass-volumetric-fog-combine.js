import {
    BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_SRC_ALPHA, BLENDMODE_ZERO, SEMANTIC_POSITION
} from '../../../../platform/graphics/constants.js';
import { BlendState } from '../../../../platform/graphics/blend-state.js';
import { RenderPassShaderQuad } from '../../../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../../../scene/shader-lib/shader-utils.js';

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
        const depthKey = ShaderUtils.addScreenDepthChunkDefines(cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `VolumetricFogCombineShader${depthKey}`,
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

export { RenderPassVolumetricFogCombine };
