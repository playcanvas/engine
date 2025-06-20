import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import {
    CULLFACE_NONE,
    PIXELFORMAT_RGBA8,
    PIXELFORMAT_R8,
    PIXELFORMAT_RGBA32U,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';

const genVS = /* glsl */`
    attribute vec2 vertex_position;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);
    }
`;

const gsplatSource = /* glsl */`
    uniform uint numSplats;                 // total number of splats
    uniform highp usampler2D splatOrder;    // per-splat index to source gaussian

    bool initSource(out SplatSource source) {
        uint w = uint(textureSize(splatOrder, 0).x);
        uint idx = uint(gl_FragCoord.x) + uint(gl_FragCoord.y) * w;
        if (idx >= numSplats) {
            discard;    // out of range
        }

        source.order = idx;
        source.id = texelFetch(splatOrder, ivec2(source.order % w, source.order / w), 0).r;
        source.uv = ivec2(source.id % w, source.id / w);

        return true;
    }
`;

const genFS = /* glsl */`
    #include "gsplatCommonVS"

    vec4 pack16n(float a, float b) {
        uint aBits = uint(max(0.0, min(1.0, a)) * 65535.0);
        uint bBits = uint(max(0.0, min(1.0, b)) * 65535.0);
        return vec4(
            float(aBits >> 8u) / 255.0,
            float(aBits & 0xffu) / 255.0,
            float(bBits >> 8u) / 255.0,
            float(bBits & 0xffu) / 255.0
        );
    }

    void writeBlack() {
        pcFragColor0 = vec4(0.0);
        pcFragColor1 = vec4(0.0);
        pcFragColor2 = vec4(0.0);
        pcFragColor3 = vec4(0.0);
    }

    void main(void) {
        // read gaussian details
        SplatSource source;
        if (!initSource(source)) {
            writeBlack();
            return;
        }

        vec3 modelCenter = readCenter(source);

        SplatCenter center;
        if (!initCenter(modelCenter, center)) {
            writeBlack();
            return;
        }

        // read color
        vec4 clr = readColor(source);

        // project center to screen space
        SplatCorner corner;
        if (!initCorner(source, center, corner)) {
            writeBlack();
            return;
        }

        #if GSPLAT_AA
            // apply AA compensation
            clr.a *= corner.aaFactor;
        #endif

        // evaluate spherical harmonics
        #if SH_BANDS > 0
            // calculate the model-space view direction
            vec3 dir = normalize(center.view * mat3(center.modelView));
            // clr.xyz += evalSH(source, dir);
        #endif

        clipCorner(corner, clr.w);

        vec3 finalP = vec3(center.proj) / center.proj.w * vec3(0.5) + vec3(0.5);
        vec3 finalCovarience = vec3(corner.v / 2048.0 + 0.5, corner.dlen / 1024.0);
        vec4 finalColor = vec4(prepareOutputFromGamma(max(clr.xyz, 0.0)), clr.w);

        pcFragColor0 = pack16n(finalP.x, finalP.y);
        pcFragColor1 = pack16n(finalP.z, finalCovarience.x);
        pcFragColor2 = pack16n(finalCovarience.y, finalCovarience.z);
        pcFragColor3 = finalColor;
    }
`;

const resolve = (scope, values) => {
    for (const key in values) {
        scope.resolve(key).setValue(values[key]);
    }
};

class GSplatWorkBuffer {
    constructor(device, gsplatInstance) {
        this.device = device;
        this.gsplatInstance = gsplatInstance;

        const { resource } = gsplatInstance;

        const includes = new Map(ShaderChunks.get(device, 'glsl'));
        includes.set('gsplatSourceVS', gsplatSource);

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'gsplatWorkGenShader',
            vertexGLSL: genVS,
            fragmentGLSL: genFS,
            vertexIncludes: includes,
            fragmentIncludes: includes,
            fragmentDefines: new Map([
                ['DITHER_NONE', true],
                ['GSPLAT_COMPRESSED_DATA', true],
                ['SH_BANDS', 3],
                ['TONEMAP', 'NONE']
            ]),
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });

        const texSize = resource.evalTextureSize(resource.numSplats);

        this.textures = [
            resource.createTexture('splatWork0', PIXELFORMAT_RGBA8, texSize),
            resource.createTexture('splatWork1', PIXELFORMAT_RGBA8, texSize),
            resource.createTexture('splatWork2', PIXELFORMAT_RGBA8, texSize),
            resource.createTexture('splatWork3', PIXELFORMAT_RGBA8, texSize)
        ];

        this.renderTarget = new RenderTarget({
            colorBuffers: this.textures,
            depth: false
        });

        this.device.scope.resolve('workTexture0').setValue(this.textures[0]);
        this.device.scope.resolve('workTexture1').setValue(this.textures[1]);
        this.device.scope.resolve('workTexture2').setValue(this.textures[2]);
        this.device.scope.resolve('workTexture3').setValue(this.textures[3]);
    }

    destroy() {
        this.renderTarget.destroy();
        this.texture.destroy();
        this.shader.destroy();
    }

    update(camera, modelMat) {
        const { device, gsplatInstance } = this;
        const splatOrder = gsplatInstance.orderTexture;
        const { packedTexture, chunkTexture, shTexture0, shTexture1, shTexture2 } = gsplatInstance.resource;

        resolve(device.scope, {
            splatOrder,
            packedTexture,
            chunkTexture,
            shTexture0,
            shTexture1,
            shTexture2,
            numSplats: gsplatInstance.material.getParameter('numSplats').data,
            viewport: gsplatInstance.material.getParameter('viewport').data,
            matrix_model: modelMat.data,
            matrix_camera: camera.camera.viewMatrix.data,
            matrix_projection: camera.camera.projectionMatrix.data
        });

        device.setBlendState(BlendState.NOBLEND);
        device.setCullMode(CULLFACE_NONE);
        device.setDepthState(DepthState.NODEPTH);

        drawQuadWithShader(this.device, this.renderTarget, this.shader);
    }
}

export { GSplatWorkBuffer };