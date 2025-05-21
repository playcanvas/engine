import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslCocPS from '../../scene/shader-lib/chunks-glsl/render-pass/frag/coc.js';
import wgslCocPS from '../../scene/shader-lib/chunks-wgsl/render-pass/frag/coc.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';

/**
 * Render pass implementation of a Circle of Confusion texture generation, used by Depth of Field.
 * This pass generates a CoC texture based on the scene's depth buffer, and focus range and distance
 * parameters. The CoC texture stores far and near CoC values in the red and green channels.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassCoC extends RenderPassShaderQuad {
    focusDistance;

    focusRange;

    constructor(device, cameraComponent, nearBlur) {
        super(device);
        this.cameraComponent = cameraComponent;

        // register shader chunks
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('cocPS', glslCocPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('cocPS', wgslCocPS);

        const defines = new Map();
        if (nearBlur) defines.set('NEAR_BLUR', '');

        // add defines needed for correct use of screenDepthPS chunk
        ShaderUtils.addScreenDepthChunkDefines(device, cameraComponent.shaderParams, defines);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `CocShader-${nearBlur}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'RenderPassQuadVS',
            fragmentChunk: 'cocPS',
            fragmentDefines: defines
        });

        this.paramsId = device.scope.resolve('params');
        this.paramsValue = new Float32Array(3);

        this.cameraParams = new Float32Array(4);
        this.cameraParamsId = device.scope.resolve('camera_params');
    }

    execute() {

        const { paramsValue, focusRange } = this;
        paramsValue[0] = this.focusDistance + 0.001;
        paramsValue[1] = focusRange;
        paramsValue[2] = 1 / focusRange;
        this.paramsId.setValue(paramsValue);

        const camera = this.cameraComponent.camera;
        const f = camera._farClip;
        this.cameraParams[0] = 1 / f;
        this.cameraParams[1] = f;
        this.cameraParams[2] = camera._nearClip;
        this.cameraParams[3] = camera.projection === PROJECTION_ORTHOGRAPHIC ? 1 : 0;
        this.cameraParamsId.setValue(this.cameraParams);

        super.execute();
    }
}

export { RenderPassCoC };
