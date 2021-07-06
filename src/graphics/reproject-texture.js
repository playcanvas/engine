import {
    TEXTURETYPE_RGBM, TEXTURETYPE_RGBE,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_NONE
} from './constants.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';
import { GraphicsDevice } from './graphics-device.js';

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
 * @param {Texture} source - The source texture.
 * @param {Texture} target - The target texture.
 * @param {object} [options] - The options object.
 * @param {number} [options.specularPower] - Optional specular power. When specular power is specified,
 * the source is convolved by a phong-weighted kernel raised to the specified power. Otherwise
 * the function performs a standard resample.
 * @param {number} [options.numSamples] - Optional number of samples (default is 1024).
 * @param {number} [options.face] - Optional cubemap face to update (default is update all faces).
 */
function reprojectTexture(source, target, options = {}) {
    // maintain backwards compatibility with previous function signature
    // reprojectTexture(device, source, target, specularPower = 1, numSamples = 1024)
    if (source instanceof GraphicsDevice) {
        source = arguments[1];
        target = arguments[2];
        options = {
            specularPower: arguments[3] === undefined ? 1 : arguments[3],
            numSamples: arguments[4] === undefined ? 1024 : arguments[4]
        };
        // #if _DEBUG
        console.warn('DEPRECATED: please use the updated pc.reprojectTexture API.');
        // #endif
    }

    // extract options
    const device = source.device;
    const specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
    const numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;
    const face = options.hasOwnProperty('face') ? options.face : null;

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
        "#define NUM_SAMPLES " + numSamples + "\n" +
        "#define NUM_SAMPLES_SQRT " + Math.round(Math.sqrt(numSamples)).toFixed(1) + "\n\n" +
        shaderChunks.reprojectPS,
        processFunc + decodeFunc + encodeFunc + sourceFunc + targetFunc,
        null,
        device.webgl2 ? "" : "#extension GL_OES_standard_derivatives: enable\n"
    );

    // #if _DEBUG
    device.pushMarker("ReprojectTexture");
    // #endif

    const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
    constantSource.setValue(source);

    const constantParams = device.scope.resolve("params");
    const params = [
        0,
        specularPower,
        1.0 - (source.fixCubemapSeams ? 1.0 / source.width : 0.0),          // source seam scale
        1.0 - (target.fixCubemapSeams ? 1.0 / target.width : 0.0)           // target seam scale
    ];

    for (let f = 0; f < (target.cubemap ? 6 : 1); f++) {
        if (face === null || f === face) {
            const renderTarget = new RenderTarget({
                colorBuffer: target,
                face: f,
                depth: false
            });
            params[0] = f;
            constantParams.setValue(params);

            drawQuadWithShader(device, renderTarget, shader);

            renderTarget.destroy();
        }
    }

    // #if _DEBUG
    device.popMarker();
    // #endif
}

export { reprojectTexture };
