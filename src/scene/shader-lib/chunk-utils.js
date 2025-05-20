import { SHADERLANGUAGE_GLSL } from '../../platform/graphics/constants.js';
import { ShaderChunks } from './shader-chunks.js';

/**
 * @import { CameraShaderParams } from '../camera-shader-params.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

const decodeTable = {
    'linear': 'decodeLinear',
    'srgb': 'decodeGamma',
    'rgbm': 'decodeRGBM',
    'rgbe': 'decodeRGBE',
    'rgbp': 'decodeRGBP',
    'xy': 'unpackNormalXY',
    'xyz': 'unpackNormalXYZ'
};

const encodeTable = {
    'linear': 'encodeLinear',
    'srgb': 'encodeGamma',
    'rgbm': 'encodeRGBM',
    'rgbe': 'encodeRGBE',
    'rgbp': 'encodeRGBP'
};

class ChunkUtils {
    // returns the name of the decode function for the texture encoding
    static decodeFunc(encoding) {
        return decodeTable[encoding] ?? 'decodeGamma';
    }

    static encodeFunc(encoding) {
        return encodeTable[encoding] ?? 'encodeGamma';
    }

    /**
     * Returns a screenDepth chunk configured for the given camera shader parameters.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraShaderParams} cameraShaderParams - The camera shader parameters.
     * @returns {string} The screenDepth chunk.
     * @ignore
     */
    static getScreenDepthChunk(device, cameraShaderParams) {

        return `
            ${cameraShaderParams.sceneDepthMapLinear ? '#define SCENE_DEPTHMAP_LINEAR' : ''}
            ${device.textureFloatRenderable ? '#define SCENE_DEPTHMAP_FLOAT' : ''}
            ${ShaderChunks.get(device, SHADERLANGUAGE_GLSL).get('screenDepthPS')}
        `;
    }
}

export { ChunkUtils };
