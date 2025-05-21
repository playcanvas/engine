import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslUpsamplePS from '../../scene/shader-lib/chunks-glsl/render-pass/frag/upsample.js';
import wgslUpsamplePS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/upsample.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';

/**
 * Render pass implementation of a up-sample filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassUpsample extends RenderPassShaderQuad {
    constructor(device, sourceTexture) {
        super(device);
        this.sourceTexture = sourceTexture;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('upsamplePS', glslUpsamplePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('upsamplePS', wgslUpsamplePS);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'UpSampleShader',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'upsamplePS'
        });

        this.sourceTextureId = device.scope.resolve('sourceTexture');
        this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);

        this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
        this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        super.execute();
    }
}

export { RenderPassUpsample };
