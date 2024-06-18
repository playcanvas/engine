import { Vec3 } from '../../core/math/vec3.js';
import { PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { FloatPacking } from '../../core/math/float-packing.js';
import { LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_SPOT, MASK_AFFECT_LIGHTMAPPED, MASK_AFFECT_DYNAMIC } from '../constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LightCamera } from '../renderer/light-camera.js';

const epsilon = 0.000001;

const tempVec3 = new Vec3();
const tempAreaLightSizes = new Float32Array(6);
const areaHalfAxisWidth = new Vec3(-0.5, 0, 0);
const areaHalfAxisHeight = new Vec3(0, 0, 0.5);

// format of a row in 8 bit texture used to encode light data
// this is used to store data in the texture correctly, and also use to generate defines for the shader
const TextureIndex8 = {

    // format of the 8bit texture data
    FLAGS: 0,                   // lightType, lightShape, fallofMode, castShadows
    COLOR_A: 1,                 // color.r, color.r, color.g, color.g    // HDR color is stored using 2 bytes per channel
    COLOR_B: 2,                 // color.b, color.b, useCookie, lightMask
    SPOT_ANGLES: 3,             // spotInner, spotInner, spotOuter, spotOuter
    SHADOW_BIAS: 4,             // bias, bias, normalBias, normalBias
    COOKIE_A: 5,                // cookieIntensity, cookieIsRgb, -, -
    COOKIE_B: 6,                // cookieChannelMask.xyzw

    // leave last
    COUNT: 7
};

// format of the float texture data
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

let _defines;

// A class used by clustered lighting, responsible for encoding light properties into textures for the use on the GPU
class LightsBuffer {
    static getShaderDefines() {

        // converts object with properties to a list of these as an example: "#define CLUSTER_TEXTURE_8_BLAH 1"
        const buildShaderDefines = (object, prefix) => {
            return Object.keys(object)
                .map(key => `#define ${prefix}${key} ${object[key]}`)
                .join('\n');
        };

        if (!_defines) {
            _defines =  `\n
                ${buildShaderDefines(TextureIndex8, 'CLUSTER_TEXTURE_8_')}
                ${buildShaderDefines(TextureIndexFloat, 'CLUSTER_TEXTURE_F_')}
            `;
        }

        return _defines;
    }

    constructor(device) {

        this.device = device;

        // features
        this.cookiesEnabled = false;
        this.shadowsEnabled = false;
        this.areaLightsEnabled = false;

        // using 8 bit index so this is maximum supported number of lights
        this.maxLights = 255;

        // 8bit texture - to store data that can fit into 8bits to lower the bandwidth requirements
        const pixelsPerLight8 = TextureIndex8.COUNT;
        this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
        this.lightsTexture8 = this.createTexture(this.device, pixelsPerLight8, this.maxLights, PIXELFORMAT_RGBA8, 'LightsTexture8');
        this._lightsTexture8Id = this.device.scope.resolve('lightsTexture8');

        // float texture
        const pixelsPerLightFloat = TextureIndexFloat.COUNT;
        this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
        this.lightsTextureFloat = this.createTexture(this.device, pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F, 'LightsTextureFloat');
        this._lightsTextureFloatId = this.device.scope.resolve('lightsTextureFloat');

        // compression ranges
        this.invMaxColorValue = 0;
        this.invMaxAttenuation = 0;
        this.boundsMin = new Vec3();
        this.boundsDelta = new Vec3();
    }

    destroy() {

        // release textures
        this.lightsTexture8?.destroy();
        this.lightsTexture8 = null;

        this.lightsTextureFloat?.destroy();
        this.lightsTextureFloat = null;
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

    setCompressionRanges(maxAttenuation, maxColorValue) {
        this.invMaxColorValue = 1 / maxColorValue;
        this.invMaxAttenuation = 1 / maxAttenuation;
    }

    setBounds(min, delta) {
        this.boundsMin.copy(min);
        this.boundsDelta.copy(delta);
    }

    uploadTextures() {

        this.lightsTextureFloat.lock().set(this.lightsFloat);
        this.lightsTextureFloat.unlock();

        this.lightsTexture8.lock().set(this.lights8);
        this.lightsTexture8.unlock();
    }

    updateUniforms() {

        // textures
        this._lightsTexture8Id.setValue(this.lightsTexture8);
        this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
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

    addLightDataFlags(data8, index, light, isSpot, castShadows, shadowIntensity) {
        data8[index + 0] = isSpot ? 255 : 0;
        data8[index + 1] = light._shape * 64;           // value 0..3
        data8[index + 2] = light._falloffMode * 255;    // value 0..1
        data8[index + 3] = castShadows ? shadowIntensity * 255 : 0;
    }

    addLightDataColor(data8, index, light, isCookie) {
        const invMaxColorValue = this.invMaxColorValue;
        const color = light._colorLinear;
        FloatPacking.float2Bytes(color[0] * invMaxColorValue, data8, index + 0, 2);
        FloatPacking.float2Bytes(color[1] * invMaxColorValue, data8, index + 2, 2);
        FloatPacking.float2Bytes(color[2] * invMaxColorValue, data8, index + 4, 2);

        // cookie
        data8[index + 6] = isCookie ? 255 : 0;

        // lightMask
        // 0: MASK_AFFECT_DYNAMIC
        // 127: MASK_AFFECT_DYNAMIC && MASK_AFFECT_LIGHTMAPPED
        // 255: MASK_AFFECT_LIGHTMAPPED
        const isDynamic = !!(light.mask & MASK_AFFECT_DYNAMIC);
        const isLightmapped = !!(light.mask & MASK_AFFECT_LIGHTMAPPED);
        data8[index + 7] = (isDynamic && isLightmapped) ? 127 : (isLightmapped ? 255 : 0);
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

    addLightDataCookies(data8, index, light) {
        const isRgb = light._cookieChannel === 'rgb';
        data8[index + 0] = Math.floor(light.cookieIntensity * 255);
        data8[index + 1] = isRgb ? 255 : 0;
        // we have two unused bytes here

        if (!isRgb) {
            const channel = light._cookieChannel;
            data8[index + 4] = channel === 'rrr' ? 255 : 0;
            data8[index + 5] = channel === 'ggg' ? 255 : 0;
            data8[index + 6] = channel === 'bbb' ? 255 : 0;
            data8[index + 7] = channel === 'aaa' ? 255 : 0;
        }
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

        // data always stored in 8bit texture
        const data8 = this.lights8;
        const data8Start = lightIndex * this.lightsTexture8.width * 4;

        // flags
        this.addLightDataFlags(data8, data8Start + 4 * TextureIndex8.FLAGS, light, isSpot, castShadows, light.shadowIntensity);

        // light color
        this.addLightDataColor(data8, data8Start + 4 * TextureIndex8.COLOR_A, light, isCookie);

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
    }
}

export { LightsBuffer };
