import { Vec3 } from '../math/vec3.js';
import { math } from '../math/math.js';
import { FloatPacking } from '../math/float-packing.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { Texture } from '../graphics/texture.js';
import { PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F, ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST } from '../graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_SPOT } from './constants.js';
import { LightCamera } from './renderer/light-camera.js';

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();
const tempBox = new BoundingBox();

const epsilon = 0.000001;
const maxTextureSize = 4096;    // maximum texture size allowed to work on all devices

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

    // leave last
    COUNT: 30
};

// format of the float texture
const TextureIndexFloat = {
    POSITION_RANGE: 0,              // positions.xyz, range
    SPOT_DIRECTION: 1,              // spot direction.xyz, -

    PROJ_MAT_0: 2,                  // projection matrix raw 0 (spot light)
    ATLAS_VIEWPORT: 2,              // atlas viewport data (omni light)

    PROJ_MAT_1: 3,                  // projection matrix raw 1 (spot light)
    PROJ_MAT_2: 4,                  // projection matrix raw 2 (spot light)
    PROJ_MAT_3: 5,                  // projection matrix raw 3 (spot light)

    // leave last
    COUNT: 6
};

// helper class to store properties of a light used by clustering
class ClusterLight {
    constructor() {
        // the light itself
        this.light = null;

        // bounding box
        this.min = new Vec3();
        this.max = new Vec3();
    }
}

class WorldClusters {
    // format for high precision light texture - float
    static FORMAT_FLOAT = 0;

    // format for high precision light texture - 8bit
    static FORMAT_8BIT = 1;

    // active light texture format, initialized at app start
    static lightTextureFormat = WorldClusters.FORMAT_8BIT;

    // defines used for unpacking of light textures to allow CPU packing to match the GPU unpacking
    static shaderDefines = "";

    // executes when the app starts
    static init(device) {

        // precision for texture storage
        WorldClusters.lightTextureFormat = device.extTextureFloat ? WorldClusters.FORMAT_FLOAT : WorldClusters.FORMAT_8BIT;

        WorldClusters.initShaderDefines();
    }

    // creates list of defines specifying texture coordinates for decoding lights
    static initShaderDefines() {
        const clusterTextureFormat = WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT ? "FLOAT" : "8BIT";
        WorldClusters.shaderDefines = `
            \n#define CLUSTER_TEXTURE_${clusterTextureFormat}
            ${WorldClusters.buildShaderDefines(TextureIndex8, "CLUSTER_TEXTURE_8_")}
            ${WorldClusters.buildShaderDefines(TextureIndexFloat, "CLUSTER_TEXTURE_F_")}
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

    constructor(device, cells, maxCellLightCount, cookiesEnabled = false, shadowsEnabled = false) {
        this.device = device;
        this.name = "Untitled";

        // features
        this.cookiesEnabled = cookiesEnabled;
        this.shadowsEnabled = shadowsEnabled;

        // number of times a warning was reported
        this.reportCount = 0;

        // bounds of all lights
        this._bounds = new BoundingBox();

        // bounds of all light volumes (volume covered by the clusters)
        this.boundsMin = new Vec3();
        this.boundsMax = new Vec3();
        this.boundsDelta = new Vec3();

        // number of cells along 3 axes
        this._cells = new Vec3();       // number of cells
        this._cellsLimit = new Vec3();   // number of cells minus one
        this.cells = cells;

        // number of lights each cell can store, and number of pixels this takes (4 lights per pixel)
        this._maxCellLightCount = 0;
        this._pixelsPerCellCount = 0;
        this.maxCellLightCount = maxCellLightCount;

        // limits on some light properties, used for compression to 8bit texture
        this._maxAttenuation = 0;
        this._maxColorValue = 0;

        // internal list of lights (of type ClusterLight)
        this._usedLights = [];

        // light 0 is always reserved for 'no light' index
        this._usedLights.push(new ClusterLight());

        // register shader uniforms
        this.registerUniforms(device);

        // allocate textures to store lights
        this.initLightsTexture();
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

        this.releaseClusterTexture();
    }

    releaseClusterTexture() {
        if (this.clusterTexture) {
            this.clusterTexture.destroy();
            this.clusterTexture = null;
        }
    }

    registerUniforms(device) {

        this._clusterWorldTextureId = device.scope.resolve("clusterWorldTexture");
        this._clusterPixelsPerCellId = device.scope.resolve("clusterPixelsPerCell");

        this._clusterTextureSizeId = device.scope.resolve("clusterTextureSize");
        this._clusterTextureSizeData = new Float32Array(3);

        this._clusterBoundsMinId = device.scope.resolve("clusterBoundsMin");
        this._clusterBoundsMinData = new Float32Array(3);

        this._clusterBoundsDeltaId = device.scope.resolve("clusterBoundsDelta");
        this._clusterBoundsDeltaData = new Float32Array(3);

        this._clusterCellsCountByBoundsSizeId = device.scope.resolve("clusterCellsCountByBoundsSize");
        this._clusterCellsCountByBoundsSizeData = new Float32Array(3);

        this._clusterCellsDotId = device.scope.resolve("clusterCellsDot");
        this._clusterCellsDotData = new Float32Array(3);

        // number of cells in each direction (vec3)
        this._clusterCellsMaxId = device.scope.resolve("clusterCellsMax");
        this._clusterCellsMaxData = new Float32Array(3);

        // compression limit 0
        this._clusterCompressionLimit0Id = device.scope.resolve("clusterCompressionLimit0");
        this._clusterCompressionLimit0Data = new Float32Array(2);
    }

    get maxCellLightCount() {
        return this._maxCellLightCount;
    }

    set maxCellLightCount(count) {

        // each cell stores 4 lights (xyzw), so round up the count
        const maxCellLightCount = math.roundUp(count, 4);
        if (maxCellLightCount !== this._maxCellLightCount) {
            this._maxCellLightCount = maxCellLightCount;
            this._pixelsPerCellCount = this._maxCellLightCount / 4;
            this._cellsDirty = true;
        }
    }

    get cells() {
        return this._cells;
    }

    set cells(value) {

        // make sure we have whole numbers
        tempVec3.copy(value).floor();

        if (!this._cells.equals(tempVec3)) {
            this._cells.copy(tempVec3);
            this._cellsLimit.copy(tempVec3).sub(Vec3.ONE);
            this._cellsDirty = true;
        }
    }

    createTexture(width, height, format) {
        const tex = new Texture(this.device, {
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

    initLightsTexture() {

        // using 8 bit index so this is maximum supported number of lights
        this.maxLights = 255;

        // shared 8bit texture pixels:
        let pixelsPerLight8 = TextureIndex8.COUNT_ALWAYS;
        let pixelsPerLightFloat = 0;

        // float texture format
        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {
            pixelsPerLightFloat = TextureIndexFloat.COUNT;
        } else { // 8bit texture
            pixelsPerLight8 = TextureIndex8.COUNT;
        }

        // 8bit texture - to store data that can fit into 8bits to lower the bandwidth requirements
        this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
        this.lightsTexture8 = this.createTexture(pixelsPerLight8, this.maxLights, PIXELFORMAT_R8_G8_B8_A8);
        this._lightsTexture8Id = this.device.scope.resolve("lightsTexture8");

        // float texture
        if (pixelsPerLightFloat) {
            this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
            this.lightsTextureFloat = this.createTexture(pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F);
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
    }

    getSpotDirection(direction, spot) {

        // Spots shine down the negative Y axis
        const mat = spot._node.getWorldTransform();
        mat.getY(direction).mulScalar(-1);
        direction.normalize();
    }

    addLightDataFlags(data8, index, light, isSpot) {
        data8[index + 0] = isSpot ? 255 : 0;
        data8[index + 1] = light._shape * 255;         // this need different encoding as value is 0..2
        data8[index + 2] = light._falloffMode * 255;   // we should consider making this global instead of per light
        data8[index + 3] = light.castShadows ? 255 : 0;
    }

    addLightDataColor(data8, index, light, gammaCorrection, isCookie) {
        const invMaxColorValue = 1.0 / this._maxColorValue;
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
        FloatPacking.float2Bytes(light.attenuationEnd / this._maxAttenuation, data8, index + 12, 4);
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

    // fill up both float and 8bit texture data with light properties
    addLightData(light, lightIndex, gammaCorrection) {

        const isSpot = light._type === LIGHTTYPE_SPOT;
        const isCookie = this.cookiesEnabled && !!light._cookie;
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
        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {

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
        }
    }

    updateCells() {
        if (this._cellsDirty) {
            this._cellsDirty = false;

            const cx = this._cells.x;
            const cy = this._cells.y;
            const cz = this._cells.z;

            // storing 4 lights per pixels
            const numCells = cx * cy * cz;
            const totalPixels = this._pixelsPerCellCount * numCells;

            // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
            let width = Math.ceil(Math.sqrt(totalPixels));
            width = math.roundUp(width, this._pixelsPerCellCount);
            const height = Math.ceil(totalPixels / width);

            // if the texture is allowed size
            if (width > maxTextureSize || height > maxTextureSize) {
                // #if _DEBUG
                console.error("LightCluster parameters cause the texture size to be over the limit.");
                // #endif
            }

            // maximum range of cells
            this._clusterCellsMaxData[0] = cx;
            this._clusterCellsMaxData[1] = cy;
            this._clusterCellsMaxData[2] = cz;

            // vector to allow single dot product to convert from world coordinates to cluster index
            this._clusterCellsDotData[0] = this._pixelsPerCellCount;
            this._clusterCellsDotData[1] = cx * cz * this._pixelsPerCellCount;
            this._clusterCellsDotData[2] = cx * this._pixelsPerCellCount;

            // cluster data and number of lights per cell
            this.clusters = new Uint8ClampedArray(4 * totalPixels);
            this.counts = new Int32Array(numCells);

            this._clusterTextureSizeData[0] = width;
            this._clusterTextureSizeData[1] = 1.0 / width;
            this._clusterTextureSizeData[2] = 1.0 / height;

            this.releaseClusterTexture();
            this.clusterTexture = this.createTexture(width, height, PIXELFORMAT_R8_G8_B8_A8);
        }
    }

    uploadTextures() {
        let pixels = this.clusterTexture.lock();
        pixels.set(this.clusters);
        this.clusterTexture.unlock();

        if (this.lightsTextureFloat) {
            pixels = this.lightsTextureFloat.lock();
            pixels.set(this.lightsFloat);
            this.lightsTextureFloat.unlock();
        }

        pixels = this.lightsTexture8.lock();
        pixels.set(this.lights8);
        this.lightsTexture8.unlock();
    }

    updateUniforms() {

        // textures
        this._clusterWorldTextureId.setValue(this.clusterTexture);
        this._lightsTexture8Id.setValue(this.lightsTexture8);

        if (WorldClusters.lightTextureFormat === WorldClusters.FORMAT_FLOAT) {
            this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
        }

        // uniform values
        const boundsDelta = this.boundsDelta;
        this._clusterCellsCountByBoundsSizeData[0] = this._cells.x / boundsDelta.x;
        this._clusterCellsCountByBoundsSizeData[1] = this._cells.y / boundsDelta.y;
        this._clusterCellsCountByBoundsSizeData[2] = this._cells.z / boundsDelta.z;
        this._clusterCellsCountByBoundsSizeId.setValue(this._clusterCellsCountByBoundsSizeData);

        this._clusterBoundsMinData[0] = this.boundsMin.x;
        this._clusterBoundsMinData[1] = this.boundsMin.y;
        this._clusterBoundsMinData[2] = this.boundsMin.z;

        this._clusterBoundsDeltaData[0] = boundsDelta.x;
        this._clusterBoundsDeltaData[1] = boundsDelta.y;
        this._clusterBoundsDeltaData[2] = boundsDelta.z;

        this._clusterCompressionLimit0Data[0] = this._maxAttenuation;
        this._clusterCompressionLimit0Data[1] = this._maxColorValue;

        // assign values
        this._clusterPixelsPerCellId.setValue(this._pixelsPerCellCount);
        this._lightsTextureInvSizeId.setValue(this._lightsTextureInvSizeData);
        this._clusterTextureSizeId.setValue(this._clusterTextureSizeData);
        this._clusterBoundsMinId.setValue(this._clusterBoundsMinData);
        this._clusterBoundsDeltaId.setValue(this._clusterBoundsDeltaData);
        this._clusterCellsDotId.setValue(this._clusterCellsDotData);
        this._clusterCellsMaxId.setValue(this._clusterCellsMaxData);
        this._clusterCompressionLimit0Id.setValue(this._clusterCompressionLimit0Data);
    }

    // evaluates min and max coordinates of AABB of the light in the cell space
    evalLightCellMinMax(clusteredLight, min, max) {

        // min point of AABB in cell space
        min.copy(clusteredLight.min);
        min.sub(this.boundsMin);
        min.div(this.boundsDelta);
        min.mul2(min, this.cells);
        min.floor();

        // max point of AABB in cell space
        max.copy(clusteredLight.max);
        max.sub(this.boundsMin);
        max.div(this.boundsDelta);
        max.mul2(max, this.cells);
        max.ceil();

        // clamp to limits
        min.max(Vec3.ZERO);
        max.min(this._cellsLimit);
    }

    collectLights(lights) {

        // skip index 0 as that is used for unused light
        const usedLights = this._usedLights;
        let lightIndex = 1;

        for (let i = 0; i < lights.length; i++) {

            // use enabled and visible lights
            const light = lights[i];
            if (light.enabled && light.type !== LIGHTTYPE_DIRECTIONAL && light.visibleThisFrame && light.intensity > 0) {

                // within light limit
                if (lightIndex < this.maxLights) {

                    // reuse allocated spot
                    let clusteredLight;
                    if (lightIndex < usedLights.length) {
                        clusteredLight = usedLights[lightIndex];
                    } else {
                        // allocate new spot
                        clusteredLight = new ClusterLight();
                        usedLights.push(clusteredLight);
                    }

                    // store light properties
                    clusteredLight.light = light;
                    light.getBoundingBox(tempBox);
                    clusteredLight.min.copy(tempBox.getMin());
                    clusteredLight.max.copy(tempBox.getMax());

                    lightIndex++;
                } else {
                    console.warn("Clustered lighting: more than " + (this.maxLights - 1) + " lights in the frame, ignoring some.");
                    break;
                }
            }
        }

        usedLights.length = lightIndex;
    }

    // evaluate the area all lights cover
    evaluateBounds() {

        const usedLights = this._usedLights;

        // bounds of the area the lights cover
        const min = this.boundsMin;
        const max = this.boundsMax;

        // if at least one light (index 0 is null, so ignore that one)
        if (usedLights.length > 1) {

            // AABB of the first light
            min.copy(usedLights[1].min);
            max.copy(usedLights[1].max);

            for (let i = 2; i < usedLights.length; i++) {

                // expand by AABB of this light
                min.min(usedLights[i].min);
                max.max(usedLights[i].max);
            }
        } else {

            // any small volume if no lights
            min.set(0, 0, 0);
            max.set(1, 1, 1);
        }

        // bounds range
        this.boundsDelta.sub2(max, min);
    }

    // evaluate ranges of variables compressed to 8bit texture to allow their scaling to 0..1 range
    evaluateCompressionLimits(gammaCorrection) {

        let maxAttenuation = 0;
        let maxColorValue = 0;

        const usedLights = this._usedLights;
        for (let i = 1; i < usedLights.length; i++) {
            const light = usedLights[i].light;
            maxAttenuation = Math.max(light.attenuationEnd, maxAttenuation);

            const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
            maxColorValue = Math.max(color[0], maxColorValue);
            maxColorValue = Math.max(color[1], maxColorValue);
            maxColorValue = Math.max(color[2], maxColorValue);
        }

        // increase slightly as compression needs value < 1
        this._maxAttenuation = maxAttenuation + epsilon;
        this._maxColorValue = maxColorValue + epsilon;
    }

    updateClusters(gammaCorrection) {

        // clear clusters
        this.counts.fill(0);
        this.clusters.fill(0);

        // local accessors
        const divX = this._cells.x;
        const divZ = this._cells.z;
        const counts = this.counts;
        const limit = this._maxCellLightCount;
        const clusters = this.clusters;
        const pixelsPerCellCount = this._pixelsPerCellCount;
        let tooManyLights = false;

        // started from index 1, zero is "no-light" index
        const usedLights = this._usedLights;
        for (let i = 1; i < usedLights.length; i++) {
            const clusteredLight = usedLights[i];
            const light = clusteredLight.light;

            // add light data into textures
            this.addLightData(light, i, gammaCorrection);

            // light's bounds in cell space
            this.evalLightCellMinMax(clusteredLight, tempMin3, tempMax3);

            const xStart = tempMin3.x;
            const xEnd = tempMax3.x;
            const yStart = tempMin3.y;
            const yEnd = tempMax3.y;
            const zStart = tempMin3.z;
            const zEnd = tempMax3.z;

            // add the light to the cells
            for (let x = xStart; x <= xEnd; x++) {
                for (let z = zStart; z <= zEnd; z++) {
                    for (let y = yStart; y <= yEnd; y++) {

                        const clusterIndex = x + divX * (z + y * divZ);
                        const count = counts[clusterIndex];
                        if (count < limit) {
                            clusters[pixelsPerCellCount * clusterIndex * 4 + count] = i;
                            counts[clusterIndex] = count + 1;

                        } else {
                            tooManyLights = true;
                        }

                    }
                }
            }
        }

        // #if _DEBUG
        if (tooManyLights) {
            const reportLimit = 5;
            if (this.reportCount < reportLimit) {
                console.warn("Too many lights in light cluster " + this.name + ", please adjust parameters." +
                (this.reportCount == reportLimit - 1 ? " Giving up on reporting it." : ""));
                this.reportCount++;
            }
        }
        // #endif
    }

    // internal update of the cluster data, executes once per frame
    update(lights, gammaCorrection) {
        this.updateCells();
        this.collectLights(lights);
        this.evaluateBounds();
        this.evaluateCompressionLimits(gammaCorrection);
        this.updateClusters(gammaCorrection);
        this.uploadTextures();
    }

    // called on already updated clusters, activates for rendering by setting up uniforms / textures on the device
    activate() {
        this.updateUniforms();
    }
}

export { WorldClusters };
