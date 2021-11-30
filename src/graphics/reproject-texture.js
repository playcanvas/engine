import {
    FILTER_NEAREST,
    TEXTURETYPE_RGBM, TEXTURETYPE_RGBE,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_NONE
} from './constants.js';
import { random } from '../math/random.js';
import { FloatPacking } from '../math/float-packing.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';
import { GraphicsDevice } from './graphics-device.js';
import { Texture } from './texture.js';
import { DeprecatedLog } from '../deprecated/deprecated-log.js';

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

// generate random sequence
function generateRndTex(device, numSamples) {
    const level = new Uint8ClampedArray(numSamples * 4);
    for (let i = 0; i < numSamples; ++i) {
        FloatPacking.float2Bytes(random.radicalInverse(i), level, i * 4, 4);
    }
    return new Texture(device, {
        name: 'rnd',
        width: numSamples,
        height: 1,
        mipmaps: false,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        levels: [level]
    });
}

// cached random texture
let rndTex = null;

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
 * @param {string} [options.distribution] - Specify convolution distribution - 'none', 'lambert', 'phong', 'ggx'. Default depends on specularPower.
 */
function reprojectTexture(source, target, options = {}) {
    // maintain backwards compatibility with previous function signature
    // reprojectTexture(device, source, target, specularPower = 1, numSamples = 1024)
    if (source instanceof GraphicsDevice) {
        source = arguments[1];
        target = arguments[2];
        options = { };
        if (arguments[3] !== undefined) {
            options.specularPower = arguments[3];
        }
        if (arguments[4] !== undefined) {
            options.numSamples = arguments[4];
        }

        DeprecatedLog.log('DEPRECATED: please use the updated pc.reprojectTexture API.');
    }

    // extract options
    const device = source.device;
    const specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
    const numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;
    const face = options.hasOwnProperty('face') ? options.face : null;
    const distribution = options.hasOwnProperty('distribution') ? options.distribution : (specularPower === 1) ? 'none' : 'phong';

    const funcNames = {
        'none': 'reproject',
        'lambert': 'prefilterLambert',
        'phong': 'prefilterPhong',
        'ggx': 'prefilterGGX'
    };

    const processFunc = funcNames[distribution] || 'reproject';
    const decodeFunc = "decode" + getCoding(source);
    const encodeFunc = "encode" + getCoding(target);

    // source projection type
    const sourceFunc = "sample" + getProjectionName(source.projection);

    // target projection type
    const targetFunc = "getDirection" + getProjectionName(target.projection);

    const shader = createShaderFromCode(
        device,
        shaderChunks.fullscreenQuadVS,
        `#define PROCESS_FUNC ${processFunc}\n` +
        `#define DECODE_FUNC ${decodeFunc}\n` +
        `#define ENCODE_FUNC ${encodeFunc}\n` +
        `#define SOURCE_FUNC ${sourceFunc}\n` +
        `#define TARGET_FUNC ${targetFunc}\n` +
        `#define NUM_SAMPLES ${numSamples}\n` +
        `#define NUM_SAMPLES_SQRT ${Math.round(Math.sqrt(numSamples)).toFixed(1)}\n` +
        (device.extTextureLod ? '#define SUPPORTS_TEXLOD\n\n' : '\n') +
        shaderChunks.reprojectPS,
        processFunc + decodeFunc + encodeFunc + sourceFunc + targetFunc,
        null,
        device.webgl2 ? "" : "#extension GL_OES_standard_derivatives: enable\n" + (device.extTextureLod ? "#extension GL_EXT_shader_texture_lod: enable\n" : "")
    );

    // #if _DEBUG
    device.pushMarker("ReprojectTexture");
    // #endif

    const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
    constantSource.setValue(source);

    if (!rndTex) {
        rndTex = generateRndTex(device, 1024);
        device.scope.resolve("rndTex").setValue(rndTex);
    }

    const constantParams = device.scope.resolve("params");
    const constantParams2 = device.scope.resolve("params2");

    const params = [
        0,
        specularPower,
        1.0 - (source.fixCubemapSeams ? 1.0 / source.width : 0.0),          // source seam scale
        1.0 - (target.fixCubemapSeams ? 1.0 / target.width : 0.0)           // target seam scale
    ];

    const params2 = [
        target.width * target.height * (target.cubemap ? 6 : 1),
        source.width * source.height * (source.cubemap ? 6 : 1),
        target.width,
        source.width
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
            constantParams2.setValue(params2);

            drawQuadWithShader(device, renderTarget, shader);

            renderTarget.destroy();
        }
    }

    // #if _DEBUG
    device.popMarker();
    // #endif
}

export { reprojectTexture };
