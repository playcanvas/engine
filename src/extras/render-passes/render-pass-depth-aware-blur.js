import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslDepthAwareBlurPS from '../../scene/shader-lib/chunks-glsl/render-pass/frag/depthAwareBlur.js';
import wgslDepthAwareBlurPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/depthAwareBlur.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';

/**
 * Render pass implementation of a depth-aware bilateral blur filter.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassDepthAwareBlur extends RenderPassShaderQuad {
    constructor(device, sourceTexture, cameraComponent, horizontal) {
        super(device);
        this.sourceTexture = sourceTexture;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('depthAwareBlurPS', glslDepthAwareBlurPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('depthAwareBlurPS', wgslDepthAwareBlurPS);

        const defines = new Map();
        if (horizontal) defines.set('HORIZONTAL', '');

        // add defines needed for correct use of screenDepthPS chunk
        ShaderUtils.addScreenDepthChunkDefines(device, cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `DepthAware${horizontal ? 'Horizontal' : 'Vertical'}BlurShader`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'depthAwareBlurPS',
            fragmentDefines: defines
        });

        const scope = this.device.scope;
        this.sourceTextureId = scope.resolve('sourceTexture');
        this.sourceInvResolutionId = scope.resolve('sourceInvResolution');
        this.sourceInvResolutionValue = new Float32Array(2);
        this.filterSizeId = scope.resolve('filterSize');
    }

    execute() {

        this.filterSizeId.setValue(4);
        this.sourceTextureId.setValue(this.sourceTexture);

        const { width, height } = this.sourceTexture;
        this.sourceInvResolutionValue[0] = 1.0 / width;
        this.sourceInvResolutionValue[1] = 1.0 / height;
        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

        super.execute();
    }
}

export { RenderPassDepthAwareBlur };
