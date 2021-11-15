import { Vec3 } from '../../math/vec3.js';
import { PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../../graphics/constants.js';
import { FloatPacking } from '../../math/float-packing.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_SPOT } from '../constants.js';
import { Texture } from '../../graphics/texture.js';
import { LightCamera } from '../renderer/light-camera.js';

const epsilon = 0.000001;

const tempVec3 = new Vec3();
const tempAreaLightSizes = new Float32Array(6);
const areaHalfAxisWidth = new Vec3(-0.5, 0, 0);
const areaHalfAxisHeight = new Vec3(0, 0, 0.5);

// format of a row in 8 bit texture used to encode light data
// this is used to store data in the texture correctly, and also use to generate defines for the shader
const TextureIndex8 = {

    // always 8bit texture data, regardless of float texture support
    FLAGS: 0,                   // lightType, lightShape, fallofMode, castShadows
    COLOR_A: 1,                 // color.r, color.r, color.g, color.g    // HDR color is stored using 2 bytes per channel
    COLOR_B: 2,                 // color.b, color.b, useCookie, -
    SPOT_ANGLES: 3,             // spotInner, spotInner, spotOuter, spotOuter
    SHADOW_BIAS: 4,             // bias, bias, normalBias, normalBias
    COOKIE_A: 5,                // cookieIntensity, cookieIsRgb, -, -
    COOKIE_B: 6,                // cookieChannelMask.xyzw

    // leave in-between
    COUNT_ALWAYS: 7,

    // 8bit texture data used when float texture is not supported
    POSITION_X: 7,              // position.x
    POSITION_Y: 8,              // position.y
    POSITION_Z: 9,              // position.z
    RANGE: 10,                  // range
    SPOT_DIRECTION_X: 11,       // spot direction x
    SPOT_DIRECTION_Y: 12,       // spot direction y
    SPOT_DIRECTION_Z: 13,       // spot direction z

    PROJ_MAT_00: 14,            // light projection matrix, mat4, 16 floats
    ATLAS_VIEWPORT_A: 14,       // viewport.x, viewport.x, viewport.y, viewport.y

    PROJ_MAT_01: 15,
    ATLAS_VIEWPORT_B: 15,       // viewport.z, viewport.z, -, -

    PROJ_MAT_02: 16,
    PROJ_MAT_03: 17,
    PROJ_MAT_10: 18,
    PROJ_MAT_11: 19,
    PROJ_MAT_12: 20,
    PROJ_MAT_13: 21,
    PROJ_MAT_20: 22,
    PROJ_MAT_21: 23,
    PROJ_MAT_22: 24,
    PROJ_MAT_23: 25,
    PROJ_MAT_30: 26,
    PROJ_MAT_31: 27,
    PROJ_MAT_32: 28,
    PROJ_MAT_33: 29,

    AREA_DATA_WIDTH_X: 30,
    AREA_DATA_WIDTH_Y: 31,
    AREA_DATA_WIDTH_Z: 32,
    AREA_DATA_HEIGHT_X: 33,
    AREA_DATA_HEIGHT_Y: 34,
    AREA_DATA_HEIGHT_Z: 35,

    // leave last
    COUNT: 36
};

// format of the float texture
const TextureIndexFloat = {
    POSITION_RANGE: 0,              // positions.xyz, range
    SPOT_DIRECTION: 1,              // spot direction.xyz, -

    PROJ_MAT_0: 2,                  // projection matrix row 0 (spot light)
    ATLAS_VIEWPORT: 2,              // atlas viewport data (omni light)

    PROJ_MAT_1: 3,                  // projection matrix row 1 (spot light)
    PROJ_MAT_2: 4,                  // projection matrix row 2 (spot light)
    PROJ_MAT_3: 5,                  // projection matrix row 3 (spot light)

    AREA_DATA_WIDTH: 6,             // area light half-width.xyz, -
    AREA_DATA_HEIGHT: 7,            // area light half-height.xyz, -

    // leave last
    COUNT: 8
};

// A class used by clustered lighting, responsible for encoding light properties into textures for the use on the GPU
class LightsBuffer {
    // format for high precision light texture - float
    static FORMAT_FLOAT = 0;

    // format for high precision light texture - 8bit
    static FORMAT_8BIT = 1;

    // active light texture format, initialized at app start
    static lightTextureFormat = LightsBuffer.FORMAT_8BIT;

    // defines used for unpacking of light textures to allow CPU packing to match the GPU unpacking
    static shaderDefines = "";

    // creates list of defines specifying texture coordinates for decoding lights
    static initShaderDefines() {
        const clusterTextureFormat = LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT ? "FLOAT" : "8BIT";
        LightsBuffer.shaderDefines = `
            \n#define CLUSTER_TEXTURE_${clusterTextureFormat}
            ${LightsBuffer.buildShaderDefines(TextureIndex8, "CLUSTER_TEXTURE_8_")}
            ${LightsBuffer.buildShaderDefines(TextureIndexFloat, "CLUSTER_TEXTURE_F_")}
        `;
    }

    // converts object with properties to a list of these as an example: "#define CLUSTER_TEXTURE_8_BLAH 1.5"
    static buildShaderDefines(object, prefix) {
        let str = "";
        Object.keys(object).forEach((key) => {
            str += `\n#define ${prefix}${key} ${object[key]}.5`;
        });
        return str;
    }

    // executes when the app starts
    static init(device) {

        // precision for texture storage
        LightsBuffer.lightTextureFormat = device.extTextureFloat ? LightsBuffer.FORMAT_FLOAT : LightsBuffer.FORMAT_8BIT;

        LightsBuffer.initShaderDefines();
    }

    static createTexture(device, width, height, format) {
        const tex = new Texture(device, {
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

    constructor(device, cookiesEnabled, shadowsEnabled, areaLightsEnabled) {

        this.device = device;

        // features
        this.cookiesEnabled = cookiesEnabled;
        this.shadowsEnabled = shadowsEnabled;
        this.areaLightsEnabled = areaLightsEnabled;

        // using 8 bit index so this is maximum supported number of lights
        this.maxLights = 255;

        // shared 8bit texture pixels:
        let pixelsPerLight8 = TextureIndex8.COUNT_ALWAYS;
        let pixelsPerLightFloat = 0;

        // float texture format
        if (LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT) {
            pixelsPerLightFloat = TextureIndexFloat.COUNT;
        } else { // 8bit texture
            pixelsPerLight8 = TextureIndex8.COUNT;
        }

        // 8bit texture - to store data that can fit into 8bits to lower the bandwidth requirements
        this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
        this.lightsTexture8 = LightsBuffer.createTexture(this.device, pixelsPerLight8, this.maxLights, PIXELFORMAT_R8_G8_B8_A8);
        this._lightsTexture8Id = this.device.scope.resolve("lightsTexture8");

        // float texture
        if (pixelsPerLightFloat) {
            this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
            this.lightsTextureFloat = LightsBuffer.createTexture(this.device, pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F);
            this._lightsTextureFloatId = this.device.scope.resolve("lightsTextureFloat");
        } else {
            this.lightsFloat = null;
            this.lightsTextureFloat = null;
            this._lightsTextureFloatId = undefined;
        }

        // inverse sizes for both textures
        this._lightsTextureInvSizeId = this.device.scope.resolve("lightsTextureInvSize");
        this._lightsTextureInvSizeData = new Float32Array(4);
        this._lightsTextureInvSizeData[0] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.width : 0;
        this._lightsTextureInvSizeData[1] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.height : 0;
        this._lightsTextureInvSizeData[2] = 1.0 / this.lightsTexture8.width;
        this._lightsTextureInvSizeData[3] = 1.0 / this.lightsTexture8.height;

        // compression ranges
        this.invMaxColorValue = 0;
        this.invMaxAttenuation = 0;
        this.boundsMin = new Vec3();
        this.boundsDelta = new Vec3();
    }

    destroy() {

        // release textures
        if (this.lightsTexture8) {
            this.lightsTexture8.destroy();
            this.lightsTexture8 = null;
        }

        if (this.lightsTextureFloat) {
            this.lightsTextureFloat.destroy();
            this.lightsTextureFloat = null;
        }
    }

    setCompressionRanges(maxAttenuation, maxColorValue) {
        this.invMaxColorValue = 1 / maxColorValue;
        this.invMaxAttenuation = 1 / maxAttenuation;
    }

    setBounds(min, delta) {
        this.boundsMin.copy(min);
        this.boundsDelta.copy(delta);
    }

    uploadTextures() {

        if (this.lightsTextureFloat) {
            this.lightsTextureFloat.lock().set(this.lightsFloat);
            this.lightsTextureFloat.unlock();
        }

        this.lightsTexture8.lock().set(this.lights8);
        this.lightsTexture8.unlock();
    }

    updateUniforms() {

        // textures
        this._lightsTexture8Id.setValue(this.lightsTexture8);

        if (LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT) {
            this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
        }

        this._lightsTextureInvSizeId.setValue(this._lightsTextureInvSizeData);
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

    addLightDataFlags(data8, index, light, isSpot) {
        data8[index + 0] = isSpot ? 255 : 0;
        data8[index + 1] = light._shape * 64;           // value 0..3
        data8[index + 2] = light._falloffMode * 255;    // value 0..1
        data8[index + 3] = light.castShadows ? 255 : 0;
    }

    addLightDataColor(data8, index, light, gammaCorrection, isCookie) {
        const invMaxColorValue = this.invMaxColorValue;
        const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
        FloatPacking.float2Bytes(color[0] * invMaxColorValue, data8, index + 0, 2);
        FloatPacking.float2Bytes(color[1] * invMaxColorValue, data8, index + 2, 2);
        FloatPacking.float2Bytes(color[2] * invMaxColorValue, data8, index + 4, 2);

        // cookie
        data8[index + 6] = isCookie ? 255 : 0;

        // here we still have unused 1 byte
    }

    addLightDataSpotAngles(data8, index, light) {
        // 2 bytes each
        FloatPacking.float2Bytes(light._innerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 0, 2);
        FloatPacking.float2Bytes(light._outerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 2, 2);
    }

    addLightDataShadowBias(data8, index, light) {
        const lightRenderData = light.getRenderData(null, 0);
        const biases = light._getUniformBiasValues(lightRenderData);
        FloatPacking.float2BytesRange(biases.bias, data8, index, -1, 20, 2);  // bias: -1 to 20 range
        FloatPacking.float2Bytes(biases.normalBias, data8, index + 2, 2);     // normalBias: 0 to 1 range
    }

    addLightDataPositionRange(data8, index, light, pos) {
        // position and range scaled to 0..1 range
        const normPos = tempVec3.sub2(pos, this.boundsMin).div(this.boundsDelta);
        FloatPacking.float2Bytes(normPos.x, data8, index + 0, 4);
        FloatPacking.float2Bytes(normPos.y, data8, index + 4, 4);
        FloatPacking.float2Bytes(normPos.z, data8, index + 8, 4);
        FloatPacking.float2Bytes(light.attenuationEnd * this.invMaxAttenuation, data8, index + 12, 4);
    }

    addLightDataSpotDirection(data8, index, light) {
        this.getSpotDirection(tempVec3, light);
        FloatPacking.float2Bytes(tempVec3.x * (0.5 - epsilon) + 0.5, data8, index + 0, 4);
        FloatPacking.float2Bytes(tempVec3.y * (0.5 - epsilon) + 0.5, data8, index + 4, 4);
        FloatPacking.float2Bytes(tempVec3.z * (0.5 - epsilon) + 0.5, data8, index + 8, 4);
    }

    addLightDataLightProjMatrix(data8, index, lightProjectionMatrix) {
        const matData = lightProjectionMatrix.data;
        for (let m = 0; m < 12; m++)    // these are in -2..2 range
            FloatPacking.float2BytesRange(matData[m], data8, index + 4 * m, -2, 2, 4);
        for (let m = 12; m < 16; m++) {  // these are full float range
            FloatPacking.float2MantisaExponent(matData[m], data8, index + 4 * m, 4);
        }
    }

    addLightDataCookies(data8, index, light) {
        const isRgb = light._cookieChannel === "rgb";
        data8[index + 0] = Math.floor(light.cookieIntensity * 255);
        data8[index + 1] = isRgb ? 255 : 0;
        // we have two unused bytes here

        if (!isRgb) {
            const channel = light._cookieChannel;
            data8[index + 4] = channel === "rrr" ? 255 : 0;
            data8[index + 5] = channel === "ggg" ? 255 : 0;
            data8[index + 6] = channel === "bbb" ? 255 : 0;
            data8[index + 7] = channel === "aaa" ? 255 : 0;
        }
    }

    addLightAtlasViewport(data8, index, atlasViewport) {
        // all these are in 0..1 range
        FloatPacking.float2Bytes(atlasViewport.x, data8, index + 0, 2);
        FloatPacking.float2Bytes(atlasViewport.y, data8, index + 2, 2);
        FloatPacking.float2Bytes(atlasViewport.z / 3, data8, index + 4, 2);
        // we have two unused bytes here
    }

    addLightAreaSizes(data8, index, light) {
        const areaSizes = this.getLightAreaSizes(light);
        for (let i = 0; i < 6; i++) {  // these are full float range
            FloatPacking.float2MantisaExponent(areaSizes[i], data8, index + 4 * i, 4);
        }
    }

    // fill up both float and 8bit texture data with light properties
    addLightData(light, lightIndex, gammaCorrection) {

        const isSpot = light._type === LIGHTTYPE_SPOT;
        const isCookie = this.cookiesEnabled && !!light._cookie;
        const isArea = this.areaLightsEnabled && light.shape !== LIGHTSHAPE_PUNCTUAL;
        const castShadows = this.shadowsEnabled && light.castShadows;
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

        // data always stored in 8bit texture
        const data8 = this.lights8;
        const data8Start = lightIndex * this.lightsTexture8.width * 4;

        // flags
        this.addLightDataFlags(data8, data8Start + 4 * TextureIndex8.FLAGS, light, isSpot);

        // light color
        this.addLightDataColor(data8, data8Start + 4 * TextureIndex8.COLOR_A, light, gammaCorrection, isCookie);

        // spot light angles
        if (isSpot) {
            this.addLightDataSpotAngles(data8, data8Start + 4 * TextureIndex8.SPOT_ANGLES, light);
        }

        // shadow biases
        if (light.castShadows) {
            this.addLightDataShadowBias(data8, data8Start + 4 * TextureIndex8.SHADOW_BIAS, light);
        }

        // cookie properties
        if (isCookie) {
            this.addLightDataCookies(data8, data8Start + 4 * TextureIndex8.COOKIE_A, light);
        }

        // high precision data stored using float texture
        if (LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT) {

            const dataFloat = this.lightsFloat;
            const dataFloatStart = lightIndex * this.lightsTextureFloat.width * 4;

            // pos and range
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 0] = pos.x;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 1] = pos.y;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 2] = pos.z;
            dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 3] = light.attenuationEnd;

            // spot direction
            if (isSpot) {
                this.getSpotDirection(tempVec3, light);
                dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 0] = tempVec3.x;
                dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 1] = tempVec3.y;
                dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 2] = tempVec3.z;
                // here we have unused float
            }

            // light projection matrix
            if (lightProjectionMatrix) {
                const matData = lightProjectionMatrix.data;
                for (let m = 0; m < 16; m++)
                    dataFloat[dataFloatStart + 4 * TextureIndexFloat.PROJ_MAT_0 + m] = matData[m];
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

        } else {    // high precision data stored using 8bit texture

            this.addLightDataPositionRange(data8, data8Start + 4 * TextureIndex8.POSITION_X, light, pos);

            // spot direction
            if (isSpot) {
                this.addLightDataSpotDirection(data8, data8Start + 4 * TextureIndex8.SPOT_DIRECTION_X, light);
            }

            // light projection matrix
            if (lightProjectionMatrix) {
                this.addLightDataLightProjMatrix(data8, data8Start + 4 * TextureIndex8.PROJ_MAT_00, lightProjectionMatrix);
            }

            if (atlasViewport) {
                this.addLightAtlasViewport(data8, data8Start + 4 * TextureIndex8.ATLAS_VIEWPORT_A, atlasViewport);
            }

            // area light sizes
            if (isArea) {
                this.addLightAreaSizes(data8, data8Start + 4 * TextureIndex8.AREA_DATA_WIDTH_X, light);
            }
        }
    }
}

export { LightsBuffer };
