import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
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

const vertexGLSL = /* glsl */`
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;

const fragmentGLSL = /* glsl */`
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

    // takes a normalized 3-component value, convert to (11, 11, 10) bit range and
    // then package into RGBA8
    vec4 packRgb(vec3 v) {
        uvec3 vb = uvec3(clamp(v, vec3(0.0), vec3(1.0)) * vec3(2047.0, 2047.0, 1023.0));
        uint bits = (vb.x << 21) | (vb.y << 10) | vb.z;
        return vec4((uvec4(bits) >> uvec4(24, 16, 8, 0)) & uvec4(0xff)) / vec4(255.0);
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
        gl_FragColor = packRgb(evalSH(coefficients, dir) * 0.25 + 0.5);
    }
`;

const vertexWGSL = /* wgsl */`
    attribute vertex_position: vec2f;
    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = vec4f(vertex_position, 0.0, 1.0);
        return output;
    }
`;

const fragmentWGSL = /* wgsl */`
    #if SH_BANDS == 1
        const SH_COEFFS: i32 = 3;
    #elif SH_BANDS == 2
        const SH_COEFFS: i32 = 8;
    #elif SH_BANDS == 3
        const SH_COEFFS: i32 = 15;
    #endif

    const SH_C1: f32 = 0.4886025119029199f;

    #if SH_BANDS > 1
        const SH_C2_0: f32 = 1.0925484305920792f;
        const SH_C2_1: f32 = -1.0925484305920792f;
        const SH_C2_2: f32 = 0.31539156525252005f;
        const SH_C2_3: f32 = -1.0925484305920792f;
        const SH_C2_4: f32 = 0.5462742152960396f;
    #endif

    #if SH_BANDS > 2
        const SH_C3_0: f32 = -0.5900435899266435f;
        const SH_C3_1: f32 = 2.890611442640554f;
        const SH_C3_2: f32 = -0.4570457994644658f;
        const SH_C3_3: f32 = 0.3731763325901154f;
        const SH_C3_4: f32 = -0.4570457994644658f;
        const SH_C3_5: f32 = 1.445305721320277f;
        const SH_C3_6: f32 = -0.5900435899266435f;
    #endif

    // see https://github.com/graphdeco-inria/gaussian-splatting/blob/main/utils/sh_utils.py
    fn evalSH(sh: array<vec3f, SH_COEFFS>, dir: vec3f) -> vec3f {
        let x = dir.x;
        let y = dir.y;
        let z = dir.z;

        // 1st degree
        var result: vec3f = SH_C1 * (-sh[0] * y + sh[1] * z - sh[2] * x);

        #if SH_BANDS > 1
            // 2nd degree
            let xx = x * x;
            let yy = y * y;
            let zz = z * z;
            let xy = x * y;
            let yz = y * z;
            let xz = x * z;

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

    // takes a normalized 3-component value, convert to (11, 11, 10) bit range and
    // then package into RGBA8
    fn packRgb(v: vec3f) -> vec4f {
        let vb = vec3u(clamp(v, vec3f(0.0), vec3f(1.0)) * vec3f(2047.0, 2047.0, 1023.0));
        let bits = dot(vb, vec3u(1 << 21, 1 << 10, 1));
        return vec4f((vec4u(bits) >> vec4u(24, 16, 8, 0)) & vec4u(0xff)) / vec4f(255.0);
    }

    uniform dir: vec3f;
    uniform shN_mins: f32;
    uniform shN_maxs: f32;

    var centroids: texture_2d<f32>;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        var uv = vec2i(input.position.xy) * vec2i(SH_COEFFS, 1);
        var coefficients: array<vec3f, SH_COEFFS>;

        // read coefficients
        for (var i: i32 = 0; i < SH_COEFFS; i++) {
            let s: vec3f = textureLoad(centroids, vec2i(uv.x + i, uv.y), 0).xyz;
            coefficients[i] = mix(vec3f(uniform.shN_mins), vec3f(uniform.shN_maxs), s);
        }

        // evaluate
        output.color = packRgb(evalSH(coefficients, uniform.dir) * 0.25 + 0.5);

        return output;
    }
`;

const gsplatSogsColorGLSL = /* glsl */`
    uniform mediump sampler2D sh0;
    uniform highp sampler2D sh_labels;
    uniform mediump sampler2D sh_result;

    uniform vec4 sh0_mins;
    uniform vec4 sh0_maxs;

    float SH_C0 = 0.28209479177387814;

    // unpack 11, 11, 10 normalized value from rgba8 texture sample
    vec3 unpackRgb(vec4 v) {
        uvec4 uv = uvec4(v * 255.0);
        uint bits = (uv.x << 24) | (uv.y << 16) | (uv.z << 8) | uv.w;
        uvec3 vb = (uvec3(bits) >> uvec3(21, 10, 0)) & uvec3(0x7ffu, 0x7ffu, 0x3ffu);
        return vec3(vb) / vec3(2047.0, 2047.0, 1023.0);
    }

    vec4 readColor(in SplatSource source) {
        // sample base color
        vec4 baseSample = mix(sh0_mins, sh0_maxs, texelFetch(sh0, source.uv, 0));

        // resolve base color
        vec4 base = vec4(vec3(0.5) + baseSample.xyz * SH_C0, 1.0 / (1.0 + exp(-baseSample.w)));

        // extract spherical harmonics palette index
        ivec2 labelSample = ivec2(texelFetch(sh_labels, source.uv, 0).xy * 255.0);
        int n = labelSample.x + labelSample.y * 256;

        vec4 shSample = texelFetch(sh_result, ivec2(n % 64, n / 64), 0);
        vec3 sh = (unpackRgb(shSample) - vec3(0.5)) * 4.0;

        return vec4(base.xyz + sh, base.w);
    }
`;

const gsplatSogsColorWGSL = /* wgsl */`
    var sh0: texture_2d<f32>;
    var sh_labels: texture_2d<f32>;
    var sh_result: texture_2d<f32>;

    uniform sh0_mins: vec4f;
    uniform sh0_maxs: vec4f;

    const SH_C0: f32 = 0.28209479177387814;

    // unpack 11, 11, 10 normalized value from rgba8 texture sample
    fn unpackRgb(v: vec4f) -> vec3f {
        let bits = dot(vec4u(v * 255.0), vec4u(1u << 24, 1u << 16, 1u << 8, 1u));
        let vb = (vec3u(bits) >> vec3u(21, 10, 0)) & vec3u(0x7ffu, 0x7ffu, 0x3ffu);
        return vec3f(vb) / vec3f(2047.0, 2047.0, 1023.0);
    }

    fn readColor(source: ptr<function, SplatSource>) -> vec4f {
        // sample base color
        let baseSample: vec4f = mix(uniform.sh0_mins, uniform.sh0_maxs, textureLoad(sh0, source.uv, 0));
        let base = vec4f(vec3f(0.5) + baseSample.xyz * SH_C0, 1.0 / (1.0 + exp(-baseSample.w)));

        // extract spherical harmonics palette index
        let labelSample: vec2i = vec2i(textureLoad(sh_labels, source.uv, 0).xy * 255.0);
        let n = labelSample.x + labelSample.y * 256;

        let shSample: vec4f = textureLoad(sh_result, vec2i(n % 64, n / 64), 0);
        let sh: vec3f = (unpackRgb(shSample) - vec3f(0.5)) * 4.0;

        return vec4f(base.xyz + sh, base.w);
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

const invModelMat = new Mat4();
const dir = new Vec3();

class GSplatResolveSH {
    prevDir = new Vec3();

    updateMode = 'enable'; // 'enable', 'disable', 'always'

    constructor(device, gsplatInstance) {
        this.device = device;
        this.gsplatInstance = gsplatInstance;

        const { resource } = gsplatInstance;

        const includes = new Map(ShaderChunks.get(device, 'glsl'));

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'gsplatResolveSH',
            vertexGLSL,
            fragmentGLSL,
            vertexWGSL,
            fragmentWGSL,
            vertexIncludes: includes,
            fragmentIncludes: includes,
            fragmentDefines: new Map([
                ['SH_BANDS', resource.gsplatData.shBands.toString()]
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

        const { material } = gsplatInstance;
        material.setDefine('SH_BANDS', '0');

        const { shaderChunks } = material;
        shaderChunks.glsl.set('gsplatSogsColorVS', gsplatSogsColorGLSL);
        shaderChunks.wgsl.set('gsplatSogsColorVS', gsplatSogsColorWGSL);

        device.scope.resolve('sh_result').setValue(this.texture);
    }

    destroy() {
        this.renderTarget.destroy();
        this.texture.destroy();
        this.shader.destroy();
    }

    render(camera, modelMat) {
        const { prevDir, updateMode } = this;

        // disabled
        if (updateMode === 'disable') {
            return;
        }

        // calculate camera Z in model space
        invModelMat.invert(modelMat);
        invModelMat.transformVector(camera.forward, dir);

        // if direction hasn't changed early out
        dir.normalize();
        if (updateMode === 'enable' && dir.equalsApprox(prevDir, 1e-3)) {
            return;
        }
        prevDir.copy(dir);

        const execute = () => {
            const { device } = this;
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

            this.quadRender.render();
        };

        this.renderPass.executeCallback = execute;
        this.renderPass.render();
    }
}

export { GSplatResolveSH };
