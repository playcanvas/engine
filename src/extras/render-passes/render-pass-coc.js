import { PROJECTION_ORTHOGRAPHIC } from '../../scene/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ChunkUtils } from '../../scene/shader-lib/chunk-utils.js';

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

        const screenDepth = ChunkUtils.getScreenDepthChunk(device, cameraComponent.shaderParams);
        this.shader = this.createQuadShader(`CocShader-${nearBlur}`, /* glsl */`

            ${nearBlur ? '#define NEAR_BLUR' : ''}
            ${screenDepth}
            varying vec2 uv0;
            uniform vec3 params;

            void main()
            {
                float depth = getLinearScreenDepth(uv0);

                // near and far focus ranges
                float focusDistance = params.x;
                float focusRange = params.y;
                float invRange = params.z;
                float farRange = focusDistance + focusRange * 0.5;
                
                // near and far CoC
                float cocFar = min((depth - farRange) * invRange, 1.0);

                #ifdef NEAR_BLUR
                    float nearRange = focusDistance - focusRange * 0.5;
                    float cocNear = min((nearRange - depth) * invRange, 1.0);
                #else
                    float cocNear = 0.0;
                #endif

                gl_FragColor = vec4(cocFar, cocNear, 0.0, 0.0);
            }`
        );

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
