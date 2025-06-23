import { BlendState } from '../../platform/graphics/blend-state.js';
import {
    CULLFACE_NONE,
    PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';
import { Vec2 } from '../../core/math/vec2.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { QuadRender } from '../graphics/quad-render.js';

const genVS = /* glsl */`
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;

const genFS = /* glsl */`
    #if SH_BANDS == 1
        #define SH_COEFFS 3
    #elif SH_BANDS == 2
        #define SH_COEFFS 8
    #elif SH_BANDS == 3
        #define SH_COEFFS 15
    #endif

    #define SH_C1 0.4886025119029199f

    #if SH_BANDS > 1
        #define SH_C2_0 1.0925484305920792f
        #define SH_C2_1 -1.0925484305920792f
        #define SH_C2_2 0.31539156525252005f
        #define SH_C2_3 -1.0925484305920792f
        #define SH_C2_4 0.5462742152960396f
    #endif

    #if SH_BANDS > 2
        #define SH_C3_0 -0.5900435899266435f
        #define SH_C3_1 2.890611442640554f
        #define SH_C3_2 -0.4570457994644658f
        #define SH_C3_3 0.3731763325901154f
        #define SH_C3_4 -0.4570457994644658f
        #define SH_C3_5 1.445305721320277f
        #define SH_C3_6 -0.5900435899266435f
    #endif

    // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    vec3 evalSH(in vec3 sh[SH_COEFFS], in vec3 dir) {
        float x = dir.x;
        float y = dir.y;
        float z = dir.z;

        // 1st degree
        vec3 result = SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

        #if SH_BANDS > 1
            // 2nd degree
            float xx = x * x;
            float yy = y * y;
            float zz = z * z;
            float xy = x * y;
            float yz = y * z;
            float xz = x * z;

            result +=
                sh[3] * (SH_C2_0 * xy) +
                sh[4] * (SH_C2_1 * yz) +
                sh[5] * (SH_C2_2 * (2.0 * zz - xx - yy)) +
                sh[6] * (SH_C2_3 * xz) +
                sh[7] * (SH_C2_4 * (xx - yy));
        #endif

        #if SH_BANDS > 2
            // 3rd degree
            result +=
                sh[8]  * (SH_C3_0 * y * (3.0 * xx - yy)) +
                sh[9]  * (SH_C3_1 * xy * z) +
                sh[10] * (SH_C3_2 * y * (4.0 * zz - xx - yy)) +
                sh[11] * (SH_C3_3 * z * (2.0 * zz - 3.0 * xx - 3.0 * yy)) +
                sh[12] * (SH_C3_4 * x * (4.0 * zz - xx - yy)) +
                sh[13] * (SH_C3_5 * z * (xx - yy)) +
                sh[14] * (SH_C3_6 * x * (xx - 3.0 * yy));
        #endif

        return result;
    }

    uniform mediump vec3 dir;
    uniform mediump sampler2D centroids;
    uniform mediump float shN_mins;
    uniform mediump float shN_maxs;

    void main(void) {
        ivec2 uv = ivec2(gl_FragCoord.xy) * ivec2(SH_COEFFS, 1);
        mediump vec3 coefficients[SH_COEFFS];

        // read coefficients
        for (int i = 0; i < SH_COEFFS; i++) {
            vec3 s = texelFetch(centroids, ivec2(uv.x + i, uv.y), 0).xyz;
            coefficients[i] = mix(vec3(shN_mins), vec3(shN_maxs), s);
        }

        // evaluate
        gl_FragColor = vec4(evalSH(coefficients, dir) * 0.25 + 0.5, 1.0);
    }
`;

const resolve = (scope, values) => {
    for (const key in values) {
        scope.resolve(key).setValue(values[key]);
    }
};

class CustomRenderPass extends RenderPass {
    /**
     * @type {() => void | null}
     */
    executeCallback = null;

    execute() {
        this.executeCallback?.();
    }
}

class GSplatResolveSH {
    constructor(device, gsplatInstance) {
        this.device = device;
        this.gsplatInstance = gsplatInstance;

        const { resource } = gsplatInstance;

        const includes = new Map(ShaderChunks.get(device, 'glsl'));

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'gsplatResolveSH',
            vertexGLSL: genVS,
            fragmentGLSL: genFS,
            vertexIncludes: includes,
            fragmentIncludes: includes,
            fragmentDefines: new Map([
                ['SH_BANDS', resource.gsplatData.shBands.toString()],
            ]),
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        this.texture = resource.createTexture('centroids', PIXELFORMAT_RGBA8, new Vec2(64, 1024));
        this.renderTarget = new RenderTarget({
            colorBuffer: this.texture,
            depth: false
        });

        this.renderPass = new CustomRenderPass(device);
        this.renderPass.init(this.renderTarget, {});
        this.renderPass.colorOps.clear = true;
        this.quadRender = new QuadRender(this.shader);

        device.scope.resolve('sh_result').setValue(this.texture);
    }

    destroy() {
        this.renderTarget.destroy();
        this.texture.destroy();
        this.shader.destroy();
    }

    update(camera, modelMat) {

        this.renderPass.executeCallback = () => {
            const { device } = this;

            // camera direction in model space
            const m = modelMat.clone().invert();
            const dir = m.transformVector(camera.forward);

            const { sh_centroids, meta } = this.gsplatInstance.resource.gsplatData;

            resolve(device.scope, {
                dir: dir.toArray(),
                centroids: sh_centroids,
                shN_mins: meta.shN.mins,
                shN_maxs: meta.shN.maxs
            });

            device.setCullMode(CULLFACE_NONE);
            device.setDepthState(DepthState.NODEPTH);
            device.setStencilState(null, null);
            device.setBlendState(BlendState.NOBLEND);

            this.quadRender.render()
        };

        this.renderPass.render();
    }
}

export { GSplatResolveSH };