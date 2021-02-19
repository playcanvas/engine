import {
    TEXTURETYPE_RGBM, TEXTURETYPE_RGBE,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_NONE
} from './constants.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';

// get a coding string for texture based on its type and pixel format.
function getCoding(texture) {
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
}

function getProjectionName(projection) {
    // default to equirect if not specified
    if (projection === TEXTUREPROJECTION_NONE) {
        projection = TEXTUREPROJECTION_EQUIRECT;
    }
    switch (projection) {
        case TEXTUREPROJECTION_CUBE: return "Cubemap";
        case TEXTUREPROJECTION_EQUIRECT: return "Equirect";
        case TEXTUREPROJECTION_OCTAHEDRAL: return "Octahedral";
    }
}

/**
 * @static
 * @function
 * @name reprojectTexture
 * @description This function reprojects textures between cubemap, equirectangular and octahedral formats. The
 * function can read and write textures with pixel data in RGBE, RGBM, linear and sRGB formats. When
 * specularPower is specified it will perform a phong-weighted convolution of the source (for generating
 * a gloss maps).
 * @param {GraphicsDevice} device - The graphics device
 * @param {Texture} source - The source texture
 * @param {Texture} target - The target texture
 * @param {number} [specularPower] - optional specular power. When specular power is specified,
 * the source is convolved by a phong-weighted kernel raised to the specified power. Otherwise
 * the function performs a standard resample.
 * @param {number} [numSamples] - optional number of samples (default is 1024).
 */
function reprojectTexture(device, source, target, specularPower = 1, numSamples = 1024) {
    const processFunc = (specularPower === 1) ? 'reproject' : 'prefilter';
    const decodeFunc = "decode" + getCoding(source);
    const encodeFunc = "encode" + getCoding(target);

    // source projection type
    const sourceFunc = "sample" + getProjectionName(source.projection);

    // target projection type
    const targetFunc = "getDirection" + getProjectionName(target.projection);

    const shader = createShaderFromCode(
        device,
        shaderChunks.fullscreenQuadVS,
        "#define PROCESS_FUNC " + processFunc + "\n" +
        "#define DECODE_FUNC " + decodeFunc + "\n" +
        "#define ENCODE_FUNC " + encodeFunc + "\n" +
        "#define SOURCE_FUNC " + sourceFunc + "\n" +
        "#define TARGET_FUNC " + targetFunc + "\n" +
        "#define NUM_SAMPLES " + numSamples + "\n\n" +
        shaderChunks.reprojectPS,
        processFunc + decodeFunc + encodeFunc + sourceFunc + targetFunc,
        null,
        device.webgl2 ? "" : "#extension GL_OES_standard_derivatives: enable\n"
    );

    // #ifdef DEBUG
    device.pushMarker("ReprojectTexture");
    // #endif

    const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
    constantSource.setValue(source);

    const constantParams = device.scope.resolve("params");
    let params = new Float32Array(4);
    params[1] = specularPower;
    params[2] = 1.0 - (source.fixCubemapSeams ? 1.0 / source.width : 0.0);       // source seam scale
    params[3] = 1.0 - (target.fixCubemapSeams ? 1.0 / target.width : 0.0);       // target seam scale

    for (let face = 0; face < (target.cubemap ? 6 : 1); face++) {
        const targ = new RenderTarget(device, target, {
            face: face,
            depth: false
        });
        params[0] = face;
        constantParams.setValue(params);

        drawQuadWithShader(device, targ, shader);
    }

    // #ifdef DEBUG
    device.popMarker("");
    // #endif
}

export { reprojectTexture };
