
import { Vec4 } from '../math/vec4.js';

import {
    TEXTURETYPE_RGBM, TEXTURETYPE_RGBE,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F
} from './graphics.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './chunks.js';
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
 * @name pc.reproject
 * @description Reproject a cubemap into equirectangular layout or visa-versa
 * in RGBE, RGBM, linear or SRGB encoding.
 * @param {pc.GraphicsDevice} device - The graphics device
 * @param {pc.Texture} source - The texture that requires reprojection
 * @param {pc.Texture} target - The target texture
 */
var reproject = function (device, source, target, specularPower) {
    var chunks = shaderChunks;

    var decodeFunc = "decode" + getCoding(source);
    var encodeFunc = "encode" + getCoding(target);
    var sourceFunc = source.cubemap ? "sampleCubemap" : "sampleEquirect";
    var targetFunc = target.cubemap ? "getDirectionCubemap" : "getDirectionEquirect";

    var shader = chunks.createShaderFromCode(
        device,
        chunks.fullscreenQuadVS,
        "#define DECODE_FUNC " + decodeFunc + "\n" +
        "#define ENCODE_FUNC " + encodeFunc + "\n" +
        "#define SOURCE_FUNC " + sourceFunc + "\n" +
        "#define TARGET_FUNC " + targetFunc + "\n" +
        "#define NUM_SAMPLES 1024\n\n" +
        chunks.reprojectPS,
        "reproject" + decodeFunc + encodeFunc + sourceFunc + targetFunc,
        null,
        device.webgl2 ? "" : "#extension GL_OES_standard_derivatives: enable\n"
    );

    var constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
    constantSource.setValue(source);

    var constantParams = device.scope.resolve("params");
    var params = new Vec4();
    params.y = specularPower !== undefined ? specularPower : 1,
    params.z = specularPower !== undefined ? 1 : 0;

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

export { reproject };
