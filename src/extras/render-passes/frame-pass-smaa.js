import { Color } from '../../core/math/color.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_R8, PIXELFORMAT_RG8, PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import glslQuadVS from '../../scene/shader-lib/glsl/chunks/common/vert/quad.js';
import wgslQuadVS from '../../scene/shader-lib/wgsl/chunks/common/vert/quad.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';

import { smaaGLSL } from './smaa/smaa-glsl.js';
import { getSmaaAreaData, getSmaaSearchData } from './smaa/smaa-lookup-data.js';
import { smaaEdgeWGSL, smaaNeighborhoodWGSL, smaaWeightsWGSL } from './smaa/smaa-wgsl.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Texture as TextureType } from '../../platform/graphics/texture.js'
 * @import { RenderTarget as RenderTargetType } from '../../platform/graphics/render-target.js'
 */

const clearColor = new Color(0, 0, 0, 0);

let areaData;
let searchData;

const smaaDefines = /* glsl */`
    uniform vec4 smaaMetrics;
    #define SMAA_GLSL_3
    #define SMAA_PRESET_ULTRA
    #define SMAA_RT_METRICS smaaMetrics
`;

const edgePS = /* glsl */`
    ${smaaDefines}
    ${smaaGLSL}

    uniform sampler2D smaaColorTexture;
    varying vec2 uv0;

    void main(void) {
        vec4 offset[3];
        SMAAEdgeDetectionVS(uv0, offset);
        vec2 edges = SMAALumaEdgeDetectionPS(uv0, offset, smaaColorTexture);
        gl_FragColor = vec4(edges, 0.0, 0.0);
    }
`;

const weightsPS = /* glsl */`
    ${smaaDefines}
    ${smaaGLSL}

    uniform sampler2D smaaEdgesTexture;
    uniform sampler2D smaaAreaTexture;
    uniform sampler2D smaaSearchTexture;
    varying vec2 uv0;

    void main(void) {
        vec2 pixelCoord;
        vec4 offset[3];
        SMAABlendingWeightCalculationVS(uv0, pixelCoord, offset);
        gl_FragColor = SMAABlendingWeightCalculationPS(
            uv0,
            pixelCoord,
            offset,
            smaaEdgesTexture,
            smaaAreaTexture,
            smaaSearchTexture,
            vec4(0.0)
        );
    }
`;

const neighborhoodPS = /* glsl */`
    ${smaaDefines}
    ${smaaGLSL}

    uniform sampler2D smaaColorTexture;
    uniform sampler2D smaaBlendTexture;
    varying vec2 uv0;

    vec3 smaaSrgbToLinear(vec3 color) {
        bvec3 isLinear = lessThanEqual(color, vec3(0.04045));
        vec3 low = color / 12.92;
        vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
        return mix(high, low, isLinear);
    }

    vec3 smaaLinearToSrgb(vec3 color) {
        bvec3 isLinear = lessThanEqual(color, vec3(0.0031308));
        vec3 low = color * 12.92;
        vec3 high = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
        return mix(high, low, isLinear);
    }

    vec4 smaaSampleLinear(vec2 coord) {
        vec4 color = SMAASampleLevelZero(smaaColorTexture, coord);
        color.rgb = smaaSrgbToLinear(color.rgb);
        return color;
    }

    void main(void) {
        vec4 offset;
        SMAANeighborhoodBlendingVS(uv0, offset);

        vec4 weights;
        weights.x = SMAASample(smaaBlendTexture, offset.xy).a;
        weights.y = SMAASample(smaaBlendTexture, offset.zw).g;
        weights.wz = SMAASample(smaaBlendTexture, uv0).xz;

        vec4 color;
        if (dot(weights, vec4(1.0)) < 1e-5) {
            color = SMAASampleLevelZero(smaaColorTexture, uv0);
            #ifdef SMAA_SRGB_TARGET
                color.rgb = smaaSrgbToLinear(color.rgb);
            #endif
        } else {
            bool horizontal = max(weights.x, weights.z) > max(weights.y, weights.w);
            vec4 blendingOffset = vec4(0.0, weights.y, 0.0, weights.w);
            vec2 blendingWeight = weights.yw;
            SMAAMovc(bvec4(horizontal), blendingOffset, vec4(weights.x, 0.0, weights.z, 0.0));
            SMAAMovc(bvec2(horizontal), blendingWeight, weights.xz);
            blendingWeight /= dot(blendingWeight, vec2(1.0));

            vec4 blendingCoord = mad(
                blendingOffset,
                vec4(SMAA_RT_METRICS.xy, -SMAA_RT_METRICS.xy),
                uv0.xyxy
            );
            color = blendingWeight.x * smaaSampleLinear(blendingCoord.xy);
            color += blendingWeight.y * smaaSampleLinear(blendingCoord.zw);

            #ifndef SMAA_SRGB_TARGET
                color.rgb = smaaLinearToSrgb(color.rgb);
            #endif
        }
        gl_FragColor = color;
    }
`;

class RenderPassSmaa extends RenderPassShaderQuad {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {string} name - The shader name.
     * @param {string} fragmentGLSL - The fragment shader source.
     * @param {string} fragmentWGSL - The WGSL fragment shader source.
     * @param {boolean} [srgbTarget] - Whether the output target performs sRGB encoding.
     */
    constructor(device, name, fragmentGLSL, fragmentWGSL, srgbTarget = false) {
        super(device);

        const fragmentDefines = new Map();
        if (srgbTarget) fragmentDefines.set('SMAA_SRGB_TARGET', '');

        this.shader = ShaderUtils.createShader(device, {
            uniqueName: `${name}:${srgbTarget ? 'srgb' : 'linear'}`,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexGLSL: glslQuadVS,
            vertexWGSL: wgslQuadVS,
            fragmentGLSL,
            fragmentWGSL,
            fragmentDefines
        });

        this.metricsId = device.scope.resolve('smaaMetrics');
        this.metrics = new Float32Array(4);
    }

    setMetrics(texture) {
        const metrics = this.metrics;
        metrics[0] = 1 / texture.width;
        metrics[1] = 1 / texture.height;
        metrics[2] = texture.width;
        metrics[3] = texture.height;
        this.metricsId.setValue(metrics);
    }

    destroy() {
        this.shader = null;
    }
}

class RenderPassSmaaEdge extends RenderPassSmaa {
    constructor(device, sourceTexture) {
        super(device, 'SmaaEdge', edgePS, smaaEdgeWGSL);
        this.sourceTexture = sourceTexture;
        this.sourceTextureId = device.scope.resolve('smaaColorTexture');
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);
        this.setMetrics(this.sourceTexture);
        super.execute();
    }
}

class RenderPassSmaaWeights extends RenderPassSmaa {
    constructor(device, edgesTexture, areaTexture, searchTexture) {
        super(device, 'SmaaWeights', weightsPS, smaaWeightsWGSL);
        this.edgesTexture = edgesTexture;
        this.areaTexture = areaTexture;
        this.searchTexture = searchTexture;
        this.edgesTextureId = device.scope.resolve('smaaEdgesTexture');
        this.areaTextureId = device.scope.resolve('smaaAreaTexture');
        this.searchTextureId = device.scope.resolve('smaaSearchTexture');
    }

    execute() {
        this.edgesTextureId.setValue(this.edgesTexture);
        this.areaTextureId.setValue(this.areaTexture);
        this.searchTextureId.setValue(this.searchTexture);
        this.setMetrics(this.edgesTexture);
        super.execute();
    }
}

class RenderPassSmaaNeighborhood extends RenderPassSmaa {
    constructor(device, sourceTexture, blendTexture, srgbTarget) {
        super(device, 'SmaaNeighborhood', neighborhoodPS, smaaNeighborhoodWGSL, srgbTarget);
        this.sourceTexture = sourceTexture;
        this.blendTexture = blendTexture;
        this.sourceTextureId = device.scope.resolve('smaaColorTexture');
        this.blendTextureId = device.scope.resolve('smaaBlendTexture');
    }

    execute() {
        this.sourceTextureId.setValue(this.sourceTexture);
        this.blendTextureId.setValue(this.blendTexture);
        this.setMetrics(this.sourceTexture);
        super.execute();
    }
}

/**
 * A three-pass SMAA 1x implementation.
 *
 * @category Graphics
 * @ignore
 */
class FramePassSmaa extends FramePass {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {TextureType} sourceTexture - A gamma-encoded source texture. Can be a float texture
     * holding values above 1 when the output is HDR.
     * @param {RenderTargetType|null} targetRenderTarget - The output render target.
     */
    constructor(device, sourceTexture, targetRenderTarget) {
        super(device);

        const flipY = !!targetRenderTarget?.flipY;
        this.edgesRenderTarget = this.createRenderTarget('SmaaEdges', PIXELFORMAT_RG8, flipY);
        this.weightsRenderTarget = this.createRenderTarget('SmaaWeights', PIXELFORMAT_RGBA8, flipY);

        areaData ??= getSmaaAreaData();
        searchData ??= getSmaaSearchData();
        this.areaTexture = this.createLookupTexture('SmaaArea', 160, 560, PIXELFORMAT_RG8, areaData);
        this.searchTexture = this.createLookupTexture('SmaaSearch', 64, 16, PIXELFORMAT_R8, searchData);

        const edgePass = new RenderPassSmaaEdge(device, sourceTexture);
        edgePass.init(this.edgesRenderTarget, { resizeSource: sourceTexture });
        edgePass.setClearColor(clearColor);

        const weightsPass = new RenderPassSmaaWeights(
            device,
            this.edgesRenderTarget.colorBuffer,
            this.areaTexture,
            this.searchTexture
        );
        weightsPass.init(this.weightsRenderTarget, { resizeSource: sourceTexture });
        weightsPass.setClearColor(clearColor);

        const target = targetRenderTarget ?? device.backBuffer;
        const neighborhoodPass = new RenderPassSmaaNeighborhood(
            device,
            sourceTexture,
            this.weightsRenderTarget.colorBuffer,
            target.isColorBufferSrgb(0)
        );
        neighborhoodPass.init(targetRenderTarget);

        this.beforePasses = [edgePass, weightsPass, neighborhoodPass];
    }

    createRenderTarget(name, format, flipY) {
        return new RenderTarget({
            colorBuffer: new Texture(this.device, {
                name,
                width: 4,
                height: 4,
                format,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            }),
            depth: false,
            flipY
        });
    }

    createLookupTexture(name, width, height, format, data) {
        return new Texture(this.device, {
            name,
            width,
            height,
            format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            levels: [data]
        });
    }

    destroy() {
        this.beforePasses.forEach(pass => pass.destroy());
        this.beforePasses.length = 0;

        this.edgesRenderTarget.destroyTextureBuffers();
        this.edgesRenderTarget.destroy();
        this.weightsRenderTarget.destroyTextureBuffers();
        this.weightsRenderTarget.destroy();
        this.areaTexture.destroy();
        this.searchTexture.destroy();
    }
}

export { FramePassSmaa };
