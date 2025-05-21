import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { FloatPacking } from '../../core/math/float-packing.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_SPOT, LIGHTSHAPE_RECT, LIGHTSHAPE_DISK, LIGHTSHAPE_SPHERE, LIGHT_COLOR_DIVIDER } from '../constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LightCamera } from '../renderer/light-camera.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';

const tempVec3 = new Vec3();
const tempAreaLightSizes = new Float32Array(6);
const areaHalfAxisWidth = new Vec3(-0.5, 0, 0);
const areaHalfAxisHeight = new Vec3(0, 0, 0.5);

// format of the float texture data
const TextureIndexFloat = {
    POSITION_RANGE: 0,              // positions.xyz, range
    DIRECTION_FLAGS: 1,             // spot direction.xyz, 32bit flags
    COLOR_ANGLES_BIAS: 2,           // color.rgb, spot inner and outer, bias and normal bias (half floats format), 16bits unused

    PROJ_MAT_0: 3,                  // projection matrix row 0 (spot light)
    ATLAS_VIEWPORT: 3,              // atlas viewport data (omni light)

    PROJ_MAT_1: 4,                  // projection matrix row 1 (spot light)
    PROJ_MAT_2: 5,                  // projection matrix row 2 (spot light)
    PROJ_MAT_3: 6,                  // projection matrix row 3 (spot light)

    AREA_DATA_WIDTH: 7,             // area light half-width.xyz, -
    AREA_DATA_HEIGHT: 8,            // area light half-height.xyz, -

    // leave last
    COUNT: 9
};

// enums supplied to the shader as inject-defines
const enums = {
    'LIGHTSHAPE_PUNCTUAL': `${LIGHTSHAPE_PUNCTUAL}u`,
    'LIGHTSHAPE_RECT': `${LIGHTSHAPE_RECT}u`,
    'LIGHTSHAPE_DISK': `${LIGHTSHAPE_DISK}u`,
    'LIGHTSHAPE_SPHERE': `${LIGHTSHAPE_SPHERE}u`,
    'LIGHT_COLOR_DIVIDER': `${LIGHT_COLOR_DIVIDER}.0`
};

// converts object with properties to a list of these as an example: "#define {CLUSTER_TEXTURE_8_BLAH} 1"
const buildShaderDefines = (object, prefix) => {
    return Object.keys(object)
    .map(key => `#define {${prefix}${key}} ${object[key]}`)
    .join('\n');
};

// create a shader chunk with defines for the light buffer textures
const lightBufferDefines = `\n
    ${buildShaderDefines(TextureIndexFloat, 'CLUSTER_TEXTURE_')}
    ${buildShaderDefines(enums, '')}
`;

// A class used by clustered lighting, responsible for encoding light properties into textures for the use on the GPU
class LightsBuffer {
    areaLightsEnabled = false;

    constructor(device) {

        this.device = device;

        // shader chunk with defines
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('lightBufferDefinesPS', lightBufferDefines);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('lightBufferDefinesPS', lightBufferDefines);

        // features
        this.cookiesEnabled = false;
        this.shadowsEnabled = false;
        this.areaLightsEnabled = false;

        // using 8 bit index so this is maximum supported number of lights
        this.maxLights = 255;

        // float texture
        const pixelsPerLightFloat = TextureIndexFloat.COUNT;
        this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
        this.lightsUint = new Uint32Array(this.lightsFloat.buffer);
        this.lightsTexture = this.createTexture(this.device, pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F, 'LightsTexture');
        this._lightsTextureId = this.device.scope.resolve('lightsTexture');

        // compression ranges
        this.invMaxColorValue = 0;
        this.invMaxAttenuation = 0;
        this.boundsMin = new Vec3();
        this.boundsDelta = new Vec3();
    }

    destroy() {

        // release texture
        this.lightsTexture?.destroy();
        this.lightsTexture = null;
    }

    createTexture(device, width, height, format, name) {
        const tex = new Texture(device, {
            name: name,
            width: width,
            height: height,
            mipmaps: false,
            format: format,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            type: TEXTURETYPE_DEFAULT,
            magFilter: FILTER_NEAREST,
            minFilter: FILTER_NEAREST,
            anisotropy: 1
        });

        return tex;
    }

    setBounds(min, delta) {
        this.boundsMin.copy(min);
        this.boundsDelta.copy(delta);
    }

    uploadTextures() {

        this.lightsTexture.lock().set(this.lightsFloat);
        this.lightsTexture.unlock();
    }

    updateUniforms() {

        // texture
        this._lightsTextureId.setValue(this.lightsTexture);
    }

    getSpotDirection(direction, spot) {

        // Spots shine down the negative Y axis
        const mat = spot._node.getWorldTransform();
        mat.getY(direction).mulScalar(-1);
        direction.normalize();
    }

    // half sizes of area light in world space, returned as an array of 6 floats
    getLightAreaSizes(light) {

        const mat = light._node.getWorldTransform();

        mat.transformVector(areaHalfAxisWidth, tempVec3);
        tempAreaLightSizes[0] = tempVec3.x;
        tempAreaLightSizes[1] = tempVec3.y;
        tempAreaLightSizes[2] = tempVec3.z;

        mat.transformVector(areaHalfAxisHeight, tempVec3);
        tempAreaLightSizes[3] = tempVec3.x;
        tempAreaLightSizes[4] = tempVec3.y;
        tempAreaLightSizes[5] = tempVec3.z;

        return tempAreaLightSizes;
    }

    // fill up both float and 8bit texture data with light properties
    addLightData(light, lightIndex) {

        const isSpot = light._type === LIGHTTYPE_SPOT;
        const hasAtlasViewport = light.atlasViewportAllocated; // if the light does not have viewport, it does not fit to the atlas
        const isCookie = this.cookiesEnabled && !!light._cookie && hasAtlasViewport;
        const isArea = this.areaLightsEnabled && light.shape !== LIGHTSHAPE_PUNCTUAL;
        const castShadows = this.shadowsEnabled && light.castShadows && hasAtlasViewport;
        const pos = light._node.getPosition();

        let lightProjectionMatrix = null;   // light projection matrix - used for shadow map and cookie of spot light
        let atlasViewport = null;   // atlas viewport info - used for shadow map and cookie of omni light
        if (isSpot) {
            if (castShadows) {
                const lightRenderData = light.getRenderData(null, 0);
                lightProjectionMatrix = lightRenderData.shadowMatrix;
            } else if (isCookie) {
                lightProjectionMatrix = LightCamera.evalSpotCookieMatrix(light);
            }
        } else {
            if (castShadows || isCookie) {
                atlasViewport = light.atlasViewport;
            }
        }

        const dataFloat = this.lightsFloat;
        const dataUint = this.lightsUint;
        const dataFloatStart = lightIndex * this.lightsTexture.width * 4;

        // pos and range
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 0] = pos.x;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 1] = pos.y;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 2] = pos.z;
        dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 3] = light.attenuationEnd;

        // color, spot angles, biases
        const clusteredData = light.clusteredData;
        dataUint[dataFloatStart + 4 * TextureIndexFloat.COLOR_ANGLES_BIAS + 0] = clusteredData[0];
        dataUint[dataFloatStart + 4 * TextureIndexFloat.COLOR_ANGLES_BIAS + 1] = clusteredData[1];
        dataUint[dataFloatStart + 4 * TextureIndexFloat.COLOR_ANGLES_BIAS + 2] = clusteredData[2];

        // biases (those are non-constant values, needs simplification)
        if (light.castShadows) {
            const lightRenderData = light.getRenderData(null, 0);
            const biases = light._getUniformBiasValues(lightRenderData);

            // store them in 32bits as half floats
            const biasHalf = FloatPacking.float2Half(biases.bias);
            const normalBiasHalf = FloatPacking.float2Half(biases.normalBias);
            dataUint[dataFloatStart + 4 * TextureIndexFloat.COLOR_ANGLES_BIAS + 3] = biasHalf | (normalBiasHalf << 16);
        }

        // spot direction
        if (isSpot) {
            this.getSpotDirection(tempVec3, light);
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.DIRECTION_FLAGS + 0] = tempVec3.x;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.DIRECTION_FLAGS + 1] = tempVec3.y;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.DIRECTION_FLAGS + 2] = tempVec3.z;
            // here we have unused float
        }

        // flags
        dataUint[dataFloatStart + 4 * TextureIndexFloat.DIRECTION_FLAGS + 3] = light.getClusteredFlags(castShadows, isCookie);

        // light projection matrix
        if (lightProjectionMatrix) {
            const matData = lightProjectionMatrix.data;
            for (let m = 0; m < 16; m++) {
                dataFloat[dataFloatStart + 4 * TextureIndexFloat.PROJ_MAT_0 + m] = matData[m];
            }
        }

        if (atlasViewport) {
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 0] = atlasViewport.x;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 1] = atlasViewport.y;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 2] = atlasViewport.z / 3; // size of a face slot (3x3 grid)
        }

        // area light sizes
        if (isArea) {
            const areaSizes = this.getLightAreaSizes(light);
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 0] = areaSizes[0];
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 1] = areaSizes[1];
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 2] = areaSizes[2];

            dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 0] = areaSizes[3];
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 1] = areaSizes[4];
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 2] = areaSizes[5];
        }
    }
}

export { LightsBuffer };
