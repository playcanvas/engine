import { Vec4 } from '../math/vec4.js';

import {
    TEXTURETYPE_RGBM, TEXTURETYPE_RGBE,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F
} from './graphics.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';

// get a coding string for texture based on its type and pixel format.
var getCoding = function (texture) {
    switch (texture.type) {
        case TEXTURETYPE_RGBM:
            return "RGBM";
        case TEXTURETYPE_RGBE:
            return "RGBE";
        default:
            switch (texture.format) {
                case PIXELFORMAT_RGB16F:
                case PIXELFORMAT_RGB32F:
                case PIXELFORMAT_RGBA16F:
                case PIXELFORMAT_RGBA32F:
                    return "Linear";
                default:
                    return "Gamma";
            }
    }
};

/**
 * @static
 * @function
 * @name pc.reprojectTexture
 * @description This function reprojects textures between cubemap and equirectangular formats. The
 * function can read and write textures with pixel data in RGBE, RGBM, linear and sRGB formats. When
 * specularPower is specified it will perform a phong-weighted convolution of the source (for generating
 * a gloss maps).
 * @param {pc.GraphicsDevice} device - The graphics device
 * @param {pc.Texture} source - The source texture
 * @param {pc.Texture} target - The target texture
 * @param {number} [specularPower] - optional specular power. When specular power is specified,
 * the source is convolved by a phong-weighted kernel raised to the specified power. Otherwise
 * the function performs a standard resample.
 */
var reprojectTexture = function (device, source, target, specularPower) {
    var processFunc = (specularPower !== undefined) ? 'prefilter' : 'reproject';
    var decodeFunc = "decode" + getCoding(source);
    var encodeFunc = "encode" + getCoding(target);
    var sourceFunc = source.cubemap ? "sampleCubemap" : "sampleEquirect";
    var targetFunc = target.cubemap ? "getDirectionCubemap" : "getDirectionEquirect";

    var shader = createShaderFromCode(
        device,
        shaderChunks.fullscreenQuadVS,
        "#define PROCESS_FUNC " + processFunc + "\n" +
        "#define DECODE_FUNC " + decodeFunc + "\n" +
        "#define ENCODE_FUNC " + encodeFunc + "\n" +
        "#define SOURCE_FUNC " + sourceFunc + "\n" +
        "#define TARGET_FUNC " + targetFunc + "\n" +
        "#define NUM_SAMPLES 1024\n\n" +
        shaderChunks.reprojectPS,
        processFunc + decodeFunc + encodeFunc + sourceFunc + targetFunc,
        null,
        device.webgl2 ? "" : "#extension GL_OES_standard_derivatives: enable\n"
    );

    var constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
    constantSource.setValue(source);

    var constantParams = device.scope.resolve("params");
    var params = new Vec4();
    params.y = (specularPower !== undefined) ? specularPower : 1;
    params.z = 1.0 - (source.fixCubemapSeams ? 1.0 / source.width : 0.0);       // source seam scale
    params.w = 1.0 - (target.fixCubemapSeams ? 1.0 / target.width : 0.0);       // target seam scale

    for (var face = 0; face < (target.cubemap ? 6 : 1); face++) {
        var targ = new RenderTarget(device, target, {
            face: face,
            depth: false
        });
        params.x = face;
        constantParams.setValue(params.data);

        drawQuadWithShader(device, targ, shader);
    }
};

export { reprojectTexture };
